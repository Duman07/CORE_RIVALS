/**
 * GameEngine — orchestrates the Three.js render loop and all game systems.
 *
 * Phase 5 additions:
 *   • ItemPickupSystem  — [E] key emits GAME_PICKUP / GAME_DROP.
 *   • SwingController   — [SPACE] charges and emits GAME_SWING.
 *   • GolfClubMesh map  — one mesh per club item; positioned each frame.
 *   • _playerPositions  — live position cache for remote club attachment.
 *   • onSwingState cb   — feeds SwingIndicator HUD via React.
 *
 * Phase 6 additions:
 *   • CombatController  — [F] push, [RMB] block.
 *   • onCombatState cb  — feeds combat HUD (isBlocking, pushCooldownRatio).
 *   • _remoteXZ         — flat Map<socketId, {x,z}> fed to CombatController each frame.
 */

import * as THREE from 'three';
import { buildArenaScene }    from './ArenaScene.js';
import { InputSystem }        from '../input/InputSystem.js';
import { NetworkSystem }      from '../network/NetworkSystem.js';
import { CameraController }   from '../camera/CameraController.js';
import { LocalPlayer }        from '../entities/LocalPlayer.js';
import { RemotePlayer }       from '../entities/RemotePlayer.js';
import { Ball }               from '../entities/Ball.js';
import { GolfClubMesh }       from '../entities/GolfClubMesh.js';
import { ItemPickupSystem }   from '../systems/ItemPickupSystem.js';
import { SwingController }    from '../systems/SwingController.js';
import { CombatController }   from '../systems/CombatController.js';
import { modelLoader }        from '../loaders/ModelLoader.js';
import { SPAWN_POSITIONS }    from '@core-rivals/shared/constants/GameConstants';

export class GameEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   socket:          import('socket.io-client').Socket,
   *   mySocketId:      string,
   *   players:         Array<{ socketId:string, character:string, slot:number, name:string }>,
   *   onScores?:       (scores: Record<string,number>) => void,
   *   onSwingState?:   (state: { state:string, power:number, holding:boolean }) => void,
   *   onCombatState?:  (state: { isBlocking:boolean, pushCooldownRatio:number }) => void,
   * }} options
   */
  constructor(canvas, { socket, mySocketId, players, onScores, onSwingState, onCombatState }) {
    this._canvas         = canvas;
    this._socket         = socket;
    this._myId           = mySocketId;
    this._playersMeta    = players;
    this._onScores       = onScores       ?? null;
    this._onSwingState   = onSwingState   ?? null;
    this._onCombatState  = onCombatState  ?? null;

    this._running  = false;
    this._lastTime = 0;
    this._rafId    = null;

    this._scene    = null;
    this._camera   = null;
    this._renderer = null;

    this._input        = null;
    this._network      = null;
    this._camCtrl      = null;
    this._itemPickup   = null;
    this._swing        = null;
    this._combat       = null;

    this._localPlayer   = null;
    /** @type {Map<string, RemotePlayer>} */
    this._remotePlayers = new Map();
    this._ball          = null;

    /** @type {Map<string, GolfClubMesh>} itemId → mesh */
    this._clubMeshes      = new Map();
    /** @type {Array<object>} latest items snapshot from server */
    this._latestItems     = null;
    /** @type {Map<string, {x:number,y:number,z:number,yaw:number}>} */
    this._playerPositions = new Map();
    /** @type {Map<string, {x:number,z:number}>} flat position map fed to CombatController */
    this._remoteXZ        = new Map();

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
    this._itemPickup?.dispose();
    this._swing?.dispose();
    this._combat?.dispose();
    this._network?.unlisten();
    this._localPlayer?.dispose();
    for (const rp of this._remotePlayers.values()) rp.dispose();
    this._ball?.dispose();
    for (const mesh of this._clubMeshes.values()) mesh.dispose();

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

    this._ball = new Ball(this._scene);
  }

  _initSystems() {
    this._input = new InputSystem();
    this._input.init(this._canvas);

    this._camCtrl    = new CameraController();
    this._itemPickup = new ItemPickupSystem(this._socket);
    this._swing      = new SwingController(this._socket);

    // Phase 6: CombatController
    this._combat = new CombatController(this._socket);
    this._combat.init(this._canvas, this._myId);

    this._network = new NetworkSystem(this._socket, this._myId);
    this._network.onServerState(({ local, remote, bufferedInputs, ball, scores, items }) => {
      // Player reconciliation
      if (local && this._localPlayer) {
        this._localPlayer.reconcile(local, bufferedInputs);
        this._playerPositions.set(this._myId, {
          x: local.x, y: local.y ?? 0, z: local.z, yaw: local.yaw,
        });
      }
      for (const rState of remote) {
        this._remotePlayers.get(rState.id)?.addState(rState);
        this._playerPositions.set(rState.id, {
          x: rState.x, y: rState.y ?? 0, z: rState.z, yaw: rState.yaw,
        });
        // Phase 6: update flat remote position map for CombatController
        this._remoteXZ.set(rState.id, { x: rState.x, z: rState.z });
      }

      // Ball interpolation buffer
      if (ball) this._ball.addState(ball);

      // Items — sync pickup state and store snapshot for rendering
      if (items) {
        this._latestItems = items;
        this._itemPickup.syncState(items, this._myId);
        this._swing.setItemId(this._itemPickup.heldItemId);
      }

      // Scores → React HUD
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
      this._camCtrl.update(
        this._camera,
        this._localPlayer.position,
        this._input.yaw,
        this._input.pitch,
      );
    }

    // Feed current yaw to SwingController
    this._swing.setYaw(this._input.yaw);
    this._swing.update(dt);

    // Phase 6: feed latest positions to CombatController
    const lp = this._localPlayer?.position ?? null;
    const localXZ = lp ? { x: lp.x, z: lp.z } : null;
    this._combat.setPositions(localXZ, this._remoteXZ);

    for (const rp of this._remotePlayers.values()) rp.update();

    this._ball.update();

    // Update golf club visuals
    if (this._latestItems) this._updateClubs();

    // Push swing state to React HUD
    if (this._onSwingState) {
      this._onSwingState({
        state:   this._swing.state,
        power:   this._swing.power,
        holding: this._itemPickup.isHolding,
      });
    }

    // Phase 6: push combat state to React HUD
    if (this._onCombatState) {
      this._onCombatState({
        isBlocking:        this._combat.isBlocking,
        pushCooldownRatio: this._combat.pushCooldownRatio,
      });
    }

    this._renderer.render(this._scene, this._camera);

    this._rafId = requestAnimationFrame(this._loop);
  }

  // ─── Club rendering ─────────────────────────────────────────────────────────

  _updateClubs() {
    for (const itemState of this._latestItems) {
      if (itemState.type !== 'golf_club') continue;

      if (!this._clubMeshes.has(itemState.id)) {
        this._clubMeshes.set(itemState.id, new GolfClubMesh(this._scene));
      }
      const mesh = this._clubMeshes.get(itemState.id);

      if (itemState.ownerId === null) {
        mesh.setGroundPose(itemState.x, itemState.z);
      } else {
        let pos = this._playerPositions.get(itemState.ownerId);
        if (!pos && itemState.ownerId === this._myId && this._localPlayer?.position) {
          const p = this._localPlayer.position;
          pos = { x: p.x, y: p.y, z: p.z, yaw: this._input.yaw };
        }
        if (pos) {
          const yaw = itemState.ownerId === this._myId ? this._input.yaw : (pos.yaw ?? 0);
          mesh.setHeldPose(pos.x, pos.y, pos.z, yaw);
        } else {
          mesh.hide();
        }
      }
    }
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
