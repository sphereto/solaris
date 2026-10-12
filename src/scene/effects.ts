import * as THREE from 'three';
import type { PlanetId } from '../ephemeris/planets';

/** Soft halo around each planet that has an atmosphere. `scale` is the halo size relative to the planet. */
export const ATMOSPHERES: Partial<Record<PlanetId, { color: number; scale: number; opacity: number }>> = {
  venus: { color: 0xffd6a0, scale: 1.45, opacity: 0.85 },
  earth: { color: 0x5fb4ff, scale: 1.5, opacity: 0.95 },
  mars: { color: 0xff9d70, scale: 1.35, opacity: 0.35 },
  jupiter: { color: 0xf0d2a8, scale: 1.3, opacity: 0.3 },
  saturn: { color: 0xf4e4b8, scale: 1.3, opacity: 0.3 },
  uranus: { color: 0x9ff0f0, scale: 1.45, opacity: 0.65 },
  neptune: { color: 0x5a80ff, scale: 1.45, opacity: 0.75 },
};

/**
 * Axes of a ring that lies in a planet's equatorial plane, for a planet tilted by `tiltDeg`
 * about the Z axis (how the scene tilts planets): the plane's normal and its two in-plane axes.
 */
export function ringAxes(tiltDeg: number): { axis: [number, number, number]; e1: [number, number, number]; e2: [number, number, number] } {
  const t = (tiltDeg * Math.PI) / 180;
  return { axis: [-Math.sin(t), Math.cos(t), 0], e1: [Math.cos(t), Math.sin(t), 0], e2: [0, 0, 1] };
}

/** White ring-shaped glow: clear inside the planet's edge, brightest just outside it, fading out. */
export function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.69, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.78, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A faint band of stars and dust drawn once. Wraps sideways so there is no seam. */
export function makeMilkyWayTexture(rand: () => number): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    const blob = (x: number, y: number, r: number, rgb: string, a: number) => {
      for (const dx of [-w, 0, w]) {
        const cx = x + dx;
        if (cx < -r || cx > w + r) continue;
        const grad = g.createRadialGradient(cx, y, 0, cx, y, r);
        grad.addColorStop(0, `rgba(${rgb},${a})`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grad;
        g.fillRect(cx - r, y - r, r * 2, r * 2);
      }
    };
    const gauss = () => (rand() + rand() + rand() - 1.5) * 2; // roughly -3..3
    for (let i = 0; i < 7000; i++) {
      const u = rand() * w;
      const width = 0.55 + 0.45 * Math.sin((u / w) * Math.PI * 4 + 1);
      const y = h / 2 + gauss() * h * 0.055 * width;
      const core = Math.exp(-(((u / w) - 0.3) ** 2) / 0.02); // warmer, brighter near one spot
      const rgb = core > 0.5 ? '255,214,170' : '150,165,255';
      blob(u, y, 6 + rand() * 24, rgb, 0.025 + rand() * 0.04 + core * 0.02);
    }
    // dark dust lanes along the band
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 260; i++) {
      const u = rand() * w;
      blob(u, h / 2 + gauss() * h * 0.025, 8 + rand() * 20, '0,0,0', 0.12 + rand() * 0.12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export const STAR_VERTEX = /* glsl */ `
attribute float aPhase;
attribute float aSize;
attribute vec3 aColor;
uniform float uTime;
uniform float uPx;
uniform float uTwinkle;
varying vec3 vColor;
varying float vAlpha;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float tw = 0.5 + 0.5 * sin(uTime * (0.8 + aSize * 0.5) + aPhase);
  gl_PointSize = aSize * uPx * mix(1.0, 0.8 + 0.4 * tw, uTwinkle);
  vColor = aColor;
  vAlpha = 0.85 * mix(1.0, 0.45 + 0.75 * tw, uTwinkle);
}
`;

export const STAR_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.0, d));
}
`;

/** Darkens the part of Saturn's rings that lies in the planet's shadow. Patched into a MeshBasicMaterial. */
export const RING_VERTEX_DECL = 'varying vec3 vWPos;';
export const RING_VERTEX_SET = 'vWPos = (modelMatrix * vec4(position, 1.0)).xyz;';
export const RING_FRAGMENT_DECL = /* glsl */ `
varying vec3 vWPos;
uniform vec3 uPlanetCenter;
uniform float uPlanetRadius;
uniform float uShadowOn;
`;
export const RING_FRAGMENT_SHADE = /* glsl */ `
{
  vec3 toSun = normalize(-vWPos);
  vec3 oc = vWPos - uPlanetCenter;
  float b = dot(oc, toSun);
  float disc = b * b - (dot(oc, oc) - uPlanetRadius * uPlanetRadius);
  float r2 = uPlanetRadius * uPlanetRadius;
  float shade = step(b, 0.0) * smoothstep(-0.06 * r2, 0.10 * r2, disc);
  outgoingLight *= mix(1.0, 0.12, shade * uShadowOn);
}
`;

/** Shadow of the rings on the planet's body: a clear sphere that is black where the ring blocks the Sun. */
export const BODY_SHADOW_VERTEX = /* glsl */ `
varying vec3 vWPos;
varying vec3 vN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const BODY_SHADOW_FRAGMENT = /* glsl */ `
uniform vec3 uCenter;
uniform vec3 uAxis;
uniform vec3 uE1;
uniform vec3 uE2;
uniform float uInner;
uniform float uOuter;
uniform float uOn;
uniform sampler2D uRingMap;
varying vec3 vWPos;
varying vec3 vN;
void main() {
  vec3 L = normalize(-vWPos);
  float lit = smoothstep(0.0, 0.15, dot(normalize(vN), L));
  vec3 rel = vWPos - uCenter;
  float denom = dot(L, uAxis);
  float shadow = 0.0;
  if (abs(denom) > 1e-4) {
    float s = -dot(rel, uAxis) / denom;
    if (s > 0.0) {
      vec3 q = rel + s * L;
      float rho = length(q);
      if (rho > uInner && rho < uOuter) {
        vec2 uv = vec2(dot(q, uE1), -dot(q, uE2)) / uOuter * 0.5 + 0.5;
        shadow = texture2D(uRingMap, uv).a;
      }
    }
  }
  gl_FragColor = vec4(0.0, 0.0, 0.0, shadow * lit * 0.85 * uOn);
}
`;

/* ---- Reference versions of the shader maths, used by tests to check the geometry ---- */

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** 1 when a ring point is in the planet's shadow (Sun at the origin), 0 in sunlight; soft at the edge. */
export function ringPointShade(point: V3, center: V3, radius: number): number {
  const toSun = norm([-point[0], -point[1], -point[2]]);
  const oc = sub(point, center);
  const b = dot(oc, toSun);
  const disc = b * b - (dot(oc, oc) - radius * radius);
  const r2 = radius * radius;
  const t = Math.min(1, Math.max(0, (disc + 0.06 * r2) / (0.16 * r2)));
  return (b <= 0 ? 1 : 0) * t * t * (3 - 2 * t);
}

/** Opacity (0..1) of the ring's shadow on a point of the planet's surface, given the ring's axes and size. */
export function bodyPointShadow(point: V3, center: V3, tiltDeg: number, inner: number, outer: number, ringAlpha = 1): number {
  const { axis, e1, e2 } = ringAxes(tiltDeg);
  const L = norm([-point[0], -point[1], -point[2]]);
  const rel = sub(point, center);
  const denom = dot(L, axis);
  if (Math.abs(denom) <= 1e-4) return 0;
  const s = -dot(rel, axis) / denom;
  if (s <= 0) return 0;
  const q: V3 = [rel[0] + s * L[0], rel[1] + s * L[1], rel[2] + s * L[2]];
  const rho = Math.hypot(...q);
  void e1;
  void e2;
  return rho > inner && rho < outer ? ringAlpha : 0;
}
