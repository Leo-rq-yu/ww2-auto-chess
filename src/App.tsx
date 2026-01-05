import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage, LobbyPage, GamePage } from './pages';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/game/:matchId" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
