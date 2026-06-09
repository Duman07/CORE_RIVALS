/**
 * ScoreDisplay — HUD panel showing live scores for all 3 players.
 *
 * Positioned at the top-centre of the screen. Receives `players` (static lobby
 * data) and `scores` (live map of socketId → number) from useGame hook.
 * pointer-events: none so it never blocks mouse input to the canvas.
 */

import React from 'react';

const CHARACTER_HUE = { duman: '#e74c3c', moises: '#3498db', sebastian: '#9b59b6' };

/**
 * @param {{ players: Array<{ socketId:string, name:string, character:string }>,
 *            scores: Record<string, number> }} props
 */
export function ScoreDisplay({ players = [], scores = {} }) {
  if (!players.length) return null;

  return (
    <div style={styles.root}>
      {players.map((p) => (
        <div key={p.socketId} style={styles.card}>
          <div style={{ ...styles.bar, background: CHARACTER_HUE[p.character] ?? '#888' }} />
          <div style={styles.name}>{(p.name ?? p.character).toUpperCase()}</div>
          <div style={styles.score}>{scores[p.socketId] ?? 0}</div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  root: {
    position:      'absolute',
    top:           12,
    left:          '50%',
    transform:     'translateX(-50%)',
    display:       'flex',
    gap:           16,
    pointerEvents: 'none',
    userSelect:    'none',
    zIndex:        10,
  },
  card: {
    background:   'rgba(0,0,0,0.55)',
    borderRadius: 8,
    padding:      '6px 18px 8px',
    textAlign:    'center',
    minWidth:     72,
    overflow:     'hidden',
    position:     'relative',
  },
  bar: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    height:   3,
  },
  name: {
    fontSize:      10,
    letterSpacing: '0.1em',
    color:         'rgba(255,255,255,0.55)',
    marginTop:     4,
    fontFamily:    '"Rajdhani", "Inter", monospace',
  },
  score: {
    fontSize:   34,
    fontWeight: 700,
    color:      '#fff',
    lineHeight: 1.1,
    fontFamily: '"Rajdhani", "Inter", monospace',
  },
};
