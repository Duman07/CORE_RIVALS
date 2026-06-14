/**
 * GameSession — authoritative game loop for one active match.
 *
 * Phase 6 additions vs Phase 5:
 *   - Push: queued GAME_PUSH actions validated and applied as decaying
 *     velocity on the target's kinematic body.
 *   - Block: GAME_BLOCK toggles player.isBlocking; blocks reduce push force
 *     by BLOCK_PUSH_FACTOR and protect against disarm.
 *   - Disarm: an unblocked push drops the target's held GolfClub.
 *   - _pushVelocities accumulator: applied every tick, decays by
 *     PUSH_DECAY_PER_TICK until below PUSH_MIN_VELOCITY.
 *   - MATCH_STATE now includes isBlocking per player.
 *   - MATCH_PUSH emitted immediately on valid push.
 */

import {
  TICK_RATE,
  BROADCAST_RATE,
  SPAWN_POSITIONS,
  CORE_POSITIONS,
  CORE_RADIUS,
  ARENA_SIZE,
  CHARACTER_STATS,
  SWING_COOLDOWN_SECS,
  SWING_REACH,
  PUSH_MAX_DISTANCE,
  PUSH_BASE_VELOCITY,
  PUSH_DECAY_PER_TICK,
  PUSH_MIN_VELOCITY,
  PUSH_COOLDOWN_SECS,
  BLOCK_PUSH_FACTOR,
  BLOCK_MAX_DURATION,
} from '@core-rivals/shared/constants/GameConstants';
import {
  MATCH_STATE,
  MATCH_SCORE,
  MATCH_EVENT,
  MATCH_ITEM_PICKED,
  MATCH_ITEM_DROPPED,
  MATCH_PUSH,
} from '@core-rivals/shared/constants/SocketEvents';
import { applyMovement }     from '@core-rivals/shared/movement/MovementUtils';
import { computeSwingForce } from '@core-rivals/shared/utils/SwingUtils';
import { PhysicsWorld }      from '../physics/PhysicsWorld.js';
import { ScoreManager }      from './ScoreManager.js';
import { ItemManager }       from './items/ItemManager.js';

const BROADCAST_EVERY      = Math.round(TICK_RATE / BROADCAST_RATE); // 3 ticks → 20 Hz
const MAX_QUEUED_INPUTS    = 10;
const GOAL_COOLDOWN_TICKS  = TICK_RATE;                               // 1 s
const SWING_COOLDOWN_TICKS = Math.ceil(SWING_COOLDOWN_SECS * TICK_RATE);
const PUSH_COOLDOWN_TICKS  = Math.ceil(PUSH_COOLDOWN_SECS  * TICK_RATE);
const BLOCK_MAX_TICKS      = Math.ceil(BLOCK_MAX_DURATION  * TICK_RATE);

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

    // Phase 5 action queues
    /** @type {Set<string>} */
    this._pendingPickups = new Set();
    /** @type {Set<string>} */
    this._pendingDrops   = new Set();
    /** @type {Map<string, SwingData>} */
    this._pendingSwings  = new Map();
    /** @type {Map<string, number>} socketId → tick of last successful swing */
    this._lastSwingTick  = new Map();

    // Phase 6 combat queues
    /** @type {Map<string, { targetId: string }>} latest push request per player per tick */
    this._pendingPushes  = new Map();
    /** @type {Map<string, boolean>} socketId → active (true=start, false=stop) */
    this._pendingBlocks  = new Map();
    /** @type {Map<string, { vx: number, vz: number }>} decaying push velocity per player */
    this._pushVelocities = new Map();
    /** @type {Map<string, number>} socketId → tick of last successful push */
    this._lastPushTick   = new Map();

    for (const p of players) {
      const spawn = SPAWN_POSITIONS[p.slot - 1] ?? SPAWN_POSITIONS[0];
      this._players.set(p.socketId, {
        socketId:       p.socketId,
        name:           p.name,
        character:      p.character,
        slot:           p.slot,
        x:              spawn.x,
        y:              0,
        z:              spawn.z,
        yaw:            0,
        lastInputSeq:   -1,
        // Phase 6
        isBlocking:     false,
        blockStartTick: -1,
      });
      this._inputQueues.set(p.socketId, []);
    }

    this._physics      = new PhysicsWorld();
    this._scoreManager = new ScoreManager(players);
    this._items        = new ItemManager();
    this._goalCooldown = 0;

    this._intervalHandle = null;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async start() {
    if (this._intervalHandle) return;

    await this._physics.init();

    for (const [socketId, state] of this._players) {
      this._physics.addPlayer(socketId, state.x, state.z);
    }

    const tickMs = 1000 / TICK_RATE;
    this._intervalHandle = setInterval(() => this._tick_fn(), tickMs);
    console.log(`[GameSession] ${this.matchId} started — ${TICK_RATE} Hz`);
  }

  stop() {
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
    }
    this.status = 'ended';
    console.log(`[GameSession] ${this.matchId} stopped`);
  }

  // ─── Input / Action queuing ──────────────────────────────────────────────────

  enqueueInput(socketId, input) {
    const queue = this._inputQueues.get(socketId);
    if (!queue) return;
    if (queue.length < MAX_QUEUED_INPUTS) queue.push(input);
  }

  enqueuePickup(socketId) {
    if (this._players.has(socketId)) this._pendingPickups.add(socketId);
  }

  enqueueDrop(socketId) {
    if (this._players.has(socketId)) this._pendingDrops.add(socketId);
  }

  enqueueSwing(socketId, data) {
    if (this._players.has(socketId)) this._pendingSwings.set(socketId, data);
  }

  // Phase 6
  enqueuePush(socketId, targetId) {
    if (this._players.has(socketId)) this._pendingPushes.set(socketId, { targetId });
  }

  enqueueBlock(socketId, active) {
    if (this._players.has(socketId)) this._pendingBlocks.set(socketId, active);
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  hasPlayer(socketId) {
    return this._players.has(socketId);
  }

  removePlayer(socketId) {
    this._physics.removePlayer(socketId);
    this._items.releaseAll(socketId);
    this._players.delete(socketId);
    this._inputQueues.delete(socketId);
    this._pendingPickups.delete(socketId);
    this._pendingDrops.delete(socketId);
    this._pendingSwings.delete(socketId);
    this._lastSwingTick.delete(socketId);
    this._pendingPushes.delete(socketId);
    this._pendingBlocks.delete(socketId);
    this._pushVelocities.delete(socketId);
    this._lastPushTick.delete(socketId);
    if (this._players.size === 0) this.stop();
  }

  // ─── Tick ───────────────────────────────────────────────────────────────────

  _tick_fn() {
    this._tick++;

    // 1. Update block states (process before push so same-tick blocks protect)
    this._processBlocks();

    // 2. Process movement inputs
    for (const [socketId, queue] of this._inputQueues) {
      const player = this._players.get(socketId);
      if (!player) continue;
      while (queue.length > 0) {
        const input = queue.shift();
        const next  = applyMovement(player, input);
        player.x          = next.x;
        player.z          = next.z;
        player.yaw        = next.yaw;
        player.lastInputSeq = input.seq;
        this._physics.movePlayer(socketId, next.x, next.z);
      }
    }

    // 3. Apply decaying push velocities (adds to positions already set by movement)
    this._applyPushVelocities();

    // 4. Process new pushes
    this._processPushes();

    // 5. Process item pickups
    this._processPickups();

    // 6. Process item drops
    this._processDrops();

    // 7. Process swings
    this._processSwings();

    // 8. Step Rapier
    this._physics.step();

    // 9. Read back actual player positions from Rapier
    for (const [socketId, player] of this._players) {
      const t = this._physics.getPlayerTranslation(socketId);
      if (t) { player.x = t.x; player.z = t.z; }
    }

    // 10. Goal detection
    if (this._goalCooldown > 0) {
      this._goalCooldown--;
    } else {
      this._checkGoals();
    }

    // 11. Broadcast at 20 Hz
    if (this._tick % BROADCAST_EVERY === 0) {
      this._broadcast();
    }
  }

  // ─── Block processing ────────────────────────────────────────────────────────

  _processBlocks() {
    // Apply queued block state changes
    for (const [socketId, active] of this._pendingBlocks) {
      const player = this._players.get(socketId);
      if (!player) continue;
      if (active && !player.isBlocking) {
        player.isBlocking     = true;
        player.blockStartTick = this._tick;
      } else if (!active) {
        player.isBlocking     = false;
        player.blockStartTick = -1;
      }
    }
    this._pendingBlocks.clear();

    // Enforce max block duration
    for (const player of this._players.values()) {
      if (player.isBlocking && player.blockStartTick >= 0) {
        if (this._tick - player.blockStartTick >= BLOCK_MAX_TICKS) {
          player.isBlocking     = false;
          player.blockStartTick = -1;
        }
      }
    }
  }

  // ─── Push velocity application ───────────────────────────────────────────────

  _applyPushVelocities() {
    const dt = 1 / TICK_RATE;
    for (const [socketId, pv] of this._pushVelocities) {
      const player = this._players.get(socketId);
      if (!player) { this._pushVelocities.delete(socketId); continue; }

      // Add push displacement to current position
      const nx = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, player.x + pv.vx * dt));
      const nz = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, player.z + pv.vz * dt));
      player.x = nx;
      player.z = nz;
      this._physics.movePlayer(socketId, nx, nz);

      // Decay velocity
      pv.vx *= PUSH_DECAY_PER_TICK;
      pv.vz *= PUSH_DECAY_PER_TICK;

      if (Math.abs(pv.vx) < PUSH_MIN_VELOCITY && Math.abs(pv.vz) < PUSH_MIN_VELOCITY) {
        this._pushVelocities.delete(socketId);
      }
    }
  }

  // ─── Push validation and application ────────────────────────────────────────

  _processPushes() {
    for (const [socketId, { targetId }] of this._pendingPushes) {
      const pusher = this._players.get(socketId);
      const target = this._players.get(targetId);
      if (!pusher || !target) continue;

      // Anti-cheat 1: target must be a different player
      if (socketId === targetId) continue;

      // Anti-cheat 2: cooldown gate
      const lastTick = this._lastPushTick.get(socketId) ?? -Infinity;
      if (this._tick - lastTick < PUSH_COOLDOWN_TICKS) continue;

      // Anti-cheat 3: distance — computed from server positions (not client data)
      const dx   = target.x - pusher.x;
      const dz   = target.z - pusher.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > PUSH_MAX_DISTANCE) continue;

      // Anti-cheat 4: direction is computed server-side (client only sent targetId)
      const len    = dist < 0.001 ? 1 : dist;
      const dirX   = dx / len;
      const dirZ   = dz / len;

      // Apply block reduction
      const blocked  = target.isBlocking;
      const factor   = blocked ? BLOCK_PUSH_FACTOR : 1.0;
      const charPush = CHARACTER_STATS[pusher.character]?.stats?.pushForce ?? 1.0;
      const speed    = PUSH_BASE_VELOCITY * factor * charPush;

      // Set decaying velocity on target (accumulates with existing push if any)
      const existing = this._pushVelocities.get(targetId) ?? { vx: 0, vz: 0 };
      this._pushVelocities.set(targetId, {
        vx: existing.vx + dirX * speed,
        vz: existing.vz + dirZ * speed,
      });

      this._lastPushTick.set(socketId, this._tick);

      // Disarm: drop held GolfClub if target is not blocking
      let disarmed = false;
      if (!blocked) {
        const heldItem = this._items.getHeldBy(targetId);
        if (heldItem && heldItem.type === 'golf_club') {
          this._items.drop(targetId, target.x, target.z);
          this._io.to(this.roomId).emit(MATCH_ITEM_DROPPED, {
            itemId:   heldItem.id,
            playerId: targetId,
          });
          disarmed = true;
        }
      }

      // Broadcast push event to all clients (immediate, outside 20Hz cycle)
      this._io.to(this.roomId).emit(MATCH_PUSH, {
        pusherId:  socketId,
        targetId,
        blocked,
        disarmed,
      });

      console.log(
        `[GameSession] Push: ${socketId}→${targetId} ` +
        `dist=${dist.toFixed(2)}m blocked=${blocked} disarmed=${disarmed}`
      );
    }
    this._pendingPushes.clear();
  }

  // ─── Item processing ────────────────────────────────────────────────────────

  _processPickups() {
    for (const socketId of this._pendingPickups) {
      const player = this._players.get(socketId);
      if (!player) continue;

      const item = this._items.tryPickup(socketId, player.x, player.z);
      if (!item) continue;

      this._io.to(this.roomId).emit(MATCH_ITEM_PICKED, {
        itemId:   item.id,
        playerId: socketId,
      });
      console.log(`[GameSession] Pickup: ${socketId} → ${item.type} (${item.id})`);
    }
    this._pendingPickups.clear();
  }

  _processDrops() {
    for (const socketId of this._pendingDrops) {
      const player = this._players.get(socketId);
      if (!player) continue;

      const item = this._items.drop(socketId, player.x, player.z);
      if (!item) continue;

      this._io.to(this.roomId).emit(MATCH_ITEM_DROPPED, {
        itemId:   item.id,
        playerId: socketId,
      });
      console.log(`[GameSession] Drop: ${socketId} → ${item.type} (${item.id})`);
    }
    this._pendingDrops.clear();
  }

  _processSwings() {
    for (const [socketId, data] of this._pendingSwings) {
      const player = this._players.get(socketId);
      if (!player) continue;

      const item = this._items.getHeldBy(socketId);
      if (!item || item.type !== 'golf_club') continue;
      if (item.id !== data.itemId) continue;

      const lastTick = this._lastSwingTick.get(socketId) ?? -Infinity;
      if (this._tick - lastTick < SWING_COOLDOWN_TICKS) continue;

      const ball = this._physics.getBallState();
      const dx   = ball.x - player.x;
      const dz   = ball.z - player.z;
      if (dx * dx + dz * dz > SWING_REACH * SWING_REACH) continue;

      const charStats = CHARACTER_STATS[player.character]?.stats ?? { swingPower: 1 };
      const force     = computeSwingForce(data.power, data.yaw, charStats);
      this._physics.applyBallImpulse(force.fx, force.fy, force.fz);

      this._lastSwingTick.set(socketId, this._tick);

      this._io.to(this.roomId).emit(MATCH_EVENT, {
        type:     'swing',
        playerId: socketId,
        power:    data.power,
        yaw:      data.yaw,
      });

      console.log(
        `[GameSession] Swing: ${socketId} power=${data.power.toFixed(2)} ` +
        `force=(${force.fx.toFixed(1)},${force.fy.toFixed(1)},${force.fz.toFixed(1)})`
      );
    }
    this._pendingSwings.clear();
  }

  // ─── Goals ──────────────────────────────────────────────────────────────────

  _checkGoals() {
    const ball = this._physics.getBallState();
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
        break;
      }
    }
  }

  // ─── Broadcast ──────────────────────────────────────────────────────────────

  _broadcast() {
    const players = Array.from(this._players.values()).map((p) => ({
      id:           p.socketId,
      x:            p.x,
      y:            p.y,
      z:            p.z,
      yaw:          p.yaw,
      lastInputSeq: p.lastInputSeq,
      isBlocking:   p.isBlocking,   // Phase 6: clients render shield visual on remote players
    }));

    this._io.to(this.roomId).emit(MATCH_STATE, {
      tick:    this._tick,
      players,
      ball:    this._physics.getBallState(),
      scores:  this._scoreManager.getScores(),
      items:   this._items.getSnapshot(),
    });
  }
}

/**
 * @typedef {{ socketId:string, name:string, character:string, slot:number,
 *             x:number, y:number, z:number, yaw:number, lastInputSeq:number,
 *             isBlocking:boolean, blockStartTick:number }} PlayerState
 * @typedef {{ seq:number, dx:number, dz:number, sprint:boolean, yaw:number, dt:number }} InputPacket
 * @typedef {{ power:number, yaw:number, itemId:string }} SwingData
 */
