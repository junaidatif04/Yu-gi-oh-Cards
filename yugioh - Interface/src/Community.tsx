import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, orderBy, getDocs, doc, runTransaction, getDoc } from 'firebase/firestore';
import type { User } from "firebase/auth";
import type { SharedDeck } from "./types";
import './Community.css';

export default function Community() {
    const [user, setUser] = useState<User | null>(null);
    const [decks, setDecks] = useState<SharedDeck[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'newest' | 'popular'>('newest');
    const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | null>>({});

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        loadDecks();
        if (user) loadUserVotes();
    }, [user, filter]); // Reload when user logs in or filter changes

    const loadDecks = async () => {
        setLoading(true);
        try {
            let q = query(collection(db, "sharedDecks"), orderBy("createdAt", "desc"));
            if (filter === 'popular') {
                q = query(collection(db, "sharedDecks"), orderBy("voteScore", "desc"));
            }

            const snapshot = await getDocs(q);
            const loaded: SharedDeck[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                loaded.push({
                    id: doc.id,
                    name: data.name || "Untitled Deck",
                    ownerName: data.ownerName || "Anonymous",
                    ownerId: data.ownerId,
                    upvotes: data.upvotes || 0,
                    downvotes: data.downvotes || 0,
                    voteScore: data.voteScore || 0,
                    main: data.main || [],
                    extra: data.extra || [],
                    side: data.side || []
                });
            });
            setDecks(loaded);
        } catch (error) {
            console.error("Error loading community decks:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadUserVotes = async () => {
        // This function is handled by the useEffect below that fetches votes on deck load
    };

    const handleVote = async (deckId: string, type: 'up' | 'down') => {
        if (!user) {
            alert("Please log in to vote.");
            return;
        }

        // Optimistic UI update
        const deckIndex = decks.findIndex(d => d.id === deckId);
        if (deckIndex === -1) return;
        const currentDeck = decks[deckIndex];

        // This is complex to do optimistically without knowing previous vote.
        // Let's do the transaction and update state after.

        try {
            await runTransaction(db, async (transaction) => {
                const deckRef = doc(db, "sharedDecks", deckId);
                const voteRef = doc(db, "sharedDecks", deckId, "votes", user.uid);

                const deckDoc = await transaction.get(deckRef);
                const voteDoc = await transaction.get(voteRef);

                if (!deckDoc.exists()) throw "Deck does not exist!";

                let newUpvotes = deckDoc.data().upvotes || 0;
                let newDownvotes = deckDoc.data().downvotes || 0;
                let previousVote = voteDoc.exists() ? voteDoc.data().voteType : null;

                if (previousVote === type) {
                    // Removing vote
                    if (type === 'up') newUpvotes--;
                    else newDownvotes--;
                    transaction.delete(voteRef);
                    setUserVotes(prev => ({ ...prev, [deckId]: null }));
                } else {
                    // Changing or adding vote
                    if (previousVote === 'up') newUpvotes--;
                    if (previousVote === 'down') newDownvotes--;

                    if (type === 'up') newUpvotes++;
                    else newDownvotes++;

                    transaction.set(voteRef, { voteType: type });
                    setUserVotes(prev => ({ ...prev, [deckId]: type }));
                }

                transaction.update(deckRef, {
                    upvotes: newUpvotes,
                    downvotes: newDownvotes,
                    voteScore: newUpvotes - newDownvotes
                });

                // Update local state
                const updatedDecks = [...decks];
                updatedDecks[deckIndex] = {
                    ...currentDeck,
                    upvotes: newUpvotes,
                    downvotes: newDownvotes,
                    voteScore: newUpvotes - newDownvotes
                };
                setDecks(updatedDecks);
            });
        } catch (e) {
            console.error("Vote failed:", e);
            alert("Vote failed. Please try again.");
        }
    };

    // Helper to get highlighting class
    const getVoteClass = (deckId: string, type: 'up' | 'down') => {
        return userVotes[deckId] === type ? 'active' : '';
    };

    // Fetch user's vote status on load
    useEffect(() => {
        if (!user || decks.length === 0) return;

        const fetchVotes = async () => {
            const votes: Record<string, 'up' | 'down' | null> = {};
            // Limit to first 20 for safety
            for (const deck of decks.slice(0, 20)) {
                const snap = await getDoc(doc(db, "sharedDecks", deck.id, "votes", user.uid));
                if (snap.exists()) {
                    votes[deck.id] = snap.data().voteType;
                }
            }
            setUserVotes(votes);
        };
        fetchVotes();
    }, [user, decks.length === 0 ? 0 : decks[0].id]); // Crude dependency check

    return (
        <div className="community-page">
            <div className="community-header">
                <h1>Community Decks</h1>
                <div className="filter-controls">
                    <button
                        className={`filter-btn ${filter === 'newest' ? 'active' : ''}`}
                        onClick={() => setFilter('newest')}
                    >
                        Newest
                    </button>
                    <button
                        className={`filter-btn ${filter === 'popular' ? 'active' : ''}`}
                        onClick={() => setFilter('popular')}
                    >
                        Popular
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading community decks...</div>
            ) : (
                <div className="decks-grid">
                    {decks.map(deck => (
                        <div key={deck.id} className="saved-deck-card community-card">
                            <div className="deck-card-header">
                                <div className="header-info">
                                    <h3>{deck.name}</h3>
                                    <span className="author">by {deck.ownerName}</span>
                                </div>
                                <span className="card-count">{deck.main?.length || 0} cards</span>
                            </div>

                            <div className="deck-stats vote-stats">
                                <div className="vote-controls">
                                    <button
                                        className={`vote-btn up ${getVoteClass(deck.id, 'up')}`}
                                        onClick={() => handleVote(deck.id, 'up')}
                                    >
                                        ▲
                                    </button>
                                    <span className="vote-score">{deck.voteScore}</span>
                                    <button
                                        className={`vote-btn down ${getVoteClass(deck.id, 'down')}`}
                                        onClick={() => handleVote(deck.id, 'down')}
                                    >
                                        ▼
                                    </button>
                                </div>
                            </div>

                            <div className="card-actions">
                                <Link to={`/deck/${deck.id}`} className="btn-primary btn-sm">
                                    View Deck
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
