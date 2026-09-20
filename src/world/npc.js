import { angleLerp } from '../utils.js';
import { makeNpcMesh } from './props.js';

export class Npc {
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.title = def.title;
    this.greeting = def.greeting;
    this.topics = def.topics;
    this.afterBoss = def.afterBoss;
    this.radius = 0.55;
    this.group = makeNpcMesh(def.color, def.accent);
    this.group.position.set(def.x, 0, def.z);
    this.baseY = 0;
    this.phase = Math.random() * Math.PI * 2;
  }

  get x() {
    return this.group.position.x;
  }

  get z() {
    return this.group.position.z;
  }

  update(dt, player, heightAt) {
    const ground = heightAt(this.x, this.z);
    this.group.position.y = ground + Math.sin(this.phase + performance.now() * 0.002) * 0.02;
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    if (Math.hypot(dx, dz) < 8) {
      const yaw = Math.atan2(dx, dz);
      this.group.rotation.y = angleLerp(this.group.rotation.y, yaw, 1 - Math.pow(0.001, dt));
    }
  }
}
