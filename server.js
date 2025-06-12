const fs = require('fs');
const path = require('path');
const https = require('https');

// === CONFIGURE ICI TON LIEN DIRECT GOOGLE DRIVE OU DROPBOX ===
const EMBEDDED_FILE = path.join(__dirname, 'data2000_embedded.json');
// Remplace par ton vrai lien direct (exemple Google Drive)
const REMOTE_URL = 'https://drive.google.com/uc?export=download&id=1PAIpDMmTJcILpuRe7lVvPw1lm-n9GVmc';

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

  // Charge les données d'entreprises
  const data = JSON.parse(fs.readFileSync('data2000.json', 'utf-8'));
  // Charge les embeddings (tableau de tableaux de nombres)
  const embeddings = JSON.parse(fs.readFileSync('data2000_embedded.json', 'utf-8'));

  // Vérification de la cohérence des fichiers
  if (data.length !== embeddings.length) {
    console.error(`ERREUR: data2000.json (${data.length}) et data2000_embedded.json (${embeddings.length}) n'ont pas la même longueur !`);
    process.exit(1);
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

      // Log les 10 meilleurs scores pour debug
      console.log('Top 10 scores:', scored
        .map(x => x.score)
        .sort((a, b) => b - a)
        .slice(0, 10)
      );

      // Sort and return top 20 by similarity score
      scored.sort((a, b) => b.score - a.score);
      // Remove the score property before sending to client (optional)
      const top20 = scored.slice(0, 20).map(({ score, ...rest }) => rest);
      res.json(top20);
    } catch (error) {
      console.error(error); 
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