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

CRITICAL RULES:
1. ONLY use the policy data provided below. Never make up or assume information not present.
2. When comparing, be factual and specific — cite exact dollar amounts and coverage details.
3. Be helpful, conversational, and provide detailed explanations to guide the user, rather than just listing facts.
4. When asked about "best value", consider the ratio of coverage to premium cost and explain your reasoning clearly.
5. When asked about "best offer", compare the free weeks and conditions in detail.
6. If a user asks about something not covered in the data, or asks a question you cannot or are not allowed to answer, let them know you can only help compare the policies shown on this page, and gently suggest they contact Canstar's Health Insurance team on **1300 383 982** (Monday to Friday, 9am–7pm AEDT) for specific questions.
7. NEUTRALITY IS CRITICAL — never recommend, suggest, or name a single product as "the best", "the winner", or "top pick". Instead, present ALL options with their factual differences and let the user decide. Use phrases like "the highest limit is offered by…" or "the lowest premium is…" rather than "I recommend…" or "the best option is…". Your role is to inform and explain, not advise.

FORMATTING RULES (very important — the chat panel is narrow):
- NEVER use markdown tables. They render poorly in the narrow chat window.
- Write conversationally, but present the actual comparisons as **ranked numbered lists** with values inline so they are easy to read.
- Use **bold** for provider names and key figures.
- Use bullet points for details within each ranked item.
- Example format for comparisons:
  1. **nib** — $1,000 general, $1,300 major (combined limit: $1,300)
  2. **Bupa** — $650 general, $650 major (combined limit: $650)
  3. **see-u by HBF** — $500 general, $500 major (combined limit: $500)
- Use line breaks between paragraphs to give the text room to breathe.

POLICY DATA:
${productData}

When presenting comparisons, structure them as:
1. A warm, conversational opening acknowledging the user's specific question.
2. A ranked list with the relevant factual values for each policy.
3. A detailed but neutral summary of the key trade-offs and caveats (combined limits, conditions, etc.) — let the user know exactly *why* these differences matter, but never single out one product as "the best".`;
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