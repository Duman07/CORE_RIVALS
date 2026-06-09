import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socketClient from '../../../infrastructure/socket/SocketClient.js';
import useLobbyStore from '../store/lobbyStore.js';
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
 * useLobby — central hook for all lobby interactions.
 *
 * Connects to the server, registers all relevant Socket.IO listeners,
 * and exposes action functions to components.
 *
 * Call this hook ONCE at the top of each screen that needs lobby state.
 * Listeners are cleaned up on unmount.
 */
export function useLobby() {
  const navigate = useNavigate();
  const store    = useLobbyStore();

  // ─── Connect & register listeners ──────────────────────────────────────────
  useEffect(() => {
    const socket = socketClient.connect();

    const onConnect = () => {
      store.setConnected(true);
      store.setSocketId(socket.id);
    };
    const onDisconnect = () => {
      store.setConnected(false);
    };
    const onCreated = ({ roomId, lobby }) => {
      store.setRoomId(roomId);
      store.setLobby(lobby);
      store.clearError();
      navigate(`/lobby/${roomId}`);
    };
    const onJoined = ({ roomId, lobby }) => {
      store.setRoomId(roomId);
      store.setLobby(lobby);
      store.clearError();
      navigate(`/lobby/${roomId}`);
    };
    const onUpdated = ({ lobby }) => {
      store.setLobby(lobby);
    };
    const onError = ({ message }) => {
      store.setError(message);
    };
    const onPlayerLeft = () => {
      // lobby:updated is also sent; this can be used for a toast notification
    };
    const onMatchStart = ({ matchId, players, map }) => {
      store.setMatchId(matchId);
      navigate(`/match/${matchId}`);
    };

    socket.on('connect',          onConnect);
    socket.on('disconnect',       onDisconnect);
    socket.on(LOBBY_CREATED,      onCreated);
    socket.on(LOBBY_JOINED,       onJoined);
    socket.on(LOBBY_UPDATED,      onUpdated);
    socket.on(LOBBY_ERROR,        onError);
    socket.on(LOBBY_PLAYER_LEFT,  onPlayerLeft);
    socket.on(MATCH_START,        onMatchStart);

    // Sync connected state if already connected (StrictMode double-mount)
    if (socket.connected) {
      store.setConnected(true);
      store.setSocketId(socket.id);
    }

    return () => {
      socket.off('connect',         onConnect);
      socket.off('disconnect',      onDisconnect);
      socket.off(LOBBY_CREATED,     onCreated);
      socket.off(LOBBY_JOINED,      onJoined);
      socket.off(LOBBY_UPDATED,     onUpdated);
      socket.off(LOBBY_ERROR,       onError);
      socket.off(LOBBY_PLAYER_LEFT, onPlayerLeft);
      socket.off(MATCH_START,       onMatchStart);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const createRoom = useCallback((playerName) => {
    store.clearError();
    socketClient.socket?.emit(LOBBY_CREATE, { playerName });
  }, []);

  const joinRoom = useCallback((roomId, playerName) => {
    store.clearError();
    socketClient.socket?.emit(LOBBY_JOIN, { roomId, playerName });
  }, []);

  const selectCharacter = useCallback((character) => {
    store.clearError();
    socketClient.socket?.emit(LOBBY_SELECT_CHARACTER, { character });
  }, []);

  const toggleReady = useCallback(() => {
    store.clearError();
    socketClient.socket?.emit(LOBBY_READY);
  }, []);

  return {
    // State
    connected:  store.connected,
    socketId:   store.socketId,
    playerName: store.playerName,
    roomId:     store.roomId,
    lobby:      store.lobby,
    matchId:    store.matchId,
    error:      store.error,
    // Setters
    setPlayerName: store.setPlayerName,
    clearError:    store.clearError,
    // Actions
    createRoom,
    joinRoom,
    selectCharacter,
    toggleReady,
  };
}
