/**
 * AnimationController — plays Mixamo FBX clips on a GLB character.
 *
 * Locomotion (idle/walk) is driven by movement speed. Punch is a one-shot.
 * Golf is a CHARGE animation: on charge it plays the back-swing and holds at the
 * top; on release it completes the down-swing + follow-through, then returns to
 * locomotion.
 *
 * Mixamo clips are retargeted onto the model's bones by name (prefix-insensitive)
 * and only rotation (.quaternion) tracks are kept, so there is no root-motion
 * drift or unit-scale mismatch — the world position stays server-authoritative.
 */

import * as THREE from 'three';
import { modelLoader, ANIM_KEYS } from '../loaders/ModelLoader.js';

const WALK_SPEED_THRESHOLD = 0.4;  // m/s above which the character "walks"
const GOLF_HOLD_FRAC       = 0.45; // fraction of the golf clip = top of back-swing

function normBone(name) {
  return (name || '').toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/g, '');
}

export class AnimationController {
  constructor(model, character) {
    this._model     = model;
    this._character = character;
    this._mixer     = new THREE.AnimationMixer(model);
    this._actions   = {};
    this._active    = null;
    this._oneShot   = null;
    this._charging  = false;
    this._golfHoldTime = 0;
    this._locoName  = 'idle';
    this._ready     = false;

    this._boneMap = new Map();
    model.traverse((o) => {
      if (o.isBone || o.type === 'Bone') this._boneMap.set(normBone(o.name), o.name);
    });

    this._onFinished = this._onFinished.bind(this);
    this._mixer.addEventListener('finished', this._onFinished);

    this._load();
  }

  // ─── Public ───────────────────────────────────────────────────────────────────

  setSpeed(speed) {
    this._locoName = speed > WALK_SPEED_THRESHOLD ? 'walk' : 'idle';
    if (!this._ready || this._oneShot) return;
    this._fadeTo(this._locoName, 0.2);
  }

  /** One-shot action ('punch' | 'golf') played fully, then back to locomotion. */
  playAction(name) {
    const a = this._actions[name];
    if (!this._ready || !a) return;
    this._charging = false;
    this._oneShot  = a;
    a.reset();
    a.enabled   = true;
    a.paused    = false;
    a.timeScale = 1;
    a.setEffectiveWeight(1);
    a.play();
    if (this._active && this._active !== a) this._active.crossFadeTo(a, 0.12, false);
    this._active = a;
  }

  /** Begin the golf back-swing and hold at the top while charging. */
  startCharge() {
    const a = this._actions.golf;
    if (!this._ready || !a) return;
    this._charging = true;
    this._oneShot  = a;
    a.reset();
    a.enabled   = true;
    a.paused    = false;
    a.timeScale = 1;
    a.time      = 0;
    a.setEffectiveWeight(1);
    a.play();
    if (this._active && this._active !== a) this._active.crossFadeTo(a, 0.12, false);
    this._active = a;
  }

  /** Release the charge: finish the down-swing + follow-through. */
  releaseCharge() {
    if (!this._charging) return;
    this._charging = false;
    const a = this._actions.golf;
    if (a) { a.paused = false; a.timeScale = 1; }
  }

  update(dt) {
    this._mixer.update(dt);
    if (this._charging) {
      const a = this._actions.golf;
      if (a && a.time >= this._golfHoldTime) {
        a.time   = this._golfHoldTime;
        a.paused = true;
      }
    }
  }

  dispose() {
    this._mixer.removeEventListener('finished', this._onFinished);
    this._mixer.stopAllAction();
    this._mixer.uncacheRoot(this._model);
  }

  // ─── Private ──────────────────────────────────────────────────────────────────

  async _load() {
    try {
      const clips = await Promise.all(
        ANIM_KEYS.map((k) => modelLoader.loadAnimation(this._character, k).catch(() => null)),
      );
      ANIM_KEYS.forEach((key, i) => {
        const clip = clips[i];
        if (!clip) return;
        const retargeted = this._retarget(clip);
        if (retargeted.tracks.length === 0) {
          console.warn(`[AnimationController] ${this._character}/${key}: no bones matched`);
          return;
        }
        const action = this._mixer.clipAction(retargeted);
        if (key === 'golf' || key === 'punch') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          if (key === 'golf') this._golfHoldTime = retargeted.duration * GOLF_HOLD_FRAC;
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity);
        }
        this._actions[key] = action;
      });

      this._ready = true;
      this._fadeTo(this._locoName, 0);
    } catch (err) {
      console.warn('[AnimationController] load failed:', err?.message ?? err);
    }
  }

  _retarget(clip) {
    const tracks = [];
    for (const t of clip.tracks) {
      if (!t.name.endsWith('.quaternion')) continue;
      const dot     = t.name.lastIndexOf('.');
      const boneRaw = t.name.slice(0, dot);
      const prop    = t.name.slice(dot + 1);
      const target  = this._boneMap.get(normBone(boneRaw));
      if (!target) continue;
      const nt = t.clone();
      nt.name = `${target}.${prop}`;
      tracks.push(nt);
    }
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }

  _fadeTo(name, dur) {
    const next = this._actions[name];
    if (!next || this._active === next) return;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (this._active) this._active.crossFadeTo(next, dur, false);
    this._active = next;
  }

  _onFinished(e) {
    if (e.action === this._oneShot) {
      this._oneShot  = null;
      this._charging = false;
      this._fadeTo(this._locoName, 0.2);
    }
  }
}
