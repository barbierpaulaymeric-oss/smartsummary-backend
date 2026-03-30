# SmartSummary

AI-powered Chrome extension that summarizes any web page into clear bullet points.

## Features

- One-click or keyboard shortcut (Alt+S) page summarization
- Clean bullet-point summaries powered by Google Gemini
- Freemium model: 5 free summaries/day, unlimited with Pro ($4.99/mo)
- Dark/light mode auto-detection
- Minimal, modern UI

## Architecture

- **extension/** — Chrome Extension (Manifest V3, vanilla JS)
- **server/** — Node.js/Express backend that proxies Gemini API and handles Stripe

## Setup

### Backend

```bash
cd server
cp .env.example .env
# Edit .env with your API keys
npm install
node index.js
```

### Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key (required) |
| `STRIPE_SECRET_KEY` | Stripe secret key (for Pro subscriptions) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `PORT` | Server port (default: 3000) |
