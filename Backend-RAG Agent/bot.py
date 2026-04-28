import discord
import aiohttp
import os
from discord.ext import commands
from discord import app_commands

# --- 1. CONFIGURATION ---
TOKEN = os.getenv("DISCORD_TOKEN", "YOUR_DISCORD_BOT_TOKEN") 
API_URL = "http://127.0.0.1:8000/chat"

# --- 2. BOT SETUP ---
class MyBot(commands.Bot):
    def __init__(self):
        # We don't need a prefix anymore, but we keep it for legacy support
        super().__init__(command_prefix="!", intents=discord.Intents.default())

    async def setup_hook(self):
        # This copies the slash commands to the main tree
        await self.tree.sync()
        print("✅ Slash commands synced!")

    async def on_ready(self):
        print(f'✅ Logged in as {self.user} (ID: {self.user.id})')

bot = MyBot()

# --- COMMAND 1: /card (Slash Command) ---
@bot.tree.command(name="card", description="Search for a Yu-Gi-Oh! card image and stats")
@app_commands.describe(name="The name of the card you are looking for")
async def card(interaction: discord.Interaction, name: str):
    # 1. Defer: Tell Discord "We received this, give us more than 3 seconds to reply"
    await interaction.response.defer()

    url = f"https://db.ygoprodeck.com/api/v7/cardinfo.php?fname={name}"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            if resp.status != 200:
                await interaction.followup.send(f"❌ Card '{name}' not found.")
                return
            
            data = await resp.json()
            if not data.get('data'):
                await interaction.followup.send(f"❌ Card '{name}' not found.")
                return

            # Card Data Logic
            first_card = data['data'][0]
            image_url = first_card['card_images'][0]['image_url']
            
            embed = discord.Embed(
                title=f"{first_card['name']}", 
                description=first_card['desc'],
                color=discord.Color.from_rgb(214, 51, 132)
            )
            embed.set_thumbnail(url=image_url)
            embed.add_field(name="ATK/DEF", value=f"{first_card.get('atk', 'N/A')}/{first_card.get('def', 'N/A')}", inline=True)
            
            # 2. LOGGING: Tell the backend we searched for this card
            try:
                log_payload = {
                    "type": "card_search",
                    "platform": "discord",
                    "user_id": str(interaction.user.id),
                    "content": first_card['name'],
                    "metadata": {"status": "found"}
                }
                async with aiohttp.ClientSession() as log_session:
                    await log_session.post(f"{API_URL.replace('/chat', '')}/log", json=log_payload)
            except Exception as e:
                print(f"Logging failed: {e}")

            # 3. Followup: Since we deferred earlier, we use 'followup.send' instead of 'response.send_message'
            await interaction.followup.send(embed=embed)

# --- COMMAND 2: /ask (Slash Command) ---
@bot.tree.command(name="ask", description="Ask the AI Duel Expert a strategy question")
@app_commands.describe(question="Your question about Yu-Gi-Oh strategy or lore")
async def ask(interaction: discord.Interaction, question: str):
    # 1. Defer because AI takes time!
    await interaction.response.defer()
    
    # Optional: Send a visible thinking message
    # await interaction.followup.send(f"🧠 Thinking about: '{question}'...") 

    payload = {
        "message": question,
        "current_deck": None, # Bot doesn't have deck access yet
        "platform": "discord",
        "user_id": str(interaction.user.id)
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(API_URL, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    reply = data.get("reply", "No reply received.")
                    
                    # Send the AI response
                    await interaction.followup.send(f"**Question:** {question}\n\n**AI Expert:**\n>>> {reply}")
                else:
                    await interaction.followup.send(f"❌ Error from Backend: {resp.status}")
    except Exception as e:
        await interaction.followup.send(f"❌ Connection Error. Is `main.py` running?")

# --- RUN BOT ---
bot.run(TOKEN)