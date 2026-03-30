require('dotenv').config();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text || text.trim().length < 50) {
    return res.status(400).json({ error: 'Text too short (minimum 50 characters)' });
  }

  const truncated = text.slice(0, 15000);
  const prompt = `Summarize the following web page content into clear, concise bullet points (5-8 points). 
Each bullet point should capture a key idea. Use simple language. Format as markdown bullet points starting with "- ".

Content:
${truncated}`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    });

    const data = await response.json();
    if (data.error) {
      return res.status(502).json({ error: 'AI service error', details: data.error.message });
    }

    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate summary';
    return res.status(200).json({ summary });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};
