import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Make ReactDOM available globally for dynamic element rendering
window.ReactDOM = ReactDOM;

ReactDOM.createRoot(document.getElementById('root')!).render(
  // React 19 has a more aggressive StrictMode that can cause Leaflet issues
  // For production, you may want to re-enable StrictMode
  <App />
)