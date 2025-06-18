document.getElementById('searchBtn').addEventListener('click', async function() {
    const query = document.getElementById('search').value;
    if (!query) return alert("Please enter your need in the search bar.");
    if (!mail) return alert("Veuillez vous connecter.");

    const loadingBtn = document.getElementById('loadingBtn');
    loadingBtn.style.display = 'inline-block';

    try {
        // Appel au backend pour la recherche sémantique
        const response = await fetch('/api/semantic-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mail, query })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            alert("Erreur serveur: " + (err.error || response.statusText));
            loadingBtn.style.display = 'none';
            return;
        }
        let data = await response.json();

        // Vérifie si la réponse est bien un tableau
        if (!Array.isArray(data)) {
            alert(data.error || "Erreur côté serveur.");
            console.error(data);
            loadingBtn.style.display = 'none';
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
        // Affiche les résultats dans le tableau
        const resultsTable = document.getElementById('results');
        resultsTable.innerHTML = '';
        data.forEach(item => {
            const domain = item['Domain']
                ? `<a href="http://${item['Domain']}" class="clickable-link" target="_blank" rel="noopener noreferrer">${item['Domain']}</a>`
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
    const mail = localStorage.getItem('mail');
    if (!mail) return;
    try {
        const res = await fetch(`/api/profile/${mail}`);
        if (!res.ok) return;
        const profile = await res.json();
        let logo = document.getElementById('company-logo');
        if (!logo) {
            logo = document.createElement('img');
            logo.id = 'company-logo';
            logo.style.maxWidth = '120px';
            logo.style.display = 'block';
            logo.style.margin = '0 auto 1em auto';
            document.querySelector('.container').prepend(logo);
        }
        logo.src = profile.logo_url;
        let name = document.getElementById('company-title');
        if (!name) {
            name = document.createElement('h2');
            name.id = 'company-title';
            name.style.textAlign = 'center';
            document.querySelector('.container').prepend(name);
        }
        name.textContent = profile.company_name;
    } catch {}
});

// Utilisateur connecté (mail)
let mail = null;
if (localStorage.getItem('mail')) {
    mail = localStorage.getItem('mail');
    searchBtn.disabled = false;
    resetBtn.disabled = false;
} else {
    searchBtn.disabled = true;
    resetBtn.disabled = true;
}

// Load Data doit utiliser le mail pour charger les bonnes données
loadDataBtn.addEventListener('click', async function() {
    loadDataBtn.disabled = true;
    dataStatus.textContent = 'Loading data...';
    try {
        const mail = localStorage.getItem('mail');
        const res = await fetch(`/api/load-data/${mail}`);
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