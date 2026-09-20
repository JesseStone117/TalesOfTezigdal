import * as THREE from 'three';
import { COLORS } from '../config.js';
import { aabbObstacle, circleObstacle, resolveMove } from './collision.js';
import { Enemy } from './enemy.js';
import { enableShadows, makeRock, makeTorch } from './props.js';

export function createCave(saveData) {
  const group = new THREE.Group();
  const obstacles = [];
  const interactables = [];
  const flames = [];
  const enemies = [];
  const defeated = new Set(saveData.defeated || []);

  const rooms = [
    { z: 6, w: 8, d: 10, kind: 'entry' },
    { z: 20, w: 12, d: 12, kind: 'fight', enemies: 2 },
    { z: 36, w: 10, d: 12, kind: 'fight', enemies: 2 },
    { z: 50, w: 8, d: 10, kind: 'ambush', enemies: 1 },
    { z: 64, w: 16, d: 16, kind: 'boss' },
  ];

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x4a433c, roughness: 0.92 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c2826, roughness: 1, flatShading: true });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x161312, roughness: 1 });

  let gruntIndex = 0;
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    addBox(group, floorMat, room.w, 0.4, room.d, 0, -0.2, room.z, true);
    addBox(group, ceilMat, room.w, 0.4, room.d, 0, 5.4, room.z, false);
    addWalls(group, wallMat, obstacles, room);

    if (i < rooms.length - 1) {
      const next = rooms[i + 1];
      const z0 = room.z + room.d / 2;
      const z1 = next.z - next.d / 2;
      const mid = (z0 + z1) / 2;
      const len = Math.max(2, z1 - z0);
      addBox(group, floorMat, 5.2, 0.4, len, 0, -0.2, mid, true);
      addBox(group, ceilMat, 5.2, 0.4, len, 0, 4.6, mid, false);
      addBox(group, wallMat, 0.7, 4.4, len, -2.9, 2.2, mid, true);
      addBox(group, wallMat, 0.7, 4.4, len, 2.9, 2.2, mid, true);
      obstacles.push(aabbObstacle(-3.3, -2.2, z0, z1));
      obstacles.push(aabbObstacle(2.2, 3.3, z0, z1));
    }

    const torchX = room.w * 0.38;
    placeTorch(group, flames, -torchX, room.z - room.d * 0.2);
    placeTorch(group, flames, torchX, room.z + room.d * 0.15);

    if (room.kind === 'fight' || room.kind === 'ambush') {
      const count = room.enemies || 1;
      for (let n = 0; n < count; n++) {
        const id = `grunt-${gruntIndex++}`;
        const ox = (n % 2 === 0 ? -1 : 1) * (1.6 + n);
        const oz = room.z + (n * 0.8 - 0.4);
        if (defeated.has(id)) continue;
        const enemy = new Enemy({ id, x: ox, z: oz, homeX: ox, homeZ: room.z });
        group.add(enemy.group);
        enemies.push(enemy);
      }
    }

    if (room.kind === 'boss' && !defeated.has('boss') && !saveData.bossDefeated) {
      const boss = new Enemy({ id: 'boss', x: 0, z: room.z + 2, boss: true, homeX: 0, homeZ: room.z });
      group.add(boss.group);
      enemies.push(boss);
    }

    if (room.kind === 'boss') {
      const gate = addBox(group, wallMat, 10, 5, 1.2, 0, 2.5, room.z + room.d / 2 - 0.4, true);
      void gate;
      obstacles.push(aabbObstacle(-5.2, 5.2, room.z + room.d / 2 - 1.2, room.z + room.d / 2 + 0.6));
      interactables.push({
        id: 'sealed-gate',
        x: 0,
        z: room.z + room.d / 2 - 2.2,
        radius: 2.4,
        prompt: (pad) => `${pad ? 'A' : 'E'}  Examine the fallen stones`,
        use: (game) => {
          game.toast(game.save.data.bossDefeated
            ? 'The pass is sealed by fallen stone. The rest of Tezigdal will have to wait.'
            : 'A wall of old collapse. Something large has been pacing this end of the road.');
        },
      });
    }

    if (room.kind === 'entry') {
      interactables.push({
        id: 'cave-mouth',
        x: 0,
        z: 1.2,
        radius: 2.2,
        prompt: (pad) => `${pad ? 'A' : 'E'}  Return to Hollowrest`,
        use: (game) => game.changeArea('village', { via: 'cave' }),
      });
    }

    for (let r = 0; r < 3; r++) {
      const rx = (Math.random() - 0.5) * (room.w - 3);
      const rz = room.z + (Math.random() - 0.5) * (room.d - 3);
      if (Math.abs(rx) < 1.4) continue;
      const rock = makeRock(0.7 + Math.random());
      rock.position.set(rx, 0.05, rz);
      group.add(rock);
      obstacles.push(circleObstacle(rx, rz, 0.65));
    }
  }

  obstacles.push(aabbObstacle(-20, 20, -4, 0.2));
  obstacles.push(aabbObstacle(-20, 20, 72, 80));

  const ambient = new THREE.HemisphereLight(0x6a6178, 0x1a1210, 0.7);
  const fill = new THREE.AmbientLight(0x3a3236, 0.55);
  const entrance = new THREE.DirectionalLight(0xffd8a8, 0.35);
  entrance.position.set(0, 4, -6);
  group.add(ambient, fill, entrance);

  return {
    id: 'cave',
    name: 'The Cave Pass',
    group,
    npcs: [],
    enemies,
    interactables,
    obstacles,
    terrainMesh: null,
    spawn: { x: 0, z: 3.2, yaw: 0 },
    heightAt: () => 0,
    resolve(px, pz, nx, nz, radius) {
      const stepped = resolveMove(px, pz, nx, nz, radius, obstacles, null);
      return { x: clamp(stepped.x, -7.2, 7.2), z: clamp(stepped.z, 0.4, 71) };
    },
    update(dt, game) {
      for (const enemy of enemies) {
        if (!enemy.dead) enemy.update(dt, game.player, this);
      }
      for (const flame of flames) {
        const phase = flame.userData.phase || 0;
        flame.scale.y = 1 + Math.sin(performance.now() * 0.014 + phase) * 0.2;
      }
    },
    applySky(scene) {
      scene.background = new THREE.Color(COLORS.cave);
      scene.fog = new THREE.FogExp2(COLORS.cave, 0.042);
    },
    triggers: [
      {
        id: 'to-village',
        x: 0,
        z: 0.8,
        radius: 1.6,
        run: (game) => game.changeArea('village', { via: 'cave' }),
      },
    ],
    lantern: true,
  };
}

function addBox(group, mat, w, h, d, x, y, z, shadow) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (shadow) enableShadows(mesh);
  else mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addWalls(group, mat, obstacles, room) {
  const { w, d, z } = room;
  const hw = w / 2;
  const hd = d / 2;
  addBox(group, mat, 0.8, 5.4, d, -hw, 2.5, z, true);
  addBox(group, mat, 0.8, 5.4, d, hw, 2.5, z, true);
  obstacles.push(aabbObstacle(-hw - 0.5, -hw + 0.55, z - hd, z + hd));
  obstacles.push(aabbObstacle(hw - 0.55, hw + 0.5, z - hd, z + hd));
  const opening = 2.5;
  addBox(group, mat, hw - opening, 5.4, 0.8, -hw / 2 - opening / 2, 2.5, z - hd, true);
  addBox(group, mat, hw - opening, 5.4, 0.8, hw / 2 + opening / 2, 2.5, z - hd, true);
  addBox(group, mat, hw - opening, 5.4, 0.8, -hw / 2 - opening / 2, 2.5, z + hd, true);
  addBox(group, mat, hw - opening, 5.4, 0.8, hw / 2 + opening / 2, 2.5, z + hd, true);
  obstacles.push(aabbObstacle(-hw, -opening, z - hd - 0.5, z - hd + 0.5));
  obstacles.push(aabbObstacle(opening, hw, z - hd - 0.5, z - hd + 0.5));
  obstacles.push(aabbObstacle(-hw, -opening, z + hd - 0.5, z + hd + 0.5));
  obstacles.push(aabbObstacle(opening, hw, z + hd - 0.5, z + hd + 0.5));
}

function placeTorch(group, flames, x, z) {
  const torch = makeTorch();
  torch.position.set(x, 0, z);
  group.add(torch);
  const flame = torch.getObjectByName('flame');
  if (flame) {
    flame.userData.phase = Math.random() * 10;
    flames.push(flame);
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
