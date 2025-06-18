document.getElementById('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const mail = document.getElementById('identifiant').value;
  const password = document.getElementById('motdepasse').value;
  // Authentification
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mail, password })
  });
  if (!res.ok) {
    alert('Identifiants incorrects');
    return;
  }
  // Stocke le mail pour la session
  localStorage.setItem('mail', mail);
  // Redirige toujours vers index.html après connexion
  window.location.href = '/index.html';
};
