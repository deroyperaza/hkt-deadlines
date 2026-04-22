const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const cheerio = require('cheerio');

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'us-east1' });

// ── PROJECT CONFIG ────────────────────────────────────────────────────────────
// Add each project channel + canvas ID here.
// To find a canvas ID: look for "made updates to a canvas tab: FXXXXXXXX" in the channel.
const PROJECTS = [
  { name: 'TFA',          channelId: 'C0A8BS18KJP', canvasId: 'F0AARPS72CR' },
  { name: 'MNMF',         channelId: 'C092D6W7MR7', canvasId: 'F0920FBC9M0' },
  { name: 'MNMF Web', channelId: 'C0AMK4MCQMP', canvasId: 'F0AMKG43X8R' },
  { name: 'Mass Insight', channelId: 'C09BW8FH0FP', canvasId: 'F09BJT2A347', colOrder: 'date-first' },
  { name: 'SAAF',         channelId: 'C09NJ3S0GKZ', canvasId: 'F09RC6EMX8R' },
  { name: 'CHCF 30',      channelId: 'C09NBBJ5ATT', canvasId: 'F09NJJHAC4F' },
  { name: 'JVS',          channelId: 'C0A2S704Q2U', canvasId: 'F0A9X2X9UGP' },
  { name: 'CLUA',         channelId: 'C0AEZ6N6ERG', canvasId: 'F0AH4V68RP1' },
  { name: 'EFSC',         channelId: 'C0A2F64UJP5', canvasId: 'F0AGMENJG5N' },
  { name: 'FP',           channelId: 'C0ANYASBU4U', canvasId: 'F0AHEHCQ999' },
  { name: 'MACP',         channelId: 'C06PJ58UPLM', canvasId: 'F06PPGGLBJQ' },
  { name: 'Prysm',        channelId: 'C09K3F0NE9K', canvasId: 'F09K4V9EDC5' },
  // No canvas found for these projects (retainer or completed):
  // { name: 'RWJF',         channelId: 'C03QXS2D6HG', canvasId: '' },
  // { name: 'CL IFI',       channelId: 'C052005RJF9', canvasId: '' },
  // { name: 'SJLF',         channelId: 'C09FUTYGECU', canvasId: '' },
];

// ── CANVAS PARSER ─────────────────────────────────────────────────────────────

const MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_LONG   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT_MAP = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

function parseSlackDate(dateCell) {
  // Primary: slack_date:YYYY-MM-DD
  const m = dateCell.match(/slack_date:(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1]);
    const mo = parseInt(m[2]) - 1; // 0-indexed
    const d  = parseInt(m[3]);
    const approx = dateCell.includes('~~') || /^~/.test(dateCell.trim());
    return {
      iso:     `${m[1]}-${m[2]}-${m[3]}`,
      display: (approx ? '~' : '') + MONTH_SHORT[mo] + ' ' + d,
      month:   MONTH_LONG[mo],
    };
  }

  // Fallback: "Week of Month Nth" → approximate first date of that week
  const weekMatch = dateCell.match(/[Ww]eek of\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d+)/i);
  if (weekMatch) {
    const mo = MONTH_SHORT_MAP[weekMatch[1].toLowerCase().slice(0, 3)];
    const d  = parseInt(weekMatch[2]);
    if (mo !== undefined && d) {
      const iso = `2026-${String(mo + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      return { iso, display: `~${MONTH_SHORT[mo]} ${d}`, month: MONTH_LONG[mo] };
    }
  }

  // Fallback: plain "Month Nth" text
  const plainMatch = dateCell.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d+)/i);
  if (plainMatch) {
    const mo = MONTH_SHORT_MAP[plainMatch[1].toLowerCase().slice(0, 3)];
    const d  = parseInt(plainMatch[2]);
    if (mo !== undefined && d) {
      const iso = `2026-${String(mo + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      return { iso, display: `${MONTH_SHORT[mo]} ${d}`, month: MONTH_LONG[mo] };
    }
  }

  return null;
}

function inferLed(phase, milestone = '', project = '') {
  const m = milestone.toLowerCase();

  // Milestone-level rules (highest priority)
  if (m.includes('feedback'))         return 'Client';
  if (m.includes('ooo'))              return 'Client';
  if (m.includes('naming decision'))  return 'Client';

  // Multi-team milestones
  if (m.includes('board meeting')) return 'Strategy + Creative + Account Management';
  if (m.includes('kick-off') || m.includes('kickoff') || m.includes('kick off')) return 'Account Management + PM';

  // Explicit discipline keywords in milestone
  const hasDesign  = m.includes('design layout') || m.includes('design system') ||
                     m.includes('brand guide')   || m.includes('logo');
  const hasContent = m.includes('content writing');
  if (hasDesign && hasContent) return 'Creative + Strategy';
  if (hasDesign)  return 'Creative';
  if (hasContent) return 'Strategy';

  // Project-level rules
  if (project === 'MACP') return 'Strategy';

  // Phase keyword matching
  const p = phase.toLowerCase();
  if (p.includes('discovery') || p.includes('strategy') || p.includes('verbal') || p.includes('naming')) return 'Strategy';
  if (p.includes('website') || p.includes('content') || p.includes('sitemap') || p.includes('wireframe') || p.includes('build') || p.includes('ux')) return 'UX Strategy';
  if (p.includes('implementation') || p.includes('training') || p.includes('roadshow')) return 'Account Management';
  return 'Creative';
}

function cleanMilestone(raw) {
  return raw
    .replace(/:star:/g, '').replace(/:package:/g, '').replace(/:octagonal_sign:/g, '')
    .replace(/:kermit_typing:/g, '').replace(/!\[\]\(slack_date:[^)]+\)/g, '')
    .replace(/~~[^~]*~~/g, '') // remove strikethrough
    .replace(/\bTO BE SCHEDULED\b/gi, '')
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim();
}

function cleanPhase(raw) {
  return raw
    .replace(/<br>/gi, ' ').replace(/\d+\.\d+\s*-\s*\d+\.\d+/g, '')
    .replace(/\*\*/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

// ── HTML CANVAS PARSER (Quip format from url_private_download) ────────────────

function parseCanvasHtml(projectName, html, options = {}) {
  const deadlines = [];
  const $ = cheerio.load(html);

  $('table').each((_ti, table) => {
    let currentPhase = '';
    // Track rowspan for phase column
    let phaseRowspan = 0;
    let pendingPhase  = '';

    $(table).find('tr').each((_ri, row) => {
      const $row  = $(row);

      // Skip header rows (any <th> cells)
      if ($row.find('th').length > 0) return;

      const $cells = $row.find('td');
      const count  = $cells.length;
      if (count < 2) return;

      let phaseText = '', $milestone, dateText, $status;

      if (count >= 4) {
        // Full row — phase in col 0
        phaseText  = $($cells[0]).text().trim();
        // Support alternate column order: Phase | Date | Milestone | Status
        if (options.colOrder === 'date-first') {
          dateText   = $($cells[1]).text().trim();
          $milestone = $($cells[2]);
        } else {
          $milestone = $($cells[1]);
          dateText   = $($cells[2]).text().trim();
        }
        $status    = $($cells[3]);
        // Read rowspan so we can carry phase forward
        const rs = parseInt($($cells[0]).attr('rowspan') || '1', 10);
        if (phaseText) { pendingPhase = phaseText; phaseRowspan = rs; }
      } else if (count === 3) {
        // Continuation row — phase carried from rowspan
        // Support alternate column order: Date | Milestone | Status
        if (options.colOrder === 'date-first') {
          dateText   = $($cells[0]).text().trim();
          $milestone = $($cells[1]);
        } else {
          $milestone = $($cells[0]);
          dateText   = $($cells[1]).text().trim();
        }
        $status    = $($cells[2]);
      } else {
        // 2-column table (e.g. Date | Meeting) — no phase or status columns
        dateText   = $($cells[0]).text().trim();
        $milestone = $($cells[1]);
        $status    = null;
      }

      if (phaseText) currentPhase = cleanPhase(phaseText);
      else if (phaseRowspan > 1) { phaseRowspan--; currentPhase = cleanPhase(pendingPhase); }

      // For 2-column tables with no established phase, use a default
      if (!currentPhase) {
        if (count === 2) currentPhase = 'Meetings';
        else return;
      }

      const dateInfo = parseSlackDate(dateText);
      if (!dateInfo) return;

      const milestoneText = $milestone.text().trim();
      const milestoneHtml = $milestone.html() || '';

      const milestone = cleanMilestone(milestoneText);
      if (!milestone) return;

      // Completed: li.checked or [x] text
      const statusHtml = $status ? ($status.html() || '') : '';
      const statusText = $status ? $status.text() : '';

      const completed  = /class="[^"]*checked[^"]*"/.test(statusHtml) ||
                         statusText.includes('[x]') ||
                         ($status && $status.find('.checked, [data-checked]').length > 0);

      // Star: various representations of :star: emoji in HTML
      const star = milestoneText.includes('⭐') ||
                   milestoneText.includes('★')  ||
                   milestoneHtml.includes(':star:') ||
                   /alt=":star:"/i.test(milestoneHtml) ||
                   /emoji.*star|star.*emoji/i.test(milestoneHtml);

      const milestoneSlug = milestone.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
      const docId = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${dateInfo.iso}_${milestoneSlug}`;

      deadlines.push({
        docId,
        project:  projectName,
        phase:    currentPhase,
        milestone,
        date:     dateInfo.display,
        month:    dateInfo.month,
        dateISO:  dateInfo.iso,
        star,
        completed,
        note:     '',
        led:      inferLed(currentPhase, milestone, projectName),
        sourceCanvas: '',
      });
    });
  });

  return deadlines;
}

// ── FEEDBACK DATE EXTRACTOR ───────────────────────────────────────────────────
// Detects embedded client feedback dates inside milestone text, e.g.:
//   "One-Pager Template R1Feedback: May 13th"
//   "Design Layout R1 + Content Writing Final Delivery(ASYNC HANDOFF)Feedback on Design Layout R1: April 30th"
// Splits them into a separate Client-tagged deadline entry.

// Matches feedback trailers like:
//   "Feedback: May 13th"
//   "Feedback on Design Layout R1: April 30th"
//   "(ASYNC HANDOFF) Feedback on ...: April 30th"
//   "Feedback in 5 days: May 11th"
//   "Feedback in 2 days"  (no date — strip trailer only, no new entry)
const FEEDBACK_RE = /\s*(?:\(ASYNC HANDOFF\)\s*)?Feedback(?:\s+in\s+\d+\s+days)?(?:\s+on\s+([^:]+))?(?::\s*((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d+(?:st|nd|rd|th)?))?/i;

function expandFeedbackDates(deadlines) {
  const result = [];
  for (const d of deadlines) {
    const match = FEEDBACK_RE.exec(d.milestone);
    if (!match) { result.push(d); continue; }

    // Clean original: strip from the feedback marker onward
    const cleanedMilestone = d.milestone.slice(0, match.index).replace(/\s*\(ASYNC HANDOFF\)\s*$/i, '').trim();
    const feedbackLabel    = match[1] ? `Feedback on ${match[1].trim()}` : `Feedback on ${cleanedMilestone}`;
    const fbDateInfo       = match[2] ? parseSlackDate(match[2]) : null;

    if (cleanedMilestone) {
      result.push({ ...d, milestone: cleanedMilestone, led: inferLed(d.phase, cleanedMilestone, d.project) });
    }

    if (fbDateInfo) {
      const fbSlug  = feedbackLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
      const fbDocId = `${d.project.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${fbDateInfo.iso}_${fbSlug}`;
      result.push({
        ...d,
        docId:    fbDocId,
        milestone: feedbackLabel,
        date:     fbDateInfo.display,
        month:    fbDateInfo.month,
        dateISO:  fbDateInfo.iso,
        led:      'Client',
        star:     false,
      });
    } else if (!cleanedMilestone) {
      // No date and no cleaned milestone — keep original intact
      result.push(d);
    }
    // else: no date but cleanedMilestone exists — trailer stripped, no feedback entry created
  }
  return result;
}

function parseCanvas(projectName, content, options = {}) {
  // Dispatch based on content type
  let deadlines;
  if (content.trimStart().startsWith('<')) {
    deadlines = parseCanvasHtml(projectName, content, options);
  } else {
    deadlines = parseCanvasMarkdown(projectName, content);
  }
  return expandFeedbackDates(deadlines);
}

function parseCanvasMarkdown(projectName, markdown) {
  const deadlines = [];

  // Split into table blocks (each table is separated by blank lines)
  const blocks = markdown.split(/\n{2,}/);
  const tableBlocks = blocks.filter(b => b.includes('|') && b.includes('---'));

  for (const block of tableBlocks) {
    const rows = block.split('\n').filter(line => line.trim().startsWith('|'));
    let currentPhase = '';

    for (const row of rows) {
      // Skip header and separator rows
      if (row.includes('**Phase**') || row.includes('**Milestone**') || /^\|\s*---/.test(row)) continue;

      const cells = row.split('|').map(c => c.trim());
      // cells[0] is empty (leading |), cells[1]=Phase, cells[2]=Milestone, cells[3]=Date, cells[4]=Status
      if (cells.length < 5) continue;

      const phaseCell     = cells[1];
      const milestoneCell = cells[2];
      const dateCell      = cells[3];
      const statusCell    = cells[4] || '';

      if (phaseCell) currentPhase = cleanPhase(phaseCell);

      const dateInfo = parseSlackDate(dateCell);
      if (!dateInfo) continue;

      const milestone = cleanMilestone(milestoneCell);
      if (!milestone) continue;

      // Skip strikethrough rows (cancelled milestones)
      if (milestoneCell.trim().startsWith('~~')) continue;

      const completed = statusCell.includes('[x]');
      const star      = milestoneCell.includes(':star:');

      // Deterministic doc ID: project_dateISO_milestoneSlug
      const milestoneSlug = milestone.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
      const docId = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${dateInfo.iso}_${milestoneSlug}`;

      deadlines.push({
        docId,
        project:      projectName,
        phase:        currentPhase,
        milestone,
        date:         dateInfo.display,
        month:        dateInfo.month,
        dateISO:      dateInfo.iso,
        star,
        completed,
        note:         '',
        led:          inferLed(currentPhase, milestone, projectName),
        sourceCanvas: '',
      });
    }
  }

  return deadlines;
}

// ── SLACK API HELPERS ─────────────────────────────────────────────────────────

async function fetchCanvas(canvasId, token) {
  const res = await fetch(`https://slack.com/api/files.info?file=${canvasId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack files.info error: ${json.error}`);

  // Canvas markdown is in file.plain_text or we use the canvas.get endpoint
  const canvasRes = await fetch(`https://slack.com/api/canvases.sections.lookup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ canvas_id: canvasId, criteria: { section_types: ['any_header'] } }),
  });

  // Use the simpler files endpoint that returns markdown content
  const mdRes = await fetch(`https://slack.com/api/files.info?file=${canvasId}&pretty=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const mdJson = await mdRes.json();
  return mdJson.file?.plain_text || mdJson.file?.preview || '';
}

async function fetchCanvasMarkdown(canvasId, token) {
  const res = await fetch(`https://slack.com/api/files.info?file=${canvasId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack API error fetching canvas ${canvasId}: ${json.error}`);

  const file = json.file || {};

  // Try inline text fields first
  if (file.plain_text && file.plain_text.trim()) return file.plain_text;
  if (file.preview   && file.preview.trim())    return file.preview;
  if (file.content   && file.content.trim())    return file.content;

  // Canvas files: download content via the private URL (returns Quip HTML)
  const downloadUrl = file.url_private_download || file.url_private;
  if (downloadUrl) {
    const dlRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (dlRes.ok) {
      const text = await dlRes.text();
      if (text && text.trim()) return text;
    }
  }

  throw new Error(`No content found in canvas ${canvasId}`);
}

// ── CORE SYNC LOGIC ───────────────────────────────────────────────────────────

async function runSync(triggerInfo = { trigger: 'automatic', triggeredBy: 'Scheduled' }) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN environment variable not set');

  // ── Connectivity diagnostic ───────────────────────────────────────────────
  try {
    const t0 = Date.now();
    const pingRes = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const pingJson = await pingRes.json();
    console.log(`[diag] auth.test: ok=${pingJson.ok} error=${pingJson.error || 'none'} ms=${Date.now()-t0}`);
  } catch (err) {
    console.error(`[diag] auth.test failed: ${err.name} ${err.message}`);
  }

  let totalDeadlines = 0;
  const errors = [];

  // ── Phase 1: Load stored project metadata + fetch canvas file info (serialized to avoid Slack rate-limiting) ──
  async function fetchFilesInfo(project, attempt = 1) {
    try {
      const res = await fetch(`https://slack.com/api/files.info?file=${project.canvasId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20000),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(`${project.name}: Slack API error: ${json.error}`);
      console.log(`[meta] ${project.name}: ok, attempt=${attempt}, updated=${json.file?.updated}`);
      return { project, file: json.file };
    } catch (err) {
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      if (isTimeout && attempt < 2) {
        console.log(`[meta] ${project.name}: timeout on attempt ${attempt}, retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        return fetchFilesInfo(project, attempt + 1);
      }
      const msg = isTimeout
        ? `${project.name}: files.info timed out after ${attempt} attempt(s)`
        : err.message;
      throw new Error(msg);
    }
  }

  // Serialize with 200ms gap — avoids triggering Slack's per-token rate limiter on parallel bursts
  async function fetchAllMeta() {
    const results = [];
    for (const project of PROJECTS) {
      results.push(await fetchFilesInfo(project).then(v => ({ status: 'fulfilled', value: v })).catch(e => ({ status: 'rejected', reason: e })));
      await new Promise(r => setTimeout(r, 200));
    }
    return results;
  }

  const [projectSnap, metaResults] = await Promise.all([
    db.collection('projects').get(),
    fetchAllMeta(),
  ]);

  // Build lookup of stored timestamps keyed by project name
  const storedMeta = {};
  projectSnap.forEach(doc => { storedMeta[doc.id] = doc.data(); });

  // ── Phase 2: Download only canvases that have changed ─────────────────────────
  const toSync = [];
  for (const result of metaResults) {
    if (result.status === 'rejected') {
      errors.push(result.reason?.message || String(result.reason));
      continue;
    }
    const { project, file } = result.value;
    const newTs = file.updated || file.timestamp || null;
    const stored = storedMeta[project.name];

    if (newTs && stored?.canvasUpdatedAt === newTs) {
      // Canvas unchanged — count existing deadlines toward total, skip download
      totalDeadlines += stored.deadlineCount || 0;
      continue;
    }
    toSync.push({ project, file, newTs });
  }

  if (toSync.length === 0) {
    const syncTs = admin.firestore.FieldValue.serverTimestamp();
    await Promise.all([
      db.collection('meta').doc('sync').set({
        lastSynced:    syncTs,
        status:        errors.length ? 'partial' : 'success',
        deadlineCount: totalDeadlines,
        errors,
      }),
      db.collection('updateLog').add({
        type:             'sync',
        trigger:          triggerInfo.trigger,
        triggeredBy:      triggerInfo.triggeredBy,
        sortDate:         syncTs,
        deadlineCount:    totalDeadlines,
        projectsUpdated:  0,
        projectsSkipped:  PROJECTS.length - errors.length,
        errors,
        changes:          [],
      }),
    ]);
    return { count: totalDeadlines, projects: 0, errors, skipped: PROJECTS.length - errors.length };
  }

  // ── Phase 3: Download + parse changed canvases in parallel ────────────────────
  const downloadResults = await Promise.allSettled(
    toSync.map(async ({ project, file, newTs }) => {
      const downloadUrl = file.url_private_download || file.url_private;
      if (!downloadUrl) throw new Error(`${project.name}: No download URL`);
      let dlRes;
      try {
        dlRes = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(60000), // 60s per canvas download
        });
      } catch (err) {
        const msg = err.name === 'TimeoutError' || err.name === 'AbortError'
          ? `${project.name}: download timed out after 60s`
          : `${project.name}: download failed: ${err.message}`;
        throw new Error(msg);
      }
      if (!dlRes.ok) throw new Error(`${project.name}: Download failed ${dlRes.status}`);
      const content = await dlRes.text();
      if (!content?.trim()) throw new Error(`${project.name}: Empty content`);
      const deadlines = parseCanvas(project.name, content, project);
      return { project, deadlines, newTs };
    })
  );

  // ── Phase 4: Write to Firestore ───────────────────────────────────────────────
  const allChanges = []; // accumulate across all projects for the log entry

  for (const result of downloadResults) {
    if (result.status === 'rejected') {
      errors.push(result.reason?.message || String(result.reason));
      continue;
    }
    const { project, deadlines, newTs } = result.value;
    try {
      // Remove stale docs — any existing Firestore doc for this project
      // whose docId is no longer produced by the current parse.
      const newDocIds = new Set(deadlines.map(d => d.docId));
      const existingSnap = await db.collection('deadlines')
        .where('project', '==', project.name).get();

      // Build lookup of existing docs for change detection
      const existingMap = {};
      existingSnap.docs.forEach(doc => { existingMap[doc.id] = doc.data(); });

      // Detect added / field-changed deadlines
      const TRACK = ['milestone', 'date', 'phase', 'led'];
      for (const d of deadlines) {
        const prev = existingMap[d.docId];
        if (!prev) {
          allChanges.push({ type: 'added', project: d.project, milestone: d.milestone, date: d.date });
        } else {
          for (const field of TRACK) {
            if (prev[field] !== d[field]) {
              allChanges.push({ type: 'changed', project: d.project, milestone: d.milestone, field, from: prev[field] || '', to: d[field] || '' });
              break; // one change entry per deadline (most significant field)
            }
          }
        }
      }

      const stale = existingSnap.docs.filter(doc => !newDocIds.has(doc.id));
      if (stale.length > 0) {
        stale.forEach(doc => {
          const data = doc.data();
          allChanges.push({ type: 'removed', project: data.project || project.name, milestone: data.milestone || doc.id, date: data.date || '' });
        });
        const deleteBatch = db.batch();
        stale.forEach(doc => deleteBatch.delete(doc.ref));
        await deleteBatch.commit();
        console.log(`[cleanup] ${project.name}: deleted ${stale.length} stale doc(s)`);
      }

      const batch = db.batch();
      for (const d of deadlines) {
        const { docId, ...data } = d;
        data.sourceCanvas = project.canvasId;
        data.lastSyncedAt = admin.firestore.FieldValue.serverTimestamp();
        const syncData = { ...data };
        if (!syncData.completed) delete syncData.completed;
        batch.set(db.collection('deadlines').doc(docId), syncData, { merge: true });
      }
      batch.set(db.collection('projects').doc(project.name), {
        name:            project.name,
        channelId:       project.channelId,
        canvasId:        project.canvasId,
        lastSynced:      admin.firestore.FieldValue.serverTimestamp(),
        deadlineCount:   deadlines.length,
        canvasUpdatedAt: newTs,
      });
      await batch.commit();
      totalDeadlines += deadlines.length;
    } catch (err) {
      errors.push(`${project.name}: ${err.message}`);
    }
  }

  // Update meta/sync doc + write audit log entry
  const synced  = downloadResults.filter(r => r.status === 'fulfilled').length;
  const skipped = PROJECTS.length - toSync.length - errors.filter(e => metaResults.find(r => r.status === 'rejected')).length;
  const syncTs  = admin.firestore.FieldValue.serverTimestamp();

  await Promise.all([
    db.collection('meta').doc('sync').set({
      lastSynced:    syncTs,
      status:        errors.length ? 'partial' : 'success',
      deadlineCount: totalDeadlines,
      errors,
    }),
    db.collection('updateLog').add({
      type:             'sync',
      trigger:          triggerInfo.trigger,
      triggeredBy:      triggerInfo.triggeredBy,
      sortDate:         syncTs,
      deadlineCount:    totalDeadlines,
      projectsUpdated:  synced,
      projectsSkipped:  skipped,
      errors,
      changes:          allChanges,
    }),
  ]);

  return { count: totalDeadlines, projects: synced, skipped, errors };
}


// ── SLACK SLASH COMMAND HANDLER ───────────────────────────────────────────────

exports.syncDeadlines = onRequest({ timeoutSeconds: 540, memory: '512MiB', secrets: ['SLACK_BOT_TOKEN'] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // Basic Slack slash command verification
  const slackToken = req.body.token;
  const command    = req.body.command;

  if (command !== '/sync-deadlines') {
    return res.status(400).json({ text: 'Unknown command' });
  }

  // Acknowledge immediately (Slack requires < 3s)
  res.json({
    response_type: 'in_channel',
    text: '⏳ Syncing deadlines from Slack canvases…',
  });

  // Run sync after response is sent (Firebase keeps function alive)
  const responseUrl = req.body.response_url;
  const slackUser   = req.body.user_name || req.body.user_id || 'unknown';
  try {
    const result = await runSync({ trigger: 'manual', triggeredBy: slackUser });
    const msg = result.errors.length
      ? `⚠️ Synced ${result.count} deadlines from ${result.projects} projects (${result.skipped || 0} unchanged). Errors: ${result.errors.join(', ')}`
      : `✅ Synced ${result.count} deadlines — ${result.projects} updated, ${result.skipped || 0} unchanged.`;

    if (responseUrl) {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_type: 'in_channel', text: msg }),
      });
    }
  } catch (err) {
    if (responseUrl) {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_type: 'in_channel', text: `❌ Sync failed: ${err.message}` }),
      });
    }
  }
});

// ── ONE-TIME: RENAME PROJECT DOCS (delete after use) ─────────────────────────
exports.renameProject = onRequest({ secrets: ['SLACK_BOT_TOKEN'] }, async (req, res) => {
  const oldName = req.query.from;
  const newName = req.query.to;
  if (!oldName || !newName) return res.status(400).json({ error: 'Requires ?from=OldName&to=NewName' });
  const snap = await db.collection('deadlines').where('project', '==', oldName).get();
  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  batch.delete(db.collection('projects').doc(oldName));
  await batch.commit();
  res.json({ ok: true, deleted: snap.size, message: `Deleted ${snap.size} "${oldName}" docs — run /sync-deadlines to repopulate as "${newName}"` });
});

// ── ONE-TIME: FORCE FULL RESYNC (delete after use) ───────────────────────────
exports.clearMassInsight = onRequest({ secrets: ['SLACK_BOT_TOKEN'] }, async (req, res) => {
  const project = req.query.project || 'Mass Insight';
  await db.collection('projects').doc(project).update({
    canvasUpdatedAt: admin.firestore.FieldValue.delete(),
  });
  res.json({ ok: true, message: `${project} canvasUpdatedAt cleared — run /sync-deadlines now` });
});

// ── NIGHTLY SCHEDULED SYNC ────────────────────────────────────────────────────

exports.scheduledSync = onSchedule({ schedule: '0 2 * * *', timeZone: 'America/New_York', secrets: ['SLACK_BOT_TOKEN'] }, async () => {
  // Runs every day at 2am ET
  try {
    await runSync({ trigger: 'automatic', triggeredBy: 'Scheduled' });
  } catch (err) {
    console.error('Scheduled sync failed:', err);
  }
});
