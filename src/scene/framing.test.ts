import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PLANET_VISUALS } from './planetData';
import {
  FOV_DEG,
  PITCH_PRESETS,
  PLANET_COUNT,
  cameraDistance,
  cameraPosition,
  orbitPosition,
  ringRadius,
} from './layout';

/**
 * Builds the same camera the scene uses and checks that the outermost ring, with
 * a planet's width of slack, stays on screen at every pitch preset and screen shape.
 */
describe('camera framing', () => {
  const outer = ringRadius(PLANET_COUNT - 1);
  const slack = PLANET_VISUALS.neptune.radius; // outermost body

  for (const aspect of [0.45, 0.56, 0.75, 1, 1.78, 2.2]) {
    for (const pitch of PITCH_PRESETS) {
      it(`keeps Neptune's whole orbit on screen at aspect ${aspect}, pitch ${pitch}`, () => {
        const camera = new THREE.PerspectiveCamera(FOV_DEG, aspect, 1, 2500);
        camera.up.set(0, 0, -1);
        const [x, y, z] = cameraPosition(cameraDistance(aspect), pitch);
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();

        let worst = 0;
        for (let deg = 0; deg < 360; deg += 3) {
          const [px, py, pz] = orbitPosition(outer + slack, deg);
          const ndc = new THREE.Vector3(px, py, pz).project(camera);
          expect(ndc.z).toBeLessThan(1); // in front of the far plane
          worst = Math.max(worst, Math.abs(ndc.x), Math.abs(ndc.y));
        }
        expect(worst).toBeLessThanOrEqual(1);
      });
    }
  }

  it('points screen-up at ecliptic longitude 90 when looking straight down', () => {
    const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 2500);
    camera.up.set(0, 0, -1);
    const [x, y, z] = cameraPosition(cameraDistance(1), 90);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const [rx, ry, rz] = orbitPosition(20, 0);
    const [ux, uy, uz] = orbitPosition(20, 90);
    const right = new THREE.Vector3(rx, ry, rz).project(camera);
    const up = new THREE.Vector3(ux, uy, uz).project(camera);
    expect(right.x).toBeGreaterThan(0.1);
    expect(Math.abs(right.y)).toBeLessThan(1e-6);
    expect(up.y).toBeGreaterThan(0.1);
    expect(Math.abs(up.x)).toBeLessThan(1e-6);
  });
});
