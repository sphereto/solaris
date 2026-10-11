// Headless check that the zoom camera puts the planet where the design says, at the right size.
import * as THREE from 'three';
import { it, expect } from 'vitest';
import { FOV_DEG, focusDirection, focusDistance, focusLayout } from './layout';

function project(w: number, h: number, planet: THREE.Vector3, r: number) {
  const aspect = w / h;
  const cam = new THREE.PerspectiveCamera(FOV_DEG, aspect, 0.1, 2500);
  const dir = focusDirection(planet.x, planet.z);
  const dist = focusDistance(aspect, r);
  cam.position.set(planet.x + dir[0] * dist, planet.y + dir[1] * dist, planet.z + dir[2] * dist);
  cam.up.set(0, 1, 0);
  cam.lookAt(planet);
  const { cx, cy } = focusLayout(aspect);
  cam.setViewOffset(w, h, w * (0.5 - cx), h * (0.5 - cy), w, h);
  cam.updateMatrixWorld();
  const toPx = (v: THREE.Vector3) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * w, (-p.y * 0.5 + 0.5) * h]; };
  const centre = toPx(planet);
  // a point on the planet's limb, one radius to the camera's right
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const edge = toPx(planet.clone().addScaledVector(right, r));
  return { centre, radiusPx: Math.hypot(edge[0] - centre[0], edge[1] - centre[1]) };
}

it('portrait: centre on the bottom edge, radius 78% of width', () => {
  const r = project(390, 844, new THREE.Vector3(10, 0, 3), 3.1);
  expect(r.centre[0]).toBeCloseTo(195, 0);
  expect(r.centre[1]).toBeCloseTo(844, 0);
  expect(r.radiusPx).toBeGreaterThan(0.76 * 390);
  expect(r.radiusPx).toBeLessThan(0.80 * 390);
});
it('landscape: centre on the left edge, radius 60% of height', () => {
  const r = project(1280, 720, new THREE.Vector3(-20, 0, 7), 1.35);
  expect(r.centre[0]).toBeCloseTo(0, 0);
  expect(r.centre[1]).toBeCloseTo(360, 0);
  expect(r.radiusPx).toBeGreaterThan(0.58 * 720);
  expect(r.radiusPx).toBeLessThan(0.62 * 720);
});
