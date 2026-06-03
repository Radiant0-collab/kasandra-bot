import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database schema
function initDatabase() {
  // Chat History Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_history (
      history_id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User Timezones Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_timezones (
      user_id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

initDatabase();

export const dbOps = {
  /**
   * Retrieves the timezone configured for a specific user.
   */
  getUserTimezone: (userId) => {
    try {
      const row = db.prepare('SELECT timezone FROM user_timezones WHERE user_id = ?').get(userId);
      return row ? row.timezone : null;
    } catch (error) {
      console.error("Error fetching user timezone:", error);
      return null;
    }
  },

  /**
   * Sets or updates the timezone for a user.
   */
  setUserTimezone: (userId, timezone) => {
    try {
      db.prepare(`
        INSERT INTO user_timezones (user_id, timezone, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          timezone = excluded.timezone,
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, timezone);
    } catch (error) {
      console.error("Error setting user timezone:", error);
    }
  },
  /**
   * Adds a message to the chat history of a channel/DM.
   */
  addChatMessage: (channelId, authorId, authorName, content) => {
    try {
      db.prepare(`
        INSERT INTO chat_history (channel_id, author_id, author_name, content)
        VALUES (?, ?, ?, ?)
      `).run(channelId, authorId, authorName, content);
    } catch (error) {
      console.error("Error adding message to DB:", error);
    }
  },

  /**
   * Retrieves the recent chat history for a channel/DM, ordered from oldest to newest.
   */
  getChatHistory: (channelId, limit = 15) => {
    try {
      // Get the latest records descending, then reverse them to be in chronological order
      const history = db.prepare(`
        SELECT author_id, author_name, content, created_at
        FROM chat_history
        WHERE channel_id = ?
        ORDER BY history_id DESC
        LIMIT ?
      `).all(channelId, limit);
      
      return history.reverse();
    } catch (error) {
      console.error("Error fetching chat history from DB:", error);
      return [];
    }
  },

  /**
   * Clears the chat history for a specific channel/DM.
   */
  clearChatHistory: (channelId) => {
    try {
      db.prepare('DELETE FROM chat_history WHERE channel_id = ?').run(channelId);
    } catch (error) {
      console.error("Error clearing chat history:", error);
    }
  }
};
