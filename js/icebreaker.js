// js/icebreaker.js
// Frontend logic for Ice Breaker page
// Handles file import, parsing, display, API call, and download

// DOM elements
const dropzone = document.getElementById('dropzone');
const fileInfo = document.getElementById('file-info');
const resultTable = document.getElementById('result-table');
const downloadBtn = document.getElementById('download-btn');

let contacts = [];
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
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.csv,.xlsx';
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
        if (fileName.endsWith('.xlsx')) {
            workbook = XLSX.read(data, {type: 'binary'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(sheet);
        } else {
            rows = XLSX.utils.sheet_to_json(XLSX.read(data, {type: 'binary'}).Sheets['Sheet1'] || XLSX.read(data, {type: 'binary'}).Sheets[Object.keys(XLSX.read(data, {type: 'binary'}).Sheets)[0]]);
        }
        contacts = rows;
        displayContacts(contacts);
        callIceBreakerAPI(contacts);
    };
    reader.readAsBinaryString(file);
}

function displayContacts(list) {
    if (!resultTable) return;
    resultTable.innerHTML = '';
    if (!list.length) return;
    // Table header
    const header = document.createElement('tr');
    Object.keys(list[0]).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        header.appendChild(th);
    });
    const th = document.createElement('th');
    th.textContent = 'Ice Breaker';
    header.appendChild(th);
    resultTable.appendChild(header);
    // Table rows
    list.forEach((contact, idx) => {
        const tr = document.createElement('tr');
        Object.values(contact).forEach(val => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        });
        const td = document.createElement('td');
        td.textContent = contact.icebreaker || '';
        tr.appendChild(td);
        resultTable.appendChild(tr);
    });
}

function callIceBreakerAPI(list) {
    fetch('/api/icebreaker', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({contacts: list})
    })
    .then(res => res.json())
    .then(data => {
        enrichedContacts = data.contacts;
        displayContacts(enrichedContacts);
        downloadBtn.style.display = 'inline-block';
    })
    .catch(() => {
        alert('Erreur lors de la génération des ice breakers.');
    });
}

downloadBtn.addEventListener('click', () => {
    if (!enrichedContacts.length) return;
    const ws = XLSX.utils.json_to_sheet(enrichedContacts);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'contacts_icebreakers.xlsx');
});
