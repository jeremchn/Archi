document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const msg = document.getElementById('msg');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.innerHTML = '';
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        console.log('Valeurs envoyées:', { email, password }); // DEBUG
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('email', email);
                msg.innerHTML = '<div class="success">Login successful! Redirecting...</div>';
                setTimeout(() => { window.location.href = '/index.html'; }, 1000);
            } else {
                msg.innerHTML = `<div class="error">${data.error || 'Login failed.'}</div>`;
            }
        } catch {
            msg.innerHTML = '<div class="error">Server error.</div>';
        }
    });
});
