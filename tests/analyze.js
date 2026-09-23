const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.resolve(__dirname, '..', 'site.html');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));

  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: AXE });

  const slugs = await page.$$eval('.rail .nav a', as => as.map(a => a.getAttribute('data-go')));
  const rows = [];
  const a11yFindings = {};

  for (const slug of slugs) {
    await page.evaluate(s => { location.hash = '#' + s; }, slug);
    await page.waitForTimeout(40);

    const m = await page.evaluate(() => {
      const el = document.querySelector('.page:not([hidden])');
      const txt = (el.innerText || '').trim();
      const words = txt.split(/\s+/).filter(Boolean).length;
      const headings = [...el.querySelectorAll('h1,h2,h3,h4')].map(h => +h.tagName[1]);
      let skips = 0;
      for (let i = 1; i < headings.length; i++) if (headings[i] - headings[i - 1] > 1) skips++;
      const links = [...el.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
      const svgs = [...el.querySelectorAll('svg')];
      return {
        id: el.id.replace('page-', ''),
        label: el.dataset.label || '',
        group: el.dataset.group || '',
        num: el.dataset.num || '',
        words,
        h1: el.querySelectorAll('h1').length,
        skips,
        exercises: el.querySelectorAll('.bench').length,
        failures: el.querySelectorAll('.breaks').length,
        glossaries: el.querySelectorAll('.words').length,
        analogies: el.querySelectorAll('.analogy').length,
        tables: el.querySelectorAll('table').length,
        code: el.querySelectorAll('.term').length,
        figures: el.querySelectorAll('figure').length,
        checks: el.querySelectorAll('input.track').length,
        internal: links.filter(h => h.startsWith('#')).length,
        external: links.filter(h => h.startsWith('http')).length,
        svgNoLabel: svgs.filter(s => !s.getAttribute('aria-label')).length,
        emptyLinks: [...el.querySelectorAll('a[href]')].filter(a => !a.textContent.trim()).length
      };
    });

    const axe = await page.evaluate(async () => {
      const el = document.querySelector('.page:not([hidden])');
      const r = await window.axe.run(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        resultTypes: ['violations']
      });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length,
        sample: (v.nodes[0] && v.nodes[0].html || '').slice(0, 90) }));
    });
    if (axe.length) a11yFindings[slug] = axe;
    rows.push(m);
  }

  // whole-document axe pass (chrome, sidebar, landmarks) on the home view
  await page.evaluate(() => { location.hash = '#home'; });
  await page.waitForTimeout(150);
  const globalAxe = await page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations']
    });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length,
      sample: (v.nodes[0] && v.nodes[0].html || '').slice(0, 110) }));
  });

  // overflow sweep at phone width across every page
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(FILE, { waitUntil: 'load' });
  await mob.waitForTimeout(300);
  const overflows = [];
  for (const slug of slugs) {
    await mob.evaluate(s => { location.hash = '#' + s; }, slug);
    await mob.waitForTimeout(30);
    const bad = await mob.evaluate(() => {
      const out = [];
      document.querySelectorAll('.page:not([hidden]) *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > window.innerWidth + 1 && !el.closest('.tbl-wrap,.term,pre,table')) {
          out.push(el.tagName + '.' + String(el.className).slice(0, 24) + '=' + Math.round(r.width));
        }
      });
      const doc = document.documentElement.scrollWidth - window.innerWidth;
      return { out: out.slice(0, 3), doc };
    });
    if (bad.out.length || bad.doc > 1) overflows.push({ slug, ...bad });
  }

  // keyboard focus visibility
  await page.evaluate(() => { location.hash = '#home'; });
  await page.waitForTimeout(150);
  await page.keyboard.press('Tab');
  const focusRing = await page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { tag: el.tagName, outline: s.outlineStyle + ' ' + s.outlineWidth };
  });

  await browser.close();

  const total = rows.reduce((a, r) => a + r.words, 0);
  const byGroup = {};
  rows.forEach(r => {
    byGroup[r.group] = byGroup[r.group] || { pages: 0, words: 0, ex: 0, fail: 0 };
    byGroup[r.group].pages++; byGroup[r.group].words += r.words;
    byGroup[r.group].ex += r.exercises; byGroup[r.group].fail += r.failures;
  });

  console.log('\n===== SIZE =====');
  console.log('pages:', rows.length, '| words:', total.toLocaleString(),
              '| reading time at 220 wpm:', Math.round(total / 220), 'min');
  console.log('exercises:', rows.reduce((a, r) => a + r.exercises, 0),
              '| failure stories:', rows.reduce((a, r) => a + r.failures, 0),
              '| code blocks:', rows.reduce((a, r) => a + r.code, 0),
              '| tables:', rows.reduce((a, r) => a + r.tables, 0),
              '| diagrams:', rows.reduce((a, r) => a + r.figures, 0));

  console.log('\n===== BALANCE BY PART =====');
  Object.entries(byGroup).forEach(([g, v]) =>
    console.log(String(g).padEnd(32), String(v.pages).padStart(3), 'pages',
      String(v.words).padStart(6), 'words', String(v.ex).padStart(3), 'exercises',
      String(v.fail).padStart(3), 'failure stories'));

  console.log('\n===== OUTLIERS =====');
  const sorted = [...rows].sort((a, b) => a.words - b.words);
  console.log('shortest:', sorted.slice(0, 4).map(r => `${r.id}(${r.words})`).join(' '));
  console.log('longest :', sorted.slice(-4).map(r => `${r.id}(${r.words})`).join(' '));
  const structural = rows.filter(r => r.h1 !== 1 || r.skips > 0 || r.emptyLinks > 0 || r.svgNoLabel > 0);
  console.log('structural problems:', structural.length
    ? structural.map(r => `${r.id}: h1=${r.h1} skips=${r.skips} emptyLinks=${r.emptyLinks} svgNoLabel=${r.svgNoLabel}`).join(' | ')
    : 'none');

  console.log('\n===== ACCESSIBILITY (axe, WCAG 2.1 A/AA) =====');
  console.log('pages with violations:', Object.keys(a11yFindings).length, 'of', rows.length);
  Object.entries(a11yFindings).slice(0, 8).forEach(([slug, v]) =>
    console.log(' ', slug, v.map(x => `${x.id}(${x.impact}, ${x.n})`).join(', '), '\n     e.g.', v[0].sample));
  console.log('whole-document violations:', globalAxe.length
    ? globalAxe.map(v => `${v.id}(${v.impact}, ${v.n}) e.g. ${v.sample}`).join('\n  ') : 'none');
  console.log('focus ring on first tab stop:', focusRing.tag, focusRing.outline);

  console.log('\n===== PHONE OVERFLOW =====');
  console.log(overflows.length ? overflows.slice(0, 6).map(o => `${o.slug}: doc+${o.doc} ${o.out.join(',')}`).join('\n') : 'none');
  console.log('\nJS errors:', jsErrors.length ? jsErrors.join(' | ') : 'none');

  fs.writeFileSync(__dirname + '/analysis.json', JSON.stringify({ rows, a11yFindings, globalAxe, overflows }, null, 2));
})();
