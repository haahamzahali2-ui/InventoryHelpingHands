// ═══════════════════════════════════
// CORE — data store, helpers, modals, sync, exports, visit notes
// ═══════════════════════════════════

// DATA STORE
// ═══════════════════════════════════
const STORAGE_KEY = 'hh_clinic_data';
const SHEET_ID_KEY = 'hh_sheet_id';
const SHEET_WRITE_URL_KEY = 'hh_sheet_write_url';

const HARDCODED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyYlTUFoW-CgUEw8qPUQEm7i5VxLkivuASa35gc97f-YWJiOmPK-OwmOl4U_dE7vZR1/exec';

let db = { patients: {}, alerts: [], seenAlerts: [], stickies: {} };
let sheetId = localStorage.getItem(SHEET_ID_KEY) || '';
let sheetWriteUrl = localStorage.getItem(SHEET_WRITE_URL_KEY) || '';
let currentPatientId = null;
let currentDetailMetric = 'bp';
let currentBreakdownMetric = 'bp';
let bpSeriesMode = 'both';
let patientAlertDismissed = {};
let bpChartInst = null, a1cChartInst = null;
let bpOutcomesChartInst = null, a1cOutcomesChartInst = null;
let bpChartType = 'line', a1cChartType = 'line';

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { db = JSON.parse(raw); } catch(e) {} }
  if (!db.patients) db.patients = {};
  if (!db.alerts) db.alerts = [];
  if (!db.seenAlerts) db.seenAlerts = [];
  if (!db.stickies) db.stickies = {};
  for (const pid in db.patients) {
    if (!db.patients[pid].medications) db.patients[pid].medications = [];
    db.patients[pid].medications.forEach(m => { if (!('endDate' in m)) m.endDate = ''; });
  }
}

function saveDB() { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

function escapeHtml(input) {
  return String(input ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

function setSheetWriteUrl(url) {
  sheetWriteUrl = url.trim();
  if (sheetWriteUrl) localStorage.setItem(SHEET_WRITE_URL_KEY, sheetWriteUrl);
  else localStorage.removeItem(SHEET_WRITE_URL_KEY);
}

async function postToSheetBackend(action, payload = {}) {
  if (!sheetWriteUrl) return true;
  const params = new URLSearchParams({ action, payload: JSON.stringify(payload) });
  const res = await fetch(`${sheetWriteUrl}?${params}`, { method: 'GET', redirect: 'follow' });
  if (!res.ok) throw new Error('Sheet write failed');
  const text = await res.text();
  return text ? JSON.parse(text) : { ok: true };
}

function normalizeDate(val) {
  if (!val) return '';
  const s = String(val);
  // Already a plain date string YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // ISO timestamp — slice to date portion
  if (s.includes('T')) return s.slice(0, 10);
  // Google Sheets serial date number (days since Dec 30 1899)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = new Date(Math.round((parseFloat(s) - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  // Try parsing anything else
  const d = new Date(s);
  return isNaN(d) ? s : d.toISOString().slice(0, 10);
}

function parseBackendBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') return;
  const rebuilt = {};
  (bundle.patients || []).forEach(pid => {
    const key = String(pid).trim();
    if (key) rebuilt[key] = { bpReadings: [], a1cReadings: [], medications: [] };
  });
  (bundle.readings || []).forEach(r => {
    const pid = String(r.patientId || '').trim();
    if (!pid) return;
    if (!rebuilt[pid]) rebuilt[pid] = { bpReadings: [], a1cReadings: [], medications: [] };
    const dt = normalizeDate(r.datetime);
    if (r.type === 'bp') {
      const sys = Number(r.value1), dia = Number(r.value2);
      if (sys && dia) rebuilt[pid].bpReadings.push({ sys, dia, datetime: dt, note: String(r.note||'') });
    } else if (r.type === 'a1c') {
      const val = Number(r.value1);
      if (val) rebuilt[pid].a1cReadings.push({ val, datetime: dt, note: String(r.note||'') });
    }
  });
  Object.values(rebuilt).forEach(p => {
    p.bpReadings.sort((a,b) => new Date(a.datetime) - new Date(b.datetime));
    p.a1cReadings.sort((a,b) => new Date(a.datetime) - new Date(b.datetime));
  });
  (bundle.medications || []).forEach(m => {
    const pid = String(m.patientId || '').trim();
    if (!pid) return;
    if (!rebuilt[pid]) rebuilt[pid] = { bpReadings: [], a1cReadings: [], medications: [] };
    rebuilt[pid].medications.push({
      name:      String(m.name||''),
      dosage:    String(m.dosage||''),
      startDate: normalizeDate(m.startDate),
      endDate:   normalizeDate(m.endDate)
    });
  });
  db.patients = rebuilt;
  db.alerts = (bundle.alerts || []).map(a => ({
    id: a.id || (Date.now() + Math.random()), patientId: String(a.patientId||''),
    type: String(a.type||'general'), msg: String(a.msg||''), time: normalizeDate(a.time),
    seen: String(a.seen).toLowerCase() === 'true' || a.seen === true, level: String(a.level||'warning')
  }));
db.stickies = {};
  (bundle.stickies || []).forEach(s => {
    if (s.patientId) db.stickies[String(s.patientId)] = { note: s.note||'', color: s.color||'gold', createdAt: s.createdAt||'' };
  });
  // Apply Food as Medicine enrollments
  (bundle.famEnrollments || []).forEach(f => {
    const pid = String(f.patientId || '').trim();
    if (!pid || !db.patients[pid]) return;
    db.patients[pid].famEnrolled = true;
    db.patients[pid].famEnrollmentDate = normalizeDate(f.enrollmentDate);
    db.patients[pid].famProgramType = String(f.programType || '');
  });
  saveDB(); renderPatientsGrid(); renderHomeStats(); renderAlertsList();
}


// STATUS HELPERS
// ═══════════════════════════════════
function getBPStatus(sys, dia) {
  if (sys >= 180 || dia >= 120) return 'critical';
  if (sys >= 140 || dia >= 90)  return 'warning';
  return 'normal';
}
function getA1CStatus(val) {
  if (val > 9.0) return 'critical';
  if (val > 7.0) return 'warning';
  return 'normal';
}

// ═══════════════════════════════════
// IMPROVEMENT LOGIC
// ═══════════════════════════════════
function getBPTrend(readings) {
  if (!readings || readings.length < 2) return 'new';
  const prev = readings[readings.length - 2];
  const last = readings[readings.length - 1];
  const diff = last.sys - prev.sys;
  if (diff <= -5) return 'improving';
  if (diff >= 5)  return 'worsening';
  return 'stable';
}
function getA1CTrend(readings) {
  if (!readings || readings.length < 2) return 'new';
  const prev = readings[readings.length - 2];
  const last = readings[readings.length - 1];
  const diff = last.val - prev.val;
  if (diff <= -0.2) return 'improving';
  if (diff >= 0.2)  return 'worsening';
  return 'stable';
}


// ═══════════════════════════════════
// ALERTS
// ═══════════════════════════════════
function checkAndAddAlert(patientId, type, value, datetime) {
  let status, msg, level;
  if (type === 'bp') {
    const [sys, dia] = value;
    status = getBPStatus(sys, dia);
    if (status === 'critical') { msg = `BP ${sys}/${dia} — Hypertensive Urgency`; level = 'critical'; }
    else if (status === 'warning') { msg = `BP ${sys}/${dia} — Stage 2 Hypertension`; level = 'warning'; }
  } else {
    status = getA1CStatus(value);
    if (status === 'critical') { msg = `A1C ${value}% — Poor Control (>9.0)`; level = 'critical'; }
    else if (status === 'warning') { msg = `A1C ${value}% — Above Target (>7.0)`; level = 'warning'; }
  }
  if (level) {
    const alert = { id: Date.now() + Math.random(), patientId, type, msg, time: datetime, seen: false, level };
    db.alerts.unshift(alert);
    saveDB(); renderAlertsList();
    postToSheetBackend('add_alert', alert).catch(() => showToast('Alert saved locally; Google Sheets write failed.'));
  }
}

function renderAlertsList() {
  const list = document.getElementById('alertsModalList');
  const active = db.alerts.filter(a => !a.seen);
  if (!list) return;
  if (active.length === 0) { list.innerHTML = '<div class="sidebar-empty">No active alerts</div>'; return; }
  list.innerHTML = active.map(a => `
    <div class="alert-item ${a.level === 'warning' ? 'amber' : ''}" id="alert-${a.id}">
      <div class="alert-item-top">
        <div>
          <div class="alert-patient" onclick="openPatient('${a.patientId}');closeModal('alertsModal')">#${a.patientId}</div>
          <div class="alert-type">${a.level === 'critical' ? 'Critical' : 'Warning'}</div>
        </div>
      </div>
      <div class="alert-msg">${a.msg}</div>
      <div class="alert-time">${formatDateTime(a.time)}</div>
      <button class="seen-btn" onclick="markSeen('${a.id}')">Mark as seen</button>
    </div>
  `).join('');
}

function markSeen(id) {
  const alert = db.alerts.find(a => String(a.id) === String(id));
  if (alert) {
    alert.seen = true; saveDB(); renderAlertsList(); renderHomeStats();
    postToSheetBackend('mark_alert_seen', { id: alert.id, patientId: alert.patientId, time: alert.time })
      .catch(() => showToast('Alert marked seen locally; Google Sheets write failed.'));
  }
}

// ═══════════════════════════════════
// HOME STATS
// ═══════════════════════════════════
function openAlertsModal() { renderAlertsList(); document.getElementById('alertsModal').classList.add('open'); }

// ═══════════════════════════════════
// MODAL OPENERS — add data / add patient
// ═══════════════════════════════════
let activeModalTab = 'bp';

function openAddDataModal() {
  const iso = new Date().toISOString().slice(0,10);
  document.getElementById('bp-datetime').value = iso;
  document.getElementById('a1c-datetime').value = iso;
  document.getElementById('bp-systolic').value = '';
  document.getElementById('bp-diastolic').value = '';
  document.getElementById('a1c-value').value = '';
  document.getElementById('bp-note').value = '';
  document.getElementById('a1c-note').value = '';
  const prev = document.getElementById('bpLivePreview');
  if (prev) { prev.className = 'bp-live-preview'; prev.textContent = ''; }
  activeModalTab = 'bp';
  document.querySelectorAll('.modal-tab').forEach((t,i) => t.classList.toggle('active', i===0));
  document.getElementById('modal-bp').classList.add('active');
  document.getElementById('modal-a1c').classList.remove('active');
  document.getElementById('addDataModal').classList.add('open');
}

function switchModalTab(tab, btn) {
  activeModalTab = tab;
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('modal-bp').classList.toggle('active', tab === 'bp');
  document.getElementById('modal-a1c').classList.toggle('active', tab === 'a1c');
}

function openAddPatientModal() {
  document.getElementById('new-patient-id').value = '';
  document.getElementById('addPatientModal').classList.add('open');
}

function addPatient() {
  const id = document.getElementById('new-patient-id').value.trim();
  if (!id) { showToast('Please enter a patient ID'); return; }
  if (db.patients[id]) { showToast(`Patient #${id} already exists`); return; }
  db.patients[id] = { bpReadings: [], a1cReadings: [], medications: [] };
  saveDB();
  postToSheetBackend('add_patient', { patientId: id }).catch(() => showToast('Patient added locally; Google Sheets write failed.'));
  closeModal('addPatientModal'); renderPatientsGrid(); renderHomeStats();
  openPatient(id); showToast(`Patient #${id} added`);
}

// ═══════════════════════════════════
// GOOGLE SHEETS — BACKEND SYNC
// ═══════════════════════════════════
function connectSheet() {
  const id = document.getElementById('sheetIdInput').value.trim();
  const writeUrl = document.getElementById('sheetWriteUrlInput').value.trim();
  if (!writeUrl && !id) { showToast('Please paste an Apps Script URL or Sheet ID'); return; }
  if (id) { sheetId = id; localStorage.setItem(SHEET_ID_KEY, id); }
  setSheetWriteUrl(writeUrl);
  document.getElementById('sheetSetupBanner').style.display = 'none';
  showToast('Connecting to Google Sheets…');
  fetchFromSheet();
}

async function fetchFromSheet() {
  if (sheetWriteUrl) {
    try {
      const res = await fetch(sheetWriteUrl);
      console.log('Sheet fetch status:', res.status);
      if (res.ok) {
        const text = await res.text();
        console.log('Raw sheet response (first 500 chars):', text.slice(0, 500));
        const bundle = JSON.parse(text);
        console.log('Bundle ok:', bundle.ok);
        console.log('Patients from sheet:', bundle.patients);
        console.log('Readings count:', (bundle.readings||[]).length);
        if (bundle && bundle.ok !== false) {
          parseBackendBundle(bundle);
          console.log('db.patients after parse:', Object.keys(db.patients));
          showToast('✓ Synced with Google Sheets');
          return;
        }
      }
    } catch(e) {
      console.error('fetchFromSheet error:', e);
    }
  }
  if (!sheetId) return;
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
    const res = await fetch(url);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0,-2));
    parseSheetData(json);
  } catch(e) {
    showToast('Could not sync. Check your Apps Script URL or Sheet ID.');
  }
}

function parseSheetData(json) {
  const rows = json.table.rows;
  const newPatients = {};
  rows.forEach(row => {
    if (!row.c || !row.c[0]) return;
    const pid = String(row.c[0]?.v || '').trim();
    const type = String(row.c[1]?.v || '').trim().toLowerCase();
    const dt = row.c[2]?.v ? String(row.c[2].v) : '';
    const v1 = parseFloat(row.c[3]?.v);
    const v2 = parseFloat(row.c[4]?.v);
    const note = String(row.c[5]?.v || '').trim();
    if (!pid || !type) return;
    if (!newPatients[pid]) newPatients[pid] = { bpReadings: [], a1cReadings: [], medications: [] };
    if (type === 'bp' && v1 && v2) newPatients[pid].bpReadings.push({ sys: v1, dia: v2, datetime: dt, note });
    if (type === 'a1c' && v1) newPatients[pid].a1cReadings.push({ val: v1, datetime: dt, note });
  });
  for (const pid in newPatients) {
    const existingMeds = db.patients[pid]?.medications || [];
    db.patients[pid] = { ...newPatients[pid], medications: existingMeds };
  }
  saveDB(); renderPatientsGrid(); renderHomeStats(); renderAlertsList();
  showToast(`Sheet synced — ${Object.keys(newPatients).length} patients loaded`);
}

function openSheetTemplate() {
  alert(
    'SETUP GUIDE\n\n' +
    'STEP 1 — Create Google Sheet\n' +
    '  • Create a new Google Sheet (name it anything)\n' +
    '  • Copy the Sheet ID from the URL: docs.google.com/spreadsheets/d/[SHEET_ID]/edit\n\n' +
    'STEP 2 — Open Apps Script\n' +
    '  • In the Sheet: Extensions → Apps Script\n' +
    '  • Delete any default code\n' +
    '  • Paste the full contents of GoogleAppsScript-Code.gs\n' +
    '  • Save the project\n\n' +
    'STEP 3 — Set Script Property\n' +
    '  • Click the gear icon (Project Settings)\n' +
    '  • Scroll to "Script Properties" → Add property\n' +
    '    Key: SHEET_ID   Value: [your sheet ID]\n\n' +
    'STEP 4 — Deploy as Web App\n' +
    '  • Click Deploy → New Deployment\n' +
    '  • Type: Web App\n' +
    '  • Execute as: Me\n' +
    '  • Who has access: Anyone\n' +
    '  • Click Deploy → copy the Web App URL\n\n' +
    'STEP 5 — Hardcode URL for auto multi-device sync\n' +
    '  • Open index.html in VS Code or any editor\n' +
    '  • Find the line: const HARDCODED_SCRIPT_URL = \'\'\n' +
    '  • Paste your Web App URL between the quotes\n' +
    '  • Push to GitHub — every device now auto-syncs on load\n\n' +
    'SHEET TABS CREATED AUTOMATICALLY:\n' +
    '  patients | readings | medications | alerts | r_data\n\n' +
    'R-READY TAB (r_data) COLUMNS:\n' +
    '  patient_id | visit_date | systolic_mmhg | diastolic_mmhg | a1c_pct | note_bp | note_a1c\n' +
    '  → Copy this tab into RStudio and run lm() or cor() directly'
  );
}

// ═══════════════════════════════════
// UTILITY
// ═══════════════════════════════════
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

// ═══════════════════════════════════
// DARK MODE
// ═══════════════════════════════════
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('hh_dark_mode', isDark ? '1' : '0');
  document.getElementById('darkToggleBtn').textContent = isDark ? '☀️' : '🌙';
}
if (localStorage.getItem('hh_dark_mode') === '1') {
  document.body.classList.add('dark-mode');
  document.getElementById('darkToggleBtn').textContent = '☀️';
}

// ═══════════════════════════════════
// CONFETTI — fires when a patient shows improvement trend
// ═══════════════════════════════════
const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas.getContext('2d');
let confettiPieces = [];
let confettiRunning = false;

function launchConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  const colors = ['#C9A84C','#F0D98A','#2E7D52','#4caf78','#E8D5A3','#ffffff'];
  confettiPieces = Array.from({length: 120}, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * -200,
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 4,
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 3 + 2,
    opacity: 1
  }));
  if (!confettiRunning) animateConfetti();
}

function animateConfetti() {
  confettiRunning = true;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiPieces.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.rot += p.rotSpeed;
    if (p.y > confettiCanvas.height * 0.7) p.opacity -= 0.02;
    confettiCtx.save();
    confettiCtx.globalAlpha = Math.max(0, p.opacity);
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot * Math.PI / 180);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
    confettiCtx.restore();
  });
  confettiPieces = confettiPieces.filter(p => p.opacity > 0);
  if (confettiPieces.length > 0) requestAnimationFrame(animateConfetti);
  else { confettiRunning = false; confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
}

// ═══════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════
function exportPatientPDF() {
  if (!currentPatientId) return;
  const p = db.patients[currentPatientId];
  const ph = document.getElementById('printHeader');
  const bpReadings = p.bpReadings || [];
  const a1cReadings = p.a1cReadings || [];
  const lastBP = bpReadings.slice(-1)[0];
  const lastA1C = a1cReadings.slice(-1)[0];
  ph.innerHTML = `
    <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:4px;">Helping Hands Free Clinic — Patient Report</div>
    <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:#8C7D60;margin-bottom:16px;">Patient #${currentPatientId} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
    <div style="display:flex;gap:24px;margin-bottom:16px;font-family:'DM Sans',sans-serif;font-size:13px;">
      <div><strong>BP Readings:</strong> ${bpReadings.length}</div>
      <div><strong>Last BP:</strong> ${lastBP ? lastBP.sys+'/'+lastBP.dia+' mmHg' : '—'}</div>
      <div><strong>A1C Readings:</strong> ${a1cReadings.length}</div>
      <div><strong>Last A1C:</strong> ${lastA1C ? lastA1C.val+'%' : '—'}</div>
      <div><strong>Medications:</strong> ${(p.medications||[]).length}</div>
    </div>
    <hr style="border:none;border-top:1px solid #E8D9B8;margin-bottom:16px;">
  `;
  // Show both cards for print
  document.getElementById('bpDetailCard').classList.remove('hidden');
  document.getElementById('a1cDetailCard').classList.remove('hidden');
  window.print();
  // Restore metric view after print
  setTimeout(() => {
    setDetailMetric(currentDetailMetric);
    ph.innerHTML = '';
  }, 1000);
}

// ═══════════════════════════════════
// ANALYTICS PDF — DONOR READY
// ═══════════════════════════════════
function exportAnalyticsPDF() {
  const totalPts    = Object.keys(db.patients).length;
  const bpOutcomes  = computeBPOutcomes();
  const a1cOutcomes = computeA1COutcomes();
  const pct = (n,d) => d > 0 ? Math.round((n/d)*100) : 0;
  const dateStr = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const hdr = document.getElementById('analyticsPrintHeaderInPage');
  hdr.innerHTML = `
    <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;margin-bottom:4px;color:#2C2416;">Helping Hands Free Clinic</div>
    <div style="font-family:'Playfair Display',serif;font-size:18px;font-style:italic;color:#A8893C;margin-bottom:6px;">Population Health Outcomes Report</div>
    <div style="font-family:'DM Sans',sans-serif;font-size:12px;color:#8C7D60;margin-bottom:20px;">Generated ${dateStr} &nbsp;·&nbsp; Columbus, OH</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
      <div style="border:1px solid #E8D9B8;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-family:'Playfair Display',serif;font-size:34px;font-weight:700;color:#A8893C;">${totalPts}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#8C7D60;margin-top:4px;">Patients Served</div>
      </div>
      <div style="border:1px solid #E8D9B8;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-family:'Playfair Display',serif;font-size:34px;font-weight:700;color:#2E7D52;">${pct(bpOutcomes.improving,totalPts)}%</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#8C7D60;margin-top:4px;">BP Improving</div>
      </div>
      <div style="border:1px solid #E8D9B8;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-family:'Playfair Display',serif;font-size:34px;font-weight:700;color:#2E7D52;">${pct(a1cOutcomes.improving,totalPts)}%</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#8C7D60;margin-top:4px;">A1C Improving</div>
      </div>
      <div style="border:1px solid #E8D9B8;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-family:'Playfair Display',serif;font-size:34px;font-weight:700;color:#C0392B;">${bpOutcomes.worsening+a1cOutcomes.worsening}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#8C7D60;margin-top:4px;">Needs Attention</div>
      </div>
    </div>
    <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:#5C4F38;line-height:1.75;margin-bottom:20px;padding:16px;background:#F5EDD6;border-radius:10px;border-left:4px solid #C9A84C;">
      <strong>Summary:</strong> As of ${dateStr}, Helping Hands has tracked outcomes for <strong>${totalPts} patients</strong>.
      ${pct(bpOutcomes.improving,totalPts)}% of patients with multiple BP readings show improvement in systolic blood pressure.
      ${pct(a1cOutcomes.improving,totalPts)}% of patients with multiple A1C readings show improved glycemic control.
      ${bpOutcomes.worsening+a1cOutcomes.worsening > 0 ? `<strong>${bpOutcomes.worsening+a1cOutcomes.worsening} patient(s)</strong> show worsening trends and are being closely monitored.` : 'No patients currently show worsening trends.'}
    </div>
    <hr style="border:none;border-top:1px solid #E8D9B8;margin-bottom:20px;">
  `;
  document.body.classList.add('printing-analytics');
  window.print();
  setTimeout(() => { document.body.classList.remove('printing-analytics'); hdr.innerHTML = ''; }, 1200);
}

// ═══════════════════════════════════
// LIVE BP PREVIEW
// ═══════════════════════════════════
function updateBPPreview() {
  const sys = parseFloat(document.getElementById('bp-systolic')?.value);
  const dia = parseFloat(document.getElementById('bp-diastolic')?.value);
  const el  = document.getElementById('bpLivePreview');
  if (!el) return;
  if (!sys || !dia) { el.className = 'bp-live-preview'; el.textContent = ''; return; }

  let cls, icon, label, detail;
  if (sys >= 180 || dia >= 120) {
    cls = 'crisis'; icon = '🚨'; label = 'Hypertensive Crisis';
    detail = 'Immediate medical attention required';
  } else if (sys >= 140 || dia >= 90) {
    cls = 'stage2'; icon = '⚠️'; label = 'Stage 2 Hypertension';
    detail = 'Systolic ≥140 or Diastolic ≥90';
  } else if (sys >= 130 || dia >= 80) {
    cls = 'stage1'; icon = '🟡'; label = 'Stage 1 Hypertension';
    detail = 'Systolic 130–139 or Diastolic 80–89';
  } else if (sys >= 120 && dia < 80) {
    cls = 'stage1'; icon = '🟡'; label = 'Elevated';
    detail = 'Systolic 120–129, Diastolic <80';
  } else {
    cls = 'normal'; icon = '✅'; label = 'Normal';
    detail = 'Systolic <120 and Diastolic <80';
  }
  el.className = `bp-live-preview ${cls}`;
  el.innerHTML = `${icon} <strong>${label}</strong> &nbsp;·&nbsp; <span style="font-weight:400;opacity:0.8">${detail}</span>`;
}

// ═══════════════════════════════════
// ANIMATED COUNTERS
// ═══════════════════════════════════
function animateCount(el, target, duration = 1200) {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function renderHomeStats() {
  const pCount = Object.keys(db.patients).length;
  let rCount = 0;
  for (const pid in db.patients) rCount += (db.patients[pid].bpReadings||[]).length + (db.patients[pid].a1cReadings||[]).length;
  const aCount = db.alerts.filter(a => !a.seen).length;
  let improving = 0;
  for (const pid in db.patients) {
    const p = db.patients[pid];
    if (getBPTrend(p.bpReadings||[]) === 'improving' || getA1CTrend(p.a1cReadings||[]) === 'improving') improving++;
  }

  // Topbar stats (plain)
  document.getElementById('stat-patients').textContent = pCount;
  document.getElementById('stat-readings').textContent = rCount;
  document.getElementById('stat-alerts').textContent = aCount;

  // Animated impact chips on home page
  animateCount(document.getElementById('imp-patients'), pCount);
  animateCount(document.getElementById('imp-readings'), rCount);
  animateCount(document.getElementById('imp-improving'), improving);
  animateCount(document.getElementById('imp-alerts'), aCount);
