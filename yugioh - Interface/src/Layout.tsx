import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import './Layout.css';

const ADMIN_EMAIL = 'junaidatif40@gmail.com';

export default function Layout() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error('Error signing in:', error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <div className="layout">
            <nav className="navbar">
                <div className="nav-brand">
                    <NavLink to="/" className="brand-link">Yu-Gi-Oh!</NavLink>
                </div>

                <ul className="nav-links">
                    <li>
                        <NavLink to="/build" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                            Deck Builder
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/chat" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                            Duel AI
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/saved-decks" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                            My Decks
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/community" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                            Community
                        </NavLink>
                    </li>
                    {user?.email === ADMIN_EMAIL && (
                        <li>
                            <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active admin' : 'nav-link admin'}>
                                Admin
                            </NavLink>
                        </li>
                    )}
                </ul>

                <div className="nav-user">
                    {user ? (
                        <div className="user-info">
                            <span className="user-name">{user.displayName}</span>
                            <button onClick={handleLogout} className="logout-btn">Logout</button>
                        </div>
                    ) : (
                        <button onClick={handleLogin} className="login-btn">Login</button>
                    )}
                </div>
            </nav>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
