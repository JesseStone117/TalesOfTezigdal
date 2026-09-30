import * as THREE from 'three';
import { COLORS } from '../config.js';
import { fbm } from '../utils.js';
import { DESTRAL_NPCS } from '../campaigns.js';
import { aabbObstacle, circleObstacle, resolveMove } from './collision.js';
import { Npc } from './npc.js';
import {
  VILLAGE,
  enableShadows,
  isOnPath,
  makeArch,
  makeCampfire,
  makeCottage,
  makeRock,
  makeSign,
  makeTorch,
  makeTree,
  makeWell,
  villageHeight,
} from './props.js';

const COTTAGES = [
  { x: -17.5, z: -8, rot: 0.35, w: 4.4, d: 3.6, h: 2.5 },
  { x: 18.2, z: -6.5, rot: -0.28, w: 4.0, d: 3.4, h: 2.35 },
  { x: -14, z: -16.5, rot: 0.15, w: 3.8, d: 3.4, h: 2.3 },
  { x: 12.4, z: -17.2, rot: -0.12, w: 3.6, d: 3.2, h: 2.2 },
  { x: -15.2, z: 16.2, rot: 0.55, w: 4.2, d: 3.5, h: 2.45 },
  { x: 16.8, z: 15.4, rot: -0.42, w: 3.8, d: 3.3, h: 2.3 },
  { x: -20.4, z: 3.2, rot: 0.95, w: 3.6, d: 3.4, h: 2.25 },
  { x: 21.2, z: 1.8, rot: -0.75, w: 3.5, d: 3.2, h: 2.2 },
  { x: -7.2, z: 12.4, rot: 0.18, w: 3.5, d: 3.2, h: 2.2 },
  { x: 5.4, z: -12.2, rot: 0.08, w: 3.6, d: 3.2, h: 2.25 },
];

export function createVillage() {
  const group = new THREE.Group();
  const obstacles = [];
  const interactables = [];
  const flames = [];

  const terrain = buildTerrain();
  group.add(terrain);

  for (const c of COTTAGES) {
    const mesh = makeCottage(c.w, c.d, c.h);
    const y = villageHeight(c.x, c.z);
    mesh.position.set(c.x, y, c.z);
    mesh.rotation.y = c.rot;
    mesh.userData.kind = 'cottage';
    group.add(mesh);
    obstacles.push(aabbAround(c.x, c.z, c.rot, c.w * 0.52, c.d * 0.52));
  }

  const well = makeWell();
  well.position.set(0, villageHeight(0, 0), 0);
  well.userData.kind = 'well';
  group.add(well);
  obstacles.push(circleObstacle(0, 0, 1.15));
  interactables.push({
    id: 'well',
    x: 0,
    z: 0,
    radius: 1.8,
    prompt: (pad) => `${pad ? 'A' : 'E'}  Drink from the well`,
    use: (game) => {
      game.player.health = game.player.maxHealth;
      game.toast('The water is cold and mineral-sweet. Health restored.');
    },
  });

  const fire = makeCampfire();
  fire.position.set(-3.6, villageHeight(-3.6, 2.6), 2.6);
  fire.userData.kind = 'campfire';
  group.add(fire);
  flames.push(fire.getObjectByName('flame'));
  obstacles.push(circleObstacle(-3.6, 2.6, 0.55));

  for (const [x, z] of [[-3.4, 12.5], [3.3, 22], [-3.2, 31.5]]) {
    const lamp = makeTorch();
    lamp.position.set(x, villageHeight(x, z), z);
    group.add(lamp);
    const flame = lamp.getObjectByName('flame');
    if (flame) flames.push(flame);
  }

  const trees = [
    [-24, -12], [-26, 2], [-23, 14], [-18, 24], [-10, 24],
    [24, -10], [26, 4], [22, 16], [17, 24], [8, 26],
    [-6, -24], [6, -24], [14, -22], [-16, -22],
    [-28, -4], [28, 8], [-8, 22], [12, -24],
  ];
  for (const [x, z] of trees) {
    if (nearSettlement(x, z)) continue;
    const tree = makeTree(0.85 + Math.random() * 0.5);
    tree.position.set(x, villageHeight(x, z), z);
    tree.rotation.y = Math.random() * Math.PI;
    group.add(tree);
    obstacles.push(circleObstacle(x, z, 0.45));
  }

  const rocks = [
    [-10, 22], [12, 22], [-24, -2], [24, -2],
    [3.4, 33.5], [-3.5, 32.8],
    [-8, -21], [9, 19], [0.2, -20],
  ];
  for (const [x, z] of rocks) {
    if (nearSettlement(x, z)) continue;
    const rock = makeRock(0.9 + Math.random() * 0.8);
    rock.position.set(x, villageHeight(x, z) + 0.1, z);
    group.add(rock);
    obstacles.push(circleObstacle(x, z, 0.7));
  }

  const archZ = VILLAGE.pass.z - 2.15;
  const arch = makeArch();
  arch.position.set(0, villageHeight(0, archZ), archZ);
  arch.userData.kind = 'arch';
  group.add(arch);
  obstacles.push(aabbObstacle(-4.2, -2.2, archZ - 1.1, archZ + 1.1));
  obstacles.push(aabbObstacle(2.2, 4.2, archZ - 1.1, archZ + 1.1));

  const sign = makeSign();
  sign.position.set(-2.5, villageHeight(-2.5, archZ - 3.6), archZ - 3.6);
  sign.rotation.y = 0.35;
  sign.userData.kind = 'sign';
  group.add(sign);
  interactables.push({
    id: 'sign',
    x: -2.5,
    z: archZ - 3.6,
    radius: 1.6,
    prompt: (pad) => `${pad ? 'A' : 'E'}  Read the sign`,
    use: (game) => {
      game.toast(game.save.data.bossDefeated
        ? 'The pass is quiet. The far stones still do not open.'
        : 'CAVE PASS — closed to carts. Walkers: keep a light, keep a name.');
    },
  });

  const npcs = DESTRAL_NPCS.map((def) => {
    const npc = new Npc(def);
    npc.group.position.y = villageHeight(def.x, def.z);
    group.add(npc.group);
    obstacles.push(circleObstacle(def.x, def.z, 0.5));
    interactables.push({
      id: `npc-${def.id}`,
      x: def.x,
      z: def.z,
      radius: 1.7,
      prompt: (pad) => `${pad ? 'A' : 'E'}  Talk to ${def.name}`,
      use: (game) => game.openNpc(npc),
    });
    return npc;
  });

  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x3d3328, 0.85);
  const sun = new THREE.DirectionalLight(0xffe6c2, 1.35);
  sun.position.set(-18, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.04;
  group.add(hemi, sun);

  const fill = new THREE.DirectionalLight(0x88a0c8, 0.25);
  fill.position.set(12, 8, -10);
  group.add(fill);

  return {
    id: 'village',
    name: 'Hollyhollow',
    group,
    npcs,
    enemies: [],
    interactables,
    obstacles,
    terrainMesh: terrain,
    spawn: { x: 0, z: -6.5, yaw: 0 },
    caveReturn: { x: 0, z: VILLAGE.pass.z - 4.4, yaw: Math.PI },
    heightAt: villageHeight,
    resolve(px, pz, nx, nz, radius) {
      const stepped = resolveMove(px, pz, nx, nz, radius, obstacles, villageHeight);
      const r = Math.hypot(stepped.x, stepped.z);
      if (r > VILLAGE.bound) {
        const s = VILLAGE.bound / r;
        return { x: stepped.x * s, z: stepped.z * s };
      }
      return stepped;
    },
    update(dt, game) {
      for (const npc of npcs) npc.update(dt, game.player, villageHeight);
      for (const flame of flames) {
        if (!flame) continue;
        flame.scale.y = 1 + Math.sin(performance.now() * 0.012) * 0.18;
        flame.rotation.y += dt * 2;
      }
    },
    applySky(scene) {
      scene.background = new THREE.Color(COLORS.sky);
      scene.fog = new THREE.FogExp2(COLORS.sky, 0.011);
    },
    triggers: [
      {
        id: 'to-cave',
        x: VILLAGE.pass.x,
        z: VILLAGE.pass.z,
        radius: VILLAGE.pass.radius,
        run: (game) => game.changeArea('cave'),
      },
    ],
    lantern: false,
  };
}

function nearSettlement(x, z) {
  if (isOnPath(x, z)) return true;
  if (Math.hypot(x, z) < 5) return true;
  for (const c of COTTAGES) {
    if (Math.hypot(x - c.x, z - c.z) < 6.2) return true;
  }
  for (const npc of DESTRAL_NPCS) {
    if (Math.hypot(x - npc.x, z - npc.z) < 2.2) return true;
  }
  return false;
}

function aabbAround(x, z, rot, hw, hd) {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const ex = hw * c + hd * s;
  const ez = hw * s + hd * c;
  return aabbObstacle(x - ex, x + ex, z - ez, z + ez);
}

function buildTerrain() {
  const size = 140;
  const seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(COLORS.grass);
  const grassDark = new THREE.Color(COLORS.grassDark);
  const dirt = new THREE.Color(COLORS.path);
  const rock = new THREE.Color(COLORS.rock);
  const rockDark = new THREE.Color(COLORS.rockDark);
  const snow = new THREE.Color(COLORS.snow);
  const c = new THREE.Color();
  const flower = new THREE.Color(0xd2c06a);
  const yard = new THREE.Color(0x8d7048);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = villageHeight(x, z);
    pos.setY(i, y);
    let nearHome = false;
    for (let k = 0; k < COTTAGES.length; k++) {
      const home = COTTAGES[k];
      if ((x - home.x) * (x - home.x) + (z - home.z) * (z - home.z) < 28) {
        nearHome = true;
        break;
      }
    }
    if (isOnPath(x, z) && y < 1.4) c.copy(dirt);
    else if (nearHome && y < 1.5) c.lerpColors(yard, dirt, 0.45);
    else if (y > 18) c.copy(snow);
    else if (y > 8) c.lerpColors(rock, rockDark, Math.min(1, (y - 8) / 8));
    else if (y > 1.6) c.lerpColors(grassDark, rock, (y - 1.6) / 6.4);
    else {
      c.lerpColors(grass, grassDark, fbm(x * 0.08, z * 0.08, 2) * 0.72);
      if (fbm(x * 0.42 + 9, z * 0.42, 1) > 0.84) c.lerp(flower, 0.42);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.02,
    }),
  );
  mesh.receiveShadow = true;
  enableShadows(mesh);
  mesh.castShadow = false;
  return mesh;
}
