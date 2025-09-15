document.addEventListener('DOMContentLoaded', function () {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const msg = document.getElementById('msg');
    const downloadBtn = document.getElementById('download-btn');
    let enrichedData = null;

    function showMsg(text, type = 'info') {
        msg.textContent = text;
        msg.className = 'msg visible';
        msg.style.borderColor = type === 'error' ? '#d32f2f' : (type === 'success' ? '#27ae60' : '#3b4cca');
        msg.style.color = type === 'error' ? '#d32f2f' : (type === 'success' ? '#27ae60' : '#3b4cca');
    }
    function resetMsg() {
        msg.textContent = '';
        msg.className = 'msg';
    }

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        resetMsg();
        fileInfo.textContent = `Fichier sélectionné : ${file.name}`;
        showMsg('Traitement du fichier en cours...');
        const reader = new FileReader();
        reader.onload = function (evt) {
            let contacts = [];
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                contacts = XLSX.utils.sheet_to_json(sheet);
            } catch (err) {
                showMsg('Erreur lors de la lecture du fichier.', 'error');
                return;
            }
            if (!contacts.length) {
                showMsg('Aucun contact trouvé dans le fichier.', 'error');
                return;
            }
            enrichContacts(contacts);

        reader.onerror = function () {
            showMsg('Erreur de lecture du fichier.', 'error');
        };
        reader.readAsArrayBuffer(file);
    }

    function enrichContacts(contacts) {
        showMsg('Enrichissement des contacts en cours...');
        fetch('/api/icebreaker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts })
        })
            .then(res => res.json())
            .then(data => {
                if (!data || !Array.isArray(data) || !data.length) {
                    showMsg('Erreur lors de l\'enrichissement des contacts.', 'error');
                    return;
                }
                enrichedData = data;
                showMsg('Contacts enrichis avec succès !', 'success');
                downloadBtn.style.display = 'inline-block';
            })
            .catch(() => {
                showMsg('Erreur serveur lors de l\'enrichissement.', 'error');
            });
    }

    downloadBtn.addEventListener('click', function () {
        if (!enrichedData) return;
        const ws = XLSX.utils.json_to_sheet(enrichedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Enrichi');
        XLSX.writeFile(wb, 'contacts_enrichis.xlsx');
    });
    }});
