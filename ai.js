// ═══════════════════════════════════
// AI VISIT NOTE GENERATOR — Powered by Claude
// ═══════════════════════════════════

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyYlTUFoW-CgUEw8qPUQEm7i5VxLkivuASa35gc97f-YWJiOmPK-OwmOl4U_dE7vZR1/exec';

let currentNoteFormat = 'soap';

function setNoteFormat(fmt, btn) {
  currentNoteFormat = fmt;
  document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function openVisitNoteModal() {
  if (!currentPatientId) return;
  document.getElementById('visitNoteModalSub').textContent = 'Patient #' + currentPatientId + ' \u00b7 Powered by Claude AI';
  document.getElementById('visitNotePrompt').style.display = 'block';
  document.getElementById('visitNoteEditor').style.display = 'none';
  document.getElementById('visitNoteGenerating').style.display = 'none';
  document.getElementById('visitNoteGenerateBtn').style.display = 'inline-flex';
  document.getElementById('visitNoteRegenBtn').style.display = 'none';
  document.getElementById('visitNoteCopyBtn').style.display = 'none';
  document.getElementById('visitNoteText').value = '';

  document.getElementById('visitNotePrompt').innerHTML =
    '<div style="font-size:40px;margin-bottom:12px;">\uD83D\uDCCB</div>' +
    '<div style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:600;color:var(--text-dark);margin-bottom:8px;">Ready to generate</div>' +
    '<div style="font-size:14px;color:var(--text-light);line-height:1.7;max-width:360px;margin:0 auto;">Claude will read this patient\'s last 3 readings, medications, and trends to draft a visit note ready for Athena.</div>';

  document.getElementById('visitNoteModal').classList.add('open');
}

async function generateVisitNote() {
  if (!currentPatientId) return;
  var p = db.patients[currentPatientId];
  if (!p) return;

  document.getElementById('visitNotePrompt').style.display = 'none';
  document.getElementById('visitNoteEditor').style.display = 'none';
  document.getElementById('visitNoteGenerating').style.display = 'block';
  document.getElementById('visitNoteGenerateBtn').style.display = 'none';
  document.getElementById('visitNoteRegenBtn').style.display = 'none';
  document.getElementById('visitNoteCopyBtn').style.display = 'none';

  var bp   = (p.bpReadings  || []).slice(-3);
  var a1c  = (p.a1cReadings || []).slice(-3);
  var meds = (p.medications || []).filter(function(m) { return !m.endDate || new Date(m.endDate) >= new Date(); });
  var allMeds = p.medications || [];

  var bpTrend  = getBPTrend(p.bpReadings  || []);
  var a1cTrend = getA1CTrend(p.a1cReadings || []);

  var lastBP  = bp.slice(-1)[0];
  var lastA1C = a1c.slice(-1)[0];
  var bpStatus  = lastBP  ? getBPStatus(lastBP.sys, lastBP.dia) : null;
  var a1cStatus = lastA1C ? getA1CStatus(lastA1C.val) : null;

  var totalBPReadings  = (p.bpReadings  || []).length;
  var totalA1CReadings = (p.a1cReadings || []).length;
  var firstBP  = (p.bpReadings  || [])[0];
  var firstA1C = (p.a1cReadings || [])[0];

  var bpHistory = bp.map(function(r) {
    return '  ' + r.datetime + ': ' + r.sys + '/' + r.dia + ' mmHg (' + getBPStatus(r.sys, r.dia) + ')' + (r.note ? ' — Note: ' + r.note : '');
  }).join('\n') || '  No BP readings recorded';

  var a1cHistory = a1c.map(function(r) {
    return '  ' + r.datetime + ': ' + r.val + '% (' + getA1CStatus(r.val) + ')' + (r.note ? ' — Note: ' + r.note : '');
  }).join('\n') || '  No A1C readings recorded';

  var activeMedList = meds.length
    ? meds.map(function(m) { return '  ' + m.name + ' ' + m.dosage + ' (started ' + m.startDate + ')'; }).join('\n')
    : '  No active medications';

  var discMedList = allMeds
    .filter(function(m) { return m.endDate && new Date(m.endDate) < new Date(); })
    .map(function(m) { return '  ' + m.name + ' ' + m.dosage + ' (discontinued ' + m.endDate + ')'; })
    .join('\n');

  var today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  var isSOAP = currentNoteFormat === 'soap';

  var firstBPLine  = firstBP  ? 'First recorded BP: ' + firstBP.sys + '/' + firstBP.dia + ' mmHg on ' + firstBP.datetime : '';
  var firstA1CLine = firstA1C ? 'First recorded A1C: ' + firstA1C.val + '% on ' + firstA1C.datetime : '';
  var discSection  = discMedList ? '\nDiscontinued Medications:\n' + discMedList : '';

  var prompt;
  if (isSOAP) {
    prompt = 'You are a clinical documentation specialist at Helping Hands Free Community Clinic. Generate a detailed, thorough SOAP note for this patient visit. Be specific with all numbers. Write full sentences in each section. Do not leave any section sparse.\n\n' +
      'Patient ID: #' + currentPatientId + '\n' +
      'Visit Date: ' + today + '\n' +
      'Clinic: Helping Hands Free Community Clinic, Columbus, OH\n\n' +
      'CLINICAL DATA:\n\n' +
      'Blood Pressure History (' + totalBPReadings + ' total readings on file):\n' +
      bpHistory + '\n' +
      firstBPLine + '\n' +
      'BP Trend: ' + bpTrend.toUpperCase() + ' | Current Status: ' + (bpStatus || 'unknown') + '\n\n' +
      'A1C History (' + totalA1CReadings + ' total readings on file):\n' +
      a1cHistory + '\n' +
      firstA1CLine + '\n' +
      'A1C Trend: ' + a1cTrend.toUpperCase() + ' | Current Status: ' + (a1cStatus || 'unknown') + '\n\n' +
      'Active Medications:\n' + activeMedList + discSection + '\n\n' +
      'INSTRUCTIONS — Write each section in full detail:\n\n' +
      'SUBJECTIVE: Describe why the patient is being seen (hypertension/diabetes management follow-up). Note the visit is for chronic disease monitoring at a free community clinic. Mention how long the patient has been followed (based on first reading date). Note any relevant observations from reading notes. If notes mention symptoms, adherence, or missed medications — include them here.\n\n' +
      'OBJECTIVE: List ALL vital signs with exact values and clinical classifications. Compare most recent reading to previous readings with exact numbers and calculate the change. Note whether readings are improving, worsening, or stable with specific mmHg or % differences. List all active medications with doses.\n\n' +
      'ASSESSMENT: Provide a thorough clinical assessment of BP control and glycemic control. Reference specific numbers. Discuss medication effectiveness based on trend data. Flag any critical or urgent values. Discuss overall disease management progress.\n\n' +
      'PLAN: Write specific, actionable next steps including follow-up timing, medication considerations, monitoring recommendations, and patient education points relevant to hypertension/diabetes management.';
  } else {
    prompt = 'You are a clinical documentation specialist at Helping Hands Free Community Clinic. Write a detailed, professional visit summary paragraph for this patient. Include specific numbers, trends, medication correlation, and clear next steps. Write at least 5-6 sentences. Be thorough and specific — this will be used for clinical documentation.\n\n' +
      'Patient ID: #' + currentPatientId + '\n' +
      'Visit Date: ' + today + '\n' +
      'Clinic: Helping Hands Free Community Clinic, Columbus, OH\n\n' +
      'CLINICAL DATA:\n\n' +
      'Blood Pressure History (' + totalBPReadings + ' total readings):\n' +
      bpHistory + '\n' +
      firstBPLine + '\n' +
      'Overall BP Trend: ' + bpTrend.toUpperCase() + ' | Current Classification: ' + (bpStatus || 'unknown') + '\n\n' +
      'A1C History (' + totalA1CReadings + ' total readings):\n' +
      a1cHistory + '\n' +
      firstA1CLine + '\n' +
      'Overall A1C Trend: ' + a1cTrend.toUpperCase() + ' | Current Classification: ' + (a1cStatus || 'unknown') + '\n\n' +
      'Active Medications:\n' + activeMedList + discSection + '\n\n' +
      'Write a thorough clinical paragraph that: (1) states the reason for visit and how long patient has been followed, (2) describes current vital findings with exact numbers and comparisons to prior readings, (3) assesses the trend and medication effectiveness, (4) identifies any urgent concerns, (5) outlines specific follow-up recommendations.';
  }

  try {
    var response = await fetch(APPS_SCRIPT_URL + '?action=claude', {
      method: 'POST',
      body: JSON.stringify({ prompt: prompt })
    });

    if (!response.ok) {
      throw new Error('Proxy error ' + response.status);
    }

    var data = await response.json();
    if (data.error) throw new Error(data.error.message || 'API error');
    var text = data.content[0].text;

    document.getElementById('visitNoteText').value = text;
    document.getElementById('visitNoteTimestamp').textContent =
      'Generated ' + new Date().toLocaleTimeString() + ' \u00b7 ' + (isSOAP ? 'SOAP format' : 'Paragraph format') + ' \u00b7 Patient #' + currentPatientId;
    document.getElementById('visitNoteGenerating').style.display = 'none';
    document.getElementById('visitNoteEditor').style.display = 'block';
    document.getElementById('visitNoteRegenBtn').style.display = 'inline-flex';
    document.getElementById('visitNoteCopyBtn').style.display = 'inline-flex';

  } catch (e) {
    console.error('Visit note generation error:', e);
    document.getElementById('visitNoteGenerating').style.display = 'none';
    document.getElementById('visitNotePrompt').style.display = 'block';
    document.getElementById('visitNotePrompt').innerHTML =
      '<div style="font-size:32px;margin-bottom:12px;">\u26A0\uFE0F</div>' +
      '<div style="font-size:14px;color:var(--alert-red);margin-bottom:8px;">Failed to generate note.</div>' +
      '<div style="font-size:12px;color:var(--text-light);font-family:monospace;background:var(--cream);padding:8px 12px;border-radius:8px;text-align:left;">' + e.message + '</div>';
    document.getElementById('visitNoteGenerateBtn').style.display = 'inline-flex';
  }
}

async function copyVisitNote() {
  var text = document.getElementById('visitNoteText').value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    var btn = document.getElementById('visitNoteCopyBtn');
    btn.textContent = '\u2705 Copied!';
    setTimeout(function() { btn.innerHTML = '\uD83D\uDCCB Copy to Clipboard'; }, 2000);
    showToast('Visit note copied to clipboard');
  } catch (e) {
    document.getElementById('visitNoteText').select();
    document.execCommand('copy');
    showToast('Visit note copied');
  }
}
