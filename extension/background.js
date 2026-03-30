// SmartSummary — Background service worker
// Manages API calls, daily usage counter, and Stripe checkout.

const BACKEND_URL = 'http://localhost:3000';
const FREE_DAILY_LIMIT = 5;

// ── Helpers ─────────────────────────────────────────────────────────

/** Get today's date string (YYYY-MM-DD). */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Read and sanitize the daily usage counter. Resets if the day changed. */
async function getUsage() {
  const { dailyCount, dailyDate } = await chrome.storage.local.get([
    'dailyCount',
    'dailyDate',
  ]);
  if (dailyDate !== today()) {
    await chrome.storage.local.set({ dailyCount: 0, dailyDate: today() });
    return 0;
  }
  return dailyCount || 0;
}

/** Increment the daily usage counter. */
async function incrementUsage() {
  const count = await getUsage();
  await chrome.storage.local.set({ dailyCount: count + 1, dailyDate: today() });
}

/** Check if the user has a Pro subscription. */
async function isPro() {
  const { isPro } = await chrome.storage.local.get('isPro');
  return !!isPro;
}

// ── Content extraction ──────────────────────────────────────────────

/** Inject content script and extract page text from the active tab. */
async function extractPageContent(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });

  if (!results || !results[0] || !results[0].result) {
    throw new Error('Could not extract page content. Make sure you are on a regular web page.');
  }

  const text = results[0].result;
  if (text.trim().length < 50) {
    throw new Error('This page does not have enough text content to summarize.');
  }

  return text;
}

// ── API calls ───────────────────────────────────────────────────────

/** Send text to the backend for summarization. */
async function summarizeText(text) {
  // Truncate to ~8000 chars to stay within API limits
  const truncated = text.slice(0, 8000);

  const res = await fetch(`${BACKEND_URL}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: truncated }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Backend returned an error. Please try again.');
  }

  const data = await res.json();
  return data.summary;
}

/** Create a Stripe Checkout session and return the URL. */
async function createCheckoutSession() {
  const res = await fetch(`${BACKEND_URL}/api/create-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Could not create checkout session.');
  }

  const data = await res.json();
  return data.url;
}

// ── Message handler ─────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'summarize') {
    handleSummarize().then(sendResponse);
    return true; // Keep the message channel open for async response
  }

  if (message.action === 'upgrade') {
    handleUpgrade().then(sendResponse);
    return true;
  }
});

async function handleSummarize() {
  try {
    // Check usage limits (unless Pro)
    const pro = await isPro();
    if (!pro) {
      const usage = await getUsage();
      if (usage >= FREE_DAILY_LIMIT) {
        return { error: 'Daily free limit reached. Upgrade to Pro for unlimited summaries.' };
      }
    }

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      return { error: 'No active tab found.' };
    }

    // Check for restricted pages
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      return { error: 'Cannot summarize browser internal pages.' };
    }

    // Extract content and summarize
    const text = await extractPageContent(tab.id);
    const summary = await summarizeText(text);

    // Increment usage after success
    if (!pro) {
      await incrementUsage();
    }

    return { summary };
  } catch (err) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

async function handleUpgrade() {
  try {
    const url = await createCheckoutSession();
    return { checkoutUrl: url };
  } catch (err) {
    return { error: err.message || 'Could not start checkout.' };
  }
}

// ── Keyboard shortcut handler ───────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'summarize-page') {
    // Open the popup programmatically (keyboard shortcut)
    await chrome.action.openPopup();
  }
});
