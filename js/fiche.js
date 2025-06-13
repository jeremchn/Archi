// Affiche la fiche entreprise à partir des données stockées dans localStorage
(function() {
    const data = JSON.parse(localStorage.getItem('deepCompanyProfile') || '{}');
    if (!data || !data.company) {
        document.body.innerHTML = '<p>Impossible de charger la fiche entreprise.</p>';
        return;
    }
    // Affichage des infos principales (toujours affiché)
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
    // Affichage de la section concernée uniquement
    const container = document.querySelector('.container');
    // Supprime toutes les autres sections sauf l'info principale
    Array.from(container.children).forEach(child => {
        if (child.id !== 'fiche-company-name' && child.id !== 'fiche-company-info') {
            if (child.tagName !== 'H1' && child.tagName !== 'DIV') child.remove();
            if (child.className && !child.className.includes('info-list')) child.remove();
        }
    });
    // Ajout de la section spécifique selon le mode
    if (data.mode === 'news' && Array.isArray(data.news)) {
        const section = document.createElement('div');
        section.className = 'section card';
        section.innerHTML = `<h2>Actualités récentes</h2>` +
            (data.news.length > 0 ? `<ul class="news-list">${data.news.map(a => `<li><a href="${a.url}" class="clickable-link" target="_blank">${a.title}</a> <span style='color:#888;font-size:0.95em;'>(${a.source}, ${a.date ? a.date.slice(0,10) : ''})</span><br><span style='font-size:0.97em;'>${a.description || 'Aucune description disponible.'}</span></li>`).join('')}</ul>` : '<p>Aucune actualité trouvée.</p>');
        container.appendChild(section);
    }
    if (data.mode === 'linkedin' && data.linkedin) {
        const section = document.createElement('div');
        section.className = 'section card';
        let html = '<h2>Informations LinkedIn</h2>';
        // Accueil
        if (data.linkedin.info && (data.linkedin.info.name || data.linkedin.info.description)) {
            if (data.linkedin.info.name) {
                html += `<p style='font-weight:bold;'>${data.linkedin.info.name}</p>`;
            }
            if (data.linkedin.info.description) {
                let clean = data.linkedin.info.description.replace(/&#39;/g, "'").replace(/&amp;/g, "&");
                clean = clean.split(/\.|\n|\r/).filter(x => x.trim()).map(x => `<p>${x.trim()}</p>`).join('');
                html += clean;
            }
        }
        // About
        if (data.linkedin.about && (data.linkedin.about.overview || data.linkedin.about.specialties)) {
            html += `<h3>À propos</h3>`;
            if (data.linkedin.about.overview) html += `<p>${data.linkedin.about.overview}</p>`;
            if (data.linkedin.about.specialties) html += `<p><strong>Spécialités :</strong> ${data.linkedin.about.specialties}</p>`;
        }
        // Posts
        if (Array.isArray(data.linkedin.posts) && data.linkedin.posts.length > 0) {
            html += `<h3>Derniers posts LinkedIn</h3><ul>${data.linkedin.posts.map(p => `<li>${p}</li>`).join('')}</ul>`;
        }
        // Jobs
        if (Array.isArray(data.linkedin.jobs) && data.linkedin.jobs.length > 0) {
            html += `<h3>Offres d'emploi LinkedIn</h3><ul>${data.linkedin.jobs.map(j => `<li>${j}</li>`).join('')}</ul>`;
        }
        // People
        if (Array.isArray(data.linkedin.people) && data.linkedin.people.length > 0) {
            html += `<h3>Collaborateurs LinkedIn</h3><ul>${data.linkedin.people.map(p => `<li>${p}</li>`).join('')}</ul>`;
        }
        if (html === '<h2>Informations LinkedIn</h2>') html += '<p>Aucune information LinkedIn trouvée.</p>';
        section.innerHTML = html;
        container.appendChild(section);
    }
    if (data.mode === 'site' && data.site) {
        const section = document.createElement('div');
        section.className = 'section card';
        let html = `<h2>Résumé du site web</h2>`;
        if (data.site.title) html += `<strong>Titre :</strong> ${data.site.title}<br>`;
        if (data.site.description) html += `<strong>Description :</strong> ${data.site.description}<br>`;
        if (data.site.h1) html += `<strong>H1 principal :</strong> ${data.site.h1}<br>`;
        if (Array.isArray(data.site.h2) && data.site.h2.length > 0) {
            html += `<strong>Sous-titres :</strong><ul>${data.site.h2.map(h2 => `<li>${h2}</li>`).join('')}</ul>`;
        }
        if (Array.isArray(data.site.paragraphs) && data.site.paragraphs.length > 0) {
            html += `<strong>Paragraphes clés :</strong>${data.site.paragraphs.map(p => `<p>${p}</p>`).join('')}`;
        }
        if (html === '<h2>Résumé du site web</h2>') html += '<p>Aucune information extraite du site web.</p>';
        section.innerHTML = html;
        container.appendChild(section);
    }
})();
