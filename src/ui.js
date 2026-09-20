import { GAME_VERSION } from './config.js';
import { CAMPAIGNS } from './campaigns.js';
import { exportSave, getSave, importSaveText } from './save.js';
import {
  activateFocused,
  cycleOverlayFocus,
  focusFirstButton,
} from './input.js';
import { $ } from './utils.js';

export { focusFirstButton };

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
  if (input.gamepad) {
    el.classList.add('on');
    el.textContent = `Gamepad ready: ${shortPadName(input.gamepadName)}`;
  } else {
    el.classList.remove('on');
    el.textContent = 'Plug in a controller anytime. Keyboard and mouse work too.';
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
    if (!$('confirm-modal').classList.contains('hidden')) {
      show('confirm-modal', false);
      focusFirstButton($('screen-menu'));
    }
  }
}

export function bindPause({ onResume, onSave, onExport, onMenu }) {
  $('pause-resume').addEventListener('click', onResume);
  $('pause-save').addEventListener('click', onSave);
  $('pause-export').addEventListener('click', onExport);
  $('pause-menu').addEventListener('click', onMenu);
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
