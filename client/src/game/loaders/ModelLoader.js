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

/** Public URL paths — files must live in client/public/assets/models/ */
const MODEL_PATHS = {
  duman:     '/assets/models/Duman.glb',
  moises:    '/assets/models/Moises.glb',
  sebastian: '/assets/models/Sebastian.glb',
};

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
    this._loader = new GLTFLoader();
    /** @type {Map<string, Promise>} character → Promise<GLTF> */
    this._cache = new Map();
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
