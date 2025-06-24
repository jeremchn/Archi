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

        // Appel à l'API Hunter pour chaque entreprise (via backend)
        const contactsResponse = await fetch('/api/hunter-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companies: data.map(item => item['Domain']) })
        });
        const contactsData = await contactsResponse.json();

        // Ajoute le nombre de contacts à chaque entreprise
        data = data.map((item, idx) => ({
            ...item,
            contacts: contactsData[idx] !== undefined ? contactsData[idx] : 0
        }));

        // Trie les résultats par nombre de contacts décroissant (valeurs vides/nulles = 0)
        data.sort((a, b) => {
            const contactsA = (typeof a.contacts === 'number' && !isNaN(a.contacts)) ? a.contacts : 0;
            const contactsB = (typeof b.contacts === 'number' && !isNaN(b.contacts)) ? b.contacts : 0;
            return contactsB - contactsA;
        });
        // Stocke les résultats dans le localStorage pour accès depuis details.html
        localStorage.setItem('searchResults', JSON.stringify(data));
        // Affiche les résultats dans le tableau
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
            // Affiche rien si contacts vaut 0 ou undefined
            const contactsCell = item['contacts'] && item['contacts'] > 0 ? item['contacts'] : '';
            // Ajout de la colonne score (normalisée entre 0 et 1, arrondie à 3 décimales)
            let scoreCell = '';
            if (typeof item.score === 'number') {
                // Clamp le score entre 0 et 1 (cosine similarity peut être [-1,1])
                const normalized = Math.max(0, Math.min(1, (item.score + 1) / 2));
                scoreCell = normalized.toFixed(3);
            }
            const row = `<tr>
                <td>${companyName}</td>
                <td>${domain}</td>
                <td>${linkedin}</td>
                <td>${item['Industry'] || ''}</td>
                <td>${item['Location'] || ''}</td>
                <td>${item['Headcount'] || ''}</td>
                <td>${item['Description'] || ''}</td>
                <td>${contactsCell}</td>
                <td>${scoreCell}</td>
            </tr>`;
            resultsTable.innerHTML += row;
        });
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