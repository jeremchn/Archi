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

    // Ajoute le nombre de contacts à chaque entreprise
    data = data.map((item, idx) => ({
        ...item,
        contacts: contactsData[idx] || 0
    }));

    // Affiche les résultats dans le tableau
    const resultsTable = document.getElementById('results');
    resultsTable.innerHTML = '';
    data.forEach(item => {
        const row = `<tr>
            <td>${item['Company Name'] || ''}</td>
            <td>${item['Domain'] || ''}</td>
            <td>${item['Industry'] || ''}</td>
            <td>${item['Location'] || ''}</td>
            <td>${item['Headcount'] || ''}</td>
            <td>${item['Linkedin'] || ''}</td>
            <td>${item['Description'] || ''}</td>
            <td>${item['Company Type'] || ''}</td>
            <td>${item['contacts'] || 0}</td>
        </tr>`;
        resultsTable.innerHTML += row;
    });
});