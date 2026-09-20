import * as THREE from 'three';
import { PLAYER } from './config.js';
import { CameraRig } from './camera.js';
import { CAMPAIGNS } from './campaigns.js';
import { rumble } from './input.js';
import { Player } from './player.js';
import { emptyDestralSave, exportSave, writeSave } from './save.js';
import {
  bindDeath,
  bindPause,
  closeDialogue,
  flashHurt,
  focusFirstButton,
  handleOverlayNav,
  openDialogue,
  setFade,
  setLoading,
  show,
  toast,
  updateHud,
} from './ui.js';
import { $, wait } from './utils.js';
import { createCave } from './world/cave.js';
import { createVillage } from './world/village.js';

export class Game {
  constructor({ canvas, input }) {
    this.canvas = canvas;
    this.input = input;
    this.mode = 'off';
    this.paused = false;
    this.talking = false;
    this.transitioning = false;
    this.world = null;
    this.save = null;
    this.campaignId = null;
    this.autosave = 0;
    this.insideTrigger = new Set();
    this.toast = toast;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.12, 220);
    this.clock = new THREE.Clock();
    this.player = new Player(this.scene, input);
    this.rig = new CameraRig(this.camera, this.player, input);

    this.player.onHurt = () => flashHurt();
    this.player.onDeath = () => this.onPlayerDeath();
    this.player.onPunch = () => this.resolvePunch();

    bindPause({
      onResume: () => this.setPaused(false),
      onSave: () => this.saveNow(true),
      onExport: () => {
        this.saveNow(false);
        exportSave(this.campaignId);
        toast('Save exported.');
      },
      onMenu: () => this.returnToMenu(),
    });
    bindDeath(() => this.respawnVillage());

    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('click', () => {
      if (this.mode === 'play' && !this.paused && !this.talking) {
        canvas.requestPointerLock?.();
      }
    });
  }

  async start(campaignId, save) {
    this.campaignId = campaignId;
    this.save = save ? structuredClone(save) : emptyDestralSave();
    const campaign = CAMPAIGNS.find((c) => c.id === campaignId);
    setLoading(true, campaignId === 'destral' ? 'Entering Hollowrest…' : 'Loading…');
    show('hud', false);
    try {
      if (!this.player.ready) await this.player.load(campaign.modelUrl);
    } catch (err) {
      setLoading(false);
      show('screen-menu', true);
      toast(err?.message || 'Failed to load the Destral model.');
      throw err;
    }
    this.player.health = this.save.data.health;
    this.player.maxHealth = this.save.data.maxHealth;
    this.player.exp = this.save.data.exp;
    this.player.dead = false;
    await this.loadArea(this.save.data.area, { fromSave: true });
    this.mode = 'play';
    this.paused = false;
    this.talking = false;
    this.clock.getDelta();
    show('hud', true);
    setLoading(false);
    setFade(false);
  }

  async loadArea(areaId, opts = {}) {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.group.traverse((n) => {
        if (n.geometry) n.geometry.dispose?.();
      });
      this.world = null;
    }
    this.insideTrigger.clear();
    this.world = areaId === 'cave' ? createCave(this.save.data) : createVillage();
    this.scene.add(this.world.group);
    this.world.applySky(this.scene);
    this.player.lantern.visible = !!this.world.lantern;
    this.save.data.area = this.world.id;

    let spawn = this.world.spawn;
    if (opts.fromSave && this.save.data.position) {
      spawn = {
        x: this.save.data.position.x,
        z: this.save.data.position.z,
        yaw: this.save.data.rotationY || 0,
      };
    } else if (opts.via === 'cave' && this.world.caveReturn) {
      spawn = this.world.caveReturn;
    }
    const y = this.world.heightAt(spawn.x, spawn.z);
    this.player.setPose(spawn.x, y, spawn.z, spawn.yaw);
    this.player.lockAnim = false;
    this.player.attacking = false;
    this.player.playLoop('Idle', 0);
    this.rig.resetBehindPlayer();
    this.rig.snap();
  }

  async changeArea(areaId, opts = {}) {
    if (this.transitioning) return;
    this.transitioning = true;
    document.exitPointerLock?.();
    setFade(true);
    await wait(280);
    this.capturePlayer();
    await this.loadArea(areaId, opts);
    this.saveNow(false);
    await wait(60);
    setFade(false);
    this.transitioning = false;
  }

  capturePlayer() {
    this.save.data.position = { x: this.player.x, y: this.player.y, z: this.player.z };
    this.save.data.rotationY = this.player.yaw;
    this.save.data.health = this.player.health;
    this.save.data.maxHealth = this.player.maxHealth;
    this.save.data.exp = this.player.exp;
    this.save.data.area = this.world?.id || this.save.data.area;
  }

  saveNow(announce) {
    this.capturePlayer();
    writeSave(this.save);
    if (announce) toast('Game saved.');
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.mode !== 'play') return;

    if (this.talking) {
      handleOverlayNav(this.input);
      if (this.input.pressed('cancel') || this.input.pressed('pause')) this.closeTalk();
      this.player.mixer?.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.drawHud();
      return;
    }

    if (this.input.pressed('pause') && !this.player.dead && !this.transitioning) {
      this.setPaused(!this.paused);
    } else if (this.paused && this.input.pressed('cancel')) {
      this.setPaused(false);
    }

    if (this.paused) {
      handleOverlayNav(this.input);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.player.dead) {
      handleOverlayNav(this.input);
      this.player.mixer?.update(dt);
      this.world?.update(dt, this);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.transitioning) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.save.data.playTime += dt;
    this.autosave += dt;
    if (this.autosave > 45) {
      this.autosave = 0;
      this.saveNow(false);
    }

    this.player.update(dt, this.world, this.rig.yaw);
    this.world.update(dt, this);
    this.separateEnemies();
    this.rig.update(dt, this.world);
    this.handleInteract();
    this.handleTriggers();
    this.drawHud();
    this.renderer.render(this.scene, this.camera);
  }

  drawHud() {
    updateHud({
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      exp: this.player.exp,
      areaName: this.world?.name || '',
      usingGamepad: this.input.usingGamepad,
      lookUsed: this.input.lookUsed,
      prompt: this.nearestInteractable()?.prompt?.(this.input.usingGamepad) ?? '',
    });
  }

  nearestInteractable() {
    if (!this.world) return null;
    let best = null;
    let bestD = 99;
    for (const item of this.world.interactables) {
      const d = Math.hypot(item.x - this.player.x, item.z - this.player.z);
      if (d < item.radius && d < bestD) {
        best = item;
        bestD = d;
      }
    }
    return best;
  }

  handleInteract() {
    if (!this.player.tryInteract()) return;
    const item = this.nearestInteractable();
    if (!item) return;
    this.player.playInteract();
    item.use(this);
  }

  handleTriggers() {
    for (const trigger of this.world.triggers) {
      const inside = Math.hypot(trigger.x - this.player.x, trigger.z - this.player.z) < trigger.radius;
      const was = this.insideTrigger.has(trigger.id);
      if (inside && !was) {
        this.insideTrigger.add(trigger.id);
        trigger.run(this);
      } else if (!inside && was) {
        this.insideTrigger.delete(trigger.id);
      }
    }
  }

  resolvePunch() {
    const fwd = this.player.forward();
    for (const enemy of this.world.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - this.player.x;
      const dz = enemy.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > PLAYER.punchRange + enemy.radius) continue;
      const dirx = dx / (dist || 1);
      const dirz = dz / (dist || 1);
      if (dirx * fwd.x + dirz * fwd.z < PLAYER.punchCone) continue;
      const killed = enemy.takeDamage(PLAYER.punchDamage, this.player.x, this.player.z);
      rumble(this.input, 0.35, 80);
      if (killed) {
        this.player.exp += enemy.exp;
        this.save.data.defeated = Array.from(new Set([...(this.save.data.defeated || []), enemy.id]));
        if (enemy.boss) {
          this.save.data.bossDefeated = true;
          toast('The cave-wight is slain. Hollowrest is safer — for now.');
        } else {
          toast(`+${enemy.exp} EXP`);
        }
      }
    }
  }

  separateEnemies() {
    const list = this.world.enemies.filter((e) => !e.dead);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (d < min && d > 0.001) {
          const push = (min - d) * 0.5;
          a.group.position.x -= (dx / d) * push;
          a.group.position.z -= (dz / d) * push;
          b.group.position.x += (dx / d) * push;
          b.group.position.z += (dz / d) * push;
        }
      }
    }
  }

  openNpc(npc) {
    this.talking = true;
    document.exitPointerLock?.();
    const talked = new Set(this.save.data.talked || []);
    talked.add(npc.id);
    this.save.data.talked = [...talked];
    const greeting = this.save.data.bossDefeated && npc.afterBoss ? npc.afterBoss : npc.greeting;
    this.showTalk(npc, greeting);
  }

  showTalk(npc, text) {
    const choices = npc.topics.map((topic) => ({
      label: topic.prompt,
      onClick: () => this.showTalk(npc, topic.lines.join('\n\n')),
    }));
    choices.push({
      label: 'Leave',
      onClick: () => this.closeTalk(),
    });
    openDialogue(npc.name, npc.title, text, choices);
  }

  closeTalk() {
    this.talking = false;
    closeDialogue();
  }

  setPaused(paused) {
    this.paused = paused;
    show('pause', paused);
    if (paused) {
      document.exitPointerLock?.();
      this.capturePlayer();
      $('pause-sub').textContent = `${this.world?.name || ''} · EXP ${Math.floor(this.player.exp)}`;
      focusFirstButton($('pause'));
    }
  }

  onPlayerDeath() {
    document.exitPointerLock?.();
    show('death', true);
    focusFirstButton($('death'));
  }

  async respawnVillage() {
    show('death', false);
    setFade(true);
    await wait(250);
    this.player.dead = false;
    this.player.lockAnim = false;
    await this.loadArea('village');
    this.player.revive(this.world.spawn.x, this.world.spawn.z, this.world.spawn.yaw, this.world);
    this.player.health = this.player.maxHealth;
    setFade(false);
    toast('You wake beside the well.');
  }

  async returnToMenu() {
    this.saveNow(false);
    this.setPaused(false);
    this.mode = 'off';
    document.exitPointerLock?.();
    show('hud', false);
    show('dialogue', false);
    show('death', false);
    setFade(true);
    await wait(220);
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world = null;
    }
    this.onMenu?.();
  }

  stop() {
    this.mode = 'off';
    this.paused = false;
    this.talking = false;
    show('hud', false);
    show('pause', false);
    show('dialogue', false);
    show('death', false);
    document.exitPointerLock?.();
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
