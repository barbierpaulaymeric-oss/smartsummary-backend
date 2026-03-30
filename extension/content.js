// SmartSummary — Content script
// Extracts the main text content from the current page, filtering out
// navigation, sidebars, footers, and other non-content elements.

(function () {
  'use strict';

  // Tags to exclude from text extraction
  const EXCLUDED_TAGS = new Set([
    'NAV', 'FOOTER', 'HEADER', 'ASIDE', 'SCRIPT', 'STYLE', 'NOSCRIPT',
    'SVG', 'IFRAME', 'FORM', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA',
    'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'DIALOG',
  ]);

  // Roles/classes that typically indicate non-content areas
  const EXCLUDED_ROLES = new Set([
    'navigation', 'banner', 'contentinfo', 'complementary', 'search',
  ]);

  const EXCLUDED_CLASS_PATTERNS = /nav|sidebar|footer|header|menu|breadcrumb|widget|ad-|ads-|social|share|comment|related/i;

  /** Check if an element should be excluded from extraction. */
  function shouldExclude(el) {
    if (EXCLUDED_TAGS.has(el.tagName)) return true;

    const role = el.getAttribute('role');
    if (role && EXCLUDED_ROLES.has(role)) return true;

    const cls = el.className;
    if (typeof cls === 'string' && EXCLUDED_CLASS_PATTERNS.test(cls)) return true;

    const id = el.id;
    if (id && EXCLUDED_CLASS_PATTERNS.test(id)) return true;

    return false;
  }

  /** Recursively extract visible text from an element. */
  function extractText(el) {
    if (shouldExclude(el)) return '';
    if (el.nodeType === Node.TEXT_NODE) return el.textContent.trim();
    if (el.nodeType !== Node.ELEMENT_NODE) return '';

    // Skip hidden elements
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return '';

    const parts = [];
    for (const child of el.childNodes) {
      const text = extractText(child);
      if (text) parts.push(text);
    }
    return parts.join(' ');
  }

  // Try <article> or <main> first, then fall back to <body>
  const main = document.querySelector('article') ||
               document.querySelector('[role="main"]') ||
               document.querySelector('main') ||
               document.body;

  const text = extractText(main);

  // Clean up whitespace: collapse multiple spaces/newlines
  const cleaned = text.replace(/\s+/g, ' ').trim();

  // Return the result (used by chrome.scripting.executeScript)
  return cleaned;
})();
