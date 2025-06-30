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
    console.log('[fetchHunterContacts] Appel pour le domaine:', domain);
    const res = await fetch('/api/hunter-contacts-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
    });
    const data = await res.json();
    if (!Array.isArray(data)) {
        console.warn('[fetchHunterContacts] Données reçues non valides:', data);
    } else if (data.length === 0) {
        console.warn('[fetchHunterContacts] Aucun contact trouvé pour le domaine:', domain);
    } else {
        console.log(`[fetchHunterContacts] ${data.length} contacts trouvés pour le domaine:`, domain);
    }
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
    if (!tbody) {
        console.error('[renderContacts] Élément tbody introuvable dans le DOM.');
        return;
    }
    if (!Array.isArray(contacts)) {
        console.error('[renderContacts] Contacts n\'est pas un tableau:', contacts);
        tbody.innerHTML = '<tr><td colspan="9">Erreur de chargement des contacts.</td></tr>';
        return;
    }
    if (contacts.length === 0) {
        console.warn('[renderContacts] Aucun contact à afficher.');
        tbody.innerHTML = '<tr><td colspan="9">No contacts found.</td></tr>';
        return;
    }
    console.log(`[renderContacts] Affichage de ${contacts.length} contacts.`);
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
                <div style="display:flex;align-items:center;gap:0.5em;">
                    ${ice ? ice : (canGenerate ? `<button class="btn btn-icebreaker" data-idx="${idx}">Generate</button>` : '')}
                    <button class="btn btn-save-lead" data-idx="${idx}" style="background:var(--success);color:#fff;">Save lead</button>
                </div>
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
    // Ajout des listeners sur les boutons Save lead
    document.querySelectorAll('.btn-save-lead').forEach(btn => {
        btn.onclick = function() {
            const idx = parseInt(btn.getAttribute('data-idx'));
            const contact = { ...contacts[idx] };
            // Ajout de l'icebreaker si présent dans la ligne du tableau
            const row = btn.closest('tr');
            const iceCell = row && row.querySelector('.icebreaker-cell');
            if (iceCell && iceCell.textContent && !iceCell.textContent.includes('Generate')) {
                contact.icebreaker = iceCell.textContent.trim();
            }
            let leadsLists = JSON.parse(localStorage.getItem('leadsLists') || '{}');
            const listNames = Object.keys(leadsLists);
            // Création du mini-modal
            let modal = document.createElement('div');
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.25)';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.zIndex = '9999';
            modal.innerHTML = `
                <div style="background:#fff;padding:2em 2em 1.5em 2em;border-radius:14px;min-width:320px;box-shadow:0 4px 32px rgba(0,0,0,0.18);text-align:center;">
                    <div style="font-size:1.15em;font-weight:600;margin-bottom:1.2em;">Save lead</div>
                    <button id="modal-new-list" style="background:#2ecc71;color:#fff;border:none;border-radius:7px;padding:0.6em 1.2em;font-size:1em;margin:0 0.7em 1em 0;cursor:pointer;">New list</button>
                    <button id="modal-add-list" style="background:#1a365d;color:#fff;border:none;border-radius:7px;padding:0.6em 1.2em;font-size:1em;margin:0 0 1em 0;cursor:pointer;">Add to a list</button>
                    <div id="modal-content"></div>
                    <button id="modal-cancel" style="margin-top:1.2em;background:#eee;color:#222;border:none;border-radius:7px;padding:0.5em 1.2em;font-size:1em;cursor:pointer;">Cancel</button>
                </div>
            `;
            document.body.appendChild(modal);
            // Cancel
            modal.querySelector('#modal-cancel').onclick = () => modal.remove();
            // New list
            modal.querySelector('#modal-new-list').onclick = () => {
                const content = modal.querySelector('#modal-content');
                content.innerHTML = `<input id="modal-list-name" type="text" placeholder="List name..." style="width:90%;padding:0.6em 1em;font-size:1em;border-radius:7px;border:1px solid #e2e8f0;"> <button id="modal-create-list" style="background:#2ecc71;color:#fff;border:none;border-radius:7px;padding:0.5em 1.2em;font-size:1em;margin-left:0.5em;cursor:pointer;">Create</button>`;
                content.querySelector('#modal-create-list').onclick = () => {
                    const name = content.querySelector('#modal-list-name').value.trim();
                    if (!name) return alert('Enter a list name');
                    if (!leadsLists[name]) leadsLists[name] = [];
                    if (!leadsLists[name].some(l => l.email === contact.email)) {
                        leadsLists[name].push(contact);
                        localStorage.setItem('leadsLists', JSON.stringify(leadsLists));
                        alert('Lead saved in list ' + name);
                    } else {
                        alert('Ce lead est déjà dans la liste ' + name);
                    }
                    modal.remove();
                };
            };
            // Add to a list
            modal.querySelector('#modal-add-list').onclick = () => {
                const content = modal.querySelector('#modal-content');
                if (listNames.length === 0) {
                    content.innerHTML = '<div style="color:#888;margin-top:1em;">No existing list.</div>';
                    return;
                }
                content.innerHTML = '<div style="margin-bottom:0.7em;">Choose a list:</div>' + listNames.map(n => `<button class="modal-list-btn" data-list="${n}" style="display:block;width:100%;margin:0.3em 0;padding:0.6em 0.7em;background:#f3f7fa;border:none;border-radius:7px;font-size:1em;cursor:pointer;text-align:left;">${n}</button>`).join('');
                content.querySelectorAll('.modal-list-btn').forEach(b => {
                    b.onclick = () => {
                        const list = b.getAttribute('data-list');
                        if (!leadsLists[list].some(l => l.email === contact.email)) {
                            leadsLists[list].push(contact);
                            localStorage.setItem('leadsLists', JSON.stringify(leadsLists));
                            alert('Lead saved in list ' + list);
                        } else {
                            alert('Ce lead est déjà dans la liste ' + list);
                        }
                        modal.remove();
                    };
                });
            };
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

    // Log et test de récupération du client idéal pour debug
    const ideal = await fetchIdealClientForUser();
    if (ideal) {
        console.log('[main] Résultat client idéal (depuis backend):', ideal);
    } else {
        console.warn('[main] Aucun client idéal trouvé pour cet utilisateur.');
    }
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

const btnNews = document.getElementById('deep-search-news-btn');
if (btnNews) btnNews.onclick = deepSearchNews;
const btnLinkedin = document.getElementById('deep-search-linkedin-btn');
if (btnLinkedin) btnLinkedin.onclick = deepSearchLinkedin;
const btnSite = document.getElementById('deep-search-site-btn');
if (btnSite) btnSite.onclick = deepSearchSite;

// Ajout du listener pour le bouton Fiche Score (spécifique à l'entreprise)
document.getElementById('fiche-score-btn').onclick = async function() {
    const domain = getDomainFromUrl();
    const company = await fetchCompanyInfo(domain);
    if (!company) return;
    // On passe le nom de l'entreprise dans l'URL (score.html)
    const params = new URLSearchParams({ company: company['Company Name'] || '' });
    window.location.href = `score.html?${params.toString()}`;
};

// Récupère l'email de l'utilisateur connecté depuis le localStorage
function getUserEmail() {
    // Doit correspondre à la clé utilisée lors du login (voir auth.js)
    return localStorage.getItem('email') || '';
}

// Get the ideal client for the logged-in user from the backend
async function fetchIdealClientForUser(email) {
    const userEmail = email || getUserEmail();
    if (!userEmail) {
        console.log('[fetchIdealClientForUser] Aucun email utilisateur trouvé');
        return null;
    }
    try {
        console.log('[fetchIdealClientForUser] Email utilisé pour la requête:', userEmail);
        const res = await fetch(`/api/client-ideal/${encodeURIComponent(userEmail)}`);
        if (!res.ok) return null;
        const data = await res.json();
        console.log('[fetchIdealClientForUser] Réponse backend:', data);
        return data;
    } catch (e) {
        console.error('[fetchIdealClientForUser] Erreur fetch:', e);
        return null;
    }
}

// Appel automatique de main() au chargement de la page
window.addEventListener('DOMContentLoaded', main);
