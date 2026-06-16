/**
 * PlayerMesh — Three.js visual representation of a player.
 *
 * SkeletonUtils.clone() is REQUIRED for Avaturn/SkinnedMesh models.
 * gltf.scene.clone(true) shares skeleton bones between instances,
 * causing meshes to render at the wrong position or be invisible.
 * SkeletonUtils.clone() re-binds every SkinnedMesh to its own cloned
 * skeleton so each player instance is fully independent.
 */

import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { modelLoader, MODEL_CONFIG } from '../loaders/ModelLoader.js';
import { CHARACTER_COLORS }          from '@core-rivals/shared/constants/GameConstants';
import { AnimationController }        from './AnimationController.js';

const LABEL_CANVAS_W = 256;
const LABEL_CANVAS_H = 52;
const LABEL_Y        = 2.15;
const GRIP_LOCAL_Y   = 0.95;  // height of the club grip in GolfClubMesh local space

function buildNameSprite(name, isLocal) {
  const canvas = document.createElement('canvas');
  canvas.width  = LABEL_CANVAS_W;
  canvas.height = LABEL_CANVAS_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = isLocal ? 'rgba(232,160,32,0.70)' : 'rgba(0,0,0,0.60)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(4, 4, LABEL_CANVAS_W - 8, LABEL_CANVAS_H - 8, 10);
  } else {
    ctx.rect(4, 4, LABEL_CANVAS_W - 8, LABEL_CANVAS_H - 8);
  }
  ctx.fill();

  ctx.fillStyle    = '#ffffff';
  ctx.font         = 'bold 21px "Rajdhani", "Inter", sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 16), LABEL_CANVAS_W / 2, LABEL_CANVAS_H / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const mat     = new THREE.SpriteMaterial({
    map:         texture,
    depthTest:   false,
    transparent: true,
  });
  const sprite  = new THREE.Sprite(mat);
  sprite.scale.set(LABEL_CANVAS_W / 160, LABEL_CANVAS_H / 160, 1);
  sprite.position.y = LABEL_Y;
  return sprite;
}

function buildCapsule(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 0.9, 4, 8),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 1.05;
  body.castShadow = true;

  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.13, 0.42),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  nose.position.set(0, 1.45, -0.46);
  group.add(body, nose);
  return group;
}

export class PlayerMesh {
  constructor(scene, character, name, isLocal = false) {
    this._scene     = scene;
    this._character = character;
    this._isLocal   = isLocal;
    this._handBone  = null;
    this._anim      = null;
    this._lastAnimPos = new THREE.Vector3();

    const color    = CHARACTER_COLORS[character] ?? 0x888888;
    this._fallback = buildCapsule(color);

    this._root = new THREE.Group();
    this._root.add(this._fallback);

    this._label = buildNameSprite(name, isLocal);
    this._root.add(this._label);

    scene.add(this._root);
    this._loadGLB(character);
  }

  setTransform(x, y, z, yaw) {
    this._yaw = yaw;
    this._root.position.set(x, y, z);
    this._root.rotation.y = yaw;
  }

  // ─── Animation ────────────────────────────────────────────────────────────────

  /** Advance animations; derives walk/idle from movement speed. */
  update(dt) {
    if (!this._anim) return;
    const p = this._root.position;
    if (dt > 0) {
      const dx = p.x - this._lastAnimPos.x;
      const dz = p.z - this._lastAnimPos.z;
      this._anim.setSpeed(Math.hypot(dx, dz) / dt);
    }
    this._lastAnimPos.set(p.x, p.y, p.z);
    this._anim.update(dt);
  }

  /** Trigger a one-shot action: 'golf' | 'punch'. */
  playAction(name) {
    this._anim?.playAction(name);
  }

  /** Golf charge: start back-swing + hold (local player while holding Space). */
  startSwingCharge() { this._anim?.startCharge(); }

  /** Golf release: finish the down-swing (on Space release). */
  releaseSwing() { this._anim?.releaseCharge(); }

  /**
   * Tilt the character so its up-axis follows the ground slope normal,
   * while preserving the current yaw. Normal comes from the GroundSampler.
   */
  applyGroundNormal(nx, ny, nz) {
    const n = new THREE.Vector3(nx, ny, nz);
    if (n.lengthSq() < 1e-6) return;
    n.normalize();
    const up    = new THREE.Vector3(0, 1, 0);
    const qTilt = new THREE.Quaternion().setFromUnitVectors(up, n);
    const qYaw  = new THREE.Quaternion().setFromAxisAngle(up, this._yaw ?? 0);
    this._root.quaternion.copy(qTilt).multiply(qYaw);
  }

  // ─── Held item attachment (GLB hand bone) ─────────────────────────────────────

  /** True once the GLB has loaded and a usable hand bone was found. */
  get hasHandBone() { return this._handBone != null; }

  /**
   * Parent an Object3D (e.g. the golf club group) to the GLB's hand bone.
   * Counter-scales by the bone's world scale so the club keeps real-world size.
   * @returns {boolean} whether the attach succeeded
   */
  attachToHand(object3D) {
    if (!this._handBone) return false;
    const s = new THREE.Vector3();
    this._handBone.getWorldScale(s);
    const inv = 1 / (s.x || 1);
    object3D.scale.setScalar(inv);
    // Club orientation within the hand (tweak per rig if the grip looks off).
    const rot = new THREE.Euler(Math.PI / 2, 0, 0);
    object3D.rotation.copy(rot);
    // Place the GRIP (top of the club) in the palm — not the club head.
    const grip = new THREE.Vector3(0, GRIP_LOCAL_Y * inv, 0).applyEuler(rot);
    object3D.position.set(-grip.x, -grip.y, -grip.z);
    this._handBone.add(object3D);
    return true;
  }

  /** Remove an attached Object3D from the hand bone and reset its transform. */
  detachFromHand(object3D) {
    if (object3D.parent) object3D.parent.remove(object3D);
    object3D.scale.setScalar(1);
    object3D.position.set(0, 0, 0);
    object3D.rotation.set(0, 0, 0);
  }

  dispose() {
    this._anim?.dispose();
    this._scene.remove(this._root);
    this._root.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m?.dispose());
    });
    this._label?.material?.map?.dispose();
    this._label?.material?.dispose();
  }

  async _loadGLB(character) {
    try {
      const gltf  = await modelLoader.load(character);
      const model = skeletonClone(gltf.scene);

      this._applyConfig(model, MODEL_CONFIG[character] ?? {});
      this._enableShadows(model);

      this._root.remove(this._fallback);
      this._root.add(model);
      this._model    = model;
      this._handBone = this._findHandBone(model);
      this._anim     = new AnimationController(model, character);

      const box = new THREE.Box3().setFromObject(model);
      this._label.position.y = (box.max.y > 0.1 ? box.max.y : 1.75) + 0.35;

      console.log('[PlayerMesh] ' + character + ' GLB activo');
    } catch (err) {
      console.warn('[PlayerMesh] ' + character + ' fallo:', err?.message ?? err);
    }
  }

  _findHandBone(model) {
    let right = null;
    let any   = null;
    model.traverse((o) => {
      const isBone = o.isBone || o.type === 'Bone';
      if (!isBone) return;
      const n = (o.name || '').toLowerCase();
      if (!n.includes('hand')) return;
      if (n.includes('right') || n.includes('_r') || n.endsWith('r')) right = right || o;
      any = any || o;
    });
    return right || any;
  }

  _applyConfig(model, config) {
    const yawOffset    = config.yawOffset    ?? 0;
    const targetHeight = config.targetHeight ?? 1.75;

    const box    = new THREE.Box3().setFromObject(model);
    const height = box.max.y - box.min.y;

    if (height > 0.01) {
      model.scale.setScalar(targetHeight / height);
      box.setFromObject(model);
      model.position.y -= box.min.y;
    }

    model.rotation.y = yawOffset;
  }

  _enableShadows(model) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = false;
      }
    });
  }
}
