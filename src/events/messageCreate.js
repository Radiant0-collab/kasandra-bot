import { dbOps } from '../database.js';
import { aiService } from '../ai-service.js';

export const messageCreateEvent = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    // Ignore messages from bots to prevent infinite loops
    if (message.author.bot) return;

    // Check if the message is in a DM or if the bot was mentioned
    const isDM = !message.guild;
    const isMentioned = message.mentions.has(client.user);

    if (!isDM && !isMentioned) {
      // Not for us
      return;
    }

    try {
      // Show typing status
      await message.channel.sendTyping();

      // Clean up the mention from the message content
      const mentionRegex = new RegExp(`<@!?${client.user.id}>`, 'g');
      let cleanedContent = message.content.replace(mentionRegex, '').trim();

      // Handle simple Reset/Clear Command
      const lowerContent = cleanedContent.toLowerCase();
      if (lowerContent === 'reset' || lowerContent === 'clear history' || lowerContent === 'clear') {
        dbOps.clearChatHistory(message.channel.id);
        await message.reply("🧹 Conversation history has been cleared for this channel!");
        return;
      }

      // If user just mentioned the bot without any text, default to a greeting
      if (!cleanedContent) {
        cleanedContent = "hello";
      }

      // 1. Save user's message to the database
      dbOps.addChatMessage(
        message.channel.id,
        message.author.id,
        message.author.username,
        cleanedContent
      );

      // 2. Fetch the recent history (last 15 messages) for this channel/DM
      const history = dbOps.getChatHistory(message.channel.id, 15);

      // 3. Generate response using AI
      let botResponse = await aiService.generateChatResponse(
        client.user.id,
        client.user.username,
        history,
        message.author.id
      );

      // Extract and handle [SET_TIMEZONE: ...] tag if the AI appended it
      const tzRegex = /\[SET_TIMEZONE:\s*([a-zA-Z0-9_\/+-]+)\]/i;
      const match = botResponse.match(tzRegex);
      if (match) {
        const detectedTz = match[1].trim();
        dbOps.setUserTimezone(message.author.id, detectedTz);
        // Remove the tag from the final response text
        botResponse = botResponse.replace(tzRegex, '').trim();
      }

      // 4. Send response as a reply
      await message.reply(botResponse);

      // 5. Save bot's response to the database
      dbOps.addChatMessage(
        message.channel.id,
        client.user.id,
        client.user.username,
        botResponse
      );

    } catch (error) {
      console.error("Error processing message:", error);
      try {
        await message.reply(`⚠️ Sorry, I encountered an error: ${error.message}`);
      } catch (e) {
        console.error("Failed to send error reply:", e);
      }
    }
  }
};
