// Affiche le tableau de toutes les listes sauvegardées
function getSavedSearchesKey() {
    const email = localStorage.getItem('mail') || '';
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
        listsTable.innerHTML = '<div style="color:#888;font-style:italic;">No saved searches.</div>';
        return;
    }
    let html = '<table><thead><tr><th>Name</th><th>Companies</th><th>Date</th><th>View</th><th>Export</th><th>Delete</th></tr></thead><tbody>';
    searches.forEach((s, idx) => {
        html += `<tr data-idx='${idx}'>
            <td>${s.name || 'No name'}</td>
            <td>${s.data.length}</td>
            <td>${s.date || ''}</td>
            <td><button class='btn btn-gray' data-action='voir' data-idx='${idx}'>View</button></td>
            <td><button class='btn btn-gray' data-action='export' data-idx='${idx}'>CSV</button></td>
            <td><button class='btn btn-gray' data-action='delete' data-idx='${idx}'>🗑️</button></td>
        </tr>`;
    });
    html += '</tbody></table>';
    listsTable.innerHTML = html;
    // Ajoute les actions
    listsTable.querySelectorAll('button[data-action]').forEach(btn => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const action = btn.getAttribute('data-action');
        if (action === 'voir') btn.onclick = () => showListDetails(idx);
        if (action === 'delete') btn.onclick = () => deleteList(idx);
        if (action === 'export') btn.onclick = () => exportListCSV(idx);
    });
}

function showListDetails(idx) {
    const searches = loadSavedSearches();
    if (!searches[idx]) return;
    const data = searches[idx].data;
    let html = `<h3>${searches[idx].name} (${data.length} companies)</h3>`;
    if (!data.length) {
        html += '<div style="color:#888;">No companies in this list.</div>';
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

function deleteList(idx) {
    if (!confirm('Supprimer cette liste ?')) return;
    const key = getSavedSearchesKey();
    let searches = loadSavedSearches();
    searches.splice(idx, 1);
    localStorage.setItem(key, JSON.stringify(searches));
    renderListsTable();
    document.getElementById('listDetails').innerHTML = '';
}

function exportListCSV(idx) {
    const searches = loadSavedSearches();
    if (!searches[idx]) return;
    const data = searches[idx].data;
    if (!data.length) return;
    // Génère le CSV
    const headers = ['Company Name','Domain','Linkedin','Industry','Location','Headcount','Description','contacts'];
    const csvRows = [headers.join(',')];
    data.forEach(item => {
        const row = headers.map(h => '"' + String(item[h]||'').replace(/"/g,'""') + '"').join(',');
        csvRows.push(row);
    });
    const csvContent = csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (searches[idx].name || 'liste') + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

// Redirection si non connecté
if (!localStorage.getItem('mail')) {
    window.location.href = 'auth.html';
}

renderListsTable();
