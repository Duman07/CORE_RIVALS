import {
  LOBBY_CREATE,
  LOBBY_JOIN,
  LOBBY_SELECT_CHARACTER,
  LOBBY_READY,
  LOBBY_CREATED,
  LOBBY_JOINED,
  LOBBY_UPDATED,
  LOBBY_ERROR,
  LOBBY_PLAYER_LEFT,
  MATCH_START,
} from '@core-rivals/shared/constants/SocketEvents';

/**
 * LobbyHandler — wires Socket.IO events to LobbyManager business logic.
 *
 * All mutations happen on the server; clients only receive updated state.
 * This keeps the server as the single source of truth (server-authoritative).
 */
export class LobbyHandler {
  /**
   * @param {import('socket.io').Server} io
   * @param {import('../../game/LobbyManager.js').LobbyManager} lobbyManager
   * @param {import('../../game/MatchManager.js').MatchManager} matchManager
   */
  constructor(io, lobbyManager, matchManager) {
    this._io = io;
    this._lobby = lobbyManager;
    this._match = matchManager;
  }

  initialize() {
    this._io.on('connection', (socket) => {
      console.log(`[Socket] Connected: ${socket.id}`);

      socket.on(LOBBY_CREATE, (data) => this._handleCreate(socket, data));
      socket.on(LOBBY_JOIN, (data) => this._handleJoin(socket, data));
      socket.on(LOBBY_SELECT_CHARACTER, (data) => this._handleSelectCharacter(socket, data));
      socket.on(LOBBY_READY, () => this._handleReady(socket));
      socket.on('disconnect', () => this._handleDisconnect(socket));
    });
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  _handleCreate(socket, data) {
    const playerName = this._sanitizeName(data?.playerName);
    if (!playerName) {
      return socket.emit(LOBBY_ERROR, { message: 'El nombre no puede estar vacío.' });
    }

    const lobby = this._lobby.createLobby(socket.id, playerName);
    socket.join(lobby.roomId);

    console.log(`[Lobby] Created: ${lobby.roomId} by ${playerName} (${socket.id})`);
    socket.emit(LOBBY_CREATED, { roomId: lobby.roomId, lobby });
  }

  _handleJoin(socket, data) {
    const roomId   = data?.roomId?.trim().toUpperCase();
    const playerName = this._sanitizeName(data?.playerName);

    if (!playerName) {
      return socket.emit(LOBBY_ERROR, { message: 'El nombre no puede estar vacío.' });
    }
    if (!roomId || roomId.length !== 6) {
      return socket.emit(LOBBY_ERROR, { message: 'Código de sala no válido.' });
    }

    const result = this._lobby.joinLobby(roomId, socket.id, playerName);
    if (result.error) {
      return socket.emit(LOBBY_ERROR, { message: result.error });
    }

    socket.join(roomId);
    console.log(`[Lobby] Joined: ${roomId} by ${playerName} (${socket.id})`);

    // Tell the new player they joined
    socket.emit(LOBBY_JOINED, { roomId, lobby: result.lobby });
    // Tell everyone else the lobby changed
    socket.to(roomId).emit(LOBBY_UPDATED, { lobby: result.lobby });
  }

  _handleSelectCharacter(socket, data) {
    const character = data?.character;
    const result = this._lobby.selectCharacter(socket.id, character);

    if (result.error) {
      return socket.emit(LOBBY_ERROR, { message: result.error });
    }

    const { lobby } = result;
    this._io.to(lobby.roomId).emit(LOBBY_UPDATED, { lobby });
  }

  _handleReady(socket) {
    const result = this._lobby.setReady(socket.id);

    if (result.error) {
      return socket.emit(LOBBY_ERROR, { message: result.error });
    }

    const { lobby, shouldStart } = result;
    this._io.to(lobby.roomId).emit(LOBBY_UPDATED, { lobby });

    if (shouldStart) {
      this._startMatch(lobby);
    }
  }

  _handleDisconnect(socket) {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    const { lobby, wasLastPlayer, roomId } = this._lobby.removePlayer(socket.id);

    if (wasLastPlayer || !lobby) return; // room cleaned up, nothing to broadcast

    this._io.to(roomId).emit(LOBBY_UPDATED, { lobby });
    this._io.to(roomId).emit(LOBBY_PLAYER_LEFT, { socketId: socket.id });
  }

  // ─── Match start ──────────────────────────────────────────────────────────

  _startMatch(lobby) {
    const { matchId, session } = this._match.createMatch(lobby, this._io);
    // start() is async (Rapier WASM init). Fire and forget — errors are logged inside.
    session.start().catch((err) => {
      console.error(`[LobbyHandler] Physics init failed for ${matchId}:`, err);
    });

    console.log(`[Lobby] Match starting: ${matchId} — room ${lobby.roomId}`);
    this._io.to(lobby.roomId).emit(MATCH_START, {
      matchId,
      players: lobby.players,
      map: 'circular_mvp',
    });

    // Clean up lobby after a short delay (clients need time to receive the event)
    setTimeout(() => {
      this._lobby.deleteLobby(lobby.roomId);
      console.log(`[Lobby] Cleaned up room: ${lobby.roomId}`);
    }, 3000);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _sanitizeName(name) {
    if (typeof name !== 'string') return null;
    const trimmed = name.trim().slice(0, 20);
    return trimmed.length >= 2 ? trimmed : null;
  }
}
