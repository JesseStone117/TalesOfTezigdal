import { Game } from './game.js';
import { Input } from './input.js';
import { emptyDestralSave, writeSave } from './save.js';
import { bindMenu, setFade, show } from './ui.js';
import { $ } from './utils.js';

const canvas = $('gl');
const input = new Input();
const game = new Game({ canvas, input });
window.__tot = {
  game,
  input,
  get screen() {
    return screen;
  },
};

let screen = 'menu';

const menu = bindMenu({
  input,
  onBegin: (campaignId) => bootCampaign(campaignId, emptyDestralSave()),
  onContinue: (campaignId, save) => bootCampaign(campaignId, save),
});

game.onMenu = () => {
  screen = 'menu';
  game.stop();
  menu.refresh();
  show('screen-menu', true);
  setFade(false);
};

async function bootCampaign(campaignId, save) {
  show('confirm-modal', false);
  show('screen-menu', false);
  setFade(true);
  writeSave(save);
  screen = 'play';
  try {
    await game.start(campaignId, save);
  } catch (err) {
    screen = 'menu';
    show('screen-menu', true);
    setFade(false);
    console.error(err);
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = 1 / 60;
  input.update(dt);
  if (screen === 'menu') menu.update(dt);
  else game.update();
  input.endFrame();
}

frame();

if (import.meta.hot) {
  import.meta.hot.accept();
}
