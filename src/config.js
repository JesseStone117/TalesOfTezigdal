export const GAME_VERSION = '0.1.0';
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'talesOfTezigdal.saves';

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 6.2,
  rotateSpeed: 10,
  radius: 0.38,
  height: 1.8,
  punchDamage: 20,
  punchRange: 1.85,
  punchCone: 0.2,
  maxHealth: 100,
  invulnTime: 0.7,
  stepHeight: 0.7,
};

export const CAMERA = {
  distance: 6.4,
  height: 2.15,
  lookHeight: 1.35,
  minPitch: -0.55,
  maxPitch: 0.85,
  mouseSens: 0.0022,
  padSens: 2.4,
  lerp: 12,
};

export const INPUT = {
  deadzone: 0.18,
  uiRepeat: 0.22,
};

export const COMBAT = {
  gruntHealth: 40,
  gruntDamage: 12,
  gruntSpeed: 2.6,
  gruntAggro: 9,
  gruntLeash: 18,
  gruntExp: 15,
  bossHealth: 170,
  bossDamage: 22,
  bossSpeed: 2.1,
  bossAggro: 14,
  bossLeash: 28,
  bossExp: 100,
  hitStun: 0.28,
};

export const COLORS = {
  grass: 0x4f7a3c,
  grassDark: 0x35562c,
  dirt: 0x8a6a3b,
  path: 0xc2a074,
  rock: 0x6a6764,
  rockDark: 0x3c3a39,
  snow: 0xe7eef6,
  plaster: 0xe6d5bd,
  timber: 0x5a3a22,
  thatch: 0x8a6a32,
  water: 0x3a6e8a,
  sky: 0x87a7c7,
  cave: 0x0c0a0e,
};
