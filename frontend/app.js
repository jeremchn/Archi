document.getElementById('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const identifiant = document.getElementById('identifiant').value;
  const motdepasse = document.getElementById('motdepasse').value;
  // Authentification
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant, motdepasse })
  });
  if (!res.ok) {
    alert('Identifiants incorrects');
    return;
  }
  // Récupération du profil
  localStorage.setItem('identifiant', identifiant); // Stocke l'identifiant pour les autres pages
  const profileRes = await fetch(`/api/profile/${identifiant}`);
  if (!profileRes.ok) {
    alert('Profil introuvable');
    return;
  }
  const profile = await profileRes.json();
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('profile').style.display = 'block';
  document.getElementById('company_name').textContent = profile.company_name;
  document.getElementById('logo').src = profile.logo_url;
  document.getElementById('description').textContent = profile.description;
  document.getElementById('data_url').href = profile.data_url;
};
