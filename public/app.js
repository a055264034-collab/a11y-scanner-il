(function () {
  'use strict';

  const form = document.getElementById('scan-form');
  const btn = document.getElementById('scan-btn');
  const errorBox = document.getElementById('error-box');
  const progressCard = document.getElementById('progress-card');
  const progressFill = document.getElementById('progress-fill');
  const progressBar = document.getElementById('progressbar');
  const progressText = document.getElementById('progress-text');
  const report = document.getElementById('report');
  const summaryGrid = document.getElementById('summary-grid');
  const pagesList = document.getElementById('pages-list');
  const manualList = document.getElementById('manual-list');

  let pollTimer = null;

  // Exports are generated from the completed report already on screen. No new
  // server job, third-party service, external assets or persistent storage.
  let completedReport = null;
  let scanSource = '';
  const exportStyles = ":root {\n  --bg: #f4f6f9;\n  --card: #ffffff;\n  --ink: #16233a;\n  --muted: #5a6a85;\n  --accent: #0b5cab;\n  --accent-dark: #084a8a;\n  --ok: #1c7a3d;\n  --crit: #b3261e;\n  --serious: #c2410c;\n  --moderate: #a16207;\n  --minor: #475569;\n  --border: #dde4ee;\n  --radius: 12px;\n}\n\n* { box-sizing: border-box; }\n\nbody {\n  margin: 0;\n  font-family: \"Segoe UI\", \"Noto Sans Hebrew\", Arial, sans-serif;\n  background: var(--bg);\n  color: var(--ink);\n  line-height: 1.6;\n}\n\n.wrap { max-width: 960px; margin: 0 auto; padding: 0 16px; }\n\n.sr-only {\n  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;\n  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;\n}\n\n.skip-link {\n  position: absolute; top: -48px; right: 16px; z-index: 10;\n  background: var(--accent); color: #fff; padding: 8px 16px; border-radius: 8px;\n  transition: top .15s ease;\n}\n.skip-link:focus { top: 8px; color: #fff; }\n\n.site-header {\n  background: linear-gradient(135deg, #0b3d74, #0b5cab);\n  color: #fff; padding: 40px 0 32px;\n}\n.site-header h1 { margin: 0 0 8px; font-size: 1.9rem; }\n.subtitle { margin: 0; opacity: .92; max-width: 60ch; }\n\nmain.wrap { padding-top: 24px; padding-bottom: 48px; }\n\n.card {\n  background: var(--card);\n  border: 1px solid var(--border);\n  border-radius: var(--radius);\n  padding: 20px 24px;\n  margin-bottom: 20px;\n  box-shadow: 0 1px 3px rgba(22, 35, 58, .06);\n}\n\nlabel { font-weight: 600; display: block; margin-bottom: 8px; }\n\n.form-row { display: flex; gap: 10px; flex-wrap: wrap; }\n\ninput[type=\"url\"], select {\n  padding: 10px 14px;\n  border: 1.5px solid var(--border);\n  border-radius: 8px;\n  font-size: 1rem;\n  font-family: inherit;\n  background: #fff;\n  color: var(--ink);\n}\ninput[type=\"url\"] { flex: 1 1 320px; text-align: left; }\ninput:focus-visible, select:focus-visible, button:focus-visible, summary:focus-visible, a:focus-visible {\n  outline: 3px solid #f6b73c; outline-offset: 2px;\n}\n\nbutton {\n  background: var(--accent); color: #fff; border: 0;\n  padding: 10px 22px; font-size: 1rem; font-weight: 600; font-family: inherit;\n  border-radius: 8px; cursor: pointer;\n}\nbutton:hover { background: var(--accent-dark); }\nbutton:disabled { background: #8fa6c2; cursor: wait; }\n\n.hint { color: var(--muted); font-size: .92rem; margin: 10px 0 0; }\n\n.error-box {\n  background: #fdecea; border: 1px solid #f5b7b1; color: var(--crit);\n  border-radius: var(--radius); padding: 14px 18px; margin-bottom: 20px;\n}\n\n.progress-bar {\n  height: 14px; background: #e3e9f2; border-radius: 999px; overflow: hidden;\n}\n.progress-fill {\n  height: 100%; width: 0; background: var(--accent);\n  transition: width .4s ease;\n}\n\n.honesty-banner {\n  background: #fff8e6; border: 1px solid #f0d78c; border-right: 5px solid #e0a800;\n  border-radius: var(--radius); padding: 16px 20px; margin-bottom: 20px;\n}\n.honesty-banner h3 { margin: 0 0 6px; color: #7a5800; }\n.honesty-banner p { margin: 0; }\n\n.summary-grid {\n  display: grid; gap: 14px; margin-bottom: 20px;\n  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));\n}\n.summary-card {\n  background: var(--card); border: 1px solid var(--border);\n  border-radius: var(--radius); padding: 14px 16px; text-align: center;\n}\n.summary-card .num { font-size: 1.8rem; font-weight: 700; }\n.summary-card .lbl { color: var(--muted); font-size: .9rem; }\n.summary-card.crit .num { color: var(--crit); }\n.summary-card.serious .num { color: var(--serious); }\n.summary-card.moderate .num { color: var(--moderate); }\n.summary-card.ok .num { color: var(--ok); }\n\n.page-item { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 12px; overflow: hidden; }\n.page-item > summary {\n  cursor: pointer; padding: 12px 16px; display: flex; gap: 10px; align-items: center;\n  list-style: none; font-weight: 600;\n}\n.page-item > summary::-webkit-details-marker { display: none; }\n.page-item > summary::before { content: \"▸\"; transition: transform .15s; }\n.page-item[open] > summary::before { transform: rotate(90deg); }\n.page-url { direction: ltr; unicode-bidi: embed; word-break: break-all; font-weight: 400; color: var(--muted); font-size: .92rem; }\n.count-chip {\n  margin-inline-start: auto; background: #eef2f8; border-radius: 999px;\n  padding: 2px 12px; font-size: .85rem; white-space: nowrap;\n}\n.count-chip.bad { background: #fdecea; color: var(--crit); font-weight: 700; }\n.count-chip.good { background: #e6f4ea; color: var(--ok); font-weight: 700; }\n\n.page-body { padding: 0 16px 14px; }\n\n.rule {\n  border-top: 1px solid var(--border); padding: 12px 0;\n}\n.rule-head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }\n.rule-title { font-weight: 700; }\n.chip {\n  font-size: .78rem; border-radius: 999px; padding: 1px 10px; white-space: nowrap;\n}\n.chip.critical { background: #fdecea; color: var(--crit); }\n.chip.serious { background: #fdf0e5; color: var(--serious); }\n.chip.moderate { background: #fdf6e0; color: var(--moderate); }\n.chip.minor { background: #edf0f5; color: var(--minor); }\n.chip.tier { background: #e8f0fb; color: var(--accent-dark); }\n.chip.crit { background: #efe9f7; color: #5b3b8c; direction: ltr; }\n.rule p { margin: 6px 0; }\n.rule .fix { color: var(--ok); }\n.rule .fix::before { content: \"איך מתקנים: \"; font-weight: 700; color: var(--ink); }\n.node {\n  background: #f6f8fb; border-radius: 8px; padding: 8px 12px; margin-top: 6px;\n  font-size: .85rem;\n}\n.node code { direction: ltr; unicode-bidi: embed; word-break: break-all; font-size: .8rem; }\n.page-meta { color: var(--muted); font-size: .88rem; }\n.page-error { color: var(--crit); }\n\n.heur { border-top: 1px dashed var(--border); padding-top: 10px; margin-top: 10px; }\n.heur p { margin: 6px 0; }\n.heur-bad::before { content: \"⚠ \"; }\n.heur-ok::before { content: \"✓ \"; color: var(--ok); font-weight: 700; }\n.heur-bad { color: #7a5800; }\n.heur-list { margin: 4px 0; font-size: .85rem; }\n\n.manual-list li { margin-bottom: 10px; }\n.manual-list strong { display: block; }\n\n.site-footer {\n  border-top: 1px solid var(--border); padding: 20px 0;\n  color: var(--muted); font-size: .9rem;\n}\n\n@media (max-width: 560px) {\n  .site-header h1 { font-size: 1.5rem; }\n  .form-row > * { flex: 1 1 100%; }\n}\n\n/* Standalone report: wrap long URLs/selectors and show every page. */\n.sr-only {position:static;width:auto;height:auto;margin:0;overflow:visible;clip:auto;white-space:normal}\n.report-meta {overflow-wrap:anywhere}\n.page-item > summary {flex-wrap:wrap}\n.page-url {min-width:0;max-width:100%;overflow-wrap:anywhere}\n.node, .node code, .page-meta {overflow-wrap:anywhere;word-break:break-word}\n.chip {white-space:normal}\n@media(max-width:560px){.card{padding:16px}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.summary-card{min-width:0;padding:10px}.summary-card .num{font-size:1.35rem}.page-body{padding:0 12px 12px}.node{padding:8px}}\n@media print {@page{size:A4;margin:14mm}body{background:white;color:#111;font-size:10pt}.wrap{max-width:none;padding:0}main.wrap{padding:0}.card,.summary-card{box-shadow:none}.site-header{background:white;color:#111;padding:0 0 12px}.summary-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.summary-card .num{font-size:16pt}.rule,.node,.summary-card{break-inside:avoid}.page-item{overflow:visible}.page-item>summary::before{display:none}.card{padding:12px}.honesty-banner{padding:10px}h2,h3,.rule-head{break-after:avoid}}\n";
  const exportBar = document.createElement('div');
  exportBar.className = 'card export-bar';
  exportBar.setAttribute('aria-label', 'הורדת הדוח');
  exportBar.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    '<button type="button" id="download-report-html">הורדת דוח כקובץ HTML</button>' +
    '<button type="button" id="download-report-json">הורדת נתונים (JSON)</button></div>' +
    '<p class="hint">קובץ HTML נפתח בדפדפן גם ללא אינטרנט. לשמירה כ-PDF: פתחו את הקובץ ובחרו הדפסה ← שמירה כ-PDF. הקובץ כולל כתובות דפים וממצאים; שתפו אותו רק עם מי שצריך.</p>' +
    '<p id="export-status" role="status" aria-live="polite" class="hint"></p>';
  report.insertBefore(exportBar, report.firstChild);

  function downloadFile(contents, type, extension) {
    const stamp = completedReport.completedAt.slice(0, 10);
    let host = 'website';
    try { host = new URL(completedReport.sourceUrl).hostname.replace(/[^a-zA-Z0-9.-]/g, '_'); } catch (_) {}
    const blob = new Blob([contents], { type: type });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'a11y-report-' + host + '-' + stamp + '.' + extension;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Mobile browsers may not have consumed the Blob when click() returns.
    setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 60000);
    document.getElementById('export-status').textContent = 'הקובץ הוכן להורדה. אם נפתחה תצוגה מקדימה בטלפון, בחרו שיתוף או שמירה בקבצים.';
  }

  document.getElementById('download-report-html').addEventListener('click', function () {
    if (!completedReport) return;
    const copy = report.cloneNode(true);
    copy.querySelector('.export-bar').remove();
    copy.querySelectorAll('details').forEach(function (el) { el.open = true; });
    const date = new Date(completedReport.completedAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const html = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">' +
      '<title>דוח נגישות - ' + esc(completedReport.sourceUrl) + '</title><style>' + exportStyles + '</style></head><body>' +
      '<header class="site-header"><div class="wrap"><h1>דוח בדיקת נגישות</h1>' +
      '<p>ת״י 5568 חלק 1 (ספטמבר 2023) · בדיקה אוטומטית ראשונית</p>' +
      '<p class="report-meta">כתובת שנבדקה: <bdi dir="ltr">' + esc(completedReport.sourceUrl) + '</bdi></p>' +
      '<p>הסריקה הסתיימה: ' + esc(date) + ' (שעון ישראל)</p></div></header>' +
      '<main class="wrap">' + copy.innerHTML + '</main>' +
      '<footer class="site-footer"><div class="wrap">הופק באמצעות בודק הנגישות. ממצאים משקפים את רגע הסריקה בלבד. בדיקות ידניות לא בוצעו. אין בדוח אישור עמידה בחוק או ייעוץ משפטי.</div></footer>' +
      '</body></html>';
    downloadFile(html, 'text/html;charset=utf-8', 'html');
  });

  document.getElementById('download-report-json').addEventListener('click', function () {
    if (!completedReport) return;
    downloadFile(JSON.stringify(completedReport, null, 2), 'application/json;charset=utf-8', 'json');
  });


  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    errorBox.focus && errorBox.focus();
  }
  function clearError() { errorBox.hidden = true; errorBox.textContent = ''; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function setProgress(done, total, current) {
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    progressFill.style.width = pct + '%';
    progressBar.setAttribute('aria-valuenow', String(pct));
    progressText.textContent = 'נסרקו ' + done + ' מתוך כ-' + total + ' דפים' + (current ? ' — כעת: ' + current : '');
  }

  function tierChip(tier) {
    const map = {
      required: 'נדרש לפי החוק',
      recommended: 'מעבר לדרישה',
      practice: 'פרקטיקה מומלצת',
    };
    return '<span class="chip tier">' + esc(map[tier] || tier) + '</span>';
  }

  function impactChip(v) {
    return '<span class="chip ' + esc(v.impact) + '">' + esc(v.impactHe) + '</span>';
  }

  function criteriaChips(v) {
    return v.criteriaHe.map(function (c) {
      return '<span class="chip crit">' + esc(c.id) + (c.name ? ' · ' + esc(c.name) : '') + '</span>';
    }).join(' ');
  }

  function renderRule(v) {
    let nodes = '';
    if (v.nodes && v.nodes.length) {
      nodes = v.nodes.map(function (n) {
        return '<div class="node"><code>' + esc(n.target) + '</code>' +
          (n.summary ? '<div>' + esc(n.summary) + '</div>' : '') + '</div>';
      }).join('');
      if (v.nodeCount > v.nodes.length) {
        nodes += '<div class="node">ועוד ' + (v.nodeCount - v.nodes.length) + ' מופעים נוספים</div>';
      }
    }
    return '<div class="rule">' +
      '<div class="rule-head"><span class="rule-title">' + esc(v.titleHe) + '</span>' +
      impactChip(v) + tierChip(v.tier) + criteriaChips(v) + '</div>' +
      '<p>' + esc(v.whyHe) + '</p>' +
      '<p class="fix">' + esc(v.fixHe) + '</p>' +
      nodes +
      '</div>';
  }

  function renderHeuristics(p) {
    const parts = [];
    const kb = p.keyboard;
    if (kb) {
      if (kb.possibleTrap) {
        parts.push('<p class="heur-bad">מקלדת: זוהתה מלכודת מוקד אפשרית אחרי ' + kb.tabsSent + ' לחיצות Tab (' + esc(kb.trapSelector || '') + '). דורש בדיקה ידנית.</p>');
      }
      if (kb.noIndicatorCount > 0) {
        parts.push('<p class="heur-bad">מקלדת: ' + kb.noIndicatorCount + ' מתוך ' + kb.uniqueFocusable + ' רכיבים ממוקדים ללא אינדיקטור פוקוס גלוי (היוריסטי — יכול להיות סגנון מותאם שלא זוהה):</p><ul class="heur-list">' +
          kb.noIndicatorSamples.map(function (s) { return '<li><code>' + esc(s) + '</code></li>'; }).join('') + '</ul>');
      }
      if (!kb.possibleTrap && kb.noIndicatorCount === 0) {
        parts.push('<p class="heur-ok">מקלדת: נסרקו ' + kb.uniqueFocusable + ' רכיבים ממוקדים ראשונים, כולם עם אינדיקטור פוקוס גלוי.</p>');
      }
    }
    if (p.reflow) {
      parts.push(p.reflow.horizontalScroll
        ? '<p class="heur-bad">Reflow (קריטריון 1.4.10): ברוחב 320px (שקול לזום 400%) נדרשת גלילה אופקית — רוחב תוכן ' + p.reflow.scrollWidth + 'px.</p>'
        : '<p class="heur-ok">Reflow: ברוחב 320px אין גלילה אופקית.</p>');
    }
    return parts.length ? '<div class="heur">' + parts.join('') + '</div>' : '';
  }

  function renderPage(p) {
    const n = p.violations ? p.violations.length : 0;
    let body = '';
    if (!p.ok) {
      body = '<p class="page-error">הדף לא נסרק: ' + esc(p.error || 'שגיאה') + '</p>';
    } else {
      const meta = p.meta || {};
      body += '<p class="page-meta">כותרת: ' + esc(meta.title || '—') +
        ' · lang: ' + esc(meta.lang || 'חסר') +
        ' · קישור להצהרת נגישות: ' + (meta.hasA11yStatementLink ? 'נמצא' : 'לא נמצא (היוריסטי)') +
        (p.incompleteCount ? ' · ' + p.incompleteCount + ' בדיקות דורשות סקירה ידנית' : '') + '</p>';
      body += renderHeuristics(p);
      if (!n) {
        body += '<p>לא נמצאו הפרות בבדיקה האוטומטית. שים לב: זה אינו מבטיח עמידה מלאה — ראה בדיקות ידניות למטה.</p>';
      } else {
        body += p.violations.map(renderRule).join('');
      }
    }
    const chip = !p.ok ? '<span class="count-chip bad">שגיאה</span>'
      : n ? '<span class="count-chip bad">' + n + ' ממצאים</span>'
      : '<span class="count-chip good">תקין (אוטומטית)</span>';
    return '<details class="page-item"><summary><span class="page-url">' + esc(p.url) + '</span>' + chip + '</summary>' +
      '<div class="page-body">' + body + '</div></details>';
  }

  function summaryCard(num, lbl, cls) {
    return '<div class="summary-card ' + (cls || '') + '"><div class="num">' + esc(num) + '</div><div class="lbl">' + esc(lbl) + '</div></div>';
  }

  function renderReport(data) {
    progressCard.hidden = true;
    completedReport = Object.assign({}, data, {
      sourceUrl: scanSource,
      completedAt: new Date().toISOString(),
      scope: 'בדיקה אוטומטית ראשונית בלבד; אין אישור עמידה בחוק או ייעוץ משפטי',
    });
    document.getElementById('export-status').textContent = '';
    const s = data.summary;
    const byImpact = s.violations.byImpact || {};
    const kb = s.keyboard || { pagesWithTrap: 0, pagesMissingFocusIndicator: 0 };
    let stmtLbl = 'לא נמצא';
    if (s.a11yStatementLinkFound && s.statement && s.statement.reachable) {
      const bits = [];
      bits.push(s.statement.mentionsCoordinator ? 'רכז ✓' : 'רכז?');
      bits.push(s.statement.hasContact ? 'פרטי קשר ✓' : 'פרטי קשר?');
      bits.push(s.statement.mentionsUpdate ? 'עדכון ✓' : 'עדכון?');
      stmtLbl = bits.join(' · ');
    } else if (s.a11yStatementLinkFound) {
      stmtLbl = 'קישור נמצא (לא נבדק)';
    }
    let cards =
      summaryCard(s.pagesScanned, 'דפים נסרקו') +
      summaryCard(s.violations.required, 'הפרות של דרישות החוק', s.violations.required ? 'crit' : 'ok') +
      summaryCard((byImpact.critical || 0), 'קריטיות', 'crit') +
      summaryCard((byImpact.serious || 0), 'חמורות', 'serious') +
      summaryCard((byImpact.moderate || 0) + (byImpact.minor || 0), 'בינוניות וקלות', 'moderate') +
      summaryCard(s.violations.recommended + s.violations.practice, 'המלצות מעבר לחוק') +
      summaryCard(kb.pagesWithTrap + kb.pagesMissingFocusIndicator, 'דפים עם ממצאי מקלדת', (kb.pagesWithTrap + kb.pagesMissingFocusIndicator) ? 'serious' : 'ok') +
      summaryCard(s.pagesHorizontalScroll || 0, 'דפים עם גלילה אופקית בזום', (s.pagesHorizontalScroll || 0) ? 'serious' : 'ok') +
      summaryCard(stmtLbl, 'הצהרת נגישות (היוריסטי)', s.a11yStatementLinkFound ? 'ok' : 'moderate');
    summaryGrid.innerHTML = cards;

    pagesList.innerHTML = data.pages.map(renderPage).join('');
    manualList.innerHTML = (data.manualChecks || []).map(function (m) {
      return '<li><strong>' + esc(m.area) + '</strong>' + esc(m.detail) + '</li>';
    }).join('');

    report.hidden = false;
    report.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('report-h').setAttribute('tabindex', '-1');
    document.getElementById('report-h').focus({ preventScroll: true });
  }

  async function poll(jobId) {
    try {
      const res = await fetch('/api/jobs/' + jobId);
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'שגיאה בקריאת הסריקה'); stopAll(); return; }
      if (data.status === 'queued') {
        progressText.textContent = 'הסריקה נכנסה לתור — סריקה אחרת רצה כעת, שלך תתחיל מיד כשתתפנה';
      } else {
        setProgress(data.done, data.total, data.current);
      }
      if (data.status === 'done') {
        const full = await (await fetch('/api/jobs/' + jobId + '?full=1')).json();
        stopAll();
        renderReport(full);
      } else if (data.status === 'failed') {
        stopAll();
        showError('הסריקה נכשלה: ' + (data.error || 'שגיאה לא ידועה'));
      }
    } catch (e) {
      stopAll();
      showError('אין תקשורת עם השרת — נסה שוב');
    }
  }

  function stopAll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    btn.disabled = false;
    btn.textContent = 'התחל סריקה';
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    clearError();
    report.hidden = true;
    completedReport = null;
    progressCard.hidden = false;
    setProgress(0, 1, null);
    btn.disabled = true;
    btn.textContent = 'סורק…';
    const url = document.getElementById('url-input').value.trim();
    scanSource = url;
    const maxPages = parseInt(document.getElementById('max-pages').value, 10);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, maxPages: maxPages }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'שגיאה'); stopAll(); progressCard.hidden = true; return; }
      pollTimer = setInterval(function () { poll(data.jobId); }, 1500);
      poll(data.jobId);
    } catch (e) {
      showError('אין תקשורת עם השרת — נסה שוב');
      stopAll();
      progressCard.hidden = true;
    }
  });
})();
