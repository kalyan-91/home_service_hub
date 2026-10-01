/* Technician dashboard – uses the /api/technician/* endpoints in technician_bp */
(function () {
  const API = "/api/technician";
  const LOGIN_URL = "/login";
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const state = { profile: null, skills: [], slots: [] };
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
      window.location.href = LOGIN_URL;
      throw new Error("Please sign in as a technician");
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
    const el = $("td-toast");
    el.textContent = message;
    el.classList.toggle("error", isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  // MySQL TIME comes back as "9:00:00"; show it as "09:00"
  function fmtTime(value) {
    const m = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    return m ? m[1].padStart(2, "0") + ":" + m[2] : String(value || "");
  }

  function fmtDate(value) {
    const d = new Date(value);
    return isNaN(d) ? "–" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  // ---------- loading ----------
  async function loadAll() {
    const [profile, skills, slots] = await Promise.all([
      api("/profile"), api("/skills"), api("/availability"),
    ]);
    state.profile = profile;
    state.skills = skills || [];
    state.slots = slots || [];
    render();
  }

  // ---------- rendering ----------
  function render() {
    const p = state.profile;
    const first = (p.name || "").split(" ")[0];
    $("td-greeting").textContent = first ? `Welcome back, ${first}` : "Welcome back";

    const verified = String(p.verification_status || "").toLowerCase() === "verified";
    const badge = $("td-verify");
    badge.textContent = verified ? "Verified" : `${p.verification_status || "Pending"} verification`;
    badge.className = "td-badge " + (verified ? "td-badge-ok" : "td-badge-wait");
    $("td-notice").hidden = verified;

    $("p-name").textContent = p.name || "–";
    $("p-email").textContent = p.email || "–";
    $("p-phone").textContent = p.phone || "–";
    $("p-area").textContent = p.service_area || "–";
    $("p-since").textContent = p.registered_date ? fmtDate(p.registered_date) : "–";

    const years = state.skills.reduce((max, s) => Math.max(max, Number(s.years_experience) || 0), 0);
    $("stat-area").textContent = p.service_area || "Not set";
    $("stat-skills").textContent = state.skills.length;
    $("stat-slots").textContent = state.slots.length;
    $("stat-exp").textContent = years;

    renderSkills();
    renderWeek();
  }

  function renderSkills() {
    $("skills-empty").hidden = state.skills.length > 0;
    $("skill-list").innerHTML = state.skills.map((s) => {
      const y = Number(s.years_experience) || 0;
      return `<li class="td-skill" data-id="${s.skill_id}">
        <span>${esc(s.skill_category)} <small>${y} ${y === 1 ? "year" : "years"}</small></span>
        <button class="td-x" type="button" data-action="delete-skill" aria-label="Remove ${esc(s.skill_category)}">×</button>
      </li>`;
    }).join("");
  }

  function renderWeek() {
    $("slots-empty").hidden = state.slots.length > 0;
    const known = new Set(DAYS);
    const extra = [...new Set(state.slots.map((s) => s.day_of_week))].filter((d) => !known.has(d));
    const days = DAYS.concat(extra); // keeps any day names saved in a different format

    $("week").innerHTML = state.slots.length === 0 ? "" : days.map((day) => {
      const slots = state.slots
        .filter((s) => s.day_of_week === day)
        .sort((a, b) => fmtTime(a.start_time).localeCompare(fmtTime(b.start_time)));
      const body = slots.length
        ? slots.map((s) => {
            const on = s.available === true || s.available === 1 || s.available === "1";
            return `<div class="td-slot" data-id="${s.availability_id}">
              <span class="td-slot-info">${esc(fmtTime(s.start_time))} – ${esc(fmtTime(s.end_time))}
                ${on ? "" : '<span class="td-chip-off">Unavailable</span>'}</span>
              <button class="td-x" type="button" data-action="delete-slot" aria-label="Remove slot">×</button>
            </div>`;
          }).join("")
        : '<span class="td-day-none">No slots</span>';
      return `<div class="td-day"><h3>${esc(day)}</h3>${body}</div>`;
    }).join("");
  }

  // ---------- dialogs ----------
  function bindDialog(dialogId, formId, submit) {
    const dlg = $(dialogId);
    const form = $(formId);
    form.addEventListener("submit", async (ev) => {
      if (ev.submitter && ev.submitter.value !== "save") return; // Cancel just closes
      ev.preventDefault();
      if (!form.reportValidity()) return;
      try {
        await submit(new FormData(form));
        dlg.close();
      } catch (e) { toast(e.message, true); }
    });
    return dlg;
  }

  const profileDlg = bindDialog("dlg-profile", "form-profile", async (fd) => {
    await api("/profile", {
      method: "PUT",
      body: {
        name: fd.get("name").trim(),
        phone: fd.get("phone").trim(),
        service_area: fd.get("service_area").trim(),
      },
    });
    toast("Profile updated");
    await loadAll();
  });

  const skillDlg = bindDialog("dlg-skill", "form-skill", async (fd) => {
    await api("/skills", {
      method: "POST",
      body: {
        skill_category: fd.get("skill_category").trim(),
        years_experience: Number(fd.get("years_experience")) || 0,
      },
    });
    toast("Skill added");
    $("form-skill").reset();
    await loadAll();
  });

  const slotDlg = bindDialog("dlg-slot", "form-slot", async (fd) => {
    const start = fd.get("start_time");
    const end = fd.get("end_time");
    if (end <= start) throw new Error("The end time must be after the start time");
    await api("/availability", {
      method: "POST",
      body: {
        day_of_week: fd.get("day_of_week"),
        start_time: start,
        end_time: end,
        available: fd.get("available") === "on",
      },
    });
    toast("Time slot added");
    await loadAll();
  });

  $("btn-edit-profile").addEventListener("click", () => {
    const f = $("form-profile").elements;
    f.name.value = state.profile.name || "";
    f.phone.value = state.profile.phone || "";
    f.service_area.value = state.profile.service_area || "";
    profileDlg.showModal();
  });
  $("btn-add-skill").addEventListener("click", () => skillDlg.showModal());
  $("btn-add-slot").addEventListener("click", () => slotDlg.showModal());

  // ---------- deletes ----------
  $("skill-list").addEventListener("click", async (ev) => {
    if (!ev.target.closest('[data-action="delete-skill"]')) return;
    const id = ev.target.closest(".td-skill").dataset.id;
    if (!confirm("Remove this skill?")) return;
    try { await api(`/skills/${id}`, { method: "DELETE" }); toast("Skill removed"); await loadAll(); }
    catch (e) { toast(e.message, true); }
  });

  $("week").addEventListener("click", async (ev) => {
    if (!ev.target.closest('[data-action="delete-slot"]')) return;
    const id = ev.target.closest(".td-slot").dataset.id;
    if (!confirm("Remove this time slot?")) return;
    try { await api(`/availability/${id}`, { method: "DELETE" }); toast("Time slot removed"); await loadAll(); }
    catch (e) { toast(e.message, true); }
  });

  // ---------- sign out ----------
  $("td-signout").addEventListener("click", async (ev) => {
    ev.preventDefault();
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch (_) {}
    window.location.href = LOGIN_URL;
  });

  // ---------- start ----------
  loadAll().catch((e) => toast(e.message, true));
})();
