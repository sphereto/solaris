import * as THREE from 'three';
import { PLANETS, dateForOffset, planetStates } from '../ephemeris/planets';
import { focusStore } from '../state/focus';
import { settingsCore } from '../state/settingsCore';
import { START_VIEW_INDEX, effectiveEffects, labelOpacity, pixelRatioFor, prefersReducedMotion, spinMultiplier } from '../state/settingsMath';
import { timeStore } from '../state/time';
import {
  FOV_DEG,
  PITCH_PRESETS,
  PLANET_COUNT,
  RING_FRAME_FACTOR,
  cameraDistance,
  cameraPosition,
  focusDirection,
  focusDistance,
  focusLayout,
  focusSpin,
  nextPitchIndex,
  orbitPosition,
  ringRadius,
  visualSpin,
} from './layout';
import { PLANET_VISUALS, SUN_VISUAL, type PlanetVisual } from './planetData';
import {
  ATMOSPHERES,
  BODY_SHADOW_FRAGMENT,
  BODY_SHADOW_VERTEX,
  RING_FRAGMENT_DECL,
  RING_FRAGMENT_SHADE,
  RING_VERTEX_DECL,
  RING_VERTEX_SET,
  STAR_FRAGMENT,
  STAR_VERTEX,
  makeGlowTexture,
  makeMilkyWayTexture,
  ringAxes,
} from './effects';
import { pickTarget } from './picking';
import { TapGesture } from './tapGesture';

interface PlanetNode {
  ring: number;
  /** Positioned on its orbit ring. */
  group: THREE.Group;
  /** Axial tilt lives here; the body spins inside it. */
  body: THREE.Mesh;
  spin: number;
  clouds?: { mesh: THREE.Mesh; drift: number };
  glow?: THREE.Sprite;
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
  private ringMaterial!: THREE.LineBasicMaterial;
  private glowTexture?: THREE.CanvasTexture;

  /* Zoomed-in view: `focusMix` eases 0..1, `focusS` is its smoothed version used for blending. */
  private focusIdx = 0;
  private focusMix = 0;
  private focusS = 0;
  private readonly focusPos = new THREE.Vector3();
  private readonly focusLook = new THREE.Vector3();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpLook = new THREE.Vector3();
  private readonly tmpUp = new THREE.Vector3();
  private readonly upY = new THREE.Vector3(0, 1, 0);
  private reduceMotion = false;
  private readonly motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  /* Visual effects and settings */
  private settings = settingsCore.get();
  private qualityMode: string = 'auto';
  private lowPower = false;
  private lastStartView: string | null = null;
  private clock = 0;
  private starMaterial!: THREE.ShaderMaterial;
  private milkyWay!: THREE.Mesh;
  private sunHalo!: THREE.Sprite;
  private readonly bodyShadows: Array<{ mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform> }> = [];
  private readonly ringShadowUniforms: Array<{ uShadowOn: THREE.IUniform }> = [];
  private labelLayer!: HTMLDivElement;
  private readonly labelEls: HTMLSpanElement[] = [];
  private labelsVisible = false;
  private unsubSettings: (() => void) | null = null;
  private down = { x: 0, y: 0, t: 0 };

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

    this.camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 2500);
    this.camera.up.set(0, 0, -1);

    this.buildLights();
    this.buildStars();
    this.buildMilkyWay();
    this.buildRings();
    this.buildSun();
    this.buildPlanets();
    this.buildLabels();

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
    this.motionQuery?.addEventListener('change', this.onSettingsChange);
    this.unsubSettings = settingsCore.subscribe(this.onSettingsChange);
    this.applySettings();

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
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 900;
      positions[i * 3] = r * s * Math.cos(t);
      positions[i * 3 + 1] = r * u;
      positions[i * 3 + 2] = r * s * Math.sin(t);
      phases[i] = rand() * Math.PI * 2;
      sizes[i] = 1.2 + Math.pow(rand(), 3) * 2.4;
      const warm = rand(); // 0 blue-white, 1 warm
      colors[i * 3] = 0.75 + 0.25 * warm;
      colors[i * 3 + 1] = 0.8 + 0.1 * warm;
      colors[i * 3 + 2] = 1 - 0.25 * warm;
    }
    const geometry = this.track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.starMaterial = this.track(
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPx: { value: this.pixelRatio }, uTwinkle: { value: 1 } },
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        transparent: true,
        depthWrite: false,
      }),
    );
    const points = new THREE.Points(geometry, this.starMaterial);
    points.frustumCulled = false;
    this.scene.add(points);
  }

  /** A faint Milky Way painted on a big inside-out sphere behind everything. */
  private buildMilkyWay() {
    const texture = this.track(makeMilkyWayTexture(mulberry32(7771)));
    const geometry = this.track(new THREE.SphereGeometry(950, 48, 24));
    const material = this.track(
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, transparent: true, opacity: 0.6, depthWrite: false, fog: false }),
    );
    this.milkyWay = new THREE.Mesh(geometry, material);
    this.milkyWay.rotation.set(Math.PI / 2, 0.6, 0.35); // lets the band cross the overhead view
    this.milkyWay.renderOrder = -10;
    this.milkyWay.frustumCulled = false;
    this.scene.add(this.milkyWay);
  }

  /** Planet names as plain HTML over the canvas; positions are updated each frame. */
  private buildLabels() {
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'planet-labels';
    this.labelLayer.setAttribute('aria-hidden', 'true');
    this.labelLayer.style.opacity = '0';
    for (const p of PLANETS) {
      const el = document.createElement('span');
      el.textContent = p.name;
      this.labelLayer.appendChild(el);
      this.labelEls.push(el);
    }
    (this.canvas.parentElement ?? document.body).appendChild(this.labelLayer);
  }

  private buildRings() {
    const material = this.track(
      new THREE.LineBasicMaterial({ color: 0x7584b8, transparent: true, opacity: 0.38 }),
    );
    this.ringMaterial = material;
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

    // A second, much wider and fainter halo for a richer corona.
    this.sunHalo = new THREE.Sprite(
      this.track(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a50, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.26 })),
    );
    this.sunHalo.scale.setScalar(SUN_VISUAL.radius * 11);
    this.scene.add(this.sunHalo);

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

      const atmosphere = ATMOSPHERES[id];
      if (atmosphere) {
        this.glowTexture ??= this.track(makeGlowTexture());
        const sprite = new THREE.Sprite(
          this.track(
            new THREE.SpriteMaterial({
              map: this.glowTexture,
              color: atmosphere.color,
              opacity: atmosphere.opacity,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              transparent: true,
            }),
          ),
        );
        sprite.scale.setScalar(v.radius * 2 * atmosphere.scale);
        group.add(sprite);
        node.glow = sprite;
      }

      if (v.ring) {
        this.buildPlanetRing(tilt, v, group);
      }

      this.scene.add(group);
      this.planets.push(node);
    });
  }

  private buildPlanetRing(parent: THREE.Object3D, v: PlanetVisual, planet: THREE.Object3D) {
    if (!v.ring) return;
    const inner = v.radius * v.ring.innerScale;
    const outer = v.radius * v.ring.outerScale;
    // RingGeometry's default UVs treat the ring as a square image with the outer edge
    // touching the image border, which is exactly how saturn-ring.png is cropped:
    // a top-down picture of the ring disc, hole in the middle, transparent outside.
    const geometry = this.track(new THREE.RingGeometry(inner, outer, 128, 1));

    const fallback = this.track(this.makeFallbackRingTexture());
    const material = this.track(
      new THREE.MeshBasicMaterial({
        map: fallback,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    );

    // The planet's shadow falls on the rings: darken ring pixels whose line to the Sun hits the planet.
    const ringUniforms = {
      uPlanetCenter: { value: planet.position },
      uPlanetRadius: { value: v.radius },
      uShadowOn: { value: 1 },
    };
    this.ringShadowUniforms.push(ringUniforms);
    material.customProgramCacheKey = () => 'solaris-ring-shadow';
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, ringUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${RING_VERTEX_DECL}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${RING_VERTEX_SET}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${RING_FRAGMENT_DECL}`)
        .replace('#include <opaque_fragment>', `${RING_FRAGMENT_SHADE}\n#include <opaque_fragment>`);
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    parent.add(mesh);

    // The rings' shadow falls on the planet: a clear sphere that is black where the ring blocks the Sun.
    const axes = ringAxes(v.tiltDeg);
    const uniforms: Record<string, THREE.IUniform> = {
      uCenter: { value: planet.position },
      uAxis: { value: new THREE.Vector3(...axes.axis) },
      uE1: { value: new THREE.Vector3(...axes.e1) },
      uE2: { value: new THREE.Vector3(...axes.e2) },
      uInner: { value: inner },
      uOuter: { value: outer },
      uOn: { value: 1 },
      uRingMap: { value: fallback },
    };
    const shadowMesh = new THREE.Mesh(
      this.sphere,
      this.track(new THREE.ShaderMaterial({ uniforms, vertexShader: BODY_SHADOW_VERTEX, fragmentShader: BODY_SHADOW_FRAGMENT, transparent: true, depthWrite: false })),
    );
    shadowMesh.scale.setScalar(v.radius * 1.004);
    parent.add(shadowMesh);
    this.bodyShadows.push({ mesh: shadowMesh, uniforms });

    this.applyTexture(v.ring.texture, (tex) => {
      material.map = tex;
      material.needsUpdate = true;
      uniforms.uRingMap.value = tex;
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

  /* ------------------------------------------------------------- settings */

  private readonly onSettingsChange = () => this.applySettings();

  private applySettings() {
    const s = settingsCore.get();
    const dpr = window.devicePixelRatio || 1;
    const previousQuality = this.qualityMode;
    this.settings = s;
    this.qualityMode = s.quality;

    if (s.quality === 'saver') this.fpsCap = true;
    else if (previousQuality === 'saver' || previousQuality === 'high' || s.quality === 'high') this.fpsCap = false;
    if (s.quality !== 'auto') this.lowPower = false;
    if (s.quality !== previousQuality || this.lastStartView === null) {
      this.pixelRatio = pixelRatioFor(s.quality, dpr);
      this.resize();
    }

    this.reduceMotion = prefersReducedMotion(s.reduceMotion, this.motionQuery?.matches ?? false);

    if (s.startView !== this.lastStartView) {
      this.lastStartView = s.startView;
      this.pitchIndex = START_VIEW_INDEX[s.startView];
      this.pitchTarget = PITCH_PRESETS[this.pitchIndex];
    }
    this.refreshEffects();
  }

  private refreshEffects() {
    const fx = effectiveEffects(this.settings, this.lowPower);
    for (const p of this.planets) if (p.glow) p.glow.visible = fx.glow;
    this.sunHalo.visible = fx.glow;
    this.milkyWay.visible = fx.sky;
    this.starMaterial.uniforms.uTwinkle.value = fx.sky && !this.reduceMotion ? 1 : 0;
    for (const u of this.ringShadowUniforms) u.uShadowOn.value = fx.ringShadows ? 1 : 0;
    for (const b of this.bodyShadows) {
      b.mesh.visible = fx.ringShadows;
      b.uniforms.uOn.value = fx.ringShadows ? 1 : 0;
    }
  }

  private updateLabels() {
    const op = labelOpacity(this.settings.labels, this.pitch, this.focusS);
    if (op < 0.01) {
      if (this.labelsVisible) {
        this.labelLayer.style.opacity = '0';
        this.labelsVisible = false;
      }
      return;
    }
    this.labelsVisible = true;
    this.labelLayer.style.opacity = String(op);
    const w = this.canvas.parentElement?.clientWidth ?? 1;
    const h = this.canvas.parentElement?.clientHeight ?? 1;
    const tanHalf = Math.tan((FOV_DEG * Math.PI) / 360);
    const v = new THREE.Vector3();
    this.planets.forEach((node, i) => {
      v.copy(node.group.position);
      const dist = this.camera.position.distanceTo(v);
      v.project(this.camera);
      const el = this.labelEls[i];
      if (v.z > 1) {
        el.style.opacity = '0';
        return;
      }
      const radius = PLANET_VISUALS[PLANETS[i].id].radius;
      const rpx = (radius / (dist * tanHalf)) * (h / 2);
      const x = (v.x * 0.5 + 0.5) * w + rpx + 8;
      const y = (-v.y * 0.5 + 0.5) * h;
      el.style.opacity = '1';
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateY(-50%)`;
    });
  }

  /* ---------------------------------------------------------------- input */

  private readonly onPointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    if (focusStore.get() === null) this.tap.pointerDown(e.clientX, e.clientY, e.timeStamp);
  };
  private readonly onPointerUp = (e: PointerEvent) => {
    const dx = e.clientX - this.down.x;
    const dy = e.clientY - this.down.y;
    if (focusStore.get() !== null) {
      // Zoomed in: a sideways swipe moves to the next or previous planet.
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) focusStore.step(dx < 0 ? 1 : -1);
      return;
    }
    const quick = Math.hypot(dx, dy) <= 10 && e.timeStamp - this.down.t <= 500;
    if (quick) {
      const hit = this.pickPlanet(e.clientX, e.clientY);
      if (hit !== null) {
        this.tap.pointerCancel();
        focusStore.set(hit);
        return;
      }
    }
    this.tap.pointerUp(e.clientX, e.clientY, e.timeStamp);
  };
  private readonly onPointerCancel = () => this.tap.pointerCancel();

  /** Which planet a tap landed on, using each planet's on-screen position. Null while zooming. */
  private pickPlanet(clientX: number, clientY: number): number | null {
    if (this.focusMix > 0.05) return null;
    const rect = this.canvas.getBoundingClientRect();
    const tanHalf = Math.tan((FOV_DEG * Math.PI) / 360);
    this.camera.updateMatrixWorld();
    const v = new THREE.Vector3();
    const targets = this.planets.map((node, id) => {
      v.copy(node.group.position);
      const dist = this.camera.position.distanceTo(v);
      v.project(this.camera);
      const radius = PLANET_VISUALS[PLANETS[id].id].radius;
      return {
        id,
        x: (v.x * 0.5 + 0.5) * rect.width,
        y: (-v.y * 0.5 + 0.5) * rect.height,
        r: (radius / (dist * tanHalf)) * (rect.height / 2),
      };
    });
    return pickTarget(targets, clientX - rect.left, clientY - rect.top);
  }

  private cyclePitch() {
    if (!this.settings.tapToTilt) return;
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
    if (this.starMaterial) this.starMaterial.uniforms.uPx.value = this.pixelRatio;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.placeCamera();
  }

  private placeCamera() {
    this.updateCamera();
  }

  /**
   * Blends the overhead camera with the zoomed-in one by `focusS`. The zoomed camera
   * looks at the planet from beside the Sun's direction, and a lens shift (not a pan)
   * moves the planet to the bottom or left edge so the disc is not stretched.
   */
  private updateCamera() {
    const s = this.focusS;
    const d = cameraDistance(this.camera.aspect);
    const [x, y, z] = cameraPosition(d, this.pitch);
    this.tmpPos.set(x, y, z).lerp(this.focusPos, s);
    this.tmpLook.set(0, 0, 0).lerp(this.focusLook, s);
    this.tmpUp.set(0, 0, -1).lerp(this.upY, s).normalize();
    this.camera.position.copy(this.tmpPos);
    this.camera.up.copy(this.tmpUp);
    this.camera.lookAt(this.tmpLook);

    if (s > 0.0005) {
      const { cx, cy } = focusLayout(this.camera.aspect);
      const w = Math.max(1, this.canvas.parentElement?.clientWidth ?? 1);
      const h = Math.max(1, this.canvas.parentElement?.clientHeight ?? 1);
      this.camera.setViewOffset(w, h, s * w * (0.5 - cx), s * h * (0.5 - cy), w, h);
    } else {
      this.camera.clearViewOffset();
    }
    this.ringMaterial.opacity = 0.38 - 0.33 * s;
  }

  /** Eases the zoom in or out and keeps the camera glued to the focused planet as it orbits. */
  private stepFocus(dt: number) {
    const want = focusStore.get();
    if (want !== null) this.focusIdx = want;
    const target = want !== null ? 1 : 0;

    if (this.reduceMotion) this.focusMix = target;
    else if (this.focusMix !== target) {
      this.focusMix += (target - this.focusMix) * (1 - Math.exp(-dt * 3.4));
      if (Math.abs(target - this.focusMix) < 0.002) this.focusMix = target;
    }
    const m = this.focusMix;
    const nextS = m * m * (3 - 2 * m); // smoothstep: slow, fast, slow
    const moving = nextS > 0 || this.focusS > 0;

    if (moving) {
      const node = this.planets[this.focusIdx];
      const v = PLANET_VISUALS[PLANETS[this.focusIdx].id];
      const p = node.group.position;
      const dir = focusDirection(p.x, p.z);
      const dist = focusDistance(this.camera.aspect, v.radius * (v.ring ? RING_FRAME_FACTOR : 1));
      this.tmpPos.set(p.x + dir[0] * dist, p.y + dir[1] * dist, p.z + dir[2] * dist);
      if (want !== null && m < 0.02) {
        // Starting out: begin exactly on the planet, no sideways drift.
        this.focusPos.copy(this.tmpPos);
        this.focusLook.copy(p);
      } else {
        // Already zoomed (or flying to another planet): slide toward the planet's current spot.
        const k = this.reduceMotion ? 1 : 1 - Math.exp(-dt * 5);
        this.focusPos.lerp(this.tmpPos, k);
        this.focusLook.lerp(p, k);
      }
    }

    this.focusS = nextS;
    if (moving) this.updateCamera();
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

    this.clock += dt;
    this.starMaterial.uniforms.uTime.value = this.clock;
    if (this.sunHalo.visible) {
      (this.sunHalo.material as THREE.SpriteMaterial).opacity = 0.26 + (this.reduceMotion ? 0 : 0.04 * Math.sin(this.clock * 0.7));
    }

    this.stepFocus(dt);
    const spinMult = spinMultiplier(this.settings.spinSpeed);

    this.planets.forEach((p, i) => {
      // The planet you are looking at turns at a calm, readable speed.
      const base = i === this.focusIdx ? p.spin + (focusSpin(p.spin) - p.spin) * this.focusS : p.spin;
      const spin = base * spinMult;
      p.body.rotation.y += spin * dt;
      if (p.clouds) p.clouds.mesh.rotation.y += (spin + p.clouds.drift) * dt;
    });
    this.sun.rotation.y += this.sunSpin * spinMult * dt;
    this.updateLabels();

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
    if (this.qualityMode !== 'auto') {
      this.frameAccum = 0;
      this.frameCount = 0;
      return;
    }
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
      this.lowPower = true; // very slow: stop drawing the heavy extras
      this.refreshEffects();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    this.tap.dispose();
    this.unsubSettings?.();
    this.motionQuery?.removeEventListener('change', this.onSettingsChange);
    this.labelLayer.remove();
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
