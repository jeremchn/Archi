const fs = require('fs');
const path = require('path');
const https = require('https');

// === CONFIGURE ICI TON LIEN DIRECT GOOGLE DRIVE OU DROPBOX ===
const EMBEDDED_FILE = path.join(__dirname, 'data_embedded2_first_20000.json');
// Nouveau lien direct Google Drive
const REMOTE_URL = 'https://drive.google.com/uc?export=download&id=14DSP13Ypv4dHHvBq8R8hH1zRAMoIGCOE';

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
      const apiKey = process.env.NEWSAPI_KEY;
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=fr&sortBy=publishedAt&pageSize=8&apiKey=${apiKey}`;
      const response = await axios.get(url);
      const articles = (response.data.articles || []).map(article => ({
        title: article.title,
        url: article.url,
        date: article.publishedAt,
        description: article.description || '',
        source: article.source && article.source.name ? article.source.name : ''
      }));
      if (articles.length === 0) {
        console.log(`[NewsAPI] Aucun article trouvé pour la requête : ${query}`);
      }
      res.json({ articles });
    } catch (e) {
      if (e.response && e.response.status === 429) {
        console.log('[NewsAPI] Limite d\'API atteinte pour la clé NewsAPI.');
      } else {
        console.log('[NewsAPI] Erreur lors de la récupération des actualités :', e.message);
      }
      res.status(500).json({ error: 'Erreur lors de la récupération des actualités.' });
    }
  });

  // Endpoint pour recherche approfondie LinkedIn
  app.post('/api/company-linkedin', async (req, res) => {
    const { linkedin } = req.body;
    if (!linkedin) return res.status(400).json({ error: 'Missing linkedin url' });
    try {
      const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
      // Accueil
      let info = {};
      try {
        const mainRes = await axios.get(linkedin, { headers });
        const mainHtml = mainRes.data;
        const titleMatch = mainHtml.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) info.name = titleMatch[1];
        const descMatch = mainHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
        if (descMatch) info.description = descMatch[1];
      } catch {}
      // About
      let about = {};
      try {
        const aboutRes = await axios.get(linkedin.replace(/(\/company\/[^/]+).*/, '$1/about/'), { headers });
        const aboutHtml = aboutRes.data;
        const overviewMatch = aboutHtml.match(/<section[^>]*class="about-us__basic-info.*?>([\s\S]*?)<\/section>/);
        if (overviewMatch) about.overview = overviewMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const specialtiesMatch = aboutHtml.match(/Specialties[\s\S]*?<dd[^>]*>(.*?)<\/dd>/);
        if (specialtiesMatch) about.specialties = specialtiesMatch[1].replace(/<[^>]+>/g, '').trim();
      } catch {}
      // Posts
      let posts = [];
      try {
        const postsRes = await axios.get(linkedin.replace(/(\/company\/[^/]+).*/, '$1/posts/?feedView=all'), { headers });
        const postsHtml = postsRes.data;
        const postMatches = [...postsHtml.matchAll(/<span[^>]*dir="ltr"[^>]*>(.*?)<\/span>/g)].map(m => m[1]);
        posts = postMatches.slice(0, 3);
      } catch {}
      // Jobs
      let jobs = [];
      try {
        const jobsRes = await axios.get(linkedin.replace(/(\/company\/[^/]+).*/, '$1/jobs/'), { headers });
        const jobsHtml = jobsRes.data;
        const jobMatches = [...jobsHtml.matchAll(/<a[^>]*href="[^"]*\/jobs\/view\/[0-9]+[^>]*>(.*?)<\/a>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
        jobs = jobMatches.slice(0, 3);
      } catch {}
      // People
      let people = [];
      try {
        const peopleRes = await axios.get(linkedin.replace(/(\/company\/[^/]+).*/, '$1/people/'), { headers });
        const peopleHtml = peopleRes.data;
        const peopleMatches = [...peopleHtml.matchAll(/<span[^>]*class="org-people-profile-card__profile-title[^>]*>(.*?)<\/span>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
        people = peopleMatches.slice(0, 3);
      } catch {}
      res.json({ info, about, posts, jobs, people });
    } catch (e) {
      res.json({ info: {}, about: {}, posts: [], jobs: [], people: [] });
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
      // Extraction du <title>
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : '';
      // Extraction du <meta name="description">
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
      const description = descMatch ? descMatch[1] : '';
      // Extraction du premier <h1>
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
      // Extraction des 3 premiers <h2>
      const h2Matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 3);
      // Extraction des 3 premiers paragraphes significatifs (>50 caractères)
      const pMatches = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(p => p.length > 50).slice(0, 3);
      res.json({ title, description, h1, h2: h2Matches, paragraphs: pMatches });
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