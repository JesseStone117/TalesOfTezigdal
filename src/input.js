import { unlockAudio } from './audio.js';
import { INPUT, SPRITE } from './config.js';
import { padByIndex } from './settings.js';

const KEY_BIND = {
  Space: 'punch',
  KeyE: 'interact',
  KeyF: 'interact',
  Enter: 'confirm',
  Escape: 'pause',
  KeyP: 'pause',
};

export class Input {
  constructor(settings) {
    this.settings = settings;
    this.moveX = 0;
    this.moveY = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.usingGamepad = false;
    this.gamepadName = '';
    this.pointerLocked = false;
    this.lookUsed = false;
    this._ignoreLook = 0;

    this.aimX = 0.62;
    this.aimY = 0.42;
    this.p2Fire = false;
    this.p2Heal = false;
    this.p2Active = false;

    this._keys = new Set();
    this._held = new Set();
    this._pressed = new Set();
    this._released = new Set();
    this._mouseDelta = { x: 0, y: 0 };
    this._rightMouse = false;
    this._uiClock = { up: 0, down: 0, left: 0, right: 0 };
    this._prevP1 = {};
    this._prevP2 = {};

    window.addEventListener('keydown', (e) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      unlockAudio();
      this._keys.add(e.code);
      const bind = KEY_BIND[e.code];
      if (bind) this._pressed.add(bind);
      if (e.code === 'KeyC' || e.code === 'ControlLeft') this._pressed.add('p2fire');
      if (e.code === 'KeyV' || e.code === 'KeyH') this._pressed.add('p2heal');
      this.usingGamepad = false;
    });

    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
      const bind = KEY_BIND[e.code];
      if (bind) this._released.add(bind);
    });

    window.addEventListener('mousedown', (e) => {
      unlockAudio();
      if (e.button === 0 && document.pointerLockElement) this._pressed.add('punch');
      if (e.button === 2) this._rightMouse = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._released.add('punch');
      if (e.button === 2) this._rightMouse = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked || this._rightMouse) {
        this._mouseDelta.x += e.movementX;
        this._mouseDelta.y += e.movementY;
        if (e.movementX || e.movementY) this.lookUsed = true;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement != null;
      if (locked && !this.pointerLocked) this._ignoreLook = 3;
      this.pointerLocked = locked;
    });

    window.addEventListener('gamepadconnected', () => {
      this.usingGamepad = true;
    });

    window.addEventListener('blur', () => {
      this._keys.clear();
      this.moveX = 0;
      this.moveY = 0;
    });
  }

  get gamepad() {
    return this.p1Pad;
  }

  get p1Pad() {
    return padByIndex(this.settings.p1Index);
  }

  get p2Pad() {
    if (this.settings.p2Index < 0) return null;
    return padByIndex(this.settings.p2Index);
  }

  pressed(name) {
    return this._pressed.has(name);
  }

  held(name) {
    return this._held.has(name);
  }

  endFrame() {
    this._pressed.clear();
    this._released.clear();
  }

  update(dt) {
    this.lookX = 0;
    this.lookY = 0;
    this.p2Fire = false;
    this.p2Heal = false;

    let mx = 0;
    let my = 0;
    if (this._keys.has('KeyW')) my -= 1;
    if (this._keys.has('KeyS')) my += 1;
    if (this._keys.has('KeyA')) mx -= 1;
    if (this._keys.has('KeyD')) mx += 1;

    if (this._keys.has('Space')) this._held.add('punch');
    else this._held.delete('punch');
    if (this._keys.has('KeyE') || this._keys.has('KeyF')) this._held.add('interact');
    else this._held.delete('interact');
    if (this._keys.has('Enter')) this._held.add('confirm');
    else this._held.delete('confirm');

    if (this._ignoreLook > 0) {
      this._ignoreLook -= 1;
      this._mouseDelta.x = 0;
      this._mouseDelta.y = 0;
    }
    this.lookX += this._mouseDelta.x;
    this.lookY += this._mouseDelta.y;
    this._mouseDelta.x = 0;
    this._mouseDelta.y = 0;

    const p1 = this.p1Pad;
    if (p1) {
      if (p1.buttons?.some((b) => b.pressed)) unlockAudio();
      this.usingGamepad = true;
      this.gamepadName = p1.id;
      const lx = axis(p1.axes[0]);
      const ly = axis(p1.axes[1]);
      const rx = axis(p1.axes[2]);
      const ry = axis(p1.axes[3]);
      if (Math.hypot(lx, ly) > Math.hypot(mx, my)) {
        mx = lx;
        my = ly;
      }
      this.lookX += rx * 18;
      this.lookY += ry * 18;
      if (Math.abs(rx) > 0.2 || Math.abs(ry) > 0.2) this.lookUsed = true;
      pollPad(this, p1, this._prevP1, {
        0: ['interact', 'confirm'],
        1: ['cancel'],
        2: ['punch'],
        7: ['punch'],
        8: ['pause'],
        9: ['pause'],
      });
      const du = p1.buttons[12]?.pressed || ly < -0.55;
      const dd = p1.buttons[13]?.pressed || ly > 0.55;
      const dl = p1.buttons[14]?.pressed || lx < -0.55;
      const dr = p1.buttons[15]?.pressed || lx > 0.55;
      pulseUi(this, 'up', du, dt);
      pulseUi(this, 'down', dd, dt);
      pulseUi(this, 'left', dl, dt);
      pulseUi(this, 'right', dr, dt);
    } else {
      this.gamepadName = '';
    }

    const overlayOpen = !!document.querySelector('.overlay:not(.hidden)');
    if (overlayOpen && !p1) {
      pulseUi(this, 'up', this._keys.has('ArrowUp'), dt);
      pulseUi(this, 'down', this._keys.has('ArrowDown'), dt);
      pulseUi(this, 'left', this._keys.has('ArrowLeft'), dt);
      pulseUi(this, 'right', this._keys.has('ArrowRight'), dt);
    }

    let p2x = 0;
    let p2y = 0;
    const p2Pad = this.p2Pad;
    if (this.settings.p2Index !== -2 && !overlayOpen) {
      if (this._keys.has('ArrowLeft')) p2x -= 1;
      if (this._keys.has('ArrowRight')) p2x += 1;
      if (this._keys.has('ArrowUp')) p2y -= 1;
      if (this._keys.has('ArrowDown')) p2y += 1;
      if (this._keys.has('KeyC') || this._keys.has('ControlLeft')) this.p2Fire = true;
      if (this.pressed('p2fire')) this.p2Fire = true;
      if (this.pressed('p2heal')) this.p2Heal = true;
    }

    if (p2Pad) {
      const lx = axis(p2Pad.axes[0]);
      const ly = axis(p2Pad.axes[1]);
      const rx = axis(p2Pad.axes[2]);
      const ry = axis(p2Pad.axes[3]);
      if (Math.abs(lx) > Math.abs(p2x)) p2x = lx;
      if (Math.abs(ly) > Math.abs(p2y)) p2y = ly;
      if (Math.abs(rx) > 0.2) p2x = rx;
      if (Math.abs(ry) > 0.2) p2y = ry;
      const prevFire = !!this._prevP2.fire;
      const prevHeal = !!this._prevP2.heal;
      const fire = !!(p2Pad.buttons[7]?.pressed || p2Pad.buttons[0]?.pressed || p2Pad.buttons[2]?.pressed || p2Pad.buttons[5]?.pressed);
      const heal = !!(p2Pad.buttons[3]?.pressed || p2Pad.buttons[4]?.pressed);
      if (fire) this.p2Fire = true;
      if (heal && !prevHeal) this.p2Heal = true;
      this._prevP2.fire = fire;
      this._prevP2.heal = heal;
      pollPad(this, p2Pad, this._prevP2, {
        8: ['pause'],
        9: ['pause'],
      });
      this.p2Active = true;
    } else {
      this._prevP2 = {};
      this.p2Active = this.settings.p2Index !== -2;
    }

    if (this.settings.p2Index !== -2) {
      const mag = Math.hypot(p2x, p2y);
      if (mag > 1) {
        p2x /= mag;
        p2y /= mag;
      }
      this.aimX = clamp01(this.aimX + p2x * SPRITE.cursorSpeed * dt);
      this.aimY = clamp01(this.aimY + p2y * SPRITE.cursorSpeed * dt);
    }

    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    this.moveX = mx;
    this.moveY = my;
  }
}

function axis(v) {
  if (v == null) return 0;
  return Math.abs(v) < INPUT.deadzone ? 0 : v;
}

function clamp01(v) {
  return Math.max(0.03, Math.min(0.97, v));
}

function pollPad(input, pad, prev, map) {
  for (const [idx, names] of Object.entries(map)) {
    const down = !!pad.buttons[Number(idx)]?.pressed;
    const was = !!prev[idx];
    if (down && !was) {
      for (const name of names) input._pressed.add(name);
    }
    if (down) {
      for (const name of names) input._held.add(name);
    } else if (was) {
      for (const name of names) input._held.delete(name);
    }
    prev[idx] = down;
  }
}

function pulseUi(input, dir, held, dt) {
  const clock = input._uiClock;
  if (!held) {
    clock[dir] = 0;
    return;
  }
  if (clock[dir] === 0) {
    input._pressed.add('ui' + dir[0].toUpperCase() + dir.slice(1));
    clock[dir] = 0.0001;
    return;
  }
  clock[dir] += dt;
  if (clock[dir] >= INPUT.uiRepeat) {
    input._pressed.add('ui' + dir[0].toUpperCase() + dir.slice(1));
    clock[dir] = 0.0001;
  }
}

export function rumble(input, mag = 0.45, ms = 140) {
  const gp = input.p1Pad;
  const actuator = gp?.vibrationActuator;
  if (!actuator?.playEffect) return;
  actuator.playEffect('dual-rumble', {
    startDelay: 0,
    duration: ms,
    weakMagnitude: mag,
    strongMagnitude: mag,
  }).catch(() => {});
}

export function cycleOverlayFocus(dir) {
  const overlay = [...document.querySelectorAll('.overlay:not(.hidden)')].at(-1);
  if (!overlay) return;
  const nodes = [...overlay.querySelectorAll('button:not([disabled])')];
  if (!nodes.length) return;
  let i = nodes.indexOf(document.activeElement);
  if (i < 0) i = dir > 0 ? -1 : 0;
  i = (i + dir + nodes.length) % nodes.length;
  nodes[i].focus();
}

export function activateFocused() {
  const overlay = [...document.querySelectorAll('.overlay:not(.hidden)')].at(-1);
  if (!overlay) return;
  const active = overlay.querySelector('button:focus');
  (active ?? overlay.querySelector('button:not([disabled])'))?.click();
}

export function focusFirstButton(root) {
  root?.querySelector('button:not([disabled])')?.focus();
}
