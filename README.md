---
title: Kasandra Bot
emoji: 🤖
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# 🤖 Kasandra - Discord AI Chatbot

Welcome to **Kasandra**—a sharp, witty, and highly intelligent AI companion for Discord! Kasandra can chat, debate, and discuss any topic inside text channels and Direct Messages (DMs). She remembers recent conversation history, automatically adapts to your style (slang, Hinglish, Spanish, gibberish), and runs entirely on message events without requiring slash commands.

---

## ⚙️ Prerequisites

You must have **Node.js** (v18+) installed on your machine. You can verify your version by running:
```bash
node -v
```

---

## 🚀 Setup & Installation

### 1. Install Dependencies
In your project directory, install the required packages:
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` or edit your existing `.env` file:
```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Setup Discord Developer Portal Credentials
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select your application.
3. Under the **Bot** tab:
   - Paste your copied token into the `.env` as `DISCORD_TOKEN`.
   - **CRITICAL STEP**: Scroll down to the **Privileged Gateway Intents** section and toggle **ON** the **Message Content Intent** switch. Save changes.
4. Under the **OAuth2** -> **URL Generator** tab:
   - Select **scopes**: `bot`.
   - Select **bot permissions**: `Send Messages`, `Read Message History`, `Send Messages in Threads`, `Add Reactions`.
   - Copy the generated URL at the bottom and open it in your browser to invite Kasandra to your Discord server!

---

## 💬 How to Interact with Kasandra

### 1. In Servers / Text Channels
Mention Kasandra anywhere in a channel she has access to:
```text
@Kasandra what is your stance on remote work vs office work? Let's debate.
```
Kasandra will remember the last 15 messages in the channel to keep a continuous, contextual discussion.

### 2. In Direct Messages (DMs)
Direct message Kasandra to chat 1-on-1. She will automatically reply to every message sent in her DMs.

### 3. Resetting Memory
If you want Kasandra to clear her conversation memory for your current channel or DM thread, simply send:
```text
reset
```
*or*
```text
clear
```
She will clear the local database context for that specific channel and start fresh.

---

## 🛠️ Execution Commands

### Start Bot in Production Mode
```bash
npm start
```

### Start Bot in Development Mode (Auto-restarts on changes)
```bash
npm run dev
```

---

## 📂 Project Architecture

- **`src/index.js`**: Bot entry point, sets up Intents/Partials for DMs & Guild Messages, and loads event listeners.
- **`src/database.js`**: Sets up SQLite database (`database.sqlite`) tracking conversation histories.
- **`src/ai-service.js`**: Custom interface using Google Gemini or OpenAI Chat completions endpoints to compile histories and generate style-adapted responses.
- **`src/events/ready.js`**: Initializes status activity when Kasandra starts up.
- **`src/events/messageCreate.js`**: Processes all incoming messages, strips mentions, tracks context, executes resetting commands, and triggers AI replies.
