import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import './i18n'
import { WalletProvider } from './context/WalletProvider.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </WalletProvider>
    </BrowserRouter>
  </StrictMode>,
)
