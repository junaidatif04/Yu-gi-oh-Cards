import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Card } from "./types";
import type { User } from "firebase/auth";
import "./App.css";
import Chat from "./Chat";

const STORAGE_KEY = 'yugioh_session_deck';

export default function DeckBuilder() {
    const [searchParams] = useSearchParams();
    const editDeckId = searchParams.get('edit');

    const [cards, setCards] = useState<Card[]>([]);
    const [search, setSearch] = useState<string>("");
    const [user, setUser] = useState<User | null>(null);

    // Deck data
    const [deckName, setDeckName] = useState<string>("");
    const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);
    const [mainDeck, setMainDeck] = useState<Card[]>([]);
    const [extraDeck, setExtraDeck] = useState<Card[]>([]);
    const [sideDeck, setSideDeck] = useState<Card[]>([]);
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);

    // Expanded/collapsed state for deck sections
    const [expandedSections, setExpandedSections] = useState<{ main: boolean; extra: boolean; side: boolean }>({
        main: true, extra: true, side: true
    });

    const toggleSection = (section: 'main' | 'extra' | 'side') => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Group cards by ID and count duplicates
    const groupCards = (cards: Card[]) => {
        const grouped = new Map<number, { card: Card; count: number }>();
        cards.forEach(card => {
            const existing = grouped.get(card.id);
            if (existing) {
                existing.count++;
            } else {
                grouped.set(card.id, { card, count: 1 });
            }
        });
        return Array.from(grouped.values());
    };

    // Sort cards: Monsters first, then Spells, then Traps
    const sortByType = (cards: { card: Card; count: number }[]) => {
        const getTypeOrder = (type: string) => {
            if (type.includes('Spell')) return 2;
            if (type.includes('Trap')) return 3;
            return 1; // Monster types
        };
        return [...cards].sort((a, b) => getTypeOrder(a.card.type) - getTypeOrder(b.card.type));
    };

    // Save to localStorage whenever deck changes (session persistence)
    useEffect(() => {
        const deckData = { main: mainDeck, extra: extraDeck, side: sideDeck, name: deckName, id: currentDeckId };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deckData));
    }, [mainDeck, extraDeck, sideDeck, deckName, currentDeckId]);

    // Load from localStorage on mount if no editDeckId
    useEffect(() => {
        if (editDeckId) return; // Don't load from localStorage if editing
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            setMainDeck(parsed.main || []);
            setExtraDeck(parsed.extra || []);
            setSideDeck(parsed.side || []);
            setDeckName(parsed.name || "");
            setCurrentDeckId(parsed.id || null);
        }
    }, [editDeckId]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    // Load deck if editDeckId is present
    useEffect(() => {
        const loadDeckForEdit = async () => {
            if (!user || !editDeckId) return;

            try {
                const docRef = doc(db, "users", user.uid, "decks", editDeckId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDeckName(data.name || "Untitled Deck");
                    setMainDeck(data.main || []);
                    setExtraDeck(data.extra || []);
                    setSideDeck(data.side || []);
                    setCurrentDeckId(editDeckId);
                } else {
                    alert("Deck not found.");
                }
            } catch (e) {
                console.error("Error loading deck for edit:", e);
            }
        };
        loadDeckForEdit();
    }, [user, editDeckId]);

    const handleSearch = async () => {
        const baseurl = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
        const url = search
            ? `${baseurl}?fname=${encodeURIComponent(search)}`
            : baseurl;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Network response was not ok. Status: ${response.status}`);
            }
            const data = await response.json();
            setCards(data.data || []);
        } catch (error) {
            console.error("Error fetching data:", error);
            setCards([]);
        }
    };

    const getDestinationDeck = (card: Card): "Main" | "Extra" | "Side" => {
        if (card.type.includes("Synchro") || card.type.includes("Fusion") || card.type.includes("XYZ") || card.type.includes("Link")) {
            return "Extra";
        }
        return "Main";
    };

    const getGlobalCopyCount = (cardId: number) => {
        const allCards = [...mainDeck, ...extraDeck, ...sideDeck];
        return allCards.filter(c => c.id === cardId).length;
    };

    const validateDeck = (): string[] => {
        const errors: string[] = [];

        // 1. Main Deck Size
        if (mainDeck.length < 40) errors.push(`Main Deck is too small (${mainDeck.length}/40). Minimum 40 cards required.`);
        if (mainDeck.length > 60) errors.push(`Main Deck is too large (${mainDeck.length}/60). Maximum 60 cards allowed.`);

        // 2. Extra Deck Size
        if (extraDeck.length > 15) errors.push(`Extra Deck is too large (${extraDeck.length}/15).`);

        // 3. Side Deck Size
        if (sideDeck.length > 15) errors.push(`Side Deck is too large (${sideDeck.length}/15).`);

        // 4. Card Copies (Global Check)
        const allCards = [...mainDeck, ...extraDeck, ...sideDeck];
        const counts = new Map<string, number>();
        allCards.forEach(c => {
            counts.set(c.name, (counts.get(c.name) || 0) + 1);
        });

        counts.forEach((count, name) => {
            if (count > 3) errors.push(`Too many copies of "${name}" (${count}/3).`);
        });

        return errors;
    };

    const addTodeck = (card: Card) => {
        // Global Copy Check
        if (getGlobalCopyCount(card.id) >= 3) {
            alert("You have reached the maximum of 3 copies for this card across all decks.");
            return;
        }

        const dest = getDestinationDeck(card);
        if (dest === "Main") {
            if (mainDeck.length >= 60) {
                alert("Main Deck is full (60 cards max).");
                return;
            }
            setMainDeck(prev => [...prev, card]);
        } else if (dest === "Extra") {
            if (extraDeck.length >= 15) {
                alert("Extra Deck is full (15 cards max).");
                return;
            }
            setExtraDeck(prev => [...prev, card]);
        }
    };

    const addToSideDeck = (card: Card) => {
        // Global Copy Check
        if (getGlobalCopyCount(card.id) >= 3) {
            alert("You have reached the maximum of 3 copies for this card across all decks.");
            return;
        }

        if (sideDeck.length >= 15) {
            alert("Side Deck is full (15 cards max).");
            return;
        }
        setSideDeck(prev => [...prev, card]);
    };

    const handleInfoClick = (card: Card) => {
        setSelectedCard(card);
    };

    const closeInfoModal = () => {
        setSelectedCard(null);
    };

    const removecard = (cardToRemove: Card, fromDeckType: "Main" | "Extra" | "Side") => {
        const removeSingleInstance = (list: Card[]) => {
            const index = list.findIndex(c => c.id === cardToRemove.id);
            if (index > -1) {
                const newList = [...list];
                newList.splice(index, 1);
                return newList;
            }
            return list;
        };

        if (fromDeckType === "Main") {
            setMainDeck(removeSingleInstance(mainDeck));
        } else if (fromDeckType === "Extra") {
            setExtraDeck(removeSingleInstance(extraDeck));
        } else if (fromDeckType === "Side") {
            setSideDeck(removeSingleInstance(sideDeck));
        }
    };

    const cleanList = (list: Card[]) => list.map(card => ({
        id: card.id,
        name: card.name,
        type: card.type,
        desc: card.desc,
        card_images: [{
            image_url_small: card.card_images[0]?.image_url_small || "",
            image_url: card.card_images[0]?.image_url || "",
        }],
    }));

    const saveDeck = async () => {
        if (!user) {
            alert("Please Login to save your deck");
            return;
        }

        if (!deckName.trim()) {
            alert("Please name your deck first.");
            return;
        }

        // VALIDATION CHECK
        const errors = validateDeck();
        if (errors.length > 0) {
            alert("Cannot Save Invalid Deck:\n" + errors.join("\n"));
            return;
        }

        const finalDeckName = deckName.trim();

        const fullDeckData = {
            name: finalDeckName,
            main: cleanList(mainDeck),
            extra: cleanList(extraDeck),
            side: cleanList(sideDeck),
            lastUpdated: serverTimestamp(),
        };

        try {
            if (currentDeckId) {
                // Update existing deck
                await setDoc(doc(db, "users", user.uid, "decks", currentDeckId), fullDeckData);
                alert("Deck updated successfully!");
            } else {
                // Create new deck
                const docRef = await addDoc(collection(db, "users", user.uid, "decks"), fullDeckData);
                setCurrentDeckId(docRef.id);
                alert("Deck saved successfully!");
            }
            setDeckName(finalDeckName);
        } catch (error) {
            console.error("Error saving deck:", error);
            alert("Failed to Save Deck");
        }
    };

    const shareDeck = async () => {
        if (!user) {
            alert("Please login to share your deck.");
            return;
        }

        // VALIDATION CHECK
        const errors = validateDeck();
        if (errors.length > 0) {
            alert("Cannot Share Invalid Deck:\n" + errors.join("\n"));
            return;
        }

        if (!deckName.trim()) {
            alert("Please name your deck first.");
            return;
        }

        // Auto-save first
        await saveDeck();

        const sharedDeckData = {
            name: deckName || "Untitled Deck",
            main: cleanList(mainDeck),
            extra: cleanList(extraDeck),
            side: cleanList(sideDeck),
            ownerName: user.displayName || "Anonymous",
            ownerId: user.uid,
            originalDeckId: currentDeckId,
            createdAt: serverTimestamp(),
        };

        try {
            const docRef = await addDoc(collection(db, "sharedDecks"), sharedDeckData);
            const shareUrl = `${window.location.origin}/deck/${docRef.id}`;
            await navigator.clipboard.writeText(shareUrl);
            alert(`Deck shared! Link copied to clipboard:\n${shareUrl}`);
        } catch (error) {
            console.error("Error sharing deck:", error);
            alert("Failed to share deck.");
        }
    };

    const clearDeck = () => {
        if (!confirm("Are you sure you want to clear your entire deck?")) return;
        setMainDeck([]);
        setExtraDeck([]);
        setSideDeck([]);
    };

    return (
        <div className="deckbuilder-page">
            <div className="search-bar">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search for a card..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button onClick={handleSearch} className="btn-primary">Search</button>
            </div>

            <div className="deckbuilder-layout">
                <div className="card-grid">
                    {cards.length > 0 ? (
                        cards.map((card) => (
                            <div key={card.id} className="card-item" onClick={() => addTodeck(card)}>
                                <button
                                    className="add-side-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        addToSideDeck(card)
                                    }}
                                >
                                    +
                                    <span className="tooltip">Side</span>
                                </button>
                                <button
                                    className="info-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleInfoClick(card);
                                    }}
                                >
                                    i
                                </button>
                                <img
                                    src={card.card_images?.[0]?.image_url_small}
                                    alt={card.name}
                                />
                                <p>{card.name}</p>
                            </div>
                        ))
                    ) : (
                        <p>No cards found. Search for Yu-Gi-Oh! cards above.</p>
                    )}
                </div>

                <div className="deck-area">
                    <div className="deck-header">
                        <input
                            type="text"
                            placeholder="Enter deck name..."
                            value={deckName}
                            onChange={(e) => setDeckName(e.target.value)}
                            className="deck-name-input-inline"
                            maxLength={50}
                        />
                        <div className="deck-actions">
                            <button onClick={clearDeck} className="btn-danger btn-compact">
                                Clear Deck
                            </button>
                            <button onClick={shareDeck} className="btn-secondary btn-compact">
                                Share Deck
                            </button>
                            <button onClick={saveDeck} className="btn-success btn-compact">
                                {currentDeckId ? "Update Deck" : "Save Deck"}
                            </button>
                        </div>
                    </div>

                    <div className="deck-group">
                        <h3 className="deck-group-header" onClick={() => toggleSection('main')}>
                            <span className="toggle-icon">{expandedSections.main ? '▼' : '▶'}</span>
                            Main Deck &nbsp;
                            <span className={mainDeck.length >= 40 && mainDeck.length <= 60 ? "text-success" : "text-error"}>
                                ({mainDeck.length}/60)
                            </span>
                        </h3>
                        {expandedSections.main && (
                            <div className="deck-grid">
                                {mainDeck.length === 0 && <p className="empty-msg">Empty</p>}
                                {sortByType(groupCards(mainDeck)).map(({ card, count }) => (
                                    <div key={`main-${card.id}`} className="deck-card stacked" onClick={() => removecard(card, "Main")}>
                                        <img src={card.card_images?.[0]?.image_url_small} alt={card.name} />
                                        {count > 1 && <span className="card-count-badge">x{count}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="deck-group">
                        <h3 className="deck-group-header" onClick={() => toggleSection('extra')}>
                            <span className="toggle-icon">{expandedSections.extra ? '▼' : '▶'}</span>
                            Extra Deck ({extraDeck.length})
                        </h3>
                        {expandedSections.extra && (
                            <div className="deck-grid">
                                {extraDeck.length === 0 && <p className="empty-msg">Empty</p>}
                                {groupCards(extraDeck).map(({ card, count }) => (
                                    <div key={`extra-${card.id}`} className="deck-card stacked" onClick={() => removecard(card, "Extra")}>
                                        <img src={card.card_images?.[0]?.image_url_small} alt={card.name} />
                                        {count > 1 && <span className="card-count-badge">x{count}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="deck-group">
                        <h3 className="deck-group-header" onClick={() => toggleSection('side')}>
                            <span className="toggle-icon">{expandedSections.side ? '▼' : '▶'}</span>
                            Side Deck ({sideDeck.length})
                        </h3>
                        {expandedSections.side && (
                            <div className="deck-grid">
                                {sideDeck.length === 0 && <p className="empty-msg">Empty</p>}
                                {groupCards(sideDeck).map(({ card, count }) => (
                                    <div key={`side-${card.id}`} className="deck-card stacked" onClick={() => removecard(card, "Side")}>
                                        <img src={card.card_images?.[0]?.image_url_small} alt={card.name} />
                                        {count > 1 && <span className="card-count-badge">x{count}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Chat
                mainDeck={mainDeck}
                extraDeck={extraDeck}
                sideDeck={sideDeck}
                sessionId={null}
            />

            {selectedCard && (
                <div className="modal-overlay" onClick={closeInfoModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedCard.name}</h2>
                            <button className="close-modal-btn" onClick={closeInfoModal}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>{selectedCard.desc}</p>
                            <div className="stat-row">
                                <div className="stat-item">
                                    <span className="stat-label">ATK</span>
                                    <span className="stat-value">{selectedCard.atk || 0}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">DEF</span>
                                    <span className="stat-value">{selectedCard.def || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
