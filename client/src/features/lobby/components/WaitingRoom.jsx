import { Link, useParams, Navigate } from 'react-router-dom';
import { useLobby } from '../hooks/useLobby.js';
import { CHARACTER_STATS, MAX_PLAYERS } from '@core-rivals/shared/constants/GameConstants';
import './WaitingRoom.css';

// ─── Sub-components ────────────────────────────────────────────────────────────

function CharacterPicker({ takenCharacters, selected, onSelect }) {
  return (
    <div className="char-picker">
      {Object.entries(CHARACTER_STATS).map(([id, { displayName, role }]) => {
        const isTaken    = takenCharacters.includes(id);
        const isSelected = selected === id;
        return (
          <button
            key={id}
            className={[
              'char-card',
              isSelected ? 'char-card--selected' : '',
              isTaken    ? 'char-card--taken'    : '',
            ].join(' ')}
            onClick={() => !isTaken && onSelect(id)}
            disabled={isTaken}
            title={isTaken ? 'Ya elegido por otro jugador' : ''}
          >
            <span className="char-card__name">{displayName}</span>
            <span className="char-card__role">{role}</span>
          </button>
        );
      })}
    </div>
  );
}

function PlayerAvatar({ character }) {
  if (!character) return <div className="player-slot__avatar">?</div>;
  const initial = CHARACTER_STATS[character]?.displayName[0] ?? '?';
  return (
    <div className={`player-slot__avatar player-slot__avatar--${character}`}>
      {initial}
    </div>
  );
}

function PlayerSlot({ player, isMine, takenCharacters, onSelectCharacter }) {
  if (!player) {
    return (
      <div className="player-slot player-slot--empty">
        <div className="player-slot__avatar">—</div>
        <p className="player-slot__name player-slot__name--empty">Esperando jugador...</p>
      </div>
    );
  }

  const charInfo = player.character ? CHARACTER_STATS[player.character] : null;

  return (
    <div
      className={[
        'player-slot',
        isMine          ? 'player-slot--mine'  : '',
        player.ready    ? 'player-slot--ready'  : '',
      ].join(' ')}
    >
      <PlayerAvatar character={player.character} />

      <p className="player-slot__name">
        {player.name}
        {isMine && <span style={{ color: 'var(--accent)', fontSize: 12 }}> (tú)</span>}
      </p>

      {/* Character picker — only shown for own slot */}
      {isMine ? (
        <CharacterPicker
          takenCharacters={takenCharacters}
          selected={player.character}
          onSelect={onSelectCharacter}
        />
      ) : (
        <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {charInfo
            ? <><strong style={{ color: 'var(--text-primary)' }}>{charInfo.displayName}</strong><br />{charInfo.role}</>
            : 'Eligiendo personaje...'}
        </div>
      )}

      <div className="player-slot__status">
        <span className={`badge ${player.ready ? 'badge-ready' : 'badge-waiting'}`}>
          {player.ready ? 'Listo' : 'Esperando'}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function WaitingRoom() {
  const { roomId } = useParams();
  const {
    socketId,
    lobby,
    error,
    clearError,
    selectCharacter,
    toggleReady,
  } = useLobby();

  // If we navigated here without lobby state (e.g. hard refresh), redirect home
  if (!lobby) {
    return <Navigate to="/" replace />;
  }

  const me              = lobby.players.find((p) => p.socketId === socketId);
  const takenChars      = lobby.players
    .filter((p) => p.socketId !== socketId && p.character)
    .map((p) => p.character);
  const readyCount      = lobby.players.filter((p) => p.ready).length;
  const isStarting      = lobby.status === 'starting';
  const canReady        = !!me?.character;
  const isReady         = !!me?.ready;
  const slots           = [1, 2, 3].map((s) => lobby.players.find((p) => p.slot === s) ?? null);

  return (
    <div className="room">
      {/* Header */}
      <header className="room__header">
        <Link to="/" className="room__logo">Core Rivals</Link>
        <div className="room__code-wrap">
          <span className="room__code-label">Código de sala</span>
          <span className="room__code">{roomId}</span>
        </div>
      </header>

      {/* Player slots */}
      <div className="room__players">
        {slots.map((player, i) => (
          <PlayerSlot
            key={i}
            player={player}
            isMine={player?.socketId === socketId}
            takenCharacters={takenChars}
            onSelectCharacter={(char) => { clearError(); selectCharacter(char); }}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="room__actions">
        {isStarting ? (
          <div className="room__starting">
            <p className="room__starting-title">¡Todos listos!</p>
            <p className="room__starting-sub">La partida comienza ahora...</p>
          </div>
        ) : (
          <>
            <p className="room__waiting-msg">
              {lobby.players.length < MAX_PLAYERS
                ? <>Esperando jugadores... <span>{lobby.players.length}/{MAX_PLAYERS}</span></>
                : <>Jugadores listos: <span>{readyCount}/{MAX_PLAYERS}</span></>}
            </p>

            {me && (
              <button
                className={`btn btn-full ${isReady ? 'btn-danger' : 'btn-success'}`}
                style={{ maxWidth: 280 }}
                onClick={toggleReady}
                disabled={!canReady}
                title={!canReady ? 'Selecciona un personaje primero' : ''}
              >
                {isReady ? 'Cancelar listo' : 'Estoy listo'}
              </button>
            )}

            {!canReady && me && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Elige un personaje para poder marcar listo
              </p>
            )}

            {error && <p className="error-msg room__error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
