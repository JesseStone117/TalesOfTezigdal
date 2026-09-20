import puppeteer from 'puppeteer-core';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = 'http://localhost:5173/';
const errors = [];

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
  ],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  await page.goto(url, { waitUntil: 'networkidle0' });
  const title = await page.title();
  if (title !== 'Tales of Tezigdal') throw new Error(`Bad title: ${title}`);

  const heading = await page.$eval('h1', (el) => el.textContent);
  if (!heading.includes('Tezigdal')) throw new Error('Missing title heading');
  await page.screenshot({ path: 'scripts/menu.png' });

  const begin = await page.waitForSelector('.campaign-card.available button');
  await begin.click();

  await page.waitForFunction(() => window.__tot?.game?.player?.ready === true, { timeout: 20000 });
  await page.waitForSelector('#hud:not(.hidden)');

  const state = await page.evaluate(() => {
    const g = window.__tot.game;
    return {
      area: g.world?.id,
      health: g.player.health,
      anims: Object.keys(g.player.actions),
      x: g.player.x,
      z: g.player.z,
      npcCount: g.world.npcs.length,
    };
  });

  if (state.area !== 'village') throw new Error(`Expected village, got ${state.area}`);
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
  await page.screenshot({ path: 'scripts/village.png' });
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
  if (!/Tezigdal|Hollowrest/i.test(speech)) throw new Error(`Unexpected dialogue: ${speech}`);

  await page.evaluate(() => window.__tot.game.closeTalk());
  await page.evaluate(() => {
    window.__tot.game.player.setPose(0, window.__tot.game.world.heightAt(0, 24.4), 24.4, 0);
  });
  await page.waitForFunction(() => window.__tot.game.world?.id === 'cave', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'scripts/cave.png' });
  const cave = await page.evaluate(() => ({
    area: window.__tot.game.world.id,
    enemies: window.__tot.game.world.enemies.length,
    lantern: window.__tot.game.player.lantern.visible,
  }));
  if (cave.enemies < 4) throw new Error(`Expected cave enemies, got ${cave.enemies}`);

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ ok: true, state, walking, speech: speech.slice(0, 80), cave, savedArea: saved.destral.data.area }, null, 2));
} catch (err) {
  console.error('SMOKE FAIL', err.message);
  console.error('page errors:', errors);
  throw err;
} finally {
  await browser.close();
}
