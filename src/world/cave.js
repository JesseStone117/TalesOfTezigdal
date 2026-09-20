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
  const surfaces = [];
  const defeated = new Set(saveData.defeated || []);
  const secretOpened = !!saveData.secretOpened;

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x4a433c, roughness: 0.92 });
  const deepFloorMat = new THREE.MeshStandardMaterial({ color: 0x5c564c, roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c2826, roughness: 1, flatShading: true });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x161312, roughness: 1 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3a3633, roughness: 0.88, flatShading: true });
  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0x5a534c,
    roughness: 0.55,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });

  const rooms = [
    { z: 14, w: 18, d: 20, kind: 'entry' },
    { z: 48, w: 26, d: 22, kind: 'fight', enemies: 3 },
    { z: 86, w: 22, d: 20, kind: 'fight', enemies: 3 },
    { z: 118, w: 18, d: 16, kind: 'ambush', enemies: 2 },
    { z: 150, w: 28, d: 26, kind: 'boss' },
  ];

  let gruntIndex = 0;
  const ctx = { group, obstacles, surfaces, floorMat, deepFloorMat, wallMat, ceilMat, flames };

  addCorridor(ctx, 0, 0.4, rooms[0].z - rooms[0].d / 2, 7.2, 0);

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    addFloor(ctx, 0, room.z, room.w, room.d, 0);
    addBox(group, ceilMat, room.w, 0.4, room.d, 0, 6.2, room.z, false);
    addWalls(ctx, room, { n: 3.2, s: 3.2 });

    if (i < rooms.length - 1) {
      const next = rooms[i + 1];
      const z0 = room.z + room.d / 2;
      const z1 = next.z - next.d / 2;
      addCorridor(ctx, 0, z0, z1, 7.2, 0);
    }

    placeTorch(ctx, -room.w * 0.36, room.z - room.d * 0.22, 0);
    if (room.w > 16) placeTorch(ctx, room.w * 0.36, room.z + room.d * 0.18, 0);

    if (room.kind === 'fight' || room.kind === 'ambush') {
      const count = room.enemies || 1;
      for (let n = 0; n < count; n++) {
        const id = `grunt-${gruntIndex++}`;
        const ox = (n % 2 === 0 ? -1 : 1) * (2.2 + n * 0.7);
        const oz = room.z + (n * 1.1 - 0.6);
        spawnEnemy(group, enemies, defeated, { id, x: ox, z: oz, homeX: 0, homeZ: room.z });
      }
    }

    if (room.kind === 'boss' && !defeated.has('boss') && !saveData.bossDefeated) {
      spawnEnemy(group, enemies, defeated, {
        id: 'boss',
        x: 0,
        z: room.z + 1.5,
        boss: true,
        homeX: 0,
        homeZ: room.z,
      });
    }

    if (room.kind === 'entry') {
      interactables.push({
        id: 'cave-mouth',
        x: 0,
        z: 1.4,
        radius: 2.2,
        prompt: (pad) => `${pad ? 'A' : 'E'}  Return to Hollyhollow`,
        use: (game) => game.changeArea('village', { via: 'cave' }),
      });
    }

    scatterRocks(ctx, room.z, room.w, room.d, 0, 4);
  }

  const boss = rooms[rooms.length - 1];
  const doorZ = boss.z + boss.d / 2;
  const door = addBox(group, stoneMat, 6.2, 5.6, 1.15, 0, 2.7, doorZ - 0.15, true);
  const doorBlock = aabbObstacle(-3.2, 3.2, doorZ - 1.15, doorZ + 0.7);
  let secretOpen = secretOpened;
  if (secretOpen) {
    door.position.y = 8.4;
  } else {
    obstacles.push(doorBlock);
  }

  const button = makeStoneButton(buttonMat);
  button.position.set(4.4, 0, doorZ - 3.4);
  group.add(button);
  obstacles.push(circleObstacle(4.4, doorZ - 3.4, 0.55));

  const secret = {
    openT: secretOpen ? 1 : 0,
    door,
    doorBlock,
    gem: button.userData.gem,
  };

  interactables.push({
    id: 'secret-button',
    x: 4.4,
    z: doorZ - 3.4,
    radius: 1.9,
    prompt: (pad) => {
      if (secretOpen) return `${pad ? 'A' : 'E'}  The way is open`;
      return `${pad ? 'A' : 'E'}  Press the stone`;
    },
    use: (game) => {
      if (!game.save.data.bossDefeated) {
        game.toast('The carved stone stays cold while the wight still stands.');
        return;
      }
      if (secretOpen) {
        game.toast('The secret door already stands open.');
        return;
      }
      secretOpen = true;
      game.save.data.secretOpened = true;
      game.saveNow(false);
      game.toast('The back wall splits. A deeper dark waits.');
      const idx = obstacles.indexOf(doorBlock);
      if (idx >= 0) obstacles.splice(idx, 1);
    },
  });

  buildDeeps(ctx, enemies, defeated, doorZ);
  interactables.push({
    id: 'deep-end',
    x: 0,
    z: 282,
    radius: 2.4,
    prompt: (pad) => `${pad ? 'A' : 'E'}  Study the far wall`,
    use: (game) => {
      game.toast('The stone here is older still. Another tale, for another walk.');
    },
  });

  obstacles.push(aabbObstacle(-40, 40, -4, 0.2));
  obstacles.push(aabbObstacle(-40, 40, 292, 300));

  const ambient = new THREE.HemisphereLight(0x6a6178, 0x1a1210, 0.7);
  const fill = new THREE.AmbientLight(0x3a3236, 0.55);
  const entrance = new THREE.DirectionalLight(0xffd8a8, 0.35);
  entrance.position.set(0, 4, -6);
  group.add(ambient, fill, entrance);

  const world = {
    id: 'cave',
    name: 'The Cave Pass',
    group,
    npcs: [],
    enemies,
    interactables,
    obstacles,
    terrainMesh: null,
    spawn: { x: 0, z: 3.2, yaw: 0 },
    heightAt(x, z) {
      return heightAt(surfaces, x, z);
    },
    resolve(px, pz, nx, nz, radius) {
      const stepped = resolveMove(px, pz, nx, nz, radius, obstacles, (x, z) => heightAt(surfaces, x, z));
      return {
        x: clamp(stepped.x, -28, 28),
        z: clamp(stepped.z, 0.4, 288),
      };
    },
    update(dt, game) {
      if (secretOpen && secret.openT < 1) {
        secret.openT = Math.min(1, secret.openT + dt / 1.35);
        secret.door.position.y = 2.7 + secret.openT * 5.7;
      }
      if (game.save.data.bossDefeated && secret.gem?.material) {
        secret.gem.material.emissive.setHex(0x6a8a9a);
        secret.gem.material.emissiveIntensity = 0.45 + Math.sin(performance.now() * 0.004) * 0.2;
      }
      for (const enemy of enemies) {
        if (!enemy.dead) enemy.update(dt, game.player, this, game.camera);
      }
      for (const flame of flames) {
        const phase = flame.userData.phase || 0;
        flame.scale.y = 1 + Math.sin(performance.now() * 0.014 + phase) * 0.2;
      }
    },
    applySky(scene) {
      scene.background = new THREE.Color(COLORS.cave);
      scene.fog = new THREE.FogExp2(COLORS.cave, 0.026);
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

  return world;
}

function buildDeeps(ctx, enemies, defeated, doorZ) {
  const { group } = ctx;
  addCorridor(ctx, 0, doorZ + 0.4, 168, 7.2, 0);
  addFloor(ctx, 0, 174, 14, 12, 0);
  addBox(group, ctx.ceilMat, 14, 0.4, 12, 0, 6.4, 174, false);
  addWalls(ctx, { x: 0, z: 174, w: 14, d: 12, wallH: 6.4 }, { n: 3.2, s: 3.2 });
  placeTorch(ctx, -5, 172, 0);

  addRamp(ctx, 0, 180, 198, 8, 0, -3, true);
  addCorridorWalls(ctx, 0, 180, 198, 8, -3, 11);

  const cavernZ = 226;
  addFloor(ctx, 0, cavernZ, 46, 56, -3, true);
  addBox(group, ctx.ceilMat, 46, 0.5, 56, 0, 11.2, cavernZ, false);
  addCavernWalls(ctx, 0, cavernZ, 46, 56, -3, 14.4, 3.4);
  placeTorch(ctx, -16, 210, -3);
  placeTorch(ctx, 16, 236, -3);
  placeTorch(ctx, 0, 248, 3.5);
  const cavernLight = new THREE.PointLight(0xffc19a, 4.4, 34, 1.4);
  cavernLight.position.set(0, 5.5, cavernZ);
  ctx.group.add(cavernLight);
  const cavernFill = new THREE.PointLight(0x8899bb, 2.2, 30, 1.6);
  cavernFill.position.set(-10, 6, 240);
  ctx.group.add(cavernFill);

  addFloor(ctx, -14, 212, 14, 16, 0.5, true);
  addRamp(ctx, -14, 220, 228, 5.5, -3, 0.5, true);
  addFloor(ctx, 14, 232, 13, 14, 2.2, true);
  addRamp(ctx, 14, 222, 232, 5.2, -3, 2.2, true);
  addFloor(ctx, 0, 248, 18, 12, 3.5, true);
  addRamp(ctx, 0, 238, 248, 7, -3, 3.5, true);

  addPillar(ctx, -8, 220, -3, 10);
  addPillar(ctx, 9, 214, -3, 10);
  addPillar(ctx, -6, 240, -3, 10);

  scatterRocks(ctx, cavernZ, 40, 48, -3, 7);

  addCorridor(ctx, 0, 254, 263, 8, 3.5, true);
  addFloor(ctx, 0, 274, 30, 22, 3.5, true);
  addBox(group, ctx.ceilMat, 30, 0.4, 22, 0, 10.8, 274, false);
  addWalls(ctx, { x: 0, z: 274, w: 30, d: 22, y: 3.5, wallH: 7.4 }, { n: 0, s: 3.4 });
  placeTorch(ctx, -10, 270, 3.5);
  placeTorch(ctx, 10, 278, 3.5);
  scatterRocks(ctx, 274, 24, 18, 3.5, 3);

  const deepSpawns = [
    { id: 'deep-0', x: -8, z: 214 },
    { id: 'deep-1', x: 7, z: 220 },
    { id: 'deep-2', x: -14, z: 210 },
    { id: 'deep-3', x: -12, z: 216 },
    { id: 'deep-4', x: 14, z: 230 },
    { id: 'deep-5', x: 12, z: 236 },
    { id: 'deep-6', x: -4, z: 246 },
    { id: 'deep-7', x: 5, z: 250 },
    { id: 'deep-8', x: -8, z: 270 },
    { id: 'deep-9', x: 8, z: 276 },
    { id: 'deep-10', x: 0, z: 280 },
  ];
  for (const spawn of deepSpawns) {
    spawnEnemy(group, enemies, defeated, {
      ...spawn,
      homeX: spawn.x,
      homeZ: spawn.z,
    });
  }

}

function spawnEnemy(group, enemies, defeated, def) {
  if (defeated.has(def.id)) return;
  const enemy = new Enemy(def);
  group.add(enemy.group);
  enemies.push(enemy);
}

function addFloor(ctx, x, z, w, d, y, deep = false) {
  addBox(ctx.group, deep && ctx.deepFloorMat ? ctx.deepFloorMat : ctx.floorMat, w, 0.4, d, x, y - 0.2, z, true);
  ctx.surfaces.push({
    kind: 'flat',
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    y,
  });
}

function addRamp(ctx, x, z0, z1, w, y0, y1, deep = false) {
  const len = z1 - z0;
  const dy = y1 - y0;
  const hyp = Math.hypot(len, dy);
  const mat = deep && ctx.deepFloorMat ? ctx.deepFloorMat : ctx.floorMat;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, hyp), mat);
  mesh.rotation.x = -Math.atan2(dy, len);
  mesh.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
  enableShadows(mesh);
  ctx.group.add(mesh);
  ctx.surfaces.push({
    kind: 'ramp',
    minX: x - w / 2,
    maxX: x + w / 2,
    z0,
    z1,
    y0,
    y1,
  });
}

function addCorridor(ctx, x, z0, z1, w, y, deep = false) {
  const len = Math.max(2, z1 - z0);
  const mid = (z0 + z1) / 2;
  addFloor(ctx, x, mid, w, len, y, deep);
  addBox(ctx.group, ctx.ceilMat, w, 0.4, len, x, y + 5.2, mid, false);
  addCorridorWalls(ctx, x, z0, z1, w, y, 5.2);
}

function addCorridorWalls(ctx, x, z0, z1, w, y, h) {
  const mid = (z0 + z1) / 2;
  const len = Math.max(2, z1 - z0);
  const hw = w / 2;
  addBox(ctx.group, ctx.wallMat, 0.7, h, len, x - hw, y + h / 2, mid, true);
  addBox(ctx.group, ctx.wallMat, 0.7, h, len, x + hw, y + h / 2, mid, true);
  ctx.obstacles.push(aabbObstacle(x - hw - 0.45, x - hw + 0.45, z0, z1));
  ctx.obstacles.push(aabbObstacle(x + hw - 0.45, x + hw + 0.45, z0, z1));
}

function addWalls(ctx, room, gaps) {
  const x = room.x || 0;
  const { w, d, z } = room;
  const y = room.y || 0;
  const wallH = room.wallH || 5.8;
  const hw = w / 2;
  const hd = d / 2;
  const cy = y + wallH / 2;
  addBox(ctx.group, ctx.wallMat, 0.8, wallH, d, x - hw, cy, z, true);
  addBox(ctx.group, ctx.wallMat, 0.8, wallH, d, x + hw, cy, z, true);
  ctx.obstacles.push(aabbObstacle(x - hw - 0.5, x - hw + 0.55, z - hd, z + hd));
  ctx.obstacles.push(aabbObstacle(x + hw - 0.55, x + hw + 0.5, z - hd, z + hd));
  splitEndWall(ctx, x, z - hd, w, y, wallH, gaps.s || 0, z - hd - 0.5, z - hd + 0.5);
  splitEndWall(ctx, x, z + hd, w, y, wallH, gaps.n || 0, z + hd - 0.5, z + hd + 0.5);
}

function splitEndWall(ctx, x, zWall, w, y, wallH, gap, minZ, maxZ) {
  const hw = w / 2;
  const cy = y + wallH / 2;
  if (gap <= 0) {
    addBox(ctx.group, ctx.wallMat, w, wallH, 0.8, x, cy, zWall, true);
    ctx.obstacles.push(aabbObstacle(x - hw, x + hw, minZ, maxZ));
    return;
  }
  const side = hw - gap;
  addBox(ctx.group, ctx.wallMat, side, wallH, 0.8, x - hw / 2 - gap / 2, cy, zWall, true);
  addBox(ctx.group, ctx.wallMat, side, wallH, 0.8, x + hw / 2 + gap / 2, cy, zWall, true);
  ctx.obstacles.push(aabbObstacle(x - hw, x - gap, minZ, maxZ));
  ctx.obstacles.push(aabbObstacle(x + gap, x + hw, minZ, maxZ));
}

function addCavernWalls(ctx, x, z, w, d, y, wallH, northGap) {
  const hw = w / 2;
  const hd = d / 2;
  const cy = y + wallH / 2;
  addBox(ctx.group, ctx.wallMat, 1.1, wallH, d, x - hw, cy, z, true);
  addBox(ctx.group, ctx.wallMat, 1.1, wallH, d, x + hw, cy, z, true);
  ctx.obstacles.push(aabbObstacle(x - hw - 0.6, x - hw + 0.7, z - hd, z + hd));
  ctx.obstacles.push(aabbObstacle(x + hw - 0.7, x + hw + 0.6, z - hd, z + hd));
  splitEndWall(ctx, x, z - hd, w, y, wallH, 4, z - hd - 0.6, z - hd + 0.6);
  splitEndWall(ctx, x, z + hd, w, y, wallH, northGap, z + hd - 0.6, z + hd + 0.6);
}

function addPillar(ctx, x, z, y, h) {
  addBox(ctx.group, ctx.wallMat, 1.6, h, 1.6, x, y + h / 2, z, true);
  ctx.obstacles.push(aabbObstacle(x - 0.95, x + 0.95, z - 0.95, z + 0.95));
}

function scatterRocks(ctx, z, w, d, y, count) {
  for (let r = 0; r < count; r++) {
    const rx = (Math.random() - 0.5) * (w - 4);
    const rz = z + (Math.random() - 0.5) * (d - 4);
    if (Math.abs(rx) < 1.6) continue;
    const rock = makeRock(0.7 + Math.random());
    rock.position.set(rx, y + 0.08, rz);
    ctx.group.add(rock);
    ctx.obstacles.push(circleObstacle(rx, rz, 0.65));
  }
}

function placeTorch(ctx, x, z, y) {
  const torch = makeTorch();
  torch.position.set(x, y, z);
  ctx.group.add(torch);
  const flame = torch.getObjectByName('flame');
  if (flame) {
    flame.userData.phase = Math.random() * 10;
    ctx.flames.push(flame);
  }
}

function makeStoneButton(gemMat) {
  const group = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.7, 0.95, 10), gemMat);
  pedestal.position.y = 0.48;
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: 0x2e2b28, roughness: 0.7 }),
  );
  plate.position.y = 1.0;
  const gem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 10), gemMat.clone());
  gem.position.y = 1.1;
  group.add(pedestal, plate, gem);
  group.userData.gem = gem;
  enableShadows(group);
  return group;
}

function addBox(group, mat, w, h, d, x, y, z, shadow) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (shadow) enableShadows(mesh);
  else mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function heightAt(surfaces, x, z) {
  let best = -99;
  let found = false;
  for (const s of surfaces) {
    if (x < s.minX || x > s.maxX) continue;
    if (s.kind === 'flat' && z >= s.minZ && z <= s.maxZ) {
      found = true;
      if (s.y > best) best = s.y;
    } else if (s.kind === 'ramp' && z >= s.z0 && z <= s.z1) {
      const t = (z - s.z0) / Math.max(0.001, s.z1 - s.z0);
      const y = s.y0 + (s.y1 - s.y0) * t;
      found = true;
      if (y > best) best = y;
    }
  }
  return found ? best : 0;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
