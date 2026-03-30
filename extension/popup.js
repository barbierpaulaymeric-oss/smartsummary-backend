// SmartSummary — Popup script
// Handles UI interactions and communicates with the background service worker.

const BACKEND_URL = 'http://localhost:3000';

const elements = {
  summarizeBtn: document.getElementById('summarize-btn'),
  summaryContent: document.getElementById('summary-content'),
  summaryPlaceholder: document.getElementById('summary-placeholder'),
  loading: document.getElementById('loading'),
  errorBanner: document.getElementById('error-banner'),
  counter: document.getElementById('counter'),
  upgradeBtn: document.getElementById('upgrade-btn'),
  statusFree: document.getElementById('status-free'),
  statusPro: document.getElementById('status-pro'),
};

// ── State ───────────────────────────────────────────────────────────

/** Refresh the counter display and pro/free status. */
async function refreshStatus() {
  const { isPro, dailyCount, dailyDate } = await chrome.storage.local.get([
    'isPro',
    'dailyCount',
    'dailyDate',
  ]);

  if (isPro) {
    elements.statusFree.classList.add('hidden');
    elements.statusPro.classList.remove('hidden');
    elements.upgradeBtn.classList.add('hidden');
  } else {
    elements.statusFree.classList.remove('hidden');
    elements.statusPro.classList.add('hidden');

    const today = new Date().toISOString().slice(0, 10);
    const count = dailyDate === today ? (dailyCount || 0) : 0;
    const remaining = Math.max(0, 5 - count);
    elements.counter.textContent = `${remaining}/5 free summaries remaining`;
  }
}

// ── Error handling ──────────────────────────────────────────────────

function showError(message) {
  elements.errorBanner.textContent = message;
  elements.errorBanner.classList.remove('hidden');
}

function hideError() {
  elements.errorBanner.classList.add('hidden');
}

// ── Summarize flow ──────────────────────────────────────────────────

async function handleSummarize() {
  hideError();
  elements.summaryPlaceholder.classList.add('hidden');
  elements.summaryContent.classList.add('hidden');
  elements.loading.classList.remove('hidden');
  elements.summarizeBtn.disabled = true;

  try {
    // Send message to background service worker
    const response = await chrome.runtime.sendMessage({ action: 'summarize' });

    if (response.error) {
      showError(response.error);
      elements.summaryPlaceholder.classList.remove('hidden');
      return;
    }

    renderSummary(response.summary);
  } catch (err) {
    showError('Something went wrong. Please try again.');
    elements.summaryPlaceholder.classList.remove('hidden');
  } finally {
    elements.loading.classList.add('hidden');
    elements.summarizeBtn.disabled = false;
    await refreshStatus();
  }
}

/** Render bullet-point summary into the UI. */
function renderSummary(text) {
  // Split by newlines, strip leading bullets/dashes/numbers, filter empty
  const bullets = text
    .split('\n')
    .map(line => line.replace(/^[\s\-\*•\d.]+/, '').trim())
    .filter(Boolean);

  if (bullets.length === 0) {
    showError('The summary was empty. The page may not have enough content.');
    elements.summaryPlaceholder.classList.remove('hidden');
    return;
  }

  const ul = document.createElement('ul');
  for (const bullet of bullets) {
    const li = document.createElement('li');
    li.textContent = bullet;
    ul.appendChild(li);
  }

  elements.summaryContent.innerHTML = '';
  elements.summaryContent.appendChild(ul);
  elements.summaryContent.classList.remove('hidden');
}

// ── Upgrade flow ────────────────────────────────────────────────────

async function handleUpgrade() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'upgrade' });
    if (response.error) {
      showError(response.error);
      return;
    }
    if (response.checkoutUrl) {
      chrome.tabs.create({ url: response.checkoutUrl });
    }
  } catch (err) {
    showError('Could not start checkout. Please try again.');
  }
}

// ── Event listeners ─────────────────────────────────────────────────

elements.summarizeBtn.addEventListener('click', handleSummarize);
elements.upgradeBtn.addEventListener('click', handleUpgrade);

// Initialize status on popup open
refreshStatus();
