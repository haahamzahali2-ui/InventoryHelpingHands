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
// SAVE
// ═══════════════════════════════════
async function saveReferral() {
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
    try {
      await postToSheetBackend('update_referral', {
        referralId: editingReferralId, specialty, clinic, dateSent, dateCompleted, notes
      });
    } catch(e) { showToast('Referral updated locally; Google Sheets write failed.'); }
    showToast('Referral updated ✓');
  } else {
    const referralId = `REF-${patientId}-${Date.now()}`;
    const newRef = { referralId, patientId, specialty, clinic, dateSent, dateCompleted, notes };
    db.referrals.push(newRef);
    saveDB();
    try {
      await postToSheetBackend('add_referral', newRef);
    } catch(e) { showToast('Referral saved locally; Google Sheets write failed.'); }
    showToast('Referral added ✓');
  }

  closeModal('referralModal');
  renderReferrals(document.getElementById('referralSearch')?.value.trim() || '');
}

// ═══════════════════════════════════
// DELETE
// ═══════════════════════════════════
async function confirmDeleteReferral() {
  if (!editingReferralId) return;
  db.referrals = (db.referrals || []).filter(r => r.referralId !== editingReferralId);
  saveDB();
  try {
    await postToSheetBackend('delete_referral', { referralId: editingReferralId });
  } catch(e) { showToast('Referral deleted locally; Google Sheets write failed.'); }
  closeModal('referralModal');
  renderReferrals(document.getElementById('referralSearch')?.value.trim() || '');
  showToast('Referral deleted');
}
