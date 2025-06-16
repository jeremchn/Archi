const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const switchLink = document.getElementById('switch-link');
const formTitle = document.getElementById('form-title');
const msg = document.getElementById('msg');

switchLink.addEventListener('click', () => {
    if (loginForm.style.display !== 'none') {
        loginForm.style.display = 'none';
        signupForm.style.display = 'flex';
        formTitle.textContent = 'Sign Up';
        switchLink.textContent = 'Already have an account? Login';
        msg.innerHTML = '';
    } else {
        loginForm.style.display = 'flex';
        signupForm.style.display = 'none';
        formTitle.textContent = 'Login';
        switchLink.textContent = 'No account? Sign up';
        msg.innerHTML = '';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            msg.innerHTML = '<div class="success">Login successful! Redirecting...</div>';
            setTimeout(() => { window.location.href = '/index.html'; }, 1000);
        } else {
            msg.innerHTML = `<div class="error">${data.error || 'Login failed.'}</div>`;
        }
    } catch {
        msg.innerHTML = '<div class="error">Server error.</div>';
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    try {
        const res = await fetch('/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            msg.innerHTML = '<div class="success">Account created! You can now log in.</div>';
            setTimeout(() => {
                loginForm.style.display = 'flex';
                signupForm.style.display = 'none';
                formTitle.textContent = 'Login';
                switchLink.textContent = 'No account? Sign up';
                msg.innerHTML = '';
            }, 1200);
        } else {
            msg.innerHTML = `<div class="error">${data.error || 'Signup failed.'}</div>`;
        }
    } catch {
        msg.innerHTML = '<div class="error">Server error.</div>';
    }
});
