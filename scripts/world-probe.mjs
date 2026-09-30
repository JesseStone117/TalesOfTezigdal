import * as THREE from 'three';
import { COMBAT, COLORS, PLAYER } from '../src/config.js';
import { caveWalkways, createCave } from '../src/world/cave.js';
import { Enemy } from '../src/world/enemy.js';
import { makeCreature } from '../src/world/props.js';
import { createVillage } from '../src/world/village.js';

const STEP = 0.32;
const BUILDS = 6;

function walkZ(world, route) {
  const { x, z0, z1, id } = route;
  for (const [from, to] of [[z0, z1], [z1, z0]]) {
    let z = from;
    const dir = Math.sign(to - from);
    let guard = 0;
    let maxAbs = 0;
    while (guard++ < 8000) {
      const remain = (to - z) * dir;
      if (remain <= 0.05) break;
      const dz = dir * Math.min(STEP, remain);
      const oldH = world.heightAt(x, z);
      const res = world.resolve(x, z, x, z + dz, PLAYER.radius);
      const newH = world.heightAt(res.x, res.z);
      const dh = newH - oldH;
      maxAbs = Math.max(maxAbs, Math.abs(dh));
      if (Math.abs(dh) > PLAYER.stepHeight + 1e-6) {
        throw new Error(
          `${id} height change ${dh.toFixed(3)} at z=${z.toFixed(2)} exceeds stepHeight ${PLAYER.stepHeight}`,
        );
      }
      if (Math.abs(res.x - x) > 0.04 || Math.abs(res.z - (z + dz)) > 0.04) {
        throw new Error(
          `${id} blocked at (${x}, ${z.toFixed(2)}) -> (${res.x.toFixed(2)}, ${res.z.toFixed(2)}), `
          + `wanted z=${(z + dz).toFixed(2)}, h ${oldH.toFixed(2)} -> ${newH.toFixed(2)}`,
        );
      }
      z = res.z;
    }
    if (Math.abs(z - to) > 0.2) {
      throw new Error(`${id} stopped at z=${z.toFixed(2)}, wanted ${to}`);
    }
  }
}

function assertSideWall(world, z) {
  let x = 0;
  let guard = 0;
  while (guard++ < 80) {
    const res = world.resolve(x, z, x + STEP, z, PLAYER.radius);
    if (res.x < x + 0.02) break;
    x = res.x;
  }
  if (!(x > 2.3 && x < 3.2)) {
    throw new Error(`side wall did not stop the player (x=${x.toFixed(3)} at z=${z})`);
  }
  const into = world.resolve(2.2, z, 3.45, z, PLAYER.radius);
  if (!(into.x < 3.05 && into.x > 2.4 && Math.abs(into.z - z) < 0.05)) {
    throw new Error(`step into the side wall passed through: ${JSON.stringify(into)}`);
  }
}

function runOnce(index) {
  const world = createCave({ defeated: [], secretOpened: false });
  const routes = caveWalkways();
  for (const route of routes.corridors) walkZ(world, route);
  walkZ(world, routes.entry);
  walkZ(world, routes.descent);
  for (const route of routes.ledges) walkZ(world, route);
  walkZ(world, routes.upper);
  assertSideWall(world, routes.wall.z);
  console.log(`build ${index} pass radius=${PLAYER.radius} stepHeight=${PLAYER.stepHeight}`);
}

function floodVillage(world) {
  const step = 0.7;
  const cell = (x, z) => `${Math.round(x / step)}:${Math.round(z / step)}`;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const spawn = world.spawn;
  const reached = [{ x: spawn.x, z: spawn.z }];
  const seen = new Set([cell(spawn.x, spawn.z)]);
  let maxAbs = 0;
  for (let i = 0; i < reached.length; i++) {
    const n = reached[i];
    for (const [dx, dz] of dirs) {
      const len = Math.hypot(dx, dz);
      const nx = n.x + (dx / len) * step;
      const nz = n.z + (dz / len) * step;
      const key = cell(nx, nz);
      if (seen.has(key)) continue;
      const oldH = world.heightAt(n.x, n.z);
      const res = world.resolve(n.x, n.z, nx, nz, PLAYER.radius);
      const dh = world.heightAt(res.x, res.z) - oldH;
      if (Math.abs(dh) > PLAYER.stepHeight + 1e-6) continue;
      if (Math.hypot(res.x - nx, res.z - nz) > 0.22) continue;
      if (Math.hypot(res.x - n.x, res.z - n.z) < step * 0.7) continue;
      seen.add(key);
      if (Math.abs(dh) > maxAbs) maxAbs = Math.abs(dh);
      reached.push({ x: res.x, z: res.z });
    }
    if (reached.length > 20000) break;
  }
  return { reached, maxAbs };
}

function nearest(reached, x, z) {
  let best = Infinity;
  for (const p of reached) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) best = d;
  }
  return best;
}

function collect(group, kind) {
  const found = [];
  group.traverse((obj) => {
    if (obj.userData?.kind === kind) found.push(obj);
  });
  return found;
}

function runTown() {
  const world = createVillage();
  const homes = collect(world.group, 'cottage');
  if (homes.length <= 4) throw new Error(`expected more than 4 dwellings, got ${homes.length}`);
  const xs = homes.map((h) => h.position.x);
  const zs = homes.map((h) => h.position.z);
  const sepX = Math.max(...xs) - Math.min(...xs);
  const sepZ = Math.max(...zs) - Math.min(...zs);
  if (sepX < 34) throw new Error(`dwelling x separation ${sepX.toFixed(2)} < 34`);
  if (sepZ < 24) throw new Error(`dwelling z separation ${sepZ.toFixed(2)} < 24`);

  for (const kind of ['well', 'campfire', 'sign', 'arch']) {
    if (collect(world.group, kind).length < 1) throw new Error(`missing ${kind}`);
  }
  const ids = world.npcs.map((n) => n.id);
  for (const id of ['mira', 'bram', 'nim', 'orrin', 'sera']) {
    if (!ids.includes(id)) throw new Error(`missing villager ${id}`);
  }
  const pass = world.triggers.find((t) => t.id === 'to-cave');
  if (!pass) throw new Error('cave pass trigger missing');
  if (pass.z < Math.max(...zs) + 8) {
    throw new Error(`cave pass z=${pass.z} is not beyond the town`);
  }

  const t0 = performance.now();
  const { reached, maxAbs } = floodVillage(world);
  const floodMs = performance.now() - t0;
  const need = 1.25;
  const report = [];
  const requireReach = (label, x, z) => {
    const d = nearest(reached, x, z);
    report.push({ label, x, z, d: Number(d.toFixed(2)) });
    if (d > need) throw new Error(`${label} not reachable from spawn (nearest ${d.toFixed(2)})`);
  };
  for (const home of homes) {
    requireReach(`cottage ${home.position.x.toFixed(1)},${home.position.z.toFixed(1)}`, home.position.x, home.position.z + 4.8);
  }
  requireReach('well', 1.7, 0);
  requireReach('campfire', -3.6, 4.2);
  const sign = collect(world.group, 'sign')[0];
  requireReach('sign', sign.position.x, sign.position.z);
  for (const npc of world.npcs) requireReach(npc.id, npc.x + 1.2, npc.z);
  requireReach('cave pass', pass.x, pass.z);

  const blocked = [
    ['east ridge', 52, 0],
    ['west ridge', -52, 2],
    ['south ridge', 0, -52],
  ];
  for (const [label, x, z] of blocked) {
    const d = nearest(reached, x, z);
    report.push({ label, x, z, d: Number(d.toFixed(2)), blocked: true });
    if (d < 8) throw new Error(`${label} should stay closed, nearest ${d.toFixed(2)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    dwellings: homes.length,
    sepX: Number(sepX.toFixed(2)),
    sepZ: Number(sepZ.toFixed(2)),
    villagers: ids,
    pass,
    reached: reached.length,
    maxAbsStep: Number(maxAbs.toFixed(3)),
    stepHeight: PLAYER.stepHeight,
    radius: PLAYER.radius,
    floodMs: Math.round(floodMs),
    report,
  }, null, 2));
}

function countMeshes(obj) {
  let n = 0;
  obj.traverse((child) => {
    if (child.isMesh) n += 1;
  });
  return n;
}

function findKind(group, kind) {
  let found = null;
  group.traverse((obj) => {
    if (!found && obj.userData?.kind === kind) found = obj;
  });
  return found;
}

function colorSpread(mesh) {
  const attr = mesh.geometry?.getAttribute?.('color');
  if (!attr) return 0;
  const seen = new Set();
  for (let i = 0; i < attr.count; i++) {
    seen.add(`${attr.getX(i).toFixed(2)},${attr.getY(i).toFixed(2)},${attr.getZ(i).toFixed(2)}`);
    if (seen.size > 4) break;
  }
  return seen.size;
}

function uniqueMaterials(group) {
  const ids = new Set();
  group.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of list) ids.add(mat.uuid);
  });
  return ids.size;
}

function lightCensus(group) {
  let points = 0;
  let pointShadows = 0;
  let dirShadows = 0;
  group.traverse((obj) => {
    if (obj.isPointLight) {
      points += 1;
      if (obj.castShadow) pointShadows += 1;
    }
    if (obj.isDirectionalLight && obj.castShadow) dirShadows += 1;
  });
  return { points, pointShadows, dirShadows };
}

function runAssets() {
  const village = createVillage();
  const cave = createCave({ defeated: [], secretOpened: false });
  const expect = (label, obj, minMeshes) => {
    if (!obj) throw new Error(`missing ${label}`);
    const meshes = countMeshes(obj);
    if (meshes <= minMeshes) throw new Error(`${label} has ${meshes} meshes, need more than ${minMeshes}`);
    return meshes;
  };
  const counts = {
    cottage: expect('cottage', findKind(village.group, 'cottage'), 5),
    tree: expect('tree', findKind(village.group, 'tree'), 3),
    rock: expect('rock', findKind(village.group, 'rock') || findKind(cave.group, 'rock'), 1),
    well: expect('well', findKind(village.group, 'well'), 5),
    arch: expect('arch', findKind(village.group, 'arch'), 3),
    torch: expect('torch', findKind(cave.group, 'torch'), 2),
    campfire: expect('campfire', findKind(village.group, 'campfire'), 5),
    sign: expect('sign', findKind(village.group, 'sign'), 2),
    villager: expect('villager', findKind(village.group, 'villager'), 3),
    creature: expect('creature', cave.enemies[0]?.body, 4),
    basic: expect('basic creature', makeCreature({ color: 0x4a3a58 }), 4),
  };
  const rock = findKind(cave.group, 'rock') || findKind(village.group, 'rock');
  let indices = 0;
  rock.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    const geo = obj.geometry;
    const n = geo.index ? geo.index.count : (geo.attributes.position?.count ?? 0);
    indices = Math.max(indices, n);
  });
  if (indices <= 60 && counts.rock <= 1) throw new Error(`rock is still a detail-0 icosahedron (${indices} indices)`);

  const floors = [];
  const walls = [];
  const ceilings = [];
  cave.group.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.userData.surface === 'floor') floors.push(obj);
    if (obj.userData.surface === 'wall') walls.push(obj);
    if (obj.userData.surface === 'ceiling') ceilings.push(obj);
  });
  if (!floors.length || !walls.length || !ceilings.length) throw new Error('cave floor, wall, or ceiling surfaces missing');
  const floorColors = Math.max(...floors.map(colorSpread));
  const wallColors = Math.max(...walls.map(colorSpread));
  const ceilingColors = Math.max(...ceilings.map(colorSpread));
  if (floorColors < 2) throw new Error(`cave floor colors ${floorColors}`);
  if (wallColors < 2) throw new Error(`cave wall colors ${wallColors}`);
  if (ceilingColors < 2) throw new Error(`cave ceiling colors ${ceilingColors}`);
  const terrainColors = colorSpread(village.terrainMesh);
  if (terrainColors < 2) throw new Error(`village terrain colors ${terrainColors}`);

  console.log(JSON.stringify({
    ok: true,
    counts,
    rockIndices: indices,
    floorColors,
    wallColors,
    ceilingColors,
    terrainColors,
    floors: floors.length,
    walls: walls.length,
  }, null, 2));
}

function runPerf() {
  const samples = [];
  for (let pass = 0; pass < 2; pass++) {
    const t0 = performance.now();
    const village = createVillage();
    const cave = createCave({ defeated: [], secretOpened: false });
    let x = village.spawn.x;
    let z = village.spawn.z;
    for (let i = 0; i < 150; i++) {
      const res = village.resolve(x, z, x + 0.15, z + 0.28, PLAYER.radius);
      x = res.x;
      z = res.z;
    }
    x = 0;
    z = 4;
    for (let i = 0; i < 150; i++) {
      const res = cave.resolve(x, z, x, z + 0.32, PLAYER.radius);
      x = res.x;
      z = res.z;
    }
    const ms = performance.now() - t0;
    const villageLights = lightCensus(village.group);
    const caveLights = lightCensus(cave.group);
    const villageMats = uniqueMaterials(village.group);
    const caveMats = uniqueMaterials(cave.group);
    const verts = village.terrainMesh.geometry.attributes.position.count;
    const row = { pass, ms: Math.round(ms), villageLights, caveLights, villageMats, caveMats, verts };
    samples.push(row);
    if (ms >= 5000) throw new Error(`build+steps took ${ms.toFixed(0)}ms`);
    if (villageLights.points > 6) throw new Error(`village point lights ${villageLights.points}`);
    if (caveLights.points > 24) throw new Error(`cave point lights ${caveLights.points}`);
    if (villageLights.pointShadows || caveLights.pointShadows) throw new Error('point light casts shadow');
    if (villageLights.dirShadows > 1 || caveLights.dirShadows > 1) throw new Error('more than one shadow directional');
    if (verts > 50000) throw new Error(`terrain verts ${verts}`);
    if (villageMats >= 40) throw new Error(`village materials ${villageMats}`);
    if (caveMats >= 30) throw new Error(`cave materials ${caveMats}`);
  }
  console.log(JSON.stringify({ ok: true, samples }, null, 2));
}

const _lightPos = new THREE.Vector3();

function saturate(v) {
  return Math.min(1, Math.max(0, v));
}

function pointAttenuation(light, x, y, z) {
  const range = light.distance;
  if (!(range > 0)) return 0;
  light.getWorldPosition(_lightPos);
  const dist = Math.hypot(_lightPos.x - x, _lightPos.y - y, _lightPos.z - z);
  if (dist === 0) return 0;
  const falloff = light.intensity / Math.max(dist ** light.decay, 0.01);
  const cutoff = saturate(1 - (dist / range) ** 4);
  return falloff * cutoff * cutoff;
}

function entryAttenuation(cave, z, y) {
  let sum = 0;
  cave.group.updateMatrixWorld(true);
  cave.group.traverse((obj) => {
    if (obj.isPointLight) sum += pointAttenuation(obj, 0, y, z);
  });
  return sum;
}

function runCaveLight() {
  const samples = [];
  for (let build = 0; build < 2; build++) {
    const cave = createCave({ defeated: [], secretOpened: false });
    const lights = lightCensus(cave.group);
    if (lights.points > 24) throw new Error(`cave point lights ${lights.points}`);
    if (lights.pointShadows) throw new Error('cave point light casts a shadow');
    const rows = [];
    for (let z = 8; z <= 26; z += 2) {
      const atFloor = entryAttenuation(cave, z, 0);
      const atEye = entryAttenuation(cave, z, 1.6);
      const sum = Math.min(atFloor, atEye);
      rows.push({
        z,
        floor: Number(atFloor.toFixed(3)),
        eye: Number(atEye.toFixed(3)),
        sum: Number(sum.toFixed(3)),
      });
      if (sum < 0.15) {
        throw new Error(`entry light at z=${z} is ${sum.toFixed(3)} (floor ${atFloor.toFixed(3)}, eye ${atEye.toFixed(3)})`);
      }
    }
    runOnce(build);
    samples.push({ build, points: lights.points, pointShadows: lights.pointShadows, rows });
  }
  console.log(JSON.stringify({ ok: true, samples }, null, 2));
}

function rgbDist(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function runGround() {
  const world = createVillage();
  const mesh = world.terrainMesh;
  const pos = mesh.geometry.attributes.position;
  const col = mesh.geometry.attributes.color;
  if (pos.count > 50000) throw new Error(`terrain verts ${pos.count}`);
  let rowZ = null;
  let bestDz = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const dz = Math.abs(pos.getZ(i) - 20);
    if (dz < bestDz) {
      bestDz = dz;
      rowZ = pos.getZ(i);
    }
  }
  const row = [];
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getZ(i) - rowZ) > 1e-4) continue;
    const x = pos.getX(i);
    if (x < -0.05 || x > 9.2) continue;
    row.push({
      x,
      c: new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)),
    });
  }
  row.sort((a, b) => a.x - b.x);
  if (row.length < 3) throw new Error('terrain row at z=20 is missing');
  const path = new THREE.Color(COLORS.path);
  const grass = new THREE.Color(COLORS.grass);
  const span = rgbDist(path, grass);
  const center = row.reduce((best, v) => (Math.abs(v.x) < Math.abs(best.x) ? v : best));
  const off = row.reduce((best, v) => (Math.abs(v.x - 8) < Math.abs(best.x - 8) ? v : best));
  const centerToPath = rgbDist(center.c, path);
  const centerToGrass = rgbDist(center.c, grass);
  const offToPath = rgbDist(off.c, path);
  const offToGrass = rgbDist(off.c, grass);
  if (!(centerToPath < centerToGrass)) {
    throw new Error(`road center is not nearer the path color (${centerToPath.toFixed(3)} vs grass ${centerToGrass.toFixed(3)})`);
  }
  if (!(offToGrass < offToPath)) {
    throw new Error(`off-road point is not nearer the grass color (${offToGrass.toFixed(3)} vs path ${offToPath.toFixed(3)})`);
  }
  let maxJump = 0;
  for (let i = 1; i < row.length; i++) {
    const jump = rgbDist(row[i - 1].c, row[i].c);
    if (jump > maxJump) maxJump = jump;
    if (jump > span * 0.5) {
      throw new Error(
        `terrain colors jump ${jump.toFixed(3)} between x=${row[i - 1].x.toFixed(2)} and x=${row[i].x.toFixed(2)} `
        + `(limit ${(span * 0.5).toFixed(3)})`,
      );
    }
  }
  const homes = collect(world.group, 'cottage');
  const xs = homes.map((h) => h.position.x);
  const zs = homes.map((h) => h.position.z);
  const sepX = Math.max(...xs) - Math.min(...xs);
  const sepZ = Math.max(...zs) - Math.min(...zs);
  if (homes.length <= 4 || sepX < 34 || sepZ < 24) {
    throw new Error(`town scale dwellings=${homes.length} sep ${sepX.toFixed(1)} x ${sepZ.toFixed(1)}`);
  }
  console.log(JSON.stringify({
    ok: true,
    verts: pos.count,
    rowZ: Number(rowZ.toFixed(3)),
    span: Number(span.toFixed(3)),
    maxJump: Number(maxJump.toFixed(3)),
    limit: Number((span * 0.5).toFixed(3)),
    center: { x: Number(center.x.toFixed(2)), toPath: Number(centerToPath.toFixed(3)), toGrass: Number(centerToGrass.toFixed(3)) },
    off: { x: Number(off.x.toFixed(2)), toPath: Number(offToPath.toFixed(3)), toGrass: Number(offToGrass.toFixed(3)) },
    dwellings: homes.length,
    sepX: Number(sepX.toFixed(2)),
    sepZ: Number(sepZ.toFixed(2)),
  }, null, 2));
  runTown();
}

function runStun() {
  const world = createVillage();
  const enemy = new Enemy({ id: 'stun-grunt', x: 0, z: 12, homeX: 0, homeZ: 12 });
  world.group.add(enemy.group);
  const player = { x: 0, z: 15.2, dead: false };
  const before = enemy.health;
  const lethal = enemy.takeDamage(before, player.x, player.z);
  if (!lethal || enemy.group.visible) throw new Error('lethal hit did not hide the enemy');

  const live = new Enemy({ id: 'stun-live', x: 0, z: 12, homeX: 0, homeZ: 12 });
  world.group.add(live.group);
  const hurt = live.takeDamage(10, player.x, player.z);
  if (hurt || live.health <= 0 || live.health >= before) {
    throw new Error(`non-lethal hit changed health wrong: ${live.health}`);
  }
  const distOf = () => Math.hypot(player.x - live.x, player.z - live.z);
  const d0 = distOf();
  const dt = 0.04;
  let elapsed = 0;
  while (elapsed + 1e-8 < COMBAT.hitStun) {
    live.update(dt, player, world, null);
    elapsed += dt;
  }
  const approach = d0 - distOf();
  if (approach >= 0.05) {
    throw new Error(`enemy closed ${approach.toFixed(3)} during hit stun (${elapsed.toFixed(3)}s)`);
  }
  const held = distOf();
  for (let i = 0; i < 20; i++) live.update(dt, player, world, null);
  const closed = held - distOf();
  if (closed < 0.2) {
    throw new Error(`enemy did not resume chase (closed ${closed.toFixed(3)} from ${held.toFixed(3)})`);
  }
  console.log(JSON.stringify({
    ok: true,
    hitStun: COMBAT.hitStun,
    elapsed: Number(elapsed.toFixed(3)),
    approach: Number(approach.toFixed(4)),
    closed: Number(closed.toFixed(3)),
    health: live.health,
    hiddenOnKill: true,
  }, null, 2));
}

const mode = process.argv[2] || 'walkways';
if (mode === 'walkways' || mode === 'all') {
  for (let i = 0; i < BUILDS; i++) runOnce(i);
  const routes = caveWalkways();
  console.log(JSON.stringify({
    ok: true,
    builds: BUILDS,
    routes: {
      corridors: routes.corridors.map((r) => r.id),
      ledges: routes.ledges.map((r) => r.id),
      descent: routes.descent,
      upper: routes.upper,
      entry: routes.entry,
    },
  }, null, 2));
}
if (mode === 'town' || mode === 'all') {
  runTown();
  runTown();
}
if (mode === 'assets' || mode === 'all') runAssets();
if (mode === 'perf' || mode === 'all') runPerf();
if (mode === 'cave-light' || mode === 'all') runCaveLight();
if (mode === 'ground' || mode === 'all') runGround();
if (mode === 'stun' || mode === 'all') runStun();
