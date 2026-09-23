const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '..', 'site.html');
const results = [];
const errors = [];

function check(name, pass, detail) {
  results.push({ name, pass, detail: detail || '' });
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // --- 1. first paint: only home visible ---
  const visible = await page.$$eval('.page:not([hidden])', els => els.map(e => e.id));
  check('Only the home page is visible at load', visible.length === 1 && visible[0] === 'page-home', visible.join(','));

  const homeText = await page.textContent('#page-home h1');
  const docTitle = await page.title();
  check('Home shows a headline and the site name in the tab',
        (homeText || '').length > 10 && /Agentic Engineering School/.test(docTitle), homeText + ' | ' + docTitle);
  const curric = await page.$$eval('#page-home .cpart a', as => as.length);
  check('Home lists the full curriculum', curric >= 55, curric + ' lesson links');
  const homeDead = await page.$$eval('#page-home a[data-go]', as => as.map(a => a.getAttribute('data-go')));
  const pageIds = await page.$$eval('.page', ps => ps.map(p => p.id.replace('page-','')));
  check('Every home link points at a real page',
        homeDead.every(d => pageIds.includes(d)), homeDead.filter(d => !pageIds.includes(d)).join(','));

  // --- 2. sidebar built from pages ---
  const navLinks = await page.$$eval('.rail .nav a', as => as.length);
  const navGroups = await page.$$eval('.rail .nav .grp', gs => gs.map(g => g.textContent));
  const pageCount = await page.$$eval('.page', ps => ps.length);
  check('Sidebar has one link per page', navLinks === pageCount, navLinks + ' links / ' + pageCount + ' pages');
  check('Sidebar groups are unique and in order', new Set(navGroups).size === navGroups.length, navGroups.join(' | '));

  // --- 3. every nav link opens exactly one matching page ---
  const slugs = await page.$$eval('.rail .nav a', as => as.map(a => a.getAttribute('data-go')));
  let navFailures = [];
  for (const slug of slugs) {
    await page.click(`.rail .nav a[data-go="${slug}"]`);
    await page.waitForTimeout(25);
    const shown = await page.$$eval('.page:not([hidden])', els => els.map(e => e.id));
    const hash = await page.evaluate(() => location.hash);
    const current = await page.$$eval('.rail .nav a[aria-current="page"]', as => as.map(a => a.getAttribute('data-go')));
    if (shown.length !== 1 || shown[0] !== 'page-' + slug) navFailures.push(slug + ' showed ' + shown.join(','));
    else if (hash !== '#' + slug) navFailures.push(slug + ' hash=' + hash);
    else if (current.length !== 1 || current[0] !== slug) navFailures.push(slug + ' aria-current=' + current.join(','));
  }
  check('All ' + slugs.length + ' nav links open the right page', navFailures.length === 0, navFailures.slice(0, 5).join(' ; '));

  // --- 4. every page has a heading and real content ---
  const thin = await page.$$eval('.page', els => els.map(e => ({
    id: e.id,
    h1: !!e.querySelector('h1'),
    words: (e.textContent || '').trim().split(/\s+/).length
  })).filter(p => !p.h1 || p.words < 120));
  check('Every page has an h1 and real content', thin.length === 0, JSON.stringify(thin));

  // --- 5. prev / next ---
  await page.goto(FILE + '#home');
  await page.waitForTimeout(200);
  const homeFoot = await page.$$eval('#page-home .pagefoot a', as => as.map(a => a.className || 'prev'));
  check('Home has a next link and no previous', homeFoot.length === 1 && homeFoot[0].includes('nxt'), homeFoot.join(','));

  await page.click('#page-home .pagefoot a.nxt');
  await page.waitForTimeout(60);
  const afterNext = await page.$$eval('.page:not([hidden])', e => e.map(x => x.id));
  check('Next moves to the following lesson', afterNext[0] === 'page-how', afterNext.join(','));

  const lastId = await page.$$eval('.page', els => els[els.length - 1].id);
  await page.goto(FILE + '#' + lastId.replace('page-', ''));
  await page.waitForTimeout(200);
  const lastFoot = await page.$$eval('.pagefoot a', as => as.filter(a => a.offsetParent !== null).map(a => a.className || 'prev'));
  check('Last page has a previous link and no next', lastFoot.length === 1 && !lastFoot[0].includes('nxt'), lastFoot.join(','));

  // --- 6. deep link ---
  await page.goto(FILE + '#4-6');
  await page.waitForTimeout(250);
  const deep = await page.$$eval('.page:not([hidden])', e => e.map(x => x.id));
  const deepTitle = await page.textContent('#page-4-6 h1');
  check('Deep link opens that lesson directly', deep.length === 1 && deep[0] === 'page-4-6', deep.join(',') + ' / ' + (deepTitle || '').slice(0, 40));

  // --- 7. in-page cross links (e.g. a lesson linking to a project) ---
  await page.goto(FILE + '#map');
  await page.waitForTimeout(200);
  await page.click('#page-map a[href="#p1"]');
  await page.waitForTimeout(120);
  const crossed = await page.$$eval('.page:not([hidden])', e => e.map(x => x.id));
  check('Links inside a page navigate correctly', crossed[0] === 'page-p1', crossed.join(','));

  // --- 8. progress: tick, count, sidebar mark, persistence ---
  await page.goto(FILE + '#1-1');
  await page.waitForTimeout(200);
  const before = await page.textContent('.rail [data-progress-count]');
  await page.check('#done-m1-1');
  await page.waitForTimeout(120);
  const after = await page.textContent('.rail [data-progress-count]');
  const navTicked = await page.$eval('.rail .nav a[data-nav-for="done-m1-1"]', a => a.classList.contains('is-done'));
  const barWidth = await page.$eval('.rail [data-progress-bar]', b => b.style.width);
  check('Ticking a lesson updates the counter', before !== after, before + ' -> ' + after);
  check('Sidebar marks the lesson done', navTicked === true);
  check('Progress bar has a width', /%$/.test(barWidth) && barWidth !== '0%', barWidth);

  await page.reload();
  await page.waitForTimeout(400);
  const persisted = await page.$eval('#done-m1-1', b => b.checked);
  const afterReload = await page.textContent('.rail [data-progress-count]');
  check('Progress survives a reload', persisted === true && afterReload === after, afterReload);

  const syncNote = await page.textContent('[data-sync-note]');
  check('Falls back to local saving when no host is present', /browser/i.test(syncNote || ''), syncNote);

  // --- 9. filter ---
  await page.fill('#nav-filter', 'audit');
  await page.waitForTimeout(150);
  const shownLinks = await page.$$eval('.rail .nav a', as => as.filter(a => !a.hidden).map(a => a.textContent.trim()));
  const shownGroups = await page.$$eval('.rail .nav .grp', gs => gs.filter(g => !g.hidden).length);
  check('Filter narrows the sidebar', shownLinks.length > 0 && shownLinks.length < 10, shownLinks.join(' | '));
  check('Filter hides empty group headings', shownGroups > 0 && shownGroups < 4, String(shownGroups));
  await page.fill('#nav-filter', '');
  await page.waitForTimeout(120);
  const restored = await page.$$eval('.rail .nav a', as => as.filter(a => !a.hidden).length);
  check('Clearing the filter restores every link', restored === navLinks, restored + '/' + navLinks);

  // --- 10. desktop layout sanity ---
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('No horizontal scrolling on desktop', overflow <= 0, 'overflow ' + overflow + 'px');
  await page.screenshot({ path: __dirname + '/shot-desktop-home.png' });
  await page.goto(FILE + '#2-5');
  await page.waitForTimeout(250);
  await page.screenshot({ path: __dirname + '/shot-desktop-lesson.png' });

  // --- 11. mobile ---
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mob.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
  await mob.goto(FILE, { waitUntil: 'load' });
  await mob.waitForTimeout(400);
  const railVisible = await mob.$eval('.rail', el => el.offsetParent !== null);
  const topbarVisible = await mob.$eval('.topbar', el => el.offsetParent !== null);
  check('Sidebar is hidden on a phone', railVisible === false);
  check('Top bar appears on a phone', topbarVisible === true);

  await mob.click('#menu-btn');
  await mob.waitForTimeout(150);
  const drawerOpen = await mob.$eval('#drawer', d => !d.hidden);
  check('Menu button opens the drawer', drawerOpen === true);
  await mob.click('#drawer a[data-go="3-1"]');
  await mob.waitForTimeout(200);
  const drawerClosed = await mob.$eval('#drawer', d => d.hidden);
  const mobShown = await mob.$$eval('.page:not([hidden])', e => e.map(x => x.id));
  check('Tapping a drawer link navigates and closes the drawer', drawerClosed === true && mobShown[0] === 'page-3-1', mobShown.join(','));

  const mobOverflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('No horizontal scrolling on a phone', mobOverflow <= 1, 'overflow ' + mobOverflow + 'px');

  // widest elements at phone width (tables/code are allowed to scroll inside their own box)
  const wide = await mob.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.page:not([hidden]) *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > window.innerWidth + 1 && !el.closest('.tbl-wrap, .term, pre, table')) {
        bad.push(el.tagName + '.' + (el.className || '').toString().slice(0, 30) + ' ' + Math.round(r.width));
      }
    });
    return bad.slice(0, 5);
  });
  check('Nothing overflows the phone screen', wide.length === 0, wide.join(' ; '));
  await mob.screenshot({ path: __dirname + '/shot-mobile.png' });

  // --- 12. tables and code blocks scroll inside their own container ---
  await page.goto(FILE + '#6-2');
  await page.waitForTimeout(250);
  const tableScrolls = await page.$$eval('.tbl-wrap', els => els.every(e => getComputedStyle(e).overflowX === 'auto'));
  check('Wide tables scroll inside their own box', tableScrolls === true);

  // --- 13. fonts actually loaded (not silent fallback) ---
  const fontsOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return { fraunces: document.fonts.check('600 32px Fraunces'), plex: document.fonts.check('400 13px "IBM Plex Mono"') };
  });
  check('Display and mono fonts load', fontsOk.fraunces && fontsOk.plex, JSON.stringify(fontsOk));

  check('No JavaScript errors anywhere', errors.length === 0, errors.slice(0, 4).join(' ; '));

  await browser.close();

  const failed = results.filter(r => !r.pass);
  console.log('\n=== RESULTS: ' + (results.length - failed.length) + '/' + results.length + ' passed ===\n');
  results.forEach(r => console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.detail ? '   [' + r.detail + ']' : '')));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('SUITE CRASHED:', e); process.exit(2); });
