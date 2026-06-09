import http from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './config/server.js';
import { SocketServer } from './infrastructure/socket/SocketServer.js';
import { LobbyHandler } from './infrastructure/socket/LobbyHandler.js';
import { MatchHandler } from './infrastructure/socket/MatchHandler.js';
import { LobbyManager } from './game/LobbyManager.js';
import { MatchManager } from './game/MatchManager.js';

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', phase: 3, timestamp: Date.now() });
});

// ─── HTTP + Socket.IO ─────────────────────────────────────────────────────────
const httpServer = http.createServer(app);
const socketServer = new SocketServer(httpServer, config.clientUrl);
const { io } = socketServer;

// ─── Game layer ───────────────────────────────────────────────────────────────
const lobbyManager = new LobbyManager();
const matchManager = new MatchManager();

// ─── Handlers ─────────────────────────────────────────────────────────────────
const lobbyHandler = new LobbyHandler(io, lobbyManager, matchManager);
const matchHandler = new MatchHandler(io, matchManager);

// LobbyHandler registers the 'connection' event and owns the socket lifecycle.
// MatchHandler registers per-socket game listeners inside that same connection.
lobbyHandler.initialize();

io.on('connection', (socket) => {
  matchHandler.initialize(socket);
});

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(config.port, () => {
  console.log(`\n🎮 CORE RIVALS — Server`);
  console.log(`   Port    : ${config.port}`);
  console.log(`   Client  : ${config.clientUrl}`);
  console.log(`   Phase   : 3 (Movement + Sync)\n`);
});
