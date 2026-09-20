import { INPUT } from './config.js';

const KEY_BIND = {
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'punch',
  KeyE: 'interact',
  KeyF: 'interact',
  Enter: 'confirm',
  Escape: 'pause',
  KeyP: 'pause',
};

export class Input {
  constructor() {
    this.moveX = 0;
    this.moveY = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.usingGamepad = false;
    this.gamepadName = '';
    this.padIndex = null;
    this.pointerLocked = false;
    this.lookUsed = false;
    this._ignoreLook = 0;

    this._keys = new Set();
    this._held = new Set();
    this._pressed = new Set();
    this._released = new Set();
    this._mouseDelta = { x: 0, y: 0 };
    this._rightMouse = false;
    this._uiClock = { up: 0, down: 0, left: 0, right: 0 };
    this._prevPad = {};

    window.addEventListener('keydown', (e) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      this._keys.add(e.code);
      const bind = KEY_BIND[e.code];
      if (bind) this._pressed.add(bind);
      this.usingGamepad = false;
    });

    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
      const bind = KEY_BIND[e.code];
      if (bind) this._released.add(bind);
    });

    window.addEventListener('mousedown', (e) => {
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

    window.addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      this.gamepadName = e.gamepad.id;
      this.usingGamepad = true;
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.padIndex === e.gamepad.index) {
        this.padIndex = null;
        this.gamepadName = '';
      }
    });

    this._onBlur = () => {
      this._keys.clear();
      this.moveX = 0;
      this.moveY = 0;
    };
    window.addEventListener('blur', this._onBlur);
  }

  get gamepad() {
    const pads = navigator.getGamepads?.() ?? [];
    if (this.padIndex != null && pads[this.padIndex]) return pads[this.padIndex];
    return pads.find(Boolean) ?? null;
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

    let mx = 0;
    let my = 0;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) my -= 1;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) my += 1;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) mx -= 1;
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) mx += 1;

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

    const pad = this.gamepad;
    if (pad) {
      this.padIndex = pad.index;
      this.gamepadName = pad.id;
      const lx = axis(pad.axes[0]);
      const ly = axis(pad.axes[1]);
      const rx = axis(pad.axes[2]);
      const ry = axis(pad.axes[3]);
      if (Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0.2) {
        this.usingGamepad = true;
      }
      if (Math.hypot(lx, ly) > Math.hypot(mx, my)) {
        mx = lx;
        my = ly;
      }
      this.lookX += rx * 18;
      this.lookY += ry * 18;
      if (Math.abs(rx) > 0.2 || Math.abs(ry) > 0.2) this.lookUsed = true;

      const padButtons = {
        0: ['interact', 'confirm'],
        1: ['cancel'],
        2: ['punch'],
        7: ['punch'],
        8: ['pause'],
        9: ['pause'],
      };
      for (const [idx, names] of Object.entries(padButtons)) {
        const down = !!pad.buttons[Number(idx)]?.pressed;
        const prev = !!this._prevPad[idx];
        if (down && !prev) {
          for (const name of names) this._pressed.add(name);
          this.usingGamepad = true;
        }
        if (down) {
          for (const name of names) this._held.add(name);
        } else if (prev) {
          for (const name of names) this._held.delete(name);
        }
        this._prevPad[idx] = down;
      }

      const du = pad.buttons[12]?.pressed || ly < -0.55;
      const dd = pad.buttons[13]?.pressed || ly > 0.55;
      const dl = pad.buttons[14]?.pressed || lx < -0.55;
      const dr = pad.buttons[15]?.pressed || lx > 0.55;
      pulseUi(this, 'up', du, dt);
      pulseUi(this, 'down', dd, dt);
      pulseUi(this, 'left', dl, dt);
      pulseUi(this, 'right', dr, dt);
    } else {
      pulseUi(this, 'up', this._keys.has('ArrowUp'), dt);
      pulseUi(this, 'down', this._keys.has('ArrowDown'), dt);
      pulseUi(this, 'left', this._keys.has('ArrowLeft'), dt);
      pulseUi(this, 'right', this._keys.has('ArrowRight'), dt);
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
  const gp = input.gamepad;
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
