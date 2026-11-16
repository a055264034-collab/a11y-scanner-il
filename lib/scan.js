const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const puppeteer = require('puppeteer-core');
const { CRITERIA_HE, RULES_HE, IMPACT_HE } = require('./hebrew');

const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const CHROME_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  '/usr/bin/chromium';

const PAGE_TIMEOUT_MS = 30000;
const MAX_PAGES_HARD = 50;
const MAX_NODES_PER_RULE = 10;

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const n = ip.toLowerCase();
    return (
      n === '::1' || n.startsWith('fe80') || n.startsWith('fc') ||
      n.startsWith('fd') || n === '::' || n.startsWith('::ffff:127.') ||
      n.startsWith('::ffff:10.') || n.startsWith('::ffff:192.168.') ||
      n.startsWith('::ffff:169.254')
    );
  }
  const p = ip.split('.').map(Number);
  return (
    p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254)
  );
}

async function assertPublicUrl(urlStr) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    throw Object.assign(new Error('כתובת לא תקינה'), { code: 'BAD_URL' });
  }
  if (!/^https?:$/.test(u.protocol)) {
    throw Object.assign(new Error('נתמכות רק כתובות http/https'), { code: 'BAD_URL' });
  }
  const host = u.hostname;
  if (process.env.ALLOW_PRIVATE === '1') return u; // local dev only
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw Object.assign(new Error('כתובות פנימיות אינן נתמכות'), { code: 'BAD_URL' });
  } else {
    try {
      const { address } = await dns.lookup(host);
      if (isPrivateIp(address)) {
        throw Object.assign(new Error('כתובות פנימיות אינן נתמכות'), { code: 'BAD_URL' });
      }
    } catch (e) {
      if (e.code === 'BAD_URL') throw e;
      throw Object.assign(new Error('לא ניתן לפענח את שם הדומיין'), { code: 'DNS_FAIL' });
    }
  }
  return u;
}

// Bounded keyboard Tab-walk: checks focus visibility and looks for stuck focus.
// Heuristic — reports "review" signals, not hard violations (WCAG 2.1.1/2.1.2/2.4.7).
async function tabWalk(page, maxTabs = 60) {
  const res = {
    tabsSent: 0, uniqueFocusable: 0, noIndicatorCount: 0,
    noIndicatorSamples: [], possibleTrap: false, trapSelector: null,
  };
  const seen = new Set();
  let stuck = 0;
  let lastKey = null;
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return { body: true };
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      const outlineVisible = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth || '0') > 0;
      const shadow = Boolean(cs.boxShadow && cs.boxShadow !== 'none');
      let sel = el.tagName.toLowerCase();
      if (el.id) sel += '#' + el.id;
      else if (typeof el.className === 'string' && el.className.trim()) sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
      const label = (el.getAttribute('aria-label') || el.getAttribute('title') || (el.innerText || '') || el.value || '').trim().slice(0, 60);
      return { body: false, sel, label, visible, indicator: outlineVisible || shadow };
    });
    if (info.body) { stuck = 0; lastKey = null; continue; }
    res.tabsSent++;
    const key = info.sel + '|' + info.label;
    if (!seen.has(key)) {
      seen.add(key);
      if (!info.indicator) {
        res.noIndicatorCount++;
        if (res.noIndicatorSamples.length < 5) {
          res.noIndicatorSamples.push(info.sel + (info.label ? ' — "' + info.label + '"' : ''));
        }
      }
    }
    if (key === lastKey) {
      stuck++;
      if (stuck >= 8) { res.possibleTrap = true; res.trapSelector = info.sel; break; }
    } else {
      stuck = 0;
      lastKey = key;
    }
  }
  res.uniqueFocusable = seen.size;
  return res;
}

// WCAG 1.4.10 (2.1 AA): no two-dimensional scroll at 320 CSS px width.
async function reflowCheck(page) {
  await page.setViewport({ width: 320, height: 844 });
  await new Promise((r) => setTimeout(r, 350));
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  await page.setViewport({ width: 1366, height: 900 });
  await new Promise((r) => setTimeout(r, 150));
  return { horizontalScroll: m.scrollWidth > m.innerWidth + 8, scrollWidth: m.scrollWidth };
}

// Israeli regs: the accessibility statement must exist and be up to date.
// We follow the detected statement link once per job and probe its content.
async function checkStatement(browser, href) {
  const out = { url: href, reachable: false, mentionsCoordinator: false, hasContact: false, mentionsUpdate: false };
  let page;
  try {
    page = await browser.newPage();
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const text = await page.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 10000));
    out.reachable = true;
    out.mentionsCoordinator = /רכז|רכזת/.test(text);
    out.hasContact = /05\d[\d\-\s]{7,10}|[\w.+-]+@[\w-]+\.[\w.]+/.test(text);
    out.mentionsUpdate = /עודכן|עדכון\s*:?\s|תאריך/.test(text);
  } catch { /* unreachable */ } finally {
    if (page) await page.close().catch(() => {});
  }
  return out;
}

function normalizeUrl(href, base) {
  try {
    const u = new URL(href, base);
    u.hash = '';
    // strip trailing slash for dedupe (keep root as-is)
    let s = u.toString();
    if (u.pathname === '/' ) return u.origin + '/';
    return s.replace(/\/$/, '');
  } catch {
    return null;
  }
}

const SKIP_EXT = /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|json|xml|txt|pdf|zip|rar|7z|gz|mp[34]|webm|mov|avi|woff2?|ttf|otf|eot|wasm|csv|docx?|xlsx?|pptx?)($|\?)/i;

function wcagCriteria(tags) {
  const out = [];
  for (const t of tags || []) {
    const m = /^wcag(\d)(\d)(\d+)$/.exec(t);
    if (m) out.push(`${m[1]}.${m[2]}.${m[3]}`);
  }
  return [...new Set(out)];
}

function classifyTier(tags) {
  const t = tags || [];
  if (t.includes('wcag2a') || t.includes('wcag2aa')) return 'required';
  if (t.some((x) => /^wcag2[12]/.test(x))) return 'recommended';
  return 'practice';
}

function mapViolation(v) {
  const he = RULES_HE[v.id] || {};
  const criteria = wcagCriteria(v.tags);
  return {
    id: v.id,
    impact: v.impact || 'moderate',
    impactHe: IMPACT_HE[v.impact] || 'בינוני',
    tier: classifyTier(v.tags),
    criteria,
    criteriaHe: criteria.map((c) => ({ id: c, name: CRITERIA_HE[c] || '' })),
    titleHe: he.title || v.help,
    whyHe: he.why || v.description,
    fixHe: he.fix || v.helpUrl,
    nodes: (v.nodes || []).slice(0, MAX_NODES_PER_RULE).map((n) => ({
      target: (n.target || []).join(' '),
      html: (n.html || '').slice(0, 300),
      summary: (n.failureSummary || '').slice(0, 300),
    })),
    nodeCount: (v.nodes || []).length,
  };
}

async function runJob(job, startUrl, opts) {
  const maxPages = Math.min(Math.max(1, opts.maxPages || 20), MAX_PAGES_HARD);
  const origin = startUrl.origin;
  const visited = new Set();
  const queue = [normalizeUrl(startUrl.toString(), startUrl.toString())];
  job.total = 1;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--force-device-scale-factor=1',
      ],
    });

    while (queue.length && visited.size < maxPages) {
      if (job.cancelled) break;
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);
      job.status = 'running';
      job.current = url;

      const pageResult = { url, ok: false, violations: [], incompleteCount: 0, passesCount: 0, meta: {}, error: null };
      let page;
      try {
        page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 900 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8' });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT_MS });

        // per-page meta signals
        pageResult.meta = await page.evaluate(() => {
          const lang = document.documentElement.getAttribute('lang');
          const dir = document.documentElement.getAttribute('dir');
          const a11yLink = Array.from(document.querySelectorAll('a'))
            .find((a) => /נגישות|accessibility/i.test((a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '') + ' ' + (a.href || '')));
          return {
            title: document.title || '',
            lang: lang || null,
            dir: dir || null,
            hasA11yStatementLink: Boolean(a11yLink),
            a11yStatementHref: a11yLink ? a11yLink.href : null,
          };
        });

        // axe
        await page.evaluate(AXE_SOURCE);
        const results = await page.evaluate(async () => {
          return await axe.run(document, {
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
            },
            resultTypes: ['violations', 'incomplete', 'passes'],
          });
        });

        // keyboard + reflow heuristics (from the user's proposed architecture, free-tier version)
        try {
          pageResult.keyboard = await tabWalk(page);
        } catch { pageResult.keyboard = null; }
        try {
          pageResult.reflow = await reflowCheck(page);
        } catch { pageResult.reflow = null; }

        pageResult.ok = true;
        pageResult.violations = results.violations.map(mapViolation);
        pageResult.incompleteCount = results.incomplete.length;
        pageResult.passesCount = results.passes.length;

        // discover links
        if (visited.size < maxPages) {
          const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')).filter(Boolean));
          for (const h of hrefs) {
            const n = normalizeUrl(h, url);
            if (!n) continue;
            try {
              const u = new URL(n);
              if (u.origin !== origin) continue;
              if (SKIP_EXT.test(u.pathname)) continue;
              if (!visited.has(n) && !queue.includes(n)) queue.push(n);
            } catch { /* ignore */ }
          }
        }
      } catch (e) {
        pageResult.error = e && e.message ? String(e.message).slice(0, 300) : 'שגיאה לא ידועה';
      } finally {
        if (page) await page.close().catch(() => {});
      }

      job.pages.push(pageResult);
      job.done = job.pages.length;
      job.total = Math.max(job.total, visited.size + queue.length);
    }
  } catch (e) {
    job.status = 'failed';
    job.error = e && e.message ? String(e.message).slice(0, 400) : 'שגיאת סריקה';
    return;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // accessibility statement probe (once per job, first detected link)
  const stmtHref = (job.pages.find((p) => p.meta && p.meta.a11yStatementHref) || {}).meta;
  let statement = null;
  if (stmtHref && stmtHref.a11yStatementHref) {
    let browser2;
    try {
      browser2 = await puppeteer.launch({
        executablePath: CHROME_PATH, headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      statement = await checkStatement(browser2, stmtHref.a11yStatementHref);
    } catch { statement = { url: stmtHref.a11yStatementHref, reachable: false }; } finally {
      if (browser2) await browser2.close().catch(() => {});
    }
  }

  // aggregate
  const agg = { required: 0, recommended: 0, practice: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 } };
  let pagesWithViolations = 0;
  let anyStatement = false;
  let pagesWithTrap = 0;
  let pagesMissingFocusIndicator = 0;
  let pagesHorizontalScroll = 0;
  for (const p of job.pages) {
    if (p.meta && p.meta.hasA11yStatementLink) anyStatement = true;
    if (p.violations.length) pagesWithViolations++;
    if (p.keyboard && p.keyboard.possibleTrap) pagesWithTrap++;
    if (p.keyboard && p.keyboard.noIndicatorCount > 0) pagesMissingFocusIndicator++;
    if (p.reflow && p.reflow.horizontalScroll) pagesHorizontalScroll++;
    for (const v of p.violations) {
      agg[v.tier]++;
      agg.byImpact[v.impact] = (agg.byImpact[v.impact] || 0) + 1;
    }
  }
  job.summary = {
    startUrl: startUrl.toString(),
    pagesScanned: job.pages.filter((p) => p.ok).length,
    pagesFailed: job.pages.filter((p) => !p.ok).length,
    pagesWithViolations,
    violations: agg,
    a11yStatementLinkFound: anyStatement,
    statement,
    keyboard: { pagesWithTrap, pagesMissingFocusIndicator },
    pagesHorizontalScroll,
    finishedAt: new Date().toISOString(),
  };
  job.status = 'done';
  job.current = null;
}

module.exports = { assertPublicUrl, runJob, MAX_PAGES_HARD };
