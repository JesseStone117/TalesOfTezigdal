import punchHitUrl from '../assets/audio/Destral/basic-attack.mp3?url';

let ctx = null;
let punchBuffer = null;
let loadPromise = null;

function getContext() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockAudio() {
  const audio = getContext();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  if (!loadPromise) loadPromise = loadPunch();
}

async function loadPunch() {
  try {
    const audio = getContext();
    const res = await fetch(punchHitUrl);
    punchBuffer = await audio.decodeAudioData(await res.arrayBuffer());
  } catch (err) {
    console.warn('Could not load punch sound.', err);
  }
}

export function playPunchHit() {
  unlockAudio();
  const audio = getContext();
  if (!punchBuffer) {
    loadPromise?.then(() => playPunchHit());
    return;
  }
  if (audio.state === 'suspended') {
    audio.resume().then(() => startPunch()).catch(() => {});
    return;
  }
  startPunch();
}

function startPunch() {
  if (!ctx || !punchBuffer) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.85;
  src.buffer = punchBuffer;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}

window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
