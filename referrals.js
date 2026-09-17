// ═══════════════════════════════════
// REFERRALS — render, CRUD, filter, status logic
// ═══════════════════════════════════

let currentReferralFilter = 'all';
let editingReferralId = null;
let referralListSpecialtyFilter = null;
let referralListClinicFilter = null;

// ═══════════════════════════════════
// STATUS
// ═══════════════════════════════════
function getReferralStatus(ref) {
  return ref.dateCompleted ? 'completed' : 'pending';
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
// RENDER — referral list
// ═══════════════════════════════════
function renderReferrals(filter = '') {
  updateReferralTopbarStats();
  const grid = document.getElementById('referralsGrid');
  if (!grid) return;

  let refs = [...(db.referrals || [])];

  // Drill-down filters (AND)
  if (referralListSpecialtyFilter) {
    refs = refs.filter(r => (r.specialty || 'Unspecified') === referralListSpecialtyFilter);
  }
  if (referralListClinicFilter) {
    refs = refs.filter(r => (r.clinic || 'Unspecified') === referralListClinicFilter);
  }

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

  renderReferralActiveFilters();

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
// ACTIVE FILTER CHIPS (referral list page)
// ═══════════════════════════════════
function renderReferralActiveFilters() {
  const el = document.getElementById('referralActiveFilters');
  if (!el) return;
  const chips = [];
  if (referralListSpecialtyFilter) chips.push(`Specialty: ${escapeHtml(referralListSpecialtyFilter)}`);
  if (referralListClinicFilter) chips.push(`Clinic: ${escapeHtml(referralListClinicFilter)}`);

  if (chips.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'flex';
  el.innerHTML = `
    <span class="referral-filter-chip-label">Filtered by:</span>
    ${chips.map(c => `<span class="referral-filter-chip">${c}</span>`).join('')}
    <button class="referral-filter-clear-btn" onclick="clearReferralListFilters()">Clear</button>
  `;
}

function clearReferralListFilters() {
  referralListSpecialtyFilter = null;
  referralListClinicFilter = null;
  renderReferrals(document.getElementById('referralSearch')?.value.trim() || '');
}

// ═══════════════════════════════════
// FILTER / SEARCH
// ═══════════════════════════════════
function setReferralFilter(filter, btn) {
  currentReferralFilter = filter;
  document.querySelectorAll('#page-referral-list .pt-chip').forEach(b => b.classList.remove('active'));
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
// ANALYTICS — grid landing + detail view
// ═══════════════════════════════════
let referralAnalyticsGroup = 'specialty';
let referralChartMetric = 'rate'; // 'rate' | 'days'
let referralGroupChartInst = null;
let referralDrilldownGroup = null; // { dim: 'specialty'|'clinic', key: string } or null while on the grid

let lastGroupStats = [];
let referralTableSearchTerm = '';
let referralTableSort = { field: 'total', dir: 'desc' };

function setReferralAnalyticsGroup(group, btn) {
  referralAnalyticsGroup = group;
  document.querySelectorAll('#page-referral-analytics .breakdown-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReferralGroupGrid();
}

function setReferralChartMetric(metric, btn) {
  referralChartMetric = metric;
  document.querySelectorAll('#referralChartMetricToggle button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReferralGroupChart(lastGroupStats);
}

function computeReferralGroupStats(refs, groupBy) {
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

function computeReferralKPIs(refs) {
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
  return { total, completed, completionRate, avgDays, completedWithDays };
}

function renderReferralKPIs(refs) {
  const { total, completed, completionRate, avgDays, completedWithDays } = computeReferralKPIs(refs);
  const kpiEl = document.getElementById('referralKPIs');
  if (!kpiEl) return;
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

// Main entry point — toggles between the grid landing and the detail view
function renderReferralAnalytics() {
  const overviewEl = document.getElementById('referralAnalyticsOverview');
  const detailEl = document.getElementById('referralAnalyticsDetail');

  if (referralDrilldownGroup) {
    if (overviewEl) overviewEl.style.display = 'none';
    if (detailEl) detailEl.style.display = 'block';
    renderReferralDrilldownView();
  } else {
    if (detailEl) detailEl.style.display = 'none';
    if (overviewEl) overviewEl.style.display = 'block';
    renderReferralAnalyticsOverview();
  }
}

// GRID LANDING — no chart, just clickable specialty/clinic cards with quick stats
function renderReferralAnalyticsOverview() {
  const breadcrumbEl = document.getElementById('referralDrilldownBreadcrumb');
  if (breadcrumbEl) { breadcrumbEl.style.display = 'none'; breadcrumbEl.innerHTML = ''; }

  const refs = db.referrals || [];
  renderReferralKPIs(refs);
  renderReferralGroupGrid();
}

function renderReferralGroupGrid() {
  const grid = document.getElementById('referralGroupGrid');
  if (!grid) return;
  const refs = db.referrals || [];
  const groupStats = computeReferralGroupStats(refs, referralAnalyticsGroup);

  if (groupStats.length === 0) {
    grid.innerHTML = `<div class="patients-empty-state">
      <div class="patients-empty-icon">📋</div>
      <div class="patients-empty-title">No referrals yet</div>
      <div class="patients-empty-sub">Add a referral to see analytics here</div>
    </div>`;
    return;
  }

  grid.innerHTML = groupStats.map(g => {
    let rateClass = 'low';
    if (g.completionRate >= 80) rateClass = 'high';
    else if (g.completionRate >= 50) rateClass = 'medium';
    return `<div class="referral-group-card" onclick="onReferralGroupClick('${g.key.replace(/'/g, "\\'")}')">
      <div class="referral-group-card-name">${escapeHtml(g.key)}</div>
      <div class="referral-group-card-stats">
        <span class="referral-group-card-total">${g.total} referral${g.total !== 1 ? 's' : ''}</span>
        <span class="referral-group-card-rate ${rateClass}">${g.completionRate}% completed</span>
      </div>
    </div>`;
  }).join('');
}

// DETAIL VIEW — chart + table for one specific specialty or clinic
function renderReferralDrilldownView() {
  const { dim, key } = referralDrilldownGroup;
  const oppositeDim = dim === 'specialty' ? 'clinic' : 'specialty';
  const oppositeLabel = oppositeDim === 'clinic' ? 'Clinic' : 'Specialty';
  const dimLabel = dim === 'clinic' ? 'Clinics' : 'Specialties';

  const breadcrumbEl = document.getElementById('referralDrilldownBreadcrumb');
  if (breadcrumbEl) {
    breadcrumbEl.style.display = 'flex';
    breadcrumbEl.innerHTML = `
      <button class="back-btn" onclick="exitReferralDrilldown()">&#8592; All ${dimLabel}</button>
      <span class="referral-drilldown-title">${escapeHtml(key)}</span>
    `;
  }

  const titleEl = document.getElementById('referralChartTitle');
  const chartSubEl = document.getElementById('referralChartSub');
  if (titleEl) titleEl.textContent = `${key} — by ${oppositeLabel}`;
  if (chartSubEl) chartSubEl.textContent = 'Click a bar to view those referrals';

  const matched = (db.referrals || []).filter(r => ((dim === 'specialty' ? r.specialty : r.clinic) || 'Unspecified') === key);
  renderReferralKPIs(matched);

  const groupStats = computeReferralGroupStats(matched, oppositeDim);
  loadGroupStatsIntoChartAndTable(groupStats, oppositeLabel);
}

function exitReferralDrilldown() {
  referralDrilldownGroup = null;
  renderReferralAnalytics();
}

// Wires freshly computed groupStats into both the chart and the table,
// resetting search/sort state for the new dataset.
function loadGroupStatsIntoChartAndTable(groupStats, headerLabel) {
  lastGroupStats = groupStats;
  referralTableSearchTerm = '';
  referralTableSort = { field: 'total', dir: 'desc' };
  const searchInput = document.getElementById('referralTableSearch');
  if (searchInput) searchInput.value = '';

  renderReferralGroupChart(groupStats);

  const headerEl = document.getElementById('referralTableGroupHeader');
  const subEl = document.getElementById('referralTableSub');
  if (headerEl) headerEl.textContent = headerLabel;
  if (subEl) subEl.textContent = `By ${headerLabel.toLowerCase()} — click a row to view those referrals`;
  renderReferralTableRows();
}

// Clicking a card on the grid enters the detail view for that group.
// Clicking a bar/row inside the detail view navigates to the filtered referral list
// (filtered by BOTH the group you drilled into and the opposite-dimension value clicked).
function onReferralGroupClick(key) {
  if (referralDrilldownGroup) {
    const { dim, key: topKey } = referralDrilldownGroup;
    if (dim === 'specialty') {
      referralListSpecialtyFilter = topKey;
      referralListClinicFilter = key;
    } else {
      referralListClinicFilter = topKey;
      referralListSpecialtyFilter = key;
    }
    showPage('referral-list');
    currentReferralFilter = 'all';
    document.querySelectorAll('#page-referral-list .pt-chip').forEach(b => b.classList.remove('active'));
    const allChip = document.querySelector('#page-referral-list .pt-chip');
    if (allChip) allChip.classList.add('active');
    renderReferrals(document.getElementById('referralSearch')?.value.trim() || '');
  } else {
    referralDrilldownGroup = { dim: referralAnalyticsGroup, key };
    renderReferralAnalytics();
  }
}

// ═══════════════════════════════════
// CHART — horizontal bars, single metric, auto-scaling height
// ═══════════════════════════════════
function renderReferralGroupChart(groupStats) {
  const canvas = document.getElementById('referralGroupChart');
  const container = document.getElementById('referralChartContainer');
  if (!canvas || !container) return;
  if (referralGroupChartInst) referralGroupChartInst.destroy();
  if (groupStats.length === 0) {
    container.style.height = '160px';
    return;
  }

  const sorted = [...groupStats].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));

  const rowHeight = 36;
  container.style.height = Math.max(240, sorted.length * rowHeight + 40) + 'px';

  const labels = sorted.map(g => g.key);
  const isRate = referralChartMetric === 'rate';
  const values = sorted.map(g => isRate ? g.completionRate : (g.avgDays !== null ? g.avgDays : 0));

  referralGroupChartInst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: isRate ? 'Completion Rate (%)' : 'Avg. Days to Completion',
        data: values,
        backgroundColor: isRate ? 'rgba(46,125,82,0.75)' : 'rgba(201,168,76,0.75)'
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onClick: (evt, elements) => {
        if (elements.length) {
          const idx = elements[0].index;
          onReferralGroupClick(labels[idx]);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => isRate ? `${ctx.parsed.x}% completion rate` : `${ctx.parsed.x} avg. days to completion`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: isRate ? 100 : undefined,
          title: { display: true, text: isRate ? 'Completion Rate (%)' : 'Avg. Days' }
        }
      }
    }
  });
}

// ═══════════════════════════════════
// TABLE — sortable, searchable
// ═══════════════════════════════════
function filterReferralBreakdownTable() {
  referralTableSearchTerm = document.getElementById('referralTableSearch')?.value.trim() || '';
  renderReferralTableRows();
}

function sortReferralTable(field) {
  if (referralTableSort.field === field) {
    referralTableSort.dir = referralTableSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    referralTableSort.field = field;
    referralTableSort.dir = field === 'key' ? 'asc' : 'desc';
  }
  renderReferralTableRows();
}

function renderReferralTableRows() {
  const tbody = document.querySelector('#referralBreakdownTable tbody');
  if (!tbody) return;

  let rows = [...lastGroupStats];

  if (referralTableSearchTerm) {
    const q = referralTableSearchTerm.toLowerCase();
    rows = rows.filter(g => g.key.toLowerCase().includes(q));
  }

  const { field, dir } = referralTableSort;
  rows.sort((a, b) => {
    let av = a[field], bv = b[field];
    if (field === 'key') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (field === 'avgDays') { av = av === null ? -1 : av; bv = bv === null ? -1 : bv; }
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-light);font-style:italic;padding:24px;">No matches</td></tr>`;
    updateReferralTableSortIndicators();
    return;
  }

  tbody.innerHTML = rows.map(g => `
    <tr onclick="onReferralGroupClick('${g.key.replace(/'/g, "\\'")}')">
      <td>${escapeHtml(g.key)}</td>
      <td>${g.total}</td>
      <td>${g.completed}</td>
      <td>${g.completionRate}%</td>
      <td>${g.avgDays !== null ? g.avgDays + ' days' : '—'}</td>
    </tr>
  `).join('');

  updateReferralTableSortIndicators();
}

function updateReferralTableSortIndicators() {
  document.querySelectorAll('#referralBreakdownTable thead th[data-sort]').forEach(th => {
    const field = th.getAttribute('data-sort');
    th.classList.toggle('sorted-asc', referralTableSort.field === field && referralTableSort.dir === 'asc');
    th.classList.toggle('sorted-desc', referralTableSort.field === field && referralTableSort.dir === 'desc');
  });
}
