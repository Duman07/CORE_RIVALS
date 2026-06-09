/**
 * MatchManager — lifecycle management for active GameSessions.
 *
 * Responsibilities:
 *   - Create and track GameSession instances (one per active match).
 *   - Map socketId → matchId so any handler can look up a player's session.
 *   - Tear down sessions when they end or all players disconnect.
 */

import { randomUUID } from 'crypto';
import { GameSession } from './GameSession.js';

export class MatchManager {
  constructor() {
    /** @type {Map<string, GameSession>} matchId → session */
    this._sessions = new Map();

    /** @type {Map<string, string>} socketId → matchId */
    this._playerMatches = new Map();
  }

  // ─── Factory ────────────────────────────────────────────────────────────────

  /**
   * Creates, registers, and starts a GameSession from a completed lobby.
   *
   * @param {object} lobby
   * @param {import('socket.io').Server} io
   * @returns {{ matchId: string, session: GameSession }}
   */
  createMatch(lobby, io) {
    const matchId = randomUUID();
    const session = new GameSession(matchId, lobby.roomId, lobby.players, io);

    this._sessions.set(matchId, session);
    for (const p of lobby.players) {
      this._playerMatches.set(p.socketId, matchId);
    }

    console.log(`[MatchManager] Match created: ${matchId} (${lobby.players.length} players)`);
    return { matchId, session };
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  /** @returns {GameSession|null} */
  getSessionByPlayer(socketId) {
    const matchId = this._playerMatches.get(socketId);
    return matchId ? (this._sessions.get(matchId) ?? null) : null;
  }

  /** @returns {GameSession|null} */
  getSession(matchId) {
    return this._sessions.get(matchId) ?? null;
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  removePlayer(socketId) {
    const session = this.getSessionByPlayer(socketId);
    if (!session) return;

    session.removePlayer(socketId);
    this._playerMatches.delete(socketId);

    // If session stopped itself (no players left), clean up here too
    if (session.status === 'ended') {
      this._sessions.delete(session.matchId);
    }
  }

  endMatch(matchId) {
    const session = this._sessions.get(matchId);
    if (!session) return;

    session.stop();

    for (const [socketId, mid] of this._playerMatches) {
      if (mid === matchId) this._playerMatches.delete(socketId);
    }
    this._sessions.delete(matchId);
  }
}
