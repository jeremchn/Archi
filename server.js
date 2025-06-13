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
  const data = JSON.parse(fs.readFileSync(EMBEDDED_FILE, 'utf-8'));

  // Vérification de la présence et de la taille des embeddings
  if (
    !Array.isArray(data) ||
    !data[0] ||
    !Array.isArray(data[0].embedding) ||
    data[0].embedding.length !== 1536
  ) {
    console.error(`ERREUR: Chaque objet de ${path.basename(EMBEDDED_FILE)} doit avoir une propriété "embedding" de taille 1536.`);
    process.exit(1);
  }
  // Vérifie que tous les embeddings ont la bonne taille
  for (let i = 0; i < data.length; i++) {
    if (!Array.isArray(data[i].embedding) || data[i].embedding.length !== 1536) {
      console.error(`ERREUR: L'embedding à l'index ${i} n'a pas une taille de 1536.`);
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
      // On retire la propriété embedding mais on garde le score pour l'affichage côté client
      const top50 = scored.slice(0, 50).map(({ embedding, ...rest }) => rest);
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

  // Endpoint pour recherche approfondie OpenAI
  app.post('/api/deep-company-profile', async (req, res) => {
    const { domain, linkedin, name, description } = req.body;
    if (!domain && !linkedin) {
      return res.status(400).json({ error: 'Missing domain or linkedin' });
    }
    try {
      // Récupère les contacts Hunter
      let contacts = [];
      try {
        const hunterRes = await axios.post(`http://localhost:${PORT}/api/hunter-contacts-details`, { domain });
        contacts = Array.isArray(hunterRes.data) ? hunterRes.data : [];
      } catch (e) { contacts = []; }

      // Prompt structuré pour GPT
      const prompt = `Tu es un assistant expert en veille stratégique. Voici le site web: ${domain ? 'http://' + domain : ''}\nLinkedIn: ${linkedin || ''}\nNom: ${name || ''}\nDescription: ${description || ''}\n
Donne-moi les informations suivantes, chaque section doit être concise et adaptée à la rubrique :\n1. Actualités importantes (levées de fonds, nouveaux directeurs, nouveaux produits, événements majeurs, etc.)\n2. Positionnement & points forts de l'entreprise\n3. Événements majeurs récents\n4. Nouveaux produits/services\n5. Changements de direction\nPour chaque section, réponds uniquement par une liste ou un paragraphe adapté, sans introduction ni conclusion. Utilise le format JSON suivant :\n{\n  \"news\": [ ... ],\n  \"position\": \"...\",\n  \"events\": [ ... ],\n  \"products\": [ ... ],\n  \"leadership\": [ ... ]\n}`;
      let gpt_sections = {};
      let gpt_analysis = '';
      try {
        const gptRes = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: 'Tu es un assistant expert en analyse d\'entreprise.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 900,
            temperature: 0.2
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAIKEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        // Extraction JSON robuste
        const match = gptRes.data.choices[0].message.content.match(/\{[\s\S]*\}/);
        if (match) {
          gpt_sections = JSON.parse(match[0]);
        }
        gpt_analysis = gptRes.data.choices[0].message.content;
      } catch (e) { gpt_analysis = 'Impossible d\'obtenir une analyse approfondie.'; }

      // Renvoie toutes les infos pour la fiche
      res.json({
        company: { domain, linkedin, name, description, ...req.body },
        contacts,
        ...gpt_sections,
        gpt_analysis
      });
    } catch (e) {
      res.status(500).json({ error: 'Erreur lors de la recherche approfondie.' });
    }
  });

  // Endpoint pour récupérer les actualités de l'entreprise via NewsAPI
  app.post('/api/company-news', async (req, res) => {
    const { name, domain } = req.body;
    if (!name && !domain) {
      return res.status(400).json({ error: 'Missing name or domain' });
    }
    try {
      const query = name ? `${name}` : domain;
      const apiKey = process.env.NEWSAPI_KEY; // NewsAPI key fournie par l'utilisateur
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=fr&sortBy=publishedAt&pageSize=8&apiKey=${apiKey}`;
      const response = await axios.get(url);
      const articles = (response.data.articles || []).map(article => ({
        title: article.title,
        url: article.url,
        date: article.publishedAt,
        description: article.description || '',
        source: article.source && article.source.name ? article.source.name : ''
      }));
      res.json({ articles });
    } catch (e) {
      res.status(500).json({ error: 'Erreur lors de la récupération des actualités.' });
    }
  });

  // Endpoint pour recherche approfondie LinkedIn
  app.post('/api/company-linkedin', async (req, res) => {
    const { linkedin } = req.body;
    if (!linkedin) return res.status(400).json({ error: 'Missing linkedin url' });
    try {
      // Utilise un user-agent pour éviter le blocage LinkedIn
      const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
      // Récupère la page principale
      const mainRes = await axios.get(linkedin, { headers });
      const mainHtml = mainRes.data;
      // Extraction d'infos principales (nom, description, tendances recrutement)
      let info = {};
      const infoMatch = mainHtml.match(/Accéder aux informations sur ([^<]+)<\/span>.*?Les dernières tendances du recrutement([\s\S]*?)<\/section>/);
      if (infoMatch) {
        info.name = infoMatch[1].trim();
        info.recruitment = infoMatch[2].replace(/<[^>]+>/g, '').trim();
      } else {
        // Fallback : tente d'extraire le titre et le résumé
        const titleMatch = mainHtml.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) info.name = titleMatch[1];
        const descMatch = mainHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
        if (descMatch) info.recruitment = descMatch[1];
      }
      // Récupère la page posts
      let posts = [];
      try {
        const postsRes = await axios.get(linkedin.replace(/\/company\/([^/]+).*/, '/company/$1/posts/?feedView=all'), { headers });
        const postsHtml = postsRes.data;
        // Extraction simple du dernier post (à améliorer selon structure LinkedIn)
        const postMatch = postsHtml.match(/<span[^>]*dir="ltr"[^>]*>(.*?)<\/span>/);
        if (postMatch) posts.push(postMatch[1]);
      } catch {}
      // Récupère la page jobs
      let jobs = [];
      try {
        const jobsRes = await axios.get(linkedin.replace(/\/company\/([^/]+).*/, '/company/$1/jobs/'), { headers });
        const jobsHtml = jobsRes.data;
        const jobMatches = jobsHtml.match(/<a[^>]*href="[^"]*\/jobs\/view\/[0-9]+[^>]*>(.*?)<\/a>/g);
        if (jobMatches) jobs = jobMatches.map(j => j.replace(/<[^>]+>/g, ''));
      } catch {}
      res.json({ info, posts, jobs });
    } catch (e) {
      res.json({ info: {}, posts: [], jobs: [] });
    }
  });

  // Endpoint pour recherche approfondie site web
  app.post('/api/company-site', async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'Missing domain' });
    try {
      const url = domain.startsWith('http') ? domain : `http://${domain}`;
      const siteRes = await axios.get(url);
      const html = siteRes.data;
      // Extraction simple du <title> et d'un <meta name="description">
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
      const title = titleMatch ? titleMatch[1] : '';
      const description = descMatch ? descMatch[1] : '';
      // Optionnel : extraire le premier <p>
      const pMatch = html.match(/<p>(.*?)<\/p>/i);
      const firstP = pMatch ? pMatch[1] : '';
      res.json({ title, description, firstP });
    } catch (e) {
      res.status(500).json({ error: 'Erreur lors de la récupération du site web.' });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Si le fichier n'existe pas, on le télécharge puis on lance le serveur
if (!fs.existsSync(EMBEDDED_FILE)) {
  console.log(`Downloading ${path.basename(EMBEDDED_FILE)}...`);
  downloadFile(REMOTE_URL, EMBEDDED_FILE, () => {
    console.log('Download complete.');
    startServer();
  });
} else {
  startServer();
}