import { ActivityType } from 'discord.js';

export const readyEvent = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`🤖 Bot logged in as ${client.user.tag}!`);
    console.log(`📡 Kasandra is online and listening to mentions and DMs in ${client.guilds.cache.size} guilds.`);
    
  }
};
