import os
import json
import pandas as pd
import chromadb
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from fastapi.middleware.cors import CORSMiddleware

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# --- 1. CONFIGURATION ---
def load_secrets():
    """Loads secrets from the root secrets.txt file"""
    secrets_path = os.path.join(os.path.dirname(__file__), "..", "secrets.txt")
    if os.path.exists(secrets_path):
        with open(secrets_path, "r") as f:
            for line in f:
                # Only parse lines that look like KEY="VALUE"
                if "=" in line and not line.strip().startswith("{") and not line.strip().startswith("}"):
                    parts = line.strip().split("=", 1)
                    if len(parts) == 2:
                        key, value = parts
                        os.environ[key] = value.strip('"').strip("'")

load_secrets()

# 🔑 API Key is now loaded from secrets.txt
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    print("⚠️ WARNING: GOOGLE_API_KEY not found in environment or secrets.txt")

genai.configure(api_key=GOOGLE_API_KEY)

# Initialize Firebase Admin
# NOTE: Ensure 'serviceAccountKey.json' is in the same directory or use proper env setup
try:
    if not firebase_admin._apps:
        # Try to find credentials, otherwise fall back to default (for cloud run etc)
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
            print("✅ Firebase Admin Initialized with serviceAccountKey.json")
        else:
            firebase_admin.initialize_app()
            print("⚠️ Firebase Admin Initialized with Default Credentials (check permissions if local)")
    db = firestore.client()
except Exception as e:
    print(f"❌ Firebase Init Error: {e}")
    db = None

# Use the model we verified works
model = genai.GenerativeModel('gemini-2.5-flash')

app = FastAPI()

# --- 2. CORS SETUP ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. LOAD BRAIN #1: CARD STATS (Pandas) ---
print("⏳ Loading Card Database (Brain #1)...")
try:
    df = pd.read_json("data/cards.json")
    # Ensure we can search names case-insensitively easily
    df['name_lower'] = df['name'].str.lower()
    print(f"✅ Loaded {len(df)} cards into memory.")
except Exception as e:
    print(f"❌ Error loading cards.json: {e}")
    df = pd.DataFrame()

# --- 4. LOAD BRAIN #2: STRATEGY (ChromaDB) ---
print("⏳ Loading Strategy Database (Brain #2)...")
try:
    client = chromadb.PersistentClient(path="./ygo_db")
    collection = client.get_collection(name="strategy")
    embedder = SentenceTransformer('all-MiniLM-L6-v2')
    print("✅ Vector DB Connected.")
except Exception as e:
    print(f"❌ Error connecting to ChromaDB: {e}")

# --- 5. DATA MODELS ---
class ChatMessage(BaseModel):
    role: str  # "user" or "bot"
    content: str

class ChatRequest(BaseModel):
    message: str
    current_deck: dict | None = None
    platform: str = "web"     # "discord" or "web"
    user_id: str | None = None # Discord User ID or potentially Firebase UID
    history: list[ChatMessage] = []  # Previous messages for context

class LogRequest(BaseModel):
    type: str  # "card_search", "error", etc.
    platform: str
    user_id: str
    content: str
    metadata: dict | None = {}

# --- 6. HELPER FUNCTIONS (TOOLS) ---

def search_card_stats(card_name):
    """Brain #1: Finds exact card stats using Pandas"""
    if df.empty or not card_name: return None
    
    # Exact match search (case-insensitive)
    results = df[df['name_lower'] == card_name.lower()]
    
    if not results.empty:
        row = results.iloc[0]
        # Return a nice string for the AI to read
        return (f"CARD DATASHEET:\n"
                f"Name: {row['name']}\n"
                f"Type: {row.get('type', 'N/A')} / {row.get('race', 'N/A')}\n"
                f"Attribute: {row.get('attribute', 'N/A')}\n"
                f"Level/Rank: {row.get('level', 'N/A')}\n"
                f"ATK: {row.get('atk', 'N/A')} / DEF: {row.get('def', 'N/A')}\n"
                f"Description: {row.get('desc', 'N/A')}\n")
    return None

def search_strategy(query):
    """Brain #2: Finds strategy tips using Vector Search"""
    try:
        if not query: return ""
        query_vec = embedder.encode([query]).tolist()
        results = collection.query(query_embeddings=query_vec, n_results=4)
        
        knowledge_text = "STRATEGY & RULINGS DATABASE:\n"
        if results['documents']:
            for i, doc in enumerate(results['documents'][0]):
                meta = results['metadatas'][0][i]
                knowledge_text += f"- [{meta.get('category', 'General')}] {meta.get('card_name', '')}: {doc}\n"
        return knowledge_text
    except Exception as e:
        print(f"Vector search error: {e}")
        return ""

def classify_intent(user_query):
    """
    Step 1: The Router Agent
    Uses Gemini to decide WHICH database to search.
    """
    router_prompt = f"""
    You are a query router for a Yu-Gi-Oh! chatbot.
    Your job is to analyze the USER QUERY and decide which database to search.
    
    AVAILABLE TOOLS:
    1. "brain_1" (Fact DB): Use for specific stats like ATK, DEF, Type, Level, Attribute, exact Card Text, or "What is [Card]?". 
       - PARAMETER: Extract the exact card name.
    2. "brain_2" (Strategy DB): Use for "How to play", "Combos", "Rulings", "Tips", "Counters", "Synergy", or "Lore".
       - PARAMETER: Extract the search topic.
    3. "both": Use if the user asks for BOTH stats AND strategy (e.g., "What is Dark Magician's ATK and how do I use him?").
    4. "general": Use for greetings ("Hi", "Hello") or questions unrelated to Yu-Gi-Oh cards.

    USER QUERY: "{user_query}"

    RESPONSE FORMAT:
    Respond with ONLY a valid JSON object. No markdown.
    {{
        "tool": "brain_1" | "brain_2" | "both" | "general",
        "card_name": "Extracted Card Name (or null)",
        "search_query": "Optimized search string for vector db (or null)"
    }}
    """
    
    try:
        response = model.generate_content(router_prompt)
        # Clean potential markdown code blocks
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"Router Error: {e}")
        # Fallback safety
        return {"tool": "general", "card_name": None, "search_query": None}

def log_to_firestore(log_type: str, platform: str, user_id: str, content: str, metadata: dict = None):
    """Async logger for analytics"""
    if not db: return
    try:
        doc_ref = db.collection("analytics_logs").document()
        doc_ref.set({
            "timestamp": firestore.SERVER_TIMESTAMP,
            "type": log_type, # "chat" or "card_search"
            "platform": platform,
            "userId": user_id or "anonymous",
            "content": content,
            "metadata": metadata or {}
        })
        print(f"📝 Logged {log_type} from {platform}")
    except Exception as e:
        print(f"❌ Logging Error: {e}")

# --- 7. MAIN API ENDPOINT ---

@app.post("/log")
async def log_event_endpoint(request: LogRequest):
    """
    Endpoint for external tools (like Discord Bot) to log events directly.
    """
    await log_to_firestore(
        log_type=request.type,
        platform=request.platform,
        user_id=request.user_id,
        content=request.content,
        metadata=request.metadata
    )
    return {"status": "logged"}

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    user_query = request.message
    current_deck = request.current_deck
    platform = request.platform
    user_id = request.user_id
    
    print(f"\n📩 New Message: {user_query} [{platform}]")
    if current_deck:
        print(f"🃏 Deck Context Received: {len(current_deck.get('main', []))} Main, {len(current_deck.get('extra', []))} Extra")

    # --- LOGGING START ---
    log_to_firestore("chat", platform, user_id, user_query)
    # --- LOGGING END ---

    # --- STEP 1: ROUTING (The Brain decides what to do) ---
    intent = classify_intent(user_query)
    print(f"🧠 Intent Detected: {intent}")

    context_data = ""

    # --- STEP 2: TOOL EXECUTION (Gathering info) ---
    
    # Tool 1: Card Stats (Pandas)
    if intent['tool'] in ["brain_1", "both"] and intent['card_name']:
        print(f"   🔍 Brain 1: Looking up stats for '{intent['card_name']}'...")
        stats = search_card_stats(intent['card_name'])
        if stats:
            context_data += stats + "\n"
        else:
            context_data += f"Note: I tried to find stats for '{intent['card_name']}' but couldn't find it in the database.\n"

    # Tool 2: Strategy (Vector DB)
    if intent['tool'] in ["brain_2", "both"]:
        # If we have a specific card name, prioritize that for the vector search
        search_term = intent['search_query'] or intent['card_name'] or user_query
        print(f"   🔍 Brain 2: Searching strategy for '{search_term}'...")
        strategy = search_strategy(search_term)
        context_data += strategy + "\n"

    # Ensure deck context is formatted nicely
    deck_context_str = "No deck provided."
    if current_deck:
        deck_context_str = json.dumps(current_deck, indent=2)

    # Format conversation history for context
    history_str = ""
    if request.history:
        history_str = "CONVERSATION HISTORY:\n"
        for msg in request.history[-10:]:  # Last 10 messages max
            role_label = "User" if msg.role == "user" else "Assistant"
            history_str += f"{role_label}: {msg.content}\n"
        history_str += "\n"
        print(f"💬 History Context: {len(request.history)} messages")

    # --- STEP 3: FINAL SYNTHESIS (The Mouth) ---
    
    final_prompt = f"""
    You are a Yu-Gi-Oh! Expert Assistant.
    
    {history_str}
    CONTEXT DATA RETRIEVED:
    {context_data}
    
    CURRENT USER DECK:
    {deck_context_str}
    
    USER QUESTION: "{user_query}"
    
    INSTRUCTIONS:
    - Use the CONVERSATION HISTORY to understand context (e.g., if user says "it" or "that card", refer to previously mentioned cards).
    - If the user asks for suggestions, specific cards to add/remove, or consistency, use the CURRENT USER DECK.
    - If you have the answer in the CONTEXT DATA, use it explicitly.
    - If the user asked for stats (ATK/DEF) and they are in the context, state them clearly.
    - If the context is empty, answer from your own general knowledge but keep it brief.
    - Be helpful, friendly, and concise.
    """

    try:
        response = model.generate_content(final_prompt)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"Error generating response: {str(e)}"}

# To run: uvicorn main:app --reload
