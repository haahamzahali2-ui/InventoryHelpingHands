// ═══════════════════════════════════
// NAVIGATION — page switching, keyboard shortcuts, clock, sort, time filter, bootstrap
// ═══════════════════════════════════

// ═══════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (name === 'analytics') renderAnalytics();
  if (name === 'patients') renderPatientsGrid();
  if (name === 'home') renderHomeStats();
}


// ═══════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════
const kbdHint = document.getElementById('kbdHint');
let kbdHintTimeout;

function showKbdHint(text) {
  kbdHint.innerHTML = text;
  kbdHint.classList.add('show');
  clearTimeout(kbdHintTimeout);
  kbdHintTimeout = setTimeout(() => kbdHint.classList.remove('show'), 2200);
}

document.addEventListener('keydown', e => {
  // Don't fire shortcuts when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Esc — close any open modal
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    return;
  }

  // ? — show shortcuts cheat sheet
  if (e.key === '?') {
    showKbdHint('<kbd>?</kbd> Help &nbsp; <kbd>/</kbd> Search &nbsp; <kbd>H</kbd> Home &nbsp; <kbd>P</kbd> Patients &nbsp; <kbd>A</kbd> Analytics &nbsp; <kbd>N</kbd> New reading &nbsp; <kbd>Esc</kbd> Close modal');
    return;
  }

  const activePage = document.querySelector('.page.active')?.id;

  if (e.key === '/' || e.key === 'f') {
    e.preventDefault();
    const searchInput = document.getElementById('patientSearch');
    if (activePage === 'page-patients' && searchInput) {
      searchInput.focus();
      showKbdHint('<kbd>/</kbd> Search patients');
    } else {
      showPage('patients');
      setTimeout(() => { document.getElementById('patientSearch')?.focus(); }, 300);
      showKbdHint('<kbd>/</kbd> Search patients');
    }
    return;
  }

  if (e.key === 'h' || e.key === 'H') {
    showPage('home');
    showKbdHint('<kbd>H</kbd> Home');
    return;
  }
  if (e.key === 'p' || e.key === 'P') {
    showPage('patients');
    showKbdHint('<kbd>P</kbd> Patient Lookup');
    return;
  }
  if (e.key === 'a' || e.key === 'A') {
    showPage('analytics');
    showKbdHint('<kbd>A</kbd> Analytics');
    return;
  }
  if ((e.key === 'n' || e.key === 'N') && activePage === 'page-detail') {
    openAddDataModal();
    showKbdHint('<kbd>N</kbd> New reading');
    return;
  }
  if ((e.key === 'm' || e.key === 'M') && activePage === 'page-detail') {
    openAddMedicationModal();
    showKbdHint('<kbd>M</kbd> Add medication');
    return;
  }
  if ((e.key === 'e' || e.key === 'E') && activePage === 'page-detail') {
    exportPatientPDF();
    showKbdHint('<kbd>E</kbd> Export PDF');
    return;
  }
  if (e.key === 'd' || e.key === 'D') {
    toggleDarkMode();
    showKbdHint('<kbd>D</kbd> Dark mode');
    return;
  }
});

// Show hint on first load
setTimeout(() => showKbdHint('Press <kbd>?</kbd> for keyboard shortcuts'), 2000);

// ═══════════════════════════════════
// LIVE CLOCK
// ═══════════════════════════════════
function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('topbarClock');
  const dateEl = document.getElementById('topbarDate');
  if (!timeEl) return;
  const h = now.getHours(), m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  const mm = String(m).padStart(2, '0');
  timeEl.textContent = `${hh}:${mm} ${ampm}`;
  dateEl.textContent = now.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
}
updateClock();
setInterval(updateClock, 10000);

// ═══════════════════════════════════
// SYNC STATUS DOT
// ═══════════════════════════════════
function setSyncStatus(status) {
  // status: 'syncing' | 'ok' | 'error'
  const dot = document.getElementById('syncDot');
  const lbl = document.getElementById('syncLabel');
  if (!dot) return;
  dot.className = 'sync-dot' + (status !== 'ok' ? ` ${status}` : '');
  lbl.textContent = status === 'syncing' ? 'Syncing…' : status === 'error' ? 'Error' : 'Synced';
  dot.title = status === 'ok' ? 'Sheet connected — click to re-sync' : status === 'error' ? 'Sync failed — click to retry' : 'Syncing…';
}

// Wrap fetchFromSheet to update sync dot
const _origFetchFromSheet = fetchFromSheet;
window.fetchFromSheet = async function() {
  setSyncStatus('syncing');
  try {
    await _origFetchFromSheet();
    setSyncStatus('ok');
  } catch(e) {
    setSyncStatus('error');
  }
};

// ═══════════════════════════════════
// SORT
// ═══════════════════════════════════
let currentSort = 'id';

function setSort(sort, btn) {
  currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPatientsGrid(document.getElementById('patientSearch')?.value.trim() || '');
}

function getDaysSinceLastReading(pid) {
  const p = db.patients[pid];
  if (!p) return 9999;
  const allDates = [...(p.bpReadings||[]), ...(p.a1cReadings||[])].map(r => r.datetime).filter(Boolean).sort();
  const last = allDates.slice(-1)[0];
  if (!last) return 9999;
  return Math.floor((Date.now() - new Date(last)) / 86400000);
}

function getPatientSortScore(pid) {
  const p = db.patients[pid];
  if (!p) return 0;
  const lastBP  = (p.bpReadings||[]).slice(-1)[0];
  const lastA1C = (p.a1cReadings||[]).slice(-1)[0];
  const bpStatus  = lastBP  ? getBPStatus(lastBP.sys, lastBP.dia)  : 'normal';
  const a1cStatus = lastA1C ? getA1CStatus(lastA1C.val)            : 'normal';
  const bpTrend  = getBPTrend(p.bpReadings||[]);
  const a1cTrend = getA1CTrend(p.a1cReadings||[]);
  const total = (p.bpReadings||[]).length + (p.a1cReadings||[]).length;
  const days  = getDaysSinceLastReading(pid);

  switch(currentSort) {
    case 'critical':
      if (bpStatus === 'critical' || a1cStatus === 'critical') return 3;
      if (bpStatus === 'warning'  || a1cStatus === 'warning')  return 2;
      return 1;
    case 'overdue':
      return days; // higher = more overdue = first
    case 'worsening':
      if (bpTrend === 'worsening' || a1cTrend === 'worsening') return 2;
      return 1;
    case 'improving':
      if (bpTrend === 'improving' || a1cTrend === 'improving') return 2;
      return 1;
    case 'readings':
      return total;
case 'lastseen':
      return days;
    case 'fam':
      return isFAMEnrolled(pid) ? 1 : 0;
    case 'id':
    default:
      return 0;
  }
}

// ═══════════════════════════════════
// OVERDUE LOGIC
// ═══════════════════════════════════
function isOverdue(pid) {
  return getDaysSinceLastReading(pid) >= 60;
}

// ═══════════════════════════════════
// EASTER EGG
// ═══════════════════════════════════
let eggBuffer = '';
const EGG_CODE = 'HELPINGHANDS';
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  eggBuffer = (eggBuffer + e.key.toUpperCase()).slice(-EGG_CODE.length);
  if (eggBuffer === EGG_CODE) {
    document.getElementById('easterEggOverlay').classList.add('show');
    launchConfetti();
    eggBuffer = '';
  }
});

// ═══════════════════════════════════
// TIME FILTER
// ═══════════════════════════════════
let currentTimeFilter = 'all';
let currentAnalyticsTimeFilter = 'all';

function getTimeFilterRange(filter) {
  const now = new Date();
  if (filter === 'all') return null;
  if (filter === 'thismonth') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  if (filter === 'lastmonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start, end };
  }
  if (filter === '3months') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 3, 1), end: now };
  }
  return null;
}

function patientHasReadingInRange(pid, range) {
  if (!range) return true;
  const p = db.patients[pid];
  if (!p) return false;
  const all = [...(p.bpReadings||[]), ...(p.a1cReadings||[])];
  return all.some(r => {
    const d = new Date(r.datetime);
    return d >= range.start && d <= range.end;
  });
}

function setTimeFilter(filter, btn) {
  currentTimeFilter = filter;
  document.querySelectorAll('.time-filter-bar .time-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const range = getTimeFilterRange(filter);
  const allIds = Object.keys(db.patients);
  const filtered = range ? allIds.filter(pid => patientHasReadingInRange(pid, range)) : allIds;
  const statsEl = document.getElementById('timeFilterStats');
  if (statsEl) statsEl.textContent = filter !== 'all' ? `${filtered.length} patient${filtered.length !== 1 ? 's' : ''} with readings in period` : '';
  renderPatientsGrid(document.getElementById('patientSearch')?.value.trim() || '', range);
}

function setAnalyticsTimeFilter(filter, btn) {
  currentAnalyticsTimeFilter = filter;
  document.querySelectorAll('#page-analytics .time-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAnalytics();
}

// ═══════════════════════════════════
// BOOTSTRAP / INIT
// ═══════════════════════════════════
loadDB();

if (HARDCODED_SCRIPT_URL && !sheetWriteUrl) {
  sheetWriteUrl = HARDCODED_SCRIPT_URL;
  localStorage.setItem(SHEET_WRITE_URL_KEY, HARDCODED_SCRIPT_URL);
}

if (sheetWriteUrl || sheetId) fetchFromSheet();

const sheetIdInput = document.getElementById('sheetIdInput');
const sheetWriteUrlInput = document.getElementById('sheetWriteUrlInput');
if (sheetIdInput) sheetIdInput.value = sheetId;
if (sheetWriteUrlInput) sheetWriteUrlInput.value = sheetWriteUrl;

if (HARDCODED_SCRIPT_URL || sheetWriteUrl) {
  const banner = document.getElementById('sheetSetupBanner');
  if (banner) banner.style.display = 'none';
}

renderAlertsList();
renderHomeStats();

// Seed sample data for local demo only
if (!sheetWriteUrl && !sheetId && Object.keys(db.patients).length === 0) {
  const sampleData = {
    "1001": {
      bpReadings: [
        { sys: 152, dia: 97, datetime: "2025-01-10", note: "" },
        { sys: 145, dia: 93, datetime: "2025-02-14", note: "Started Lisinopril 5mg" },
        { sys: 138, dia: 88, datetime: "2025-03-20", note: "" },
        { sys: 130, dia: 84, datetime: "2025-04-05", note: "Patient reports good adherence" }
      ],
      a1cReadings: [
        { val: 7.2, datetime: "2025-01-10", note: "" },
        { val: 6.8, datetime: "2025-04-05", note: "" }
      ],
      medications: [{ name: "Lisinopril", dosage: "5 mg once daily", startDate: "2025-02-14", endDate: "" }]
    },
    "1042": {
      bpReadings: [
        { sys: 138, dia: 88, datetime: "2025-01-22", note: "" },
        { sys: 142, dia: 91, datetime: "2025-02-28", note: "" },
        { sys: 188, dia: 118, datetime: "2025-04-01", note: "Missed medications 2 weeks" }
      ],
      a1cReadings: [
        { val: 8.4, datetime: "2025-01-22", note: "" },
        { val: 9.1, datetime: "2025-04-01", note: "" }
      ],
      medications: []
    },
    "2087": {
      bpReadings: [
        { sys: 120, dia: 76, datetime: "2025-02-05", note: "" },
        { sys: 118, dia: 74, datetime: "2025-03-10", note: "" }
      ],
      a1cReadings: [
        { val: 6.1, datetime: "2025-02-05", note: "" },
        { val: 5.8, datetime: "2025-03-10", note: "" }
      ],
      medications: []
    },
    "3015": {
      bpReadings: [
        { sys: 135, dia: 85, datetime: "2025-03-01", note: "" }
      ],
      a1cReadings: [],
      medications: []
    }
  };
  for (const pid in sampleData) {
    db.patients[pid] = sampleData[pid];
    const p = sampleData[pid];
    p.bpReadings.forEach(r => {
      const s = getBPStatus(r.sys, r.dia);
      if (s !== 'normal') db.alerts.push({ id: Date.now() + Math.random(), patientId: pid, type: 'bp', msg: `BP ${r.sys}/${r.dia} — ${s === 'critical' ? 'Hypertensive Urgency' : 'Stage 2 Hypertension'}`, time: r.datetime, seen: false, level: s });
    });
    p.a1cReadings.forEach(r => {
      const s = getA1CStatus(r.val);
      if (s !== 'normal') db.alerts.push({ id: Date.now() + Math.random(), patientId: pid, type: 'a1c', msg: `A1C ${r.val}% — ${s === 'critical' ? 'Poor Control (>9.0)' : 'Above Target (>7.0)'}`, time: r.datetime, seen: false, level: s });
    });
  }
  saveDB(); renderAlertsList(); renderHomeStats();
}
