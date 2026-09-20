import * as THREE from 'three';
import { COLORS } from '../config.js';
import { fbm } from '../utils.js';

const shared = {
  plaster: new THREE.MeshStandardMaterial({ color: COLORS.plaster, roughness: 0.9 }),
  timber: new THREE.MeshStandardMaterial({ color: COLORS.timber, roughness: 0.85 }),
  thatch: new THREE.MeshStandardMaterial({ color: COLORS.thatch, roughness: 1 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x4a321c, roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2f5a2c, roughness: 0.95 }),
  leaf2: new THREE.MeshStandardMaterial({ color: 0x4a6e32, roughness: 0.95 }),
  rock: new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 0.95, flatShading: true }),
  rockDark: new THREE.MeshStandardMaterial({ color: COLORS.rockDark, roughness: 1, flatShading: true }),
  water: new THREE.MeshStandardMaterial({
    color: COLORS.water,
    roughness: 0.2,
    metalness: 0.1,
  }),
  stone: new THREE.MeshStandardMaterial({ color: 0x7a746c, roughness: 0.9 }),
  torch: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.85 }),
  ember: new THREE.MeshBasicMaterial({ color: 0xffc56a }),
};

export function enableShadows(object) {
  object.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

export function makeCottage(w, d, h) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shared.plaster);
  body.position.y = h / 2;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.12, 0.18, d + 0.12),
    shared.timber,
  );
  frame.position.y = 0.1;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.55, 4),
    shared.thatch,
  );
  roof.position.y = h + h * 0.18;
  roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, 0.08), shared.timber);
  door.position.set(0, 0.58, d / 2 + 0.02);
  const window = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), shared.timber);
  window.position.set(w * 0.22, h * 0.55, d / 2 + 0.02);
  group.add(body, frame, roof, door, window);
  enableShadows(group);
  return group;
}

export function makeTree(scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 6), shared.bark);
  trunk.position.y = 0.7;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.1, 7), Math.random() > 0.5 ? shared.leaf : shared.leaf2);
  leaves.position.y = 2.1;
  const leaves2 = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 7), shared.leaf);
  leaves2.position.y = 2.8;
  group.add(trunk, leaves, leaves2);
  group.scale.setScalar(scale);
  enableShadows(group);
  return group;
}

export function makeRock(scale = 1) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), Math.random() > 0.5 ? shared.rock : shared.rockDark);
  mesh.scale.set(scale * (0.8 + Math.random() * 0.6), scale * (0.45 + Math.random() * 0.4), scale * (0.8 + Math.random() * 0.5));
  mesh.rotation.set(Math.random(), Math.random(), Math.random());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function makeWell() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.7, 14), shared.stone);
  ring.position.y = 0.35;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.2, 14), shared.water);
  inner.position.y = 0.42;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), shared.timber);
  const postR = postL.clone();
  postL.position.set(-0.7, 1.0, 0);
  postR.position.set(0.7, 1.0, 0);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), shared.timber);
  beam.position.y = 1.62;
  group.add(ring, inner, postL, postR, beam);
  enableShadows(group);
  return group;
}

export function makeArch() {
  const group = new THREE.Group();
  const mat = shared.rockDark;
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.2, 2.2), mat);
  const right = left.clone();
  left.position.set(-3.1, 3.1, 0);
  right.position.set(3.1, 3.1, 0);
  const top = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.6, 2.6), mat);
  top.position.set(0, 6.4, 0);
  group.add(left, right, top);
  enableShadows(group);
  return group;
}

export function makeTorch() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.2, 6), shared.torch);
  pole.position.y = 0.6;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 6), shared.flame);
  flame.position.y = 1.3;
  flame.name = 'flame';
  const light = new THREE.PointLight(0xff9a4a, 4.6, 15, 1.5);
  light.position.y = 1.32;
  group.add(pole, flame, light);
  return group;
}

export function makeCampfire() {
  const group = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 5), shared.timber);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i * Math.PI) / 4;
    log.position.y = 0.08;
    group.add(log);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), shared.flame);
  flame.position.y = 0.5;
  flame.name = 'flame';
  const light = new THREE.PointLight(0xff7a32, 2.8, 10, 2);
  light.position.y = 0.6;
  group.add(flame, light);
  return group;
}

export function makeSign() {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), shared.timber);
  post.position.y = 0.65;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.08), shared.timber);
  board.position.y = 1.2;
  group.add(post, board);
  enableShadows(group);
  return group;
}

export function makeNpcMesh(color, accent) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  body.position.y = 0.85;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xe0c2a2, roughness: 0.7 }),
  );
  head.position.y = 1.48;
  const sash = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.18, 0.36),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8 }),
  );
  sash.position.y = 1.05;
  group.add(body, head, sash);
  enableShadows(group);
  return group;
}

export function makeCreature({ color, scale = 1, horns = false, boss = false }) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    emissive: color,
    emissiveIntensity: 0.2,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.55, 4, 8), mat);
  body.position.y = 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat);
  head.position.y = 1.28;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff5533 }));
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.1, 1.32, 0.22);
  eyeR.position.set(0.1, 1.32, 0.22);
  group.add(body, head, eyeL, eyeR);
  if (horns) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 6), new THREE.MeshStandardMaterial({ color: 0x2a2018 }));
    const horn2 = horn.clone();
    horn.position.set(-0.18, 1.58, 0);
    horn2.position.set(0.18, 1.58, 0);
    horn.rotation.z = 0.4;
    horn2.rotation.z = -0.4;
    group.add(horn, horn2);
  }
  if (boss) {
    const club = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a20 }));
    club.position.set(0.55, 0.9, 0.1);
    club.rotation.z = -0.5;
    group.add(club);
  }
  group.scale.setScalar(scale);
  enableShadows(group);
  return group;
}

export function villageHeight(x, z) {
  const r = Math.hypot(x, z);
  const n = fbm(x * 0.07, z * 0.07);
  const n2 = fbm(x * 0.2 + 12, z * 0.2);
  let h = 0.18 * n + 0.06 * n2;

  const rim = 15.5;
  if (r > rim) {
    const t = (r - rim) / 11;
    let mountain = Math.min(t, 1.9) ** 1.2 * 24 + n * 4.2 + n2 * 2.2;
    mountain = Math.min(mountain, 40);
    const ang = Math.atan2(x, z);
    const gap = Math.exp(-(ang * ang) * 20);
    mountain *= 1 - gap * 0.96;
    h += mountain;
  }

  if (z > 4 && z < 30 && Math.abs(x) < 3.5) {
    const flatten = smoothPath(Math.abs(x));
    const pathH = 0.12 + n * 0.12;
    h = pathH * flatten + h * (1 - flatten);
  }

  if (Math.hypot(x, z) < 3.8) {
    h *= 0.35;
  }

  return h;
}

function smoothPath(ax) {
  if (ax < 2.15) return 1;
  if (ax > 3.5) return 0;
  const t = (ax - 2.15) / 1.35;
  return 1 - t * t * (3 - 2 * t);
}

export function isOnPath(x, z) {
  if (Math.hypot(x, z) < 3.6) return true;
  return z > -8 && z < 26 && Math.abs(x) < 2.35;
}

export { shared };
