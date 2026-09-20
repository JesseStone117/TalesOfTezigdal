import * as THREE from 'three';
import { CAMERA } from './config.js';
import { clamp } from './utils.js';

export class CameraRig {
  constructor(camera, player, input, settings) {
    this.camera = camera;
    this.player = player;
    this.input = input;
    this.settings = settings;
    this.yaw = 0;
    this.pitch = 0.28;
    this.ray = new THREE.Raycaster();
  }

  resetBehindPlayer() {
    this.yaw = this.player.yaw + Math.PI;
    this.pitch = 0.28;
    this.snap();
  }

  snap() {
    const { pos, look } = this.ideal();
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
  }

  update(dt, world) {
    const lookScale = CAMERA.mouseSens * (this.input.p1Pad ? CAMERA.padSens : 1);
    this.yaw -= this.input.lookX * lookScale;
    const invert = this.settings.invertY ? 1 : -1;
    this.pitch -= this.input.lookY * lookScale * invert;
    this.pitch = clamp(this.pitch, CAMERA.minPitch, CAMERA.maxPitch);

    const { pos, look } = this.ideal();
    if (world?.terrainMesh) {
      const origin = this.player.headPosition();
      const dir = pos.clone().sub(origin);
      const dist = dir.length();
      dir.normalize();
      this.ray.set(origin, dir);
      this.ray.far = dist;
      this.ray.near = 0.35;
      const hits = this.ray.intersectObject(world.terrainMesh, true);
      const hit = hits.find((entry) => {
        if (!entry.face) return true;
        const normal = entry.face.normal.clone().transformDirection(entry.object.matrixWorld);
        return Math.abs(normal.y) < 0.62;
      });
      if (hit && hit.distance < dist - 0.2) {
        const normal = hit.face?.normal
          ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
          : dir.clone().multiplyScalar(-1);
        pos.copy(hit.point).add(normal.multiplyScalar(0.35));
      }
    }
    pos.y = Math.max(pos.y, this.player.y + 1.2);
    const k = 1 - Math.pow(0.001, dt * (CAMERA.lerp / 12));
    this.camera.position.lerp(pos, k);
    this.camera.lookAt(look);
  }

  ideal() {
    const look = this.player.headPosition();
    const cp = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cp * CAMERA.distance,
      Math.sin(this.pitch) * CAMERA.distance + CAMERA.height - CAMERA.lookHeight,
      Math.cos(this.yaw) * cp * CAMERA.distance,
    );
    return { pos: look.clone().add(offset), look };
  }

  get yawFacing() {
    return this.yaw + Math.PI;
  }
}
