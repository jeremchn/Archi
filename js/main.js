document.getElementById('searchBtn').addEventListener('click', async function() {
    const query = document.getElementById('search').value;
    if (!query) return alert("Please enter your need in the search bar.");

    const loadingBtn = document.getElementById('loadingBtn');
    loadingBtn.style.display = 'inline-block';

    try {
        // Appel au backend pour la recherche sémantique
        const response = await fetch('/api/semantic-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
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

loadDataBtn.addEventListener('click', async function() {
    loadDataBtn.disabled = true;
    dataStatus.textContent = 'Loading data...';
    try {
        const res = await fetch('/api/load-data', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            dataStatus.textContent = `Data loaded (${result.count} companies)`;
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

searchBtn.disabled = true;
resetBtn.disabled = true;