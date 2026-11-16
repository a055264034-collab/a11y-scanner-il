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
      setProgress(data.done, data.total, data.current);
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
    progressCard.hidden = false;
    setProgress(0, 1, null);
    btn.disabled = true;
    btn.textContent = 'סורק…';
    const url = document.getElementById('url-input').value.trim();
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
