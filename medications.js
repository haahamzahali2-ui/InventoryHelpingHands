// ═══════════════════════════════════
// MEDICATIONS — list rendering, CRUD, chart overlay
// ═══════════════════════════════════

function renderMedicationsList(medications) {
  const container = document.getElementById('medicationsList');
  if (!container) return;
  if (!medications || !medications.length) {
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-light);font-style:italic;font-size:14px;">No medications added</div>';
    return;
  }
  const sorted = medications.map((m, i) => ({ ...m, _idx: i })).sort((a, b) => {
    const aActive = !a.endDate || new Date(a.endDate) >= new Date();
    const bActive = !b.endDate || new Date(b.endDate) >= new Date();
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return 0;
  });
  container.innerHTML = sorted.map(m => {
    const isActive = !m.endDate || new Date(m.endDate) >= new Date();
    const badge = isActive
      ? '<span class="med-status-badge active">Active</span>'
      : '<span class="med-status-badge inactive">Discontinued</span>';
    const dateStr = m.startDate ? `Started ${formatDateTime(m.startDate)}` : '';
    const endStr = m.endDate ? ` &mdash; Ended ${formatDateTime(m.endDate)}` : '';
    return `<div class="med-row">
      <div class="med-row-info">
        <div class="med-row-name">${escapeHtml(m.name || '')}${badge}</div>
        <div class="med-row-detail">${escapeHtml(m.dosage || '')}</div>
        <div class="med-row-dates">${dateStr}${endStr}</div>
      </div>
      <div class="med-row-actions">
        <button class="row-btn edit" onclick="openEditMedication(${m._idx})">Edit</button>
        <button class="row-btn del" onclick="openEditMedication(${m._idx});document.getElementById('medDeleteBar').classList.add('show')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

// ── EDIT / DELETE MEDICATIONS ────────────────────────
let editMedicationIndex = null;

function openEditMedication(idx) {
  editMedicationIndex = idx;
  const m = db.patients[currentPatientId].medications[idx];
  document.getElementById('medModalTitle').textContent = 'Edit Medication';
  document.getElementById('addMedicationModalSub').textContent = `Patient #${currentPatientId}`;
  document.getElementById('med-name').value = m.name || '';
  document.getElementById('med-dosage').value = m.dosage || '';
  document.getElementById('med-start-date').value = m.startDate || '';
  document.getElementById('med-end-date').value = m.endDate || '';
  document.getElementById('medDeleteBar').classList.remove('show');
  document.getElementById('medDeleteTrigger').style.display = 'inline-block';
  document.getElementById('addMedicationModal').classList.add('open');
}

async function confirmDeleteMedication() {
  if (editMedicationIndex === null || !currentPatientId) return;
  const med = db.patients[currentPatientId].medications[editMedicationIndex];
  db.patients[currentPatientId].medications.splice(editMedicationIndex, 1);
  saveDB();
  closeModal('addMedicationModal');
  renderMedicationsList(db.patients[currentPatientId].medications);
  showToast('Medication removed ✓');
  editMedicationIndex = null;
  try {
    await postToSheetBackend('delete_medication', { patientId: currentPatientId, name: med.name, startDate: med.startDate });
  } catch(e) {
    showToast('Removed locally — sheet sync failed.');
  }
}

function openAddMedicationModal() {
  if (!currentPatientId) return;
  editMedicationIndex = null;
  document.getElementById('medModalTitle').textContent = 'Add Medication';
  document.getElementById('addMedicationModalSub').textContent = `Patient #${currentPatientId}`;
  document.getElementById('med-name').value = '';
  document.getElementById('med-dosage').value = '';
  document.getElementById('med-start-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('med-end-date').value = '';
  document.getElementById('medDeleteBar').classList.remove('show');
  document.getElementById('medDeleteTrigger').style.display = 'none';
  document.getElementById('addMedicationModal').classList.add('open');
}

async function saveMedication() {
  if (!currentPatientId) return;
  const name = document.getElementById('med-name').value.trim();
  const dosage = document.getElementById('med-dosage').value.trim();
  const startDate = document.getElementById('med-start-date').value;
  const endDate = document.getElementById('med-end-date').value;
  if (!name || !dosage || !startDate) { showToast('Please fill in name, dosage, and start date'); return; }
  if (!db.patients[currentPatientId].medications) db.patients[currentPatientId].medications = [];
  const med = { name, dosage, startDate, endDate: endDate || '' };
  const isEdit = editMedicationIndex !== null;
  if (isEdit) {
    db.patients[currentPatientId].medications[editMedicationIndex] = med;
  } else {
    db.patients[currentPatientId].medications.push(med);
  }
  saveDB();
  closeModal('addMedicationModal');
  renderMedicationsList(db.patients[currentPatientId].medications);
  editMedicationIndex = null;
  try { await postToSheetBackend('add_medication', { patientId: currentPatientId, ...med }); }
  catch (e) { showToast('Medication saved locally; Google Sheets write failed.'); }
  showToast(isEdit ? 'Medication updated' : 'Medication saved');
}

// ═══════════════════════════════════
// MEDICATION OVERLAY ON CHARTS
// ═══════════════════════════════════
function getMedAnnotations(medications, readings) {
  if (!medications || !medications.length || !readings || !readings.length) return [];
  const labels = readings.map(r => r.datetime);
  return medications
    .filter(m => m.startDate)
    .map(m => {
      const idx = labels.findIndex(d => d >= m.startDate);
      return idx >= 0 ? { medName: m.name, idx, date: m.startDate } : null;
    })
    .filter(Boolean);
}

// Patch renderBPChart and renderA1CChart to include med annotation lines
const _origRenderBPChart = renderBPChart;
window.renderBPChart = function(readings) {
  _origRenderBPChart(readings);
  if (!bpChartInst || !currentPatientId) return;
  const meds = db.patients[currentPatientId]?.medications || [];
  const annotations = getMedAnnotations(meds, readings);
  if (!annotations.length) return;
  annotations.forEach(ann => {
    bpChartInst.data.datasets.push({
      label: `💊 ${ann.medName} started`,
      data: readings.map((_, i) => i === ann.idx ? null : null),
      borderColor: 'rgba(168,137,60,0.6)',
      borderWidth: 2,
      borderDash: [6, 3],
      pointRadius: 0,
      type: 'line',
      xAxisID: 'x'
    });
  });
  bpChartInst.update();
  // Draw vertical annotation lines manually via plugin
  addMedLines(bpChartInst, annotations, readings.map(r => formatDateTime(r.datetime)));
};

function addMedLines(chart, annotations, labels) {
  const plugin = {
    id: 'medLines',
    afterDraw(chart) {
      const ctx = chart.ctx;
      const xAxis = chart.scales['x'];
      const yAxis = chart.scales['y'] || chart.scales['y1'];
      if (!xAxis || !yAxis) return;
      annotations.forEach(ann => {
        const label = formatDateTime(ann.date);
        const labelIdx = labels.indexOf(label);
        if (labelIdx < 0) return;
        const x = xAxis.getPixelForValue(labelIdx);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, yAxis.top);
        ctx.lineTo(x, yAxis.bottom);
        ctx.strokeStyle = 'rgba(168,137,60,0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(168,137,60,0.85)';
        ctx.font = '11px DM Sans, sans-serif';
        ctx.fillText(`💊 ${ann.medName}`, x + 4, yAxis.top + 14);
        ctx.restore();
      });
    }
  };
  Chart.register(plugin);
  chart.update();
}
