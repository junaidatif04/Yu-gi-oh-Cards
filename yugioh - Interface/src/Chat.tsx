import { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from "./firebase";
import "./Chat.css";
import type { Card } from "./types";

interface ChatMessage {
    role: 'user' | 'bot';
    content: string;
    feedback?: { rating: 'up' | 'down', comment?: string };
}

interface ChatProps {
    mainDeck: Card[];
    extraDeck: Card[];
    sideDeck: Card[];
    alwaysOpen?: boolean;
    sessionId: string | null;
    onSessionCreated?: (sessionId: string) => void;
}

export default function Chat({ mainDeck, extraDeck, sideDeck, alwaysOpen = false, sessionId, onSessionCreated }: ChatProps) {
    const [isOpen, setIsOpen] = useState(alwaysOpen);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [feedbackCommentObj, setFeedbackCommentObj] = useState<{ [key: number]: string }>({});
    const [showFeedbackInput, setShowFeedbackInput] = useState<{ [key: number]: boolean }>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load session messages when sessionId changes
    useEffect(() => {
        const loadSession = async () => {
            if (!sessionId || !auth.currentUser) {
                setMessages([]);
                return;
            }

            try {
                const sessionRef = doc(db, 'users', auth.currentUser.uid, 'chat_sessions', sessionId);
                const sessionSnap = await getDoc(sessionRef);
                if (sessionSnap.exists()) {
                    const data = sessionSnap.data();
                    setMessages(data.messages || []);
                }
            } catch (error) {
                console.error('Error loading session:', error);
            }
        };

        loadSession();
    }, [sessionId]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: ChatMessage = { role: "user", content: input };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setIsLoading(true);
        const currentInput = input;
        setInput("");

        const user = auth.currentUser;
        let currentSessionId = sessionId;

        // Create new session if none exists
        if (!currentSessionId && user) {
            try {
                const newSession = await addDoc(collection(db, 'users', user.uid, 'chat_sessions'), {
                    title: currentInput.slice(0, 50) + (currentInput.length > 50 ? '...' : ''),
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp(),
                    messages: [userMessage]
                });
                currentSessionId = newSession.id;
                onSessionCreated?.(currentSessionId);
            } catch (error) {
                console.error('Error creating session:', error);
            }
        } else if (currentSessionId && user) {
            // Update existing session with user message
            try {
                const sessionRef = doc(db, 'users', user.uid, 'chat_sessions', currentSessionId);
                await updateDoc(sessionRef, {
                    messages: arrayUnion(userMessage),
                    lastUpdated: serverTimestamp()
                });
            } catch (error) {
                console.error('Error updating session:', error);
            }
        }

        const deckContext = {
            main: mainDeck.map(c => c.name),
            extra: extraDeck.map(c => c.name),
            side: sideDeck.map(c => c.name)
        };

        // Prepare history for context (excluding current message)
        const historyForBackend = messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        try {
            const response = await fetch("https://catechetical-britni-boundlessly.ngrok-free.dev/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: currentInput,
                    current_deck: deckContext,
                    history: historyForBackend,
                    platform: "web",
                    user_id: user?.uid || null
                }),
            });

            if (!response.ok) {
                throw new Error("Network response was not ok");
            }

            const data = await response.json();
            const botReply = data.response || data.message || data.answer || data.reply || (typeof data === 'string' ? data : JSON.stringify(data));
            const botMessage: ChatMessage = { role: "bot", content: botReply || "..." };

            setMessages(prev => [...prev, botMessage]);

            // Save bot response to Firestore
            if (currentSessionId && user) {
                try {
                    const sessionRef = doc(db, 'users', user.uid, 'chat_sessions', currentSessionId);
                    await updateDoc(sessionRef, {
                        messages: arrayUnion(botMessage),
                        lastUpdated: serverTimestamp()
                    });
                } catch (error) {
                    console.error('Error saving bot response:', error);
                }
            }
        } catch (error) {
            console.error("Error chatting:", error);
            const errorMessage: ChatMessage = { role: "bot", content: "I am having trouble connecting to the spirit realm (backend). Please try again." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFeedback = async (index: number, rating: 'up' | 'down', comment?: string) => {
        setMessages(prev => prev.map((msg, i) =>
            i === index ? { ...msg, feedback: { rating, comment } } : msg
        ));
        setShowFeedbackInput(prev => ({ ...prev, [index]: false }));

        const queryMsg = messages[index - 1];
        const botMsg = messages[index];
        const queryText = queryMsg && queryMsg.role === 'user' ? queryMsg.content : "Unknown Query";

        try {
            await addDoc(collection(db, "chat_feedback"), {
                query: queryText,
                response: botMsg.content,
                rating: rating,
                additionalText: comment || "",
                timestamp: serverTimestamp(),
                userId: auth.currentUser ? auth.currentUser.uid : "anonymous",
            });
        } catch (error) {
            console.error("Error saving feedback:", error);
        }
    };

    return (
        <>
            <button
                className="chat-toggle-btn"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? 'Close Link' : 'Duel AI'}
            </button>

            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <h3>Duel Strategy AI</h3>
                    </div>

                    <div className="chat-messages">
                        <div className="message-bubble message-bot">
                            I am connected to the Card Database. Ask me about any card or strategy!
                        </div>

                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`message-bubble ${msg.role === 'user' ? 'message-user' : 'message-bot'}`}
                            >
                                {msg.role === 'bot' ? (
                                    <>
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>

                                        {!msg.feedback ? (
                                            <div className="feedback-actions">
                                                <button
                                                    className="feedback-btn"
                                                    onClick={() => handleFeedback(index, 'up')}
                                                    title="Helpful"
                                                >
                                                    👍
                                                </button>
                                                <button
                                                    className="feedback-btn"
                                                    onClick={() => setShowFeedbackInput(prev => ({ ...prev, [index]: !prev[index] }))}
                                                    title="Not Helpful"
                                                >
                                                    👎
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="feedback-thankyou">
                                                {msg.feedback.rating === 'up' ? "👍 Thanks!" : "👎 Feedback Sent"}
                                            </div>
                                        )}

                                        {showFeedbackInput[index] && !msg.feedback && (
                                            <div className="feedback-form">
                                                <input
                                                    type="text"
                                                    placeholder="What went wrong?"
                                                    className="feedback-input"
                                                    value={feedbackCommentObj[index] || ""}
                                                    onChange={(e) => setFeedbackCommentObj({ ...feedbackCommentObj, [index]: e.target.value })}
                                                />
                                                <button
                                                    className="feedback-submit-btn"
                                                    onClick={() => handleFeedback(index, 'down', feedbackCommentObj[index])}
                                                >
                                                    Submit
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    msg.content
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="typing-indicator">
                                <div className="dot"></div>
                                <div className="dot"></div>
                                <div className="dot"></div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSubmit} className="chat-form">
                        <input
                            className="chat-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask for strategy..."
                            disabled={isLoading}
                        />
                    </form>
                </div>
            )}
        </>
    );
}
