// ═══════════════════════════════════
// CHARTS — patient charts, tables, analytics charts
// ═══════════════════════════════════

const goldPalette = {
  gold: '#C9A84C', goldDim: '#A8893C', goldLight: '#E8D5A3',
  red: '#C0392B', amber: '#D4850A', green: '#2E7D52',
  text: '#5C4F38', grid: '#E8D9B8'
};

const chartDefaults = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { labels: { font: { family: "'DM Sans', sans-serif", size: 13 }, color: goldPalette.text } },
    tooltip: { backgroundColor: '#1A1208', titleFont: { family: "'Playfair Display', serif", size: 15 }, bodyFont: { family: "'DM Sans', sans-serif", size: 13 }, padding: 14, cornerRadius: 10 }
  },
  scales: {
    x: { ticks: { font: { family: "'DM Sans'", size: 11 }, color: goldPalette.text, maxRotation: 35 }, grid: { color: goldPalette.grid } },
    y: { ticks: { font: { family: "'DM Sans'", size: 12 }, color: goldPalette.text }, grid: { color: goldPalette.grid } }
  }
};

// Medication color palette — no green (reserved for FaM)
const MED_COLORS = [
  '#C0392B', // red
  '#2980B9', // blue
  '#8E44AD', // purple
  '#D4850A', // amber
  '#16A085', // teal
  '#884EA0', // violet
  '#1A5276', // navy
  '#A04000', // brown
  '#B7950B', // dark gold
  '#1F618D', // steel blue
];
const FAM_COLOR = '#2E7D52'; // green, reserved for FaM

function formatDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt + 'T00:00:00'); // force local timezone, avoid UTC shift
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Time filter helpers ───────────────────────────────────────────────────
var currentAnalyticsTimeFilter = currentAnalyticsTimeFilter || 'all';

function getTimeFilterRange(filter) {
  const now = new Date();
  if (filter === 'all') return null;
  const start = new Date();
  if (filter === 'thismonth') { start.setDate(1); start.setHours(0,0,0,0); }
  else if (filter === 'lastmonth') {
    start.setDate(1); start.setMonth(start.getMonth() - 1); start.setHours(0,0,0,0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) };
  }
  else if (filter === '3months') { start.setMonth(start.getMonth() - 3); start.setHours(0,0,0,0); }
  else if (filter === '6months') { start.setMonth(start.getMonth() - 6); start.setHours(0,0,0,0); }
  else if (filter === '1year')   { start.setFullYear(start.getFullYear() - 1); start.setHours(0,0,0,0); }
  return { start: start.toISOString().slice(0,10), end: now.toISOString().slice(0,10) };
}

function patientHasReadingInRange(pid, range) {
  if (!range) return true;
  const p = db.patients[pid];
  if (!p) return false;
  const allReadings = [...(p.bpReadings||[]), ...(p.a1cReadings||[])];
  return allReadings.some(r => r.datetime >= range.start && r.datetime <= range.end);
}

function setAnalyticsTimeFilter(filter, btn) {
  currentAnalyticsTimeFilter = filter;
  document.querySelectorAll('.time-filter-bar .time-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAnalytics();
}

// ─── Build annotation objects for a patient ───────────────────────────────
// formattedLabels = the exact strings used as x-axis labels (e.g. "Apr 30, 2026")
// rawDates        = parallel array of YYYY-MM-DD strings for distance calc
function buildAnnotations(patientId, rawDates, formattedLabels) {
  const p = db.patients[patientId];
  if (!p || !rawDates.length) return {};
  const annotations = {};

  // Returns the formatted label of the nearest reading to a target date
  const findNearestLabel = (targetDate) => {
    if (!targetDate) return null;
    const targetMs = new Date(targetDate).getTime();
    let bestIdx = 0, bestDist = Infinity;
    rawDates.forEach((d, i) => {
      const dist = Math.abs(new Date(d).getTime() - targetMs);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    // Don't snap if more than 180 days from every reading
    if (bestDist > 180 * 24 * 60 * 60 * 1000) return null;
    return formattedLabels[bestIdx];
  };

  // Stable color per unique med name
  const meds = p.medications || [];
  const medColorMap = {};
  let colorIdx = 0;
  meds.forEach(med => {
    if (!medColorMap[med.name]) {
      medColorMap[med.name] = MED_COLORS[colorIdx % MED_COLORS.length];
      colorIdx++;
    }
  });

  // Active meds only
  const today = new Date().toISOString().slice(0, 10);
  const activeMeds = meds.filter(m => !m.endDate || m.endDate > today);

  activeMeds.forEach((med, i) => {
    if (!med.startDate) return;
    const label = findNearestLabel(med.startDate);
    if (!label) return;
    const color = medColorMap[med.name];
    annotations[`med_${i}`] = {
      type: 'line',
      scaleID: 'x',
      value: label,
      borderColor: color,
      borderWidth: 2,
      borderDash: [6, 3],
      label: {
        display: true,
        content: `💊 ${med.name}`,
        position: 'start',
        backgroundColor: color,
        color: '#fff',
        font: { family: "'DM Sans', sans-serif", size: 11, weight: '600' },
        padding: { x: 8, y: 4 },
        cornerRadius: 6,
        yAdjust: -6
      }
    };
  });

  // FaM enrollment — solid green line
  if (p.famEnrolled && p.famEnrollmentDate) {
    const label = findNearestLabel(p.famEnrollmentDate);
    if (label) {
      annotations['fam'] = {
        type: 'line',
        scaleID: 'x',
        value: label,
        borderColor: FAM_COLOR,
        borderWidth: 2.5,
        borderDash: [],
        label: {
          display: true,
          content: '🥗 FaM Enrolled',
          position: 'end',
          backgroundColor: FAM_COLOR,
          color: '#fff',
          font: { family: "'DM Sans', sans-serif", size: 11, weight: '600' },
          padding: { x: 8, y: 4 },
          cornerRadius: 6,
          yAdjust: 6
        }
      };
    }
  }

  return annotations;
}


// ─── BP Chart ─────────────────────────────────────────────────────────────
function renderBPChart(readings) {
  if (bpChartInst) { bpChartInst.destroy(); bpChartInst = null; }
  const ctx = document.getElementById('bpChart').getContext('2d');
  const labels = readings.map(r => formatDateTime(r.datetime));
  const rawDates = readings.map(r => r.datetime);

  let datasets = [];
  if (bpSeriesMode === 'both' || bpSeriesMode === 'systolic') {
    datasets.push({
      label: 'Systolic',
      data: readings.map(r => r.sys),
      borderColor: goldPalette.red,
      backgroundColor: bpChartType === 'line'
        ? 'rgba(192,57,43,0.08)'
        : readings.map(r => getBPStatus(r.sys, r.dia) === 'critical' ? 'rgba(192,57,43,0.7)' : getBPStatus(r.sys, r.dia) === 'warning' ? 'rgba(212,133,10,0.7)' : 'rgba(201,168,76,0.7)'),
      tension: 0.3, fill: bpChartType === 'line', pointRadius: 5, pointHoverRadius: 7
    });
  }
  if (bpSeriesMode === 'both' || bpSeriesMode === 'diastolic') {
    datasets.push({
      label: 'Diastolic',
      data: readings.map(r => r.dia),
      borderColor: goldPalette.gold,
      backgroundColor: bpChartType === 'line' ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.5)',
      tension: 0.3, fill: false, pointRadius: 5, pointHoverRadius: 7
    });
  }

  const annotations = buildAnnotations(currentPatientId, rawDates, labels);

  bpChartInst = new Chart(ctx, {
    type: bpChartType,
    data: { labels, datasets },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        annotation: { annotations }
      }
    }
  });
}

function setBPSeriesMode(mode, btn) {
  bpSeriesMode = mode;
  btn.closest('.chart-toggle').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBPChart(db.patients[currentPatientId]?.bpReadings || []);
}

// ─── A1C Chart ────────────────────────────────────────────────────────────
function renderA1CChart(readings) {
  if (a1cChartInst) { a1cChartInst.destroy(); a1cChartInst = null; }
  const ctx = document.getElementById('a1cChart').getContext('2d');
  const labels = readings.map(r => formatDateTime(r.datetime));
  const rawDates = readings.map(r => r.datetime);
  const annotations = buildAnnotations(currentPatientId, rawDates, labels);

  a1cChartInst = new Chart(ctx, {
    type: a1cChartType,
    data: {
      labels,
      datasets: [{
        label: 'A1C %',
        data: readings.map(r => r.val),
        borderColor: goldPalette.goldDim,
        backgroundColor: a1cChartType === 'line'
          ? 'rgba(168,137,60,0.12)'
          : readings.map(r => getA1CStatus(r.val) === 'critical' ? 'rgba(192,57,43,0.7)' : getA1CStatus(r.val) === 'warning' ? 'rgba(212,133,10,0.7)' : 'rgba(46,125,82,0.6)'),
        tension: 0.3, fill: a1cChartType === 'line', pointRadius: 5, pointHoverRadius: 7
      }]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        annotation: { annotations }
      }
    }
  });
}

function toggleChart(chartName, type, btn) {
  btn.closest('.chart-toggle').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (chartName === 'bp') { bpChartType = type; renderBPChart(db.patients[currentPatientId]?.bpReadings || []); }
  else if (chartName === 'a1c') { a1cChartType = type; renderA1CChart(db.patients[currentPatientId]?.a1cReadings || []); }
}

// ═══════════════════════════════════
// TABLES
// ═══════════════════════════════════
function renderBPTable(readings) {
  const tbody = document.querySelector('#bpTable tbody');
  if (!readings.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:24px;font-style:italic;">No readings yet</td></tr>'; return; }
  tbody.innerHTML = readings.slice().reverse().map((r, revIdx) => {
    const idx = readings.length - 1 - revIdx;
    const s = getBPStatus(r.sys, r.dia);
    const cls = s === 'critical' ? 'critical' : s === 'warning' ? 'warning' : '';
    const lbl = s === 'critical' ? 'Urgent' : s === 'warning' ? 'High' : 'Normal';
    const note = r.note ? escapeHtml(r.note) : '<span class="note-empty">—</span>';
    return `<tr>
      <td>${formatDateTime(r.datetime)}</td>
      <td><span class="bp-val ${cls}">${r.sys}</span></td>
      <td><span class="bp-val ${cls}">${r.dia}</span></td>
      <td>${lbl}</td>
      <td class="note-cell">${note}</td>
      <td style="white-space:nowrap;text-align:right">
        <span class="row-actions">
          <button class="row-btn edit" onclick="event.stopPropagation();openEditReading('bp',${idx})">Edit</button>
          <button class="row-btn del" onclick="event.stopPropagation();openEditReading('bp',${idx});document.getElementById('readingDeleteBar').classList.add('show')">Delete</button>
        </span>
      </td>
    </tr>`;
  }).join('');
}

function renderA1CTable(readings) {
  const tbody = document.querySelector('#a1cTable tbody');
  if (!readings.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:24px;font-style:italic;">No readings yet</td></tr>'; return; }
  tbody.innerHTML = readings.slice().reverse().map((r, revIdx) => {
    const idx = readings.length - 1 - revIdx;
    const s = getA1CStatus(r.val);
    const cls = s === 'critical' ? 'critical' : s === 'warning' ? 'warning' : '';
    const lbl = s === 'critical' ? 'Poor Control' : s === 'warning' ? 'Above Target' : 'Controlled';
    const note = r.note ? escapeHtml(r.note) : '<span class="note-empty">—</span>';
    return `<tr>
      <td>${formatDateTime(r.datetime)}</td>
      <td><span class="a1c-val ${cls}">${r.val}%</span></td>
      <td>${lbl}</td>
      <td class="note-cell">${note}</td>
      <td style="white-space:nowrap;text-align:right">
        <span class="row-actions">
          <button class="row-btn edit" onclick="event.stopPropagation();openEditReading('a1c',${idx})">Edit</button>
          <button class="row-btn del" onclick="event.stopPropagation();openEditReading('a1c',${idx});document.getElementById('readingDeleteBar').classList.add('show')">Delete</button>
        </span>
      </td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════
function renderAnalytics() {
  const range = getTimeFilterRange(currentAnalyticsTimeFilter);

  // Filter patients to those with readings in range
  const filteredPatients = Object.keys(db.patients).filter(pid =>
    range ? patientHasReadingInRange(pid, range) : true
  );

  const bpOutcomes = computeBPOutcomes(filteredPatients, range);
  const a1cOutcomes = computeA1COutcomes(filteredPatients, range);
  renderAnalyticsKPIs(bpOutcomes, a1cOutcomes, filteredPatients.length);
  renderBPOutcomesChart(bpOutcomes);
  renderA1COutcomesChart(a1cOutcomes);
  renderFAMAnalytics();

  const statsEl = document.getElementById('analyticsTimeStats');
  if (statsEl) {
    statsEl.textContent = range
      ? `${filteredPatients.length} patient${filteredPatients.length !== 1 ? 's' : ''} with readings in period`
      : '';
  }
}

function filterReadingsInRange(readings, range) {
  if (!range) return readings;
  return readings.filter(r => r.datetime >= range.start && r.datetime <= range.end);
}

function computeBPOutcomes(patientIds, range) {
  let improving = 0, worsening = 0, stable = 0, newPatient = 0;
  const rows = [];
  for (const pid of patientIds) {
    const readings = filterReadingsInRange(db.patients[pid].bpReadings || [], range);
    const trend = getBPTrend(readings);
    if (trend === 'improving') improving++;
    else if (trend === 'worsening') worsening++;
    else if (trend === 'stable') stable++;
    else newPatient++;
    rows.push({ pid, trend, last: readings.slice(-1)[0], prev: readings.slice(-2)[0] });
  }
  return { improving, worsening, stable, newPatient, rows };
}

function computeA1COutcomes(patientIds, range) {
  let improving = 0, worsening = 0, stable = 0, newPatient = 0;
  const rows = [];
  for (const pid of patientIds) {
    const readings = filterReadingsInRange(db.patients[pid].a1cReadings || [], range);
    const trend = getA1CTrend(readings);
    if (trend === 'improving') improving++;
    else if (trend === 'worsening') worsening++;
    else if (trend === 'stable') stable++;
    else newPatient++;
    rows.push({ pid, trend, last: readings.slice(-1)[0], prev: readings.slice(-2)[0] });
  }
  return { improving, worsening, stable, newPatient, rows };
}

function renderAnalyticsKPIs(bpOutcomes, a1cOutcomes, totalPts) {
  const pct = (n, d) => d > 0 ? Math.round((n / d) * 100) + '%' : '—';
  document.getElementById('analyticsKPIs').innerHTML = `
    <div class="analytics-kpi gold">
      <div class="kpi-label">Total Patients</div>
      <div class="kpi-val gold">${totalPts}</div>
      <div class="kpi-sub">in selected period</div>
    </div>
    <div class="analytics-kpi green">
      <div class="kpi-label">Improving BP</div>
      <div class="kpi-val green">${bpOutcomes.improving}</div>
      <div class="kpi-sub">${pct(bpOutcomes.improving, totalPts)} of patients</div>
    </div>
    <div class="analytics-kpi green">
      <div class="kpi-label">Improving A1C</div>
      <div class="kpi-val green">${a1cOutcomes.improving}</div>
      <div class="kpi-sub">${pct(a1cOutcomes.improving, totalPts)} of patients</div>
    </div>
    <div class="analytics-kpi red">
      <div class="kpi-label">Needs Attention</div>
      <div class="kpi-val red">${bpOutcomes.worsening + a1cOutcomes.worsening}</div>
      <div class="kpi-sub">worsening readings (BP + A1C)</div>
    </div>
  `;
}

function renderBPOutcomesChart(outcomes) {
  if (bpOutcomesChartInst) { bpOutcomesChartInst.destroy(); bpOutcomesChartInst = null; }
  const ctx = document.getElementById('bpOutcomesChart').getContext('2d');
  const { improving, worsening, stable, newPatient } = outcomes;
  bpOutcomesChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Improving', 'Worsening', 'Stable', 'Insufficient Data'],
      datasets: [{ data: [improving, worsening, stable, newPatient], backgroundColor: ['rgba(46,125,82,0.85)', 'rgba(192,57,43,0.85)', 'rgba(168,137,60,0.7)', 'rgba(140,125,96,0.4)'], borderColor: '#FFFDF7', borderWidth: 3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: "'DM Sans', sans-serif", size: 13 }, color: goldPalette.text, padding: 16 } },
        tooltip: { backgroundColor: '#1A1208', bodyFont: { family: "'DM Sans', sans-serif", size: 14 }, padding: 14, cornerRadius: 10, callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0; return ` ${ctx.raw} patients (${pct}%)`; } } }
      }
    }
  });
}

function renderA1COutcomesChart(outcomes) {
  if (a1cOutcomesChartInst) { a1cOutcomesChartInst.destroy(); a1cOutcomesChartInst = null; }
  const ctx = document.getElementById('a1cOutcomesChart').getContext('2d');
  const { improving, worsening, stable, newPatient } = outcomes;
  a1cOutcomesChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Improving', 'Worsening', 'Stable', 'Insufficient Data'],
      datasets: [{ data: [improving, worsening, stable, newPatient], backgroundColor: ['rgba(46,125,82,0.85)', 'rgba(192,57,43,0.85)', 'rgba(168,137,60,0.7)', 'rgba(140,125,96,0.4)'], borderColor: '#FFFDF7', borderWidth: 3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: "'DM Sans', sans-serif", size: 13 }, color: goldPalette.text, padding: 16 } },
        tooltip: { backgroundColor: '#1A1208', bodyFont: { family: "'DM Sans', sans-serif", size: 14 }, padding: 14, cornerRadius: 10, callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0; return ` ${ctx.raw} patients (${pct}%)`; } } }
      }
    }
  });
}

// ═══════════════════════════════════
// BREAKDOWN PAGE
// ═══════════════════════════════════
let currentBreakdownSort      = 'default';
let currentBreakdownFaMFilter = 'all'; // 'all' | 'fam' | 'nonfam'

function setBreakdownMetric(metric, btn) {
  currentBreakdownMetric = metric;
  document.querySelectorAll('.breakdown-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderPatientBreakdownTable(metric);
}

function setBreakdownSort(sort, btn) {
  currentBreakdownSort = sort;
  document.querySelectorAll('#page-breakdown .bd-chip-row:first-of-type .bd-chip').forEach(b => b.classList.remove('active'));
  // safer: just mark the clicked button active
  document.querySelectorAll('#page-breakdown .bd-chip').forEach(b => {
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("setBreakdownSort")) {
      b.classList.remove('active');
    }
  });
  btn.classList.add('active');
  renderPatientBreakdownTable(currentBreakdownMetric);
}

function setBreakdownFaMFilter(filter, btn) {
  currentBreakdownFaMFilter = filter;
  document.querySelectorAll('#page-breakdown .bd-chip').forEach(b => {
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("setBreakdownFaMFilter")) {
      b.classList.remove('active');
    }
  });
  btn.classList.add('active');
  renderPatientBreakdownTable(currentBreakdownMetric);
}

// Returns days since most recent reading for this patient (any type)
function getBreakdownLastSeenDays(pid) {
  const p = db.patients[pid];
  if (!p) return 9999;
  const allDates = [...(p.bpReadings||[]), ...(p.a1cReadings||[])]
    .map(r => r.datetime).filter(Boolean).sort();
  const last = allDates.slice(-1)[0];
  if (!last) return 9999;
  return Math.floor((Date.now() - new Date(last + 'T00:00:00')) / 86400000);
}

// Returns the numeric value of the most recent metric reading for sorting
function getBreakdownLastValue(pid, metric) {
  const p = db.patients[pid];
  if (!p) return null;
  if (metric === 'bp') {
    const last = (p.bpReadings || []).slice(-1)[0];
    return last ? last.sys : null;
  } else {
    const last = (p.a1cReadings || []).slice(-1)[0];
    return last ? last.val : null;
  }
}

function renderPatientBreakdownTable(metric) {
  const tbody = document.querySelector('#patientBreakdownTable tbody');
  let patients = Object.keys(db.patients);

  // ── FaM filter ──────────────────────────────────────────────
  if (currentBreakdownFaMFilter === 'fam') {
    patients = patients.filter(pid => isFAMEnrolled(pid));
  } else if (currentBreakdownFaMFilter === 'nonfam') {
    patients = patients.filter(pid => !isFAMEnrolled(pid));
  }

  if (patients.length === 0) {
    const label = currentBreakdownFaMFilter === 'fam'
      ? 'No FaM-enrolled patients found'
      : currentBreakdownFaMFilter === 'nonfam'
        ? 'No non-FaM patients found'
        : 'No patient data';
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:28px;font-style:italic;">${label}</td></tr>`;
    return;
  }

  const rows = patients.map(pid => {
    const p = db.patients[pid];
    const readings = metric === 'bp' ? (p.bpReadings || []) : (p.a1cReadings || []);
    const trend    = metric === 'bp' ? getBPTrend(readings) : getA1CTrend(readings);
    const last     = readings.slice(-1)[0];
    const prev     = readings.slice(-2)[0];
    let prevStr = '—', lastStr = '—', changeStr = '—';
    if (metric === 'bp') {
      prevStr  = prev ? `${prev.sys}/${prev.dia} mmHg` : '—';
      lastStr  = last ? `${last.sys}/${last.dia} mmHg` : '—';
      if (prev && last) { const diff = last.sys - prev.sys; changeStr = (diff > 0 ? '+' : '') + diff + ' mmHg (sys)'; }
    } else {
      prevStr  = prev ? `${prev.val}%` : '—';
      lastStr  = last ? `${last.val}%` : '—';
      if (prev && last) { const diff = (last.val - prev.val).toFixed(1); changeStr = (diff > 0 ? '+' : '') + diff + '%'; }
    }
    const badgeMap = {
      improving: '<span class="trend-badge improving"><span class="trend-arrow">&#8595;</span> Improving</span>',
      worsening: '<span class="trend-badge worsening"><span class="trend-arrow">&#8593;</span> Worsening</span>',
      stable:    '<span class="trend-badge stable">Stable</span>',
      new:       '<span class="trend-badge new">Insufficient Data</span>'
    };
    const famTag = isFAMEnrolled(pid) ? '<span style="font-size:11px;margin-left:6px;" title="FaM enrolled">🥗</span>' : '';
    const lastSeenDays = getBreakdownLastSeenDays(pid);
    const lastVal      = getBreakdownLastValue(pid, metric);
    return { pid, prevStr, lastStr, changeStr, trend, badge: badgeMap[trend] || '', lastSeenDays, lastVal, famTag };
  });

  // ── Sort ────────────────────────────────────────────────────
  switch (currentBreakdownSort) {
    case 'lastseen':
      rows.sort((a, b) => a.lastSeenDays - b.lastSeenDays);
      break;
    case 'improving':
      rows.sort((a, b) => {
        const o = { improving: 0, stable: 1, new: 2, worsening: 3 };
        return (o[a.trend] ?? 99) - (o[b.trend] ?? 99);
      });
      break;
    case 'worsening':
      rows.sort((a, b) => {
        const o = { worsening: 0, stable: 1, new: 2, improving: 3 };
        return (o[a.trend] ?? 99) - (o[b.trend] ?? 99);
      });
      break;
    case 'highest':
      rows.sort((a, b) => {
        if (a.lastVal === null && b.lastVal === null) return 0;
        if (a.lastVal === null) return 1;
        if (b.lastVal === null) return -1;
        return b.lastVal - a.lastVal;
      });
      break;
    case 'lowest':
      rows.sort((a, b) => {
        if (a.lastVal === null && b.lastVal === null) return 0;
        if (a.lastVal === null) return 1;
        if (b.lastVal === null) return -1;
        return a.lastVal - b.lastVal;
      });
      break;
    case 'default':
    default: {
      const o = { worsening: 0, stable: 1, improving: 2, new: 3 };
      rows.sort((a, b) => (o[a.trend] ?? 99) - (o[b.trend] ?? 99));
      break;
    }
  }

  tbody.innerHTML = rows.map(r => `
    <tr onclick="openPatient('${r.pid}')">
      <td><strong>#${r.pid}</strong>${r.famTag}</td>
      <td>${r.prevStr}</td>
      <td>${r.lastStr}</td>
      <td style="color:var(--text-mid);font-size:13px;">${r.changeStr}</td>
      <td>${r.badge}</td>
    </tr>
  `).join('');
}

function setAnalyticsSubTab(tab, btn) {
  document.querySelectorAll('.analytics-sub-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('analyticsPane-outcomes').style.display = tab === 'outcomes' ? '' : 'none';
  document.getElementById('analyticsPane-fam').style.display      = tab === 'fam'      ? '' : 'none';
}

function renderBreakdown() {
  renderPatientBreakdownTable(currentBreakdownMetric);
}
