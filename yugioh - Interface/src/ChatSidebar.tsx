import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from './firebase';
import './ChatSidebar.css';

interface ChatSession {
    id: string;
    title: string;
    lastUpdated: any;
}

interface ChatSidebarProps {
    activeSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
}

export default function ChatSidebar({ activeSessionId, onSelectSession, onNewChat }: ChatSidebarProps) {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setSessions([]);
            setLoading(false);
            return;
        }

        const sessionsRef = collection(db, 'users', user.uid, 'chat_sessions');
        const q = query(sessionsRef, orderBy('lastUpdated', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionList: ChatSession[] = [];
            snapshot.forEach((doc) => {
                sessionList.push({
                    id: doc.id,
                    title: doc.data().title || 'New Chat',
                    lastUpdated: doc.data().lastUpdated
                });
            });
            setSessions(sessionList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [auth.currentUser]);

    const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!confirm('Delete this chat?')) return;

        const user = auth.currentUser;
        if (!user) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'chat_sessions', sessionId));
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    };

    return (
        <div className="chat-sidebar">
            <button className="new-chat-btn" onClick={onNewChat}>
                + New Chat
            </button>

            <div className="sessions-list">
                {loading ? (
                    <div className="sidebar-loading">Loading...</div>
                ) : sessions.length === 0 ? (
                    <div className="sidebar-empty">No chats yet</div>
                ) : (
                    sessions.map((session) => (
                        <div
                            key={session.id}
                            className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                            onClick={() => onSelectSession(session.id)}
                        >
                            <span className="session-title">{session.title}</span>
                            <button
                                className="delete-session-btn"
                                onClick={(e) => handleDelete(e, session.id)}
                                title="Delete"
                            >
                                ×
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
