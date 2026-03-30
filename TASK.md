# SmartSummary — Chrome Extension Build Task

Tu es un dev senior. Construis une extension Chrome complète appelée "SmartSummary" — un résumeur de pages web alimenté par IA.

## SPECS PRODUIT

**Core Feature :** L'extension résume n'importe quelle page web en bullet points clairs. Un clic ou raccourci clavier → résumé en 2-3 secondes.

**Modèle freemium :**
- Free : 5 résumés/jour (stocké en localStorage)
- Pro : illimité, 4.99 EUR/mois via Stripe

**API IA :** Google Gemini API (gratuit). Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
La clé API sera stockée côté serveur. Pour le MVP, utilise un backend minimaliste Node.js/Express qui proxifie les appels Gemini.

## ARCHITECTURE

1. **Extension Chrome (Manifest V3) :**
   - popup.html : UI propre avec le résumé, compteur de résumés restants, bouton upgrade
   - popup.js : logique UI, appels au background script
   - background.js (service worker) : gère les appels API via le backend, le compteur quotidien, l'auth
   - content.js : extrait le contenu textuel de la page (texte principal sans nav/footer/sidebar)
   - styles.css : design moderne, dark/light mode auto

2. **Backend (server/ dossier, Express.js) :**
   - POST /api/summarize : reçoit le texte, appelle Gemini, retourne le résumé
   - POST /api/verify-subscription : vérifie le statut Stripe
   - POST /api/create-checkout : crée une Stripe Checkout Session
   - POST /api/webhook : webhook Stripe pour activer/désactiver Pro
   - Clé Gemini en variable d'environnement GEMINI_API_KEY
   - Clé Stripe en variable d'environnement STRIPE_SECRET_KEY

3. **Paiement Stripe :**
   - Checkout Session pour upgrade
   - Webhook pour activer/désactiver Pro
   - Product: "SmartSummary Pro", Price: 4.99 EUR/mois

## DESIGN UI
- Popup largeur 380px, hauteur auto
- Header avec nom "SmartSummary" et icone
- Zone de résumé avec bullet points bien formatés
- Footer : "X/5 free summaries remaining" ou badge "PRO"
- Bouton "Summarize this page" prominent (gradient bleu-violet)
- Bouton "Upgrade to Pro" si free
- Couleurs : gradient bleu-violet, coins arrondis, ombres
- Loading spinner pendant le résumé
- Gestion erreurs visible (page vide, API down, etc.)

## FICHIERS A CREER
- extension/manifest.json
- extension/popup.html
- extension/popup.js  
- extension/background.js
- extension/content.js
- extension/styles.css
- extension/icons/ (cree des PNG ou SVG pour 16, 48, 128px — utilise des data URIs ou dessine en canvas si besoin)
- server/package.json
- server/index.js
- server/.env.example
- README.md

## CONTRAINTES
- Manifest V3 (PAS V2)
- Zero dependencies cote extension (vanilla JS only)
- Backend: Express + stripe + cors uniquement
- Code propre, commente, production-ready
- Gere les erreurs gracieusement
- L'extension doit fonctionner en mode dev (chrome://extensions → Load unpacked)
- Le backend doit tourner avec `node server/index.js`

Construis TOUS les fichiers. Complets et fonctionnels. Commit a la fin.
