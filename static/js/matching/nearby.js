/*
 * NOTE: reuses the same matching logic Member 3 already built in
 * services/technician_matching.py (find_nearby_technicians), currently only
 * wired up under POST /api/move/nearby-technicians for Move Mode.
 * For the regular booking flow, ask Member 3 to also expose it as a plain
 * GET, e.g.  GET /api/matching/nearby?service_id=X&lat=..&lon=..
 * This file calls that endpoint below — swap the URL if they name it
 * differently.
 *
 * Map view needs a mapping library since the team has no map dependency
 * yet. Leaflet is the simplest free option — add this to nearby.html <head>
 * once ready:
 *   <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css">
 *   <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
 * Until then, Map view shows a "coming soon" placeholder below.
 */

const params = new URLSearchParams(window.location.search);
const service_id = params.get('service_id');
let technicians = [];
let sortBy = 'distance';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function getLocationThenLoad() {
  if (!navigator.geolocation) {
    renderList([]);
    document.getElementById('nearby-list').innerHTML =
      '<div class="err">Your browser does not support location. Please enable it or set your home address manually.</div>';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => loadNearby(pos.coords.latitude, pos.coords.longitude),
    () => {
      document.getElementById('nearby-list').innerHTML =
        '<div class="err">Location permission denied. Please allow location access to see nearby technicians.</div>';
    }
  );
}

async function loadNearby(lat, lon) {
  const list = document.getElementById('nearby-list');
  list.innerHTML = '<div class="load">Finding nearby technicians…</div>';
  try {
    const res = await fetch(`/api/matching/nearby?service_id=${encodeURIComponent(service_id)}&lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error('Request failed (' + res.status + ')');
    technicians = await res.json();
    if (!technicians.length) {
      list.innerHTML = '<div class="empty">No technicians found nearby. Try widening your search area.</div>';
      return;
    }
    renderList(technicians);
  } catch (e) {
    list.innerHTML = `<div class="err">Couldn't load nearby technicians — ${escapeHtml(e.message)}. This endpoint may not be built yet — check with Member 3.</div>`;
  }
}

function sortedTechnicians() {
  const arr = [...technicians];
  if (sortBy === 'rating') arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else arr.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
  return arr;
}

function renderList(rows) {
  const list = document.getElementById('nearby-list');
  if (!rows.length) return;
  list.innerHTML = sortedTechnicians().map(t => `
    <div class="tech-card">
      <div class="avatar">${escapeHtml((t.name || '?').slice(0,2).toUpperCase())}</div>
      <div class="info">
        <div class="name">${escapeHtml(t.name)}</div>
        <div class="meta">${t.experience_years || 0} yrs experience · Matches: ${escapeHtml(t.skill_category || 'this service')}</div>
        <div class="stars">${'★'.repeat(Math.round(t.rating || 0))}<span style="color:var(--muted)">${t.rating ? Number(t.rating).toFixed(1) : 'New'}</span></div>
      </div>
      <div class="dist">${t.distance_km != null ? t.distance_km + ' km' : ''}</div>
      <a class="btn-primary" style="text-decoration:none;margin-left:10px;"
         href="/bookings/new?service_id=${service_id}&technician_id=${t.technician_id}">Select</a>
    </div>`).join('');
}

document.getElementById('view-list').addEventListener('click', () => {
  document.getElementById('view-list').classList.add('active');
  document.getElementById('view-map').classList.remove('active');
  document.getElementById('nearby-list').style.display = 'flex';
  document.getElementById('nearby-map').style.display = 'none';
});
document.getElementById('view-map').addEventListener('click', () => {
  document.getElementById('view-map').classList.add('active');
  document.getElementById('view-list').classList.remove('active');
  document.getElementById('nearby-list').style.display = 'none';
  const mapBox = document.getElementById('nearby-map');
  mapBox.style.display = 'block';
  mapBox.innerHTML = '<div class="empty" style="padding-top:180px;">Map view coming soon — needs a mapping library (see code comments).</div>';
});
document.getElementById('sort-by').addEventListener('change', (e) => {
  sortBy = e.target.value;
  renderList(technicians);
});

if (!service_id) {
  document.getElementById('nearby-list').innerHTML =
    '<div class="err">No service selected. Go back to the service catalog first.</div>';
} else {
  getLocationThenLoad();
}
