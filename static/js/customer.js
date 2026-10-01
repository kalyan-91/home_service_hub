/* Customer dashboard – talks to the /api/customer/* endpoints in customer_bp */
(function () {
  const API = "/api/customer";
  const LOGIN_URL = null; // set to your login page URL once one exists

  const state = { homes: [], selectedHomeId: null, appliances: [] };
  const $ = (id) => document.getElementById(id);

  // ---------- helpers ----------
  async function api(path, options = {}) {
    const res = await fetch(API + path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (res.status === 401) {
      if (LOGIN_URL) window.location.href = LOGIN_URL;
      throw new Error("Please log in as a customer first");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }

  function esc(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  let toastTimer;
  function toast(message, isError = false) {
    const el = $("cd-toast");
    el.textContent = message;
    el.classList.toggle("error", isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / 86400000);
  }

  function warrantyBadge(dateStr) {
    const days = daysUntil(dateStr);
    if (days === null) return '<span class="cd-sub">Not set</span>';
    const label = new Date(dateStr).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    if (days < 0) return `<span class="cd-badge cd-badge-bad">Expired ${esc(label)}</span>`;
    if (days <= 60) return `<span class="cd-badge cd-badge-warn">Ends ${esc(label)}</span>`;
    return `<span class="cd-badge cd-badge-ok">Until ${esc(label)}</span>`;
  }

  // ---------- loading ----------
  async function loadProfile() {
    try {
      const p = await api("/profile");
      const first = (p.name || "").split(" ")[0];
      $("cd-greeting").textContent = first ? `Welcome back, ${first}` : "Welcome back";
    } catch (_) { /* greeting stays generic */ }
  }

  async function loadDashboard() {
    const data = await api("/dashboard");
    state.homes = data.homes || [];
    $("stat-homes").textContent = state.homes.length;
    $("stat-appliances").textContent = data.appliance_count;
    const current = state.homes.find((h) => h.status === "current");
    $("stat-current").textContent = current ? `${current.city}` : "None set";
    $("cd-subtitle").textContent = state.homes.length
      ? "Here is what is happening with your homes."
      : "Add your first home to get started.";

    if (!state.homes.some((h) => h.home_id === state.selectedHomeId)) {
      state.selectedHomeId = (current || state.homes[0] || {}).home_id || null;
    }
    renderHomes();
    await loadAppliances();
  }

  async function loadAppliances() {
    const homeId = state.selectedHomeId;
    $("btn-add-appliance").disabled = !homeId;
    if (!homeId) {
      state.appliances = [];
      renderAppliances();
      updateWarrantyStat();
      return;
    }
    state.appliances = await api(`/homes/${homeId}/appliances`);
    renderAppliances();
    updateWarrantyStat();
  }

  function updateWarrantyStat() {
    const soon = state.appliances.filter((a) => {
      const d = daysUntil(a.warranty_expiry);
      return d !== null && d >= 0 && d <= 60;
    }).length;
    $("stat-warranty").textContent = soon;
  }

  // ---------- rendering ----------
  function renderHomes() {
    const list = $("home-list");
    $("homes-empty").hidden = state.homes.length > 0;
    list.innerHTML = state.homes.map((h) => {
      const selected = h.home_id === state.selectedHomeId ? " is-selected" : "";
      const isCurrent = h.status === "current";
      const place = [h.city, h.state, h.pincode].filter(Boolean).join(", ");
      return `
        <li class="cd-home${selected}" data-id="${h.home_id}" tabindex="0" role="button" aria-pressed="${!!selected}">
          <div class="cd-home-top">
            <div>
              <div class="cd-home-addr">${esc(h.address)}</div>
              <div class="cd-home-meta">${esc(place)} · ${esc(h.home_type || "owned")}</div>
            </div>
            <span class="cd-badge ${isCurrent ? "cd-badge-current" : "cd-badge-previous"}">${isCurrent ? "Current" : "Previous"}</span>
          </div>
          <div class="cd-home-actions">
            ${isCurrent ? "" : `<button class="cd-btn-link" data-action="set-current" type="button">Make current</button>`}
            <button class="cd-btn cd-btn-danger" data-action="delete-home" type="button">Delete</button>
          </div>
        </li>`;
    }).join("");

    const home = state.homes.find((h) => h.home_id === state.selectedHomeId);
    $("appliance-title").textContent = home ? `Appliances at ${home.address}` : "Appliances";
  }

  function renderAppliances() {
    const hasHome = !!state.selectedHomeId;
    const has = state.appliances.length > 0;
    $("appliance-table").hidden = !has;
    const empty = $("appliance-empty");
    empty.hidden = has;
    empty.textContent = hasHome
      ? "No appliances in this home yet. Add one to track its warranty and service history."
      : "Select a home to see its appliances.";

    $("appliance-body").innerHTML = state.appliances.map((a) => `
      <tr data-id="${a.appliance_id}">
        <td>${esc(a.name)}</td>
        <td>${esc(a.category)}</td>
        <td>${esc(a.brand || "—")}<span class="cd-sub">${esc(a.model || "")}</span></td>
        <td>${warrantyBadge(a.warranty_expiry)}</td>
        <td><button class="cd-btn cd-btn-danger" data-action="delete-appliance" type="button">Delete</button></td>
      </tr>`).join("");
  }

  // ---------- actions ----------
  async function selectHome(homeId) {
    state.selectedHomeId = homeId;
    renderHomes();
    try { await loadAppliances(); } catch (e) { toast(e.message, true); }
  }

  async function setCurrent(homeId) {
    try {
      await api(`/homes/${homeId}/set-current`, { method: "POST" });
      toast("Current home updated");
      await loadDashboard();
    } catch (e) { toast(e.message, true); }
  }

  async function deleteHome(homeId) {
    if (!confirm("Delete this home? This cannot be undone.")) return;
    try {
      await api(`/homes/${homeId}`, { method: "DELETE" });
      toast("Home deleted");
      await loadDashboard();
    } catch (e) { toast(e.message, true); } // 409 messages from the backend show here
  }

  async function deleteAppliance(applianceId) {
    if (!confirm("Delete this appliance?")) return;
    try {
      await api(`/appliances/${applianceId}`, { method: "DELETE" });
      toast("Appliance deleted");
      await loadDashboard();
    } catch (e) { toast(e.message, true); }
  }

  function formToObject(form) {
    const out = {};
    new FormData(form).forEach((v, k) => { if (String(v).trim() !== "") out[k] = String(v).trim(); });
    return out;
  }

  function bindDialog(dialogId, formId, submit) {
    const dlg = $(dialogId);
    const form = $(formId);
    form.addEventListener("submit", async (ev) => {
      if (ev.submitter && ev.submitter.value !== "save") return; // cancel just closes
      ev.preventDefault();
      if (!form.reportValidity()) return;
      try {
        await submit(formToObject(form));
        form.reset();
        dlg.close();
      } catch (e) { toast(e.message, true); }
    });
    return dlg;
  }

  const homeDialog = bindDialog("dlg-home", "form-home", async (body) => {
    const res = await api("/homes", { method: "POST", body });
    toast("Home added");
    state.selectedHomeId = res.home_id;
    await loadDashboard();
  });

  const applianceDialog = bindDialog("dlg-appliance", "form-appliance", async (body) => {
    await api(`/homes/${state.selectedHomeId}/appliances`, { method: "POST", body });
    toast("Appliance added");
    await loadDashboard();
  });

  // ---------- events ----------
  $("btn-add-home").addEventListener("click", () => homeDialog.showModal());
  $("btn-add-appliance").addEventListener("click", () => {
    if (state.selectedHomeId) applianceDialog.showModal();
  });

  $("home-list").addEventListener("click", (ev) => {
    const card = ev.target.closest(".cd-home");
    if (!card) return;
    const id = Number(card.dataset.id);
    const action = ev.target.closest("[data-action]");
    if (action && action.dataset.action === "set-current") return setCurrent(id);
    if (action && action.dataset.action === "delete-home") return deleteHome(id);
    selectHome(id);
  });

  $("home-list").addEventListener("keydown", (ev) => {
    if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList.contains("cd-home")) {
      ev.preventDefault();
      selectHome(Number(ev.target.dataset.id));
    }
  });

  $("appliance-body").addEventListener("click", (ev) => {
    const btn = ev.target.closest('[data-action="delete-appliance"]');
    if (btn) deleteAppliance(Number(btn.closest("tr").dataset.id));
  });

  // ---------- start ----------
  loadProfile();
  loadDashboard().catch((e) => toast(e.message, true));
})();
