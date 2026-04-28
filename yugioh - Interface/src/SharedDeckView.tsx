import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import './SharedDeckView.css';

interface CardData {
    id: number;
    name: string;
    type: string;
    card_images: { image_url_small: string }[];
}

interface DeckData {
    main: CardData[];
    extra: CardData[];
    side: CardData[];
    ownerName?: string;
    createdAt?: unknown;
}

export default function SharedDeckView() {
    const { deckId } = useParams<{ deckId: string }>();
    const [deckData, setDeckData] = useState<DeckData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDeck = async () => {
            if (!deckId) {
                setError('No deck ID provided.');
                setLoading(false);
                return;
            }

            try {
                const docRef = doc(db, 'sharedDecks', deckId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setDeckData(docSnap.data() as DeckData);
                } else {
                    setError('Deck not found. It may have been deleted.');
                }
            } catch (e) {
                console.error('Error fetching shared deck:', e);
                setError('Failed to load deck. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchDeck();
    }, [deckId]);

    if (loading) {
        return <div className="shared-deck-loading">Loading deck...</div>;
    }

    if (error) {
        return (
            <div className="shared-deck-error">
                <p>{error}</p>
                <Link to="/community" className="btn-ghost">Go to Community</Link>
            </div>
        );
    }

    if (!deckData) {
        return null;
    }

    return (
        <div className="shared-deck-container">
            <header className="shared-deck-header">
                <h1>Shared Deck</h1>
                {deckData.ownerName && <span className="owner-badge">By: {deckData.ownerName}</span>}
                <Link to="/community" className="btn-ghost">← Back to Community</Link>
            </header>

            <section className="shared-deck-section">
                <h2>Main Deck ({deckData.main?.length || 0})</h2>
                <div className="shared-deck-grid">
                    {deckData.main?.length === 0 && <p className="empty-msg">Empty</p>}
                    {deckData.main?.map((card, i) => (
                        <div key={`main-${i}`} className="shared-card">
                            <img src={card.card_images?.[0]?.image_url_small} alt={card.name} />
                            <span>{card.name}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="shared-deck-section">
                <h2>Extra Deck ({deckData.extra?.length || 0})</h2>
                <div className="shared-deck-grid">
                    {deckData.extra?.length === 0 && <p className="empty-msg">Empty</p>}
                    {deckData.extra?.map((card, i) => (
                        <div key={`extra-${i}`} className="shared-card">
                            <img src={card.card_images?.[0]?.image_url_small} alt={card.name} />
                            <span>{card.name}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="shared-deck-section">
                <h2>Side Deck ({deckData.side?.length || 0})</h2>
                <div className="shared-deck-grid">
                    {deckData.side?.length === 0 && <p className="empty-msg">Empty</p>}
                    {deckData.side?.map((card, i) => (
                        <div key={`side-${i}`} className="shared-card">
                            <img src={card.card_images?.[0]?.image_url_small} alt={card.name} />
                            <span>{card.name}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
