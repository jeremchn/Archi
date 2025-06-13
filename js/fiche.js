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
    // Affichage des sections constantes
    const sections = [
        { id: 'fiche-news-section', title: 'Actualités importantes', key: 'news', type: 'newsapi' },
        { id: 'fiche-position-section', title: 'Positionnement & Points forts', key: 'position', type: 'text' },
        { id: 'fiche-events-section', title: 'Événements majeurs', key: 'events', type: 'list' },
        { id: 'fiche-products-section', title: 'Nouveaux produits/services', key: 'products', type: 'list' },
        { id: 'fiche-leadership-section', title: 'Changements de direction', key: 'leadership', type: 'list' },
        { id: 'fiche-gpt-section', title: 'Analyse GPT', key: 'gpt_analysis', type: 'html' }
    ];
    // Récupération et affichage des actualités via l'API backend
    (async function() {
        const newsSection = sections.find(s => s.type === 'newsapi');
        if (newsSection) {
            const res = await fetch('/api/company-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: data.company['Company Name'], domain: data.company['Domain'] })
            });
            const result = await res.json();
            if (result.articles && result.articles.length > 0) {
                let el = document.getElementById(newsSection.id);
                if (!el) {
                    el = document.createElement('div');
                    el.className = 'section card';
                    el.id = newsSection.id;
                    document.querySelector('.container').appendChild(el);
                }
                el.style.display = '';
                el.innerHTML = `<h2>${newsSection.title}</h2><ul class="news-list">${result.articles.map(a => `<li><a href="${a.url}" class="clickable-link" target="_blank">${a.title}</a> <span style='color:#888;font-size:0.95em;'>(${a.source}, ${a.date ? a.date.slice(0,10) : ''})</span><br><span style='font-size:0.97em;'>${a.description}</span></li>`).join('')}</ul>`;
            }
        }
    })();
    sections.forEach(section => {
        let el = document.getElementById(section.id);
        if (!el) {
            el = document.createElement('div');
            el.className = 'section card';
            el.id = section.id;
            el.innerHTML = `<h2>${section.title}</h2>`;
            document.querySelector('.container').appendChild(el);
        }
        let content = '';
        if (section.type === 'list' && Array.isArray(data[section.key]) && data[section.key].length > 0) {
            content = `<ul class="news-list">${data[section.key].map(x => `<li>${x}</li>`).join('')}</ul>`;
        } else if (section.type === 'text' && data[section.key]) {
            content = `<p>${data[section.key]}</p>`;
        } else if (section.type === 'html' && data[section.key]) {
            content = data[section.key];
        }
        el.style.display = content ? '' : 'none';
        el.innerHTML = `<h2>${section.title}</h2>${content}`;
    });
})();
