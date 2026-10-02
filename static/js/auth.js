/*
 * static/js/auth.js — shared logic for templates/auth/customer_login.html
 * and templates/auth/technician_login.html. Each page sets two globals
 * before loading this file:
 *   AUTH_ROLE        'customer' | 'technician'
 *   AUTH_AFTER_LOGIN  where to send the user once logged in
 *
 * Backend (routes/auth.py):
 *   POST /api/auth/register/customer    {name, email, phone, password}
 *   POST /api/auth/register/technician  {name, email, phone, password, service_area}
 *   POST /api/auth/login                {email, password} -> {user_id, name, role}
 *
 * IMPORTANT: /api/auth/login is shared across all three roles and returns
 * whichever role is on file for that email — it does not know which login
 * page the request came from. So after a successful login, this file checks
 * that the returned role matches AUTH_ROLE and logs the user back out if it
 * doesn't (e.g. a technician trying the customer login page), rather than
 * silently sending them to the wrong dashboard.
 *
 * Uses the shared helper from static/js/api.js: apiPost(url, body).
 * ASSUMPTION: it returns parsed JSON and throws an Error with a readable
 * message when the request fails.
 */

const ROLE_LABEL = AUTH_ROLE === 'technician' ? 'technician' : 'customer';

const $ = (id) => document.getElementById(id);

function showMessage(type, text) {
  const box = $('auth-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}
function clearMessage() {
  $('auth-message').hidden = true;
}

/* ---------- toggle between login and register ---------- */
let mode = 'login';

$('toggle-mode').addEventListener('click', () => {
  mode = mode === 'login' ? 'register' : 'login';
  clearMessage();
  $('login-form').hidden = mode !== 'login';
  $('register-form').hidden = mode !== 'register';
  $('form-heading').textContent = mode === 'login'
    ? `${capitalize(ROLE_LABEL)} login`
    : `Create a ${ROLE_LABEL} account`;
  $('toggle-mode').textContent = mode === 'login'
    ? 'New here? Create an account'
    : 'Already have an account? Log in';
});

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/* ---------- login ---------- */
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();
  const button = $('btn-login');
  button.disabled = true;
  button.textContent = 'Logging in…';

  try {
    const result = await apiPost('/api/auth/login', { // api.js
      email: $('login-email').value.trim(),
      password: $('login-password').value,
    });

    if (result.role !== AUTH_ROLE) {
      // The account exists but is the wrong role for this page — log back out.
      try { await apiPost('/api/auth/logout', {}); } catch (e) { /* ignore */ }
      showMessage('error', `That account is registered as ${result.role}, not ${ROLE_LABEL}. Use the ${result.role} login page instead.`);
      button.disabled = false;
      button.textContent = 'Log in';
      return;
    }

    showMessage('success', 'Logged in. Redirecting…');
    window.location.href = AUTH_AFTER_LOGIN;
  } catch (err) {
    showMessage('error', err.message || 'Could not log in. Check your email and password.');
    button.disabled = false;
    button.textContent = 'Log in';
  }
});

/* ---------- register ---------- */
$('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();
  const button = $('btn-register');
  button.disabled = true;
  button.textContent = 'Creating account…';

  const body = {
    name: $('reg-name').value.trim(),
    email: $('reg-email').value.trim(),
    phone: $('reg-phone').value.trim(),
    password: $('reg-password').value,
  };
  if (AUTH_ROLE === 'technician') {
    body.service_area = $('reg-area').value.trim();
  }

  try {
    await apiPost(`/api/auth/register/${AUTH_ROLE}`, body); // api.js
    // Registration doesn't log the user in — log in right after with the same details.
    const result = await apiPost('/api/auth/login', { email: body.email, password: body.password }); // api.js
    showMessage('success', 'Account created. Redirecting…');
    window.location.href = AUTH_AFTER_LOGIN;
  } catch (err) {
    showMessage('error', err.message || 'Could not create the account. Try again.');
    button.disabled = false;
    button.textContent = 'Create account';
  }
});
