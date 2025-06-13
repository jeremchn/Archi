// Récupère le domaine depuis l'URL
function getDomainFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('domain');
}

async function fetchCompanyInfo(domain) {
    // Appel au backend pour récupérer toutes les infos de l'entreprise
    const res = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: domain })
    });
    const data = await res.json();
    // Cherche l'entreprise exacte par domaine
    return Array.isArray(data) ? data.find(item => item['Domain'] === domain) : null;
}

async function fetchHunterContacts(domain) {
    // Appel direct à l'API Hunter via le backend pour récupérer les contacts détaillés
    const res = await fetch('/api/hunter-contacts-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
    });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

async function main() {
    const domain = getDomainFromUrl();
    if (!domain) {
        document.body.innerHTML = "<p>Domaine non spécifié.</p>";
        return;
    }

    // Affiche les infos de l'entreprise
    const company = await fetchCompanyInfo(domain);
    if (!company) {
        document.getElementById('company-name').textContent = "Entreprise non trouvée";
        return;
    }
    document.getElementById('company-name').textContent = company['Company Name'] || '';
    document.getElementById('company-info').innerHTML = `
        <strong>Domaine :</strong> <a href="http://${company['Domain']}" class="clickable-link" target="_blank">${company['Domain']}</a><br>
        <strong>LinkedIn :</strong> ${company['Linkedin'] ? `<a href="${company['Linkedin']}" class="clickable-link" target="_blank">LinkedIn</a>` : ''}<br>
        <strong>Industry :</strong> ${company['Industry'] || ''}<br>
        <strong>Location :</strong> ${company['Location'] || ''}<br>
        <strong>Headcount :</strong> ${company['Headcount'] || ''}<br>
        <strong>Description :</strong> ${company['Description'] || ''}<br>
        <strong>Company Type :</strong> ${company['Company Type'] || ''}<br>
    `;

    // Affiche les contacts Hunter
    const contacts = await fetchHunterContacts(domain);
    const tbody = document.querySelector('#contacts-table tbody');
    if (contacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Aucun contact trouvé.</td></tr>';
    } else {
        tbody.innerHTML = contacts.map(c => `
            <tr>
                <td>${c.email || ''}</td>
                <td>${c.first_name || ''}</td>
                <td>${c.last_name || ''}</td>
                <td>${c.position || ''}</td>
                <td>${c.linkedin_url ? `<a href="${c.linkedin_url}" class="clickable-link" target="_blank">LinkedIn</a>` : ''}</td>
            </tr>
        `).join('');
    }
}

// Ajout de la fonctionnalité de recherche approfondie
const deepSearchBtn = document.getElementById('deep-search-btn');
const loadingDeepSearch = document.getElementById('loading-deep-search');

deepSearchBtn.addEventListener('click', async function() {
    deepSearchBtn.disabled = true;
    loadingDeepSearch.style.display = 'block';
    const domain = getDomainFromUrl();
    const company = await fetchCompanyInfo(domain);
    if (!company) {
        alert('Impossible de trouver les infos de l\'entreprise.');
        deepSearchBtn.disabled = false;
        loadingDeepSearch.style.display = 'none';
        return;
    }
    // Appel API backend pour recherche approfondie (OpenAI)
    try {
        const response = await fetch('/api/deep-company-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain: company['Domain'],
                linkedin: company['Linkedin'],
                name: company['Company Name'],
                description: company['Description']
            })
        });
        if (!response.ok) throw new Error('Erreur serveur');
        const data = await response.json();
        // Redirige vers la page de fiche détaillée avec les infos reçues (stockées dans localStorage)
        localStorage.setItem('deepCompanyProfile', JSON.stringify(data));
        window.location.href = 'fiche.html';
    } catch (e) {
        alert('Erreur lors de la recherche approfondie.');
    } finally {
        deepSearchBtn.disabled = false;
        loadingDeepSearch.style.display = 'none';
    }
});

main();
