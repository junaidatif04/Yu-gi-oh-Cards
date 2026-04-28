import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
    return (
        <div className="landing-page">
            {/* Animated Gradient Orbs */}
            <div className="orb orb-1"></div>
            <div className="orb orb-2"></div>
            <div className="orb orb-3"></div>

            {/* Animated Rings */}
            <div className="ring ring-1"></div>
            <div className="ring ring-2"></div>

            {/* Animated Background Particles */}
            <div className="particles">
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
            </div>

            {/* Sparkle Stars */}
            <div className="sparkles">
                <div className="sparkle"></div>
                <div className="sparkle"></div>
                <div className="sparkle"></div>
                <div className="sparkle"></div>
                <div className="sparkle"></div>
                <div className="sparkle"></div>
            </div>

            {/* Hero Content */}
            <div className="hero-content">
                <h1 className="hero-title">
                    <span className="title-line">Yu-Gi-Oh!</span>
                    <span className="title-line accent">Deck Builder</span>
                </h1>

                <p className="hero-tagline">
                    Forge your destiny. Build legendary decks. Dominate the duel.
                </p>

                <div className="hero-features">
                    <div className="feature-item">
                        <span className="feature-icon">🃏</span>
                        <span>13,000+ Cards</span>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">🤖</span>
                        <span>AI Strategy Advisor</span>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">🌐</span>
                        <span>Share & Compete</span>
                    </div>
                </div>

                <Link to="/build" className="cta-button">
                    <span className="cta-text">Enter the Arena</span>
                    <span className="cta-arrow">→</span>
                </Link>
            </div>

            {/* Decorative Card Fan */}
            <div className="card-fan">
                <div className="fan-card fan-card-1"></div>
                <div className="fan-card fan-card-2"></div>
                <div className="fan-card fan-card-3"></div>
            </div>
        </div>
    );
}
