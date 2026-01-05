import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@insforge/react'
import AuthPage from './pages/AuthPage'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'

function App() {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={isSignedIn ? <Navigate to="/lobby" replace /> : <AuthPage />}
      />
      <Route
        path="/lobby"
        element={isSignedIn ? <LobbyPage /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/game/:matchId"
        element={isSignedIn ? <GamePage /> : <Navigate to="/auth" replace />}
      />
      <Route path="/" element={<Navigate to={isSignedIn ? "/lobby" : "/auth"} replace />} />
    </Routes>
  )
}

export default App
