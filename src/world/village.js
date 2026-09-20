import * as THREE from 'three';
import { COLORS } from '../config.js';
import { DESTRAL_NPCS } from '../campaigns.js';
import { aabbObstacle, circleObstacle, resolveMove } from './collision.js';
import { Npc } from './npc.js';
import {
  enableShadows,
  isOnPath,
  makeArch,
  makeCampfire,
  makeCottage,
  makeRock,
  makeSign,
  makeTree,
  makeWell,
  villageHeight,
} from './props.js';

export function createVillage() {
  const group = new THREE.Group();
  const obstacles = [];
  const interactables = [];
  const flames = [];

  const terrain = buildTerrain();
  group.add(terrain);

  const cottages = [
    { x: -7.2, z: -5.4, rot: 0.25, w: 4.2, d: 3.6, h: 2.4 },
    { x: 8.1, z: -6.2, rot: -0.4, w: 3.7, d: 3.3, h: 2.25 },
    { x: -9.0, z: 4.4, rot: 0.55, w: 3.5, d: 3.5, h: 2.3 },
    { x: 6.8, z: 5.8, rot: -0.18, w: 3.4, d: 3.1, h: 2.15 },
  ];
  for (const c of cottages) {
    const mesh = makeCottage(c.w, c.d, c.h);
    const y = villageHeight(c.x, c.z);
    mesh.position.set(c.x, y, c.z);
    mesh.rotation.y = c.rot;
    group.add(mesh);
    obstacles.push(aabbAround(c.x, c.z, c.rot, c.w * 0.52, c.d * 0.52));
  }

  const well = makeWell();
  well.position.set(0, villageHeight(0, 0), 0);
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
  fire.position.set(-2.4, villageHeight(-2.4, 1.6), 1.6);
  group.add(fire);
  flames.push(fire.getObjectByName('flame'));
  obstacles.push(circleObstacle(-2.4, 1.6, 0.55));

  const trees = [
    [-11, -8], [11, -9], [-12, 8], [12, 9], [-5, -11], [5, -12],
    [-14, -2], [14, 2], [-10, 12], [10, 12], [0, -12], [-7, 10],
    [8, -10], [-3, 11.5], [3.5, 12.2],
  ];
  for (const [x, z] of trees) {
    if (Math.hypot(x, z) < 8) continue;
    const tree = makeTree(0.85 + Math.random() * 0.5);
    tree.position.set(x, villageHeight(x, z), z);
    tree.rotation.y = Math.random() * Math.PI;
    group.add(tree);
    obstacles.push(circleObstacle(x, z, 0.45));
  }

  const rocks = [
    [-4.5, 8.5], [4.8, 9.2], [-13, 1], [13, -3], [2.2, 17.5], [-2.4, 17.8],
    [-8, -9], [9, 11],
  ];
  for (const [x, z] of rocks) {
    const rock = makeRock(0.9 + Math.random() * 0.8);
    rock.position.set(x, villageHeight(x, z) + 0.1, z);
    group.add(rock);
    obstacles.push(circleObstacle(x, z, 0.7));
  }

  const archZ = 23.2;
  const arch = makeArch();
  arch.position.set(0, villageHeight(0, archZ), archZ);
  group.add(arch);
  obstacles.push(aabbObstacle(-4.2, -2.2, archZ - 1.1, archZ + 1.1));
  obstacles.push(aabbObstacle(2.2, 4.2, archZ - 1.1, archZ + 1.1));

  const sign = makeSign();
  sign.position.set(-2.6, villageHeight(-2.6, 19.4), 19.4);
  sign.rotation.y = 0.4;
  group.add(sign);
  interactables.push({
    id: 'sign',
    x: -2.6,
    z: 19.4,
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
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.0004;
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
    caveReturn: { x: 0, z: 20.4, yaw: 0 },
    heightAt: villageHeight,
    resolve(px, pz, nx, nz, radius) {
      const stepped = resolveMove(px, pz, nx, nz, radius, obstacles, villageHeight);
      const r = Math.hypot(stepped.x, stepped.z);
      if (r > 42) {
        const s = 42 / r;
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
      scene.fog = new THREE.FogExp2(COLORS.sky, 0.018);
    },
    triggers: [
      {
        id: 'to-cave',
        x: 0,
        z: 24.4,
        radius: 2.1,
        run: (game) => game.changeArea('cave'),
      },
    ],
    lantern: false,
  };
}

function aabbAround(x, z, rot, hw, hd) {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const ex = hw * c + hd * s;
  const ez = hw * s + hd * c;
  return aabbObstacle(x - ex, x + ex, z - ez, z + ez);
}

function buildTerrain() {
  const size = 92;
  const seg = 96;
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

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = villageHeight(x, z);
    pos.setY(i, y);
    if (isOnPath(x, z) && y < 1.4) c.copy(dirt);
    else if (y > 18) c.copy(snow);
    else if (y > 8) c.lerpColors(rock, rockDark, Math.min(1, (y - 8) / 8));
    else if (y > 1.6) c.lerpColors(grassDark, rock, (y - 1.6) / 6.4);
    else c.lerpColors(grass, grassDark, (Math.sin(x * 0.4) + 1) * 0.25);
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
