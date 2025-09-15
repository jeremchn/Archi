// js/icebreaker.js
// Frontend logic for Ice Breaker page
// Handles file import, parsing, display, API call, and download

// DOM elements
const dropzone = document.getElementById('drop-zone');
const fileInfo = document.getElementById('file-info');
const resultTableContainer = document.getElementById('result-table-container');
const enrichBtn = document.createElement('button');
enrichBtn.className = 'btn';
enrichBtn.id = 'enrich-btn';
enrichBtn.textContent = 'Enrichir';
enrichBtn.style.display = 'none';
const loadingBtn = document.createElement('button');
loadingBtn.className = 'btn';
loadingBtn.id = 'loading-btn';
loadingBtn.textContent = 'Chargement...';
loadingBtn.style.display = 'none';
const downloadBtn = document.getElementById('download-btn');
let resultTable = null;

let contacts = [];
let originalContacts = [];
let enrichedContacts = [];
let fileName = '';

// Drag & drop handler
if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });
}

// File input fallback
dropzone.addEventListener('click', () => fileInput.click());
const fileInput = document.getElementById('file-input');
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFile(file);
});

function handleFile(file) {
    if (!file) return;
    fileName = file.name;
    fileInfo.textContent = `Fichier importé : ${fileName}`;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = e.target.result;
        let workbook, rows;
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
            workbook = XLSX.read(data, {type: 'binary'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(sheet);
        } else {
            showMsg('Format de fichier non supporté. Utilisez .csv ou .xlsx', 'danger');
            return;
        }
        // Filtrer et normaliser les colonnes
        contacts = rows.map(row => ({
            email: row.email || row.Email || '',
            first_name: row.first_name || row.FirstName || row.firstname || '',
            last_name: row.last_name || row.LastName || row.lastname || '',
            position: row.position || row.Position || '',
            company: row.company || row.Company || '',
            linkedin_url: row.linkedin_url || row.Linkedin || row.linkedin || '',
            icebreaker: row.icebreaker || ''
        }));
        // Vérifie la validité des colonnes
        const valid = contacts.every(c => c.email && c.first_name && c.last_name && c.position && c.company && c.linkedin_url !== undefined && c.icebreaker !== undefined);
        if (!valid) {
            showMsg('Le fichier doit contenir les colonnes : email, first_name, last_name, position, company, linkedin_url, icebreaker.', 'danger');
            contacts = [];
            originalContacts = [];
            displayContacts([]);
            enrichBtn.style.display = 'none';
            downloadBtn.style.display = 'none';
            loadingBtn.style.display = 'none';
            return;
        }
        originalContacts = JSON.parse(JSON.stringify(contacts));
        displayContacts(contacts);
        enrichBtn.style.display = 'inline-block';
        downloadBtn.style.display = 'none';
        loadingBtn.style.display = 'none';
        if (!document.getElementById('enrich-btn')) {
            resultTableContainer.parentNode.insertBefore(enrichBtn, resultTableContainer.nextSibling);
        }
        if (!document.getElementById('loading-btn')) {
            resultTableContainer.parentNode.insertBefore(loadingBtn, enrichBtn.nextSibling);
        }
    };
    reader.readAsBinaryString(file);

function showMsg(msg, type) {
    const msgDiv = document.getElementById('msg');
    msgDiv.textContent = msg;
    msgDiv.className = 'msg visible ' + (type === 'danger' ? 'danger' : '');
    setTimeout(() => {
        msgDiv.className = 'msg';
        msgDiv.textContent = '';
    }, 4000);
}
}

function displayContacts(list) {
    if (!resultTableContainer) return;
    resultTableContainer.innerHTML = '';
    if (!list.length) return;
    resultTable = document.createElement('table');
    resultTable.className = 'result-table';
    // Table header
    const header = document.createElement('tr');
    ['email','first_name','last_name','position','company','linkedin_url','icebreaker'].forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        header.appendChild(th);
    });
    resultTable.appendChild(header);
    // Table rows
    list.forEach((contact, idx) => {
        const tr = document.createElement('tr');
        ['email','first_name','last_name','position','company','linkedin_url','icebreaker'].forEach(key => {
            const td = document.createElement('td');
            td.textContent = contact[key] || '';
            tr.appendChild(td);
        });
        resultTable.appendChild(tr);
    });
    resultTableContainer.appendChild(resultTable);
}

function callIceBreakerAPI(list) {
    loadingBtn.style.display = 'inline-block';
    enrichBtn.style.display = 'none';
    fetch('/api/icebreaker', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({contacts: contacts})
    })
    .then(async res => {
        if (!res.ok) {
            let errMsg = 'Erreur lors de la génération des ice breakers.';
            try {
                const err = await res.json();
                if (err && err.error) errMsg += ' ' + err.error;
            } catch {}
            showMsg(errMsg, 'danger');
            loadingBtn.style.display = 'none';
            enrichBtn.style.display = 'inline-block';
            return;
        }
        return res.json();
    })
    .then(data => {
        if (!data || !data.contacts) return;
        enrichedContacts = data.contacts;
        displayContacts(enrichedContacts);
        downloadBtn.style.display = 'inline-block';
        loadingBtn.style.display = 'none';
    })
    .catch(() => {
        showMsg('Erreur lors de la génération des ice breakers.', 'danger');
        loadingBtn.style.display = 'none';
        enrichBtn.style.display = 'inline-block';
    });
}

downloadBtn.addEventListener('click', () => {
    if (!enrichedContacts.length) return;
    const ws = XLSX.utils.json_to_sheet(enrichedContacts);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'contacts_icebreakers.xlsx');
});

enrichBtn.addEventListener('click', () => {
    callIceBreakerAPI(originalContacts);
});
