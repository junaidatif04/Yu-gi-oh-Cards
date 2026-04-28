# 🃏 Yu-Gi-Oh! AI Duel Expert & RAG Agent

![Yu-Gi-Oh! AI Banner](https://img.shields.io/badge/Yu--Gi--Oh!-AI--Expert-blueviolet?style=for-the-badge&logo=appveyor)
![Python](https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.124+-009688?style=for-the-badge&logo=fastapi)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

A cutting-edge, full-stack AI platform designed to empower Yu-Gi-Oh! duelists. This project features a **Dual-Brain RAG (Retrieval-Augmented Generation)** backend that provides expert-level strategy, rulings, and card information through both a high-performance **Web Interface** and a **Discord Bot**.

---

##  Key Features

###  Dual-Brain RAG Architecture
Our backend isn't just a chatbot; it's a specialized search engine that uses a **Router Agent** to navigate two distinct knowledge bases:
- **Brain #1 (The Librarian)**: Powered by **Pandas**, this brain handles exact card statistics (ATK, DEF, Level, Type) from a localized JSON database.
- **Brain #2 (The Strategist)**: Powered by **ChromaDB** and **Vector Search**, this brain retrieves complex strategy tips, combos, and rulings from a high-dimensional vector space.

### Premium Web Interface
Built with **React** and **TypeScript**, the frontend offers a sleek, modern experience:
- **AI Chat Hub**: Interactive, context-aware chat with the Duel Expert.
- **Deck Builder**: Professional deck building tools with Firebase integration.
- **Community Sharing**: Share and discover decks from the community.
- **Admin Analytics**: Real-time logging and performance tracking via Firebase Firestore.

###  Discord Integration
Bring the AI Expert to your server:
- `/card [name]`: Instant card lookup with high-quality images.
- `/ask [question]`: Ask for strategy advice, counters, or ruling clarifications.

---

##  Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | FastAPI, Python, ChromaDB, Google Gemini 2.5 Flash, Sentence-Transformers |
| **Frontend** | React 18, TypeScript, Vite, CSS3 (Custom Glassmorphism) |
| **Infrastructure** | Firebase (Auth, Firestore, Hosting), Discord.py |
| **Data Science** | Pandas, Numpy, Vector Embeddings |

---

##  Installation & Setup

### Prerequisites
- **Node.js** (v16+)
- **Python** (v3.10+)
- **Firebase Account** (for Auth & Database)
- **Google AI API Key** (for Gemini)

### 1. Backend Configuration
1. Navigate to the backend directory:
   ```bash
   cd "Backend-RAG Agent"
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. **Environment Variables**:
   Create a `.env` file and add:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   GOOGLE_API_KEY=your_gemini_api_key
   ```
4. Place your `serviceAccountKey.json` (Firebase Admin) in the backend root.
5. Start the server:
   ```bash
   uvicorn main:app --reload
   ```

### 2. Frontend Configuration
1. Navigate to the frontend directory:
   ```bash
   cd "yugioh - Interface"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Update `src/firebase.ts` with your Firebase web config.
4. Launch the app:
   ```bash
   npm run dev
   ```

---

## 📂 Repository Structure

```text
├── Backend-RAG Agent/      # FastAPI & RAG Logic
│   ├── data/               # Card Database (JSON)
│   ├── ygo_db/             # ChromaDB Persistent Storage
│   ├── main.py             # Router & Search Logic
│   └── bot.py              # Discord Bot Integration
├── yugioh - Interface/     # React Frontend
│   ├── src/                # Components, Styles & Auth
│   └── public/             # Assets & Icons
├── .gitignore              # Multi-layer protection for secrets
└── LICENSE                 # MIT Open Source License
```

---


