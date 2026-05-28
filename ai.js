// ═══════════════════════════════════
// AI VISIT NOTE GENERATOR — Powered by Claude
// ═══════════════════════════════════

const CLAUDE_API_KEY = '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';

let currentNoteFormat = 'soap';

function setNoteFormat(fmt, btn) {
  currentNoteFormat = fmt;
  document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function openVisitNoteModal() {
  if (!currentPatientId) return;
  document.getElementById('visitNoteModalSub').textContent = `Patient #${currentPatientId} · Powered by Claude AI`;
  document.getElementById('visitNotePrompt').style.display = 'block';
  document.getElementById('visitNoteEditor').style.display = 'none';
  document.getElementById('visitNoteGenerating').style.display = 'none';
  document.getElementById('visitNoteGenerateBtn').style.display = 'inline-flex';
  document.getElementById('visitNoteRegenBtn').style.display = 'none';
  document.getElementById('visitNoteCopyBtn').style.display = 'none';
  document.getElementById('visitNoteText').value = '';

  // Reset prompt box in case it was replaced by an error message
  document.getElementById('visitNotePrompt').innerHTML = `
    <div style="font-size:40px;margin-bottom:12px;">📋</div>
    <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:var(--text-dark);margin-bottom:8px;">Ready to generate</div>
    <div style="font-size:14px;color:var(--text-light);line-height:1.7;max-width:360px;margin:0 auto;">Claude will read this patient's last 3 readings, medications, and trends to draft a visit note ready for Athena.</div>`;

  document.getElementById('visitNoteModal').classList.add('open');
}

async function generateVisitNote() {
  if (!currentPatientId) return;
  const p = db.patients[currentPatientId];
  if (!p) return;

  // Show loading state
  document.getElementById('visitNotePrompt').style.display = 'none';
  document.getElementById('visitNoteEditor').style.display = 'none';
  document.getElementById('visitNoteGenerating').style.display = 'block';
  document.getElementById('visitNoteGenerateBtn').style.display = 'none';
  document.getElementById('visitNoteRegenBtn').style.display = 'none';
  document.getElementById('visitNoteCopyBtn').style.display = 'none';

  // Build context from last 3 readings
  const bp   = (p.bpReadings  || []).slice(-3);
  const a1c  = (p.a1cReadings || []).slice(-3);
  const meds = (p.medications || []).filter(m => !m.endDate || new Date(m.endDate) >= new Date());
  const allMeds = p.medications || [];

  const bpTrend  = getBPTrend(p.bpReadings  || []);
  const a1cTrend = getA1CTrend(p.a1cReadings || []);

  const lastBP  = bp.slice(-1)[0];
  const lastA1C = a1c.slice(-1)[0];
  const bpStatus  = lastBP  ? getBPStatus(lastBP.sys, lastBP.dia) : null;
  const a1cStatus = lastA1C ? getA1CStatus(lastA1C.val)           : null;

  const totalBPReadings  = (p.bpReadings  || []).length;
  const totalA1CReadings = (p.a1cReadings || []).length;
  const firstBP  = (p.bpReadings  || [])[0];
  const firstA1C = (p.a1cReadings || [])[0];

  const bpHistory = bp.map(r =>
    `  ${r.datetime}: ${r.sys}/${r.dia} mmHg (${getBPStatus(r.sys, r.dia)})${r.note ? ' — Note: ' + r.note : ''}`
  ).join('\n') || '  No BP readings recorded';

  const a1cHistory = a1c.map(r =>
    `  ${r.datetime}: ${r.val}% (${getA1CStatus(r.val)})${r.note ? ' — Note: ' + r.note : ''}`
  ).join('\n') || '  No A1C readings recorded';

  const activeMedList = meds.length
    ? meds.map(m => `  ${m.name} ${m.dosage} (started ${m.startDate})`).join('\n')
    : '  No active medications';

  const discMedList = allMeds
    .filter(m => m.endDate && new Date(m.endDate) < new Date())
    .map(m => `  ${m.name} ${m.dosage} (discontinued ${m.endDate})`)
    .join('\n');

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const isSOAP = currentNoteFormat === 'soap';

  const prompt = isSOAP
    ? `You are a clinical documentation specialist at Helping Hands Free Community Clinic. Generate a detailed, thorough SOAP note for this patient visit. Be specific with all numbers. Write full sentences in each section. Do not leave any section sparse.

Patient ID: #${currentPatientId}
Visit Date: ${today}
Clinic: Helping Hands Free Community Clinic, Columbus, OH

CLINICAL DATA:

Blood Pressure History (${totalBPReadings} total readings on file):
${bpHistory}
${firstBP ? `First recorded BP: ${firstBP.sys}/${firstBP.dia} mmHg on ${firstBP.datetime}` : ''}
BP Trend: ${bpTrend.toUpperCase()} | Current Status: ${bpStatus || 'unknown'}

A1C History (${totalA1CReadings} total readings on file):
${a1cHistory}
${firstA1C ? `First recorded A1C: ${firstA1C.val}% on ${firstA1C.datetime}` : ''}
A1C Trend: ${a1cTrend.toUpperCase()} | Current Status: ${a1cStatus || 'unknown'}

Active Medications:
${activeMedList}
${discMedList ? '\nDiscontinued Medications:\n' + discMedList : ''}

INSTRUCTIONS — Write each section in full detail:

SUBJECTIVE: Describe why the patient is being seen (hypertension/diabetes management follow-up). Note the visit is for chronic disease monitoring at a free community clinic. Mention how long the patient has been followed (based on first reading date). Note any relevant observations from reading notes. If notes mention symptoms, adherence, or missed medications — include them here.

OBJECTIVE: List ALL vital signs with exact values and clinical classifications. Compare most recent reading to previous readings with exact numbers and calculate the change. Note whether readings are improving, worsening, or stable with specific mmHg or % differences. List all active medications with doses.

ASSESSMENT: Provide a thorough clinical assessment of BP control and glycemic control. Reference specific numbers. Discuss medication effectiveness based on trend data. Flag any critical or urgent values. Discuss overall disease management progress.

PLAN: Write specific, actionable next steps including follow-up timing, medication considerations, monitoring recommendations, and patient education points relevant to hypertension/diabetes management.`

    : `You are a clinical documentation specialist at Helping Hands Free Community Clinic. Write a detailed, professional visit summary paragraph for this patient. Include specific numbers, trends, medication correlation, and clear next steps. Write at least 5-6 sentences. Be thorough and specific — this will be used for clinical documentation.

Patient ID: #${currentPatientId}
Visit Date: ${today}
Clinic: Helping Hands Free Community Clinic, Columbus, OH

CLINICAL DATA:

Blood Pressure History (${totalBPReadings} total readings):
${bpHistory}
${firstBP ? `First recorded BP: ${firstBP.sys}/${firstBP.dia} mmHg on ${firstBP.datetime}` : ''}
Overall BP Trend: ${bpTrend.toUpperCase()} | Current Classification: ${bpStatus || 'unknown'}

A1C History (${totalA1CReadings} total readings):
${a1cHistory}
${firstA1C ? `First recorded A1C: ${firstA1C.val}% on ${firstA1C.datetime}` : ''}
Overall A1C Trend: ${a1cTrend.toUpperCase()} | Current Classification: ${a1cStatus || 'unknown'}

Active Medications:
${activeMedList}
${discMedList ? '\nDiscontinued Medications:\n' + discMedList : ''}

Write a thorough clinical paragraph that: (1) states the reason for visit and how long patient has been followed, (2) describes current vital findings with exact numbers and comparisons to prior readings, (3) assesses the trend and medication effectiveness, (4) identifies any urgent concerns, (5) outlines specific follow-up recommendations.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const text = data.content[0].text;

    document.getElementById('visitNoteText').value = text;
    document.getElementById('visitNoteTimestamp').textContent =
      `Generated ${new Date().toLocaleTimeString()} · ${isSOAP ? 'SOAP format' : 'Paragraph format'} · Patient #${currentPatientId}`;
    document.getElementById('visitNoteGenerating').style.display = 'none';
    document.getElementById('visitNoteEditor').style.display = 'block';
    document.getElementById('visitNoteRegenBtn').style.display = 'inline-flex';
    document.getElementById('visitNoteCopyBtn').style.display = 'inline-flex';

  } catch (e) {
    console.error('Visit note generation error:', e);
    document.getElementById('visitNoteGenerating').style.display = 'none';
    document.getElementById('visitNotePrompt').style.display = 'block';
    document.getElementById('visitNotePrompt').innerHTML = `
      <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
      <div style="font-size:14px;color:var(--alert-red);margin-bottom:8px;">Failed to generate note.</div>
      <div style="font-size:12px;color:var(--text-light);font-family:monospace;background:var(--cream);padding:8px 12px;border-radius:8px;text-align:left;">${e.message}</div>`;
    document.getElementById('visitNoteGenerateBtn').style.display = 'inline-flex';
  }
}

async function copyVisitNote() {
  const text = document.getElementById('visitNoteText').value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('visitNoteCopyBtn');
    btn.textContent = '✅ Copied!';
    setTimeout(() => { btn.innerHTML = '📋 Copy to Clipboard'; }, 2000);
    showToast('Visit note copied to clipboard');
  } catch (e) {
    // Fallback for browsers that block clipboard API
    document.getElementById('visitNoteText').select();
    document.execCommand('copy');
    showToast('Visit note copied');
  }
}
