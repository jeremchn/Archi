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
    // À adapter selon votre logique d'authentification
    return localStorage.getItem('user_email') || '';
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

function computeScore(company, ideal) {
    if (!ideal) return [0, 0, 0, 0];
    let paysScore = 0;
    if (company['Location'] === ideal.pays_1) paysScore = 1;
    else if (company['Location'] === ideal.pays_2) paysScore = 0.5;
    const headcountScore = company['Headcount'] === ideal.headcount ? 1 : 0;
    const industryScore = company['Industry'] === ideal.industry ? 1 : 0;
    const typeScore = company['Company Type'] === ideal.company_type ? 1 : 0;
    return [paysScore, headcountScore, industryScore, typeScore];
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

function renderRadarChart(scores) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Pays', 'Headcount', 'Industry', 'Company Type'],
            datasets: [{
                label: 'Score de correspondance',
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

window.onload = function() {
    const { company } = getQueryParams();
    const companyData = getCompanyDataFromLocal(company);
    const ideal = getIdealClientForUser();
    renderCompanyInfo(companyData);
    const scores = computeScore(companyData, ideal);
    renderRadarChart(scores);
};
