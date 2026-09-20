import { COMBAT } from '../config.js';
import { makeCreature } from './props.js';
import { angleLerp, clamp } from '../utils.js';

export class Enemy {
  constructor({
    id,
    x,
    z,
    boss = false,
    homeX,
    homeZ,
  }) {
    this.id = id;
    this.boss = boss;
    this.maxHealth = boss ? COMBAT.bossHealth : COMBAT.gruntHealth;
    this.health = this.maxHealth;
    this.damage = boss ? COMBAT.bossDamage : COMBAT.gruntDamage;
    this.speed = boss ? COMBAT.bossSpeed : COMBAT.gruntSpeed;
    this.aggro = boss ? COMBAT.bossAggro : COMBAT.gruntAggro;
    this.leash = boss ? COMBAT.bossLeash : COMBAT.gruntLeash;
    this.exp = boss ? COMBAT.bossExp : COMBAT.gruntExp;
    this.radius = boss ? 0.85 : 0.48;
    this.attackRange = boss ? 1.9 : 1.45;
    this.dead = false;
    this.state = 'idle';
    this.attackTimer = 0;
    this.cooldown = 0;
    this.hitFlash = 0;
    this.wanderT = Math.random() * 4;
    this.wanderA = Math.random() * Math.PI * 2;
    this.homeX = homeX ?? x;
    this.homeZ = homeZ ?? z;
    this.group = makeCreature({
      color: boss ? 0x6a1c22 : 0x4a3a58,
      scale: boss ? 1.85 : 1,
      horns: true,
      boss,
    });
    this.group.position.set(x, 0, z);
  }

  get x() {
    return this.group.position.x;
  }

  get z() {
    return this.group.position.z;
  }

  takeDamage(amount, fromX, fromZ) {
    if (this.dead) return false;
    this.health -= amount;
    this.hitFlash = 0.18;
    this.state = 'chase';
    const dx = this.x - fromX;
    const dz = this.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    this.group.position.x += (dx / len) * 0.45;
    this.group.position.z += (dz / len) * 0.45;
    if (this.health <= 0) {
      this.dead = true;
      this.state = 'dead';
      return true;
    }
    return false;
  }

  update(dt, player, world) {
    if (this.dead) {
      this.group.scale.y = clamp(this.group.scale.y - dt * 1.6, 0.08, 4);
      this.group.position.y = world.heightAt(this.x, this.z);
      return;
    }

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.group.traverse((n) => {
      if (n.isMesh && n.material && 'emissiveIntensity' in n.material) {
        n.material.emissiveIntensity = this.hitFlash > 0 ? 0.9 : 0.2;
      }
    });

    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const dist = Math.hypot(dx, dz);
    const toHome = Math.hypot(this.x - this.homeX, this.z - this.homeZ);

    if (this.state === 'idle') {
      if (dist < this.aggro && !player.dead) this.state = 'chase';
      else this.wander(dt, world);
    } else if (this.state === 'chase') {
      if (toHome > this.leash) this.state = 'return';
      else if (dist < this.attackRange && this.cooldown <= 0) this.state = 'attack';
      else this.steerToward(dx, dz, dt, world);
    } else if (this.state === 'return') {
      const hx = this.homeX - this.x;
      const hz = this.homeZ - this.z;
      if (Math.hypot(hx, hz) < 0.6) this.state = 'idle';
      else this.steerToward(hx, hz, dt, world);
    } else if (this.state === 'attack') {
      this.attackTimer += dt;
      this.lookAt(dx, dz, dt);
      const wind = this.boss ? 0.45 : 0.28;
      if (this.attackTimer >= wind) {
        this.attackTimer = 0;
        this.cooldown = this.boss ? 1.35 : 1.05;
        this.state = 'chase';
        if (dist < this.attackRange + 0.35 && !player.dead) {
          player.hurt(this.damage, this.x, this.z);
        }
      }
    }

    this.group.position.y = world.heightAt(this.x, this.z);
    this.keepInside(world);
  }

  wander(dt, world) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 1.5 + Math.random() * 2.5;
      this.wanderA = Math.random() * Math.PI * 2;
    }
    this.steerToward(Math.sin(this.wanderA), Math.cos(this.wanderA), dt, world, 0.45);
  }

  steerToward(dx, dz, dt, world, speedScale = 1) {
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;
    const step = this.speed * speedScale * dt;
    const nextX = this.x + nx * step;
    const nextZ = this.z + nz * step;
    const resolved = world.resolve(this.x, this.z, nextX, nextZ, this.radius);
    this.group.position.x = resolved.x;
    this.group.position.z = resolved.z;
    this.lookAt(nx, nz, dt);
  }

  lookAt(dx, dz, dt) {
    const yaw = Math.atan2(dx, dz);
    this.group.rotation.y = angleLerp(this.group.rotation.y, yaw, 1 - Math.pow(0.002, dt));
  }

  keepInside(world) {
    const r = world.resolve(this.x, this.z, this.x, this.z, this.radius);
    this.group.position.x = r.x;
    this.group.position.z = r.z;
  }
}
