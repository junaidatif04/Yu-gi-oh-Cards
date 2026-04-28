import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import Chat from './Chat';
import ChatSidebar from './ChatSidebar';
import './ChatPage.css';

interface CardData {
    id: number;
    name: string;
    type: string;
    card_images: { image_url_small: string }[];
}

export default function ChatPage() {
    const [user, setUser] = useState<User | null>(null);
    const [mainDeck, setMainDeck] = useState<CardData[]>([]);
    const [extraDeck, setExtraDeck] = useState<CardData[]>([]);
    const [sideDeck, setSideDeck] = useState<CardData[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            // Clear session when user changes
            setActiveSessionId(null);
        });
        return () => unsubscribe();
    }, []);

    // Load user's saved deck for context
    useEffect(() => {
        const loadDeck = async () => {
            if (!user) return;
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.deckData) {
                        setMainDeck(data.deckData.main || []);
                        setExtraDeck(data.deckData.extra || []);
                        setSideDeck(data.deckData.side || []);
                    }
                }
            } catch (e) {
                console.error('Error loading deck for chat context:', e);
            }
        };
        loadDeck();
    }, [user]);

    const handleSelectSession = (sessionId: string) => {
        setActiveSessionId(sessionId);
    };

    const handleNewChat = () => {
        setActiveSessionId(null);
    };

    const handleSessionCreated = (sessionId: string) => {
        setActiveSessionId(sessionId);
    };

    return (
        <div className="chat-page">
            <div className="chat-page-header">
                <h1>Duel Strategy AI</h1>
                <p>Ask me anything about Yu-Gi-Oh! rules, strategies, and card combos.</p>
                {user && mainDeck.length > 0 && (
                    <span className="deck-loaded-badge">
                        Your saved deck is loaded ({mainDeck.length + extraDeck.length + sideDeck.length} cards)
                    </span>
                )}
            </div>

            <div className="chat-layout">
                {user && (
                    <ChatSidebar
                        activeSessionId={activeSessionId}
                        onSelectSession={handleSelectSession}
                        onNewChat={handleNewChat}
                    />
                )}

                <div className="chat-fullscreen-wrapper">
                    <Chat
                        mainDeck={mainDeck as any}
                        extraDeck={extraDeck as any}
                        sideDeck={sideDeck as any}
                        alwaysOpen={true}
                        sessionId={activeSessionId}
                        onSessionCreated={handleSessionCreated}
                    />
                </div>
            </div>
        </div>
    );
}
