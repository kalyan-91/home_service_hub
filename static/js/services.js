let all = [];
let category = "";

const grid = document.getElementById("svc-grid");
const chips = document.getElementById("svc-chips");
const search = document.getElementById("svc-search");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function getId(s)    { return s.service_id; }
function getName(s)  { return s.name ?? "Service"; }
function getCat(s)   { return s.category ?? ""; }
function getPrice(s) { return s.price_range ?? null; }

function renderChips() {
  const cats = [...new Set(all.map(getCat).filter(Boolean))];
  chips.innerHTML = "";
  if (!cats.length) return;
  ["", ...cats].forEach(c => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "svc-chip" + (c === category ? " active" : "");
    b.textContent = c || "All";
    b.onclick = () => { category = c; renderChips(); render(); };
    chips.appendChild(b);
  });
}

function render() {
  const q = search.value.trim().toLowerCase();
  const list = all.filter(s => {
    const text = (getName(s) + " " + (s.description ?? "") + " " + getCat(s)).toLowerCase();
    return (!category || getCat(s) === category) && (!q || text.includes(q));
  });

  if (!list.length) {
    grid.innerHTML = '<p class="svc-msg">No services found.</p>';
    return;
  }

  grid.innerHTML = list.map(s => {
    const id = getId(s);
    const price = getPrice(s);
    return `
      <article class="svc-card">
        <h3>${esc(getName(s))}</h3>
        <p>${esc(s.description ?? "")}</p>
        ${price ? `<div class="svc-price">${esc(price)}</div>` : ""}
        ${s.estimated_duration ? `<div class="svc-msg">⏱ ${esc(s.estimated_duration)}</div>` : ""}
        <div class="svc-actions">
          <a class="book" href="/bookings/new?service_id=${encodeURIComponent(id)}">Book</a>
          <a class="more" href="/services/${encodeURIComponent(id)}">Details</a>
        </div>
      </article>`;
  }).join("");
}

search.addEventListener("input", render);

fetch("/api/services")
  .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(data => {
    all = Array.isArray(data) ? data : (data.services ?? data.data ?? []);
    renderChips();
    render();
  })
  .catch(err => {
    grid.innerHTML = '<p class="svc-msg">Could not load services (' + esc(err.message) + ').</p>';
  });
