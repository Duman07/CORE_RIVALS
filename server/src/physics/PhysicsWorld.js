/**
 * PhysicsWorld — Rapier physics world for one GameSession.
 *
 * Entities:
 *   Players  → KinematicPositionBased + Capsule collider
 *              Moved by setting next kinematic translation each tick.
 *              Rapier's kinematic→dynamic coupling makes them push the ball.
 *   Ball     → Dynamic + Ball collider
 *              Responds to gravity, friction, and player contacts.
 *   Floor    → Fixed + Cuboid — ball bounces on it.
 *   Walls    → 4 Fixed Cuboids at ±25m — ball bounces off them.
 *
 * Core scoring is NOT done via Rapier sensors.
 * GameSession performs a manual Euclidean distance check each tick,
 * which is simpler, cheaper, and fully deterministic.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import {
  BALL_RADIUS,
  BALL_SPAWN,
} from '@core-rivals/shared/constants/GameConstants';

// Player capsule dimensions
const CAPSULE_HALF_HEIGHT = 0.45;   // cylinder half-length
const CAPSULE_RADIUS      = 0.40;   // sphere radius
const PLAYER_Y            = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS; // 0.85 — capsule centre height

export class PhysicsWorld {
  constructor() {
    this._world        = null;
    this._playerBodies = new Map(); // socketId → RigidBody
    this._ballBody     = null;
    this._ready        = false;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async init() {
    await RAPIER.init();

    this._world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    this._buildFloor();
    this._buildWalls();
    this._buildBall();

    this._ready = true;
    console.log('[PhysicsWorld] Initialised');
  }

  // ─── Player bodies ──────────────────────────────────────────────────────────

  /**
   * Register a player kinematic body at spawn position.
   * @param {string} socketId
   * @param {number} x
   * @param {number} z
   */
  addPlayer(socketId, x, z) {
    if (!this._ready) return;
    const desc = RAPIER.RigidBodyDesc
      .kinematicPositionBased()
      .setTranslation(x, PLAYER_Y, z);
    const body = this._world.createRigidBody(desc);
    this._world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS),
      body,
    );
    this._playerBodies.set(socketId, body);
  }

  /**
   * Set the kinematic target translation for next world.step().
   * @param {string} socketId
   * @param {number} x
   * @param {number} z
   */
  movePlayer(socketId, x, z) {
    const body = this._playerBodies.get(socketId);
    if (!body) return;
    body.setNextKinematicTranslation({ x, y: PLAYER_Y, z });
  }

  /**
   * Read player position AFTER world.step() resolves collisions.
   * @param {string} socketId
   * @returns {{ x:number, y:number, z:number } | null}
   */
  getPlayerTranslation(socketId) {
    const body = this._playerBodies.get(socketId);
    return body ? body.translation() : null;
  }

  removePlayer(socketId) {
    const body = this._playerBodies.get(socketId);
    if (!body) return;
    this._world.removeRigidBody(body);
    this._playerBodies.delete(socketId);
  }

  // ─── Ball ───────────────────────────────────────────────────────────────────

  getBallState() {
    const t = this._ballBody.translation();
    const v = this._ballBody.linvel();
    return { x: t.x, y: t.y, z: t.z, vx: v.x, vy: v.y, vz: v.z };
  }

  resetBall() {
    this._ballBody.setTranslation({ x: BALL_SPAWN.x, y: BALL_SPAWN.y, z: BALL_SPAWN.z }, true);
    this._ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this._ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  // ─── Step ───────────────────────────────────────────────────────────────────

  step() {
    this._world.step();
  }

  // ─── Private builders ───────────────────────────────────────────────────────

  _buildFloor() {
    const body = this._world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this._world.createCollider(
      RAPIER.ColliderDesc.cuboid(30, 0.05, 30).setTranslation(0, -0.05, 0),
      body,
    );
  }

  _buildWalls() {
    // [cx, cy, cz, hx, hy, hz]
    const walls = [
      [  0, 2,  25, 25, 2, 0.5],   // north
      [  0, 2, -25, 25, 2, 0.5],   // south
      [ 25, 2,   0, 0.5, 2, 25],   // east
      [-25, 2,   0, 0.5, 2, 25],   // west
    ];
    for (const [cx, cy, cz, hx, hy, hz] of walls) {
      const body = this._world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz),
      );
      this._world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
    }
  }

  _buildBall() {
    const desc = RAPIER.RigidBodyDesc
      .dynamic()
      .setTranslation(BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z)
      .setLinearDamping(0.6)
      .setAngularDamping(0.6);
    this._ballBody = this._world.createRigidBody(desc);
    this._world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setRestitution(0.55)
        .setFriction(0.4),
      this._ballBody,
    );
  }
}
