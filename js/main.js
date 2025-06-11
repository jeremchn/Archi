document.getElementById('searchBtn').addEventListener('click', async function() {
    const query = document.getElementById('search').value;
    if (!query) return alert("Please enter your need in the search bar.");

    // Appel au backend pour la recherche sémantique
    const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });
    let data = await response.json();

    // Vérifie si la réponse est bien un tableau
    if (!Array.isArray(data)) {
        alert(data.error || "Erreur côté serveur.");
        console.error(data);
        return;
    }

    // Appel à l'API Hunter pour chaque entreprise (via backend)
    const contactsResponse = await fetch('/api/hunter-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: data.map(item => item['Domain']) })
    });
    const contactsData = await contactsResponse.json();

    // Correction : recalculer le nombre de contacts en fonction de la vraie longueur du tableau d'emails Hunter
    // On va refaire un appel pour chaque domaine pour obtenir le vrai nombre si besoin
    // Mais pour éviter de refaire un appel, il faut s'assurer que l'API /api/hunter-contacts retourne bien le nombre réel de contacts (emails trouvés)
    // Si ce n'est pas le cas, il faut corriger le backend (voir ci-dessous)

    // Ajoute le nombre de contacts à chaque entreprise
    data = data.map((item, idx) => ({
        ...item,
        contacts: contactsData[idx] !== undefined ? contactsData[idx] : 0
    }));

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
        const row = `<tr>
            <td>${companyName}</td>
            <td>${domain}</td>
            <td>${linkedin}</td>
            <td>${item['Industry'] || ''}</td>
            <td>${item['Location'] || ''}</td>
            <td>${item['Headcount'] || ''}</td>
            <td>${item['Description'] || ''}</td>
            <td>${item['contacts'] || 0}</td>
        </tr>`;
        resultsTable.innerHTML += row;
    });
});

document.getElementById('resetBtn').addEventListener('click', function() {
    document.getElementById('search').value = '';
    document.getElementById('results').innerHTML = '';
});