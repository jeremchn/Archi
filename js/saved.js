// Affiche le tableau de toutes les listes sauvegardées
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
    return searches;
}

function renderListsTable() {
    const listsTable = document.getElementById('listsTable');
    const listDetails = document.getElementById('listDetails');
    listDetails.innerHTML = '';
    const searches = loadSavedSearches();
    if (!searches.length) {
        listsTable.innerHTML = '<div style="color:#888;font-style:italic;">Aucune recherche sauvegardée.</div>';
        return;
    }
    let html = '<table><thead><tr><th>Nom</th><th>Nb entreprises</th><th>Date</th></tr></thead><tbody>';
    searches.forEach((s, idx) => {
        html += `<tr data-idx='${idx}'><td>${s.name || 'Sans nom'}</td><td>${s.data.length}</td><td>${s.date || ''}</td></tr>`;
    });
    html += '</tbody></table>';
    listsTable.innerHTML = html;
    // Ajoute le click sur chaque ligne
    listsTable.querySelectorAll('tr[data-idx]').forEach(tr => {
        tr.onclick = function() {
            const idx = parseInt(this.getAttribute('data-idx'));
            showListDetails(idx);
        };
    });
}

function showListDetails(idx) {
    const searches = loadSavedSearches();
    if (!searches[idx]) return;
    const data = searches[idx].data;
    let html = `<h3>${searches[idx].name} (${data.length} entreprises)</h3>`;
    if (!data.length) {
        html += '<div style="color:#888;">Aucune entreprise dans cette liste.</div>';
    } else {
        html += '<div style="overflow-x:auto;"><table style="font-size:0.95em;width:100%;margin-top:1em;"><thead><tr>';
        html += '<th>Company Name</th><th>Domain</th><th>LinkedIn</th><th>Industry</th><th>Location</th><th>Headcount</th><th>Description</th><th>Contacts</th></tr></thead><tbody>';
        data.forEach(item => {
            html += `<tr><td>${item['Company Name']||''}</td><td>${item['Domain']||''}</td><td>${item['Linkedin']||''}</td><td>${item['Industry']||''}</td><td>${item['Location']||''}</td><td>${item['Headcount']||''}</td><td>${item['Description']||''}</td><td>${item['contacts']||0}</td></tr>`;
        });
        html += '</tbody></table></div>';
    }
    document.getElementById('listDetails').innerHTML = html;
}

// Redirection si non connecté
if (!localStorage.getItem('email')) {
    window.location.href = 'auth.html';
}

renderListsTable();
