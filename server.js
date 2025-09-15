require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const csvParse = require('csv-parse/sync');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});


// Sert les fichiers statiques (frontend, js, etc.)
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// Authentification simple (email/password)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Tentative de connexion:', { email, password }); // LOG
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    console.log('Résultat SQL:', result.rows); // LOG
    if (result.rows.length === 0) return res.status(401).json({ error: 'Identifiants invalides.' });
    res.json({ success: true, email });
  } catch (e) {
    console.error('Erreur SQL:', e); // LOG
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Récupérer le profil de l'entreprise via l'email
app.get('/api/profile/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const result = await pool.query('SELECT * FROM profile WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profil non trouvé.' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Charger dynamiquement les données de l'entreprise via l'email
app.get('/api/load-data/:email', async (req, res) => {
  const { email } = req.params;
  let dataUrls = [];
  try {
    const profileRes = await pool.query('SELECT data_url FROM profile WHERE email = $1', [email]);
    if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Profil non trouvé.' });
    let dataUrl = profileRes.rows[0].data_url;
    if (typeof dataUrl === 'string') {
      dataUrl = dataUrl.trim();
      if (dataUrl.startsWith('"') && dataUrl.endsWith('"')) {
        dataUrl = dataUrl.slice(1, -1);
      }
      dataUrls = dataUrl.split(/[,;\s]+/).map(u => u.trim()).filter(Boolean);
    } else if (Array.isArray(dataUrl)) {
      dataUrls = dataUrl;
    }
    if (!dataUrls.length) return res.status(400).json({ error: 'Aucun lien data_url valide.' });
    let allData = [];
    for (const url of dataUrls) {
      try {
        const response = await axios.get(url, { responseType: 'json', timeout: 20000 });
        const data = response.data;
        if (Array.isArray(data)) {
          allData = allData.concat(data);
        } else if (typeof data === 'object' && data !== null) {
          allData.push(data);
        }
      } catch (err) {
        console.error('Erreur lors du téléchargement du fichier:', err.message, '| data_url utilisé :', url);
      }
    }
    let count = allData.length;
    res.json({ success: true, count });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors du chargement des données.' });
  }
});

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

// Recherche sémantique sur les données de l'entreprise via l'email (utilise le cache)
app.post('/api/semantic-search', async (req, res) => {
  const { email, query } = req.body;
  if (!email || !query) return res.status(400).json({ error: 'Email et requête requis.' });
  const cache = userDataCache[email];
  if (!cache || !cache.full) {
    console.log(`[CACHE][PROMPT] Aucune donnée trouvée pour ${email}`);
    return res.status(400).json({ error: 'Données non chargées pour cet utilisateur. Cliquez sur Load Data.' });
  }
  const allData = cache.full;
  console.log(`[CACHE][PROMPT] Utilisation du cache pour ${email} : ${allData.length} entreprises`);
  try {
    // Embedding et scoring comme avant
    const embeddingResponse = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: query, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAIKEY}`, 'Content-Type': 'application/json' } }
    );
    const userEmbedding = embeddingResponse.data.data[0].embedding;
    const scored = allData.map(item => {
      if (!Array.isArray(item.embedding)) {
        console.error('[semantic-search] Entreprise sans embedding:', item);
      }
      return { ...item, score: Array.isArray(item.embedding) ? cosineSimilarity(userEmbedding, item.embedding) : 0 };
    });
    scored.sort((a, b) => b.score - a.score);
    const top50 = scored.slice(0, 50).map(({ embedding, ...rest }) => rest);
    res.json(top50);
  } catch (e) {
    console.error(`[PROMPT][ERROR] ${email} - Erreur recherche sémantique:`, e.message);
    res.status(500).json({ error: 'Erreur recherche sémantique.', details: e.message });
  }
});

// Endpoint pour récupérer le nombre de contacts Hunter pour chaque domaine
app.post('/api/hunter-contacts', async (req, res) => {
  const { companies } = req.body;
  if (!companies || !Array.isArray(companies)) {
    return res.status(400).json({ error: 'Missing companies array' });
  }
  const HUNTER_API_KEY = process.env.HUNTERKEY;
  const results = await Promise.all(companies.map(async (domain) => {
    try {
      const response = await axios.get(
        `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}&limit=30`
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
  const HUNTER_API_KEY = process.env.HUNTERKEY;
  try {
    const response = await axios.get(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}&limit=30`
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

// Endpoint pour recherche approfondie OpenAI (profil entreprise)
app.post('/api/deep-company-profile', async (req, res) => {
  const { domain, linkedin, name, description } = req.body;
  if (!domain && !linkedin) {
    return res.status(400).json({ error: 'Missing domain or linkedin' });
  }
  try {
    let contacts = [];
    try {
      const hunterRes = await axios.post(`http://localhost:${PORT}/api/hunter-contacts-details`, { domain });
      contacts = Array.isArray(hunterRes.data) ? hunterRes.data : [];
    } catch (e) { contacts = []; }
    const prompt = `Tu es un assistant expert en veille stratégique. Voici le site web: ${domain ? 'http://' + domain : ''}\nLinkedIn: ${linkedin || ''}\nNom: ${name || ''}\nDescription: ${description || ''}\n\nDonne-moi les informations suivantes, chaque section doit être concise et adaptée à la rubrique :\n1. Actualités importantes (levées de fonds, nouveaux directeurs, nouveaux produits, événements majeurs, etc.)\n2. Positionnement & points forts de l'entreprise\n3. Événements majeurs récents\n4. Nouveaux produits/services\n5. Changements de direction\nPour chaque section, réponds uniquement par une liste ou un paragraphe adapté, sans introduction ni conclusion. Utilise le format JSON suivant :\n{\n  "news": [ ... ],\n  "position": "...",\n  "events": [ ... ],\n  "products": [ ... ],\n  "leadership": [ ... ]\n}`;
    let gpt_sections = {};
    let gpt_analysis = '';
    try {
      const gptRes = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: "Tu es un assistant expert en analyse d'entreprise." },
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
      const match = gptRes.data.choices[0].message.content.match(/\{[\s\S]*\}/);
      if (match) {
        gpt_sections = JSON.parse(match[0]);
      }
      gpt_analysis = gptRes.data.choices[0].message.content;
    } catch (e) { gpt_analysis = "Impossible d'obtenir une analyse approfondie."; }
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
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
    let info = {};
    try {
      const mainRes = await axios.get(linkedin, { headers });
      const mainHtml = mainRes.data;
      const titleMatch = mainHtml.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) info.name = titleMatch[1];
      const descMatch = mainHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
      if (descMatch) info.description = descMatch[1];
    } catch {}
    let about = {};
    try {
      const aboutRes = await axios.get(linkedin.replace(/(\/company\/[^/]+).*/, '$1/about/'), { headers });
      const aboutHtml = aboutRes.data;
      const overviewMatch = aboutHtml.match(/<section[^>]*class="about-us__basic-info.*?>([\s\S]*?)<\/section>/);
      if (overviewMatch) about.overview = overviewMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const specialtiesMatch = aboutHtml.match(/Specialties[\s\S]*?<dd[^>]*>(.*?)<\/dd>/);
      if (specialtiesMatch) about.specialties = specialtiesMatch[1].replace(/<[^>]+>/g, '').trim();
    } catch {}
    let posts = [];
    try {
      const postsRes = await axios.get(linkedin.replace(/(\/company\/[^/]+).*/, '$1/posts/?feedView=all'), { headers });
      const postsHtml = postsRes.data;
      const postMatches = [...postsHtml.matchAll(/<span[^>]*dir="ltr"[^>]*>(.*?)<\/span>/g)].map(m => m[1]);
      posts = postMatches.slice(0, 3);
    } catch {}
    let jobs = [];
    try {
      const jobsRes = await axios.get(linkedin.replace(/(\/company\/[^/]+).*/, '$1/jobs/'), { headers });
      const jobsHtml = jobsRes.data;
      const jobMatches = [...jobsHtml.matchAll(/<a[^>]*href="[^"]*\/jobs\/view\/[0-9]+[^>]*>(.*?)<\/a>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
      jobs = jobMatches.slice(0, 3);
    } catch {}
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
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '';
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const description = descMatch ? descMatch[1] : '';
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
    const h2Matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 3);
    const pMatches = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(p => p.length > 50).slice(0, 3);
    res.json({ title, description, h1, h2: h2Matches, paragraphs: pMatches });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la récupération du site web.' });
  }
});

// Recherche d'actualités sur une entreprise via NewsAPI
app.post('/api/news-search', async (req, res) => {
  const { company, domain } = req.body;
  if (!company && !domain) return res.status(400).json({ error: 'Nom de l\'entreprise ou domaine requis.' });
  const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
  const queries = [
    company ? `"${company}"` : '',
    company || '',
    domain ? `"${domain}"` : '',
    domain || '',
    company ? `${company} actualité` : '',
    company ? `${company} news` : '',
    company ? `${company} press release` : '',
    company ? `${company} manufacturing` : '',
  ].filter(Boolean);
  let articles = [];
  for (const q of queries) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=5&apiKey=${NEWSAPI_KEY}`;
      console.log('Recherche NewsAPI:', url); // LOG
      const response = await axios.get(url);
      if (response.data.articles && response.data.articles.length > 0) {
        articles = articles.concat(response.data.articles.map(a => ({
          title: a.title,
          url: a.url,
          source: a.source.name,
          publishedAt: a.publishedAt,
          description: a.description
        })));
      }
    } catch (e) {
      console.error('Erreur NewsAPI:', e.response ? e.response.data : e.message); // LOG
    }
  }
  // Supprime les doublons d'articles (par url)
  articles = articles.filter((a, i, arr) => arr.findIndex(b => b.url === a.url) === i);
  // Filtrage supplémentaire : ne garder que les articles qui mentionnent le nom ou le domaine dans le titre ou la description
  const lowerCompany = company ? company.toLowerCase() : '';
  const lowerDomain = domain ? domain.toLowerCase() : '';
  articles = articles.filter(a => {
    const t = (a.title || '').toLowerCase();
    const d = (a.description || '').toLowerCase();
    return (lowerCompany && (t.includes(lowerCompany) || d.includes(lowerCompany))) ||
           (lowerDomain && (t.includes(lowerDomain) || d.includes(lowerDomain)));
  });
  if (articles.length === 0) {
    return res.json({ success: false, articles: [] });
  }
  // Limite à 5 articles les plus récents
  articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json({ success: true, articles: articles.slice(0, 5) });
});

// Génération d'ice breakers personnalisés pour chaque contact via OpenAI GPT-4-turbo
app.post('/api/icebreakers', async (req, res) => {
  const { contacts } = req.body;
  if (!contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: 'Contacts array required' });
  }
  const OPENAI_KEY = process.env.OPENAIKEY;
  const results = [];
  for (const contact of contacts) {
    let prompt = `You are a B2B networking expert. Generate a personalized ice breaker sentence to start an email to this professional contact.\nHere is the contact's information:\n`;
    prompt += `- First name: ${contact.first_name || ''}\n`;
    prompt += `- Last name: ${contact.last_name || ''}\n`;
    prompt += `- Company: ${contact.company || ''}\n`;
    prompt += `- Position: ${contact.position || ''}\n`;
    if (contact.linkedin_url) {
      prompt += `- LinkedIn profile: ${contact.linkedin_url}\n`;
      prompt += `If possible, base the ice breaker on the most relevant and recent public LinkedIn posts to make it truly personalized.\n`;
    }
    prompt += `The sentence should be adapted to the person, highlight something they can be proud of or a recent achievement, and make them want to reply.\nUse the real company name and avoid generic formulas.\nOnly return the ice breaker sentence, no introduction or explanation.`;
    try {
      const gptRes = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo',
          messages: [
            { role: 'system', content: 'You are a B2B networking expert.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 120,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const icebreaker = gptRes.data.choices[0].message.content.trim();
      results.push(icebreaker);
    } catch (e) {
      results.push(''); // In case of error, no ice breaker
    }
  }
  res.json({ success: true, icebreakers: results });
});

// Endpoint pour récupérer les infos d'un profil LinkedIn de contact via Proxycurl
app.post('/api/contact-linkedin', async (req, res) => {
  const { linkedin_url } = req.body;
  console.log('[contact-linkedin] Requête reçue:', req.body);
  const PROXYCURL_API_KEY = process.env.PROXYCURL_API_KEY;
  if (!linkedin_url) {
    console.warn('[contact-linkedin] linkedin_url manquant');
    return res.status(400).json({ error: 'Missing linkedin_url' });
  }
  if (!PROXYCURL_API_KEY) {
    console.error('[contact-linkedin] PROXYCURL_API_KEY manquant');
    return res.status(500).json({ error: 'API key missing' });
  }
  try {
    console.log('[contact-linkedin] Appel EnrichLayer (profile):', {
      url: 'https://enrichlayer.com/api/v2/profile',
      params: { url: linkedin_url },
      headers: { Authorization: `Bearer ${PROXYCURL_API_KEY}` }
    });
    const enrichRes = await axios.get('https://enrichlayer.com/api/v2/profile', {
      params: { url: linkedin_url },
      headers: { 'Authorization': `Bearer ${PROXYCURL_API_KEY}` }
    });
    console.log('[contact-linkedin] Statut réponse:', enrichRes.status);
    console.log('[contact-linkedin] Données réponse:', JSON.stringify(enrichRes.data, null, 2));
    if (!enrichRes.data || Object.keys(enrichRes.data).length === 0) {
      console.warn('[contact-linkedin] Réponse vide ou incomplète:', enrichRes.data);
    }
    res.json(enrichRes.data);
  } catch (e) {
    if (e.response) {
      console.error('[contact-linkedin] Erreur API:', {
        status: e.response.status,
        data: e.response.data
      });
    } else {
      console.error('[contact-linkedin] Erreur générale:', e.message);
    }
    res.json({});
  }
});

// Modifie la génération d'ice breaker pour utiliser toutes les infos Proxycurl du profil
app.post('/api/icebreaker', async (req, res) => {
  const { contact } = req.body;
  if (!contact || !contact.email || !contact.first_name || !contact.last_name || !contact.position || !contact.company || !contact.linkedin_url) {
    return res.status(400).json({ error: 'All fields required (email, first_name, last_name, position, company, linkedin_url)' });
  }
  const OPENAI_KEY = process.env.OPENAIKEY;
  // Récupère les infos LinkedIn via Proxycurl
  let linkedinData = {};
  try {
    const scrapeRes = await axios.post('http://localhost:' + PORT + '/api/contact-linkedin', { linkedin_url: contact.linkedin_url });
    linkedinData = scrapeRes.data;
  } catch {}
  // Nouveau prompt ultra-ciblé, factuel, sans flatterie, basé sur LinkedIn
  let prompt = `Your task is to write a 1-3 sentence icebreaker that introduces a conversation naturally, based strictly on public information found on the person's LinkedIn profile, without using flattery or superlatives.\n\n` +
    `🔍 Context:\n- Use specific information such as current role, industry, recent post, shared article, published content, job transitions, certifications, project topics, or company focus.\n- Focus on relevance and shared curiosity — not compliments.\n- Mention the fact you *noticed* or *saw* something that triggered your interest.\n- Do **not** use words like *impressive*, *amazing*, *great*, or *incredible*.\n\n` +
    `📌 Output format:\nStart with: "I noticed on your profile that..."\nThen continue with a factual, relevant observation and one short, thoughtful reflection or question.\n\n` +
    `✅ Examples:\n- "I noticed on your profile that you're currently focused on logistics optimization at [Company]. I've been looking into how AI is being applied in that field — do you see growing demand for automation from your clients?"\n- "I saw you recently transitioned from [Industry A] to [Industry B]. Curious what drove that shift — was it a tech trend or something company-specific?"\n- "I noticed you shared an article on the regulatory impact of the new EU AI Act. Are you seeing a lot of internal alignment work around compliance at [Company]?"\n\nGenerate only the icebreaker. Keep it neutral, concise, and based on factual LinkedIn insights.\n\nHere is the full LinkedIn profile data (JSON):\n${JSON.stringify(linkedinData, null, 2)}\n`;
  try {
    const gptRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are a B2B networking expert.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 120,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const icebreaker = gptRes.data.choices[0].message.content.trim();
    res.json({ success: true, icebreaker, linkedinData });
  } catch (e) {
    res.json({ success: false, icebreaker: '', linkedinData });
  }
});

// Endpoint pour récupérer le graphe social LinkedIn via Proxycurl
app.post('/api/proxycurl-social-graph', async (req, res) => {
  const { linkedin_url } = req.body;
  if (!linkedin_url) {
    return res.status(400).json({ error: 'Missing linkedin_url' });
  }
  const PROXYCURL_API_KEY = process.env.PROXYCURL_API_KEY;
  if (!PROXYCURL_API_KEY) {
    return res.status(500).json({ error: 'Proxycurl API key not configured.' });
  }
  try {
    const response = await axios.get(
      'https://enrichlayer.com/api/v2/profile',
      {
        params: {
          url: linkedin_url,
          enrich_profile: 'enrich',
        },
        headers: {
          'Authorization': `Bearer ${PROXYCURL_API_KEY}`,
          'Accept': 'application/json',
        },
        timeout: 20000
      }
    );
    const data = response.data;
    // Log pour debug si la réponse ne contient pas les champs attendus
    if (!data.posts && !data.comments && !data.connections && !data.close_contacts) {
      console.warn('[EnrichLayer] Réponse sans graphe social:', JSON.stringify(data));
    }
    const socialGraph = {
      posts: data.posts || [],
      comments: data.comments || [],
      connections: data.connections || data.close_contacts || [],
      groups: data.groups || [],
      articles: data.articles || [],
      recommendations: data.recommendations || [],
      activities: data.activities || [],
    };
    res.json(socialGraph);
  } catch (e) {
    console.error('Erreur EnrichLayer:', e.response ? e.response.data : e.message);
    res.status(502).json({ error: 'Erreur lors de la récupération EnrichLayer', details: e.message });
  }
});

// === CACHE EN MEMOIRE DES DONNEES UTILISATEUR ===
const userDataCache = {};

// Endpoint pour charger les données dans le cache de session (manuel, version full+light)
app.post('/api/load-session-data', async (req, res) => {
  const { email } = req.body;
  console.log('[API][load-session-data] Reçu pour', email);
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  try {
    const profileRes = await pool.query('SELECT data_url FROM profile WHERE email = $1', [email]);
    let dataUrls = [];
    if (profileRes.rows.length > 0) {
      let dataUrl = profileRes.rows[0].data_url;
      if (typeof dataUrl === 'string') {
        dataUrl = dataUrl.trim();
        if (dataUrl.startsWith('"') && dataUrl.endsWith('"')) {
          dataUrl = dataUrl.slice(1, -1);
        }
        dataUrls = dataUrl.split(/[,;\s]+/).map(u => u.trim()).filter(Boolean);
      } else if (Array.isArray(dataUrl)) {
        dataUrls = dataUrl;
      }
    }
    console.log('[API][load-session-data] dataUrls:', dataUrls);
    let allData = [];
    for (const url of dataUrls) {
      try {
        console.log('[API][load-session-data] Téléchargement:', url);
        const response = await axios.get(url, { responseType: 'json', timeout: 20000 });
        let data = response.data;
        if (Array.isArray(data)) {
          allData = allData.concat(data);
        } else if (typeof data === 'object' && data !== null) {
          allData.push(data);
        }
        console.log(`[API][load-session-data] Fichier chargé (${url}) : ${Array.isArray(data) ? data.length : 1} entrées`);
      } catch (err) {
        console.error('[API][load-session-data] Erreur téléchargement:', err.message, '| data_url utilisé :', url);
      }
    }
    userDataCache[email] = {
      full: allData,
      light: allData.map(e => {
        const { embedding, ...rest } = e;
        return rest;
      })
    };
    console.log(`[CACHE] Données chargées pour ${email} : full=${userDataCache[email].full.length}, light=${userDataCache[email].light.length}`);
    res.json({ success: true, count: allData.length });
  } catch (e) {
    console.error('[API][load-session-data] Erreur générale:', e.message);
    res.status(500).json({ error: 'Erreur lors du chargement des données.' });
  }
});

// Endpoint de logout pour vider le cache utilisateur
app.post('/api/logout', (req, res) => {
  const { email } = req.body;
  if (email && userDataCache[email]) {
    delete userDataCache[email];
    console.log(`[CACHE] Cache vidé pour ${email}`);
  }
  res.json({ success: true });
});

// Sert index.html à la racine
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Sert aussi index2.html à la racine
app.get('/index2.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index2.html'));
});

// Sert aussi index3.html à la racine
app.get('/index3.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index3.html'));
});

// Redirige la racine vers la page de login (auth.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.html'));
});

// Sert details.html à la racine
app.get('/details.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'details.html'));
});

// Sert fiche.html à la racine
app.get('/fiche.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'fiche.html'));
});

// Sert score.html à la racine
app.get('/score.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'score.html'));
});

// Sert saved.html à la racine
app.get('/saved.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'saved.html'));
});

// Sert welcome.html à la racine
app.get('/welcome.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'welcome.html'));
});

// Sert auth.html à la racine
app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.html'));
});

// Sert contacts.html à la racine
app.get('/contacts.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'contacts.html'));
});

// Endpoint to fetch the ideal client row for a user by email (case-insensitive, trimmed)
app.get('/api/client-ideal/:email', async (req, res) => {
  const { email } = req.params;
  console.log('Received request for client_ideal with email:', email, '| type:', typeof email, '| length:', email.length); // DEBUG
  try {
    const result = await pool.query('SELECT * FROM client_ideal WHERE TRIM(LOWER(email)) = TRIM(LOWER($1))', [email]);
    console.log('Query result for email:', result.rows, '| Query param:', email, '| type:', typeof email, '| length:', email.length); // DEBUG
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ideal client not found.' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error('Error fetching ideal client:', e); // LOG
    res.status(500).json({ error: 'Server error fetching ideal client.' });
  }
});

// Endpoint pour récupérer les valeurs uniques de filtres (industry, location, headcount) pour l'utilisateur
app.get('/api/filters', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  let dataUrls = [];
  try {
    const profileRes = await pool.query('SELECT data_url FROM profile WHERE email = $1', [email]);
    if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Profil non trouvé.' });
    let dataUrl = profileRes.rows[0].data_url;
    if (typeof dataUrl === 'string') {
      dataUrl = dataUrl.trim();
      if (dataUrl.startsWith('"') && dataUrl.endsWith('"')) {
        dataUrl = dataUrl.slice(1, -1);
      }
      dataUrls = dataUrl.split(/[,;\s]+/).map(u => u.trim()).filter(Boolean);
    } else if (Array.isArray(dataUrl)) {
      dataUrls = dataUrl;
    }
    if (!dataUrls.length) return res.status(400).json({ error: 'Aucun lien data_url valide.' });
    let allData = [];
    for (const url of dataUrls) {
      try {
        const response = await axios.get(url, { responseType: 'json', timeout: 20000 });
        const data = response.data;
        if (Array.isArray(data)) {
          allData = allData.concat(data);
        } else if (typeof data === 'object' && data !== null) {
          allData.push(data);
        }
      } catch (err) {
        console.error('Erreur lors du téléchargement du fichier:', err.message, '| data_url utilisé :', url);
      }
    }
    if (!allData.length) return res.status(500).json({ error: 'Aucune donnée exploitable dans les fichiers JSON.' });
    const industries = [...new Set(allData.map(e => e.Industry).filter(Boolean))].sort();
    const locations = [...new Set(allData.map(e => e.Location).filter(Boolean))].sort();
    const headcounts = [...new Set(allData.map(e => e.Headcount).filter(Boolean))].sort();
    res.json({ industries, locations, headcounts });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la récupération des filtres.' });
  }
});

// Endpoint pour recherche par filtres (utilise le cache)
app.post('/api/filter-search', async (req, res) => {
  const { email, industries, locations, headcounts, partialMatch, intersection } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  const cache = userDataCache[email];
  if (!cache || !cache.light) {
    console.log(`[CACHE][FILTER] Aucune donnée trouvée pour ${email}`);
    return res.status(400).json({ error: 'Données non chargées pour cet utilisateur. Cliquez sur Load Data.' });
  }
  const allData = cache.light;
  console.log(`[CACHE][FILTER] Utilisation du cache pour ${email} : ${allData.length} entreprises`);
  try {
    function matchAny(val, arr) {
      if (!arr || !arr.length) return true;
      if (!val) return false;
      if (partialMatch) {
        return arr.some(f => val.toLowerCase().includes(f.toLowerCase()));
      } else {
        return arr.includes(val);
      }
    }
    let data = allData.filter(e => {
      const checks = [];
      if (industries && industries.length) checks.push(matchAny(e.Industry, industries));
      if (locations && locations.length) checks.push(matchAny(e.Location, locations));
      if (headcounts && headcounts.length) checks.push(matchAny(e.Headcount, headcounts));
      if (intersection) {
        return checks.every(Boolean);
      } else {
        return checks.length === 0 || checks.some(Boolean);
      }
    });
    data = data.slice(0, 50);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la recherche filtrée.' });
  }
});

// Endpoint pour recherche par nom de société (fuzzy, utilise le cache)
app.post('/api/company-name-search', async (req, res) => {
  const { email, name, domain } = req.body;
  console.log('[API][company-name-search] email reçu:', email, '| clés cache:', Object.keys(userDataCache));
  if (!email || (!name && !domain)) return res.status(400).json({ error: 'Email and at least one search field required.' });
  const cache = userDataCache[email];
  if (!cache || !cache.light) {
    console.log(`[CACHE][NAME] Aucune donnée trouvée pour ${email}`);
    return res.status(400).json({ error: 'Données non chargées pour cet utilisateur. Cliquez sur Load Data.' });
  }
  const allData = cache.light;
  console.log(`[CACHE][NAME] Utilisation du cache pour ${email} : ${allData.length} entreprises`);
  try {
    let data = allData;
    const searchName = name ? name.trim().toLowerCase() : null;
    const searchDomain = domain ? domain.trim().toLowerCase() : null;
    data = data.filter(e => {
      const companyName = e['Company Name'] ? e['Company Name'].toLowerCase() : '';
      const companyDomain = e['Domain'] ? e['Domain'].toLowerCase() : '';
      let match = false;
      if (searchName && companyName.includes(searchName)) match = true;
      if (searchDomain && companyDomain.includes(searchDomain)) match = true;
      return match;
    });
    // If no result, try Levenshtein <= 2 on both fields
    if (data.length === 0 && (searchName || searchDomain)) {
      function levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[b.length][a.length];
      }
      data = allData.filter(e => {
        const companyName = e['Company Name'] ? e['Company Name'].toLowerCase() : '';
        const companyDomain = e['Domain'] ? e['Domain'].toLowerCase() : '';
        let match = false;
        if (searchName && companyName && levenshtein(companyName, searchName) <= 2) match = true;
        if (searchDomain && companyDomain && levenshtein(companyDomain, searchDomain) <= 2) match = true;
        return match;
      });
    }
    data = data.slice(0, 50);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error during company/domain search.' });
  }
});

// Endpoint pour le chatbot sales (OpenAI)

// Endpoint pour le chatbot commercial (inchangé)
app.post('/api/sales-chatbot', async (req, res) => {
  const { messages, profile } = req.body;
  console.log('[sales-chatbot] Request received:', { messages, profile }); // LOG
  if (!Array.isArray(messages)) {
    console.warn('[sales-chatbot] Missing messages');
    return res.status(400).json({ error: 'Messages required.' });
  }
  let context = '';
  context = `Company Profile:\n`;
  context += `Sector: ${profile?.secteur || '-'}\n`;
  context += `Business Model: ${profile?.businessModel || '-'}\n`;
  context += `Team Size: ${profile?.tailleEquipe || '-'}\n`;
  context += `Target Markets: ${profile?.marchesCibles || '-'}\n`;
  context += `Sales Cycle: ${profile?.cycleVente || '-'}\n`;
  context += `Tools: ${profile?.outilsUtilises || '-'}\n`;
  context += `12-Month Objectives: ${profile?.objectifs12mois || '-'}\n`;
  context += `Estimated Annual Revenue: ${profile?.caAnnuel || '-'}\n`;
  context += `Dream Clients: ${(profile?.dreamClient1||'') + (profile?.dreamClient2?', '+profile?.dreamClient2:'') + (profile?.dreamClient3?', '+profile?.dreamClient3:'')}\n`;
  context += `Unique Value Proposition: ${profile?.uvp || '-'}\n`;
  context += `Free Field: ${profile?.champsLibre || '-'}\n`;
  const systemPrompt = `You are a B2B sales assistant. Use the following context to provide useful, concrete, and actionable sales advice. Be concise, relevant, and give advice tailored to the profile.\n${context}`;

  // Sanitize message roles
  const validRoles = ['system', 'assistant', 'user', 'function', 'tool', 'developer'];
  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: validRoles.includes(m.role) ? m.role : (m.role === 'ai' ? 'assistant' : 'user'),
      content: m.content
    }))
  ];
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: openaiMessages,
        max_tokens: 350,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAIKEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const aiMsg = response.data.choices[0].message.content;
    res.json({ answer: aiMsg });
  } catch (e) {
    res.status(500).json({ error: 'AI response error.', details: e.response?.data || e.message });
  }
});

// Nouveau endpoint pour le chatbot juridique avec RAG
app.post('/api/legal-chatbot', async (req, res) => {

  const { messages, email } = req.body;
  console.log('[legal-chatbot] Request received:', { messages, email });
  if (!Array.isArray(messages) || !email) {
    return res.status(400).json({ error: 'Messages et email requis.' });
  }
  // Prompt CEO/Conseil stratégique
  let systemPrompt = "Tu es un conseiller stratégique de haut niveau, expert en business, management, innovation et leadership. Tu t'adresses à un CEO ou dirigeant d'entreprise. Tes réponses sont concrètes, synthétiques, orientées action et décision, et couvrent tous les aspects utiles à un dirigeant (stratégie, organisation, opportunités, risques, management, croissance, innovation, gouvernance, etc). Tu peux t'appuyer sur le contexte fourni, les documents importés et l'expérience métier. Utilise un ton direct, professionnel, inspirant et factuel. Si la question sort du domaine business, indique-le poliment.";
  let context = "Contexte : Ce chatbot est destiné à conseiller des dirigeants et CEO sur tous les sujets business, stratégie, organisation, innovation, management, etc.";
  // Ajoute les résumés courts de tous les documents importés pour cet utilisateur
  if (global.profileRagStore && global.profileRagStore[email] && global.profileRagStore[email].length > 0) {
    const shortSummaries = global.profileRagStore[email]
      .map(f => f.shortSummary)
      .filter(s => s && s.trim().length > 0);
    if (shortSummaries.length > 0) {
      context += "\n\nRésumé(s) synthétique(s) des documents importés :\n" + shortSummaries.map((s, i) => `Doc ${i+1}: ${s}`).join('\n');
    }
  }

  // Sélection intelligente des chunks RAG les plus pertinents
  let ragChunks = [];
  if (global.profileRagChunks && global.profileRagChunks[email] && global.profileRagChunks[email].length > 0) {
    // Récupère la dernière question utilisateur
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    let question = lastUserMsg ? lastUserMsg.content : '';
    // Embedding de la question
    let questionEmbedding = null;
    try {
      const embeddingRes = await axios.post(
        'https://api.openai.com/v1/embeddings',
        { input: question, model: 'text-embedding-3-small' },
        { headers: { 'Authorization': `Bearer ${process.env.OPENAIKEY}`, 'Content-Type': 'application/json' } }
      );
      questionEmbedding = embeddingRes.data.data[0].embedding;
    } catch (e) {
      console.error('[legal-chatbot][embedding] Erreur embedding question:', e.message);
    }
    // Calcule la similarité pour chaque chunk
    let scoredChunks = global.profileRagChunks[email].map(c => {
      let score = 0;
      if (questionEmbedding && Array.isArray(c.embedding)) {
        score = cosineSimilarity(questionEmbedding, c.embedding);
      }
      return { chunk: c.chunk, score };
    });
    // Trie par score décroissant et prend les 10 meilleurs
    const topChunks = scoredChunks.sort((a, b) => b.score - a.score).slice(0, 10);
    ragChunks = topChunks.map(c => c.chunk);
    // Log les 10 chunks sélectionnés
    console.log('[legal-chatbot][RAG] Top 10 chunks sélectionnés :');
    topChunks.forEach((c, i) => {
      console.log(`Chunk ${i+1} (score ${c.score.toFixed(4)}): ${c.chunk.substring(0, 200).replace(/\n/g, ' ')}...`);
    });
    context += "\n\nExtraits les plus pertinents du document importé :\n" + ragChunks.map((c, i) => `Chunk ${i+1}: ${c}`).join('\n');
  } else {
    context += "\n\nAucun document importé n'a été trouvé pour cet utilisateur.";
  }

  // Sanitize message roles
  const validRoles = ['system', 'assistant', 'user', 'function', 'tool', 'developer'];
  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: context },
    ...messages.map(m => ({
      role: validRoles.includes(m.role) ? m.role : (m.role === 'ai' ? 'assistant' : 'user'),
      content: m.content
    }))
  ];
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: openaiMessages,
        max_tokens: 500,
        temperature: 0.5
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAIKEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const aiMsg = response.data.choices[0].message.content;
    res.json({ answer: aiMsg });
  } catch (e) {
    res.status(500).json({ error: 'AI response error.', details: e.response?.data || e.message });
  }
});

// === UPLOAD DE FICHIERS POUR LE PROFIL ENTREPRISE ===
const upload = multer({ dest: path.join(__dirname, 'uploads') });

app.post('/api/upload', upload.array('files'), (req, res) => {
  if (!req.files) return res.status(400).json({ error: 'Aucun fichier reçu.' });
  const fileInfos = req.files.map(f => ({ filename: f.filename, originalname: f.originalname, mimetype: f.mimetype }));
  res.json({ success: true, files: fileInfos });
});

// === RAG DENSE : CHUNKING + EMBEDDINGS ===
const CHUNK_SIZE = 500; // caractères par chunk (ajuster si besoin)
const RAG_TOP_K = 5; // nombre de chunks à injecter dans le prompt

// Helper : découpe un texte en chunks de taille fixe
function chunkText(text, size = CHUNK_SIZE) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = i + size;
    // Essaie de couper à la fin d'une phrase si possible
    let nextDot = text.lastIndexOf('.', end);
    if (nextDot > i + size * 0.5) end = nextDot + 1;
    chunks.push(text.slice(i, end).trim());
    i = end;
  }
  return chunks.filter(c => c.length > 30); // ignore les tout petits
}

// Helper : génère les embeddings OpenAI pour une liste de textes
async function getEmbeddingsForChunks(chunks) {
  const apiKey = process.env.OPENAIKEY;
  const model = 'text-embedding-3-small';
  // OpenAI accepte jusqu'à 2048 inputs par requête, on batch par 50 pour éviter les limites
  const batchSize = 50;
  let allEmbeddings = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const resp = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: batch, model },
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    allEmbeddings = allEmbeddings.concat(resp.data.data.map(d => d.embedding));
  }
  return allEmbeddings;
}

// Helper: découpe un texte en chunks (overlap possible, ignore les vides)
// Nouveau chunking : découpe par structure logique (titres, paragraphes), avec overlap
function chunkText(text, chunkSize = 500, overlap = 100) {
  // Découpe d'abord en paragraphes (double saut de ligne ou \n\n)
  let rawParagraphs = text.split(/\n\s*\n|\r\n\s*\r\n/).map(p => p.trim()).filter(Boolean);
  // Si trop peu de paragraphes, fallback découpe simple
  if (rawParagraphs.length < 2) {
    rawParagraphs = text.split(/\n|\r\n/).map(p => p.trim()).filter(Boolean);
  }
  // Regroupe les paragraphes en chunks de taille cible, avec overlap
  const chunks = [];
  let i = 0;
  while (i < rawParagraphs.length) {
    let chunk = '';
    let j = i;
    while (j < rawParagraphs.length && chunk.length < chunkSize) {
      chunk += (chunk ? '\n' : '') + rawParagraphs[j];
      j++;
    }
    if (chunk.length > 30) chunks.push(chunk);
    // Overlap : recule de quelques paragraphes pour le prochain chunk
    i += Math.max(1, j - i - Math.floor(overlap / 100));
  }
  return chunks;
}

// Helper: génère les embeddings OpenAI pour une liste de textes (ignore les vides)
async function getEmbeddings(texts) {
  const apiKey = process.env.OPENAIKEY;
  const filtered = texts.filter(t => t && t.trim().length > 0);
  if (filtered.length === 0) return [];
  const response = await axios.post(
    'https://api.openai.com/v1/embeddings',
    { input: filtered, model: 'text-embedding-3-small' },
    { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
  );
  return response.data.data.map(d => d.embedding);
}

// Helper: calcule la similarité cosinus
function cosineSimilarity(a, b) {
  let dot = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper: extraction texte selon type
async function extractTextFromFile(filePath, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text;
  } else if (mimetype.includes('word') || filePath.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } else if (mimetype.includes('csv') || filePath.endsWith('.csv')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const records = csvParse.parse(content, { columns: false });
    return records.flat().join(' ');
  } else if (mimetype.startsWith('text/') || filePath.endsWith('.txt')) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

// Nouveau endpoint upload RAG: découpe, embedding, stockage chunks+embeddings
app.post('/api/upload-profile-files', upload.array('files'), async (req, res) => {
  const email = req.body.email;
  if (!req.files || !email) return res.status(400).json({ error: 'Fichiers et email requis.' });
  if (!global.profileRagStore[email]) global.profileRagStore[email] = [];
  if (!global.profileRagChunks[email]) global.profileRagChunks[email] = [];
  const uploadedFiles = [];
  for (const f of req.files) {
    let text = '';
    try {
      text = await extractTextFromFile(f.path, f.mimetype);
    } catch (e) { text = ''; }

    // Génère un résumé long (3-5 phrases)
    let summary = '';
    // Génère un résumé court (1 phrase)
    let shortSummary = '';
    try {
      const gptRes = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a legal and business assistant. Summarize the following document in 3-5 sentences, focusing on the main topics, legal points, and practical information. Be concise and clear.' },
            { role: 'user', content: text.slice(0, 6000) }
          ],
          max_tokens: 500,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAIKEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      summary = gptRes.data.choices[0].message.content.trim();
    } catch (e) {
      summary = '';
    }
    try {
      const gptShort = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a legal and business assistant. Summarize the following document in one single, clear, and concise sentence.' },
            { role: 'user', content: text.slice(0, 6000) }
          ],
          max_tokens: 80,
          temperature: 0.2
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAIKEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      shortSummary = gptShort.data.choices[0].message.content.trim();
    } catch (e) {
      shortSummary = '';
    }

    global.profileRagStore[email].push({
      filename: f.filename,
      originalname: f.originalname,
      mimetype: f.mimetype,
      text: text || '',
      summary,
      shortSummary
    });
    // Découpe en chunks
    const chunks = chunkText(text);
    // Embeddings pour chaque chunk (ignore les vides)
    let embeddings = [];
    try {
      embeddings = await getEmbeddings(chunks);
    } catch (e) { embeddings = chunks.map(() => []); }
    // Stocke chaque chunk+embedding+filename
    let idx = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i] && chunks[i].trim().length > 0 && Array.isArray(embeddings[idx])) {
        global.profileRagChunks[email].push({
          chunk: chunks[i],
          embedding: embeddings[idx],
          filename: f.originalname
        });
        idx++;
      }
    }
    uploadedFiles.push(f.originalname);
  }
  res.json({ success: true, uploadedFiles });
});

// === INIT RAG GLOBALS (toujours, même sur Render) ===
// Endpoint Ice Breaker: reçoit une liste de contacts, génère un ice breaker pour chaque, renvoie la liste enrichie
app.post('/api/icebreaker', async (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts) || !contacts.length) {
    return res.status(400).json({ error: 'Aucun contact fourni.' });
  }
  // Génération simple : crée un icebreaker pour chaque contact
  const enriched = contacts.map(c => {
    let icebreaker = '';
    if (c.first_name && c.company) {
      icebreaker = `Bonjour ${c.first_name}, ravi de voir votre parcours chez ${c.company}${c.position ? ' en tant que ' + c.position : ''}!`;
    } else if (c.last_name && c.company) {
      icebreaker = `Bonjour ${c.last_name}, votre expérience chez ${c.company} est inspirante.`;
    } else {
      icebreaker = `Bonjour, ravi de découvrir votre profil!`;
    }
    return {
      email: c.email || '',
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      position: c.position || '',
      company: c.company || '',
      linkedin_url: c.linkedin_url || '',
      icebreaker
    };
  });
  res.json({ contacts: enriched });
});
if (!global.profileRagStore) global.profileRagStore = {};
if (!global.profileRagChunks) global.profileRagChunks = {};

// Sert aussi chatbot.html à la racine
app.get('/icebreaker.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'icebreaker.html'));
});
app.get('/chatbot.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'chatbot.html'));
});

app.get('/chatbot_only.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'chatbot_only.html'));
});
app.get('/profil_only.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'profil_only.html'));
});
app.get('/import_docs_only.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'import_docs_only.html'));
});

// Endpoint pour récupérer la liste des documents importés pour RAG
app.get('/api/get-imported-docs', (req, res) => {
  const email = req.query.email;
  if (!email || !global.profileRagStore[email]) {
    return res.json({ files: [] });
  }
  // Retourne nom et résumé pour chaque doc
  const files = global.profileRagStore[email].map(f => ({
    name: f.originalname,
    summary: f.summary || '',
    shortSummary: f.shortSummary || ''
  }));
  res.json({ files });
});

// Endpoint to delete a specific imported document for a user
app.post('/api/delete-imported-doc', (req, res) => {
  const { email, filename } = req.body;
  if (!email || !filename || !global.profileRagStore[email]) {
    return res.status(400).json({ success: false, error: 'Missing email or filename.' });
  }
  // Remove from memory
  global.profileRagStore[email] = global.profileRagStore[email].filter(f => f.originalname !== filename);
  global.profileRagChunks[email] = (global.profileRagChunks[email] || []).filter(c => c.filename !== filename);
  // Remove file from uploads folder
  try {
    const fileObj = global.profileRagStore[email].find(f => f.originalname === filename);
    if (fileObj && fileObj.filename) {
      const filePath = path.join(__dirname, 'uploads', fileObj.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch {}
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});