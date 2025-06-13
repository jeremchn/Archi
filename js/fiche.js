// Affiche la fiche entreprise à partir des données stockées dans localStorage
(function() {
    const data = JSON.parse(localStorage.getItem('deepCompanyProfile') || '{}');
    if (!data || !data.company) {
        document.body.innerHTML = '<p>Impossible de charger la fiche entreprise.</p>';
        return;
    }
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
    // Affichage selon le mode
    if (data.mode === 'news' && Array.isArray(data.news)) {
        document.getElementById('fiche-news-section').style.display = '';
        document.getElementById('fiche-news-list').innerHTML = data.news.map(a => `<li><a href="${a.url}" class="clickable-link" target="_blank">${a.title}</a> <span style='color:#888;font-size:0.95em;'>(${a.source}, ${a.date ? a.date.slice(0,10) : ''})</span><br><span style='font-size:0.97em;'>${a.description}</span></li>`).join('');
    }
    if (data.mode === 'linkedin' && data.linkedin) {
        let html = '';
        if (data.linkedin.info) {
            html += `<h2>Infos LinkedIn</h2><p>${data.linkedin.info.name || ''}</p><p>${data.linkedin.info.recruitment || ''}</p>`;
        }
        if (Array.isArray(data.linkedin.posts) && data.linkedin.posts.length > 0) {
            html += `<h2>Dernier post LinkedIn</h2><p>${data.linkedin.posts[0]}</p>`;
        }
        if (Array.isArray(data.linkedin.jobs) && data.linkedin.jobs.length > 0) {
            html += `<h2>Offres d'emploi LinkedIn</h2><ul>${data.linkedin.jobs.map(j => `<li>${j}</li>`).join('')}</ul>`;
        }
        const section = document.createElement('div');
        section.className = 'section card';
        section.innerHTML = html;
        document.querySelector('.container').appendChild(section);
    }
    if (data.mode === 'site' && data.site) {
        let html = `<h2>Résumé du site web</h2>`;
        if (data.site.title) html += `<strong>Titre :</strong> ${data.site.title}<br>`;
        if (data.site.description) html += `<strong>Description :</strong> ${data.site.description}<br>`;
        if (data.site.firstP) html += `<strong>Premier paragraphe :</strong> ${data.site.firstP}<br>`;
        const section = document.createElement('div');
        section.className = 'section card';
        section.innerHTML = html;
        document.querySelector('.container').appendChild(section);
    }
})();
