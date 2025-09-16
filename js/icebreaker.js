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
            console.log('Contacts parsés depuis le fichier:', contacts);
            contacts.forEach((c, i) => {
                console.log(`Contact ${i}:`, c, 'linkedin_url:', c.linkedin_url);
                console.log(`Clés du contact ${i}:`, Object.keys(c));
            });
            enrichContacts(contacts);
        };
        reader.onerror = function () {
            showMsg('Erreur de lecture du fichier.', 'error');
        };
        reader.readAsArrayBuffer(file);
    }

    function enrichContacts(contacts) {
        showMsg('Enrichissement des contacts en cours...');
        // On ne garde que linkedin_url pour chaque contact
        const minimalContacts = contacts.map(c => ({ linkedin_url: c.linkedin_url }));
        console.log('Envoi des contacts à /api/icebreaker:', minimalContacts);
        const payload = { contacts: minimalContacts };
        console.log('Payload envoyé à /api/icebreaker:', JSON.stringify(payload, null, 2));
        (async () => {
            try {
                const response = await fetch('/api/icebreaker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                console.log('Réponse brute:', response);
                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    console.error('Erreur parsing JSON:', e);
                    showMsg('Erreur parsing JSON: ' + e.message, 'error');
                    return;
                }
                console.log('Réponse JSON:', data);
                if (!response.ok) {
                    showMsg('Erreur backend: ' + (data && data.error ? data.error : JSON.stringify(data)), 'error');
                    return;
                }
                if (!data || !Array.isArray(data.contacts) || !data.contacts.length) {
                    showMsg('Erreur lors de l\'enrichissement des contacts ou réponse trop lente.', 'error');
                    return;
                }
                enrichedData = data.contacts;
                showMsg('Contacts enrichis avec succès !', 'success');
                downloadBtn.style.display = 'inline-block';
            } catch (err) {
                console.error('Erreur lors de la requête /api/icebreaker :', err);
                showMsg('Erreur serveur lors de l\'enrichissement : ' + (err && err.message ? err.message : JSON.stringify(err)), 'error');
            }
        })();
    }

    downloadBtn.addEventListener('click', function () {
        if (!enrichedData) return;
        const ws = XLSX.utils.json_to_sheet(enrichedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Enrichi');
        XLSX.writeFile(wb, 'contacts_enrichis.xlsx');
    });
});
