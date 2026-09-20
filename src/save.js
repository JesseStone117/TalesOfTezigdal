import { PLAYER, SAVE_KEY, SAVE_VERSION } from './config.js';

export function emptyDestralSave() {
  return {
    version: SAVE_VERSION,
    campaignId: 'destral',
    savedAt: Date.now(),
    data: {
      area: 'village',
      position: { x: 0, y: 0, z: -6.5 },
      rotationY: 0,
      health: PLAYER.maxHealth,
      maxHealth: PLAYER.maxHealth,
      exp: 0,
      defeated: [],
      talked: [],
      bossDefeated: false,
      secretOpened: false,
      playTime: 0,
    },
  };
}

export function loadAllSaves() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getSave(campaignId) {
  const save = loadAllSaves()[campaignId];
  return save ? normalizeSave(save) : null;
}

export function writeSave(save) {
  const normalized = normalizeSave(save);
  normalized.savedAt = Date.now();
  const all = loadAllSaves();
  all[normalized.campaignId] = normalized;
  localStorage.setItem(SAVE_KEY, JSON.stringify(all));
  return normalized;
}

export function deleteSave(campaignId) {
  const all = loadAllSaves();
  delete all[campaignId];
  localStorage.setItem(SAVE_KEY, JSON.stringify(all));
}

export function exportSave(campaignId) {
  const save = getSave(campaignId);
  if (!save) return false;
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tales-of-tezigdal-${campaignId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function importSaveText(text) {
  const save = JSON.parse(text);
  if (!save || typeof save !== 'object') throw new Error('Not a save file.');
  if (save.version !== SAVE_VERSION) throw new Error('Unsupported save version.');
  if (!save.campaignId || !save.data) throw new Error('Save is missing campaign data.');
  return writeSave(save);
}

export function normalizeSave(save) {
  const base = emptyDestralSave();
  const campaignId = save.campaignId || 'destral';
  const data = { ...base.data, ...(save.data || {}) };
  if (data.area !== 'village' && data.area !== 'cave') data.area = 'village';
  if (!data.position || typeof data.position.x !== 'number') {
    data.position = { ...base.data.position };
  }
  if (!Array.isArray(data.defeated)) data.defeated = [];
  if (!Array.isArray(data.talked)) data.talked = [];
  if (typeof data.health !== 'number' || data.health <= 0) data.health = data.maxHealth || PLAYER.maxHealth;
  if (typeof data.maxHealth !== 'number') data.maxHealth = PLAYER.maxHealth;
  if (typeof data.exp !== 'number') data.exp = 0;
  if (typeof data.playTime !== 'number') data.playTime = 0;
  data.bossDefeated = !!data.bossDefeated;
  data.secretOpened = !!data.secretOpened;
  return {
    version: SAVE_VERSION,
    campaignId,
    savedAt: save.savedAt || Date.now(),
    data,
  };
}
