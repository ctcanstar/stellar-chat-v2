# Stellar Optimizely Widget

Embeddable AI chatbot for Canstar health insurance comparison pages, designed to be injected via Optimizely Web Experimentation.

## Architecture

```
Browser (Optimizely snippet.js) → scrapes product data from DOM
                                 → sends to Vercel API proxy (api/chat.js)
                                 → calls Gemini API
                                 → streams SSE response back
```

## Deployment

### 1. Deploy to Vercel

```bash
cd stellar-optimizely
npm install
npx vercel login
npx vercel --yes
```

### 2. Set the API key

Gemini Key provided in Vercel app environment

### 3. Deploy to production

```bash
npx vercel --prod
```

Note the production URL (e.g., `https://stellar-optimizely.vercel.app`).

### 4. Update snippet.js

In `snippet.js`, update the `API_URL` constant at the top to point to your Vercel deployment:

```js
var API_URL = "https://your-project.vercel.app/api/chat";
```

## Optimizely Setup

1. **Create a new experiment** in Optimizely Web Experimentation
2. **Set URL targeting** to: `https://www.canstar.com.au/health-insurance/results/compare/*`
3. **In the variation**, open the custom code editor
4. **Paste the contents of `snippet.js`** into the custom code editor
5. **Set traffic allocation** as desired
6. **Activate the experiment**

## Testing

Before using Optimizely, you can test by:

1. Opening a Canstar comparison page in Chrome
2. Opening DevTools console (Cmd+Option+J)
3. Pasting the contents of `snippet.js` and pressing Enter
4. The Stellar chat button should appear in the bottom-right corner

## How It Works

- **DOM Scraper**: Reads product data directly from the Canstar comparison page tables (premium, hospital cover, extras limits, special offers, combined limits)
- **API Proxy**: Vercel serverless function that forwards requests to Anthropic with CORS headers for canstar.com.au
- **Chat UI**: Self-contained vanilla JS widget with the same features as the standalone chatbot (quick actions, Help Me Choose wizard, streaming responses)

## Files

- `api/chat.js` — Vercel serverless function (Anthropic API proxy with CORS)
- `snippet.js` — Self-contained Optimizely injection script (all HTML/CSS/JS)
- `vercel.json` — CORS headers and function configuration
- `package.json` — Dependencies (@anthropic-ai/sdk)
# stellar-optimizely-gem
