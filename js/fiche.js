// Script pour afficher le radar chart de score de correspondance

// Critères du client idéal (à adapter si besoin)
const IDEAL_CLIENT = {
    pays_1: 'United States',
    pays_2: 'France',
    headcount: '50-100',
    industry: 'Manufacturing',
    company_type: 'privé',
};

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        company: params.get('company') || '',
    };
}

function getCompanyDataFromLocal(companyName) {
    const results = JSON.parse(localStorage.getItem('searchResults') || '[]');
    return results.find(item => item['Company Name'] === companyName) || {};
}

// Récupère l'adresse mail de connexion depuis le localStorage (ou autre méthode d'auth)
function getUserEmail() {
    // Correction : utiliser la même clé que le login ('email')
    return localStorage.getItem('email') || '';
}

// Récupère la table client_ideal depuis le même endroit que users/profile (ex: localStorage['client_ideal'] ou API)
function getIdealClientForUser() {
    const userEmail = getUserEmail();
    // On suppose que la table est stockée dans localStorage['client_ideal'] ou localStorage['users']
    let idealClients = [];
    if (localStorage.getItem('client_ideal')) {
        idealClients = JSON.parse(localStorage.getItem('client_ideal'));
    } else if (localStorage.getItem('users')) {
        // Si stocké dans users, on cherche une propriété client_ideal
        const users = JSON.parse(localStorage.getItem('users'));
        if (Array.isArray(users)) {
            for (const user of users) {
                if (user.client_ideal) {
                    idealClients = user.client_ideal;
                    break;
                }
            }
        }
    }
    return idealClients.find(row => (row['adresse_mail'] || '').toLowerCase() === userEmail.toLowerCase()) || null;
}

// Fetch the ideal client row for the logged-in user from the backend
async function fetchIdealClientForUser() {
    const userEmail = getUserEmail();
    if (!userEmail) return null;
    try {
        const response = await fetch(`/api/client-ideal/${encodeURIComponent(userEmail)}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error('Error fetching ideal client:', e);
        return null;
    }
}

function normalize(str) {
    return (str || '').toString().trim().toLowerCase();
}

function includesNormalized(haystack, needle) {
    return normalize(haystack).includes(normalize(needle));
}

function renderCompanyInfo(company) {
    document.getElementById('contact-info').innerHTML = `
        <strong>Entreprise :</strong> ${company['Company Name'] || ''}<br>
        <strong>Domaine :</strong> ${company['Domain'] || ''}<br>
        <strong>LinkedIn :</strong> ${company['Linkedin'] ? `<a href="${company['Linkedin']}" target="_blank">Profil</a>` : ''}<br>
        <strong>Pays :</strong> ${company['Location'] || ''}<br>
        <strong>Headcount :</strong> ${company['Headcount'] || ''}<br>
        <strong>Industry :</strong> ${company['Industry'] || ''}<br>
        <strong>Type :</strong> ${company['Company Type'] || ''}<br>
    `;
}

let radarChartInstance = null;

function renderRadarChart(scores) {
    const canvas = document.getElementById('radarChart');
    if (!canvas) {
        console.error('[RadarChart] Canvas #radarChart introuvable dans le DOM.');
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!Array.isArray(scores) || scores.length !== 5 || scores.some(s => typeof s !== 'number' || isNaN(s))) {
        console.error('[RadarChart] Scores invalides pour le radar chart:', scores);
        return;
    }
    // Détruit l'ancien graphique si présent
    if (radarChartInstance) {
        radarChartInstance.destroy();
    }
    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Location', 'Headcount', 'Industry', 'Company Type', 'Description'],
            datasets: [{
                label: 'Match Score',
                data: scores,
                backgroundColor: 'rgba(46,204,113,0.2)',
                borderColor: '#2ecc71',
                pointBackgroundColor: '#1a365d',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#2ecc71',
            }]
        },
        options: {
            scale: {
                min: 0,
                max: 1,
                ticks: {
                    stepSize: 0.5,
                    display: true
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Ajoute le score RAG (description) à partir de l'API semantic-search
async function fetchRagScore(companyData, userEmail) {
    if (!companyData || !companyData['Company Name'] || !userEmail) return 0;
    try {
        // On utilise le champ Description comme requête pour le RAG
        const query = companyData['Description'] || companyData['Company Name'];
        const response = await fetch('/api/semantic-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, query })
        });
        if (!response.ok) return 0;
        const results = await response.json();
        // On prend le score du premier résultat (le plus pertinent)
        if (Array.isArray(results) && results.length > 0 && typeof results[0].score === 'number') {
            // Clamp entre 0 et 1
            return Math.max(0, Math.min(1, results[0].score));
        }
        return 0;
    } catch (e) {
        console.error('Erreur fetchRagScore:', e);
        return 0;
    }
}

// Modifie computeScore pour accepter un 5e score (description)
function computeScore(company, ideal, ragScore = 0) {
    if (!ideal) {
        alert('Aucun client idéal trouvé pour votre email.');
        console.log('Aucun client idéal trouvé', {company, ideal});
        return [0, 0, 0, 0, ragScore];
    }
    // Debug : affiche les valeurs comparées
    console.log('Comparaison:', {
        company,
        ideal,
        location: company['Location'],
        pays_1: ideal.pays_1,
        pays_2: ideal.pays_2,
        headcount: company['Headcount'],
        ideal_headcount: ideal.headcount,
        industry: company['Industry'],
        ideal_industry: ideal.industry,
        type: company['Company Type'],
        ideal_type: ideal.company_type
    });
    let paysScore = 0;
    if (includesNormalized(company['Location'], ideal.pays_1)) paysScore = 1;
    else if (includesNormalized(company['Location'], ideal.pays_2)) paysScore = 0.5;
    const headcountScore = normalize(company['Headcount']) === normalize(ideal.headcount) ? 1 : 0;
    // Score industry : 1 si le mot de l'idéal est contenu dans l'industrie de l'entreprise (insensible à la casse)
    const industryIdeal = (ideal.industry || '').toLowerCase();
    const industryCompany = (company['Industry'] || '').toLowerCase();
    const industryScore = industryCompany.includes(industryIdeal) && industryIdeal ? 1 : 0;
    const typeScore = normalize(company['Company Type']) === normalize(ideal.company_type) ? 1 : 0;
    // Affiche le résultat final
    console.log('Résultat score:', [paysScore, headcountScore, industryScore, typeScore, ragScore]);
    return [paysScore, headcountScore, industryScore, typeScore, ragScore];
}

// Récupère le score RAG stocké dans searchResults (si présent)
function getRagScoreFromLocal(companyName) {
    const results = JSON.parse(localStorage.getItem('searchResults') || '[]');
    const found = results.find(item => item['Company Name'] === companyName);
    if (found) {
        if (typeof found.ragScore === 'number') return found.ragScore;
        if (typeof found.score === 'number') return found.score;
    }
    return 0;
}

window.onload = async function() {
    const { company } = getQueryParams();
    const companyData = getCompanyDataFromLocal(company);
    renderCompanyInfo(companyData);
    const ideal = await fetchIdealClientForUser();
    // Utilise le score RAG stocké localement (plus rapide)
    const ragScore = getRagScoreFromLocal(company);
    const scores = computeScore(companyData, ideal, ragScore);
    console.log('[RadarChart] Données envoyées au radar chart:', scores);
    renderRadarChart(scores);
};
