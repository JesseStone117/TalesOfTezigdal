import { GAME_VERSION } from './config.js';
import { CAMPAIGNS } from './campaigns.js';
import { exportSave, getSave, importSaveText } from './save.js';
import {
  isFullscreen,
  labelForSource,
  p1Options,
  p2Options,
  saveSettings,
  setFullscreen,
} from './settings.js';
import {
  activateFocused,
  cycleOverlayFocus,
  focusFirstButton,
} from './input.js';
import { $ } from './utils.js';

export { focusFirstButton };

let settingsRef = null;

export function toast(message, ms = 2400) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function setFade(on) {
  $('fade').classList.toggle('on', on);
}

export function show(id, visible) {
  $(id).classList.toggle('hidden', !visible);
}

export function bindMenu({ onBegin, onContinue, input }) {
  $('menu-version').textContent = `v${GAME_VERSION}`;
  const file = $('import-file');

  $('btn-settings')?.addEventListener('click', () => openSettings());
  $('btn-import').addEventListener('click', () => file.click());
  $('btn-export').addEventListener('click', () => {
    const ok = exportSave('destral');
    toast(ok ? 'Save exported.' : 'No Destral save to export.');
  });
  file.addEventListener('change', async () => {
    const picked = file.files?.[0];
    file.value = '';
    if (!picked) return;
    try {
      const save = await importSaveText(await picked.text());
      renderCampaignList({ onBegin, onContinue });
      toast(`Imported ${save.campaignId} save.`);
    } catch (err) {
      toast(err.message || 'Could not import that file.');
    }
  });

  $('confirm-no').addEventListener('click', () => show('confirm-modal', false));
  $('confirm-yes').addEventListener('click', () => {
    const id = $('confirm-modal').dataset.campaignId;
    show('confirm-modal', false);
    onBegin(id);
  });

  renderCampaignList({ onBegin, onContinue });

  return {
    update(dt) {
      updateGamepadBanner(input);
      handleOverlayNav(input);
    },
    refresh() {
      renderCampaignList({ onBegin, onContinue });
    },
  };
}

export function renderCampaignList({ onBegin, onContinue }) {
  const root = $('campaign-list');
  root.innerHTML = '';
  for (const campaign of CAMPAIGNS) {
    const save = campaign.available ? getSave(campaign.id) : null;
    const card = document.createElement('article');
    card.className = `campaign-card ${campaign.available ? 'available' : 'locked'}`;
    card.innerHTML = `
      <h2>${campaign.name}</h2>
      <p class="sub">${campaign.subtitle}</p>
      <p class="desc">${campaign.description}</p>
    `;
    if (campaign.available) {
      const actions = document.createElement('div');
      actions.className = 'card-actions';
      if (save) {
        const cont = document.createElement('button');
        cont.type = 'button';
        cont.className = 'primary';
        cont.textContent = 'Continue';
        cont.addEventListener('click', () => onContinue(campaign.id, save));
        const neu = document.createElement('button');
        neu.type = 'button';
        neu.textContent = 'New Game';
        neu.addEventListener('click', () => askNewGame(campaign.id));
        actions.append(cont, neu);
      } else {
        const begin = document.createElement('button');
        begin.type = 'button';
        begin.className = 'primary';
        begin.textContent = 'Begin';
        begin.addEventListener('click', () => onBegin(campaign.id));
        actions.append(begin);
      }
      card.append(actions);
    } else {
      const tag = document.createElement('div');
      tag.className = 'locked-tag';
      tag.textContent = 'Coming later';
      card.append(tag);
    }
    root.append(card);
  }
  focusFirstButton($('screen-menu'));
}

function askNewGame(campaignId) {
  $('confirm-text').textContent =
    'Start a new Destral campaign? This overwrites the save stored in this browser.';
  $('confirm-modal').dataset.campaignId = campaignId;
  show('confirm-modal', true);
  focusFirstButton($('confirm-modal'));
}

function updateGamepadBanner(input) {
  const el = $('gamepad-banner');
  const p1 = input.p1Pad;
  const p2 = input.p2Pad;
  if (p1 || p2) {
    el.classList.add('on');
    const bits = [];
    bits.push(p1 ? `P1 ${shortPadName(p1.id)}` : 'P1 keyboard');
    bits.push(p2 ? `P2 ${shortPadName(p2.id)}` : input.settings.p2Index === -1 ? 'P2 keyboard' : 'P2 open');
    el.textContent = bits.join(' · ');
  } else {
    el.classList.remove('on');
    el.textContent = 'Plug in controllers anytime. Assign them in Settings.';
  }
}

function shortPadName(id) {
  if (!id) return 'controller';
  return id.replace(/\s+\(.+\)$/, '').slice(0, 48);
}

export function handleOverlayNav(input) {
  if (input.pressed('uiUp') || input.pressed('uiLeft')) cycleOverlayFocus(-1);
  if (input.pressed('uiDown') || input.pressed('uiRight')) cycleOverlayFocus(1);
  if (input.pressed('confirm') || input.pressed('interact')) activateFocused();
  if (input.pressed('cancel') || input.pressed('pause')) {
    if (isSettingsOpen()) {
      closeSettings();
      return;
    }
    if (!$('confirm-modal').classList.contains('hidden')) {
      show('confirm-modal', false);
      focusFirstButton($('screen-menu'));
    }
  }
}

export function bindPause({ onResume, onSave, onExport, onMenu, onSettings }) {
  $('pause-resume').addEventListener('click', onResume);
  $('pause-save').addEventListener('click', onSave);
  $('pause-export').addEventListener('click', onExport);
  $('pause-settings').addEventListener('click', onSettings);
  $('pause-menu').addEventListener('click', onMenu);
}

export function isSettingsOpen() {
  return !!$('settings') && !$('settings').classList.contains('hidden');
}

export function openSettings() {
  refreshSettingsUi();
  show('settings', true);
  focusFirstButton($('settings'));
}

export function closeSettings() {
  show('settings', false);
}

export function bindSettings(settings) {
  settingsRef = settings;
  $('settings-back').addEventListener('click', () => closeSettings());
  $('opt-fullscreen').addEventListener('click', async () => {
    try {
      await setFullscreen(!isFullscreen());
    } catch {
      toast('Fullscreen was blocked by the browser.');
    }
    refreshSettingsUi();
  });
  $('opt-invert').addEventListener('click', () => {
    settings.invertY = !settings.invertY;
    saveSettings(settings);
    refreshSettingsUi();
  });
  $('opt-p1').addEventListener('click', () => {
    cycleAssignment(settings, 'p1');
    refreshSettingsUi();
  });
  $('opt-p2').addEventListener('click', () => {
    cycleAssignment(settings, 'p2');
    refreshSettingsUi();
  });
  $('opt-swap').addEventListener('click', () => {
    const a = settings.p1Index;
    let b = settings.p2Index;
    if (b === -2) b = -1;
    settings.p1Index = b;
    settings.p2Index = a < 0 ? -1 : a;
    saveSettings(settings);
    refreshSettingsUi();
    toast('Controllers swapped.');
  });
  window.addEventListener('gamepadconnected', () => {
    if (isSettingsOpen()) refreshSettingsUi();
  });
  window.addEventListener('gamepaddisconnected', () => {
    if (isSettingsOpen()) refreshSettingsUi();
  });
  document.addEventListener('fullscreenchange', () => {
    if (isSettingsOpen()) refreshSettingsUi();
  });
}

export function refreshSettingsUi() {
  if (!$('opt-fullscreen')) return;
  const settings = settingsRef;
  if (!settings) return;
  $('opt-fullscreen').textContent = isFullscreen() ? 'On' : 'Off';
  $('opt-invert').textContent = settings.invertY ? 'On' : 'Off';
  $('opt-p1').textContent = labelForSource('p1', settings.p1Index);
  $('opt-p2').textContent = labelForSource('p2', settings.p2Index);
}

function cycleAssignment(settings, who) {
  const opts = who === 'p1' ? p1Options() : p2Options();
  const cur = who === 'p1' ? settings.p1Index : settings.p2Index;
  const idx = Math.max(0, opts.findIndex((o) => o.value === cur));
  const next = opts[(idx + 1) % opts.length];
  if (who === 'p1') {
    if (next.value === settings.p2Index && next.value >= 0) {
      settings.p2Index = settings.p1Index;
    }
    settings.p1Index = next.value;
  } else {
    if (next.value === settings.p1Index && next.value >= 0) {
      settings.p1Index = settings.p2Index < 0 ? -1 : settings.p2Index;
    }
    settings.p2Index = next.value;
  }
  saveSettings(settings);
}

export function bindDeath(onContinue) {
  $('death-continue').addEventListener('click', onContinue);
}

export function updateHud(state) {
  const pct = Math.max(0, state.health / state.maxHealth) * 100;
  $('hp-fill').style.width = `${pct}%`;
  $('hp-lost').style.width = `${Math.max(pct, Number.parseFloat($('hp-lost').dataset.w || '100'))}%`;
  $('hp-lost').dataset.w = String(pct);
  $('hp-text').textContent = `${Math.ceil(state.health)} / ${state.maxHealth}`;
  $('exp-text').textContent = `EXP ${Math.floor(state.exp)}`;
  $('area-name').textContent = state.areaName;
  $('control-hint').textContent = state.usingGamepad
    ? 'A Talk · X Punch · Start Pause'
    : 'E Talk · Space Punch · Esc Pause';
  if (state.p2) {
    $('control-hint').textContent += state.usingGamepad
      ? ' · P2: stick aim · RT fire · Y heal'
      : ' · P2: arrows aim · C fire · V heal';
  }
  $('look-hint').classList.toggle('hidden', state.lookUsed);
  if (state.prompt) {
    $('interact-prompt').textContent = state.prompt;
    $('interact-prompt').classList.remove('hidden');
  } else {
    $('interact-prompt').classList.add('hidden');
  }
}

export function flashHurt() {
  const el = $('hurt-vignette');
  el.classList.add('on');
  clearTimeout(flashHurt._t);
  flashHurt._t = setTimeout(() => el.classList.remove('on'), 220);
}

export function setLoading(visible, title) {
  show('loading', visible);
  if (title) $('loading-title').textContent = title;
}

export function openDialogue(name, title, text, choices) {
  $('dialogue-name').textContent = name;
  $('dialogue-title').textContent = title || '';
  $('dialogue-text').textContent = text;
  const box = $('dialogue-choices');
  box.innerHTML = '';
  for (const choice of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = choice.label;
    btn.addEventListener('click', choice.onClick);
    box.append(btn);
  }
  show('dialogue', true);
  focusFirstButton($('dialogue'));
}

export function closeDialogue() {
  show('dialogue', false);
}

export function updateSpriteHud(hud, input) {
  const wrap = $('sprite-hud');
  const cursor = $('pixie-cursor');
  if (!wrap || !cursor) return;
  const showSprite = input.settings.p2Index !== -2 && !$('hud').classList.contains('hidden');
  wrap.classList.toggle('hidden', !showSprite);
  cursor.classList.toggle('hidden', !showSprite);
  if (!showSprite) return;

  const pips = $('bolt-pips');
  if (pips.childElementCount !== hud.maxBolts) {
    pips.innerHTML = '';
    for (let i = 0; i < hud.maxBolts; i++) {
      const pip = document.createElement('span');
      pip.className = 'bolt-pip';
      pips.append(pip);
    }
  }
  [...pips.children].forEach((pip, i) => {
    pip.classList.toggle('filled', i < hud.bolts);
    pip.classList.toggle('reloading', i === hud.bolts && hud.bolts < hud.maxBolts);
    if (i === hud.bolts && hud.bolts < hud.maxBolts) {
      pip.style.setProperty('--reload', `${hud.reload * 100}%`);
    }
  });

  const heal = $('heal-cd');
  if (hud.healCd <= 0) heal.textContent = 'Heal ready';
  else heal.textContent = `Heal ${Math.ceil(hud.healCd)}s`;
  heal.classList.toggle('ready', hud.healCd <= 0);

  cursor.style.left = `${input.aimX * 100}%`;
  cursor.style.top = `${input.aimY * 100}%`;
}
