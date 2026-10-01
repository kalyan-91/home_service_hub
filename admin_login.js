/* Admin login – posts to your auth route and sends the admin to the dashboard */
(function () {
  // CHANGE THIS to the login route in routes/auth.py if it differs.
  // The page sends JSON: { "email": "...", "password": "..." }
  const LOGIN_API = "/api/auth/login";
  const AFTER_LOGIN = "/admin/dashboard";

  const form = document.getElementById("admin-login-form");
  const email = document.getElementById("al-email");
  const password = document.getElementById("al-password");
  const errorBox = document.getElementById("al-error");
  const submit = document.getElementById("al-submit");
  const toggle = document.getElementById("al-toggle");

  function showError(message, field) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    [email, password].forEach((el) => el.removeAttribute("aria-invalid"));
    if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
  }

  function clearError() {
    errorBox.hidden = true;
    [email, password].forEach((el) => el.removeAttribute("aria-invalid"));
  }

  toggle.addEventListener("click", () => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    toggle.textContent = show ? "Hide" : "Show";
    toggle.setAttribute("aria-pressed", String(show));
    toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    clearError();

    const emailValue = email.value.trim();
    if (!emailValue) return showError("Enter your email address.", email);
    if (!password.value) return showError("Enter your password.", password);

    submit.disabled = true;
    submit.textContent = "Signing in…";
    try {
      const res = await fetch(LOGIN_API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, password: password.value }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return showError(data.error || data.message || "Sign in failed. Check your email and password.", password);
      }

      // If the auth route returns the role, make sure this really is an admin.
      const role = data.role || (data.user && data.user.role);
      if (role && role !== "admin") {
        return showError("This account is not an administrator account.", email);
      }
      window.location.href = AFTER_LOGIN;
    } catch (err) {
      showError("Could not reach the server. Try again in a moment.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  });
})();
