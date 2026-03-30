// SmartSummary — Backend server
// Proxies Gemini API calls and handles Stripe subscription management.

const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

// ── Configuration ───────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is required.');
  process.exit(1);
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const app = express();

// ── Middleware ───────────────────────────────────────────────────────

// Stripe webhooks need raw body, so this route is registered before json parser
app.post('/api/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ── Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/summarize
 * Receives page text, calls Gemini, returns bullet-point summary.
 */
app.post('/api/summarize', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return res.status(400).json({ error: 'Text is too short or missing.' });
    }

    const summary = await callGemini(text);
    res.json({ summary });
  } catch (err) {
    console.error('Summarize error:', err.message);
    res.status(500).json({ error: 'Failed to generate summary. Please try again.' });
  }
});

/**
 * POST /api/verify-subscription
 * Checks if a given customer email has an active Stripe subscription.
 */
app.post('/api/verify-subscription', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured.' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return res.json({ isPro: false });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: 'active',
      limit: 1,
    });

    res.json({ isPro: subscriptions.data.length > 0 });
  } catch (err) {
    console.error('Verify subscription error:', err.message);
    res.status(500).json({ error: 'Could not verify subscription.' });
  }
});

/**
 * POST /api/create-checkout
 * Creates a Stripe Checkout Session for SmartSummary Pro.
 */
app.post('/api/create-checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'SmartSummary Pro',
              description: 'Unlimited AI-powered web page summaries',
            },
            unit_amount: 499, // 4.99 EUR in cents
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create checkout error:', err.message);
    res.status(500).json({ error: 'Could not create checkout session.' });
  }
});

/**
 * POST /api/webhook
 * Handles Stripe webhook events to activate/deactivate Pro.
 */
async function handleWebhook(req, res) {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured.' });
  }

  let event;
  try {
    if (STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // In dev mode without webhook secret, parse the raw body
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`Checkout completed for customer: ${session.customer}`);
      // In production, store this in a database.
      // For the MVP, the extension checks subscription status via /api/verify-subscription.
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log(`Subscription cancelled for customer: ${subscription.customer}`);
      break;
    }
    default:
      // Unhandled event type — ignore silently
      break;
  }

  res.json({ received: true });
}

// ── Gemini API ──────────────────────────────────────────────────────

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGemini(text) {
  const prompt = `You are a summarization assistant. Summarize the following web page content into 5-8 clear, concise bullet points. Each bullet point should be on its own line, starting with "- ". Focus on the key information and main ideas. Be factual and objective.\n\nContent:\n${text}`;

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Gemini API error:', response.status, body);
    throw new Error('Gemini API request failed.');
  }

  const data = await response.json();

  // Extract the generated text from Gemini response
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0 || !candidates[0].content) {
    throw new Error('Gemini returned no content.');
  }

  const parts = candidates[0].content.parts;
  if (!parts || parts.length === 0) {
    throw new Error('Gemini response has no parts.');
  }

  return parts[0].text;
}

// ── Start server ────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`SmartSummary backend running on http://localhost:${PORT}`);
  console.log(`Stripe: ${stripe ? 'configured' : 'NOT configured (set STRIPE_SECRET_KEY)'}`);
});
