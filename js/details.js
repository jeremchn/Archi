// Récupère le domaine depuis l'URL
function getDomainFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('domain');
}

async function fetchCompanyInfo(domain) {
    // Récupère les résultats stockés dans le localStorage
    const results = JSON.parse(localStorage.getItem('searchResults') || '[]');
    // Cherche l'entreprise exacte par domaine
    return results.find(item => item['Domain'] === domain) || null;
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

async function renderContacts(contacts, icebreakers = null, linkedinInfos = null) {
    const tbody = document.querySelector('#contacts-table tbody');
    if (contacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No contacts found.</td></tr>';
        return;
    }
    tbody.innerHTML = contacts.map((c, idx) => {
        const canGenerate = c.email && c.first_name && c.last_name && c.position && c.company && c.linkedin_url;
        const ice = icebreakers && icebreakers[idx] ? icebreakers[idx] : '';
        const linkedinInfo = linkedinInfos && linkedinInfos[idx] ? linkedinInfos[idx] : '';
        return `
        <tr>
            <td>${c.email || ''}</td>
            <td>${c.first_name || ''}</td>
            <td>${c.last_name || ''}</td>
            <td>${c.position || ''}</td>
            <td>${c.company || ''}</td>
            <td>${c.linkedin_url ? `<a href="${c.linkedin_url}" class="clickable-link" target="_blank">LinkedIn</a>` : ''}</td>
            <td class="linkedin-info-cell">${linkedinInfo}</td>
            <td class="icebreaker-cell">
                ${ice ? ice : (canGenerate ? `<button class="btn btn-icebreaker" data-idx="${idx}">Generate</button>` : '')}
            </td>
        </tr>
        `;
    }).join('');
    // Ajout des listeners sur les boutons Generate
    document.querySelectorAll('.btn-icebreaker').forEach(btn => {
        btn.onclick = async function() {
            const idx = parseInt(btn.getAttribute('data-idx'));
            const contact = contacts[idx];
            btn.disabled = true;
            btn.textContent = 'Generating...';
            try {
                // Génère l'ice breaker et récupère les infos LinkedIn via Proxycurl
                const res = await fetch('/api/icebreaker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contact })
                });
                const data = await res.json();
                // Formate les infos pour affichage
                let infoText = '';
                if (data.linkedinData) {
                    if (data.linkedinData.headline) infoText += `<b>Headline:</b> ${data.linkedinData.headline}<br>`;
                    if (data.linkedinData.summary) infoText += `<b>Summary:</b> ${data.linkedinData.summary}<br>`;
                    if (data.linkedinData.experiences && data.linkedinData.experiences.length) infoText += `<b>Experiences:</b> ${data.linkedinData.experiences.map(e => `${e.title} at ${e.company}`).join('; ')}<br>`;
                    if (data.linkedinData.education && data.linkedinData.education.length) infoText += `<b>Education:</b> ${data.linkedinData.education.map(e => `${e.degree_name || ''} at ${e.school}`.trim()).join('; ')}<br>`;
                    if (data.linkedinData.languages_and_proficiencies && data.linkedinData.languages_and_proficiencies.length) infoText += `<b>Languages:</b> ${data.linkedinData.languages_and_proficiencies.map(l => `${l.language} (${l.proficiency})`).join('; ')}<br>`;
                    if (data.linkedinData.accomplishment_organisations && data.linkedinData.accomplishment_organisations.length) infoText += `<b>Organisations:</b> ${data.linkedinData.accomplishment_organisations.map(o => o.name).join('; ')}<br>`;
                    if (data.linkedinData.accomplishment_publications && data.linkedinData.accomplishment_publications.length) infoText += `<b>Publications:</b> ${data.linkedinData.accomplishment_publications.map(p => p.name).join('; ')}<br>`;
                    if (data.linkedinData.accomplishment_honors_awards && data.linkedinData.accomplishment_honors_awards.length) infoText += `<b>Honors & Awards:</b> ${data.linkedinData.accomplishment_honors_awards.map(a => a.title).join('; ')}<br>`;
                    if (data.linkedinData.activities && data.linkedinData.activities.length) infoText += `<b>Activities:</b> ${data.linkedinData.activities.map(a => a.activity).join(' | ')}<br>`;
                    if (data.linkedinData.articles && data.linkedinData.articles.length) infoText += `<b>Articles:</b> ${data.linkedinData.articles.map(a => a.title).join('; ')}<br>`;
                    if (data.linkedinData.personal_emails && data.linkedinData.personal_emails.length) infoText += `<b>Personal Emails:</b> ${data.linkedinData.personal_emails.join('; ')}<br>`;
                    if (data.linkedinData.personal_numbers && data.linkedinData.personal_numbers.length) infoText += `<b>Personal Numbers:</b> ${data.linkedinData.personal_numbers.join('; ')}<br>`;
                }
                // Met à jour la cellule LinkedIn Info et Ice Breaker sans re-render tout le tableau
                const row = btn.closest('tr');
                row.querySelector('.linkedin-info-cell').innerHTML = infoText;
                if (data.success) {
                    btn.parentElement.innerHTML = data.icebreaker;
                } else {
                    btn.textContent = 'Error';
                }
            } catch {
                btn.textContent = 'Error';
            }
        };
    });
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
    // Ajoute le nom de l'entreprise à chaque contact pour la colonne Company
    const companyName = company['Company Name'] || '';
    contacts.forEach(c => { c.company = companyName; });
    window._contacts = contacts; // Pour accès global
    await renderContacts(contacts);
}

// Gestion des trois boutons de recherche approfondie
const loadingDeepSearch = document.getElementById('loading-deep-search');
const domain = getDomainFromUrl();

async function showLoading(state) {
    loadingDeepSearch.style.display = state ? 'block' : 'none';
}

async function deepSearchNews() {
    showLoading(true);
    const company = await fetchCompanyInfo(domain);
    if (!company) {
        alert('Impossible de trouver les infos de l\'entreprise.');
        showLoading(false);
        return;
    }
    try {
        // Appel à la nouvelle route backend NewsAPI
        const res = await fetch('/api/news-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: company['Company Name'] || company['Domain'] })
        });
        const data = await res.json();
        if (!data.success) throw new Error('Aucune actualité trouvée.');
        localStorage.setItem('deepCompanyProfile', JSON.stringify({ company, news: data.articles, mode: 'news' }));
        window.location.href = 'fiche.html';
    } catch (e) {
        alert('Erreur lors de la recherche News.');
    } finally {
        showLoading(false);
    }
}

async function deepSearchLinkedin() {
    showLoading(true);
    const company = await fetchCompanyInfo(domain);
    if (!company || !company['Linkedin']) {
        alert('Impossible de trouver le LinkedIn de l\'entreprise.');
        showLoading(false);
        return;
    }
    try {
        const res = await fetch('/api/company-linkedin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkedin: company['Linkedin'] })
        });
        const data = await res.json();
        localStorage.setItem('deepCompanyProfile', JSON.stringify({ company, linkedin: data, mode: 'linkedin' }));
        window.location.href = 'fiche.html';
    } catch (e) {
        alert('Erreur lors de la recherche LinkedIn.');
    } finally {
        showLoading(false);
    }
}

async function deepSearchSite() {
    showLoading(true);
    const company = await fetchCompanyInfo(domain);
    if (!company || !company['Domain']) {
        alert('Impossible de trouver le site web de l\'entreprise.');
        showLoading(false);
        return;
    }
    try {
        const res = await fetch('/api/company-site', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: company['Domain'] })
        });
        const data = await res.json();
        localStorage.setItem('deepCompanyProfile', JSON.stringify({ company, site: data, mode: 'site' }));
        window.location.href = 'fiche.html';
    } catch (e) {
        alert('Erreur lors de la recherche Site Web.');
    } finally {
        showLoading(false);
    }
}

document.getElementById('deep-search-news-btn').onclick = deepSearchNews;
document.getElementById('deep-search-linkedin-btn').onclick = deepSearchLinkedin;
document.getElementById('deep-search-site-btn').onclick = deepSearchSite;

main();
