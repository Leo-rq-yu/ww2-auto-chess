import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { InsforgeProvider } from '@insforge/react'
import { insforge } from './services/insforge'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InsforgeProvider client={insforge}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </InsforgeProvider>
  </StrictMode>,
)
