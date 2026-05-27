// ═══════════════════════════════════
// CHARTS — patient charts, tables, analytics charts
// ═══════════════════════════════════

// ═══════════════════════════════════
// CHARTS
// ═══════════════════════════════════
const goldPalette = { gold: '#C9A84C', goldDim: '#A8893C', goldLight: '#E8D5A3', red: '#C0392B', amber: '#D4850A', green: '#2E7D52', text: '#5C4F38', grid: '#E8D9B8' };

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

function formatDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderBPChart(readings) {
  if (bpChartInst) { bpChartInst.destroy(); bpChartInst = null; }
  const ctx = document.getElementById('bpChart').getContext('2d');
  const labels = readings.map(r => formatDateTime(r.datetime));
  let datasets = [];
  if (bpSeriesMode === 'both' || bpSeriesMode === 'systolic') {
    datasets.push({ label: 'Systolic', data: readings.map(r => r.sys), borderColor: goldPalette.red, backgroundColor: bpChartType==='line' ? 'rgba(192,57,43,0.08)' : readings.map(r => getBPStatus(r.sys,r.dia)==='critical'?'rgba(192,57,43,0.7)':getBPStatus(r.sys,r.dia)==='warning'?'rgba(212,133,10,0.7)':'rgba(201,168,76,0.7)'), tension: 0.3, fill: bpChartType==='line', pointRadius: 5, pointHoverRadius: 7 });
  }
  if (bpSeriesMode === 'both' || bpSeriesMode === 'diastolic') {
    datasets.push({ label: 'Diastolic', data: readings.map(r => r.dia), borderColor: goldPalette.gold, backgroundColor: bpChartType==='line'?'rgba(201,168,76,0.08)':'rgba(201,168,76,0.5)', tension: 0.3, fill: false, pointRadius: 5, pointHoverRadius: 7 });
  }
  bpChartInst = new Chart(ctx, { type: bpChartType, data: { labels, datasets }, options: { ...chartDefaults } });
}

function setBPSeriesMode(mode, btn) {
  bpSeriesMode = mode;
  btn.closest('.chart-toggle').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBPChart(db.patients[currentPatientId]?.bpReadings || []);
}

function renderA1CChart(readings) {
  if (a1cChartInst) { a1cChartInst.destroy(); a1cChartInst = null; }
  const ctx = document.getElementById('a1cChart').getContext('2d');
  a1cChartInst = new Chart(ctx, {
    type: a1cChartType,
    data: {
      labels: readings.map(r => formatDateTime(r.datetime)),
      datasets: [{ label: 'A1C %', data: readings.map(r => r.val), borderColor: goldPalette.goldDim, backgroundColor: a1cChartType==='line'?'rgba(168,137,60,0.12)':readings.map(r=>getA1CStatus(r.val)==='critical'?'rgba(192,57,43,0.7)':getA1CStatus(r.val)==='warning'?'rgba(212,133,10,0.7)':'rgba(46,125,82,0.6)'), tension: 0.3, fill: a1cChartType==='line', pointRadius: 5, pointHoverRadius: 7 }]
    },
    options: chartDefaults
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
  const bpOutcomes = computeBPOutcomes();
  const a1cOutcomes = computeA1COutcomes();
  renderAnalyticsKPIs(bpOutcomes, a1cOutcomes);
  renderBPOutcomesChart(bpOutcomes);
renderA1COutcomesChart(a1cOutcomes);
  renderFAMAnalytics();
  // Update time filter stats
  const range = getTimeFilterRange(currentAnalyticsTimeFilter);
  const statsEl = document.getElementById('analyticsTimeStats');
  if (statsEl && range) {
    const filtered = Object.keys(db.patients).filter(pid => patientHasReadingInRange(pid, range));
    statsEl.textContent = `${filtered.length} patients with readings in period`;
  } else if (statsEl) {
    statsEl.textContent = '';
  }
}

function computeBPOutcomes() {
  let improving = 0, worsening = 0, stable = 0, newPatient = 0;
  const rows = [];
  for (const pid in db.patients) {
    const readings = db.patients[pid].bpReadings || [];
    const trend = getBPTrend(readings);
    if (trend === 'improving') improving++;
    else if (trend === 'worsening') worsening++;
    else if (trend === 'stable') stable++;
    else newPatient++;
    const last = readings.slice(-1)[0];
    const prev = readings.slice(-2)[0];
    rows.push({ pid, trend, last, prev });
  }
  return { improving, worsening, stable, newPatient, rows };
}

function computeA1COutcomes() {
  let improving = 0, worsening = 0, stable = 0, newPatient = 0;
  const rows = [];
  for (const pid in db.patients) {
    const readings = db.patients[pid].a1cReadings || [];
    const trend = getA1CTrend(readings);
    if (trend === 'improving') improving++;
    else if (trend === 'worsening') worsening++;
    else if (trend === 'stable') stable++;
    else newPatient++;
    const last = readings.slice(-1)[0];
    const prev = readings.slice(-2)[0];
    rows.push({ pid, trend, last, prev });
  }
  return { improving, worsening, stable, newPatient, rows };
}

function renderAnalyticsKPIs(bpOutcomes, a1cOutcomes) {
  const totalPts = Object.keys(db.patients).length;
  const totalBPImproving = bpOutcomes.improving;
  const totalA1CImproving = a1cOutcomes.improving;
  const pct = (n, d) => d > 0 ? Math.round((n/d)*100) + '%' : '—';
  document.getElementById('analyticsKPIs').innerHTML = `
    <div class="analytics-kpi gold">
      <div class="kpi-label">Total Patients</div>
      <div class="kpi-val gold">${totalPts}</div>
      <div class="kpi-sub">enrolled in system</div>
    </div>
    <div class="analytics-kpi green">
      <div class="kpi-label">Improving BP</div>
      <div class="kpi-val green">${totalBPImproving}</div>
      <div class="kpi-sub">${pct(totalBPImproving, totalPts)} of patients</div>
    </div>
    <div class="analytics-kpi green">
      <div class="kpi-label">Improving A1C</div>
      <div class="kpi-val green">${totalA1CImproving}</div>
      <div class="kpi-sub">${pct(totalA1CImproving, totalPts)} of patients</div>
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
      datasets: [{ data: [improving, worsening, stable, newPatient], backgroundColor: ['rgba(46,125,82,0.85)','rgba(192,57,43,0.85)','rgba(168,137,60,0.7)','rgba(140,125,96,0.4)'], borderColor: '#FFFDF7', borderWidth: 3 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { font: { family: "'DM Sans', sans-serif", size: 13 }, color: goldPalette.text, padding: 16 } }, tooltip: { backgroundColor: '#1A1208', bodyFont: { family: "'DM Sans', sans-serif", size: 14 }, padding: 14, cornerRadius: 10, callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a,b)=>a+b,0); const pct = total > 0 ? Math.round((ctx.raw/total)*100) : 0; return ` ${ctx.raw} patients (${pct}%)`; } } } } }
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
      datasets: [{ data: [improving, worsening, stable, newPatient], backgroundColor: ['rgba(46,125,82,0.85)','rgba(192,57,43,0.85)','rgba(168,137,60,0.7)','rgba(140,125,96,0.4)'], borderColor: '#FFFDF7', borderWidth: 3 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { font: { family: "'DM Sans', sans-serif", size: 13 }, color: goldPalette.text, padding: 16 } }, tooltip: { backgroundColor: '#1A1208', bodyFont: { family: "'DM Sans', sans-serif", size: 14 }, padding: 14, cornerRadius: 10, callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a,b)=>a+b,0); const pct = total > 0 ? Math.round((ctx.raw/total)*100) : 0; return ` ${ctx.raw} patients (${pct}%)`; } } } } }
  });
}

function setBreakdownMetric(metric, btn) {
  currentBreakdownMetric = metric;
  document.querySelectorAll('.breakdown-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderPatientBreakdownTable(metric);
}

function renderPatientBreakdownTable(metric) {
  const tbody = document.querySelector('#patientBreakdownTable tbody');
  const patients = Object.keys(db.patients);
  if (patients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:28px;font-style:italic;">No patient data</td></tr>';
    return;
  }
  const rows = patients.map(pid => {
    const p = db.patients[pid];
    const readings = metric === 'bp' ? (p.bpReadings || []) : (p.a1cReadings || []);
    const trend = metric === 'bp' ? getBPTrend(readings) : getA1CTrend(readings);
    const last = readings.slice(-1)[0];
    const prev = readings.slice(-2)[0];
    let prevStr = '—', lastStr = '—', changeStr = '—';
    if (metric === 'bp') {
      prevStr = prev ? `${prev.sys}/${prev.dia} mmHg` : '—';
      lastStr = last ? `${last.sys}/${last.dia} mmHg` : '—';
      if (prev && last) { const diff = last.sys - prev.sys; changeStr = (diff > 0 ? '+' : '') + diff + ' mmHg (sys)'; }
    } else {
      prevStr = prev ? `${prev.val}%` : '—';
      lastStr = last ? `${last.val}%` : '—';
      if (prev && last) { const diff = (last.val - prev.val).toFixed(1); changeStr = (diff > 0 ? '+' : '') + diff + '%'; }
    }
    const badgeMap = {
      improving: '<span class="trend-badge improving"><span class="trend-arrow">&#8595;</span> Improving</span>',
      worsening: '<span class="trend-badge worsening"><span class="trend-arrow">&#8593;</span> Worsening</span>',
      stable:    '<span class="trend-badge stable">Stable</span>',
      new:       '<span class="trend-badge new">Insufficient Data</span>'
    };
    return { pid, prevStr, lastStr, changeStr, trend, badge: badgeMap[trend] || '' };
  });
  const order = { worsening: 0, stable: 1, improving: 2, new: 3 };
  rows.sort((a,b) => (order[a.trend]||99) - (order[b.trend]||99));
  tbody.innerHTML = rows.map(r => `
    <tr onclick="openPatient('${r.pid}')">
      <td><strong>#${r.pid}</strong></td>
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
  document.getElementById('analyticsPane-fam').style.display = tab === 'fam' ? '' : 'none';
}
function renderBreakdown() {
renderPatientBreakdownTable(currentBreakdownMetric);
}
