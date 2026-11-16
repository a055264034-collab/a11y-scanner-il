const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { assertPublicUrl, runJob, MAX_PAGES_HARD } = require('./lib/scan');
const { MANUAL_CHECKS_HE, TIER, IMPACT_HE } = require('./lib/hebrew');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const jobs = new Map();
let activeJobs = 0;
// One Chromium job at a time: concurrent heavy scans exhaust the free tier's RAM
// and the whole service gets killed (502 for everyone).
const MAX_CONCURRENT = Math.max(1, Number(process.env.MAX_CONCURRENT || 1));

// cleanup finished jobs after 30 min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, j] of jobs) {
    if (j.finished && j.finished < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000).unref();

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/api/meta', (_req, res) => {
  res.json({
    standard: 'ת״י 5568 חלק 1 (מהדורת ספטמבר 2023) — מאמץ WCAG 2.0 רמה AA עם תוספות לאומיות',
    maxPages: MAX_PAGES_HARD,
    tiers: TIER,
    impacts: IMPACT_HE,
    manualChecks: MANUAL_CHECKS_HE,
  });
});

app.post('/api/scan', async (req, res) => {
  const { url, maxPages } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'חסרה כתובת אתר' });
  }
  let startUrl;
  try {
    startUrl = await assertPublicUrl(url.trim());
  } catch (e) {
    return res.status(400).json({ error: e.message || 'כתובת לא תקינה' });
  }
  if (activeJobs >= MAX_CONCURRENT) {
    return res.status(429).json({ error: 'המערכת עמוסה כרגע — נסה שוב בעוד דקה' });
  }
  const id = crypto.randomUUID();
  const job = {
    id,
    status: 'queued',
    created: Date.now(),
    finished: null,
    done: 0,
    total: 1,
    current: null,
    pages: [],
    summary: null,
    error: null,
  };
  jobs.set(id, job);
  activeJobs++;
  runJob(job, startUrl, { maxPages })
    .catch((e) => {
      job.status = 'failed';
      job.error = String((e && e.message) || e).slice(0, 400);
    })
    .finally(() => {
      job.finished = Date.now();
      activeJobs--;
    });
  res.json({ jobId: id });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'הסריקה לא נמצאה (ייתכן שפג תוקפה)' });
  const includePages = req.query.full === '1';
  res.json({
    id: job.id,
    status: job.status,
    done: job.done,
    total: job.total,
    current: job.current,
    error: job.error,
    summary: job.summary,
    manualChecks: MANUAL_CHECKS_HE,
    pages: includePages
      ? job.pages
      : job.pages.map((p) => ({ url: p.url, ok: p.ok, error: p.error, violationCount: p.violations.length })),
  });
});

// intentionally inaccessible demo page so users can see a report with findings
app.get('/demo/inaccessible', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"></head>
<body>
<img src="https://via.placeholder.com/150">
<h3>כותרת מדולגת</h3>
<a href="/demo/inaccessible"><img src="https://via.placeholder.com/20"></a>
<button></button>
<input type="text">
<p style="color:#ccc;background:#fff">טקסט עם ניגודיות נמוכה</p>
<marquee>טקסט נע</marquee>
<iframe src="about:blank"></iframe>
<footer><a href="/demo/statement">הצהרת נגישות</a></footer>
</body>
</html>`);
});

app.get('/demo/statement', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><title>הצהרת נגישות — דמו</title></head>
<body>
<h1>הצהרת נגישות</h1>
<p>הצהרה זו עודכנה לאחרונה בתאריך 1 בינואר 2026.</p>
<p>רכז נגישות: ישראל ישראלי, טלפון 03-1234567, דוא״ל access@example.co.il</p>
</body>
</html>`);
});

app.use((_req, res) => res.status(404).json({ error: 'לא נמצא' }));

app.listen(PORT, () => {
  console.log(`a11y-scanner listening on :${PORT}`);
});
