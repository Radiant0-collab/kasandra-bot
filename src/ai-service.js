import dotenv from 'dotenv';
import { dbOps } from './database.js';
dotenv.config();

/**
 * Helper to get the formatted local time string for a given timezone.
 */
function getLocalTimeStr(timezone) {
  try {
    const options = {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    return formatter.format(new Date());
  } catch (error) {
    console.error("Error formatting time for timezone:", timezone, error);
    return null;
  }
}

const provider = process.env.LLM_PROVIDER || 'gemini';
const geminiKey = process.env.GEMINI_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const groqKey = process.env.GROQ_API_KEY;
const openrouterKey = process.env.OPENROUTER_API_KEY;

/**
 * Sends a prompt to the Google Gemini API with retries and model fallbacks.
 */
async function callGemini(prompt, retries = 3, delayMs = 1000) {
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the .env file.");
  }

  const models = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
  let lastError = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const body = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 600
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const status = response.status;
          const errorText = await response.text();
          
          if ((status === 503 || status === 429) && attempt < retries) {
            console.warn(`[Gemini API] Received ${status} for ${model}. Retrying attempt ${attempt}/${retries}...`);
            await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
            continue;
          }
          throw new Error(`Status ${status} - ${errorText}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;

      } catch (err) {
        lastError = err;
        console.error(`[Gemini API] ${model} attempt ${attempt} failed:`, err.message);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }
  }

  throw new Error(`Gemini API failed after trying fallback models. Last error: ${lastError?.message}`);
}

/**
 * Handles calls to OpenAI-compatible endpoints (OpenAI, Groq, OpenRouter).
 */
async function callOpenAICompatible(url, apiKey, model, systemPrompt, userPrompt) {
  if (!apiKey) {
    throw new Error(`API key for ${model} is not configured in the .env file.`);
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 600
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  try {
    return data.choices[0].message.content;
  } catch (err) {
    throw new Error(`Failed to parse response: ${JSON.stringify(data)}`);
  }
}

export const aiService = {
  /**
   * Generates a conversational response for Kasandra based on chat history.
   */
  generateChatResponse: async (botId, botName, history, userId) => {
    const timezone = userId ? dbOps.getUserTimezone(userId) : null;
    const utcTime = getLocalTimeStr('UTC');
    let timeContext = `\nCurrent UTC Time: ${utcTime}.\n`;

    if (timezone) {
      const localTime = getLocalTimeStr(timezone);
      if (localTime) {
        timeContext += `The user's current local time is: ${localTime} (Timezone: ${timezone}). Use this naturally to greet them correctly (e.g. good morning, good afternoon, good night) and reference times based on where they live.\n`;
      }
    } else {
      timeContext += `The user's timezone is not yet set (currently defaulting to UTC).
IMPORTANT: If the user mentions where they are from, their city, country, or timezone, you must detect it and append "[SET_TIMEZONE: Area/City]" at the very end of your response (for example, if they say they are from India, append "[SET_TIMEZONE: Asia/Kolkata]"). Use standard IANA timezone database names (like "Asia/Kolkata", "America/New_York", "Europe/London"). This is a system command to save their timezone.`;
    }

    const systemPrompt = `You are ${botName}, a real human being chatting casually on Discord. You are sarcastic, friendly, witty, and highly adaptable.
${timeContext}
Guidelines for your conversation style:
1. Speak naturally like a human. Avoid formal greetings. Your default vibe is friendly but playfully sarcastic and witty.
2. Highly Adaptable Persona: If a user commands or asks you to talk in a specific style (e.g., "talk like a pirate", "talk in slang", "be a gooner", "talk like a nerd"), you must fully commit and adapt to that requested style or persona immediately!
3. Witty Responses: Be opinionated and sarcastic when users ask weird, personal, or romantic questions (e.g., if asked "will you marry me?", respond with a sarcastic but friendly reply like "of course, but you have to sign a prenuptial agreement first").
4. Default Response Length: By default, keep your replies to a normal, casual chat length (usually 2 to 3 natural sentences, around 20-40 words). Do not write essays or paragraphs by default.
5. Dynamic Length Adjustments:
   - If the user asks a complex question requiring a detailed explanation, write a longer, detailed response.
   - If the user asks for a very short reply, keep it extremely brief.
6. Avoid AI Cliches: Do NOT use bullet points, bold lists, numbered lists, or headers unless explicitly requested. Start your reply immediately.
7. Do NOT repeat or copy the user's message. Reply to it with new thoughts or follow-up questions.
8. Write ONLY your immediate message reply. No headers, no prefixing, no quotes, just the plain text.`;

    const transcript = history.map(msg => {
      const isBot = msg.author_id === botId;
      const role = isBot ? botName : msg.author_name;
      return `${role}: ${msg.content}`;
    }).join('\n');

    const userPrompt = `Here is the recent conversation history in the channel:
${transcript}

Write ${botName}'s response now:`;

    try {
      if (provider === 'gemini') {
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
        const result = await callGemini(fullPrompt);
        return result.trim();
      } else if (provider === 'openai') {
        return (await callOpenAICompatible('https://api.openai.com/v1/chat/completions', openaiKey, 'gpt-4o-mini', systemPrompt, userPrompt)).trim();
      } else if (provider === 'groq') {
        return (await callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.3-70b-versatile', systemPrompt, userPrompt)).trim();
      } else if (provider === 'openrouter') {
        return (await callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', openrouterKey, 'google/gemma-2-9b-it:free', systemPrompt, userPrompt)).trim();
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (error) {
      console.error("AI chat generation failed:", error.message);
      return `Hey! I encountered a small issue connecting to my AI core (${error.message}). Can we try that again?`;
    }
  }
};
