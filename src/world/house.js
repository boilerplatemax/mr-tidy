// Stub house (step 1): one room so the scaffold runs. Replaced by the data-driven builder in step 2.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';

export function buildHouse({ scene, world }) {
  const mat = makePS1(new THREE.MeshLambertMaterial({ color: 0x777777 }));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), mat);
  floor.position.set(3, 0, 3);
  scene.add(floor);
  world.defaultSurface = 'concrete';
  return { zones: [], indoor: [], spawn: TUNING.house.spawn, tick() {}, startSound() {} };
}
