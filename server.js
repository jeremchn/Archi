const fs = require('fs');
const path = require('path');
const https = require('https');

// === CONFIGURE ICI TON LIEN DIRECT GOOGLE DRIVE OU DROPBOX ===
const EMBEDDED_FILE = path.join(__dirname, 'data_embedded.json');
// Nouveau lien direct Google Drive
const REMOTE_URL = 'https://drive.google.com/uc?export=download&id=11lHwu_joM-zj-Np7GPQBzBJ0OJiZLAtF';

function downloadFile(url, dest, cb) {
  const file = fs.createWriteStream(dest);
  https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => file.close(cb));
  });
}

function startServer() {
  require('dotenv').config();

  const express = require('express');
  const cors = require('cors');
  const axios = require('axios');

  const app = express();
  const PORT = process.env.PORT || 5000;

  app.use(cors());
  app.use(express.json());

  // Serve static files (like index.html, CSS, JS)
  app.use(express.static(__dirname));

  // Charge les données d'entreprises (avec embeddings inclus)
  const data = JSON.parse(fs.readFileSync('data2000_embedded.json', 'utf-8'));

  // Vérification de la présence et de la taille des embeddings
  if (
    !Array.isArray(data) ||
    !data[0] ||
    !Array.isArray(data[0].embedding) ||
    data[0].embedding.length !== 1536
  ) {
    console.error('ERREUR: Chaque objet de data2000_embedded.json doit avoir une propriété "embedding" de taille 1536.');
    process.exit(1);
  }
  // Vérifie que tous les embeddings ont la bonne taille
  for (let i = 0; i < data.length; i++) {
    if (!Array.isArray(data[i].embedding) || data[i].embedding.length !== 1536) {
      console.error(`ERREUR: L\'embedding à l\'index ${i} n\'a pas une taille de 1536.`);
      process.exit(1);
    }
  }

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
    console.log('POST /api/semantic-search called'); // DEBUG
    const { query } = req.body;
    if (!query) {
      console.log('No query provided'); // DEBUG
      return res.status(400).json({ error: 'Missing query' });
    }

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
      console.log('Embedding response received'); // DEBUG
      const userEmbedding = embeddingResponse.data.data[0].embedding;
      if (!userEmbedding) {
        console.log('No embedding returned from OpenAI'); // DEBUG
        return res.status(500).json({ error: 'No embedding returned from OpenAI' });
      }

      // Compute similarity with each company
      const scored = data.map((item) => ({
        ...item,
        score: cosineSimilarity(userEmbedding, item.embedding)
      }));

      // Log les 10 meilleurs scores pour debug
      console.log('Top 10 scores:', scored
        .map(x => x.score)
        .sort((a, b) => b - a)
        .slice(0, 10)
      );

      // Sort and return top 50 by similarity score
      scored.sort((a, b) => b.score - a.score);
      // On retire la propriété embedding et score avant d'envoyer au client
      const top50 = scored.slice(0, 50).map(({ score, embedding, ...rest }) => rest);
      res.json(top50);
    } catch (error) {
      console.error('Error in /api/semantic-search:', error); 
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
        const emails = response.data.data.emails || [];
        return emails.length;
      } catch (e) {
        return 0;
      }
    }));

    res.json(results);
  });

  // Endpoint pour récupérer la liste détaillée des contacts Hunter pour un domaine
  app.post('/api/hunter-contacts-details', async (req, res) => {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Missing domain' });
    }
    try {
      const response = await axios.get(
        `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}`
      );
      const emails = response.data.data.emails || [];
      const contacts = emails.map(e => ({
        email: e.value,
        first_name: e.first_name,
        last_name: e.last_name,
        position: e.position,
        linkedin_url: e.linkedin
      }));
      res.json(contacts);
    } catch (e) {
      res.json([]);
    }
  });

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Si le fichier n'existe pas, on le télécharge puis on lance le serveur
if (!fs.existsSync(EMBEDDED_FILE)) {
  console.log('Downloading data2000_embedded.json...');
  downloadFile(REMOTE_URL, EMBEDDED_FILE, () => {
    console.log('Download complete.');
    startServer();
  });
} else {
  startServer();
}