// Affiche la fiche entreprise à partir des données stockées dans localStorage
(function() {
    const data = JSON.parse(localStorage.getItem('deepCompanyProfile') || '{}');
    if (!data || !data.company) {
        document.body.innerHTML = '<p>Impossible de charger la fiche entreprise.</p>';
        return;
    }
    // Affichage des infos principales
    document.getElementById('fiche-company-name').textContent = data.company['Company Name'] || '';
    document.getElementById('fiche-company-info').innerHTML = `
        <div class="info-list">
            <strong>Domaine :</strong> <a href="http://${data.company['Domain']}" class="clickable-link" target="_blank">${data.company['Domain']}</a><br>
            <strong>LinkedIn :</strong> ${data.company['Linkedin'] ? `<a href="${data.company['Linkedin']}" class="clickable-link" target="_blank">LinkedIn</a>` : ''}<br>
            <strong>Industry :</strong> ${data.company['Industry'] || ''}<br>
            <strong>Location :</strong> ${data.company['Location'] || ''}<br>
            <strong>Headcount :</strong> ${data.company['Headcount'] || ''}<br>
            <strong>Description :</strong> ${data.company['Description'] || ''}<br>
            <strong>Company Type :</strong> ${data.company['Company Type'] || ''}<br>
        </div>
    `;
    // Affichage des contacts
    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    const tbody = document.querySelector('#fiche-contacts-table tbody');
    if (contacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Aucun contact trouvé.</td></tr>';
    } else {
        tbody.innerHTML = contacts.map(c => `
            <tr>
                <td>${c.email || ''}</td>
                <td>${c.first_name || ''}</td>
                <td>${c.last_name || ''}</td>
                <td>${c.position || ''}</td>
                <td>${c.linkedin_url ? `<a href="${c.linkedin_url}" class="clickable-link" target="_blank">LinkedIn</a>` : ''}</td>
            </tr>
        `).join('');
    }
    // Affichage des actualités LinkedIn ou site web
    if (Array.isArray(data.news) && data.news.length > 0) {
        document.getElementById('fiche-news-section').style.display = '';
        document.getElementById('fiche-news-list').innerHTML = data.news.map(n => `<li>${n}</li>`).join('');
    }
    // Affichage de l'analyse GPT
    if (data.gpt_analysis) {
        document.getElementById('fiche-gpt-section').style.display = '';
        document.getElementById('fiche-gpt-info').innerHTML = data.gpt_analysis;
    }
})();
