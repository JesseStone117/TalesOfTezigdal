import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAMERA, PLAYER } from './config.js';
import { rumble } from './input.js';
import { angleLerp, clamp } from './utils.js';

export class Player {
  constructor(scene, input) {
    this.scene = scene;
    this.input = input;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.ready = false;
    this.mixer = null;
    this.actions = {};
    this.currentName = '';
    this.lockAnim = false;
    this.attacking = false;
    this.dead = false;
    this.health = PLAYER.maxHealth;
    this.maxHealth = PLAYER.maxHealth;
    this.exp = 0;
    this.invuln = 0;
    this.punchSide = 0;
    this.hitArmed = false;
    this.attackAge = 0;
    this.attackHitAt = 0.28;
    this.attackEndAt = 0.7;
    this.yaw = 0;
    this.onHurt = null;
    this.onDeath = null;
    this.onPunch = null;
    this.lantern = new THREE.PointLight(0xffe0b0, 5.2, 16, 1.6);
    this.lantern.position.set(0.25, 1.5, 0.2);
    this.lantern.visible = false;
    this.group.add(this.lantern);
    this.healLeft = 0;
    this.healRate = 0;
    this.onKill = null;
    this.healGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x66c8ff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.healGlow.position.y = 0.95;
    this.healGlow.visible = false;
    this.healLight = new THREE.PointLight(0x7ad4ff, 0, 6, 2);
    this.healLight.position.y = 1.2;
    this.group.add(this.healGlow, this.healLight);
  }

  get x() {
    return this.group.position.x;
  }

  get y() {
    return this.group.position.y;
  }

  get z() {
    return this.group.position.z;
  }

  async load(url) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    this.model = gltf.scene;
    this.model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
      if (node.isSkinnedMesh) node.frustumCulled = false;
    });

    const box = new THREE.Box3();
    this.model.traverse((node) => {
      if (node.isMesh) box.expandByObject(node);
    });
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 0.2) {
      const scale = PLAYER.height / size.y;
      this.model.scale.setScalar(scale);
    }
    box.setFromObject(this.model);
    this.model.position.y -= box.min.y;
    this.group.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of gltf.animations) {
      const name = clip.name.split('|').pop();
      const action = this.mixer.clipAction(clip);
      this.actions[name] = action;
    }
    this.mixer.addEventListener('finished', () => {
      if (this.dead) return;
      this.lockAnim = false;
      this.attacking = false;
    });
    this.playLoop('Idle', 0);
    this.ready = true;
  }

  setPose(x, y, z, yaw) {
    this.group.position.set(x, y, z);
    this.yaw = yaw;
    this.group.rotation.y = yaw;
  }

  playLoop(name, fade = 0.18) {
    if (this.lockAnim || this.dead) return;
    const action = this.findAction(name);
    if (!action || this.currentName === name) return;
    action.enabled = true;
    action.timeScale = 1;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.reset().fadeIn(fade);
    action.play();
    if (this.current && this.current !== action) this.current.fadeOut(fade);
    this.current = action;
    this.currentName = name;
  }

  playOnce(name, fade = 0.08) {
    const action = this.findAction(name);
    if (!action) return 0.6;
    this.lockAnim = true;
    action.enabled = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().fadeIn(fade);
    action.play();
    if (this.current && this.current !== action) this.current.fadeOut(fade);
    this.current = action;
    this.currentName = name;
    return action.getClip().duration;
  }

  findAction(...names) {
    for (const name of names) {
      if (this.actions[name]) return this.actions[name];
      const hit = Object.keys(this.actions).find((n) => n.toLowerCase().includes(name.toLowerCase()));
      if (hit) return this.actions[hit];
    }
    return null;
  }

  update(dt, world, cameraYaw) {
    if (!this.ready) return;
    this.mixer?.update(dt);
    this.invuln = Math.max(0, this.invuln - dt);

    if (this.dead) return;

    if (this.attacking) {
      this.attackAge += dt;
      if (!this.hitArmed && this.attackAge >= this.attackHitAt) {
        this.hitArmed = true;
        this.onPunch?.();
      }
      if (this.attackAge >= this.attackEndAt) {
        this.attacking = false;
        this.lockAnim = false;
      }
    }

    const moving = Math.hypot(this.input.moveX, this.input.moveY);
    const canMove = !this.attacking;
    let speed = 0;
    if (canMove && moving > 0.12) {
      const lookX = -Math.sin(cameraYaw);
      const lookZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);
      const dirX = lookX * -this.input.moveY + rightX * this.input.moveX;
      const dirZ = lookZ * -this.input.moveY + rightZ * this.input.moveX;
      const dirLen = Math.hypot(dirX, dirZ) || 1;
      const nx = dirX / dirLen;
      const nz = dirZ / dirLen;
      speed = PLAYER.walkSpeed * Math.min(1, moving / 0.9);
      const nextX = this.x + nx * speed * dt;
      const nextZ = this.z + nz * speed * dt;
      const resolved = world.resolve(this.x, this.z, nextX, nextZ, PLAYER.radius);
      this.group.position.x = resolved.x;
      this.group.position.z = resolved.z;
      this.yaw = Math.atan2(nx, nz);
      this.group.rotation.y = angleLerp(this.group.rotation.y, this.yaw, 1 - Math.pow(0.0004, dt));
      this.playLoop('Walk');
      if (this.current && this.currentName === 'Walk') {
        this.current.timeScale = clamp(speed / 2.6, 0.85, 1.35);
      }
    } else if (!this.attacking) {
      this.playLoop('Idle');
    }

    const gy = world.heightAt(this.x, this.z);
    this.group.position.y += (gy - this.group.position.y) * Math.min(1, dt * 14);

    this.updateHeal(dt);
    if (!this.attacking && this.input.pressed('punch')) this.startPunch();
  }

  startHeal(amount, duration) {
    this.healLeft = duration;
    this.healRate = amount / duration;
    this.healGlow.visible = true;
  }

  updateHeal(dt) {
    if (this.healLeft <= 0) {
      this.healGlow.visible = false;
      this.healLight.intensity = 0;
      return;
    }
    this.healLeft -= dt;
    if (!this.dead) {
      this.health = Math.min(this.maxHealth, this.health + this.healRate * dt);
    }
    const pulse = 0.16 + Math.sin(performance.now() * 0.008) * 0.06;
    this.healGlow.material.opacity = pulse;
    this.healGlow.scale.setScalar(1.05 + Math.sin(performance.now() * 0.006) * 0.08);
    this.healLight.intensity = 2.2 + pulse * 4;
  }

  startPunch() {
    if (this.dead || this.attacking) return;
    const name = this.punchSide === 0 ? 'Punch_Left' : 'Punch_Right';
    this.punchSide = 1 - this.punchSide;
    const duration = this.playOnce(name);
    this.attacking = true;
    this.hitArmed = false;
    this.attackAge = 0;
    this.attackHitAt = duration * 0.32;
    this.attackEndAt = duration * 0.78;
  }

  tryInteract() {
    return this.input.pressed('interact') || this.input.pressed('confirm');
  }

  playInteract() {
    if (!this.attacking && !this.dead) this.playOnce('Interact');
  }

  hurt(amount, fromX, fromZ) {
    if (this.dead || this.invuln > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.invuln = PLAYER.invulnTime;
    rumble(this.input, 0.7, 180);
    const dx = this.x - fromX;
    const dz = this.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    this.group.position.x += (dx / len) * 0.35;
    this.group.position.z += (dz / len) * 0.35;
    if (!this.attacking) this.playOnce('HitRecieve');
    this.onHurt?.(amount);
    if (this.health <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.attacking = false;
    this.playOnce('Death');
    this.onDeath?.();
  }

  revive(x, z, yaw, world) {
    this.dead = false;
    this.lockAnim = false;
    this.attacking = false;
    this.health = this.maxHealth;
    this.invuln = 1.2;
    this.setPose(x, world.heightAt(x, z), z, yaw);
    this.playLoop('Idle', 0);
  }

  forward() {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  headPosition() {
    return new THREE.Vector3(this.x, this.y + CAMERA.lookHeight, this.z);
  }
}
