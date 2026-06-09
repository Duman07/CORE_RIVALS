import { Server } from 'socket.io';

/**
 * SocketServer — thin wrapper around socket.io Server.
 * Handles CORS and gives handlers a clean interface.
 */
export class SocketServer {
  /**
   * @param {import('http').Server} httpServer
   * @param {string} clientUrl  — allowed CORS origin
   */
  constructor(httpServer, clientUrl) {
    this._io = new Server(httpServer, {
      cors: {
        origin: clientUrl,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });
  }

  get io() {
    return this._io;
  }
}
