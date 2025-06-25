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

function renderLinkedinInfo(info) {
    if (!info) return '';
    let html = `<div class="linkedin-profile-card" style="background:#f8fafc;padding:1em;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:1em;">
            ${info.profile_pic_url ? `<img src="${info.profile_pic_url}" alt="Profile picture" style="width:56px;height:56px;border-radius:50%;border:2px solid #eee;">` : ''}
            <div>
                <div style="font-size:1.1em;font-weight:700;">${info.full_name || ''}</div>
                <div style="color:#555;">${info.headline || info.occupation || ''}</div>
                <div style="color:#888;font-size:0.98em;">${info.country_full_name || info.country || ''}${info.city ? ', ' + info.city : ''}</div>
            </div>
        </div>`;
    if (info.follower_count || info.connections) {
        html += `<div style="margin-top:0.7em;"><strong>Followers:</strong> ${info.follower_count || info.connections}</div>`;
    }
    if (info.experiences) {
        const exps = Array.isArray(info.experiences) ? info.experiences : [info.experiences];
        html += `<div style="margin-top:0.7em;"><strong>Experiences:</strong><ul style="margin:0.5em 0 0 1em;padding:0;">` +
            exps.filter(Boolean).map(exp => `
                <li style="margin-bottom:0.3em;">
                    <div><strong>${exp.title || ''}</strong> at ${exp.company_linkedin_profile_url ? `<a href="${exp.company_linkedin_profile_url}" target="_blank">${exp.company}</a>` : exp.company || ''}</div>
                    <div style="color:#888;font-size:0.95em;">
                        ${exp.location ? exp.location + ' - ' : ''}${exp.starts_at ? `From ${exp.starts_at.month}/${exp.starts_at.year}` : ''}
                        ${exp.ends_at ? ` to ${exp.ends_at.month}/${exp.ends_at.year}` : ' (Current)'}
                    </div>
                </li>`).join('') + `</ul></div>`;
    }
    if (info.people_also_viewed && Array.isArray(info.people_also_viewed) && info.people_also_viewed.length) {
        html += `<div style="margin-top:0.7em;"><strong>People also viewed:</strong><ul style="margin:0.5em 0 0 1em;padding:0;">` +
            info.people_also_viewed.map(p => `
                <li><a href="${p.link}" target="_blank">${p.name}</a>${p.summary ? `<span style="color:#888;font-size:0.95em;"> - ${p.summary}</span>` : ''}</li>`).join('') + `</ul></div>`;
    }
    html += '</div>';
    return html;
}

async function renderContacts(contacts, icebreakers = null) {
    const tbody = document.querySelector('#contacts-table tbody');
    if (contacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">No contacts found.</td></tr>';
        return;
    }
    tbody.innerHTML = contacts.map((c, idx) => {
        const canGenerate = c.email && c.first_name && c.last_name && c.position && c.company && c.linkedin_url;
        const ice = icebreakers && icebreakers[idx] ? icebreakers[idx] : '';
        return `
        <tr>
            <td>${c.email || ''}</td>
            <td>${c.first_name || ''}</td>
            <td>${c.last_name || ''}</td>
            <td>${c.position || ''}</td>
            <td>${c.company || ''}</td>
            <td>${c.linkedin_url ? `<a href="${c.linkedin_url}" class="clickable-link" target="_blank">LinkedIn</a>` : ''}</td>
            <td class="linkedin-info-cell"></td>
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
                let infoText = '';
                if (contact.linkedin_url) {
                    const res = await fetch('/api/contact-linkedin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ linkedin_url: contact.linkedin_url })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        infoText = renderLinkedinInfo(data);
                    } else {
                        infoText = '<span style="color:#aaa">Aucune info LinkedIn disponible</span>';
                    }
                }
                // Met à jour la cellule LinkedIn Info sans re-render tout le tableau
                const row = btn.closest('tr');
                row.querySelector('.linkedin-info-cell').innerHTML = infoText;
                // Génère l'ice breaker (optionnel, tu peux garder ou retirer cette partie)
                const iceRes = await fetch('/api/icebreaker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contact })
                });
                const iceData = await iceRes.json();
                if (iceData.success) {
                    btn.parentElement.innerHTML = iceData.icebreaker;
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

// Ajout du listener pour le bouton Fiche Score (spécifique à l'entreprise)
document.getElementById('fiche-score-btn').onclick = async function() {
    const domain = getDomainFromUrl();
    const company = await fetchCompanyInfo(domain);
    if (!company) return;
    // On passe le nom de l'entreprise dans l'URL (score.html)
    const params = new URLSearchParams({ company: company['Company Name'] || '' });
    window.location.href = `score.html?${params.toString()}`;
};

// Get the ideal client for the logged-in user from the backend
async function fetchIdealClientForUser(email) {
    if (!email) return null;
    try {
        const res = await fetch(`/api/client-ideal/${encodeURIComponent(email)}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
