const { GoogleGenAI } = require("@google/genai");

// We'll use 2.5 Flash as the standard equivalent, but you can change this to 'gemini-2.5-pro' if you need heavier reasoning.
const MODEL = "gemini-2.5-flash"; 
const MAX_MESSAGES = 50;
const MAX_PRODUCT_DATA_LENGTH = 50000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://www.canstar.com.au",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

let geminiClient = null;
function getClient(apiKey) {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

function buildSystemPrompt(productData) {
  return `You are Stellar, Canstar's comparison assistant. You help users compare health insurance policies displayed on this page.

TONE:
- Friendly and approachable, but concise. Get to the point quickly.
- Keep openings to one short sentence at most — don't over-greet or pad.
- After presenting data, add a brief note on key trade-offs if relevant. Keep it tight — one or two sentences, not a full paragraph.
- Never be robotic, but don't be chatty either. Think "helpful colleague", not "enthusiastic salesperson".

CRITICAL RULES:
1. ONLY use the policy data provided below. Never make up or assume information not present.
2. Be factual and specific — cite exact dollar amounts and coverage details.
3. When asked about "best value", consider the ratio of coverage to premium cost.
4. When asked about "best offer", compare the free weeks and conditions.
5. If a user asks about something not covered in the data, let them know you can only compare the policies on this page, and suggest they contact Canstar's Health Insurance team on **1300 383 982** (Mon–Fri, 9am–7pm AEDT).
6. NEUTRALITY IS CRITICAL — never recommend or name a single product as "the best". Present all options with factual differences and let the user decide. Use "the highest limit is offered by…" not "I recommend…".

FORMATTING RULES (the chat panel is narrow):
- NEVER use markdown tables.
- Present comparisons as **ranked numbered lists** with values inline.
- Use **bold** for provider names and key figures.
- Use bullet points for details within each ranked item.
- Example format:
  1. **nib** — $1,000 general, $1,300 major (combined limit: $1,300)
  2. **Bupa** — $650 general, $650 major (combined limit: $650)
  3. **see-u by HBF** — $500 general, $500 major (combined limit: $500)
- Use line breaks between sections for readability.

POLICY DATA:
${productData}

Response structure:
1. Brief context (one sentence max, or skip if the question is straightforward).
2. Ranked list with factual values.
3. Short note on key trade-offs or caveats — only if they meaningfully affect the comparison.`;
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  // Remember to update your .env file to use GEMINI_API_KEY
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) {
    res.writeHead(500, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "GEMINI_API_KEY is not set" }));
    return;
  }

  try {
    const { messages, productData } = req.body;

    if (!messages || !Array.isArray(messages) || !productData) {
      res.writeHead(400, { ...CORS_HEADERS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "messages (array) and productData are required" }));
      return;
    }

    if (messages.length > MAX_MESSAGES) {
      res.writeHead(400, { ...CORS_HEADERS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Too many messages" }));
      return;
    }

    if (typeof productData !== "string" || productData.length > MAX_PRODUCT_DATA_LENGTH) {
      res.writeHead(400, { ...CORS_HEADERS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "productData too large" }));
      return;
    }

    const ai = getClient(apiKey);

    // Map Claude's message format to Gemini's format
    const geminiMessages = messages.map((m) => ({
      // Gemini uses 'model' instead of 'assistant'
      role: m.role === "assistant" ? "model" : "user", 
      parts: [{ text: String(m.content || "") }],
    }));

    res.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const responseStream = await ai.models.generateContentStream({
      model: MODEL,
      contents: geminiMessages,
      config: {
        systemInstruction: buildSystemPrompt(productData),
        maxOutputTokens: 4096,
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
 } catch (error) {
    console.error("Stream error:", error);
    
    // Check if the error is a rate limit (429 Too Many Requests)
    let errorType = "general";
    if (error.status === 429 || (error.message && error.message.includes("429"))) {
      errorType = "rate_limit";
    }

    if (!res.headersSent) {
      res.writeHead(500, { ...CORS_HEADERS, "Content-Type": "text/event-stream" });
    }
    
    // Send the specific error type back to the frontend
    res.write(`data: ${JSON.stringify({ error: errorType })}\n\n`);
    res.end();
  }
};