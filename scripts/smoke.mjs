import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import puppeteer from 'puppeteer-core';
import { VILLAGE } from '../src/world/props.js';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = 'http://localhost:5173/';
const VIEW = { width: 1280, height: 720, deviceScaleFactor: 1 };
const outDir = path.resolve(process.argv[2] || 'scripts');
mkdirSync(outDir, { recursive: true });
const shot = (name) => path.join(outDir, name);
const errors = [];

function pngPixels(file) {
  const buf = readFileSync(file);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error(`not a png: ${file}`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 12 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    offset += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported png ${file} depth ${bitDepth} type ${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgb = Buffer.alloc(width * height * 3);
  let prev = Buffer.alloc(stride);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const row = Buffer.from(raw.subarray(src, src + stride));
    src += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = prev[i];
      const ul = i >= channels ? prev[i - channels] : 0;
      let pred = 0;
      if (filter === 1) pred = left;
      else if (filter === 2) pred = up;
      else if (filter === 3) pred = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - ul;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - ul);
        pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
      } else if (filter !== 0) throw new Error(`bad png filter ${filter}`);
      row[i] = (row[i] + pred) & 255;
    }
    for (let x = 0; x < width; x++) {
      const i = x * channels;
      const o = (y * width + x) * 3;
      rgb[o] = row[i];
      rgb[o + 1] = row[i + 1];
      rgb[o + 2] = row[i + 2];
    }
    prev = row;
  }
  return { width, height, rgb };
}

function assertFilled(file) {
  const { width, height, rgb } = pngPixels(file);
  if (width !== VIEW.width || height !== VIEW.height) {
    throw new Error(`screenshot ${file} is ${width}x${height}, viewport is ${VIEW.width}x${VIEW.height}`);
  }
  const n = width * height;
  let sum = 0;
  let sumSq = 0;
  const buckets = new Map();
  let maxBucket = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += lum;
    sumSq += lum * lum;
    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    const count = (buckets.get(key) || 0) + 1;
    buckets.set(key, count);
    if (count > maxBucket) maxBucket = count;
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  const dominant = maxBucket / n;
  if (std < 6 || dominant > 0.97 || buckets.size < 6) {
    throw new Error(
      `screenshot ${path.basename(file)} looks blank (std ${std.toFixed(1)}, dominant ${(dominant * 100).toFixed(1)}%, colors ${buckets.size})`,
    );
  }
  return {
    file: path.basename(file),
    width,
    height,
    std: Number(std.toFixed(1)),
    colors: buckets.size,
    dominant: Number(dominant.toFixed(3)),
  };
}

async function assertCanvas(page) {
  const info = await page.evaluate(() => {
    const canvas = document.getElementById('gl');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return {
      drawingW: gl.drawingBufferWidth,
      drawingH: gl.drawingBufferHeight,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      dpr,
    };
  });
  const expectedW = Math.floor(info.innerW * info.dpr);
  const expectedH = Math.floor(info.innerH * info.dpr);
  if (info.drawingW !== expectedW || info.drawingH !== expectedH) {
    throw new Error(
      `canvas drawing buffer ${info.drawingW}x${info.drawingH} does not match viewport ${expectedW}x${expectedH}`,
    );
  }
  if (info.innerW !== VIEW.width || info.innerH !== VIEW.height) {
    throw new Error(`viewport ${info.innerW}x${info.innerH} is not ${VIEW.width}x${VIEW.height}`);
  }
  return info;
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    `--window-size=${VIEW.width},${VIEW.height}`,
  ],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport(VIEW);
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  await page.goto(url, { waitUntil: 'networkidle0' });
  const title = await page.title();
  if (title !== 'Tales of Tezigdal') throw new Error(`Bad title: ${title}`);

  const heading = await page.$eval('h1', (el) => el.textContent);
  if (!heading.includes('Tezigdal')) throw new Error('Missing title heading');
  await page.screenshot({ path: shot('menu.png') });

  const begin = await page.waitForSelector('.campaign-card.available button');
  await begin.click();

  await page.waitForFunction(() => window.__tot?.game?.player?.ready === true, { timeout: 20000 });
  await page.waitForSelector('#hud:not(.hidden)');
  const canvas = await assertCanvas(page);

  const state = await page.evaluate(() => {
    const g = window.__tot.game;
    return {
      area: g.world?.id,
      areaName: g.world?.name,
      health: g.player.health,
      anims: Object.keys(g.player.actions),
      x: g.player.x,
      z: g.player.z,
      npcCount: g.world.npcs.length,
      invertY: window.__tot.settings.invertY,
      pixie: !!g.pixie,
    };
  });
  if (state.invertY !== true) throw new Error('Invert Y should default to on');
  if (!state.pixie) throw new Error('Sprite companion missing');

  if (state.area !== 'village') throw new Error(`Expected village, got ${state.area}`);
  if (state.areaName && state.areaName !== 'Hollyhollow') {
    throw new Error(`Expected Hollyhollow, got ${state.areaName}`);
  }
  if (state.health !== 100) throw new Error(`Expected full health, got ${state.health}`);
  for (const name of ['Idle', 'Walk', 'Death', 'Punch_Left', 'Punch_Right']) {
    if (!state.anims.includes(name)) throw new Error(`Missing animation ${name}: ${state.anims.join(',')}`);
  }
  if (state.npcCount < 5) throw new Error(`Expected villagers, got ${state.npcCount}`);

  await page.keyboard.down('KeyW');
  await page.waitForFunction((z0) => Math.abs(window.__tot.game.player.z - z0) > 0.4, { timeout: 4000 }, state.z);
  const walking = await page.evaluate(() => ({
    z: window.__tot.game.player.z,
    anim: window.__tot.game.player.currentName,
    y: window.__tot.game.player.y,
  }));
  if (walking.anim !== 'Walk') throw new Error(`Expected Walk animation, got ${walking.anim}`);
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  await page.screenshot({ path: shot('village.png') });
  const villageShot = assertFilled(shot('village.png'));
  await page.keyboard.up('KeyW');
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
  });
  await page.waitForFunction(() => /Punch/.test(window.__tot.game.player.currentName), { timeout: 2000 });

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true,
    }));
  });
  await page.waitForSelector('#pause:not(.hidden)');
  const saveBtn = await page.waitForSelector('#pause-save');
  await saveBtn.click();
  await page.waitForFunction(() => document.getElementById('toast')?.classList.contains('show'));

  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('talesOfTezigdal.saves');
    return raw ? JSON.parse(raw) : null;
  });
  if (!saved?.destral?.data) throw new Error('Save was not written to localStorage');

  await page.evaluate(() => window.__tot.game.setPaused(false));
  await page.evaluate(() => {
    const mira = window.__tot.game.world.npcs.find((n) => n.id === 'mira');
    const x = mira.x + 1.2;
    const z = mira.z;
    window.__tot.game.player.setPose(x, window.__tot.game.world.heightAt(x, z), z, Math.PI);
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true }));
  });
  await page.waitForSelector('#dialogue:not(.hidden)');
  const speech = await page.$eval('#dialogue-text', (el) => el.textContent);
  if (!/Tezigdal|Hollyhollow/i.test(speech)) throw new Error(`Unexpected dialogue: ${speech}`);

  await page.evaluate(() => window.__tot.game.closeTalk());
  await page.evaluate((z) => {
    window.__tot.game.player.setPose(0, window.__tot.game.world.heightAt(0, z), z, 0);
  }, VILLAGE.pass.z);
  await page.waitForFunction(() => window.__tot.game.world?.id === 'cave', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 400));
  const caveCanvas = await assertCanvas(page);
  await page.screenshot({ path: shot('cave.png') });
  const caveShot = assertFilled(shot('cave.png'));
  const cave = await page.evaluate(() => ({
    area: window.__tot.game.world.id,
    enemies: window.__tot.game.world.enemies.length,
    lantern: window.__tot.game.player.lantern.visible,
  }));
  if (cave.enemies < 4) throw new Error(`Expected cave enemies, got ${cave.enemies}`);
  if (!cave.lantern) throw new Error('Lantern is not visible in the cave');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({
    ok: true,
    state,
    walking,
    speech: speech.slice(0, 80),
    cave,
    savedArea: saved.destral.data.area,
    canvas,
    caveCanvas,
    shots: [villageShot, caveShot],
  }, null, 2));
} catch (err) {
  console.error('SMOKE FAIL', err.message);
  console.error('page errors:', errors);
  throw err;
} finally {
  await browser.close();
}
