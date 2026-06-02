import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import { readyEvent } from './events/ready.js';
import { messageCreateEvent } from './events/messageCreate.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ ERROR: DISCORD_TOKEN is missing from your .env file!");
  console.error("Please configure the .env file with your Discord credentials before running.");
  process.exit(1);
}

// Keep-Alive Web Server for Render hosting
const app = express();
app.get('/', (req, res) => {
  res.send('Kasandra is alive! 🤖');
});
const PORT = process.env.PORT || 7860;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Keep-alive web server is listening on port ${PORT}`);
});

// Create client with intents and partials for mentions, text channels, and direct messages (DMs)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Channel,
    Partials.Message
  ]
});

// Set up event listeners
const events = [readyEvent, messageCreateEvent];

for (const event of events) {
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Handle unhandled promise rejections to prevent bot crashes
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Login
client.login(token);
