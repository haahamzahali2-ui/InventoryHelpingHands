// ═══════════════════════════════════
// FOOD AS MEDICINE — enrollment, analytics, cohort comparisons
// ═══════════════════════════════════

// ═══════════════════════════════════
// FOOD AS MEDICINE
// ═══════════════════════════════════
let currentFAMPatientId = null;
let famPrePostChartInst = null;
let famTimeSeriesChartInst = null;
let famCohortBPChartInst = null;
let famCohortA1CChartInst = null;

function isFAMEnrolled(pid) {
  const p = db.patients[pid];
  return !!(p && p.famEnrolled && p.famEnrollmentDate);
}

function splitReadingsByEnrollment(readings, enrollmentDate) {
  if (!enrollmentDate || !readings) return { pre: [], post: [] };
  const pre = [], post = [];
  readings.forEach(r => {
    if (!r.datetime) return;
    if (r.datetime < enrollmentDate) pre.push(r);
    else post.push(r);
  });
  return { pre, post };
}

function avgBPSys(readings) {
  if (!readings.length) return null;
  return readings.reduce((s, r) => s + r.sys, 0) / readings.length;
}
function avgBPDia(readings) {
  if (!readings.length) return null;
  return readings.reduce((s, r) => s + r.dia, 0) / readings.length;
}
function avgA1C(readings) {
  if (!readings.length) return null;
  return readings.reduce((s, r) => s + r.val, 0) / readings.length;
}

function renderFAMPatientPanel(pid) {
  const el = document.getElementById('famPatientPanel');
  if (!el) return;
  const p = db.patients[pid];
  if (!p) { el.innerHTML = ''; return; }

  const enrolled = isFAMEnrolled(pid);

  if (!enrolled) {
    el.innerHTML = `
      <div class="fam-panel">
        <div class="fam-panel-header">
          <div class="fam-panel-title">🥗 Food as Medicine</div>
          <span class="fam-status-pill not-enrolled">Not Enrolled</span>
        </div>
        <div class="fam-enrollment-info">
          Enroll this patient in the Food as Medicine program to begin tracking pre/post outcomes.
        </div>
        <button class="fam-enroll-btn" onclick="openFAMEnrollModal('${pid}')">+ Enroll in Program</button>
      </div>`;
    return;
  }

  const enrollDate = p.famEnrollmentDate;
  const programType = p.famProgramType || 'Food as Medicine Program';
  const bpSplit = splitReadingsByEnrollment(p.bpReadings || [], enrollDate);
  const a1cSplit = splitReadingsByEnrollment(p.a1cReadings || [], enrollDate);

  const preBPSys = avgBPSys(bpSplit.pre);
  const postBPSys = avgBPSys(bpSplit.post);
  const preBPDia = avgBPDia(bpSplit.pre);
  const postBPDia = avgBPDia(bpSplit.post);
  const preA1C = avgA1C(a1cSplit.pre);
  const postA1C = avgA1C(a1cSplit.post);

  const fmtBP = v => v !== null ? v.toFixed(0) : '—';
  const fmtA1C = v => v !== null ? v.toFixed(1) + '%' : '—';

  const bpDelta = (preBPSys !== null && postBPSys !== null) ? (postBPSys - preBPSys) : null;
  const a1cDelta = (preA1C !== null && postA1C !== null) ? (postA1C - preA1C) : null;

  const bpDeltaCls = bpDelta === null ? 'stable' : bpDelta <= -5 ? 'improving' : bpDelta >= 5 ? 'worsening' : 'stable';
  const a1cDeltaCls = a1cDelta === null ? 'stable' : a1cDelta <= -0.2 ? 'improving' : a1cDelta >= 0.2 ? 'worsening' : 'stable';

  const bpArrow = bpDelta === null ? '' : bpDelta < 0 ? '↓' : bpDelta > 0 ? '↑' : '→';
  const a1cArrow = a1cDelta === null ? '' : a1cDelta < 0 ? '↓' : a1cDelta > 0 ? '↑' : '→';

  const monthsEnrolled = Math.floor((Date.now() - new Date(enrollDate)) / (1000 * 60 * 60 * 24 * 30));

  let bpComp, a1cComp;
  if (bpSplit.pre.length === 0 && bpSplit.post.length === 0) {
    bpComp = `<div class="fam-comp-empty">No BP readings on file</div>`;
  } else if (bpSplit.pre.length === 0) {
    bpComp = `<div class="fam-comp-empty">No pre-enrollment BP readings — only post-enrollment data (${bpSplit.post.length} reading${bpSplit.post.length !== 1 ? 's' : ''})</div>`;
  } else if (bpSplit.post.length === 0) {
    bpComp = `<div class="fam-comp-empty">No post-enrollment BP readings yet — ${bpSplit.pre.length} pre-enrollment reading${bpSplit.pre.length !== 1 ? 's' : ''} on file</div>`;
  } else {
    bpComp = `
      <div class="fam-comp-row"><span>Pre (${bpSplit.pre.length})</span><span class="fam-comp-val">${fmtBP(preBPSys)}/${fmtBP(preBPDia)}</span></div>
      <div class="fam-comp-row"><span>Post (${bpSplit.post.length})</span><span class="fam-comp-val">${fmtBP(postBPSys)}/${fmtBP(postBPDia)}</span></div>
      <div class="fam-comp-delta ${bpDeltaCls}">${bpArrow} ${bpDelta > 0 ? '+' : ''}${bpDelta.toFixed(0)} mmHg systolic</div>`;
  }

  if (a1cSplit.pre.length === 0 && a1cSplit.post.length === 0) {
    a1cComp = `<div class="fam-comp-empty">No A1C readings on file</div>`;
  } else if (a1cSplit.pre.length === 0) {
    a1cComp = `<div class="fam-comp-empty">No pre-enrollment A1C readings — only post-enrollment data (${a1cSplit.post.length} reading${a1cSplit.post.length !== 1 ? 's' : ''})</div>`;
  } else if (a1cSplit.post.length === 0) {
    a1cComp = `<div class="fam-comp-empty">No post-enrollment A1C readings yet — ${a1cSplit.pre.length} pre-enrollment reading${a1cSplit.pre.length !== 1 ? 's' : ''} on file</div>`;
  } else {
    a1cComp = `
      <div class="fam-comp-row"><span>Pre (${a1cSplit.pre.length})</span><span class="fam-comp-val">${fmtA1C(preA1C)}</span></div>
      <div class="fam-comp-row"><span>Post (${a1cSplit.post.length})</span><span class="fam-comp-val">${fmtA1C(postA1C)}</span></div>
      <div class="fam-comp-delta ${a1cDeltaCls}">${a1cArrow} ${a1cDelta > 0 ? '+' : ''}${a1cDelta.toFixed(1)}%</div>`;
  }

  el.innerHTML = `
    <div class="fam-panel">
      <div class="fam-panel-header">
        <div class="fam-panel-title">🥗 Food as Medicine</div>
        <span class="fam-status-pill enrolled">✓ Enrolled</span>
      </div>
      <div class="fam-enrollment-info">
        <strong>${escapeHtml(programType)}</strong> · Enrolled ${formatDateTime(enrollDate)} · ${monthsEnrolled} month${monthsEnrolled !== 1 ? 's' : ''} in program
      </div>
      <div class="fam-comparison-grid">
        <div class="fam-comparison-card">
          <div class="fam-comp-label">Blood Pressure</div>
          ${bpComp}
        </div>
        <div class="fam-comparison-card">
          <div class="fam-comp-label">A1C</div>
          ${a1cComp}
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="fam-enroll-btn unenroll" onclick="openFAMEnrollModal('${pid}')">Edit Enrollment</button>
        <button class="fam-enroll-btn unenroll" onclick="confirmUnenrollFAM('${pid}')" style="color:var(--alert-red);border-color:#f3b0aa;">Remove from Program</button>
      </div>
    </div>`;
}

function openFAMEnrollModal(pid) {
  currentFAMPatientId = pid;
  const p = db.patients[pid];
  document.getElementById('famEnrollModalSub').textContent = `Patient #${pid}`;
  document.getElementById('fam-enroll-date').value = (p && p.famEnrollmentDate) || new Date().toISOString().slice(0, 10);
  document.getElementById('fam-program-type').value = (p && p.famProgramType) || '';
  document.getElementById('famEnrollModal').classList.add('open');
}

async function saveFAMEnrollment() {
  if (!currentFAMPatientId) return;
  const date = document.getElementById('fam-enroll-date').value;
  const programType = document.getElementById('fam-program-type').value.trim();
  if (!date) { showToast('Please enter an enrollment date'); return; }
  if (!programType) { showToast('Please enter a program type'); return; }

  const p = db.patients[currentFAMPatientId];
  if (!p) return;
  p.famEnrolled = true;
  p.famEnrollmentDate = date;
  p.famProgramType = programType;
  saveDB();
  closeModal('famEnrollModal');
  renderFAMPatientPanel(currentFAMPatientId);
  renderPatientsGrid();
  renderHomeStats();
  showToast(`🥗 Patient #${currentFAMPatientId} enrolled in ${programType}`);

  try {
    await postToSheetBackend('add_fam_enrollment', {
      patientId: currentFAMPatientId,
      enrollmentDate: date,
      programType: programType
    });
  } catch (e) {
    showToast('Enrollment saved locally; sheet sync failed');
  }
}

async function confirmUnenrollFAM(pid) {
  if (!confirm(`Remove Patient #${pid} from the Food as Medicine program?\n\nThis will not delete any readings — only the enrollment record.`)) return;
  const p = db.patients[pid];
  if (!p) return;
  p.famEnrolled = false;
  delete p.famEnrollmentDate;
  delete p.famProgramType;
  saveDB();
  renderFAMPatientPanel(pid);
  renderPatientsGrid();
  renderHomeStats();
  showToast(`Patient #${pid} removed from program`);

  try {
    await postToSheetBackend('remove_fam_enrollment', { patientId: pid });
  } catch (e) {
    showToast('Removed locally; sheet sync failed');
  }
}

function getFAMCohortStats() {
  const enrolled = [];
  const notEnrolled = [];

  for (const pid in db.patients) {
    const p = db.patients[pid];
    if (isFAMEnrolled(pid)) {
      const split_bp = splitReadingsByEnrollment(p.bpReadings || [], p.famEnrollmentDate);
      const split_a1c = splitReadingsByEnrollment(p.a1cReadings || [], p.famEnrollmentDate);
      enrolled.push({
        pid, p,
        enrollDate: p.famEnrollmentDate,
        programType: p.famProgramType || '',
        preBPSys: avgBPSys(split_bp.pre),
        postBPSys: avgBPSys(split_bp.post),
        preBPDia: avgBPDia(split_bp.pre),
        postBPDia: avgBPDia(split_bp.post),
        preA1C: avgA1C(split_a1c.pre),
        postA1C: avgA1C(split_a1c.post),
        bpReadings: p.bpReadings || [],
        a1cReadings: p.a1cReadings || []
      });
    } else {
      notEnrolled.push({ pid, p, bpTrend: getBPTrend(p.bpReadings || []), a1cTrend: getA1CTrend(p.a1cReadings || []) });
    }
  }
  return { enrolled, notEnrolled };
}

function renderFAMAnalytics() {
  const { enrolled, notEnrolled } = getFAMCohortStats();
  const container = document.getElementById('famContent');
  if (!container) return;

  document.getElementById('famSectionMeta').textContent =
    enrolled.length === 0
      ? 'No patients enrolled yet'
      : `${enrolled.length} patient${enrolled.length !== 1 ? 's' : ''} enrolled · ${notEnrolled.length} not enrolled`;

  if (enrolled.length === 0) {
    container.innerHTML = `
      <div class="fam-empty-state">
        <div class="fam-empty-icon">🥗</div>
        <h4>No patients enrolled yet</h4>
        <div>Enroll patients from their detail page to begin tracking food-as-medicine outcomes.</div>
      </div>`;
    return;
  }

  const enrolledWithBPDelta = enrolled.filter(e => e.preBPSys !== null && e.postBPSys !== null);
  const enrolledWithA1CDelta = enrolled.filter(e => e.preA1C !== null && e.postA1C !== null);

  const avgBPDelta = enrolledWithBPDelta.length
    ? enrolledWithBPDelta.reduce((s, e) => s + (e.postBPSys - e.preBPSys), 0) / enrolledWithBPDelta.length
    : null;
  const avgA1CDelta = enrolledWithA1CDelta.length
    ? enrolledWithA1CDelta.reduce((s, e) => s + (e.postA1C - e.preA1C), 0) / enrolledWithA1CDelta.length
    : null;

  const enrolledImprovingBP = enrolledWithBPDelta.filter(e => (e.postBPSys - e.preBPSys) <= -5).length;
  const enrolledImprovingA1C = enrolledWithA1CDelta.filter(e => (e.postA1C - e.preA1C) <= -0.2).length;
  const notEnrolledImprovingBP = notEnrolled.filter(e => e.bpTrend === 'improving').length;
  const notEnrolledImprovingA1C = notEnrolled.filter(e => e.a1cTrend === 'improving').length;

  const enrolledBPRate = enrolledWithBPDelta.length ? Math.round((enrolledImprovingBP / enrolledWithBPDelta.length) * 100) : 0;
  const enrolledA1CRate = enrolledWithA1CDelta.length ? Math.round((enrolledImprovingA1C / enrolledWithA1CDelta.length) * 100) : 0;
  const notEnrolledBPRate = notEnrolled.length ? Math.round((notEnrolledImprovingBP / notEnrolled.length) * 100) : 0;
  const notEnrolledA1CRate = notEnrolled.length ? Math.round((notEnrolledImprovingA1C / notEnrolled.length) * 100) : 0;

  const fmtDelta = (v, unit) => v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}${unit}`;
  const deltaClass = (v, threshold) => v === null ? 'gold' : v <= -threshold ? 'green' : v >= threshold ? 'red' : 'amber';

  const kpisHTML = `
    <div class="fam-kpi-row">
      <div class="analytics-kpi green">
        <div class="kpi-label">Enrolled Patients</div>
        <div class="kpi-val green">${enrolled.length}</div>
        <div class="kpi-sub">in Food as Medicine program</div>
      </div>
      <div class="analytics-kpi ${deltaClass(avgBPDelta, 5)}">
        <div class="kpi-label">Avg BP Change</div>
        <div class="kpi-val ${deltaClass(avgBPDelta, 5)}">${fmtDelta(avgBPDelta, '')}</div>
        <div class="kpi-sub">mmHg systolic, post − pre (n=${enrolledWithBPDelta.length})</div>
      </div>
      <div class="analytics-kpi ${deltaClass(avgA1CDelta, 0.2)}">
        <div class="kpi-label">Avg A1C Change</div>
        <div class="kpi-val ${deltaClass(avgA1CDelta, 0.2)}">${fmtDelta(avgA1CDelta, '%')}</div>
        <div class="kpi-sub">post − pre (n=${enrolledWithA1CDelta.length})</div>
      </div>
      <div class="analytics-kpi gold">
        <div class="kpi-label">% Improving (BP)</div>
        <div class="kpi-val gold">${enrolledBPRate}%</div>
        <div class="kpi-sub">of enrolled patients</div>
      </div>
    </div>`;

  const chartsHTML = `
    <div class="fam-charts-grid">
      <div class="analytics-card">
        <div class="analytics-card-title">Pre vs Post Enrollment</div>
        <div class="analytics-card-sub">Cohort average BP and A1C before vs after enrollment date.</div>
        <div class="analytics-chart-container"><canvas id="famPrePostChart"></canvas></div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-title">Outcomes Over Time</div>
        <div class="analytics-card-sub">Average post-enrollment readings by months since enrollment, across the cohort.</div>
        <div class="analytics-chart-container"><canvas id="famTimeSeriesChart"></canvas></div>
      </div>
    </div>

    <div class="fam-charts-grid">
      <div class="analytics-card">
        <div class="analytics-card-title">BP: Enrolled vs Non-Enrolled</div>
        <div class="analytics-card-sub">Percent of patients with improving systolic BP trend in each cohort.</div>
        <div class="analytics-chart-container"><canvas id="famCohortBPChart"></canvas></div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-title">A1C: Enrolled vs Non-Enrolled</div>
        <div class="analytics-card-sub">Percent of patients with improving A1C trend in each cohort.</div>
        <div class="analytics-chart-container"><canvas id="famCohortA1CChart"></canvas></div>
      </div>
    </div>

    <div class="analytics-card">
      <div class="analytics-card-title">Enrolled Patient Breakdown</div>
      <div class="analytics-card-sub">Per-patient pre/post comparison. Click any row to open that patient's chart.</div>
      <table class="patient-breakdown-table" id="famPatientTable">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Program</th>
            <th>Enrolled</th>
            <th>Pre BP / A1C</th>
            <th>Post BP / A1C</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>`;

  container.innerHTML = kpisHTML + chartsHTML;

  setTimeout(() => {
    renderFAMPrePostChart(enrolledWithBPDelta, enrolledWithA1CDelta);
    renderFAMTimeSeriesChart(enrolled);
    renderFAMCohortBPChart(enrolledBPRate, notEnrolledBPRate);
    renderFAMCohortA1CChart(enrolledA1CRate, notEnrolledA1CRate);
    renderFAMPatientTable(enrolled);
  }, 50);
}

function renderFAMPrePostChart(bpData, a1cData) {
  if (famPrePostChartInst) { famPrePostChartInst.destroy(); famPrePostChartInst = null; }
  const ctx = document.getElementById('famPrePostChart');
  if (!ctx) return;

  const avgPreBPSys = bpData.length ? bpData.reduce((s, e) => s + e.preBPSys, 0) / bpData.length : 0;
  const avgPostBPSys = bpData.length ? bpData.reduce((s, e) => s + e.postBPSys, 0) / bpData.length : 0;
  const avgPreA1C = a1cData.length ? a1cData.reduce((s, e) => s + e.preA1C, 0) / a1cData.length : 0;
  const avgPostA1C = a1cData.length ? a1cData.reduce((s, e) => s + e.postA1C, 0) / a1cData.length : 0;

  famPrePostChartInst = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Systolic BP (mmHg)', 'A1C (%)'],
      datasets: [
        { label: 'Pre-Enrollment', data: [avgPreBPSys.toFixed(1), avgPreA1C.toFixed(1)], backgroundColor: 'rgba(192,57,43,0.6)', borderColor: goldPalette.red, borderWidth: 2, borderRadius: 8 },
        { label: 'Post-Enrollment', data: [avgPostBPSys.toFixed(1), avgPostA1C.toFixed(1)], backgroundColor: 'rgba(46,125,82,0.6)', borderColor: goldPalette.green, borderWidth: 2, borderRadius: 8 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: "'DM Sans', sans-serif", size: 13 }, color: goldPalette.text, padding: 14 } },
        tooltip: { backgroundColor: '#1A1208', padding: 12, cornerRadius: 10 }
      },
      scales: {
        x: { ticks: { font: { family: "'DM Sans'", size: 12 }, color: goldPalette.text }, grid: { display: false } },
        y: { beginAtZero: false, ticks: { font: { family: "'DM Sans'", size: 11 }, color: goldPalette.text }, grid: { color: goldPalette.grid } }
      }
    }
  });
}

function renderFAMTimeSeriesChart(enrolled) {
  if (famTimeSeriesChartInst) { famTimeSeriesChartInst.destroy(); famTimeSeriesChartInst = null; }
  const ctx = document.getElementById('famTimeSeriesChart');
  if (!ctx) return;

  const bpByMonth = {};
  const a1cByMonth = {};

  enrolled.forEach(e => {
    const enrollMs = new Date(e.enrollDate).getTime();
    e.bpReadings.forEach(r => {
      if (!r.datetime || r.datetime < e.enrollDate) return;
      const months = Math.floor((new Date(r.datetime).getTime() - enrollMs) / (1000 * 60 * 60 * 24 * 30));
      if (!bpByMonth[months]) bpByMonth[months] = [];
      bpByMonth[months].push(r.sys);
    });
    e.a1cReadings.forEach(r => {
      if (!r.datetime || r.datetime < e.enrollDate) return;
      const months = Math.floor((new Date(r.datetime).getTime() - enrollMs) / (1000 * 60 * 60 * 24 * 30));
      if (!a1cByMonth[months]) a1cByMonth[months] = [];
      a1cByMonth[months].push(r.val);
    });
  });

  const maxMonth = Math.max(0, ...Object.keys(bpByMonth).map(Number), ...Object.keys(a1cByMonth).map(Number));
  const labels = [];
  const bpAvgs = [];
  const a1cAvgs = [];
  for (let m = 0; m <= maxMonth; m++) {
    labels.push(`Month ${m}`);
    bpAvgs.push(bpByMonth[m] && bpByMonth[m].length ? +(bpByMonth[m].reduce((a, b) => a + b, 0) / bpByMonth[m].length).toFixed(1) : null);
    a1cAvgs.push(a1cByMonth[m] && a1cByMonth[m].length ? +(a1cByMonth[m].reduce((a, b) => a + b, 0) / a1cByMonth[m].length).toFixed(2) : null);
  }

  famTimeSeriesChartInst = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Avg Systolic BP', data: bpAvgs, borderColor: goldPalette.red, backgroundColor: 'rgba(192,57,43,0.08)', tension: 0.3, fill: false, yAxisID: 'y', pointRadius: 5, pointHoverRadius: 7, spanGaps: true },
        { label: 'Avg A1C %', data: a1cAvgs, borderColor: goldPalette.goldDim, backgroundColor: 'rgba(168,137,60,0.08)', tension: 0.3, fill: false, yAxisID: 'y1', pointRadius: 5, pointHoverRadius: 7, spanGaps: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: "'DM Sans', sans-serif", size: 13 }, color: goldPalette.text, padding: 14 } },
        tooltip: { backgroundColor: '#1A1208', padding: 12, cornerRadius: 10 }
      },
      scales: {
        x: { ticks: { font: { family: "'DM Sans'", size: 11 }, color: goldPalette.text }, grid: { color: goldPalette.grid } },
        y:  { type: 'linear', position: 'left',  title: { display: true, text: 'BP (mmHg)', color: goldPalette.red    }, ticks: { color: goldPalette.text }, grid: { color: goldPalette.grid } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: 'A1C (%)',  color: goldPalette.goldDim }, ticks: { color: goldPalette.text }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

function renderFAMCohortBPChart(enrolledPct, notEnrolledPct) {
  if (famCohortBPChartInst) { famCohortBPChartInst.destroy(); famCohortBPChartInst = null; }
  const ctx = document.getElementById('famCohortBPChart');
  if (!ctx) return;
  famCohortBPChartInst = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Enrolled', 'Not Enrolled'],
      datasets: [{ label: '% Improving', data: [enrolledPct, notEnrolledPct], backgroundColor: ['rgba(46,125,82,0.75)', 'rgba(168,137,60,0.55)'], borderColor: [goldPalette.green, goldPalette.goldDim], borderWidth: 2, borderRadius: 10 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1A1208', padding: 12, cornerRadius: 10, callbacks: { label: c => ` ${c.raw}% improving` } } },
      scales: {
        x: { ticks: { font: { family: "'DM Sans'", size: 13 }, color: goldPalette.text }, grid: { display: false } },
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', color: goldPalette.text }, grid: { color: goldPalette.grid } }
      }
    }
  });
}

function renderFAMCohortA1CChart(enrolledPct, notEnrolledPct) {
  if (famCohortA1CChartInst) { famCohortA1CChartInst.destroy(); famCohortA1CChartInst = null; }
  const ctx = document.getElementById('famCohortA1CChart');
  if (!ctx) return;
  famCohortA1CChartInst = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Enrolled', 'Not Enrolled'],
      datasets: [{ label: '% Improving', data: [enrolledPct, notEnrolledPct], backgroundColor: ['rgba(46,125,82,0.75)', 'rgba(168,137,60,0.55)'], borderColor: [goldPalette.green, goldPalette.goldDim], borderWidth: 2, borderRadius: 10 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1A1208', padding: 12, cornerRadius: 10, callbacks: { label: c => ` ${c.raw}% improving` } } },
      scales: {
        x: { ticks: { font: { family: "'DM Sans'", size: 13 }, color: goldPalette.text }, grid: { display: false } },
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', color: goldPalette.text }, grid: { color: goldPalette.grid } }
      }
    }
  });
}

function renderFAMPatientTable(enrolled) {
  const tbody = document.querySelector('#famPatientTable tbody');
  if (!tbody) return;
  if (!enrolled.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:24px;font-style:italic;">No enrolled patients</td></tr>';
    return;
  }

  const rows = enrolled.map(e => {
    const preBP = (e.preBPSys !== null && e.preBPDia !== null) ? `${e.preBPSys.toFixed(0)}/${e.preBPDia.toFixed(0)}` : '—';
    const postBP = (e.postBPSys !== null && e.postBPDia !== null) ? `${e.postBPSys.toFixed(0)}/${e.postBPDia.toFixed(0)}` : '—';
    const preA1C = e.preA1C !== null ? `${e.preA1C.toFixed(1)}%` : '—';
    const postA1C = e.postA1C !== null ? `${e.postA1C.toFixed(1)}%` : '—';

    const bpDelta = (e.preBPSys !== null && e.postBPSys !== null) ? e.postBPSys - e.preBPSys : null;
    const a1cDelta = (e.preA1C !== null && e.postA1C !== null) ? e.postA1C - e.preA1C : null;

    const bpImproved = bpDelta !== null && bpDelta <= -5;
    const a1cImproved = a1cDelta !== null && a1cDelta <= -0.2;
    const bpWorse = bpDelta !== null && bpDelta >= 5;
    const a1cWorse = a1cDelta !== null && a1cDelta >= 0.2;

    let outcome, sortKey;
    if (bpWorse || a1cWorse) { outcome = '<span class="trend-badge worsening"><span class="trend-arrow">↑</span> Worsening</span>'; sortKey = 0; }
    else if (bpImproved || a1cImproved) { outcome = '<span class="trend-badge improving"><span class="trend-arrow">↓</span> Improving</span>'; sortKey = 2; }
    else if (bpDelta !== null || a1cDelta !== null) { outcome = '<span class="trend-badge stable">Stable</span>'; sortKey = 1; }
    else { outcome = '<span class="trend-badge new">Insufficient Data</span>'; sortKey = 3; }

    return { e, preBP, postBP, preA1C, postA1C, outcome, sortKey };
  });

  rows.sort((a, b) => a.sortKey - b.sortKey);

  tbody.innerHTML = rows.map(r => `
    <tr onclick="openPatient('${r.e.pid}')">
      <td><strong>#${r.e.pid}</strong></td>
      <td style="font-size:13px;color:var(--text-mid);">${escapeHtml(r.e.programType || '—')}</td>
      <td style="font-size:13px;color:var(--text-mid);">${formatDateTime(r.e.enrollDate)}</td>
      <td>${r.preBP} / ${r.preA1C}</td>
      <td>${r.postBP} / ${r.postA1C}</td>
      <td>${r.outcome}</td>
    </tr>
  `).join('');
}
