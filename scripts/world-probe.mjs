import { PLAYER } from '../src/config.js';
import { caveWalkways, createCave } from '../src/world/cave.js';

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
