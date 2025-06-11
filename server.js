require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static files (like index.html, CSS, JS)
app.use(express.static(__dirname));

// Charge les données d'entreprises
const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
// Charge les embeddings (tableau de tableaux de nombres)
const embeddings = JSON.parse(fs.readFileSync('embeddings100.json', 'utf-8'));

// Fonction pour calculer la similarité cosinus
function cosineSimilarity(a, b) {
  let dot = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Semantic search endpoint
app.post('/api/semantic-search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    // Embed the user query with OpenAI
    const embeddingResponse = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        input: query,
        model: "text-embedding-3-small"
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAIKEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const userEmbedding = embeddingResponse.data.data[0].embedding;

    // Compute similarity with each company
    const scored = data.map((item, idx) => ({
      ...item,
      score: cosineSimilarity(userEmbedding, embeddings[idx])
    }));

    // Sort and return top 20
    scored.sort((a, b) => b.score - a.score);
    res.json(scored.slice(0, 20));
  } catch (error) {
    res.status(500).json({ error: 'Embedding or search failed', details: error.message });
  }
});

const HUNTER_API_KEY = process.env.HUNTERKEY;

// Endpoint pour récupérer le nombre de contacts Hunter pour chaque domaine
app.post('/api/hunter-contacts', async (req, res) => {
  const { companies } = req.body;
  if (!companies || !Array.isArray(companies)) {
    return res.status(400).json({ error: 'Missing companies array' });
  }

  const results = await Promise.all(companies.map(async (domain) => {
    try {
      const response = await axios.get(
        `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}`
      );
      return response.data.data.emails.length || 0;
    } catch (e) {
      return 0;
    }
  }));

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});