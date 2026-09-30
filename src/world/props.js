import * as THREE from 'three';
import { COLORS } from '../config.js';
import { fbm, smoothstep } from '../utils.js';

export const VILLAGE = {
  rim: 34,
  bound: 64,
  pass: { x: 0, z: 40.6, radius: 2.2 },
};

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
  glass: new THREE.MeshStandardMaterial({
    color: 0xd5e2cf,
    roughness: 0.12,
    metalness: 0.04,
    transparent: true,
    opacity: 0.55,
  }),
  hair: new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.9 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xe0c2a2, roughness: 0.7 }),
  eye: new THREE.MeshBasicMaterial({ color: 0xff5533 }),
  horn: new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.55 }),
  club: new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 }),
};

const reused = {
  rock: new THREE.IcosahedronGeometry(0.55, 1),
  fireStone: new THREE.DodecahedronGeometry(0.15, 0),
  npcBody: new THREE.CapsuleGeometry(0.28, 0.7, 4, 8),
  npcHead: new THREE.SphereGeometry(0.22, 10, 8),
  npcHair: new THREE.SphereGeometry(0.24, 8, 6),
  npcArm: new THREE.CapsuleGeometry(0.07, 0.36, 3, 5),
  npcSash: new THREE.BoxGeometry(0.58, 0.16, 0.34),
  creatureBody: new THREE.CapsuleGeometry(0.38, 0.55, 4, 8),
  creatureHead: new THREE.SphereGeometry(0.28, 10, 8),
  creatureEye: new THREE.SphereGeometry(0.06, 6, 6),
  creatureArm: new THREE.CapsuleGeometry(0.09, 0.28, 3, 5),
  horn: new THREE.ConeGeometry(0.08, 0.45, 6),
  club: new THREE.CylinderGeometry(0.08, 0.16, 1.4, 6),
  glass: new THREE.BoxGeometry(0.32, 0.26, 0.04),
  post: new THREE.BoxGeometry(0.12, 1, 0.12),
  hat: new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8),
};

const matCache = new Map();

function cachedStandard(color, roughness = 0.8, emissive = 0, emissiveIntensity = 0) {
  const key = `${color}:${roughness}:${emissive}:${emissiveIntensity}`;
  let mat = matCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity });
    matCache.set(key, mat);
  }
  return mat;
}

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
  group.userData.kind = 'cottage';
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shared.plaster);
  body.position.y = h / 2;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.12, 0.18, d + 0.12),
    shared.timber,
  );
  frame.position.y = 0.1;
  const rise = h * 0.42;
  const pitch = Math.atan2(rise, d * 0.5);
  const slopeGeo = new THREE.BoxGeometry(w + 0.9, 0.14, Math.hypot(d * 0.5, rise) + 0.15);
  const roofN = new THREE.Mesh(slopeGeo, shared.thatch);
  const roofS = new THREE.Mesh(slopeGeo, shared.thatch);
  roofN.position.set(0, h + rise * 0.48, d * 0.22);
  roofS.position.set(0, h + rise * 0.48, -d * 0.22);
  roofN.rotation.x = pitch;
  roofS.rotation.x = -pitch;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.1, 0.16), shared.timber);
  ridge.position.y = h + rise * 0.92;
  const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.1, d + 0.06), shared.timber);
  band.position.y = h * 0.62;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.14, 0.16), shared.timber);
  beam.position.set(0, h * 0.92, d / 2 + 0.02);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, 0.08), shared.timber);
  door.position.set(0, 0.58, d / 2 + 0.02);
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.4), shared.stone);
  step.position.set(0, 0.06, d / 2 + 0.2);
  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), shared.timber);
  windowFrame.position.set(w * 0.24, h * 0.58, d / 2 + 0.02);
  const windowGlass = new THREE.Mesh(reused.glass, shared.glass);
  windowGlass.position.set(w * 0.24, h * 0.58, d / 2 + 0.05);
  const windowFrame2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), shared.timber);
  windowFrame2.position.set(-w * 0.24, h * 0.58, d / 2 + 0.02);
  const windowGlass2 = new THREE.Mesh(reused.glass, shared.glass);
  windowGlass2.position.set(-w * 0.24, h * 0.58, d / 2 + 0.05);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.46, h * 0.5, 0.46), shared.stone);
  chimney.position.set(-w * 0.28, h + h * 0.1, -d * 0.16);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.62), shared.rockDark);
  cap.position.set(-w * 0.28, h + h * 0.36, -d * 0.16);
  group.add(body, frame, roofN, roofS, ridge, band, beam, door, step, windowFrame, windowGlass, windowFrame2, windowGlass2, chimney, cap);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(reused.post, shared.timber);
      post.scale.y = h;
      post.position.set(sx * w * 0.5, h * 0.5, sz * d * 0.5);
      group.add(post);
    }
  }
  enableShadows(group);
  return group;
}

export function makeTree(scale = 1) {
  const group = new THREE.Group();
  group.userData.kind = 'tree';
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.5, 6), shared.bark);
  trunk.position.y = 0.75;
  const roots = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.28, 6), shared.bark);
  roots.position.y = 0.1;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 7), Math.random() > 0.5 ? shared.leaf : shared.leaf2);
  leaves.position.y = 2.05;
  const leaves2 = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.35, 7), shared.leaf);
  leaves2.position.y = 2.75;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 6), shared.leaf2);
  tip.position.y = 3.4;
  group.add(trunk, roots, leaves, leaves2, tip);
  group.scale.setScalar(scale);
  enableShadows(group);
  return group;
}

export function makeRock(scale = 1) {
  const group = new THREE.Group();
  group.userData.kind = 'rock';
  const main = new THREE.Mesh(reused.rock, Math.random() > 0.5 ? shared.rock : shared.rockDark);
  main.scale.set(1, 0.7, 0.92);
  const chip = new THREE.Mesh(reused.rock, shared.rockDark);
  chip.scale.set(0.48, 0.36, 0.44);
  chip.position.set(0.46, -0.02, 0.18);
  group.add(main, chip);
  group.scale.set(
    scale * (0.85 + Math.random() * 0.45),
    scale * (0.55 + Math.random() * 0.35),
    scale * (0.85 + Math.random() * 0.4),
  );
  group.rotation.set(Math.random(), Math.random(), Math.random());
  enableShadows(group);
  return group;
}

export function makeWell() {
  const group = new THREE.Group();
  group.userData.kind = 'well';
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
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 5), shared.timber);
  rope.position.set(0.18, 1.2, 0);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 8), shared.stone);
  bucket.position.set(0.18, 0.78, 0);
  group.add(ring, inner, postL, postR, beam, rope, bucket);
  enableShadows(group);
  return group;
}

export function makeArch() {
  const group = new THREE.Group();
  group.userData.kind = 'arch';
  const mat = shared.rockDark;
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.2, 2.2), mat);
  const right = left.clone();
  left.position.set(-3.1, 3.1, 0);
  right.position.set(3.1, 3.1, 0);
  const top = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.6, 2.6), mat);
  top.position.set(0, 6.4, 0);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.32, 2.4), shared.stone);
  const footR = foot.clone();
  foot.position.set(-3.1, 0.16, 0);
  footR.position.set(3.1, 0.16, 0);
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.46, 2.7), shared.stone);
  key.position.set(0, 5.55, 0);
  group.add(left, right, top, foot, footR, key);
  enableShadows(group);
  return group;
}

export function makeTorch() {
  const group = new THREE.Group();
  group.userData.kind = 'torch';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.2, 6), shared.torch);
  pole.position.y = 0.6;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.12, 6), shared.rockDark);
  cup.position.y = 1.16;
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.28), shared.rockDark);
  bracket.position.set(0, 0.9, -0.12);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 6), shared.flame);
  flame.position.y = 1.32;
  flame.name = 'flame';
  const light = new THREE.PointLight(0xff9a4a, 4.2, 14, 1.6);
  light.castShadow = false;
  light.position.y = 1.34;
  group.add(pole, cup, bracket, flame, light);
  return group;
}

export function makeCampfire() {
  const group = new THREE.Group();
  group.userData.kind = 'campfire';
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 5), shared.timber);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i * Math.PI) / 4;
    log.position.y = 0.1;
    group.add(log);
  }
  for (let i = 0; i < 5; i++) {
    const stone = new THREE.Mesh(reused.fireStone, i % 2 ? shared.rock : shared.rockDark);
    const a = (i / 5) * Math.PI * 2;
    stone.position.set(Math.cos(a) * 0.46, 0.08, Math.sin(a) * 0.46);
    stone.rotation.y = a;
    group.add(stone);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), shared.flame);
  flame.position.y = 0.5;
  flame.name = 'flame';
  const light = new THREE.PointLight(0xff7a32, 2.8, 10, 2);
  light.castShadow = false;
  light.position.y = 0.6;
  group.add(flame, light);
  return group;
}

export function makeSign() {
  const group = new THREE.Group();
  group.userData.kind = 'sign';
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.35, 0.1), shared.timber);
  post.position.y = 0.68;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 0.08), shared.plaster);
  board.position.y = 1.22;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.08, 0.1), shared.timber);
  trim.position.y = 1.48;
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), shared.timber);
  brace.position.set(0.32, 0.95, 0);
  brace.rotation.z = 0.45;
  group.add(post, board, trim, brace);
  enableShadows(group);
  return group;
}

export function makeNpcMesh(color, accent) {
  const group = new THREE.Group();
  group.userData.kind = 'villager';
  const cloth = cachedStandard(color, 0.85);
  const body = new THREE.Mesh(reused.npcBody, cloth);
  body.position.y = 0.85;
  const head = new THREE.Mesh(reused.npcHead, shared.skin);
  head.position.y = 1.48;
  const hair = new THREE.Mesh(reused.npcHair, shared.hair);
  hair.position.y = 1.6;
  hair.scale.y = 0.72;
  const sash = new THREE.Mesh(reused.npcSash, cachedStandard(accent, 0.8));
  sash.position.y = 1.05;
  const hat = new THREE.Mesh(reused.hat, shared.timber);
  hat.position.y = 1.64;
  const armL = new THREE.Mesh(reused.npcArm, cloth);
  const armR = new THREE.Mesh(reused.npcArm, cloth);
  armL.position.set(-0.34, 0.95, 0);
  armR.position.set(0.34, 0.95, 0);
  armL.rotation.z = 0.18;
  armR.rotation.z = -0.18;
  group.add(body, head, hair, hat, sash, armL, armR);
  enableShadows(group);
  return group;
}

export function makeCreature({ color, scale = 1, horns = false, boss = false }) {
  const group = new THREE.Group();
  group.userData.kind = 'creature';
  const mat = cachedStandard(color, 0.7, color, 0.18);
  const body = new THREE.Mesh(reused.creatureBody, mat);
  body.position.y = 0.7;
  const head = new THREE.Mesh(reused.creatureHead, mat);
  head.position.y = 1.28;
  const eyeL = new THREE.Mesh(reused.creatureEye, shared.eye);
  const eyeR = new THREE.Mesh(reused.creatureEye, shared.eye);
  eyeL.position.set(-0.1, 1.32, 0.22);
  eyeR.position.set(0.1, 1.32, 0.22);
  const armL = new THREE.Mesh(reused.creatureArm, mat);
  const armR = new THREE.Mesh(reused.creatureArm, mat);
  armL.position.set(-0.42, 0.82, 0.06);
  armR.position.set(0.42, 0.82, 0.06);
  armL.rotation.z = 0.7;
  armR.rotation.z = -0.7;
  group.add(body, head, eyeL, eyeR, armL, armR);
  if (horns) {
    const horn = new THREE.Mesh(reused.horn, shared.horn);
    const horn2 = new THREE.Mesh(reused.horn, shared.horn);
    horn.position.set(-0.18, 1.58, 0);
    horn2.position.set(0.18, 1.58, 0);
    horn.rotation.z = 0.4;
    horn2.rotation.z = -0.4;
    group.add(horn, horn2);
  }
  if (boss) {
    const club = new THREE.Mesh(reused.club, shared.club);
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
  let h = 0.14 * n + 0.05 * n2;

  if (r > VILLAGE.rim) {
    const t = (r - VILLAGE.rim) / 9;
    let mountain = Math.min(t, 2) ** 1.15 * 28 + n * 2.8 + n2 * 1.2;
    mountain = Math.min(mountain, 42);
    const ang = Math.atan2(x, z);
    const gap = Math.exp(-(ang * ang) * 16);
    mountain *= 1 - gap * 0.97;
    h += mountain;
  }

  const ax = Math.abs(x);
  const across = ax <= 2.7 ? 1 : ax >= 4.8 ? 0 : 1 - smoothstep(2.7, 4.8, ax);
  const along = smoothstep(-1, 3.5, z) * (1 - smoothstep(VILLAGE.pass.z + 1.2, VILLAGE.pass.z + 6, z));
  const road = across * along;
  if (road > 0) {
    const pathH = 0.08 + n * 0.05;
    h = pathH * road + h * (1 - road);
  }

  if (r < 8) {
    const bowl = 1 - smoothstep(4.5, 8, r);
    h *= 1 - bowl * 0.62;
  }

  return h;
}

export function isOnPath(x, z) {
  if (Math.hypot(x, z) < 7) return true;
  return z > -6 && z < VILLAGE.pass.z + 3 && Math.abs(x) < 3.1;
}

export { shared };
