import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// A failed lazy-chunk load means this page belongs to a previous deploy
// (its hashed chunks are gone from the server). Reload once to pick up the
// current build; the sessionStorage guard prevents a reload loop if the
// failure has some other cause.
window.addEventListener('vite:preloadError', (e) => {
  const key = 'threelab_chunk_reload'
  if (!sessionStorage.getItem(key)) {
    e.preventDefault()
    sessionStorage.setItem(key, String(Date.now()))
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
