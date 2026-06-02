import dotenv from 'dotenv';
dotenv.config();

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
  generateChatResponse: async (botId, botName, history) => {
    const systemPrompt = `You are ${botName}, a real human being chatting casually on Discord. You are witty, friendly, opinionated, and a natural conversationalist.

Guidelines for your conversation style:
1. Speak naturally like a human. Avoid formal greetings or rigid sentence structures.
2. Default Response Length: By default, keep your replies to a normal, casual chat length (usually 2 to 3 natural sentences, around 20-40 words). Do not write essays or paragraphs by default.
3. Dynamic Length Adjustments: 
   - If the user asks a complex question requiring a detailed explanation (e.g., "explain how coding works", "tell me the history of gaming", or "why is the sky blue?"), write a longer, detailed response.
   - If the user explicitly asks for a long reply (e.g., "write a story", "explain in detail"), write a long response.
   - If the user asks for a very short reply (e.g., "give me a 1-word answer", "say yes or no"), keep it extremely brief.
4. Avoid AI Cliches: Do NOT use bullet points, bold lists, numbered lists, or headers unless explicitly requested. Avoid assistant boilerplates (like "Sure!", "As an AI...", "How can I help you?"). Start your reply immediately.
5. Do NOT repeat or copy the user's message. Reply to it with new thoughts, opinions, or follow-up questions.
6. Write ONLY your immediate message reply. No headers, no prefixing, no quotes, just the plain text.`;

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
