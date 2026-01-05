import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Removed StrictMode to prevent double execution of effects
createRoot(document.getElementById('root')!).render(
  <App />,
)
