// ═══════════════════════════════════
// MEDICATIONS — list rendering, CRUD, chart overlay
// ═══════════════════════════════════
async function postToSheetBackend(action, payload) {
  const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyYlTUFoW-CgUEw8qPUQEm7i5VxLkivuASa35gc97f-YWJiOmPK-OwmOl4U_dE7vZR1/exec';
  
await fetch(url, {
  method: 'POST',
  mode: 'no-cors',                 // ← this is the fix
  headers: { 'Content-Type': 'text/plain' },  // ← must be text/plain
  body: JSON.stringify(data)
});

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Backend error');
  return data;
}


function renderMedicationsList(medications) {
  const container = document.getElementById('medicationsList');
  if (!container) return;
  if (!medications || !medications.length) {
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-light);font-style:italic;font-size:14px;">No medications added</div>';
    return;
  }
  const now = new Date();
  const sorted = medications
    .map((m, i) => ({ ...m, _idx: i }))
    .sort((a, b) => {
      const aActive = !a.endDate || new Date(a.endDate) >= now;
      const bActive = !b.endDate || new Date(b.endDate) >= now;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      // Within same group, sort by startDate descending (most recent first)
      return new Date(b.startDate || 0) - new Date(a.startDate || 0);
    });

  container.innerHTML = sorted.map(m => {
    const isActive = !m.endDate || new Date(m.endDate) >= now;
    const badge = isActive
      ? '<span class="med-status-badge active">Active</span>'
      : '<span class="med-status-badge inactive">Discontinued</span>';
    const dateStr = m.startDate ? `Started ${formatDateTime(m.startDate)}` : '';
    const endStr  = m.endDate   ? ` &mdash; Ended ${formatDateTime(m.endDate)}` : '';
    return `<div class="med-row">
      <div class="med-row-info">
        <div class="med-row-name">${escapeHtml(m.name || '')}${badge}</div>
        <div class="med-row-detail">${escapeHtml(m.dosage || '')}</div>
        <div class="med-row-dates">${dateStr}${endStr}</div>
      </div>
      <div class="med-row-actions">
        <button class="row-btn edit" onclick="openEditMedication(${m._idx})">Edit</button>
        <button class="row-btn del"  onclick="openEditMedication(${m._idx});document.getElementById('medDeleteBar').classList.add('show')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

// ── EDIT / DELETE MEDICATIONS ────────────────────────
let editMedicationIndex = null;

function openEditMedication(idx) {
  editMedicationIndex = idx;
  const m = db.patients[currentPatientId].medications[idx];
  document.getElementById('medModalTitle').textContent      = 'Edit Medication';
  document.getElementById('addMedicationModalSub').textContent = `Patient #${currentPatientId}`;
  document.getElementById('med-name').value       = m.name      || '';
  document.getElementById('med-dosage').value     = m.dosage    || '';
  document.getElementById('med-start-date').value = m.startDate || '';
  document.getElementById('med-end-date').value   = m.endDate   || '';
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
    await postToSheetBackend('delete_medication', {
      patientId: currentPatientId,
      name:      med.name,
      startDate: med.startDate
    });
  } catch (e) {
    showToast('Removed locally — sheet sync failed.');
  }
}

function openAddMedicationModal() {
  if (!currentPatientId) return;
  editMedicationIndex = null;
  document.getElementById('medModalTitle').textContent         = 'Add Medication';
  document.getElementById('addMedicationModalSub').textContent = `Patient #${currentPatientId}`;
  document.getElementById('med-name').value       = '';
  document.getElementById('med-dosage').value     = '';
  document.getElementById('med-start-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('med-end-date').value   = '';
  document.getElementById('medDeleteBar').classList.remove('show');
  document.getElementById('medDeleteTrigger').style.display = 'none';
  document.getElementById('addMedicationModal').classList.add('open');
}

async function saveMedication() {
  if (!currentPatientId) return;
  const name      = document.getElementById('med-name').value.trim();
  const dosage    = document.getElementById('med-dosage').value.trim();
  const startDate = document.getElementById('med-start-date').value;
  const endDate   = document.getElementById('med-end-date').value;

  if (!name || !dosage || !startDate) {
    showToast('Please fill in name, dosage, and start date');
    return;
  }

  // Guard: end date must not be before start date
  if (endDate && endDate < startDate) {
    showToast('End date cannot be before start date');
    return;
  }

  if (!db.patients[currentPatientId].medications) {
    db.patients[currentPatientId].medications = [];
  }

  const med    = { name, dosage, startDate, endDate: endDate || '' };
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

  try {
    await postToSheetBackend('add_medication', { patientId: currentPatientId, ...med });
  } catch (e) {
    showToast('Medication saved locally; Google Sheets write failed.');
  }

  showToast(isEdit ? 'Medication updated ✓' : 'Medication saved ✓');
}

// ═══════════════════════════════════
// MEDICATION OVERLAY ON CHARTS
// ═══════════════════════════════════

/**
 * Builds annotation objects for both start AND end dates of each medication.
 * Each annotation: { medName, idx, date, type: 'start'|'end' }
 *
 * FIX: previously only start dates were annotated; end dates now produce their
 * own labelled annotation so the chart line and legend entry show the correct
 * medication name instead of a generic fallback like "pill 2".
 */
function getMedAnnotations(medications, readings) {
  if (!medications || !medications.length || !readings || !readings.length) return [];

  const labels      = readings.map(r => r.datetime);
  const annotations = [];

  medications
    .filter(m => m.startDate)
    .forEach(m => {
      // ── Start annotation ──
      const startIdx = labels.findIndex(d => d >= m.startDate);
      if (startIdx >= 0) {
        annotations.push({
          medName: m.name,
          label:   `💊 ${m.name} started`,
          idx:     startIdx,
          date:    m.startDate,
          type:    'start'
        });
      }

      // ── End annotation (was missing — this was the root bug) ──
      if (m.endDate) {
        // Find the closest reading on or after the end date.
        // Fall back to the last reading if the end date is beyond all readings.
        let endIdx = labels.findIndex(d => d >= m.endDate);
        if (endIdx < 0) endIdx = labels.length - 1;
        annotations.push({
          medName: m.name,
          label:   `🚫 ${m.name} ended`,
          idx:     endIdx,
          date:    m.endDate,
          type:    'end'
        });
      }
    });

  return annotations;
}

// Patch renderBPChart and renderA1CChart to include med annotation lines
const _origRenderBPChart = renderBPChart;
window.renderBPChart = function (readings) {
  _origRenderBPChart(readings);
  if (!bpChartInst || !currentPatientId) return;
  const meds        = db.patients[currentPatientId]?.medications || [];
  const annotations = getMedAnnotations(meds, readings);
  if (!annotations.length) return;

  // Add a zero-data dataset per annotation so the legend entry is correct
  annotations.forEach(ann => {
    bpChartInst.data.datasets.push({
      label:       ann.label,   // ← correct name now shown in legend
      data:        readings.map(() => null),
      borderColor: ann.type === 'end'
        ? 'rgba(200,80,80,0.6)'
        : 'rgba(168,137,60,0.6)',
      borderWidth: 2,
      borderDash:  [6, 3],
      pointRadius: 0,
      type:        'line',
      xAxisID:     'x'
    });
  });

  bpChartInst.update();
  addMedLines(bpChartInst, annotations, readings.map(r => formatDateTime(r.datetime)));
};

/**
 * Draws vertical dashed lines + labels on the chart canvas for each annotation.
 * Start lines are gold; end/discontinued lines are red.
 * Registers a one-time plugin so it doesn't stack on repeated renders.
 */
function addMedLines(chart, annotations, labels) {
  // Remove any previously registered medLines plugin to avoid duplicates
  const existingIdx = Chart.registry.plugins.get('medLines');
  if (existingIdx) Chart.unregister(existingIdx);

  const plugin = {
    id: 'medLines',
    afterDraw(chart) {
      const ctx   = chart.ctx;
      const xAxis = chart.scales['x'];
      const yAxis = chart.scales['y'] || chart.scales['y1'];
      if (!xAxis || !yAxis) return;

      annotations.forEach(ann => {
        const labelFormatted = formatDateTime(ann.date);
        const labelIdx       = labels.indexOf(labelFormatted);
        if (labelIdx < 0) return;

        const x        = xAxis.getPixelForValue(labelIdx);
        const isEnd    = ann.type === 'end';
        const lineColor = isEnd ? 'rgba(200,80,80,0.55)'  : 'rgba(168,137,60,0.55)';
        const textColor = isEnd ? 'rgba(200,80,80,0.90)'  : 'rgba(168,137,60,0.90)';
        const icon      = isEnd ? '🚫' : '💊';

        ctx.save();

        // Vertical dashed line
        ctx.beginPath();
        ctx.moveTo(x, yAxis.top);
        ctx.lineTo(x, yAxis.bottom);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label — stagger vertically so overlapping lines don't collide
        const vertOffset = annotations.indexOf(ann) % 3;  // 0 / 1 / 2
        ctx.fillStyle = textColor;
        ctx.font      = '11px DM Sans, sans-serif';
        ctx.fillText(`${icon} ${ann.medName}`, x + 4, yAxis.top + 14 + vertOffset * 16);

        ctx.restore();
      });
    }
  };

  Chart.register(plugin);
  chart.update();
}
