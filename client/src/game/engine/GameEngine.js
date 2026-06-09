/**
 * GameEngine — orchestrates the Three.js render loop and all game systems.
 *
 * Render loop (requestAnimationFrame, ~60 fps):
 *   1. Sample input (InputSystem)
 *   2. Predict local player movement immediately
 *   3. Flush input to server at 30 Hz (NetworkSystem.update)
 *   4. Update camera (CameraController)
 *   5. Interpolate remote players (RemotePlayer.update)
 *   6. Interpolate ball (Ball.update)          ← Phase 4
 *   7. Render frame (THREE.WebGLRenderer)
 *
 * Server reconciliation + ball/score updates happen via NetworkSystem.onServerState.
 */

import * as THREE from 'three';
import { buildArenaScene }   from './ArenaScene.js';
import { InputSystem }       from '../input/InputSystem.js';
import { NetworkSystem }     from '../network/NetworkSystem.js';
import { CameraController }  from '../camera/CameraController.js';
import { LocalPlayer }       from '../entities/LocalPlayer.js';
import { RemotePlayer }      from '../entities/RemotePlayer.js';
import { Ball }              from '../entities/Ball.js';
import { modelLoader }       from '../loaders/ModelLoader.js';
import { SPAWN_POSITIONS }   from '@core-rivals/shared/constants/GameConstants';

export class GameEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   socket:     import('socket.io-client').Socket,
   *   mySocketId: string,
   *   players:    Array<{ socketId:string, character:string, slot:number, name:string }>,
   *   onScores?:  (scores: Record<string,number>) => void,
   * }} options
   */
  constructor(canvas, { socket, mySocketId, players, onScores }) {
    this._canvas      = canvas;
    this._socket      = socket;
    this._myId        = mySocketId;
    this._playersMeta = players;
    this._onScores    = onScores ?? null;

    this._running  = false;
    this._lastTime = 0;
    this._rafId    = null;

    this._scene    = null;
    this._camera   = null;
    this._renderer = null;

    this._input   = null;
    this._network = null;
    this._camCtrl = null;

    this._localPlayer   = null;
    /** @type {Map<string, RemotePlayer>} */
    this._remotePlayers = new Map();
    this._ball          = null;

    this._loop     = this._loop.bind(this);
    this._onResize = this._onResize.bind(this);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  start() {
    this._initRenderer();
    this._initScene();
    this._initEntities();
    this._initSystems();

    this._running  = true;
    this._lastTime = performance.now();
    this._rafId    = requestAnimationFrame(this._loop);

    window.addEventListener('resize', this._onResize);
    console.log('[GameEngine] Started');
  }

  dispose() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);

    this._input?.dispose();
    this._network?.unlisten();
    this._localPlayer?.dispose();
    for (const rp of this._remotePlayers.values()) rp.dispose();
    this._ball?.dispose();

    this._renderer?.dispose();
    window.removeEventListener('resize', this._onResize);
    console.log('[GameEngine] Disposed');
  }

  // ─── Initialisation ─────────────────────────────────────────────────────────

  _initRenderer() {
    this._renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(this._canvas.clientWidth, this._canvas.clientHeight, false);

    this._camera = new THREE.PerspectiveCamera(
      70,
      this._canvas.clientWidth / this._canvas.clientHeight,
      0.1,
      200,
    );
    this._camera.rotation.order = 'YXZ';
  }

  _initScene() {
    this._scene = new THREE.Scene();
    buildArenaScene(this._scene, this._renderer);
  }

  _initEntities() {
    modelLoader.preloadAll();

    for (const p of this._playersMeta) {
      const spawn = SPAWN_POSITIONS[p.slot - 1] ?? SPAWN_POSITIONS[0];
      if (p.socketId === this._myId) {
        this._localPlayer = new LocalPlayer(this._scene, p.socketId, p.character, p.name, spawn);
      } else {
        this._remotePlayers.set(
          p.socketId,
          new RemotePlayer(this._scene, p.socketId, p.character, p.name, spawn),
        );
      }
    }

    // Ball entity — receives server state every broadcast tick
    this._ball = new Ball(this._scene);
  }

  _initSystems() {
    this._input = new InputSystem();
    this._input.init(this._canvas);

    this._camCtrl = new CameraController();

    this._network = new NetworkSystem(this._socket, this._myId);
    this._network.onServerState(({ local, remote, bufferedInputs, ball, scores }) => {
      // Player reconciliation (same as Phase 3)
      if (local && this._localPlayer) {
        this._localPlayer.reconcile(local, bufferedInputs);
      }
      for (const rState of remote) {
        this._remotePlayers.get(rState.id)?.addState(rState);
      }

      // Ball interpolation buffer
      if (ball) this._ball.addState(ball);

      // Scores → bubble up to React via callback
      if (scores && this._onScores) this._onScores(scores);
    });
    this._network.listen();
  }

  // ─── Render loop ────────────────────────────────────────────────────────────

  _loop(timestamp) {
    if (!this._running) return;

    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;

    const input = this._input.getInput();

    this._localPlayer?.applyInput(input, dt);
    this._network.update(input, dt);

    if (this._localPlayer) {
      this._camCtrl.update(this._camera, this._localPlayer.position, this._input.yaw, this._input.pitch);
    }

    for (const rp of this._remotePlayers.values()) rp.update();

    this._ball.update();

    this._renderer.render(this._scene, this._camera);

    this._rafId = requestAnimationFrame(this._loop);
  }

  // ─── Resize ─────────────────────────────────────────────────────────────────

  _onResize() {
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    this._renderer.setSize(w, h, false);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }
}
