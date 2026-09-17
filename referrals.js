// ═══════════════════════════════════
// REFERRALS — render, CRUD, filter, status logic
// ═══════════════════════════════════

let currentReferralFilter = 'all';
let editingReferralId = null;

// ═══════════════════════════════════
// STATUS
// ═══════════════════════════════════
function getReferralStatus(ref) {
  return ref.dateCompleted ? 'completed' : 'pending';
}

// ═══════════════════════════════════
// RENDER
// ═══════════════════════════════════
function renderReferrals(filter = '') {
  const grid = document.getElementById('referralsGrid');
  if (!grid) return;

  let refs = [...(db.referrals || [])];

  // Search filter (patient id, specialty, clinic)
  const search = filter.trim().toLowerCase();
  if (search) {
    refs = refs.filter(r =>
      String(r.patientId).toLowerCase().includes(search) ||
      String(r.specialty).toLowerCase().includes(search) ||
      String(r.clinic).toLowerCase().includes(search)
    );
  }

  // Status filter
  if (currentReferralFilter !== 'all') {
    refs = refs.filter(r => getReferralStatus(r) === currentReferralFilter);
  }

  // Sort: pending first, then most recently sent
  refs.sort((a, b) => {
    const aStatus = getReferralStatus(a), bStatus = getReferralStatus(b);
    if (aStatus !== bStatus) return aStatus === 'pending' ? -1 : 1;
    return new Date(b.dateSent || 0) - new Date(a.dateSent || 0);
  });

  const countEl = document.getElementById('referralCountLabel');
  if (countEl) countEl.textContent = `${refs.length} referral${refs.length !== 1 ? 's' : ''}`;

  if (refs.length === 0) {
    grid.innerHTML = `<div class="patients-empty-state">
      <div class="patients-empty-icon">📋</div>
      <div class="patients-empty-title">No referrals found</div>
      <div class="patients-empty-sub">Try adjusting your search or filters, or add a new referral</div>
    </div>`;
    return;
  }

  grid.innerHTML = refs.map(r => {
    const status = getReferralStatus(r);
    const statusLabel = status === 'completed' ? 'Completed' : 'Pending';
    return `<div class="referral-card ${status}" onclick="openEditReferralModal('${r.referralId}')">
      <div class="referral-card-stripe"></div>
      <div class="referral-card-body">
        <div class="referral-card-header">
          <div class="referral-card-id-group">
            <span class="referral-card-id-label">Patient</span>
            <span class="referral-card-id">#${escapeHtml(r.patientId)}</span>
          </div>
          <span class="referral-status-badge ${status}">${statusLabel}</span>
        </div>
        <div class="referral-card-specialty">${escapeHtml(r.specialty) || '—'}</div>
        <div class="referral-card-clinic">${escapeHtml(r.clinic) || '—'}</div>
        <div class="referral-card-dates">
          <div class="referral-date-block">
            <div class="referral-date-label">Sent</div>
            <div class="referral-date-val">${r.dateSent ? formatDateShort(r.dateSent) : '—'}</div>
          </div>
          <div class="referral-date-block">
            <div class="referral-date-label">Completed</div>
            <div class="referral-date-val">${r.dateCompleted ? formatDateShort(r.dateCompleted) : '—'}</div>
          </div>
        </div>
        ${r.notes ? `<div class="referral-card-notes">${escapeHtml(r.notes)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ═══════════════════════════════════
// FILTER / SEARCH
// ═══════════════════════════════════
function setReferralFilter(filter, btn) {
  currentReferralFilter = filter;
  document.querySelectorAll('#page-referral-hub .pt-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReferrals(document.getElementById('referralSearch')?.value.trim() || '');
}

function filterReferrals() {
  const v = document.getElementById('referralSearch').value.trim();
  renderReferrals(v);
}

// ═══════════════════════════════════
// MODAL — ADD / EDIT
// ═══════════════════════════════════
function openAddReferralModal() {
  editingReferralId = null;
  document.getElementById('referralModalTitle').textContent = 'Add Referral';
  document.getElementById('ref-patient-id').value = '';
  document.getElementById('ref-specialty').value = '';
  document.getElementById('ref-clinic').value = '';
  document.getElementById('ref-date-sent').value = new Date().toISOString().slice(0,10);
  document.getElementById('ref-date-completed').value = '';
  document.getElementById('ref-notes').value = '';
  document.getElementById('referralDeleteBar').classList.remove('show');
  document.getElementById('referralDeleteTrigger').style.display = 'none';
  document.getElementById('referralModal').classList.add('open');
}

function openEditReferralModal(referralId) {
  const ref = (db.referrals || []).find(r => r.referralId === referralId);
  if (!ref) return;
  editingReferralId = referralId;
  document.getElementById('referralModalTitle').textContent = 'Edit Referral';
  document.getElementById('ref-patient-id').value = ref.patientId;
  document.getElementById('ref-specialty').value = ref.specialty;
  document.getElementById('ref-clinic').value = ref.clinic;
  document.getElementById('ref-date-sent').value = ref.dateSent || '';
  document.getElementById('ref-date-completed').value = ref.dateCompleted || '';
  document.getElementById('ref-notes').value = ref.notes || '';
  document.getElementById('referralDeleteBar').classList.remove('show');
  document.getElementById('referralDeleteTrigger').style.display = 'inline-block';
  document.getElementById('referralModal').classList.add('open');
}

// ═══════════════════════════════════
// SAVE — updates UI instantly, syncs to sheet in background
// ═══════════════════════════════════
function saveReferral() {
  const patientId = document.getElementById('ref-patient-id').value.trim();
  const specialty = document.getElementById('ref-specialty').value.trim();
  const clinic = document.getElementById('ref-clinic').value.trim();
  const dateSent = document.getElementById('ref-date-sent').value;
  const dateCompleted = document.getElementById('ref-date-completed').value;
  const notes = document.getElementById('ref-notes').value.trim();

  if (!patientId || !specialty || !dateSent) {
    showToast('Please fill in Patient ID, Specialty, and Date Sent');
    return;
  }

  if (!db.referrals) db.referrals = [];

  if (editingReferralId) {
    const ref = db.referrals.find(r => r.referralId === editingReferralId);
    if (ref) {
      ref.patientId = patientId;
      ref.specialty = specialty;
      ref.clinic = clinic;
      ref.dateSent = dateSent;
      ref.dateCompleted = dateCompleted;
      ref.notes = notes;
    }
    saveDB();
    closeModal('referralModal');
    renderReferrals(document.getElementById('referralSearch')?.value.trim() || '');
    showToast('Referral updated ✓');

    postToSheetBackend('update_referral', {
      referralId: editingReferralId, specialty, clinic, dateSent, dateCompleted, notes
    }).catch(() => showToast('Referral updated locally; Google Sheets write failed.'));
  } else {
    const referralId = `REF-${patientId}-${Date.now()}`;
    const newRef = { referralId, patientId, specialty, clinic, dateSent, dateCompleted, notes };
    db.referrals.push(newRef);
    saveDB();
    closeModal('referralModal');
    renderReferrals(document.getElementById('referralSearch')?.value.trim() || '');
    showToast('Referral added ✓');

    postToSheetBackend('add_referral', newRef)
      .catch(() => showToast('Referral saved locally; Google Sheets write failed.'));
  }
}

// ═══════════════════════════════════
// DELETE — updates UI instantly, syncs to sheet in background
// ═══════════════════════════════════
function confirmDeleteReferral() {
  if (!editingReferralId) return;
  const idToDelete = editingReferralId;
  db.referrals = (db.referrals || []).filter(r => r.referralId !== idToDelete);
  saveDB();
  closeModal('referralModal');
  renderReferrals(document.getElementById('referralSearch')?.value.trim() || '');
  showToast('Referral deleted');

  postToSheetBackend('delete_referral', { referralId: idToDelete })
    .catch(() => showToast('Referral deleted locally; Google Sheets write failed.'));
}
// ═══════════════════════════════════
// TOPBAR STATS
// ═══════════════════════════════════
function updateReferralTopbarStats() {
  const refs = db.referrals || [];
  const pending = refs.filter(r => !r.dateCompleted).length;
  const completed = refs.filter(r => r.dateCompleted).length;
  const rate = refs.length ? Math.round((completed / refs.length) * 100) : 0;

  const pendingEl = document.getElementById('stat-referrals-pending');
  const rateEl = document.getElementById('stat-referral-rate');
  if (pendingEl) pendingEl.textContent = pending;
  if (rateEl) rateEl.textContent = refs.length ? `${rate}%` : '—';
}
// ═══════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════
let referralAnalyticsGroup = 'specialty';
let referralGroupChartInst = null;

function setReferralAnalyticsGroup(group, btn) {
  referralAnalyticsGroup = group;
  document.querySelectorAll('#page-referral-analytics .breakdown-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReferralAnalytics();
}

function computeReferralGroupStats(groupBy) {
  const refs = db.referrals || [];
  const groups = {};
  refs.forEach(r => {
    const key = (groupBy === 'clinic' ? r.clinic : r.specialty) || 'Unspecified';
    if (!groups[key]) groups[key] = { total: 0, completed: 0, totalDays: 0, completedWithDays: 0 };
    groups[key].total++;
    if (r.dateCompleted) {
      groups[key].completed++;
      const sent = new Date(r.dateSent);
      const done = new Date(r.dateCompleted);
      if (!isNaN(sent) && !isNaN(done)) {
        const days = Math.round((done - sent) / 86400000);
        if (days >= 0) {
          groups[key].totalDays += days;
          groups[key].completedWithDays++;
        }
      }
    }
  });
  return Object.keys(groups).sort().map(key => {
    const g = groups[key];
    return {
      key,
      total: g.total,
      completed: g.completed,
      completionRate: g.total ? Math.round((g.completed / g.total) * 100) : 0,
      avgDays: g.completedWithDays ? Math.round(g.totalDays / g.completedWithDays) : null
    };
  });
}

function renderReferralAnalytics() {
  const refs = db.referrals || [];
  const total = refs.length;
  const completed = refs.filter(r => r.dateCompleted).length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  let totalDays = 0, completedWithDays = 0;
  refs.forEach(r => {
    if (r.dateCompleted) {
      const sent = new Date(r.dateSent);
      const done = new Date(r.dateCompleted);
      if (!isNaN(sent) && !isNaN(done)) {
        const days = Math.round((done - sent) / 86400000);
        if (days >= 0) { totalDays += days; completedWithDays++; }
      }
    }
  });
  const avgDays = completedWithDays ? Math.round(totalDays / completedWithDays) : null;

  const kpiEl = document.getElementById('referralKPIs');
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="analytics-kpi gold">
        <div class="kpi-val gold">${total}</div>
        <div class="kpi-label">Total Referrals</div>
      </div>
      <div class="analytics-kpi green">
        <div class="kpi-val green">${completionRate}%</div>
        <div class="kpi-label">Completion Rate</div>
        <div class="kpi-sub">${completed} of ${total} completed</div>
      </div>
      <div class="analytics-kpi amber">
        <div class="kpi-val amber">${total - completed}</div>
        <div class="kpi-label">Pending</div>
      </div>
      <div class="analytics-kpi gold">
        <div class="kpi-val gold">${avgDays !== null ? avgDays : '—'}</div>
        <div class="kpi-label">Avg. Days to Completion</div>
        <div class="kpi-sub">${completedWithDays ? `across ${completedWithDays} completed` : 'no completed referrals yet'}</div>
      </div>
    `;
  }

  const groupStats = computeReferralGroupStats(referralAnalyticsGroup);
  renderReferralGroupChart(groupStats);
  renderReferralBreakdownTable(groupStats);
}

function renderReferralGroupChart(groupStats) {
  const canvas = document.getElementById('referralGroupChart');
  if (!canvas) return;
  if (referralGroupChartInst) referralGroupChartInst.destroy();
  if (groupStats.length === 0) return;

  const labels = groupStats.map(g => g.key);
  const rates = groupStats.map(g => g.completionRate);
  const avgDaysData = groupStats.map(g => g.avgDays !== null ? g.avgDays : 0);

  referralGroupChartInst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Completion Rate (%)', data: rates, backgroundColor: 'rgba(46,125,82,0.75)', yAxisID: 'yRate' },
        { label: 'Avg. Days to Completion', data: avgDaysData, backgroundColor: 'rgba(201,168,76,0.75)', yAxisID: 'yDays' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        yRate: { type: 'linear', position: 'left', beginAtZero: true, max: 100, title: { display: true, text: 'Completion Rate (%)' } },
        yDays: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Avg. Days' } }
      }
    }
  });
}

function renderReferralBreakdownTable(groupStats) {
  const tbody = document.querySelector('#referralBreakdownTable tbody');
  const headerEl = document.getElementById('referralTableGroupHeader');
  const subEl = document.getElementById('referralTableSub');
  if (headerEl) headerEl.textContent = referralAnalyticsGroup === 'clinic' ? 'Clinic' : 'Specialty';
  if (subEl) subEl.textContent = referralAnalyticsGroup === 'clinic' ? 'By clinic' : 'By specialty';
  if (!tbody) return;

  if (groupStats.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-light);font-style:italic;padding:24px;">No referrals yet</td></tr>`;
    return;
  }

  tbody.innerHTML = groupStats.map(g => `
    <tr>
      <td>${escapeHtml(g.key)}</td>
      <td>${g.total}</td>
      <td>${g.completed}</td>
      <td>${g.completionRate}%</td>
      <td>${g.avgDays !== null ? g.avgDays + ' days' : '—'}</td>
    </tr>
  `).join('');
}
