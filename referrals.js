// ═══════════════════════════════════
// REFERRALSsssss — render, CRUD, filter, status logic
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
        ${r.notes ?
