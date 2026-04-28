import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import Layout from './Layout.tsx'
import LandingPage from './LandingPage.tsx'
import DeckBuilder from './DeckBuilder.tsx'
import ChatPage from './ChatPage.tsx'
import SavedDecks from './SavedDecks.tsx'
import Community from './Community.tsx'
import AdminDashboard from './AdminDashboard.tsx'
import SharedDeckView from './SharedDeckView.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/build" element={<DeckBuilder />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/saved-decks" element={<SavedDecks />} />
          <Route path="/community" element={<Community />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
        <Route path="/deck/:deckId" element={<SharedDeckView />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

