document.getElementById('searchBtn').addEventListener('click', async function() {
    const query = document.getElementById('search').value;
    if (!query) return alert("Please enter your need in the search bar.");
    if (!email) return alert("Veuillez vous connecter.");

    const loadingBtn = document.getElementById('loadingBtn');
    loadingBtn.style.display = 'inline-block';
    loadingBtn.innerHTML = '<span class="loader"></span> Recherche...';

    try {
        // Appel au backend pour la recherche sémantique
        const response = await fetch('/api/semantic-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, query })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            showMsg("Erreur serveur: " + (err.error || response.statusText), 'error');
            loadingBtn.style.display = 'none';
            loadingBtn.innerHTML = 'Rechercher';
            return;
        }
        let data = await response.json();

        // Vérifie si la réponse est bien un tableau
        if (!Array.isArray(data)) {
            showMsg(data.error || "Erreur côté serveur.", 'error');
            console.error(data);
            loadingBtn.style.display = 'none';
            loadingBtn.innerHTML = 'Rechercher';
            return;
        }

        // Récupère le nombre réel de contacts pour chaque entreprise via /api/hunter-contacts-details
        for (let i = 0; i < data.length; i++) {
            const domain = data[i]['Domain'];
            if (domain) {
                try {
                    const res = await fetch('/api/hunter-contacts-details', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ domain })
                    });
                    const contactsArr = await res.json();
                    data[i].contacts = Array.isArray(contactsArr) ? contactsArr.length : 0;
                } catch (e) {
                    data[i].contacts = 0;
                }
            } else {
                data[i].contacts = 0;
            }
        }
        // Trie les résultats par nombre de contacts décroissant (valeurs vides/nulles = 0)
        data.sort((a, b) => {
            const contactsA = (typeof a.contacts === 'number' && !isNaN(a.contacts)) ? a.contacts : 0;
            const contactsB = (typeof b.contacts === 'number' && !isNaN(b.contacts)) ? b.contacts : 0;
            return contactsB - contactsA;
        });
        // Stocke les résultats dans le localStorage pour accès depuis details.html
        localStorage.setItem('searchResults', JSON.stringify(data));
        // Affiche les résultats dans le tableau
        renderResultsTable(data);
        showMsg('Recherche terminée avec succès.', 'success');
        loadingBtn.style.display = 'none';
        loadingBtn.innerHTML = 'Rechercher';
    } finally {
        loadingBtn.style.display = 'none';
    }
});

document.getElementById('resetBtn').addEventListener('click', function() {
    document.getElementById('search').value = '';
    document.getElementById('results').innerHTML = '';
});

const loadDataBtn = document.getElementById('loadDataBtn');
const searchBtn = document.getElementById('searchBtn');
const resetBtn = document.getElementById('resetBtn');
const dataStatus = document.getElementById('dataStatus');

// Affichage du logo et du nom d'entreprise sur la page index.html
window.addEventListener('DOMContentLoaded', async () => {
    // Le header est toujours 'Lydi search' pour toutes les entreprises
    let headerTitle = document.getElementById('dynamic-title');
    if (headerTitle) headerTitle.textContent = 'Lydi search';

    const email = localStorage.getItem('email');
    if (!email) return;
    try {
        const res = await fetch(`/api/profile/${email}`);
        if (!res.ok) return;
        const profile = await res.json();
        // Affiche le header et le footer uniquement si l'utilisateur est "alruqee"
        const isAlruqee = (profile.company_name && profile.company_name.toLowerCase().includes('alruqee')) ||
            (email && email.toLowerCase().includes('alruqee'));
        let header = document.querySelector('header');
        let footer = document.querySelector('footer');
        if (isAlruqee) {
            // Logo
            let logo = header.querySelector('.company-logo');
            if (!logo) {
                logo = document.createElement('img');
                logo.className = 'company-logo';
                logo.style.height = '38px';
                logo.style.width = '38px';
                logo.style.verticalAlign = 'middle';
                header.querySelector('div').prepend(logo);
            }
            logo.src = profile.logo_url;
            // Nom
            let name = header.querySelector('.company-title');
            if (!name) {
                name = document.createElement('span');
                name.className = 'company-title';
                name.style.fontSize = '1.5em';
                name.style.fontWeight = '700';
                name.style.color = 'var(--primary)';
                name.style.letterSpacing = '1px';
                header.querySelector('div').appendChild(name);
            }
            name.textContent = profile.company_name;
            if (footer) {
                footer.innerHTML = `&copy; 2025 ${profile.company_name}. All rights reserved.`;
            }
        } else {
            // Si ce n'est pas alruqee, masquer le nom/logo Alruqee
            if (header) {
                let logo = header.querySelector('.company-logo');
                if (logo) logo.remove();
                let name = header.querySelector('.company-title');
                if (name) name.remove();
            }
            if (footer) {
                footer.innerHTML = '&copy; 2025. All rights reserved.';
            }
        }
        // Bloc principal (pour fallback)
        let logo = document.getElementById('company-logo');
        if (logo) logo.remove();
        let name = document.getElementById('company-title');
        if (name) name.remove();
    } catch {}
});

// Utilisateur connecté (email)
let email = null;
if (localStorage.getItem('email')) {
    email = localStorage.getItem('email');
    searchBtn.disabled = false;
    resetBtn.disabled = false;
} else {
    searchBtn.disabled = true;
    resetBtn.disabled = true;
}

// Load Data doit utiliser l'email pour charger les bonnes données
if (loadDataBtn && dataStatus) {
    loadDataBtn.addEventListener('click', async function() {
        loadDataBtn.disabled = true;
        dataStatus.textContent = 'Loading data...';
        try {
            const email = localStorage.getItem('email');
            const res = await fetch(`/api/load-data/${email}`);
            const result = await res.json();
            if (Array.isArray(result) || result.success) {
                dataStatus.textContent = `Data loaded`;
                searchBtn.disabled = false;
                resetBtn.disabled = false;
            } else {
                dataStatus.textContent = 'Failed to load data.';
                loadDataBtn.disabled = false;
            }
        } catch {
            dataStatus.textContent = 'Failed to load data.';
            loadDataBtn.disabled = false;
        }
    });
}

// Redirection automatique si non connecté
if (!localStorage.getItem('email')) {
    window.location.href = '/auth.html';
}

// Ajoute une fonction de feedback visuel
function showMsg(msg, type = 'success') {
    let el = document.getElementById('main-msg');
    if (!el) {
        el = document.createElement('div');
        el.id = 'main-msg';
        el.className = 'msg';
        document.querySelector('.container').prepend(el);
    }
    el.className = 'msg ' + type;
    el.innerHTML = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// --- MENU LATERAL ---
document.addEventListener('DOMContentLoaded', function() {
    // Log pour debug
    console.log('[DEBUG] Initialisation du menu latéral');
    const menuPrompt = document.getElementById('menu-prompt');
    const menuFilter = document.getElementById('menu-filter');
    const menuName = document.getElementById('menu-name');
    const promptBar = document.getElementById('prompt-search-bar');
    const filterBar = document.getElementById('filter-search-bar');
    const nameBar = document.getElementById('name-search-bar');
    if (!menuPrompt || !menuFilter || !menuName || !promptBar || !filterBar || !nameBar) {
        console.error('[DEBUG] Un ou plusieurs éléments du menu latéral sont introuvables');
        return;
    }
    function setActiveMenu(menu) {
        [menuPrompt, menuFilter, menuName].forEach(m => m.classList.remove('active'));
        menu.classList.add('active');
        promptBar.classList.remove('active');
        filterBar.classList.remove('active');
        nameBar.classList.remove('active');
        if (menu === menuPrompt) promptBar.classList.add('active');
        if (menu === menuFilter) filterBar.classList.add('active');
        if (menu === menuName) nameBar.classList.add('active');
        document.getElementById('results').innerHTML = '';
    }
    // --- Ajout : activer la section selon le hash de l'URL ---
    let hash = window.location.hash || '#prompt';
    if (hash === '#prompt') setActiveMenu(menuPrompt);
    else if (hash === '#domain') setActiveMenu(menuName);
    else if (hash === '#filter') setActiveMenu(menuFilter);
    else setActiveMenu(menuPrompt);
    // ---
    menuPrompt.addEventListener('click', () => setActiveMenu(menuPrompt));
    menuFilter.addEventListener('click', () => setActiveMenu(menuFilter));
    menuName.addEventListener('click', () => setActiveMenu(menuName));
    // Par défaut, promptBar est actif
    setActiveMenu(menuPrompt);
});

// --- RECHERCHE PAR FILTRE MULTI-CHOIX ---
const filterIndustryGroup = document.getElementById('filter-industry-group');
const filterLocationGroup = document.getElementById('filter-location-group');
const filterHeadcountGroup = document.getElementById('filter-headcount-group');

// Accordéon déroulant pour chaque filtre
function setupFilterAccordion() {
    [
        {header: 'industry-header', content: 'filter-industry-group'},
        {header: 'location-header', content: 'filter-location-group'},
        {header: 'headcount-header', content: 'filter-headcount-group'}
    ].forEach(({header, content}) => {
        const h = document.getElementById(header);
        const c = document.getElementById(content);
        if (h && c) {
            h.onclick = function() {
                const isOpen = c.style.display === 'block';
                document.querySelectorAll('.filter-content').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.filter-header').forEach(el => el.classList.remove('active'));
                if (!isOpen) {
                    c.style.display = 'block';
                    h.classList.add('active');
                }
            };
        }
    });
}
setupFilterAccordion();

// Helper pour extraire le pays à partir de la dernière virgule
function extractCountry(location) {
    if (!location) return '';
    const parts = location.split(',');
    return parts.length ? parts[parts.length-1].trim() : location.trim();
}

async function populateFilters() {
    try {
        const email = localStorage.getItem('email');
        const res = await fetch(`/api/filters?email=${encodeURIComponent(email)}`);
        if (!res.ok) return;
        const data = await res.json();
        // Pour Industry et Headcount, valeurs brutes
        function renderCheckboxGroup(container, values, name) {
            if (!container) return;
            container.innerHTML = '';
            const allId = `${name}-all`;
            const allBox = document.createElement('input');
            allBox.type = 'checkbox';
            allBox.id = allId;
            allBox.checked = true;
            const allLabel = document.createElement('label');
            allLabel.htmlFor = allId;
            allLabel.textContent = 'ALL';
            container.appendChild(allBox);
            container.appendChild(allLabel);
            container.appendChild(document.createElement('br'));
            values.forEach((val, idx) => {
                const id = `${name}-${idx}`;
                const box = document.createElement('input');
                box.type = 'checkbox';
                box.id = id;
                box.value = val;
                box.name = name;
                box.checked = false;
                const label = document.createElement('label');
                label.htmlFor = id;
                label.textContent = val;
                container.appendChild(box);
                container.appendChild(label);
                container.appendChild(document.createElement('br'));
            });
            // Gestion ALL
            allBox.addEventListener('change', function() {
                const checkboxes = container.querySelectorAll(`input[type=checkbox][name=${name}]`);
                checkboxes.forEach(cb => { cb.checked = false; });
            });
            container.querySelectorAll(`input[type=checkbox][name=${name}]`).forEach(cb => {
                cb.addEventListener('change', function() {
                    if (this.checked) allBox.checked = false;
                    if (![...container.querySelectorAll(`input[type=checkbox][name=${name}]`)].some(cb => cb.checked)) {
                        allBox.checked = true;
                    }
                });
            });
        }
        renderCheckboxGroup(filterIndustryGroup, data.industries || [], 'industry');
        renderCheckboxGroup(filterHeadcountGroup, data.headcounts || [], 'headcount');
        // Pour Location, extraire uniquement les pays distincts
        const allCountries = (data.locations || []).map(extractCountry);
        const uniqueCountries = [...new Set(allCountries)].filter(Boolean).sort();
        renderCheckboxGroup(filterLocationGroup, uniqueCountries, 'location');
    } catch {}
}
// Remplit les filtres au chargement
populateFilters();

filterSearchBtn.addEventListener('click', async function() {
    // Récupère les valeurs cochées (ou ALL)
    function getCheckedValues(container, name) {
        const allBox = container.querySelector(`#${name}-all`);
        if (allBox && allBox.checked) return [];
        return [...container.querySelectorAll(`input[type=checkbox][name=${name}]`)].filter(cb => cb.checked).map(cb => cb.value);
    }
    const industries = getCheckedValues(filterIndustryGroup, 'industry');
    const locations = getCheckedValues(filterLocationGroup, 'location');
    const headcounts = getCheckedValues(filterHeadcountGroup, 'headcount');
    const email = localStorage.getItem('email');
    if (!email) return showMsg('Veuillez vous connecter.', 'error');
    const loadingBtn = document.getElementById('loadingBtn');
    loadingBtn.style.display = 'inline-block';
    loadingBtn.innerHTML = '<span class="loader"></span> Recherche...';
    try {
        const response = await fetch('/api/filter-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, industries, locations, headcounts })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            showMsg("Erreur serveur: " + (err.error || response.statusText), 'error');
            loadingBtn.style.display = 'none';
            loadingBtn.innerHTML = 'Search';
            return;
        }
        let data = await response.json();
        if (!Array.isArray(data)) {
            showMsg(data.error || "Erreur côté serveur.", 'error');
            loadingBtn.style.display = 'none';
            loadingBtn.innerHTML = 'Search';
            return;
        }
        // Ajoute le nombre de contacts pour chaque entreprise (comme pour prompt)
        for (let i = 0; i < data.length; i++) {
            const domain = data[i]['Domain'];
            if (domain) {
                try {
                    const res = await fetch('/api/hunter-contacts-details', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ domain })
                    });
                    const contactsArr = await res.json();
                    data[i].contacts = Array.isArray(contactsArr) ? contactsArr.length : 0;
                } catch (e) {
                    data[i].contacts = 0;
                }
            } else {
                data[i].contacts = 0;
            }
        }
        renderResultsTable(data);
        showMsg('Recherche filtrée terminée.', 'success');
        loadingBtn.style.display = 'none';
        loadingBtn.innerHTML = 'Search';
    } finally {
        loadingBtn.style.display = 'none';
    }
});

// --- RECHERCHE PAR NOM DE SOCIETE ---
const companyNameInput = document.getElementById('companyNameInput');
const nameSearchBtn = document.getElementById('nameSearchBtn');

nameSearchBtn.addEventListener('click', async function() {
    const name = companyNameInput.value.trim();
    const email = localStorage.getItem('email');
    if (!name) return showMsg('Veuillez entrer un nom de société.', 'error');
    if (!email) return showMsg('Veuillez vous connecter.', 'error');
    const loadingBtn = document.getElementById('loadingBtn');
    loadingBtn.style.display = 'inline-block';
    loadingBtn.innerHTML = '<span class="loader"></span> Recherche...';
    try {
        const response = await fetch('/api/company-name-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            showMsg("Erreur serveur: " + (err.error || response.statusText), 'error');
            loadingBtn.style.display = 'none';
            loadingBtn.innerHTML = 'Search';
            return;
        }
        let data = await response.json();
        if (!Array.isArray(data)) {
            showMsg(data.error || "Erreur côté serveur.", 'error');
            loadingBtn.style.display = 'none';
            loadingBtn.innerHTML = 'Search';
            return;
        }
        // Ajoute le nombre de contacts pour chaque entreprise (comme pour prompt)
        for (let i = 0; i < data.length; i++) {
            const domain = data[i]['Domain'];
            if (domain) {
                try {
                    const res = await fetch('/api/hunter-contacts-details', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ domain })
                    });
                    const contactsArr = await res.json();
                    data[i].contacts = Array.isArray(contactsArr) ? contactsArr.length : 0;
                } catch (e) {
                    data[i].contacts = 0;
                }
            } else {
                data[i].contacts = 0;
            }
        }
        renderResultsTable(data);
        showMsg('Recherche par nom terminée.', 'success');
        loadingBtn.style.display = 'none';
        loadingBtn.innerHTML = 'Search';
    } finally {
        loadingBtn.style.display = 'none';
    }
});

// --- SAUVEGARDE DE RECHERCHE ---
const saveSearchBtn = document.getElementById('saveSearchBtn');
const savedSearchesList = document.getElementById('saved-searches');
const mainContainer = document.querySelector('.container');
const resultsTable = document.getElementById('results');

function getSavedSearchesKey() {
    const email = localStorage.getItem('email') || '';
    return 'savedSearches_' + email;
}

function loadSavedSearches() {
    const key = getSavedSearchesKey();
    let searches = [];
    try {
        searches = JSON.parse(localStorage.getItem(key)) || [];
    } catch {}
    window._allSavedSearches = searches;
}

// Affiche la liste des recherches sauvegardées dans la section principale
function showSavedSearchesTable() {
    loadSavedSearches();
    const searches = window._allSavedSearches || [];
    let html = '<h2>Mes recherches sauvegardées</h2>';
    if (!searches.length) {
        html += '<div style="color:#888;font-style:italic;">Aucune recherche sauvegardée.</div>';
    } else {
        html += '<table style="width:100%;margin-top:1em;"><thead><tr><th>Nom</th><th>Nb entreprises</th><th>Date</th><th>Voir</th></tr></thead><tbody>';
        searches.forEach((s, idx) => {
            html += `<tr><td>${s.name || 'Sans nom'}</td><td>${s.data.length}</td><td>${s.date || ''}</td><td><button class='btn btn-gray' data-idx='${idx}'>Voir</button></td></tr>`;
        });
        html += '</tbody></table>';
    }
    mainContainer.innerHTML = html + '<div id="savedResults"></div>';
    // Ajoute les listeners sur les boutons "Voir"
    document.querySelectorAll('button[data-idx]').forEach(btn => {
        btn.onclick = function() {
            const idx = parseInt(this.getAttribute('data-idx'));
            showSavedListDetails(idx);
        };
    });
}

// Affiche le tableau compact de toutes les entreprises d'une liste sauvegardée
function showSavedListDetails(idx) {
    const searches = window._allSavedSearches || [];
    if (!searches[idx]) return;
    const data = searches[idx].data;
    let html = `<h3>${searches[idx].name} (${data.length} entreprises)</h3>`;
    if (!data.length) {
        html += '<div style="color:#888;">Aucune entreprise dans cette liste.</div>';
    } else {
        html += '<div style="overflow-x:auto;"><table style="font-size:0.95em;width:100%;margin-top:1em;"><thead><tr>';
        html += '<th>Company Name</th><th>Domain</th><th>LinkedIn</th><th>Industry</th><th>Location</th><th>Headcount</th><th>Description</th><th>Contacts</th></tr></thead><tbody>';
        data.forEach(item => {
            html += `<tr><td>${item['Company Name']||''}</td><td>${item['Domain']||''}</td><td>${item['Linkedin']||''}</td><td>${item['Industry']||''}</td><td>${item['Location']||''}</td><td>${item['Headcount']||''}</td><td>${item['Description']||''}</td><td>${item['contacts']||0}</td></tr>`;
        });
        html += '</tbody></table></div>';
    }
    document.getElementById('savedResults').innerHTML = html;
}

// Remplace l'affichage du menu sauvegardé par un simple bouton/section
const menuSaved = document.getElementById('menu-saved');
if (menuSaved) {
    menuSaved.onclick = function() {
        window.location.href = 'saved.html';
    };
}
if (saveSearchBtn) {
    saveSearchBtn.addEventListener('click', function() {
        if (window._lastResults && Array.isArray(window._lastResults) && window._lastResults.length) {
            saveCurrentSearch(window._lastResults);
        } else {
            showMsg('Aucun résultat à sauvegarder.', 'error');
        }
    });
}

function saveCurrentSearch(results) {
    const name = prompt('Nom de la recherche à sauvegarder ?');
    if (!name) return;
    const key = getSavedSearchesKey();
    let searches = [];
    try {
        searches = JSON.parse(localStorage.getItem(key)) || [];
    } catch {}
    const date = new Date().toLocaleString();
    searches.push({ name, data: results, date });
    localStorage.setItem(key, JSON.stringify(searches));
    window._allSavedSearches = searches;
    showMsg('Recherche sauvegardée !', 'success');
}

function renderResultsTable(data) {
    // Stocke les résultats pour details.html
    localStorage.setItem('searchResults', JSON.stringify(data));
    resultsTable.innerHTML = '';
    data.forEach(item => {
        const domain = item['Domain']
            ? `<a href="details.html?domain=${encodeURIComponent(item['Domain'])}" class="clickable-link" target="_blank" rel="noopener noreferrer">${item['Domain']}</a>`
            : '';
        const linkedin = item['Linkedin']
            ? `<a href="${item['Linkedin']}" class="clickable-link" target="_blank" rel="noopener noreferrer">LinkedIn</a>`
            : '';
        const companyName = item['Company Name'] && item['Domain']
            ? `<a href="details.html?domain=${encodeURIComponent(item['Domain'])}" class="clickable-link">${item['Company Name']}</a>`
            : (item['Company Name'] || '');
        const contactsCell = (typeof item['contacts'] === 'number' && !isNaN(item['contacts'])) ? item['contacts'] : 0;
        const row = `<tr>
            <td>${companyName}</td>
            <td>${domain}</td>
            <td>${linkedin}</td>
            <td>${item['Industry'] || ''}</td>
            <td>${item['Location'] || ''}</td>
            <td>${item['Headcount'] || ''}</td>
            <td>${item['Description'] || ''}</td>
            <td>${contactsCell}</td>
        </tr>`;
        resultsTable.innerHTML += row;
    });
    saveSearchBtn.style.display = (data.length > 0) ? 'inline-block' : 'none';
    window._lastResults = data;
}

// Remplace tous les appels à l'affichage du tableau par renderResultsTable
// (dans les callbacks de recherche par prompt, filtre, nom, et restauration)

// Au chargement, restaurer les recherches sauvegardées
loadSavedSearches();