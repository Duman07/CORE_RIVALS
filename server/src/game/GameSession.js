/**
 * GameSession — authoritative game loop for one active match.
 *
 * Phase 4 changes vs Phase 3:
 *   - start() is now async (Rapier WASM init).
 *   - Tick uses PhysicsWorld: applyMovement computes desired pos →
 *     Rapier resolves collisions → actual pos read back.
 *   - Ball is a Rapier dynamic body; its state is broadcast every tick.
 *   - ScoreManager tracks points; a manual distance check detects goals.
 *   - MATCH_STATE payload expands to include ball + scores.
 *   - MATCH_SCORE is emitted separately on each goal for client animations.
 */

import {
  TICK_RATE,
  BROADCAST_RATE,
  SPAWN_POSITIONS,
  CORE_POSITIONS,
  CORE_RADIUS,
} from '@core-rivals/shared/constants/GameConstants';
import { MATCH_STATE, MATCH_SCORE } from '@core-rivals/shared/constants/SocketEvents';
import { applyMovement }             from '@core-rivals/shared/movement/MovementUtils';
import { PhysicsWorld }              from '../physics/PhysicsWorld.js';
import { ScoreManager }              from './ScoreManager.js';

const BROADCAST_EVERY   = Math.round(TICK_RATE / BROADCAST_RATE); // 3 ticks → 20 Hz
const MAX_QUEUED_INPUTS = 10;
const GOAL_COOLDOWN_TICKS = TICK_RATE; // 1 second of cooldown after each goal

export class GameSession {
  /**
   * @param {string} matchId
   * @param {string} roomId
   * @param {Array<{ socketId:string, name:string, character:string, slot:number }>} players
   * @param {import('socket.io').Server} io
   */
  constructor(matchId, roomId, players, io) {
    this.matchId = matchId;
    this.roomId  = roomId;
    this.status  = 'active';
    this._io     = io;
    this._tick   = 0;

    /** @type {Map<string, PlayerState>} */
    this._players = new Map();

    /** @type {Map<string, InputPacket[]>} */
    this._inputQueues = new Map();

    for (const p of players) {
      const spawn = SPAWN_POSITIONS[p.slot - 1] ?? SPAWN_POSITIONS[0];
      this._players.set(p.socketId, {
        socketId:     p.socketId,
        name:         p.name,
        character:    p.character,
        slot:         p.slot,
        x:            spawn.x,
        y:            0,
        z:            spawn.z,
        yaw:          0,
        lastInputSeq: -1,
      });
      this._inputQueues.set(p.socketId, []);
    }

    this._physics      = new PhysicsWorld();
    this._scoreManager = new ScoreManager(players);
    this._goalCooldown = 0;         // ticks remaining before next goal counts

    this._intervalHandle = null;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Async because Rapier WASM must be initialised before the tick loop starts.
   * Caller should handle the returned Promise (catch errors).
   */
  async start() {
    if (this._intervalHandle) return;

    await this._physics.init();

    // Register each player's Rapier kinematic body at their spawn
    for (const [socketId, state] of this._players) {
      this._physics.addPlayer(socketId, state.x, state.z);
    }

    const tickMs = 1000 / TICK_RATE;
    this._intervalHandle = setInterval(() => this._tick_fn(), tickMs);
    console.log(`[GameSession] ${this.matchId} started — ${TICK_RATE} Hz (physics ON)`);
  }

  stop() {
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
    }
    this.status = 'ended';
    console.log(`[GameSession] ${this.matchId} stopped`);
  }

  // ─── Input ──────────────────────────────────────────────────────────────────

  enqueueInput(socketId, input) {
    const queue = this._inputQueues.get(socketId);
    if (!queue) return;
    if (queue.length < MAX_QUEUED_INPUTS) queue.push(input);
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  hasPlayer(socketId) {
    return this._players.has(socketId);
  }

  removePlayer(socketId) {
    this._physics.removePlayer(socketId);
    this._players.delete(socketId);
    this._inputQueues.delete(socketId);
    if (this._players.size === 0) this.stop();
  }

  // ─── Tick ───────────────────────────────────────────────────────────────────

  _tick_fn() {
    this._tick++;

    // 1. Process queued inputs: compute desired positions via shared math
    for (const [socketId, queue] of this._inputQueues) {
      const player = this._players.get(socketId);
      if (!player) continue;

      while (queue.length > 0) {
        const input = queue.shift();
        // applyMovement computes desired (x, z) — same function as client prediction
        const next  = applyMovement(player, input);
        // Pass desired position to Rapier kinematic body
        this._physics.movePlayer(socketId, next.x, next.z);
        // Yaw is not physics-simulated; apply directly
        player.yaw          = next.yaw;
        player.lastInputSeq = input.seq;
      }
    }

    // 2. Step physics — Rapier resolves collisions, ball reacts to player contacts
    this._physics.step();

    // 3. Read back actual positions from Rapier (post-collision)
    for (const [socketId, player] of this._players) {
      const t = this._physics.getPlayerTranslation(socketId);
      if (t) {
        player.x = t.x;
        // player.y stays 0 for game logic (Rapier body centre is at y=0.85)
        player.z = t.z;
      }
    }

    // 4. Check for goals (manual distance — simpler than Rapier sensors)
    if (this._goalCooldown > 0) {
      this._goalCooldown--;
    } else {
      this._checkGoals();
    }

    // 5. Broadcast at 20 Hz
    if (this._tick % BROADCAST_EVERY === 0) {
      this._broadcast();
    }
  }

  _checkGoals() {
    const ball = this._physics.getBallState();
    // Ball must be near floor level — ignore airborne resets
    if (ball.y > 1.5) return;

    for (let i = 0; i < CORE_POSITIONS.length; i++) {
      const core = CORE_POSITIONS[i];
      const dx   = ball.x - core.x;
      const dz   = ball.z - core.z;

      if (dx * dx + dz * dz < CORE_RADIUS * CORE_RADIUS) {
        const scores = this._scoreManager.registerGoal(i);
        this._physics.resetBall();
        this._goalCooldown = GOAL_COOLDOWN_TICKS;

        this._io.to(this.roomId).emit(MATCH_SCORE, { coreIndex: i, scores });
        console.log(`[GameSession] Goal → Core ${i}. Scores:`, scores);
        break; // one goal per tick max
      }
    }
  }

  _broadcast() {
    const players = Array.from(this._players.values()).map((p) => ({
      id:           p.socketId,
      x:            p.x,
      y:            p.y,
      z:            p.z,
      yaw:          p.yaw,
      lastInputSeq: p.lastInputSeq,
    }));

    this._io.to(this.roomId).emit(MATCH_STATE, {
      tick:    this._tick,
      players,
      ball:    this._physics.getBallState(),
      scores:  this._scoreManager.getScores(),
    });
  }
}

/**
 * @typedef {{ socketId:string, name:string, character:string, slot:number,
 *             x:number, y:number, z:number, yaw:number, lastInputSeq:number }} PlayerState
 * @typedef {{ seq:number, dx:number, dz:number, sprint:boolean, yaw:number, dt:number }} InputPacket
 */
