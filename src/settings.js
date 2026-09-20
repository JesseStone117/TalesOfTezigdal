export const SETTINGS_KEY = 'talesOfTezigdal.settings';

export function defaultSettings() {
  return {
    invertY: true,
    p1Index: 0,
    p2Index: 1,
  };
}

export function loadSettings() {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    return {
      invertY: parsed.invertY !== false,
      p1Index: Number.isInteger(parsed.p1Index) ? parsed.p1Index : 0,
      p2Index: Number.isInteger(parsed.p2Index) ? parsed.p2Index : 1,
    };
  } catch {
    return base;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function connectedPads() {
  return [...(navigator.getGamepads?.() ?? [])].filter(Boolean);
}

export function padByIndex(index) {
  if (index == null || index < 0) return null;
  return navigator.getGamepads?.()[index] ?? null;
}

export function shortPadName(id) {
  if (!id) return 'Controller';
  return id.replace(/\s+\(.+\)$/, '').replace(/\(.*?\)/g, '').trim().slice(0, 36) || 'Controller';
}

export function p1Options() {
  const opts = [{ value: -1, label: 'Keyboard & Mouse' }];
  for (const pad of connectedPads()) {
    opts.push({ value: pad.index, label: `P${pad.index + 1} · ${shortPadName(pad.id)}` });
  }
  return opts;
}

export function p2Options() {
  const opts = [
    { value: -1, label: 'Keyboard (arrows)' },
    { value: -2, label: 'None' },
  ];
  for (const pad of connectedPads()) {
    opts.push({ value: pad.index, label: `P${pad.index + 1} · ${shortPadName(pad.id)}` });
  }
  return opts;
}

export function labelForSource(which, index) {
  if (which === 'p1') {
    if (index < 0) return 'Keyboard & Mouse';
  } else if (index === -2) return 'None';
  else if (index < 0) return 'Keyboard (arrows)';
  const pad = padByIndex(index);
  if (pad) return `P${pad.index + 1} · ${shortPadName(pad.id)}`;
  return index >= 0 ? `Controller ${index + 1} (unplugged)` : 'Keyboard';
}

export async function setFullscreen(on) {
  try {
    if (on && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else if (!on && document.fullscreenElement) {
      await document.exitFullscreen?.();
    }
  } catch (err) {
    throw err;
  }
}

export function isFullscreen() {
  return document.fullscreenElement != null;
}
