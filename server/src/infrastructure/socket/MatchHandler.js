/**
 * MatchHandler — wires GAME_INPUT Socket.IO events to the active GameSession.
 *
 * Design:
 *   - One MatchHandler instance per server (not per socket).
 *   - initialize(socket) registers per-socket listeners.
 *   - Input is sanitised here before reaching GameSession.
 *   - Disconnect cleanup delegates to MatchManager.
 */

import { GAME_INPUT } from '@core-rivals/shared/constants/SocketEvents';

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
   * Called from within the 'connection' handler in app.js.
   * @param {import('socket.io').Socket} socket
   */
  initialize(socket) {
    socket.on(GAME_INPUT, (raw) => this._handleInput(socket, raw));
    socket.on('disconnecting', () => this._handleDisconnect(socket));
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _handleInput(socket, raw) {
    if (!raw || typeof raw !== 'object') return;

    const session = this._matchManager.getSessionByPlayer(socket.id);
    if (!session) return;

    // Sanitise every field — never trust client data
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

  _handleDisconnect(socket) {
    this._matchManager.removePlayer(socket.id);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
