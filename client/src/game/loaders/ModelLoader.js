/**
 * ModelLoader — GLTFLoader singleton with per-character caching.
 *
 * Usage:
 *   const gltf = await modelLoader.load('duman');
 *   const model = SkeletonUtils.clone(gltf.scene); // own instance per player
 *
 * Caching strategy:
 *   The loader stores the Promise (not the result) so that concurrent calls
 *   for the same character share one network request, even before it resolves.
 *
 * MODEL_CONFIG:
 *   Avaturn GLBs typically face +Z; our player "forward" is -Z.
 *   Adjust yawOffset per model if orientation is wrong after loading.
 *   targetHeight normalises the model to a consistent in-world height.
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader }  from 'three/examples/jsm/loaders/FBXLoader.js';

/** Public URL paths — files must live in client/public/assets/models/ */
const MODEL_PATHS = {
  duman:     '/assets/models/Duman.glb',
  moises:    '/assets/models/Moises.glb',
  sebastian: '/assets/models/Sebastian.glb',
};

/** Per-character Mixamo FBX animation clips (folder per character). */
const ANIM_DIR = {
  duman:     '/assets/models/Duman',
  moises:    '/assets/models/Moises',
  sebastian: '/assets/models/Sebastian',
};
const ANIM_FILES = {
  idle:  'Happy Idle.fbx',
  walk:  'Walking.fbx',
  golf:  'Golf Drive.fbx',
  punch: 'Punching.fbx',
};
export const ANIM_KEYS = Object.keys(ANIM_FILES);

/**
 * Per-character visual corrections applied after loading.
 * Tweak these if a model is upside-down, facing wrong way, or too tall/short.
 *
 * @type {Record<string, { yawOffset: number, targetHeight: number }>}
 */
export const MODEL_CONFIG = {
  //  yawOffset: Math.PI  → rotates 180° around Y (Avaturn faces +Z; we need -Z)
  //  targetHeight: 1.75  → normalises to ~human height in metres
  duman:     { yawOffset: Math.PI, targetHeight: 1.75 },
  moises:    { yawOffset: Math.PI, targetHeight: 1.75 },
  sebastian: { yawOffset: Math.PI, targetHeight: 1.75 },
};

// ─── Loader singleton ─────────────────────────────────────────────────────────

class ModelLoaderSingleton {
  constructor() {
    this._loader    = new GLTFLoader();
    this._fbxLoader = new FBXLoader();
    /** @type {Map<string, Promise>} character → Promise<GLTF> */
    this._cache = new Map();
    /** @type {Map<string, Promise>} `${character}:${key}` → Promise<AnimationClip> */
    this._animCache = new Map();
  }

  /**
   * Load one Mixamo FBX animation and return its AnimationClip (cached).
   * @param {string} character @param {string} key — idle|walk|golf|punch
   * @returns {Promise<import('three').AnimationClip>}
   */
  loadAnimation(character, key) {
    const id = `${character}:${key}`;
    if (this._animCache.has(id)) return this._animCache.get(id);

    const dir  = ANIM_DIR[character];
    const file = ANIM_FILES[key];
    if (!dir || !file) return Promise.reject(new Error(`[ModelLoader] Unknown anim ${id}`));

    const url = `${dir}/${encodeURIComponent(file)}`;
    const promise = this._fbxLoader.loadAsync(url).then((fbx) => {
      const clip = fbx.animations && fbx.animations[0];
      if (!clip) throw new Error(`[ModelLoader] No clip in ${url}`);
      clip.name = key;
      return clip;
    }).catch((err) => {
      this._animCache.delete(id);
      throw err;
    });

    this._animCache.set(id, promise);
    return promise;
  }

  /**
   * Load a character GLB and return its GLTF object.
   * Concurrent / repeated calls for the same character share one fetch.
   *
   * @param {string} character — 'duman' | 'moises' | 'sebastian'
   * @returns {Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>}
   */
  load(character) {
    if (this._cache.has(character)) {
      return this._cache.get(character);
    }

    const path = MODEL_PATHS[character];
    if (!path) {
      return Promise.reject(new Error(`[ModelLoader] Unknown character: "${character}"`));
    }

    const promise = new Promise((resolve, reject) => {
      this._loader.load(
        path,
        (gltf) => {
          console.log(`[ModelLoader] Loaded ${character} — ${gltf.animations.length} animation(s)`);
          resolve(gltf);
        },
        (progress) => {
          if (progress.lengthComputable) {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            console.debug(`[ModelLoader] ${character}: ${pct}%`);
          }
        },
        (err) => {
          this._cache.delete(character); // allow retry on next call
          reject(err);
        },
      );
    });

    this._cache.set(character, promise);
    return promise;
  }

  /** Pre-load all characters in the background (call once at match start). */
  preloadAll() {
    for (const char of Object.keys(MODEL_PATHS)) {
      this.load(char).catch(() => {}); // silent — errors shown when actually needed
    }
  }
}

export const modelLoader = new ModelLoaderSingleton();
