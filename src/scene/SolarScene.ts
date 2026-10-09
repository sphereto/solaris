import * as THREE from 'three';
import { PLANETS, dateForOffset, planetStates } from '../ephemeris/planets';
import { timeStore } from '../state/time';
import {
  FOV_DEG,
  PITCH_PRESETS,
  PLANET_COUNT,
  cameraDistance,
  cameraPosition,
  nextPitchIndex,
  orbitPosition,
  ringRadius,
  visualSpin,
} from './layout';
import { PLANET_VISUALS, SUN_VISUAL, type PlanetVisual } from './planetData';
import { TapGesture } from './tapGesture';

interface PlanetNode {
  ring: number;
  /** Positioned on its orbit ring. */
  group: THREE.Group;
  /** Axial tilt lives here; the body spins inside it. */
  body: THREE.Mesh;
  spin: number;
  clouds?: { mesh: THREE.Mesh; drift: number };
}

const EPHEMERIS_REFRESH_MS = 30_000;
const SLOW_FRAME_MS = 24; // ~42 fps
const VERY_SLOW_FRAME_MS = 34; // ~30 fps

function textureUrl(file: string): string {
  return `${import.meta.env.BASE_URL}textures/${file}`;
}

/** Deterministic RNG so the starfield looks the same every launch. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Vanilla Three.js controller. React owns the canvas element and the HUD; this class
 * owns everything inside the canvas and never goes through React state per frame.
 */
export class SolarScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sphere = new THREE.SphereGeometry(1, 64, 32);
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly planets: PlanetNode[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly tap: TapGesture;
  private readonly loader = new THREE.TextureLoader();

  private sun!: THREE.Mesh;
  private sunSpin = 0;

  private pitchIndex = 0;
  private pitch: number = PITCH_PRESETS[0];
  private pitchTarget: number = PITCH_PRESETS[0];

  private displayOffset = timeStore.getTarget();
  private lastEphemerisAt = 0;
  private ephemerisDirty = true;

  private pixelRatio: number;
  private fpsCap = false;
  private lastTime = 0;
  private lastRenderAt = 0;
  private frameAccum = 0;
  private frameCount = 0;
  private running = false;
  private contextLost = false;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    this.pixelRatio = Math.min(dpr, 2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // High-DPI screens hide aliasing already, so skip MSAA there to save fill rate.
      antialias: dpr < 2,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.scene.background = new THREE.Color(0x03040a);

    this.camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 2500);
    this.camera.up.set(0, 0, -1);

    this.buildLights();
    this.buildStars();
    this.buildRings();
    this.buildSun();
    this.buildPlanets();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    this.tap = new TapGesture(
      () => this.cyclePitch(),
      () => this.resetPitch(),
    );
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.start();
  }

  /* ---------------------------------------------------------------- build */

  private track<T extends { dispose(): void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildLights() {
    // Point light at the Sun with no distance falloff so Neptune stays readable.
    // Intensity pi gives a surface facing the light its full texture brightness.
    const sunLight = new THREE.PointLight(0xffffff, Math.PI * 1.1, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0x9aa8d0, 0.5));
  }

  private buildStars() {
    const rand = mulberry32(20261008);
    const count = 1800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 900;
      positions[i * 3] = r * s * Math.cos(t);
      positions[i * 3 + 1] = r * u;
      positions[i * 3 + 2] = r * s * Math.sin(t);
    }
    const geometry = this.track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = this.track(
      new THREE.PointsMaterial({
        color: 0xbfc8ff,
        size: 1.5,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.scene.add(new THREE.Points(geometry, material));
  }

  private buildRings() {
    const material = this.track(
      new THREE.LineBasicMaterial({ color: 0x7584b8, transparent: true, opacity: 0.38 }),
    );
    for (let i = 0; i < PLANET_COUNT; i++) {
      const r = ringRadius(i);
      const pts: THREE.Vector3[] = [];
      const segments = 192;
      for (let k = 0; k < segments; k++) {
        const a = (k / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
      }
      const geometry = this.track(new THREE.BufferGeometry().setFromPoints(pts));
      this.scene.add(new THREE.LineLoop(geometry, material));
    }
  }

  private applyTexture(file: string, apply: (tex: THREE.Texture) => void, srgb = true) {
    this.loader.load(
      textureUrl(file),
      (tex) => {
        if (this.disposed) {
          tex.dispose();
          return;
        }
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        this.track(tex);
        apply(tex);
      },
      undefined,
      () => console.info(`[solaris] texture not found, using flat color: ${file}`),
    );
  }

  private buildSun() {
    const material = this.track(new THREE.MeshBasicMaterial({ color: SUN_VISUAL.color }));
    this.sun = new THREE.Mesh(this.sphere, material);
    this.sun.scale.setScalar(SUN_VISUAL.radius);
    this.sun.rotation.z = THREE.MathUtils.degToRad(SUN_VISUAL.tiltDeg);
    this.sunSpin = visualSpin(SUN_VISUAL.spinHours);
    this.scene.add(this.sun);

    // Soft glow: a camera-facing sprite with a radial gradient drawn once on a canvas.
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
      grad.addColorStop(0.25, 'rgba(255, 170, 80, 0.45)');
      grad.addColorStop(0.6, 'rgba(255, 120, 40, 0.10)');
      grad.addColorStop(1, 'rgba(255, 100, 20, 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
    }
    const glowTex = this.track(new THREE.CanvasTexture(c));
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Sprite(
      this.track(
        new THREE.SpriteMaterial({
          map: glowTex,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      ),
    );
    glow.scale.setScalar(SUN_VISUAL.radius * 5.2);
    this.scene.add(glow);

    this.applyTexture(SUN_VISUAL.texture, (tex) => {
      material.map = tex;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    });
  }

  private buildPlanets() {
    PLANETS.forEach(({ id }, ring) => {
      const v = PLANET_VISUALS[id];
      const group = new THREE.Group();

      // Tilt wrapper so the spin axis leans by the planet's real obliquity.
      const tilt = new THREE.Group();
      tilt.rotation.z = THREE.MathUtils.degToRad(v.tiltDeg);
      group.add(tilt);

      const material = this.track(
        new THREE.MeshStandardMaterial({ color: v.color, roughness: 1, metalness: 0 }),
      );
      const body = new THREE.Mesh(this.sphere, material);
      body.scale.setScalar(v.radius);
      tilt.add(body);

      this.applyTexture(v.texture, (tex) => {
        material.map = tex;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      });

      const node: PlanetNode = { ring, group, body, spin: visualSpin(v.spinHours) };

      if (v.clouds) {
        const cloudMat = this.track(
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1,
            metalness: 0,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        );
        const mesh = new THREE.Mesh(this.sphere, cloudMat);
        mesh.scale.setScalar(v.radius * v.clouds.radiusScale);
        tilt.add(mesh);
        node.clouds = { mesh, drift: v.clouds.driftRadPerSec };
        // Grayscale cloud map: brightness becomes opacity.
        this.applyTexture(
          v.clouds.texture,
          (tex) => {
            cloudMat.alphaMap = tex;
            cloudMat.opacity = 1;
            cloudMat.needsUpdate = true;
          },
          false,
        );
      }

      if (v.ring) {
        this.buildPlanetRing(tilt, v);
      }

      this.scene.add(group);
      this.planets.push(node);
    });
  }

  private buildPlanetRing(parent: THREE.Object3D, v: PlanetVisual) {
    if (!v.ring) return;
    const inner = v.radius * v.ring.innerScale;
    const outer = v.radius * v.ring.outerScale;
    // RingGeometry's default UVs treat the ring as a square image with the outer edge
    // touching the image border, which is exactly how saturn-ring.png is cropped:
    // a top-down picture of the ring disc, hole in the middle, transparent outside.
    const geometry = this.track(new THREE.RingGeometry(inner, outer, 128, 1));

    const material = this.track(
      new THREE.MeshBasicMaterial({
        map: this.track(this.makeFallbackRingTexture()),
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    parent.add(mesh);

    this.applyTexture(v.ring.texture, (tex) => {
      material.map = tex;
      material.needsUpdate = true;
    });
  }

  /**
   * Procedural ring disc (same layout as saturn-ring.png: hole at half the radius),
   * used until the real ring texture loads, or if it is missing.
   */
  private makeFallbackRingTexture(): THREE.CanvasTexture {
    const size = 512;
    const half = size / 2;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    if (g) {
      g.translate(half, half);
      g.lineWidth = 3;
      for (let i = 0; i <= 128; i++) {
        const t = i / 128; // 0 = inner edge, 1 = outer edge
        let a = 0.6 + 0.12 * Math.sin(t * 40);
        if (t < 0.25) a = 0.3;
        else if (t < 0.62) a = 0.85;
        else if (t < 0.67) a = 0.05;
        g.strokeStyle = `rgba(214, 192, 150, ${a})`;
        g.beginPath();
        g.arc(0, 0, (0.5 + 0.5 * t) * (half - 2), 0, Math.PI * 2);
        g.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ---------------------------------------------------------------- input */

  private readonly onPointerDown = (e: PointerEvent) => {
    this.tap.pointerDown(e.clientX, e.clientY, e.timeStamp);
  };
  private readonly onPointerUp = (e: PointerEvent) => {
    this.tap.pointerUp(e.clientX, e.clientY, e.timeStamp);
  };
  private readonly onPointerCancel = () => this.tap.pointerCancel();

  private cyclePitch() {
    this.pitchIndex = nextPitchIndex(this.pitchIndex);
    this.pitchTarget = PITCH_PRESETS[this.pitchIndex];
  }

  private resetPitch() {
    this.pitchIndex = 0;
    this.pitchTarget = PITCH_PRESETS[0];
  }

  /* ----------------------------------------------------------- lifecycle */

  private readonly onContextLost = (e: Event) => {
    // Without preventDefault the browser will never give the context back.
    e.preventDefault();
    this.contextLost = true;
    this.stop();
  };

  private readonly onContextRestored = () => {
    this.contextLost = false;
    this.ephemerisDirty = true;
    this.start();
  };

  private readonly onVisibility = () => {
    if (document.hidden) this.stop();
    else if (!this.contextLost) this.start();
  };

  private start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTime = performance.now();
    this.lastRenderAt = this.lastTime;
    this.renderer.setAnimationLoop(this.frame);
  }

  private stop() {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.placeCamera();
  }

  private placeCamera() {
    const d = cameraDistance(this.camera.aspect);
    const [x, y, z] = cameraPosition(d, this.pitch);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }

  /* ---------------------------------------------------------------- frame */

  private readonly frame = (nowMs: number) => {
    if (this.disposed) return;
    const sinceRender = nowMs - this.lastRenderAt;
    if (this.fpsCap && sinceRender < 30) return;

    const dt = Math.min(0.1, Math.max(0, (nowMs - this.lastTime) / 1000));
    this.lastTime = nowMs;
    this.lastRenderAt = nowMs;

    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.adaptQuality(sinceRender);
  };

  private update(dt: number) {
    // Ease the shown date toward the dial so scrubbing feels smooth.
    const target = timeStore.getTarget();
    const diff = target - this.displayOffset;
    if (diff !== 0) {
      this.displayOffset += diff * (1 - Math.exp(-dt * 10));
      if (Math.abs(target - this.displayOffset) < 1e-4) this.displayOffset = target;
      this.ephemerisDirty = true;
    }
    if (Date.now() - this.lastEphemerisAt > EPHEMERIS_REFRESH_MS) this.ephemerisDirty = true;

    if (this.ephemerisDirty) {
      this.ephemerisDirty = false;
      this.lastEphemerisAt = Date.now();
      const states = planetStates(dateForOffset(Date.now(), this.displayOffset));
      states.forEach((s, i) => {
        const [x, y, z] = orbitPosition(ringRadius(this.planets[i].ring), s.longitudeDeg);
        this.planets[i].group.position.set(x, y, z);
      });
    }

    for (const p of this.planets) {
      p.body.rotation.y += p.spin * dt;
      if (p.clouds) p.clouds.mesh.rotation.y += (p.spin + p.clouds.drift) * dt;
    }
    this.sun.rotation.y += this.sunSpin * dt;

    // Ease the camera pitch toward its preset.
    const pDiff = this.pitchTarget - this.pitch;
    if (pDiff !== 0) {
      this.pitch += pDiff * (1 - Math.exp(-dt * 7));
      if (Math.abs(this.pitchTarget - this.pitch) < 0.01) this.pitch = this.pitchTarget;
      this.placeCamera();
    }
  }

  /**
   * One-way quality ladder: if frames are slow, lower the render resolution first,
   * then cap the frame rate at about 30 fps. It never climbs back up, which avoids
   * flip-flopping between tiers on a device that is borderline.
   */
  private adaptQuality(frameMs: number) {
    this.frameAccum += frameMs;
    this.frameCount++;
    if (this.frameCount < 90) return;
    const avg = this.frameAccum / this.frameCount;
    this.frameAccum = 0;
    this.frameCount = 0;

    if (avg > SLOW_FRAME_MS && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
      this.resize();
    } else if (avg > VERY_SLOW_FRAME_MS && !this.fpsCap) {
      this.fpsCap = true;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    this.tap.dispose();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.sphere.dispose();
    this.disposables.forEach((d) => d.dispose());
    // Not calling forceContextLoss(): React StrictMode remounts on the same canvas in
    // development, and a force-lost context would leave the new renderer blank.
    this.renderer.dispose();
  }
}
