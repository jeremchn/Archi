document.getElementById('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  let email = document.getElementById('identifiant').value.trim().toLowerCase();
  const password = document.getElementById('motdepasse').value;
  const loginBtn = document.querySelector('button[type="submit"]');
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border:2px solid #e2e8f0;border-top:2px solid #1a365d;border-radius:50%;animation:spin 1s linear infinite;vertical-align:middle;"></span> Connexion...';
  // Authentification
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Login';
    showMsg('Identifiants incorrects', 'error');
    return;
  }
  // Stocke l'email pour la session
  localStorage.setItem('email', email);
  loginBtn.innerHTML = 'Connexion réussie';
  showMsg('Connexion réussie !', 'success');
  setTimeout(() => { window.location.href = '/index.html'; }, 900);
};

// Ajoute une fonction de feedback visuel
function showMsg(msg, type = 'success') {
  let el = document.getElementById('frontend-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'frontend-msg';
    el.style.margin = '1em 0';
    el.style.padding = '1em';
    el.style.borderRadius = '8px';
    el.style.fontSize = '1.08em';
    el.style.textAlign = 'center';
    el.style.transition = 'opacity 0.3s';
    document.querySelector('.auth-container')?.prepend(el);
  }
  el.style.background = type === 'error' ? '#ffeaea' : '#eafaf1';
  el.style.color = type === 'error' ? '#e74c3c' : '#27ae60';
  el.style.border = type === 'error' ? '1px solid #f5c6cb' : '1px solid #b7eacb';
  el.innerHTML = msg;
  el.style.opacity = 1;
  setTimeout(() => { el.style.opacity = 0; }, 3000);
}
