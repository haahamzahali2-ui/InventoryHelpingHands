// ═══════════════════════════════════
// PATIENTS — grid, detail view, readings CRUD, milestones, sticky notes
// ═══════════════════════════════════

// ═══════════════════════════════════
// PATIENTS GRID
// ═══════════════════════════════════
function renderPatientsGrid(filter = '', range = null) {
  const grid = document.getElementById('patientsGrid');
  let ids = Object.keys(db.patients).filter(id => {
    if (filter && !id.includes(filter)) return false;
    if (range && !patientHasReadingInRange(id, range)) return false;
    return true;
  });

  // Sort
  if (currentSort === 'id') {
    ids.sort((a,b) => Number(a) - Number(b) || a.localeCompare(b));
  } else {
    ids.sort((a,b) => getPatientSortScore(b) - getPatientSortScore(a));
  }

  // Update count label
  const countEl = document.getElementById('patientCountLabel');
  if (countEl) countEl.textContent = `${ids.length} patient${ids.length !== 1 ? 's' : ''}`;

  const cards = ids.map(id => {
    const p = db.patients[id];
    const lastBP = (p.bpReadings||[]).slice(-1)[0];
    const lastA1C = (p.a1cReadings||[]).slice(-1)[0];
    const bpStatus = lastBP ? getBPStatus(lastBP.sys, lastBP.dia) : null;
    const a1cStatus = lastA1C ? getA1CStatus(lastA1C.val) : null;

    let cardClass = '';
    if (bpStatus === 'critical' || a1cStatus === 'critical') cardClass = 'has-critical';
    else if (bpStatus === 'warning' || a1cStatus === 'warning') cardClass = 'has-warning';

    // BP block
    const bpValClass = bpStatus ? `val-${bpStatus}` : '';
    const bpDisplay = lastBP
      ? `<div class="patient-reading-value ${bpValClass}">${lastBP.sys}/${lastBP.dia}</div><div class="patient-reading-unit">mmHg</div>`
      : `<div class="patient-reading-value" style="font-size:15px;color:var(--text-light);font-family:'DM Sans'">—</div><div class="patient-reading-unit">No data</div>`;

    // A1C block
    const a1cValClass = a1cStatus ? `val-${a1cStatus}` : '';
    const a1cDisplay = lastA1C
      ? `<div class="patient-reading-value ${a1cValClass}">${lastA1C.val}%</div><div class="patient-reading-unit">A1C</div>`
      : `<div class="patient-reading-value" style="font-size:15px;color:var(--text-light);font-family:'DM Sans'">—</div><div class="patient-reading-unit">No data</div>`;

    // Sticky note flag
    const sticky = db.stickies && db.stickies[id];
    const stickyHtml = sticky ? `<div class="sticky-flag" onclick="event.stopPropagation();openStickyModal('${id}')" title="${escapeHtml(sticky.note)}">📌</div>` : `<div class="sticky-flag" onclick="event.stopPropagation();openStickyModal('${id}')" title="Add staff note" style="opacity:0.25">📌</div>`;

    // Milestone badges
    const totalReadings = (p.bpReadings||[]).length + (p.a1cReadings||[]).length;
const badges = getMilestoneBadges(id);
    const famBadge = isFAMEnrolled(id) ? `<span class="fam-card-badge" title="Enrolled: ${escapeHtml(p.famProgramType || 'Food as Medicine')}">🥗 FaM</span>` : '';
    const allBadgesHtml = badges.map(b=>`<span class="milestone-badge" title="${b.title}">${b.icon} ${b.label}</span>`).join('') + famBadge;
    const badgesHtml = allBadgesHtml ? `<div class="milestone-badges">${allBadgesHtml}</div>` : '';

    // Last seen badge
    const allDates = [...(p.bpReadings||[]), ...(p.a1cReadings||[])].map(r => r.datetime).filter(Boolean).sort();
    const lastDate = allDates.slice(-1)[0];
    let lastSeenHtml = '';
    if (lastDate) {
      const daysDiff = Math.floor((Date.now() - new Date(lastDate)) / 86400000);
      const dotClass = daysDiff <= 7 ? 'recent' : daysDiff <= 30 ? '' : 'old';
      const label = daysDiff === 0 ? 'Today' : daysDiff === 1 ? 'Yesterday' : daysDiff < 30 ? `${daysDiff}d ago` : `${Math.floor(daysDiff/30)}mo ago`;
      const overdueHtml = daysDiff >= 60 ? `<span class="overdue-badge">⏰ Overdue ${daysDiff}d</span>` : '';
      lastSeenHtml = `<div class="patient-last-seen"><div class="patient-last-seen-dot ${dotClass}"></div>Last visit: ${label} ${overdueHtml}</div>`;
    } else {
      lastSeenHtml = `<div class="patient-last-seen"><div class="patient-last-seen-dot old"></div>No visits yet <span class="overdue-badge">⏰ Never seen</span></div>`;
    }

    return `<div class="patient-card ${cardClass}" onclick="openPatient('${id}')">
      <div class="patient-card-stripe"></div>
      ${stickyHtml}
      <div class="patient-card-body">
        <div class="patient-card-top">
          <div class="patient-id-badge">
            <div>
              <div class="patient-id-label">Patient</div>
              <div class="patient-id-number">#${id}</div>
            </div>
          </div>
          <div class="patient-status-dot"></div>
        </div>
        <div class="patient-readings">
          <div class="patient-reading-block">
            <div class="patient-reading-label">Blood Pressure</div>
            ${bpDisplay}
          </div>
          <div class="patient-reading-block">
            <div class="patient-reading-label">A1C</div>
            ${a1cDisplay}
          </div>
        </div>
        ${badgesHtml}
        <div class="patient-card-footer">
          <div>
            <div class="patient-reading-count">${totalReadings} reading${totalReadings !== 1 ? 's' : ''}</div>
            ${lastSeenHtml}
          </div>
          <div class="patient-card-arrow-icon">&#8594;</div>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.innerHTML = cards + `<button class="add-patient-btn" onclick="openAddPatientModal()">
    <div class="plus-icon">+</div>
    Add New Patient
  </button>`;

  const banner = document.getElementById('sheetSetupBanner');
  if (sheetWriteUrl || sheetId) banner.style.display = 'none';
}

function filterPatients() {
  const v = document.getElementById('patientSearch').value.trim();
  renderPatientsGrid(v);
}


// PATIENT DETAIL
// ═══════════════════════════════════
function openPatient(id) {
  currentPatientId = id;
  patientAlertDismissed[id] = false;
  showPage('detail');
  const p = db.patients[id] || { bpReadings: [], a1cReadings: [], medications: [] };
  document.getElementById('detailTitle').textContent = `Patient #${id}`;
  document.getElementById('addDataModalSub').textContent = `Patient #${id}`;
  document.getElementById('addMedicationModalSub').textContent = `Patient #${id}`;
  const bpReadings = p.bpReadings || [];
  const a1cReadings = p.a1cReadings || [];
  const lastBP = bpReadings.slice(-1)[0];
  const lastA1C = a1cReadings.slice(-1)[0];
  const bpStatus = lastBP ? getBPStatus(lastBP.sys, lastBP.dia) : null;
  const a1cStatus = lastA1C ? getA1CStatus(lastA1C.val) : null;
  const tagsEl = document.getElementById('detailTags');
  let tags = '';
  if (bpStatus) tags += `<span class="tag ${bpStatus}">BP: ${bpStatus}</span>`;
  if (a1cStatus) tags += `<span class="tag ${a1cStatus}">A1C: ${a1cStatus}</span>`;
  tagsEl.innerHTML = tags;
renderPatientAlertPanel(id, bpStatus, a1cStatus, lastBP, lastA1C);
  renderFAMPatientPanel(id);
  renderBPChart(bpReadings);
  renderA1CChart(a1cReadings);
  renderBPTable(bpReadings);
  renderA1CTable(a1cReadings);
  renderMedicationsList(p.medications || []);
  setDetailMetric(currentDetailMetric);
}

function renderPatientAlertPanel(id, bpStatus, a1cStatus, lastBP, lastA1C) {
  const el = document.getElementById('patientAlertPanel');
  if (patientAlertDismissed[id]) { el.innerHTML = ''; return; }
  if (!bpStatus && !a1cStatus) { el.innerHTML = ''; return; }
  let msgs = [];
  if (bpStatus === 'critical') msgs.push(`Last BP reading (${lastBP.sys}/${lastBP.dia} mmHg) indicates <strong>Hypertensive Urgency</strong> — immediate attention required.`);
  else if (bpStatus === 'warning') msgs.push(`Last BP reading (${lastBP.sys}/${lastBP.dia} mmHg) indicates <strong>Stage 2 Hypertension</strong>.`);
  if (a1cStatus === 'critical') msgs.push(`Last A1C reading (${lastA1C.val}%) indicates <strong>Poor glycemic control</strong> (>9.0%).`);
  else if (a1cStatus === 'warning') msgs.push(`A1C reading (${lastA1C.val}%) is <strong>above target</strong> (>7.0%).`);
  const isCritical = bpStatus === 'critical' || a1cStatus === 'critical';
  el.innerHTML = msgs.map(m => `
    <div class="patient-alert-panel ${!isCritical ? 'amber' : ''}">
      <h4>${isCritical ? 'Critical Alert' : 'Warning'} <button class="seen-btn" style="float:right" onclick="dismissPatientAlert('${id}')">Dismiss</button></h4>
      <p>${m}</p>
    </div>`).join('');
}

function dismissPatientAlert(id) { patientAlertDismissed[id] = true; document.getElementById('patientAlertPanel').innerHTML = ''; }

function setDetailMetric(metric) {
  currentDetailMetric = metric;
  document.getElementById('metric-tab-bp').classList.toggle('active', metric === 'bp');
  document.getElementById('metric-tab-a1c').classList.toggle('active', metric === 'a1c');
  document.getElementById('bpDetailCard').classList.toggle('hidden', metric !== 'bp');
  document.getElementById('a1cDetailCard').classList.toggle('hidden', metric !== 'a1c');
}


// ── EDIT / DELETE READINGS ──────────────────────────
let editReadingType = null;
let editReadingIndex = null;

function openEditReading(type, idx) {
  editReadingType = type;
  editReadingIndex = idx;
  const p = db.patients[currentPatientId];
  const r = type === 'bp' ? p.bpReadings[idx] : p.a1cReadings[idx];
  document.getElementById('editReadingTitle').textContent = type === 'bp' ? 'Edit Blood Pressure' : 'Edit A1C Reading';
  document.getElementById('editReadingModalSub').textContent = `Patient #${currentPatientId}`;
  document.getElementById('readingDeleteBar').classList.remove('show');
  document.getElementById('editReadingBPFields').style.display = type === 'bp' ? 'block' : 'none';
  document.getElementById('editReadingA1CFields').style.display = type === 'a1c' ? 'block' : 'none';
  if (type === 'bp') {
    document.getElementById('edit-bp-datetime').value = r.datetime || '';
    document.getElementById('edit-bp-systolic').value = r.sys || '';
    document.getElementById('edit-bp-diastolic').value = r.dia || '';
    document.getElementById('edit-bp-note').value = r.note || '';
  } else {
    document.getElementById('edit-a1c-datetime').value = r.datetime || '';
    document.getElementById('edit-a1c-value').value = r.val || '';
    document.getElementById('edit-a1c-note').value = r.note || '';
  }
  document.getElementById('editReadingModal').classList.add('open');
}

function saveEditedReading() {
  if (editReadingIndex === null || !currentPatientId) return;
  const p = db.patients[currentPatientId];
  const oldReading = editReadingType === 'bp' ? { ...p.bpReadings[editReadingIndex] } : { ...p.a1cReadings[editReadingIndex] };
  if (editReadingType === 'bp') {
    const sys = parseFloat(document.getElementById('edit-bp-systolic').value);
    const dia = parseFloat(document.getElementById('edit-bp-diastolic').value);
    const dt = document.getElementById('edit-bp-datetime').value;
    const note = document.getElementById('edit-bp-note').value.trim();
    if (!sys || !dia || !dt) { showToast('Please fill in all fields'); return; }
    p.bpReadings[editReadingIndex] = { sys, dia, datetime: dt, note };
  } else {
    const val = parseFloat(document.getElementById('edit-a1c-value').value);
    const dt = document.getElementById('edit-a1c-datetime').value;
    const note = document.getElementById('edit-a1c-note').value.trim();
    if (!val || !dt) { showToast('Please fill in all fields'); return; }
    p.a1cReadings[editReadingIndex] = { val, datetime: dt, note };
  }
  p.bpReadings.sort((a,b) => new Date(a.datetime) - new Date(b.datetime));
  p.a1cReadings.sort((a,b) => new Date(a.datetime) - new Date(b.datetime));
  saveDB();
  // Sync edit to sheet: delete old then add new
  const newReading = editReadingType === 'bp' ? p.bpReadings.find(r => r !== oldReading) || p.bpReadings[editReadingIndex] : p.a1cReadings[editReadingIndex];
  postToSheetBackend('delete_reading', { patientId: currentPatientId, type: editReadingType, datetime: oldReading.datetime })
    .then(() => postToSheetBackend('add_reading', { patientId: currentPatientId, type: editReadingType, ...( editReadingType === 'bp' ? p.bpReadings.find(r => r.datetime === document.getElementById('edit-bp-datetime').value) || p.bpReadings.slice(-1)[0] : p.a1cReadings.find(r => r.datetime === document.getElementById('edit-a1c-datetime')?.value) || p.a1cReadings.slice(-1)[0] ) }))
    .catch(() => showToast('Reading updated locally; sheet sync failed'));
  closeModal('editReadingModal');
  openPatient(currentPatientId);
  showToast('Reading updated ✓');
}

async function confirmDeleteReading() {
  if (editReadingIndex === null || !currentPatientId) return;
  const p = db.patients[currentPatientId];
  const deletedReading = editReadingType === 'bp' ? p.bpReadings[editReadingIndex] : p.a1cReadings[editReadingIndex];
  const deletedDatetime = deletedReading?.datetime || '';
  if (editReadingType === 'bp') p.bpReadings.splice(editReadingIndex, 1);
  else p.a1cReadings.splice(editReadingIndex, 1);
  saveDB();
  closeModal('editReadingModal');
  openPatient(currentPatientId);
  renderHomeStats();
  showToast('Reading deleted ✓');
  // Sync deletion to sheet
  try {
    await postToSheetBackend('delete_reading', {
      patientId: currentPatientId,
      type: editReadingType,
      datetime: deletedDatetime
    });
  } catch(e) {
    showToast('Deleted locally — sheet sync failed. Re-open and retry.');
  }
}


// ═══════════════════════════════════
// SAVE NEW READING (from add-data modal)
// ═══════════════════════════════════
async function saveReading() {
  if (!currentPatientId) return;
  if (!db.patients[currentPatientId]) db.patients[currentPatientId] = { bpReadings: [], a1cReadings: [], medications: [] };
  const p = db.patients[currentPatientId];
  if (activeModalTab === 'bp') {
    const sys = parseFloat(document.getElementById('bp-systolic').value);
    const dia = parseFloat(document.getElementById('bp-diastolic').value);
    const dt = document.getElementById('bp-datetime').value;
    const note = document.getElementById('bp-note').value.trim();
    if (!sys || !dia || !dt) { showToast('Please fill in all fields'); return; }
    const newReading = { sys, dia, datetime: dt, note };
    p.bpReadings.push(newReading);
    p.bpReadings.sort((a,b) => new Date(a.datetime) - new Date(b.datetime));
    checkAndAddAlert(currentPatientId, 'bp', [sys, dia], dt);
    try { await postToSheetBackend('add_reading', { patientId: currentPatientId, type: 'bp', ...newReading }); }
    catch (e) { showToast('BP reading saved locally; Google Sheets write failed.'); }
  } else {
    const val = parseFloat(document.getElementById('a1c-value').value);
    const dt = document.getElementById('a1c-datetime').value;
    const note = document.getElementById('a1c-note').value.trim();
    if (!val || !dt) { showToast('Please fill in all fields'); return; }
    const newReading = { val, datetime: dt, note };
    p.a1cReadings.push(newReading);
    p.a1cReadings.sort((a,b) => new Date(a.datetime) - new Date(b.datetime));
    checkAndAddAlert(currentPatientId, 'a1c', val, dt);
    try { await postToSheetBackend('add_reading', { patientId: currentPatientId, type: 'a1c', ...newReading }); }
    catch (e) { showToast('A1C reading saved locally; Google Sheets write failed.'); }
  }
  saveDB(); closeModal('addDataModal'); openPatient(currentPatientId); renderHomeStats();
  showToast('Reading saved successfully');
}

// ═══════════════════════════════════
// MILESTONE BADGES
// ═══════════════════════════════════
function getMilestoneBadges(pid) {
  const p = db.patients[pid];
  if (!p) return [];
  const badges = [];
  const bp   = p.bpReadings  || [];
  const a1c  = p.a1cReadings || [];
  const meds = p.medications || [];
  const total = bp.length + a1c.length;

  if (bp.length >= 3) {
    const last3 = bp.slice(-3);
    if (last3[2].sys < last3[1].sys && last3[1].sys < last3[0].sys)
      badges.push({ icon:'🏆', label:'BP Streak', title:'3 consecutive BP improvements' });
  }
  if (a1c.length >= 3) {
    const last3 = a1c.slice(-3);
    if (last3[2].val < last3[1].val && last3[1].val < last3[0].val)
      badges.push({ icon:'⭐', label:'A1C Streak', title:'3 consecutive A1C improvements' });
  }
  if (bp.length >= 2) {
    const last = bp.slice(-1)[0]; const prev = bp.slice(-2)[0];
    if (getBPStatus(last.sys, last.dia) === 'normal' && getBPStatus(prev.sys, prev.dia) !== 'normal')
      badges.push({ icon:'💚', label:'BP Normal', title:'BP returned to normal range' });
  }
  if (a1c.length >= 2) {
    const last = a1c.slice(-1)[0]; const prev = a1c.slice(-2)[0];
    if (getA1CStatus(last.val) === 'normal' && getA1CStatus(prev.val) !== 'normal')
      badges.push({ icon:'🎯', label:'A1C Target', title:'A1C reached target range' });
  }
  if (total >= 5) badges.push({ icon:'📅', label:`${total} Visits`, title:`${total} total readings recorded` });
  const activeMeds = meds.filter(m => !m.endDate || new Date(m.endDate) >= new Date());
  if (activeMeds.length > 0) badges.push({ icon:'💊', label:'On Meds', title: activeMeds.map(m=>m.name).join(', ') });
  return badges;
}

// ═══════════════════════════════════
// STICKY NOTES
// ═══════════════════════════════════
let currentStickyPatientId = null;
let currentStickyColor = 'gold';
const stickyBgMap = { gold:'#FFF9D6', green:'#E8F5EE', red:'#FDECEA', blue:'#EEF2FF' };

function openStickyModal(pid) {
  currentStickyPatientId = pid;
  document.getElementById('stickyModalTitle').textContent = `📌 Staff Note — Patient #${pid}`;
  const existing = db.stickies && db.stickies[pid];
  document.getElementById('stickyText').value = existing ? existing.note : '';
  const color = existing ? (existing.color || 'gold') : 'gold';
  const dot = document.querySelector(`.sticky-color-dot[data-color="${color}"]`);
  setStickyColor(color, dot);
  document.getElementById('stickyModal').classList.add('open');
}

function setStickyColor(color, el) {
  currentStickyColor = color;
  document.querySelectorAll('.sticky-color-dot').forEach(d => d.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('stickyModalInner').style.background = stickyBgMap[color] || '#FFF9D6';
}

async function saveSticky() {
  if (!currentStickyPatientId) return;
  const note = document.getElementById('stickyText').value.trim();
  if (!note) { await deleteSticky(); return; }
  if (!db.stickies) db.stickies = {};
  db.stickies[currentStickyPatientId] = { note, color: currentStickyColor, createdAt: new Date().toISOString() };
  saveDB();
  document.getElementById('stickyModal').classList.remove('open');
  renderPatientsGrid();
  showToast('📌 Note saved');
  try { await postToSheetBackend('save_sticky', { patientId: currentStickyPatientId, note, color: currentStickyColor }); }
  catch(e) { showToast('Note saved locally; sheet sync failed'); }
}

async function deleteSticky() {
  if (!currentStickyPatientId) return;
  if (db.stickies) delete db.stickies[currentStickyPatientId];
  saveDB();
  document.getElementById('stickyModal').classList.remove('open');
  renderPatientsGrid();
  showToast('Note removed');
  try { await postToSheetBackend('delete_sticky', { patientId: currentStickyPatientId }); }
  catch(e) {}
}
