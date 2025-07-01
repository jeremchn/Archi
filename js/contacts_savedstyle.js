// Affiche le tableau de toutes les listes de leads (même UX que saved.js, mais pour leadsLists)
function getLeadsLists() {
    return JSON.parse(localStorage.getItem('leadsLists') || '{}');
}

function renderListsTable() {
    const listsTable = document.getElementById('listsTable');
    const listDetails = document.getElementById('listDetails');
    listDetails.innerHTML = '';
    const leadsLists = getLeadsLists();
    const names = Object.keys(leadsLists);
    if (!names.length) {
        listsTable.innerHTML = '<div style="color:#888;font-style:italic;">Aucune liste de leads.</div>';
        return;
    }
    let html = '<table><thead><tr><th>Nom</th><th>Nb leads</th><th>Voir</th><th>Exporter</th><th>Supprimer</th></tr></thead><tbody>';
    names.forEach((name, idx) => {
        const leads = leadsLists[name];
        html += `<tr data-name='${name}'>
            <td>${name}</td>
            <td>${leads.length}</td>
            <td><button class='btn btn-gray' data-action='voir' data-name='${name}'>Voir</button></td>
            <td><button class='btn btn-gray' data-action='export' data-name='${name}'>CSV</button></td>
            <td><button class='btn btn-gray' data-action='delete' data-name='${name}'>🗑️</button></td>
        </tr>`;
    });
    html += '</tbody></table>';
    listsTable.innerHTML = html;
    // Actions
    listsTable.querySelectorAll('button[data-action]').forEach(btn => {
        const name = btn.getAttribute('data-name');
        const action = btn.getAttribute('data-action');
        if (action === 'voir') btn.onclick = () => showListDetails(name);
        if (action === 'delete') btn.onclick = () => deleteLeadsList(name);
        if (action === 'export') btn.onclick = () => exportLeadsCSV(name);
    });
}

function showListDetails(name) {
    const leadsLists = getLeadsLists();
    const leads = leadsLists[name] || [];
    const listDetails = document.getElementById('listDetails');
    let html = `<h3>${name} (${leads.length} leads)</h3>`;
    if (!leads.length) {
        html += '<div style="color:#888;">Aucun lead dans cette liste.</div>';
    } else {
        html += '<div style="overflow-x:auto;"><table style="font-size:0.95em;width:100%;margin-top:1em;"><thead><tr>';
        html += '<th>Email</th><th>First Name</th><th>Last Name</th><th>Position</th><th>Company</th><th>LinkedIn</th><th>Ice breaker</th><th>Supprimer</th></tr></thead><tbody>';
        leads.forEach((l, idx) => {
            html += `<tr><td>${l.email||''}</td><td>${l.first_name||''}</td><td>${l.last_name||''}</td><td>${l.position||''}</td><td>${l.company||''}</td><td>${l.linkedin_url?`<a href='${l.linkedin_url}' target='_blank'>LinkedIn</a>`:''}</td>`;
            html += `<td>`;
            if (l.icebreaker) {
                html += l.icebreaker;
            } else if (l.linkedin_url) {
                html += `<button class='btn-generate-ice' data-list='${name}' data-idx='${idx}'>Generate</button>`;
            } else {
                html += '';
            }
            html += `</td><td><button class='btn btn-delete-contact' data-list='${name}' data-idx='${idx}' style='background:#e74c3c;'>Delete</button></td></tr>`;
        });
        html += '</tbody></table></div>';
    }
    listDetails.innerHTML = html;
    // Delete contact
    listDetails.querySelectorAll('.btn-delete-contact').forEach(btn => {
        btn.onclick = function() {
            const idx = parseInt(btn.getAttribute('data-idx'));
            const list = btn.getAttribute('data-list');
            let leadsLists = getLeadsLists();
            leadsLists[list].splice(idx, 1);
            localStorage.setItem('leadsLists', JSON.stringify(leadsLists));
            showListDetails(list);
            renderListsTable();
        };
    });
    // Generate icebreaker
    listDetails.querySelectorAll('.btn-generate-ice').forEach(btn => {
        btn.onclick = async function() {
            const idx = parseInt(btn.getAttribute('data-idx'));
            const list = btn.getAttribute('data-list');
            let leadsLists = getLeadsLists();
            let contact = leadsLists[list][idx];
            btn.disabled = true;
            btn.textContent = 'Generating...';
            try {
                const res = await fetch('/api/icebreaker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contact })
                });
                const data = await res.json();
                if (data.success) {
                    contact.icebreaker = data.icebreaker;
                    leadsLists[list][idx] = contact;
                    localStorage.setItem('leadsLists', JSON.stringify(leadsLists));
                    showListDetails(list);
                } else {
                    btn.textContent = 'Error';
                }
            } catch {
                btn.textContent = 'Error';
            }
        };
    });
}

function deleteLeadsList(name) {
    if (!confirm('Supprimer la liste "' + name + '" ?')) return;
    const leadsLists = getLeadsLists();
    delete leadsLists[name];
    localStorage.setItem('leadsLists', JSON.stringify(leadsLists));
    renderListsTable();
    document.getElementById('listDetails').innerHTML = '';
}

function exportLeadsCSV(name) {
    const leadsLists = getLeadsLists();
    const leads = leadsLists[name] || [];
    if (!leads.length) return alert('Liste vide');
    const csv = [Object.keys(leads[0]).join(',')].concat(leads.map(l => Object.values(l).map(v => '"'+(v||'').toString().replace(/"/g,'""')+'"').join(','))).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

document.addEventListener('DOMContentLoaded', renderListsTable);
