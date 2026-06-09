import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

/**
 * SocketClient — singleton WebSocket connection to the game server.
 *
 * Usage:
 *   import socketClient from '@/infrastructure/socket/SocketClient';
 *   const socket = socketClient.connect();
 *   socket.emit('lobby:create', { playerName: 'Moises' });
 */
class SocketClient {
  constructor() {
    this._socket = null;
  }

  connect() {
    if (this._socket?.connected) return this._socket;

    this._socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });

    this._socket.on('connect', () => {
      console.log(`[Socket] Connected: ${this._socket.id}`);
    });
    this._socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });
    this._socket.on('connect_error', (err) => {
      console.error(`[Socket] Connection error: ${err.message}`);
    });

    return this._socket;
  }

  disconnect() {
    this._socket?.disconnect();
    this._socket = null;
  }

  /** @returns {import('socket.io-client').Socket | null} */
  get socket() {
    return this._socket;
  }
}

export default new SocketClient();
