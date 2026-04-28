import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Deck, Card } from './types';
import './SavedDecks.css';

export default function SavedDecks() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [decks, setDecks] = useState<Deck[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const loadDecks = async () => {
            if (!user) return;

            try {
                const querySnapshot = await getDocs(collection(db, 'users', user.uid, 'decks'));
                const loadedDecks: Deck[] = [];
                querySnapshot.forEach((docSnap) => {
                    loadedDecks.push({ id: docSnap.id, ...docSnap.data() } as Deck);
                });
                setDecks(loadedDecks);
            } catch (e) {
                console.error('Error loading decks:', e);
            }

            setLoading(false);
        };
        loadDecks();
    }, [user]);

    const handleDelete = async (deckId: string) => {
        if (!user) return;
        if (!confirm("Are you sure you want to delete this deck?")) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'decks', deckId));
            setDecks(decks.filter(d => d.id !== deckId));
        } catch (e) {
            console.error('Error deleting deck:', e);
            alert("Failed to delete deck.");
        }
    };

    const handleEdit = (deckId: string) => {
        navigate(`/build?edit=${deckId}`);
    };

    const handleShare = async (deck: Deck) => {
        if (!user) return;

        const cleanList = (list: Card[]) => list.map(card => ({
            id: card.id,
            name: card.name,
            type: card.type,
            card_images: [{
                image_url_small: card.card_images[0]?.image_url_small || "",
            }],
        }));

        const sharedDeckData = {
            name: deck.name || "Untitled Deck",
            main: cleanList(deck.main || []),
            extra: cleanList(deck.extra || []),
            side: cleanList(deck.side || []),
            ownerName: user.displayName || "Anonymous",
            ownerId: user.uid,
            originalDeckId: deck.id,
            createdAt: serverTimestamp(),
        };

        try {
            const docRef = await addDoc(collection(db, "sharedDecks"), sharedDeckData);
            const shareUrl = `${window.location.origin}/deck/${docRef.id}`;
            await navigator.clipboard.writeText(shareUrl);
            alert(`Link copied to clipboard:\n${shareUrl}`);
        } catch (error) {
            console.error("Error sharing deck:", error);
            alert("Failed to share deck.");
        }
    };

    const getTotalCards = (deck: Deck) => {
        return (deck.main?.length || 0) + (deck.extra?.length || 0) + (deck.side?.length || 0);
    };

    if (!user) {
        return (
            <div className="saved-decks-page">
                <div className="login-prompt">
                    <h2>Please log in to view your saved decks.</h2>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="saved-decks-page">
                <div className="loading">Loading your decks...</div>
            </div>
        );
    }

    return (
        <div className="saved-decks-page">
            <div className="page-header">
                <h1>My Decks</h1>
                <Link to="/" className="btn-primary">+ Create New Deck</Link>
            </div>

            {decks.length > 0 ? (
                <div className="decks-grid">
                    {decks.map((deck) => (
                        <div key={deck.id} className="saved-deck-card">
                            <div className="deck-card-header">
                                <h3>{deck.name || "Untitled Deck"}</h3>
                                <span className="card-count">{getTotalCards(deck)} cards</span>
                            </div>
                            <div className="deck-preview-images">
                                {deck.main?.slice(0, 4).map((card, i) => (
                                    <img key={i} src={card.card_images?.[0]?.image_url_small} alt={card.name} />
                                ))}
                                {(deck.main?.length || 0) === 0 && <span className="no-cards">No cards</span>}
                            </div>
                            <div className="deck-stats">
                                <span>Main: {deck.main?.length || 0}</span>
                                <span>Extra: {deck.extra?.length || 0}</span>
                                <span>Side: {deck.side?.length || 0}</span>
                            </div>
                            <div className="card-actions">
                                <button onClick={() => handleEdit(deck.id)} className="btn-primary btn-sm">Edit</button>
                                <button onClick={() => handleShare(deck)} className="btn-secondary btn-sm">Share</button>
                                <button onClick={() => handleDelete(deck.id)} className="btn-danger btn-sm">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <p>You haven't saved any decks yet.</p>
                    <Link to="/" className="btn-primary">Create Your First Deck</Link>
                </div>
            )}
        </div>
    );
}
