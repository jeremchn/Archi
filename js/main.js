document.getElementById('searchBtn').addEventListener('click', async function() {
    const query = document.getElementById('search').value;
    if (!query) return alert("Please enter your need in the search bar.");
    if (!email) return alert("Veuillez vous connecter.");
    // Masque l'en-tête et le bouton save avant la recherche
    const thead = document.getElementById('results-thead');
    if (thead) thead.style.display = 'none';
    if (saveSearchBtn) saveSearchBtn.style.display = 'none';
    resultsTable.innerHTML = '';
    const loadingBtn = document.getElementById('loadingBtnPrompt');
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
        localStorage.setItem(getCurrentMenuKey(), JSON.stringify(data));
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
    resultsTable.innerHTML = '';
    if (window.location.hash === '#filter') {
        localStorage.removeItem('searchResults');
    }
    // Ajoute ici d'autres sections si besoin (prompt, name...)
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
        // Affiche les résultats du menu courant, sinon masque tout
        const key = getCurrentMenuKey();
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(data) && data.length > 0) {
            renderResultsTable(data);
        } else {
            document.getElementById('results').innerHTML = '';
            const thead = document.getElementById('results-thead');
            if (thead) thead.style.display = 'none';
            if (saveSearchBtn) saveSearchBtn.style.display = 'none';
        }
    }
    // --- Ajout : activer la section selon le hash de l'URL au chargement et lors d'un changement de hash ---
    function activateFromHash() {
        let hash = window.location.hash || '#prompt';
        if (hash === '#prompt') setActiveMenu(menuPrompt);
        else if (hash === '#domain') setActiveMenu(menuName);
        else if (hash === '#filter') setActiveMenu(menuFilter);
        else setActiveMenu(menuPrompt);
    }
    // Supprimer tout appel à setActiveMenu(menuPrompt) avant activateFromHash()
    activateFromHash();
    window.addEventListener('hashchange', activateFromHash);
    menuPrompt.addEventListener('click', () => { setActiveMenu(menuPrompt); window.location.hash = '#prompt'; });
    menuFilter.addEventListener('click', () => { setActiveMenu(menuFilter); window.location.hash = '#filter'; });
    menuName.addEventListener('click', () => { setActiveMenu(menuName); window.location.hash = '#domain'; });
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

filterSearchBtn.addEventListener('click', function() {
    console.log('[DEBUG] filterSearchBtn clicked');
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
    // Masque l'en-tête et le bouton save avant la recherche
    const thead = document.getElementById('results-thead');
    if (thead) thead.style.display = 'none';
    saveSearchBtn.style.display = 'none';
    resultsTable.innerHTML = '';
    const loadingBtn = document.getElementById('loadingBtnFilter');
    loadingBtn.style.display = 'inline-block';
    loadingBtn.innerHTML = '<span class="loader"></span> Recherche...';
    console.log('[DEBUG] loadingBtn should be visible', loadingBtn, loadingBtn.style.display, loadingBtn.innerHTML);
    // Utilise setTimeout pour forcer l'affichage du bouton de chargement
    setTimeout(async () => {
        console.log('[DEBUG] Entered setTimeout for filterSearchBtn');
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
            localStorage.setItem(getCurrentMenuKey(), JSON.stringify(data));
            renderResultsTable(data);
            showMsg('Recherche filtrée terminée.', 'success');
            loadingBtn.style.display = 'none';
            loadingBtn.innerHTML = 'Search';
        } finally {
            loadingBtn.style.display = 'none';
            console.log('[DEBUG] loadingBtn hidden after filterSearchBtn');
        }
    }, 0);
});

// --- RECHERCHE PAR NOM DE SOCIETE ---
const companyNameInput = document.getElementById('companyNameInput');
const nameSearchBtn = document.getElementById('nameSearchBtn');

nameSearchBtn.addEventListener('click', function() {
    console.log('[DEBUG] nameSearchBtn clicked');
    const name = companyNameInput.value.trim();
    const email = localStorage.getItem('email');
    if (!name) return showMsg('Veuillez entrer un nom de société.', 'error');
    if (!email) return showMsg('Veuillez vous connecter.', 'error');
    // Masque l'en-tête et le bouton save avant la recherche
    const thead = document.getElementById('results-thead');
    if (thead) thead.style.display = 'none';
    saveSearchBtn.style.display = 'none';
    resultsTable.innerHTML = '';
    const loadingBtn = document.getElementById('loadingBtnDomain');
    loadingBtn.style.display = 'inline-block';
    loadingBtn.innerHTML = '<span class="loader"></span> Recherche...';
    console.log('[DEBUG] loadingBtn should be visible', loadingBtn, loadingBtn.style.display, loadingBtn.innerHTML);
    // Utilise setTimeout pour forcer l'affichage du bouton de chargement
    setTimeout(async () => {
        console.log('[DEBUG] Entered setTimeout for nameSearchBtn');
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
            localStorage.setItem(getCurrentMenuKey(), JSON.stringify(data));
            renderResultsTable(data);
            showMsg('Recherche par nom terminée.', 'success');
            loadingBtn.style.display = 'none';
            loadingBtn.innerHTML = 'Search';
        } finally {
            loadingBtn.style.display = 'none';
            console.log('[DEBUG] loadingBtn hidden after nameSearchBtn');
        }
    }, 0);
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


// Handler Save all companies => sauvegarde dans les recherches sauvegardées (saved companies)
if (saveSearchBtn) {
    saveSearchBtn.onclick = function() {
        const results = window._lastResults || [];
        if (!results || !results.length) return alert('Aucun résultat à sauvegarder.');
        saveCurrentSearch(results);
    };
}

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
let menuSaved = document.getElementById('menu-saved');
if (menuSaved) {
    menuSaved.onclick = function() {
        window.location.href = 'saved.html';
    };
}
if (saveSearchBtn) {
    saveSearchBtn.onclick = function() {
        const results = JSON.parse(localStorage.getItem('searchResults') || '[]');
        if (!results.length) return alert('No companies to save.');
        let leadsLists = JSON.parse(localStorage.getItem('leadsLists') || '{}');
        const listNames = Object.keys(leadsLists);
        // Mini-modal
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
                <div style="font-size:1.15em;font-weight:600;margin-bottom:1.2em;">Save all companies</div>
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
                let added = 0;
                results.forEach(company => {
                    // On ne sauvegarde que les infos principales (Company Name, Domain, etc.)
                    const lead = {
                        company: company['Company Name'] || '',
                        domain: company['Domain'] || '',
                        linkedin_url: company['Linkedin'] || '',
                        industry: company['Industry'] || '',
                        location: company['Location'] || '',
                        headcount: company['Headcount'] || '',
                        description: company['Description'] || ''
                    };
                    if (!leadsLists[name].some(l => l.domain === lead.domain)) {
                        leadsLists[name].push(lead);
                        added++;
                    }
                });
                localStorage.setItem('leadsLists', JSON.stringify(leadsLists));
                alert(added + ' companies saved in list ' + name);
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
                    let added = 0;
                    results.forEach(company => {
                        const lead = {
                            company: company['Company Name'] || '',
                            domain: company['Domain'] || '',
                            linkedin_url: company['Linkedin'] || '',
                            industry: company['Industry'] || '',
                            location: company['Location'] || '',
                            headcount: company['Headcount'] || '',
                            description: company['Description'] || ''
                        };
                        if (!leadsLists[list].some(l => l.domain === lead.domain)) {
                            leadsLists[list].push(lead);
                            added++;
                        }
                    });
                    localStorage.setItem('leadsLists', JSON.stringify(leadsLists));
                    alert(added + ' companies saved in list ' + list);
                    modal.remove();
                };
            });
        };
    };
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
    const thead = document.getElementById('results-thead');
    if (thead) thead.style.display = (data.length > 0) ? '' : 'none';
    if (saveSearchBtn) saveSearchBtn.style.display = (data.length > 0) ? 'inline-block' : 'none';
    data.forEach((item, idx) => {
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
        // Ajout du bouton Save company
        const saveBtn = `<button class="btn btn-save-company" data-idx="${idx}" style="background:var(--success);color:#fff;">Save company</button>`;
        const row = `<tr>
            <td>${companyName}</td>
            <td>${domain}</td>
            <td>${linkedin}</td>
            <td>${item['Industry'] || ''}</td>
            <td>${item['Location'] || ''}</td>
            <td>${item['Headcount'] || ''}</td>
            <td>${item['Description'] || ''}</td>
            <td>${contactsCell}</td>
            <td style="text-align:center;">${saveBtn}</td>
        </tr>`;
        resultsTable.innerHTML += row;
    });
    // Ajout des listeners sur les boutons Save company
    setTimeout(() => {
        document.querySelectorAll('.btn-save-company').forEach(btn => {
            btn.onclick = function(e) {
                const idx = parseInt(this.getAttribute('data-idx'));
                if (!isNaN(idx) && data[idx]) {
                    openSaveCompanyModal(data[idx]);
                }
            };
        });
    }, 0);
}

// Fonction pour ouvrir le mini-modal UX pour sauvegarder une entreprise
function openSaveCompanyModal(company) {
    // Réutilise le mini-modal existant pour Save lead/Save all
    // On suppose qu'une fonction showSaveLeadModal existe déjà, sinon à adapter
    if (typeof showSaveLeadModal === 'function') {
        showSaveLeadModal(company, 'company');
    } else {
        alert('Save modal not implemented');
    }
}

// Ajoute le handler pour le menu Contacts (navigation vers contacts.html)
const menuContacts = document.getElementById('menu-contacts');
if (menuContacts) {
    menuContacts.onclick = function() {
        window.location.href = 'contacts.html';
    };
}

// Ajoute une version locale du mini-modal pour Save company si showSaveLeadModal n'existe pas
function showSaveLeadModal(company, type) {
    // type = 'company' ou 'lead'
    let leadsLists = JSON.parse(localStorage.getItem('leadsLists') || '{}');
    const listNames = Object.keys(leadsLists);
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
            <div style="font-size:1.15em;font-weight:600;margin-bottom:1.2em;">Save company</div>
            <button id="modal-new-list" style="background:#2ecc71;color:#fff;border:none;border-radius:7px;padding:0.6em 1.2em;font-size:1em;margin:0 0.7em 1em 0;cursor:pointer;">New list</button>
            <button id="modal-add-list" style="background:#1a365d;color:#fff;border:none;border-radius:7px;padding:0.6em 1.2em;fontSize:1em;margin:0 0 1em 0;cursor:pointer;">Add to a list</button>
            <div id="modal-content"></div>
            <button id="modal-cancel" style="margin-top:1.2em;background:#eee;color:#222;border:none;border-radius:7px;padding:0.5em 1.2em;font-size:1em;cursor:pointer;">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#modal-cancel').onclick = () => modal.remove();
    modal.querySelector('#modal-new-list').onclick = () => {
        const content = modal.querySelector('#modal-content');
        content.innerHTML = `<input id="modal-list-name" type="text" placeholder="List name..." style="width:90%;padding:0.6em 1em;font-size:1em;border-radius:7px;border:1px solid #e2e8f0;"> <button id="modal-create-list" style="background:#2ecc71;color:#fff;border:none;border-radius:7px;padding:0.5em 1.2em;font-size:1em;margin-left:0.5em;cursor:pointer;">Create</button>`;
        content.querySelector('#modal-create-list').onclick = () => {
            const name = content.querySelector('#modal-list-name').value.trim();
            if (!name) return alert('Enter a list name');
            if (!leadsLists[name]) leadsLists[name] = [];
            if (!leadsLists[name].some(l => l.domain === company.Domain)) {
                leadsLists[name].push({
                    company: company['Company Name'] || '',
                    domain: company['Domain'] || '',
                    linkedin_url: company['Linkedin'] || '',
                    industry: company['Industry'] || '',
                    location: company['Location'] || '',
                    headcount: company['Headcount'] || '',
                    description: company['Description'] || ''
                });
                localStorage.setItem('leadsLists', JSON.stringify(leadsLists));
                alert('Company saved in list ' + name);
            } else {
                alert('Cette company est déjà dans la liste ' + name);
            }
            modal.remove();
        };
    };
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
                if (!leadsLists[list].some(l => l.domain === company.Domain)) {
                    leadsLists[list].push({
                        company: company['Company Name'] || '',
                        domain: company['Domain'] || '',
                        linkedin_url: company['Linkedin'] || '',
                        industry: company['Industry'] || '',
                        location: company['Location'] || '',
                        headcount: company['Headcount'] || '',
                        description: company['Description'] || ''
                    });
                    localStorage.setItem('leadsLists', JSON.stringify(leadsLists));
                    alert('Company saved in list ' + list);
                } else {
                    alert('Cette company est déjà dans la liste ' + list);
                }
                modal.remove();
            };
        });
    };
}

// Affiche les résultats stockés à l'ouverture de la section #filter
window.addEventListener('hashchange', () => {
    if (window.location.hash === '#filter') {
        const data = JSON.parse(localStorage.getItem('searchResults') || '[]');
        if (Array.isArray(data) && data.length > 0) {
            renderResultsTable(data);
        } else {
            resultsTable.innerHTML = '';
        }
    }
});
// Affiche aussi au chargement initial si #filter
if (window.location.hash === '#filter') {
    const data = JSON.parse(localStorage.getItem('searchResults') || '[]');
    if (Array.isArray(data) && data.length > 0) {
        renderResultsTable(data);
    }
}

// Masquer le thead et le bouton "Save all companies" au chargement initial
// (On ne fait ça qu'une seule fois, au tout début)
document.addEventListener('DOMContentLoaded', function() {
    var resultsThead = document.getElementById('results-thead');
    var saveSearchBtn = document.getElementById('saveSearchBtn');
    if (resultsThead) resultsThead.style.display = 'none';
    if (saveSearchBtn) saveSearchBtn.style.display = 'none';
});

// --- Gestion des résultats par menu ---
const MENU_KEYS = {
    '#prompt': 'searchResults_prompt',
    '#filter': 'searchResults_filter',
    '#domain': 'searchResults_domain'
};
function getCurrentMenuKey() {
    const hash = window.location.hash || '#prompt';
    return MENU_KEYS[hash] || MENU_KEYS['#prompt'];
}

// --- Gestion des boutons search et reset selon la section active ---
// Handler pour le bouton search (prompt/filter)
searchBtn.addEventListener('click', function(e) {
    const hash = window.location.hash || '#prompt';
    if (hash === '#prompt') {
        // Déclenche la recherche prompt (déjà gérée plus haut)
        // Rien à faire ici, la logique existe déjà
    } else if (hash === '#filter') {
        // Déclenche la recherche filter
        filterSearchBtn.click();
        e.preventDefault();
    }
});

// Handler pour le bouton reset (prompt/filter)
resetBtn.addEventListener('click', function(e) {
    const hash = window.location.hash || '#prompt';
    if (hash === '#prompt') {
        document.getElementById('search').value = '';
        resultsTable.innerHTML = '';
        localStorage.removeItem('searchResults_prompt');
        const thead = document.getElementById('results-thead');
        if (thead) thead.style.display = 'none';
        if (saveSearchBtn) saveSearchBtn.style.display = 'none';
    } else if (hash === '#filter') {
        // Réinitialise les filtres
        document.querySelectorAll('#filter-search-bar input[type=checkbox]').forEach(cb => cb.checked = false);
        const allIndustry = document.getElementById('industry-all');
        const allLocation = document.getElementById('location-all');
        const allHeadcount = document.getElementById('headcount-all');
        if (allIndustry) allIndustry.checked = true;
        if (allLocation) allLocation.checked = true;
        if (allHeadcount) allHeadcount.checked = true;
        resultsTable.innerHTML = '';
        localStorage.removeItem('searchResults_filter');
        const thead = document.getElementById('results-thead');
        if (thead) thead.style.display = 'none';
        if (saveSearchBtn) saveSearchBtn.style.display = 'none';
    }
    e.preventDefault();
});

// --- RESET FILTER SECTION ---
const filterResetBtn = document.getElementById('filterResetBtn');
if (filterResetBtn) {
    filterResetBtn.addEventListener('click', function(e) {
        // Réinitialise tous les filtres
        document.querySelectorAll('#filter-search-bar input[type=checkbox]').forEach(cb => cb.checked = false);
        const allIndustry = document.getElementById('industry-all');
        const allLocation = document.getElementById('location-all');
        const allHeadcount = document.getElementById('headcount-all');
        if (allIndustry) allIndustry.checked = true;
        if (allLocation) allLocation.checked = true;
        if (allHeadcount) allHeadcount.checked = true;
        resultsTable.innerHTML = '';
        localStorage.removeItem('searchResults_filter');
        const thead = document.getElementById('results-thead');
        if (thead) thead.style.display = 'none';
        if (saveSearchBtn) saveSearchBtn.style.display = 'none';
        e.preventDefault();
    });
}
// --- RESET DOMAIN SECTION ---
const nameResetBtn = document.getElementById('resetNameBtn');
if (nameResetBtn && companyNameInput) {
    nameResetBtn.addEventListener('click', function(e) {
        companyNameInput.value = '';
        resultsTable.innerHTML = '';
        localStorage.removeItem('searchResults_domain');
        const thead = document.getElementById('results-thead');
        if (thead) thead.style.display = 'none';
        if (saveSearchBtn) saveSearchBtn.style.display = 'none';
        e.preventDefault();
    });
}