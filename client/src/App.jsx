import { Routes, Route, Navigate } from 'react-router-dom';
import Home        from './features/lobby/components/Home.jsx';
import WaitingRoom from './features/lobby/components/WaitingRoom.jsx';
import GameCanvas  from './features/match/components/GameCanvas.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/"               element={<Home />} />
      <Route path="/lobby/:roomId"  element={<WaitingRoom />} />
      <Route path="/match/:matchId" element={<GameCanvas />} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  );
}
