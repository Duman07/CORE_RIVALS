import { useState } from 'react';
import { useLobby } from '../hooks/useLobby.js';
import './Home.css';

export default function Home() {
  const {
    connected,
    playerName,
    error,
    setPlayerName,
    clearError,
    createRoom,
    joinRoom,
  } = useLobby();

  const [joinCode, setJoinCode] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    createRoom(playerName.trim());
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !joinCode.trim()) return;
    joinRoom(joinCode.trim().toUpperCase(), playerName.trim());
  };

  const handleNameChange = (e) => {
    clearError();
    setPlayerName(e.target.value);
  };

  return (
    <main className="home">
      <h1 className="home__title">CORE RIVALS</h1>
      <p className="home__subtitle">1 vs 1 vs 1 — Golf · Arco · Lucha</p>

      <div className="home__panel">
        <p className="home__panel-title">Entrar al juego</p>

        {/* Player name — shared for both actions */}
        <div className="home__field">
          <label className="home__label" htmlFor="playerName">Tu nombre</label>
          <input
            id="playerName"
            className="input"
            type="text"
            placeholder="Máximo 20 caracteres"
            maxLength={20}
            value={playerName}
            onChange={handleNameChange}
            autoFocus
            autoComplete="off"
          />
        </div>

        {error && <p className="error-msg">{error}</p>}

        <div className="home__actions">
          <button
            className="btn btn-primary btn-full"
            onClick={handleCreate}
            disabled={!connected || !playerName.trim()}
          >
            Crear sala
          </button>
        </div>

        <div className="home__divider">o únete a una sala</div>

        <form className="home__join-row" onSubmit={handleJoin}>
          <input
            className="input"
            type="text"
            placeholder="Código (ej. A3K7BX)"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-secondary"
            disabled={!connected || !playerName.trim() || joinCode.trim().length !== 6}
          >
            Unirse
          </button>
        </form>

        <p className={`home__connection${connected ? ' home__connection--connected' : ''}`}>
          {connected ? 'Conectado al servidor' : 'Conectando...'}
        </p>
      </div>
    </main>
  );
}
