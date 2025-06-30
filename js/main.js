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
    menuPrompt.addEventListener('click', () => setActiveMenu(menuPrompt));
    menuFilter.addEventListener('click', () => setActiveMenu(menuFilter));
    menuName.addEventListener('click', () => setActiveMenu(menuName));
    // Par défaut, promptBar est actif
    setActiveMenu(menuPrompt);
});

// --- RECHERCHE PAR FILTRE ---
const filterIndustry = document.getElementById('filter-industry');
const filterLocation = document.getElementById('filter-location');
const filterHeadcount = document.getElementById('filter-headcount');
const filterSearchBtn = document.getElementById('filterSearchBtn');

// Remplir dynamiquement les options de filtres (à partir d'un endpoint ou d'un fichier de données)
async function populateFilters() {
    try {
        const email = localStorage.getItem('email');
        const res = await fetch(`/api/filters?email=${encodeURIComponent(email)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.industries)) {
            filterIndustry.innerHTML = '<option value="">Industry</option>' + data.industries.map(i => `<option value="${i}">${i}</option>`).join('');
        }
        if (Array.isArray(data.locations)) {
            filterLocation.innerHTML = '<option value="">Location</option>' + data.locations.map(l => `<option value="${l}">${l}</option>`).join('');
        }
        if (Array.isArray(data.headcounts)) {
            filterHeadcount.innerHTML = '<option value="">Headcount</option>' + data.headcounts.map(h => `<option value="${h}">${h}</option>`).join('');
        }
    } catch (e) {}
}
// Remplit les filtres au chargement
populateFilters();

filterSearchBtn.addEventListener('click', async function() {
    const industry = filterIndustry.value;
    const location = filterLocation.value;
    const headcount = filterHeadcount.value;
    const email = localStorage.getItem('email');
    if (!email) return showMsg('Veuillez vous connecter.', 'error');
    // Appel au backend pour la recherche filtrée
    const loadingBtn = document.getElementById('loadingBtn');
    loadingBtn.style.display = 'inline-block';
    loadingBtn.innerHTML = '<span class="loader"></span> Recherche...';
    try {
        const response = await fetch('/api/filter-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, industry, location, headcount })
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
    renderSavedSearches(searches);
}

function renderSavedSearches(searches) {
    if (!savedSearchesList) return;
    savedSearchesList.innerHTML = '';
    if (!searches.length) {
        savedSearchesList.innerHTML = '<li style="color:#888;font-style:italic;">Aucune recherche</li>';
        return;
    }
    searches.forEach((s, idx) => {
        const li = document.createElement('li');
        li.textContent = s.name + ' (' + (s.data.length) + ' entreprises)';
        li.style.cursor = 'pointer';
        li.onclick = () => {
            // Affiche la liste sauvegardée dans le tableau
            renderResultsTable(s.data);
            showMsg('Recherche restaurée : ' + s.name, 'success');
        };
        savedSearchesList.appendChild(li);
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
    searches.push({ name, data: results });
    localStorage.setItem(key, JSON.stringify(searches));
    renderSavedSearches(searches);
    showMsg('Recherche sauvegardée !', 'success');
}

function renderResultsTable(data) {
    const resultsTable = document.getElementById('results');
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
    // Affiche le bouton sauvegarder si résultats
    saveSearchBtn.style.display = (data.length > 0) ? 'inline-block' : 'none';
    // Stocke temporairement la dernière recherche affichée
    window._lastResults = data;
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

// Remplace tous les appels à l'affichage du tableau par renderResultsTable
// (dans les callbacks de recherche par prompt, filtre, nom, et restauration)

// Après chaque recherche, remplacer l'affichage du tableau par :
// renderResultsTable(data);

// Au chargement, restaurer les recherches sauvegardées
loadSavedSearches();