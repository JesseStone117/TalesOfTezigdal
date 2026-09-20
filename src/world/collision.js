import { PLAYER } from '../config.js';

export function resolveMove(px, pz, nx, nz, radius, obstacles, heightAt) {
  let x = nx;
  let z = nz;
  for (let i = 0; i < 3; i++) {
    for (const o of obstacles) {
      if (o.type === 'circle') {
        const dx = x - o.x;
        const dz = z - o.z;
        const d = Math.hypot(dx, dz);
        const min = radius + o.r;
        if (d < min && d > 1e-5) {
          const push = (min - d) / d;
          x += dx * push;
          z += dz * push;
        } else if (d <= 1e-5) {
          x += min;
        }
      } else if (o.type === 'aabb') {
        const cx = clampTo(x, o.minX - radius, o.maxX + radius);
        const cz = clampTo(z, o.minZ - radius, o.maxZ + radius);
        const insideX = x > o.minX - radius && x < o.maxX + radius;
        const insideZ = z > o.minZ - radius && z < o.maxZ + radius;
        if (insideX && insideZ) {
          const left = Math.abs(x - (o.minX - radius));
          const right = Math.abs((o.maxX + radius) - x);
          const down = Math.abs(z - (o.minZ - radius));
          const up = Math.abs((o.maxZ + radius) - z);
          const m = Math.min(left, right, down, up);
          if (m === left) x = o.minX - radius;
          else if (m === right) x = o.maxX + radius;
          else if (m === down) z = o.minZ - radius;
          else z = o.maxZ + radius;
        }
        void cx;
        void cz;
      }
    }
  }

  if (heightAt) {
    const oldH = heightAt(px, pz);
    const newH = heightAt(x, z);
    const dist = Math.hypot(x - px, z - pz) || 0.0001;
    if (newH - oldH > PLAYER.stepHeight || (newH - oldH) / dist > 1.35) {
      const onlyX = heightAt(x, pz);
      if (onlyX - oldH <= PLAYER.stepHeight) return { x, z: pz };
      const onlyZ = heightAt(px, z);
      if (onlyZ - oldH <= PLAYER.stepHeight) return { x: px, z };
      return { x: px, z: pz };
    }
  }
  return { x, z };
}

function clampTo(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function circleObstacle(x, z, r) {
  return { type: 'circle', x, z, r };
}

export function aabbObstacle(minX, maxX, minZ, maxZ) {
  return { type: 'aabb', minX, maxX, minZ, maxZ };
}
