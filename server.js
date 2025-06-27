require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Connexion PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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
  try {
    const profileRes = await pool.query('SELECT data_url FROM profile WHERE email = $1', [email]);
    if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Profil non trouvé.' });
    let dataUrl = profileRes.rows[0].data_url;
    if (typeof dataUrl === 'string') {
      dataUrl = dataUrl.trim();
      if (dataUrl.startsWith('"') && dataUrl.endsWith('"')) {
        dataUrl = dataUrl.slice(1, -1);
      }
    }
    console.log('Tentative de chargement de données depuis:', dataUrl); // LOG
    try {
      const response = await axios.get(dataUrl, { responseType: 'json', timeout: 20000 });
      const data = response.data;
      let count = 0;
      if (Array.isArray(data)) {
        count = data.length;
      } else if (typeof data === 'object' && data !== null) {
        count = Object.keys(data).length;
      }
      res.json({ success: true, count });
    } catch (err) {
      console.error('Erreur lors du téléchargement du fichier:', err.message);
      res.status(502).json({ error: 'Erreur lors du téléchargement du fichier distant.', details: err.message });
    }
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

// Recherche sémantique sur les données de l'entreprise via l'email
app.post('/api/semantic-search', async (req, res) => {
  const { email, query } = req.body;
  if (!email || !query) return res.status(400).json({ error: 'Email et requête requis.' });
  try {
    const profileRes = await pool.query('SELECT data_url FROM profile WHERE email = $1', [email]);
    if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Profil non trouvé.' });
    let dataUrl = profileRes.rows[0].data_url;
    if (typeof dataUrl === 'string') {
      dataUrl = dataUrl.trim();
      if (dataUrl.startsWith('"') && dataUrl.endsWith('"')) {
        dataUrl = dataUrl.slice(1, -1);
      }
    }
    console.log('[semantic-search] data_url:', dataUrl); // DEBUG
    const response = await axios.get(dataUrl, { responseType: 'text' });
    const contentType = response.headers['content-type'];
    const rawData = response.data;
    console.log('[semantic-search] Content-Type:', contentType);
    console.log('[semantic-search] Data length:', rawData.length);
    console.log('[semantic-search] Data start:', rawData.slice(0, 300));
    console.log('[semantic-search] Data end:', rawData.slice(-300));
    if (rawData.trim().startsWith('<')) {
      console.error('[semantic-search] ATTENTION: Le contenu commence par <, probable HTML !');
    }
    let data;
    try {
      data = JSON.parse(rawData);
      console.log('[semantic-search] Type après parsing:', typeof data, '| Array.isArray:', Array.isArray(data));
    } catch (parseErr) {
      console.error('[semantic-search] Erreur de parsing JSON:', parseErr.message, '| data_url utilisé :', dataUrl);
      return res.status(500).json({ error: 'Erreur de parsing JSON', details: parseErr.message, data_url: dataUrl, data_start: rawData.slice(0, 300) });
    }
    if (!Array.isArray(data)) {
      console.error('[semantic-search] Le fichier JSON n\'est pas un tableau. data_url utilisé :', dataUrl);
      return res.status(500).json({ error: 'Le fichier JSON n\'est pas un tableau.', data_url: dataUrl, data_start: rawData.slice(0, 300) });
    }
    const embeddingResponse = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: query, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAIKEY}`, 'Content-Type': 'application/json' } }
    );
    const userEmbedding = embeddingResponse.data.data[0].embedding;
    const scored = data.map(item => {
      if (!Array.isArray(item.embedding)) {
        console.error('[semantic-search] Entreprise sans embedding:', item);
      }
      return { ...item, score: Array.isArray(item.embedding) ? cosineSimilarity(userEmbedding, item.embedding) : 0 };
    });
    scored.sort((a, b) => b.score - a.score);
    const top50 = scored.slice(0, 50).map(({ embedding, ...rest }) => rest);
    res.json(top50);
  } catch (e) {
    // Correction ReferenceError: dataUrl is not defined
    let dataUrlSafe = typeof dataUrl !== 'undefined' ? dataUrl : null;
    console.error('Erreur recherche sémantique:', e, '| data_url utilisé :', dataUrlSafe);
    res.status(500).json({ error: 'Erreur recherche sémantique.', details: e.message, data_url: dataUrlSafe });
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
  if (!linkedin_url) return res.status(400).json({ error: 'Missing linkedin_url' });
  const PROXYCURL_API_KEY = process.env.PROXYCURL_API_KEY;
  try {
    console.log('[Proxycurl] Requesting:', linkedin_url);
    const proxycurlRes = await axios.get('https://nubela.co/proxycurl/api/v2/linkedin', {
      params: { url: linkedin_url },
      headers: { 'Authorization': `Bearer ${PROXYCURL_API_KEY}` }
    });
    console.log('[Proxycurl] Response:', JSON.stringify(proxycurlRes.data, null, 2));
    res.json(proxycurlRes.data);
  } catch (e) {
    console.error('[Proxycurl] Error:', e.response ? e.response.data : e.message);
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
      'https://nubela.co/proxycurl/api/v2/linkedin',
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
      console.warn('[Proxycurl] Réponse sans graphe social:', JSON.stringify(data));
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
    console.error('Erreur Proxycurl:', e.response ? e.response.data : e.message);
    res.status(502).json({ error: 'Erreur lors de la récupération Proxycurl', details: e.message });
  }
});

// Sert index.html à la racine
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});