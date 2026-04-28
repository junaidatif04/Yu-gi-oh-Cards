import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import './AdminDashboard.css';

const ADMIN_EMAIL = 'junaidatif40@gmail.com';

interface FeedbackDoc {
    query: string;
    response: string;
    rating: 'up' | 'down';
    additionalText?: string;
    timestamp: unknown;
    userId: string;
}

interface UserDeckDoc {
    id: string;
    deckData?: {
        main: unknown[];
        extra: unknown[];
        side: unknown[];
    };
}

interface SharedDeckDoc {
    id: string;
    name: string;
    ownerName: string;
    voteScore: number;
    upvotes: number;
    downvotes: number;
}

interface AnalyticsDoc {
    id: string;
    type: 'chat' | 'card_search';
    platform: 'discord' | 'web';
    content: string;
    userId: string;
    timestamp: any;
}

export default function AdminDashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [feedbackList, setFeedbackList] = useState<FeedbackDoc[]>([]);
    const [userDecks, setUserDecks] = useState<UserDeckDoc[]>([]);
    const [popularDecks, setPopularDecks] = useState<SharedDeckDoc[]>([]);
    const [analyticsLogs, setAnalyticsLogs] = useState<AnalyticsDoc[]>([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (user && user.email === ADMIN_EMAIL) {
            loadAdminData();
        }
    }, [user]);

    const loadAdminData = async () => {
        // Load Feedback
        try {
            const feedbackSnap = await getDocs(collection(db, 'chat_feedback'));
            const feedbackData: FeedbackDoc[] = [];
            feedbackSnap.forEach((doc) => {
                feedbackData.push(doc.data() as FeedbackDoc);
            });
            setFeedbackList(feedbackData);
        } catch (e) {
            console.error('Error loading feedback:', e);
        }

        // Load User Decks
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersData: UserDeckDoc[] = [];
            usersSnap.forEach((doc) => {
                usersData.push({ id: doc.id, ...doc.data() } as UserDeckDoc);
            });
            setUserDecks(usersData);
        } catch (e) {
            console.error('Error loading users:', e);
        }

        // Load Popular Decks
        try {
            const decksQuery = query(collection(db, 'sharedDecks'), orderBy('voteScore', 'desc'), limit(10));
            const decksSnap = await getDocs(decksQuery);
            const decksData: SharedDeckDoc[] = [];
            decksSnap.forEach((doc) => {
                const data = doc.data();
                decksData.push({
                    id: doc.id,
                    name: data.name || "Untitled",
                    ownerName: data.ownerName || "Anonymous",
                    voteScore: data.voteScore || 0,
                    upvotes: data.upvotes || 0,
                    downvotes: data.downvotes || 0
                });
            });
            setPopularDecks(decksData);
        } catch (e) {
            console.error('Error loading popular decks:', e);
        }

        // Load Analytics Logs
        try {
            const logsQuery = query(collection(db, 'analytics_logs'), orderBy('timestamp', 'desc'), limit(20));
            const logsSnap = await getDocs(logsQuery);
            const logsData: AnalyticsDoc[] = [];
            logsSnap.forEach((doc) => {
                logsData.push({ id: doc.id, ...doc.data() } as AnalyticsDoc);
            });
            setAnalyticsLogs(logsData);
        } catch (e) {
            console.error('Error loading analytics:', e);
        }
    };

    if (loading) {
        return <div className="admin-loading">Loading...</div>;
    }

    if (!user) {
        return <div className="admin-denied">Please log in to access this page.</div>;
    }

    if (user.email !== ADMIN_EMAIL) {
        return <div className="admin-denied">⛔ Access Denied. Admins only.</div>;
    }

    const positiveCount = feedbackList.filter(f => f.rating === 'up').length;
    const negativeCount = feedbackList.filter(f => f.rating === 'down').length;
    const discordCount = analyticsLogs.filter(l => l.platform === 'discord').length;
    // const webCount = analyticsLogs.filter(l => l.platform === 'web').length;

    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1>Admin Dashboard</h1>
                <span className="admin-badge">Admin: {user.email}</span>
            </header>

            {/* Stats Overview */}
            <section className="admin-stats">
                <div className="stat-card">
                    <h3>Total Users</h3>
                    <p>{userDecks.length}</p>
                </div>
                <div className="stat-card">
                    <h3>Discord Actions</h3>
                    <p>{discordCount}</p>
                </div>
                <div className="stat-card positive">
                    <h3>👍 Positive</h3>
                    <p>{positiveCount}</p>
                </div>
                <div className="stat-card negative">
                    <h3>👎 Negative</h3>
                    <p>{negativeCount}</p>
                </div>
            </section>

            {/* Recent Analytics & Logs */}
            <section className="admin-section">
                <h2>System Logs (Last 20)</h2>
                {analyticsLogs.length === 0 ? (
                    <p className="empty-msg">No logs found yet.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Platform</th>
                                <th>Type</th>
                                <th>User ID</th>
                                <th>Content/Query</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyticsLogs.map((log) => (
                                <tr key={log.id}>
                                    <td>
                                        <span className={`badge ${log.platform === 'discord' ? 'badge-discord' : 'badge-web'}`}>
                                            {log.platform.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>{log.type}</td>
                                    <td>{log.userId}</td>
                                    <td>{log.content?.substring(0, 50)}...</td>
                                    <td>{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : 'Just now'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* User Decks */}
            <section className="admin-section">
                <h2>User Decks</h2>
                {userDecks.length === 0 ? (
                    <p className="empty-msg">No user decks found.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User ID</th>
                                <th>Main Deck</th>
                                <th>Extra Deck</th>
                                <th>Side Deck</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userDecks.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.id}</td>
                                    <td>{u.deckData?.main?.length || 0}</td>
                                    <td>{u.deckData?.extra?.length || 0}</td>
                                    <td>{u.deckData?.side?.length || 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* Popular Decks */}
            <section className="admin-section">
                <h2>Popular Decks (Top 10)</h2>
                {popularDecks.length === 0 ? (
                    <p className="empty-msg">No shared decks yet.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Deck Name</th>
                                <th>Creator</th>
                                <th>Score (Up/Down)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {popularDecks.map((deck) => (
                                <tr key={deck.id}>
                                    <td>
                                        <a href={`/deck/${deck.id}`} target="_blank" rel="noopener noreferrer">
                                            {deck.name}
                                        </a>
                                    </td>
                                    <td>{deck.ownerName}</td>
                                    <td>
                                        <strong>{deck.voteScore}</strong> ({deck.upvotes} / {deck.downvotes})
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* Feedback */}
            <section className="admin-section">
                <h2>Chat Feedback</h2>
                {feedbackList.length === 0 ? (
                    <p className="empty-msg">No feedback yet.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Rating</th>
                                <th>Query</th>
                                <th>Comment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {feedbackList.map((f, i) => (
                                <tr key={i}>
                                    <td>{f.rating === 'up' ? '👍' : '👎'}</td>
                                    <td>{f.query?.substring(0, 50) || '-'}...</td>
                                    <td>{f.additionalText || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}
