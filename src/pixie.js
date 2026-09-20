import * as THREE from 'three';
import { SPRITE } from './config.js';

export class Pixie {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.bolts = [];
    this.boltPool = [];
    this.boltsReady = SPRITE.maxBolts;
    this.reload = 0;
    this.fireCd = 0;
    this.healCd = 0;
    this.group = buildOrb();
    this.scene.add(this.group);
    this._t = 0;
    this._aim = new THREE.Vector3();
  }

  reset() {
    for (const bolt of this.bolts) {
      bolt.mesh.visible = false;
      this.boltPool.push(bolt);
    }
    this.bolts.length = 0;
    this.boltsReady = SPRITE.maxBolts;
    this.reload = 0;
    this.fireCd = 0;
  }

  update(dt, { player, input, world, paused, talking, dead }) {
    this._t += dt;
    const enabled = input.settings.p2Index !== -2;
    this.group.visible = enabled;
    if (!enabled) {
      this.updateBolts(dt, world, player);
      return;
    }
    this.healCd = Math.max(0, this.healCd - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);

    if (this.boltsReady < SPRITE.maxBolts) {
      this.reload += dt;
      if (this.reload >= SPRITE.reload) {
        this.reload = 0;
        this.boltsReady += 1;
      }
    }

    const hover = player.headPosition();
    hover.y += 0.28 + Math.sin(this._t * 3.2) * 0.07;
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    hover.addScaledVector(camRight, 0.55);
    hover.addScaledVector(camUp, 0.18);

    this.ndc.set(input.aimX * 2 - 1, -(input.aimY * 2 - 1));
    this.ray.setFromCamera(this.ndc, this.camera);
    const far = this.ray.ray.origin.clone().addScaledVector(this.ray.ray.direction, 28);
    let aim = far;
    const targets = [];
    if (world?.terrainMesh) targets.push(world.terrainMesh);
    if (world?.group) targets.push(world.group);
    if (targets.length) {
      const hits = this.ray.intersectObjects(targets, true);
      const hit = hits.find((h) => h.distance > 0.6);
      if (hit) aim = hit.point;
    }
    this._aim.copy(aim);

    const toAim = aim.clone().sub(hover);
    if (toAim.lengthSq() > 0.01) {
      toAim.setLength(Math.min(0.45, toAim.length() * 0.08));
      hover.add(toAim);
    }

    this.group.position.lerp(hover, 1 - Math.pow(0.0008, dt));
    const pulse = 1 + Math.sin(this._t * 6.5) * 0.1;
    this.group.scale.setScalar(pulse);
    const light = this.group.userData.light;
    if (light) light.intensity = 2.4 + Math.sin(this._t * 8) * 0.7;

    const canAct = !paused && !talking && !dead && !player.dead;
    if (canAct && input.p2Fire && this.fireCd <= 0 && this.boltsReady > 0) {
      this.shoot(aim);
    }
    if (canAct && input.p2Heal && this.healCd <= 0) {
      this.healCd = SPRITE.healCooldown;
      player.startHeal(SPRITE.healAmount, SPRITE.healDuration);
    }

    this.updateBolts(dt, world, player);
  }

  shoot(aim) {
    this.boltsReady -= 1;
    this.fireCd = SPRITE.fireRate;
    const origin = this.group.position.clone();
    const dir = aim.clone().sub(origin);
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, 1);
    dir.normalize();
    const bolt = this.boltPool.pop() || makeBolt();
    if (!bolt.mesh.parent) this.scene.add(bolt.mesh);
    bolt.mesh.visible = true;
    bolt.mesh.position.copy(origin);
    bolt.vel = dir.multiplyScalar(SPRITE.speed);
    bolt.life = SPRITE.life;
    bolt.mesh.lookAt(origin.clone().add(bolt.vel));
    this.bolts.push(bolt);
  }

  updateBolts(dt, world, player) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i];
      bolt.life -= dt;
      bolt.mesh.position.addScaledVector(bolt.vel, dt);
      let hit = false;
      if (world?.enemies) {
        for (const enemy of world.enemies) {
          if (enemy.dead) continue;
          const dx = enemy.x - bolt.mesh.position.x;
          const dy = (enemy.group.position.y + 0.8) - bolt.mesh.position.y;
          const dz = enemy.z - bolt.mesh.position.z;
          const rad = enemy.radius + SPRITE.radius;
          if (dx * dx + dy * dy * 0.5 + dz * dz < rad * rad) {
            const killed = enemy.takeDamage(SPRITE.damage, player.x, player.z);
            if (killed) player.onKill?.(enemy);
            hit = true;
            break;
          }
        }
      }
      if (hit || bolt.life <= 0) {
        bolt.mesh.visible = false;
        this.bolts.splice(i, 1);
        this.boltPool.push(bolt);
      }
    }
  }

  hud() {
    return {
      bolts: this.boltsReady,
      maxBolts: SPRITE.maxBolts,
      reload: this.boltsReady < SPRITE.maxBolts ? this.reload / SPRITE.reload : 1,
      healCd: this.healCd,
      healMax: SPRITE.healCooldown,
    };
  }
}

function buildOrb() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xb8f0ff }),
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x3aa7ff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 10),
    new THREE.MeshBasicMaterial({
      color: 0x1d6dff,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  const light = new THREE.PointLight(0x66c8ff, 2.6, 5, 2);
  group.add(core, halo, haze, light);
  group.userData.light = light;
  return group;
}

function makeBolt() {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.06, 0.38, 4, 8),
    new THREE.MeshBasicMaterial({ color: 0x9ee8ff }),
  );
  mesh.rotation.x = Math.PI / 2;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x4db7ff, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  mesh.add(glow);
  return { mesh, vel: new THREE.Vector3(), life: SPRITE.life };
}
