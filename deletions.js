// ═══════════════════════════════════════════════════════════════
// deletions.js — Helping Hands Free Clinic
// All delete operations: local DB + Google Sheets sync
// ═══════════════════════════════════════════════════════════════

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyYlTUFoW-CgUEw8qPUQEm7i5VxLkivuASa35gc97f-YWJiOmPK-OwmOl4U_dE7vZR1/exec';

// ── CORE SYNC FUNCTION ───────────────────────────────────────────
// Sends any action + payload to Google Sheets backend
async function syncToSheet(action, payload) {
  await fetch(SHEET_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: action, payload: payload })
  });
}


// ── DELETE PATIENT ───────────────────────────────────────────────
// Called from the 🗑 button on patient cards
function confirmDeletePatient(patientId) {
  const first = confirm(`Delete Patient #${patientId}?\n\nThis will permanently remove all readings, medications, alerts, notes, and FaM enrollment for this patient.`);
  if (!first) return;
  const second = confirm(`Are you absolutely sure?\n\nPatient #${patientId} and ALL their data will be deleted. This cannot be undone.`);
  if (!second) return;
  deletePatientEverywhere(patientId);
}

async function deletePatientEverywhere(patientId) {
  showToast(`Deleting Patient #${patientId}…`);

  // 1. Remove from local DB
  delete db.patients[patientId];
  if (db.stickies)       delete db.stickies[patientId];
  if (db.famEnrollments) delete db.famEnrollments[patientId];
  if (db.alerts)         db.alerts = db.alerts.filter(a => String(a.patientId) !== String(patientId));
  saveDB();

  // 2. Sync to Google Sheets
  try {
    await syncToSheet('delete_patient', { patientId: String(patientId) });
    showToast(`✓ Patient #${patientId} deleted`);
  } catch (err) {
    showToast(`Deleted locally — sheet sync failed`);
    console.error('deletePatient sync error:', err);
  }

  renderPatientsGrid();
  renderHomeStats();
}


// ── DELETE MEDICATION ────────────────────────────────────────────
// Call this instead of the old confirmDeleteMedication()
async function deleteMedication(patientId, medIndex) {
  const med = db.patients[patientId].medications[medIndex];
  if (!med) return;

  // 1. Remove locally
  db.patients[patientId].medications.splice(medIndex, 1);
  saveDB();
  closeModal('addMedicationModal');
  renderMedicationsList(db.patients[patientId].medications);
  showToast('Medication removed ✓');

  // 2. Sync to Google Sheets
  try {
    await syncToSheet('delete_medication', {
      patientId: String(patientId),
      name:      med.name,
      startDate: med.startDate
    });
  } catch (err) {
    showToast('Removed locally — sheet sync failed');
    console.error('deleteMedication sync error:', err);
  }
}


// ── DELETE READING ───────────────────────────────────────────────
// Call this instead of the old confirmDeleteReading()
async function deleteReading(patientId, type, index) {
  const p = db.patients[patientId];
  const readings = type === 'bp' ? p.bpReadings : p.a1cReadings;
  const reading  = readings[index];
  if (!reading) return;

  const datetime = reading.datetime || '';

  // 1. Remove locally
  readings.splice(index, 1);
  saveDB();
  closeModal('editReadingModal');
  openPatient(patientId);
  renderHomeStats();
  showToast('Reading deleted ✓');

  // 2. Sync to Google Sheets
  try {
    await syncToSheet('delete_reading', {
      patientId: String(patientId),
      type:      type,
      datetime:  datetime
    });
  } catch (err) {
    showToast('Deleted locally — sheet sync failed');
    console.error('deleteReading sync error:', err);
  }
}


// ── DELETE STICKY NOTE ───────────────────────────────────────────
async function deleteSticky(patientId) {
  // 1. Remove locally
  if (db.stickies) delete db.stickies[patientId];
  saveDB();
  closeModal('stickyModal');
  renderPatientsGrid();
  showToast('Note removed');

  // 2. Sync to Google Sheets
  try {
    await syncToSheet('delete_sticky', { patientId: String(patientId) });
  } catch (err) {
    console.error('deleteSticky sync error:', err);
  }
}


// ── REMOVE FAM ENROLLMENT ────────────────────────────────────────
async function removeFAMEnrollment(patientId) {
  // 1. Remove locally
  if (db.famEnrollments) delete db.famEnrollments[patientId];
  saveDB();
  renderFAMPatientPanel(patientId);
  showToast('FaM enrollment removed ✓');

  // 2. Sync to Google Sheets
  try {
    await syncToSheet('remove_fam_enrollment', { patientId: String(patientId) });
  } catch (err) {
    showToast('Removed locally — sheet sync failed');
    console.error('removeFAMEnrollment sync error:', err);
  }
}
