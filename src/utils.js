export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function rand(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = rand(ix, iz);
  const b = rand(ix + 1, iz);
  const c = rand(ix, iz + 1);
  const d = rand(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

export function fbm(x, z, octaves = 4) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  let s = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * valueNoise(x * f, z * f);
    s += a;
    a *= 0.5;
    f *= 2.05;
  }
  return v / s;
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function angleLerp(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function $(id) {
  return document.getElementById(id);
}
