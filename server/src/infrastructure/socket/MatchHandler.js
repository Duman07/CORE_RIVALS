/**
 * MatchHandler — wires game-phase Socket.IO events to the active GameSession.
 *
 * Phase 5 additions:
 *   GAME_PICKUP — player requests to pick up a nearby item.
 *   GAME_DROP   — player drops the item they are holding.
 *   GAME_SWING  — player releases a charged golf swing.
 *
 * Phase 6 additions:
 *   GAME_PUSH   — player requests to push a specific target.
 *   GAME_BLOCK  — player toggles block state (active: boolean).
 *
 * All data is sanitised here before reaching GameSession.
 * GameSession queues the actions and processes them in the next tick.
 */

import {
  GAME_INPUT,
  GAME_PICKUP,
  GAME_DROP,
  GAME_SWING,
  GAME_PUSH,
  GAME_BLOCK,
} from '@core-rivals/shared/constants/SocketEvents';

export class MatchHandler {
  /**
   * @param {import('socket.io').Server} io
   * @param {import('../../game/MatchManager.js').MatchManager} matchManager
   */
  constructor(io, matchManager) {
    this._io           = io;
    this._matchManager = matchManager;
  }

  /**
   * Register game-phase listeners for a newly connected socket.
   * @param {import('socket.io').Socket} socket
   */
  initialize(socket) {
    socket.on(GAME_INPUT,  (raw) => this._handleInput(socket, raw));
    socket.on(GAME_PICKUP, ()    => this._handlePickup(socket));
    socket.on(GAME_DROP,   ()    => this._handleDrop(socket));
    socket.on(GAME_SWING,  (raw) => this._handleSwing(socket, raw));
    socket.on(GAME_PUSH,   (raw) => this._handlePush(socket, raw));
    socket.on(GAME_BLOCK,  (raw) => this._handleBlock(socket, raw));
    socket.on('disconnecting', () => this._handleDisconnect(socket));
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _handleInput(socket, raw) {
    if (!raw || typeof raw !== 'object') return;
    const session = this._matchManager.getSessionByPlayer(socket.id);
    if (!session) return;

    const input = {
      seq:    Math.trunc(Number(raw.seq))    || 0,
      dx:     clamp(Number(raw.dx)    || 0, -1, 1),
      dz:     clamp(Number(raw.dz)    || 0, -1, 1),
      sprint: Boolean(raw.sprint),
      yaw:    Number(raw.yaw)                || 0,
      dt:     clamp(Number(raw.dt)    || 0,  0, 0.05),
    };
    session.enqueueInput(socket.id, input);
  }

  _handlePickup(socket) {
    const session = this._matchManager.getSessionByPlayer(socket.id);
    if (!session) return;
    session.enqueuePickup(socket.id);
  }

  _handleDrop(socket) {
    const session = this._matchManager.getSessionByPlayer(socket.id);
    if (!session) return;
    session.enqueueDrop(socket.id);
  }

  _handleSwing(socket, raw) {
    if (!raw || typeof raw !== 'object') return;
    const session = this._matchManager.getSessionByPlayer(socket.id);
    if (!session) return;

    const power  = clamp(Number(raw.power) || 0, 0, 1);
    const yaw    = Number(raw.yaw);
    const itemId = typeof raw.itemId === 'string' ? raw.itemId : null;

    if (!Number.isFinite(yaw) || !itemId) return;

    session.enqueueSwing(socket.id, { power, yaw, itemId });
  }

  _handlePush(socket, raw) {
    if (!raw || typeof raw !== 'object') return;
    const session = this._matchManager.getSessionByPlayer(socket.id);
    if (!session) return;

    const targetId = typeof raw.targetId === 'string' ? raw.targetId : null;
    if (!targetId) return;

    session.enqueuePush(socket.id, targetId);
  }

  _handleBlock(socket, raw) {
    if (!raw || typeof raw !== 'object') return;
    const session = this._matchManager.getSessionByPlayer(socket.id);
    if (!session) return;

    session.enqueueBlock(socket.id, Boolean(raw.active));
  }

  _handleDisconnect(socket) {
    this._matchManager.removePlayer(socket.id);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
