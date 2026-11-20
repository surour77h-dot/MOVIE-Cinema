/* سينماتيك حمد — core: state, router, home, sections, settings, background fetching */
(function () {
  'use strict';
  const VERSION = '1.0';

  const SECTIONS = [
    { key: 'foreign', label: 'الأفلام الأجنبية', ic: '🎞️', tv: false },
    { key: 'arabic', label: 'الأفلام العربية', ic: '🎭', tv: false },
    { key: 'series', label: 'المسلسلات', ic: '📺', tv: true },
    { key: 'kids', label: 'أفلام الأطفال', ic: '🧸', tv: false },
    { key: 'dubbed', label: 'المدبلج', ic: '🗣️', tv: false },
    { key: 'cartoon', label: 'كرتون عربي قديم', ic: '📼', tv: true },
    { key: 'new', label: 'إصدارات جديدة', ic: '🆕', tv: false }
  ];
  const TOOLS = [
    { href: '#/wheel', ic: '🎰', label: 'ماذا أشاهد الليلة؟', d: 'عجلة الاختيار' },
    { href: '#/mylist', ic: '✅', label: 'سجل المشاهدة', d: 'شاهدته وقائمتي' },
    { href: '#/top', ic: '🏆', label: 'القوائم الذهبية', d: 'الأعلى تقييماً في IMDb' },
    { href: '#/collections', ic: '🔗', label: 'السلاسل', d: 'الأجزاء والناقص منها' },
    { href: '#/actors', ic: '👤', label: 'الممثلون والمخرجون', d: 'من مكتبتك' },
    { href: '#/game', ic: '🎮', label: 'خمّن الفيلم', d: 'لعبة البوسترات' },
    { href: '#/stats', ic: '📊', label: 'الإحصائيات', d: 'أرقام المكتبة' },
    { href: '#/check', ic: '🔍', label: 'فحص المكتبة', d: 'مكررات ونواقص' },
    { href: '#/settings', ic: '⚙️', label: 'الإعدادات', d: 'الملف والمفاتيح' }
  ];
  const secOf = k => SECTIONS.find(s => s.key === k);

  const App = window.App = {
    VERSION, SECTIONS, TOOLS, secOf,
    lib: null, items: [], byId: {}, meta: {}, overrides: {},
    secState: {}
  };

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = mb => { if (!mb) return '—'; const s = mb >= 1048576 ? (mb / 1048576).toFixed(1) + ' TB' : mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB'; return '\u2066' + s + '\u2069'; };
  const fmtNum = n => Number(n || 0).toLocaleString('en-US');
  const decadeOf = y => (y ? Math.floor(y / 10) * 10 : null);
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  Object.assign(App, { $, $$, esc, fmtSize, fmtNum, decadeOf, hash, shuffle });

  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
  }
  App.toast = toast;

  /* ---------- item helpers ---------- */
  App.m = id => { const m = App.meta[id]; return m && !m.none ? m : null; };
  App.rating = it => { const m = App.m(it.id); return m && m.imdb && m.imdb.rating ? m.imdb.rating : null; };
  App.anyRating = it => { const m = App.m(it.id); if (!m) return null; if (m.imdb && m.imdb.rating) return m.imdb.rating; return m.tmdbVotes > 50 ? Math.round(m.tmdbRate * 10) / 10 : null; };
  App.genres = it => { const m = App.m(it.id); return m ? m.genres || [] : []; };
  App.year = it => it.year || (App.m(it.id) || {}).year || null;
  App.epProgress = it => {
    if (!it.eps) return null;
    const w = User.eps[it.id] || {}; const n = it.eps.filter(e => w[e.k]).length;
    return { n, total: it.eps.length };
  };
  App.isWatched = it => {
    if (User.watched[it.id]) return true;
    const p = App.epProgress(it); return !!(p && p.total && p.n === p.total);
  };
  App.setWatched = (it, on) => {
    if (on) User.watched[it.id] = Date.now(); else delete User.watched[it.id];
    if (it.eps) {
      if (on) { const o = User.eps[it.id] = User.eps[it.id] || {}; for (const e of it.eps) o[e.k] = o[e.k] || Date.now(); }
      else delete User.eps[it.id];
    }
    saveUser(); App.refreshCards(it.id);
  };
  App.toggleList = it => { if (User.list[it.id]) delete User.list[it.id]; else User.list[it.id] = Date.now(); saveUser(); };
  App.displayTitle = it => it.title;

  /* ---------- cards ---------- */
  function placeholder(it) {
    const h = hash(it.title) % 360;
    return `<div class="ph" style="background:linear-gradient(160deg,hsl(${h},38%,26%),hsl(${(h + 40) % 360},45%,12%))"><span dir="auto">${esc(it.title)}</span>${it.year ? `<small>${it.year}</small>` : ''}</div>`;
  }
  App.placeholder = placeholder;
  function posterInner(it) {
    const m = App.m(it.id);
    let h = placeholder(it);
    if (m && m.poster) h += `<img src="${esc(m.poster)}" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')" onerror="this.remove()">`;
    return h;
  }
  App.posterInner = posterInner;
  function badges(it) {
    let l = '', r = '';
    if (it.quality === '2160p') l = '<span class="bdg q4k">4K</span>';
    else if (it.quality && it.quality !== '1080p') l = `<span class="bdg">${esc(it.quality)}</span>`;
    else if (it.eps) l = `<span class="bdg">${it.eps.length} حلقة</span>`;
    const rt = App.rating(it); if (rt) r = `<span class="bdg rate">★ ${rt.toFixed(1)}</span>`;
    return `<div class="badges">${r || '<span></span>'}${l}</div>`;
  }
  function overlay(it) {
    if (App.isWatched(it)) return '<div class="watched-ov"><span>✓ شاهدته</span></div>';
    const p = App.epProgress(it);
    if (p && p.n) return `<div class="prog"><i style="width:${(p.n / p.total * 100).toFixed(1)}%"></i></div>`;
    return '';
  }
  App.card = function (it, opts = {}) {
    const need = !App.meta[it.id] && Meta.hasKeys() ? ' data-need="1"' : '';
    return `<a class="card${opts.cls ? ' ' + opts.cls : ''}" data-id="${esc(it.id)}"${need}>
      <div class="poster">${posterInner(it)}${badges(it)}${overlay(it)}</div>
      <div class="card-t" dir="auto">${esc(it.title)}</div>
      <div class="card-y">${opts.sub != null ? opts.sub : (App.year(it) || (it.eps ? it.eps.length + ' حلقة' : ''))}</div></a>`;
  };
  App.refreshCards = function (id) {
    const it = App.byId[id]; if (!it) return;
    for (const el of $$(`.card[data-id="${CSS.escape(id)}"]`)) {
      const cls = el.className.replace('card', '').trim();
      const sub = el.querySelector('.card-y').innerHTML;
      const tmp = document.createElement('div');
      tmp.innerHTML = App.card(it, { cls, sub });
      const nn = tmp.firstElementChild; nn.removeAttribute('data-need');
      el.replaceWith(nn);
    }
  };

  /* ---------- background fetching (visible cards + "fetch all") ---------- */
  const queue = []; const queued = new Set(); let running = 0; const MAXC = 3;
  let fatal = false;
  function enqueue(id, level = 'basic', front = false) {
    if (!Meta.hasKeys() || fatal) return;
    if (App.meta[id] && level === 'basic') return;
    const k = id + '|' + level; if (queued.has(k)) return;
    queued.add(k); front ? queue.unshift({ id, level, k }) : queue.push({ id, level, k }); pump();
  }
  App.enqueue = enqueue;
  function pump() {
    while (running < MAXC && queue.length) {
      const job = queue.shift(); running++;
      const it = App.byId[job.id];
      Meta.resolve(it, job.level).then(() => App.refreshCards(job.id)).catch(e => {
        if (/401/.test(e.message)) { fatal = true; queue.length = 0; toast('المفتاح غير صحيح — راجع الإعدادات'); }
      }).finally(() => { running--; queued.delete(job.k); pump(); });
    }
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(ents => {
    for (const e of ents) if (e.isIntersecting) { const id = e.target.dataset.id; io.unobserve(e.target); if (e.target.dataset.need) enqueue(id, 'basic', true); }
  }, { rootMargin: '300px' }) : null;
  App.observeCards = root => { if (!io) return; for (const el of $$('.card[data-need]', root)) io.observe(el); };

  /* fetch all */
  const Bulk = App.bulk = { on: false, done: 0, total: 0, list: [], level: 'full' };
  App.startBulk = function () {
    if (!Meta.hasKeys()) { toast('أضف المفتاح أولاً من الإعدادات'); location.hash = '#/settings'; return; }
    fatal = false;
    const k = Meta.keys();
    const list = App.items.filter(it => {
      const m = App.meta[it.id];
      if (!m) return true;
      if (m.none) return false;
      return !!(k.omdb && m.imdbId && !m.imdb);
    }).map(it => it.id);
    Object.assign(Bulk, { on: true, done: 0, total: list.length, list });
    if (!list.length) { Bulk.on = false; toast('كل البيانات محمّلة ✔'); renderBulk(); return; }
    renderBulk(); bulkLoop();
  };
  App.stopBulk = () => { Bulk.on = false; renderBulk(); };
  async function bulkLoop() {
    const worker = async () => {
      while (Bulk.on && Bulk.list.length) {
        const id = Bulk.list.shift(); const it = App.byId[id];
        const level = Meta.keys().omdb && Meta.omdbLeft() > 0 ? 'full' : 'basic';
        try { await Meta.resolve(it, level); App.refreshCards(id); }
        catch (e) {
          if (/401/.test(e.message)) { Bulk.on = false; toast('المفتاح غير صحيح — راجع الإعدادات'); }
        }
        Bulk.done++; renderBulk();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (Bulk.on) { Bulk.on = false; toast('اكتمل جلب البيانات ✔'); if (location.hash.startsWith('#/settings')) route(); }
    renderBulk();
  }
  function renderBulk() {
    const el = $('#bgTask');
    if (!Bulk.on) { el.hidden = true; const p = $('#bulkPanel'); if (p) p.innerHTML = bulkPanelInner(); return; }
    const pct = Bulk.total ? Bulk.done / Bulk.total * 100 : 0;
    el.hidden = false;
    el.innerHTML = `<span>⏬ جلب البيانات ${fmtNum(Bulk.done)}/${fmtNum(Bulk.total)}</span><div class="mini"><i style="width:${pct}%"></i></div><button class="btn sm" onclick="App.stopBulk()">إيقاف</button>`;
    const p = $('#bulkPanel'); if (p) p.innerHTML = bulkPanelInner();
  }
  function bulkPanelInner() {
    const total = App.items.length;
    const have = App.items.filter(it => App.meta[it.id]).length;
    const found = App.items.filter(it => App.m(it.id)).length;
    const rated = App.items.filter(it => App.rating(it)).length;
    const pct = total ? have / total * 100 : 0;
    return `<div class="progress"><i style="width:${pct}%"></i></div>
      <p>تم فحص <b>${fmtNum(have)}</b> من ${fmtNum(total)} عنواناً · تعرّف على <b>${fmtNum(found)}</b> · بتقييم IMDb: <b>${fmtNum(rated)}</b></p>
      ${Meta.keys().omdb ? `<p>رصيد OMDb المتبقي اليوم: <b>${fmtNum(Math.max(0, Meta.omdbLeft()))}</b> من ${Meta.OMDB_DAILY} طلب. التقييمات المتبقية تُكمَل تلقائياً في الأيام التالية.</p>` : ''}
      <div class="field">${Bulk.on ? `<button class="btn" onclick="App.stopBulk()">⏸ إيقاف الجلب</button>` : `<button class="btn gold" onclick="App.startBulk()">⏬ جلب بيانات الكل</button>`}</div>`;
  }

  /* ---------- nav / drawer ---------- */
  function renderChips(active) {
    const items = [['#/home', 'الرئيسية']].concat(SECTIONS.map(s => ['#/sec/' + s.key, s.label]));
    $('#navChips').innerHTML = items.map(([h, l]) => `<a class="chip${active === h ? ' on' : ''}" href="${h}">${l}</a>`).join('');
    const on = $('#navChips .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function openDrawer() {
    $('#drawerPanel').innerHTML = `
      <a class="dr-link" href="#/home"><span class="ic">🏠</span>الرئيسية</a>
      <h3>الأقسام</h3>${SECTIONS.map(s => `<a class="dr-link" href="#/sec/${s.key}"><span class="ic">${s.ic}</span>${s.label}</a>`).join('')}
      <h3>الأدوات</h3>${TOOLS.map(t => `<a class="dr-link" href="${t.href}"><span class="ic">${t.ic}</span>${t.label}</a>`).join('')}
      <p class="sub" style="margin:18px 10px">الإصدار ${VERSION}</p>`;
    $('#drawer').hidden = false;
  }
  $('#btnMenu').onclick = openDrawer;
  $('#drawer').onclick = e => { if (e.target.id === 'drawer' || e.target.closest('a')) $('#drawer').hidden = true; };
  $('#btnBack').onclick = () => { if (location.hash && location.hash !== '#/home' && history.length > 1) history.back(); else location.hash = '#/home'; };

  /* ---------- global search ---------- */
  const gs = $('#globalSearch'), sr = $('#searchResults');
  App.matchText = (it, q) => {
    const m = App.m(it.id);
    const hay = Parser.slug(it.title + ' ' + (it.alt || '') + ' ' + (m ? m.title + ' ' + m.orig : ''));
    return hay.includes(q);
  };
  gs.addEventListener('input', () => {
    const q = Parser.slug(gs.value);
    if (q.length < 2) { sr.hidden = true; return; }
    const res = App.items.filter(it => App.matchText(it, q)).slice(0, 40);
    sr.innerHTML = res.length ? res.map(it => {
      const m = App.m(it.id); const s = secOf(it.sec);
      return `<div class="sr-item" data-id="${esc(it.id)}">${m && m.poster ? `<img src="${esc(m.poster)}" alt="">` : `<div class="ph" style="position:relative;background:var(--surface2);font-size:18px">${s.ic}</div>`}
        <div><div dir="auto">${esc(it.title)}</div><small>${s.label}${App.year(it) ? ' · ' + App.year(it) : ''}</small></div></div>`;
    }).join('') : '<div class="empty">لا توجد نتائج</div>';
    sr.hidden = false;
  });
  document.addEventListener('click', e => { if (!e.target.closest('.top-search')) sr.hidden = true; });
  sr.addEventListener('click', e => { const el = e.target.closest('[data-id]'); if (el) { sr.hidden = true; gs.blur(); Details.open(el.dataset.id); } });

  /* open details on any card */
  document.addEventListener('click', e => {
    const c = e.target.closest('.card[data-id], .li[data-id], [data-open]');
    if (c && !e.target.closest('.search-results') && !c.dataset.nav) { e.preventDefault(); Details.open(c.dataset.id || c.dataset.open); }
  });

  /* ---------- router ---------- */
  const Views = App.views = {};
  function route() {
    const h = location.hash || '#/home';
    const parts = h.slice(2).split('/');
    const name = parts[0] || 'home';
    const view = $('#view');
    if (!App.lib && name !== 'settings') { renderWelcome(view); renderChips(''); return; }
    renderChips(name === 'sec' ? '#/sec/' + parts[1] : name === 'home' ? '#/home' : '');
    $('#btnBack').style.visibility = name === 'home' ? 'hidden' : 'visible';
    const fn = Views[name] || Views.home;
    view.innerHTML = '';
    window.scrollTo(0, 0);
    fn(view, parts.slice(1).map(decodeURIComponent));
  }
  App.route = route;
  window.addEventListener('hashchange', () => { if (window.Details) Details.close(true); route(); });

  /* ---------- welcome / import ---------- */
  function renderWelcome(view) {
    view.innerHTML = `<div class="welcome">
      <div class="big">🎬</div><h1>أهلاً بك في سينماتيك حمد</h1>
      <p>ارفع ملف قاعدة بيانات الأفلام والمسلسلات (Excel) ليبني التطبيق مكتبتك. يُحفظ الملف على هذا الجهاز فقط.</p>
      <p style="margin:24px 0"><label class="btn gold file-btn">📂 اختيار ملف Excel<input type="file" accept=".xlsm,.xlsx,.xls" id="fileIn"></label></p>
      <p id="impMsg" class="sub"></p></div>`;
    $('#fileIn').onchange = e => importFile(e.target.files[0]);
  }
  async function importFile(file) {
    if (!file) return;
    const msg = $('#impMsg'); if (msg) msg.textContent = 'جاري قراءة الملف…';
    try {
      const buf = await file.arrayBuffer();
      await new Promise(r => setTimeout(r, 30));
      const lib = Parser.parseWorkbook(XLSX, new Uint8Array(buf), file.name);
      if (!lib.items.length) throw new Error('empty');
      await DB.put('kv', 'library', lib);
      setLibrary(lib);
      toast(`تم استيراد ${fmtNum(lib.items.length)} عنواناً ✔`);
      location.hash = '#/home'; route();
    } catch (e) {
      console.error(e);
      if (msg) msg.textContent = 'تعذّر قراءة الملف. تأكد أنه ملف قاعدة بيانات الأفلام.';
      toast('تعذّر قراءة الملف');
    }
  }
  App.importFile = importFile;
  function setLibrary(lib) {
    App.lib = lib; App.items = lib.items; App.byId = {};
    for (const it of lib.items) App.byId[it.id] = it;
  }

  /* ---------- HOME ---------- */
  Views.home = function (view) {
    const items = App.items;
    const today = new Date(); const md = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const withMeta = items.filter(it => App.m(it.id));
    // tonight's pick: best unwatched with backdrop
    const pool = withMeta.filter(it => !App.isWatched(it) && App.m(it.id).backdrop && (App.anyRating(it) || 0) >= 7);
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : shuffle(items.filter(it => !App.isWatched(it)))[0];
    const pm = pick ? App.m(pick.id) : null;
    const sec = s => items.filter(it => it.sec === s.key);
    const progressing = items.filter(it => it.eps && !App.isWatched(it) && (App.epProgress(it).n > 0))
      .sort((a, b) => lastEpTime(b) - lastEpTime(a));
    const onThisDay = withMeta.filter(it => (App.m(it.id).date || '').slice(5) === md);
    const myList = items.filter(it => User.list[it.id]).sort((a, b) => User.list[b.id] - User.list[a.id]);
    const recent = items.filter(it => User.watched[it.id]).sort((a, b) => User.watched[b.id] - User.watched[a.id]).slice(0, 20);
    const watchedN = items.filter(it => App.isWatched(it)).length;

    let h = '';
    if (!Meta.hasKeys()) h += `<div class="panel" style="border-color:var(--gold)"><h3>🔑 خطوة واحدة لتظهر البوسترات والتقييمات</h3>
      <p>أضف مفتاح OMDb أو TMDB المجاني من الإعدادات لتظهر صور الأفلام وتقييم IMDb والممثلون.</p>
      <a class="btn gold" href="#/settings">فتح الإعدادات</a></div>`;
    if (pick) h += `<div class="hero" data-open="${esc(pick.id)}">
      ${pm && pm.backdrop ? `<div class="hero-bg" style="background-image:url('${esc(pm.backdrop)}')"></div>` : ''}
      <div class="hero-body">${pm && pm.poster ? `<img src="${esc(pm.poster)}" alt="">` : ''}
      <div><div class="hero-tag">✨ اقتراح الليلة</div><div class="hero-title" dir="auto">${esc(pick.title)}</div>
      <div class="hero-meta">${[App.year(pick), secOf(pick.sec).label, App.anyRating(pick) ? '★ ' + App.anyRating(pick) : '', (pm && pm.genres || []).slice(0, 2).join('، ')].filter(Boolean).join(' · ')}</div></div></div></div>`;

    h += `<h2 class="sec">📚 الأقسام <span class="more">${fmtNum(watchedN)} شاهدته من ${fmtNum(items.length)}</span></h2><div class="tiles">` +
      SECTIONS.map(s => { const a = sec(s); const w = a.filter(App.isWatched).length;
        return `<a class="tile" href="#/sec/${s.key}"><span class="ic">${s.ic}</span><b>${s.label}</b><small>${fmtNum(a.length)} ${s.tv ? 'مسلسل' : 'فيلم'} · شاهدت ${fmtNum(w)}</small><div class="bar"><i style="width:${a.length ? w / a.length * 100 : 0}%"></i></div></a>`; }).join('') + '</div>';

    if (progressing.length) h += `<h2 class="sec">▶️ تابع المشاهدة</h2><div class="rail">${progressing.slice(0, 20).map(it => { const p = App.epProgress(it); return App.card(it, { sub: `${p.n}/${p.total} حلقة` }); }).join('')}</div>`;
    if (onThisDay.length) h += `<h2 class="sec">📅 في مثل هذا اليوم</h2><div class="rail">${onThisDay.map(it => { const y = +App.m(it.id).date.slice(0, 4); return App.card(it, { sub: `صدر قبل ${today.getFullYear() - y} سنة` }); }).join('')}</div>`;
    if (myList.length) h += `<h2 class="sec">📌 قائمتي <a class="more" href="#/mylist">الكل</a></h2><div class="rail">${myList.slice(0, 20).map(it => App.card(it)).join('')}</div>`;
    if (recent.length) h += `<h2 class="sec">🕘 شاهدته مؤخراً <a class="more" href="#/mylist">الكل</a></h2><div class="rail">${recent.map(it => App.card(it)).join('')}</div>`;

    h += `<h2 class="sec">🧰 الأدوات</h2><div class="tiles">${TOOLS.map(t => `<a class="tile" href="${t.href}"><span class="ic">${t.ic}</span><b>${t.label}</b><small>${t.d}</small></a>`).join('')}</div>`;
    view.innerHTML = h;
    App.observeCards(view);
  };
  function lastEpTime(it) { const w = User.eps[it.id] || {}; return Math.max(0, ...Object.values(w)); }

  /* ---------- SECTION ---------- */
  const SORTS = [
    ['title', 'الاسم'], ['year-d', 'الأحدث'], ['year-a', 'الأقدم'], ['rate', 'التقييم'], ['size', 'الحجم'], ['quality', 'الجودة']
  ];
  const QRANK = { '2160p': 4, '1080p': 3, '720p': 2, '576p': 1, '480p': 1, SD: 0, '': -1 };
  App.sortItems = function (arr, sort) {
    const by = {
      title: (a, b) => a.title.localeCompare(b.title, 'ar', { numeric: true }),
      'year-d': (a, b) => (App.year(b) || 0) - (App.year(a) || 0) || a.title.localeCompare(b.title),
      'year-a': (a, b) => (App.year(a) || 9999) - (App.year(b) || 9999) || a.title.localeCompare(b.title),
      rate: (a, b) => (App.anyRating(b) || 0) - (App.anyRating(a) || 0) || a.title.localeCompare(b.title),
      size: (a, b) => b.size - a.size,
      quality: (a, b) => (QRANK[b.quality] || 0) - (QRANK[a.quality] || 0) || a.title.localeCompare(b.title)
    }[sort] || ((a, b) => 0);
    return arr.slice().sort(by);
  };

  Views.sec = function (view, [key]) {
    const s = secOf(key); if (!s) { location.hash = '#/home'; return; }
    const st = App.secState[key] = App.secState[key] || { q: '', sort: s.tv ? 'title' : 'title', dec: '', qual: '', genre: '', w: 'all' };
    const all = App.items.filter(it => it.sec === key);
    const decades = [...new Set(all.map(it => decadeOf(App.year(it))).filter(Boolean))].sort((a, b) => b - a);
    const quals = [...new Set(all.map(it => it.quality).filter(Boolean))].sort((a, b) => (QRANK[b] || 0) - (QRANK[a] || 0));
    const genres = [...new Set(all.flatMap(App.genres))].sort((a, b) => a.localeCompare(b, 'ar'));

    view.innerHTML = `<h1 class="page">${s.ic} ${s.label}</h1>
      <div class="toolbar">
        <input type="search" id="fq" placeholder="بحث في ${s.label}…" value="${esc(st.q)}">
        <select id="fsort">${SORTS.filter(x => !(s.tv && x[0] === 'quality')).map(([v, l]) => `<option value="${v}"${st.sort === v ? ' selected' : ''}>ترتيب: ${l}</option>`).join('')}</select>
        ${decades.length > 1 ? `<select id="fdec"><option value="">كل العقود</option>${decades.map(d => `<option value="${d}"${String(st.dec) === String(d) ? ' selected' : ''}>${d}s</option>`).join('')}</select>` : ''}
        ${quals.length > 1 ? `<select id="fqual"><option value="">كل الجودات</option>${quals.map(q => `<option${st.qual === q ? ' selected' : ''}>${q}</option>`).join('')}</select>` : ''}
        ${genres.length ? `<select id="fgen"><option value="">كل الأنواع</option>${genres.map(g => `<option${st.genre === g ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select>` : ''}
        <div class="seg" id="fw">${[['all', 'الكل'], ['seen', 'شاهدته'], ['unseen', 'لم أشاهده'], ['list', 'قائمتي']].map(([v, l]) => `<button data-v="${v}" class="${st.w === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span class="count" id="fcount"></span>
      </div>
      <div class="grid" id="grid"></div><div class="sentinel" id="sent"></div>`;

    let list = [], shown = 0; const STEP = 60;
    function apply() {
      const q = Parser.slug(st.q);
      list = all.filter(it =>
        (!q || App.matchText(it, q)) &&
        (!st.dec || decadeOf(App.year(it)) === +st.dec) &&
        (!st.qual || it.quality === st.qual) &&
        (!st.genre || App.genres(it).includes(st.genre)) &&
        (st.w === 'all' || (st.w === 'seen' ? App.isWatched(it) : st.w === 'unseen' ? !App.isWatched(it) : !!User.list[it.id])));
      list = App.sortItems(list, st.sort);
      $('#fcount').textContent = `${fmtNum(list.length)} ${s.tv ? 'مسلسل' : 'فيلم'}`;
      $('#grid').innerHTML = ''; shown = 0; more();
    }
    function more() {
      if (shown >= list.length) { if (!list.length) $('#grid').innerHTML = '<div class="empty">لا توجد نتائج</div>'; return; }
      const chunk = list.slice(shown, shown + STEP); shown += chunk.length;
      $('#grid').insertAdjacentHTML('beforeend', chunk.map(it => App.card(it)).join(''));
      App.observeCards($('#grid'));
    }
    let t;
    $('#fq').oninput = e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; apply(); }, 180); };
    $('#fsort').onchange = e => { st.sort = e.target.value; apply(); };
    if ($('#fdec')) $('#fdec').onchange = e => { st.dec = e.target.value; apply(); };
    if ($('#fqual')) $('#fqual').onchange = e => { st.qual = e.target.value; apply(); };
    if ($('#fgen')) $('#fgen').onchange = e => { st.genre = e.target.value; apply(); };
    $('#fw').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.w = b.dataset.v; $$('#fw button').forEach(x => x.classList.toggle('on', x === b)); apply(); };
    const so = new IntersectionObserver(ents => { if (ents[0].isIntersecting) more(); }, { rootMargin: '800px' });
    so.observe($('#sent'));
    apply();
  };

  /* ---------- MY LIST ---------- */
  Views.mylist = function (view) {
    const tab = App._mlTab || 'list';
    const tabs = [['list', '📌 قائمتي'], ['seen', '✅ شاهدته'], ['prog', '▶️ قيد المشاهدة'], ['rated', '⭐ قيّمتها']];
    let arr;
    if (tab === 'list') arr = App.items.filter(it => User.list[it.id]).sort((a, b) => User.list[b.id] - User.list[a.id]);
    else if (tab === 'seen') arr = App.items.filter(App.isWatched).sort((a, b) => (User.watched[b.id] || 0) - (User.watched[a.id] || 0));
    else if (tab === 'prog') arr = App.items.filter(it => it.eps && !App.isWatched(it) && App.epProgress(it).n);
    else arr = App.items.filter(it => User.rate[it.id]).sort((a, b) => User.rate[b.id] - User.rate[a.id]);
    view.innerHTML = `<h1 class="page">✅ سجل المشاهدة</h1>
      <p class="sub">شاهدت ${fmtNum(App.items.filter(App.isWatched).length)} عنواناً من ${fmtNum(App.items.length)}</p>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
      <div class="grid">${arr.length ? arr.map(it => App.card(it, tab === 'rated' ? { sub: '⭐ تقييمي ' + User.rate[it.id] + '/10' } : tab === 'prog' ? { sub: App.epProgress(it).n + '/' + it.eps.length + ' حلقة' } : {})).join('') : '<div class="empty">لا شيء هنا بعد</div>'}</div>`;
    view.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { App._mlTab = b.dataset.t; route(); } };
    App.observeCards(view);
  };

  /* ---------- SETTINGS ---------- */
  Views.settings = function (view) {
    const k = Meta.keys(); const lib = App.lib;
    view.innerHTML = `<h1 class="page">⚙️ الإعدادات</h1>
    <div class="panel"><h3>📂 ملف المكتبة</h3>
      ${lib ? `<p>الملف الحالي: <b class="ltr">${esc(lib.fileName)}</b> · ${fmtNum(lib.items.length)} عنواناً · استيراد ${new Date(lib.importedAt).toLocaleDateString('ar-KW')}</p>
      <p>${SECTIONS.map(s => `${s.label}: <b>${fmtNum(lib.report[s.key] || 0)}</b>`).join(' · ')}</p>` : '<p>لم يُرفع ملف بعد.</p>'}
      <p>عند تحديث مكتبتك ارفع الملف الجديد. يبقى سجل المشاهدة والبيانات المحمّلة كما هي.</p>
      <label class="btn gold file-btn">📂 ${lib ? 'تحديث الملف' : 'اختيار ملف Excel'}<input type="file" accept=".xlsm,.xlsx,.xls" id="fileIn2"></label>
      <p id="impMsg" class="sub"></p></div>

    <div class="panel"><h3>🔑 مفاتيح بيانات الأفلام</h3>
      <p>موقع IMDb لا يسمح للتطبيقات بأخذ بياناته مباشرة، لذلك نستخدم موقعين مجانيين ينقلانها رسمياً. يكفي <b>مفتاح OMDb وحده</b> للبوستر وتقييم IMDb والممثلين، ومفتاح <b>TMDB</b> يضيف صور الممثلين والإعلانات والقصة بالعربي والسلاسل وتغطية أفضل للأفلام العربية. الأفضل وضع الاثنين.</p>
      <div class="field"><label>مفتاح OMDb</label><input id="kOmdb" value="${esc(k.omdb)}" placeholder="مثل: a1b2c3d4" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      <div class="field"><label>مفتاح TMDB</label><input id="kTmdb" value="${esc(k.tmdb)}" placeholder="API Key أو Read Access Token" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      <div class="field"><button class="btn gold" id="saveKeys">💾 حفظ واختبار</button><span id="keyMsg"></span></div>
      <details><summary style="cursor:pointer;color:var(--gold);margin-top:8px">📖 طريقة الحصول على المفتاحين (دقيقتان لكل موقع)</summary>
        <h4>1) مفتاح OMDb (تقييم IMDb)</h4>
        <ol class="steps"><li>افتح <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener">omdbapi.com/apikey.aspx</a></li>
          <li>اختر <b>FREE! (1,000 daily limit)</b> واكتب بريدك واسمك، وفي خانة Use اكتب: Personal movie library</li>
          <li>اضغط Submit، وستصلك رسالة على بريدك فيها المفتاح ورابط تفعيل</li>
          <li>اضغط رابط التفعيل في الرسالة، ثم انسخ المفتاح (8 أحرف) والصقه هنا</li></ol>
        <h4>2) مفتاح TMDB (البوسترات والممثلون والإعلانات)</h4>
        <ol class="steps"><li>أنشئ حساباً مجانياً في <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">themoviedb.org/signup</a> وفعّله من بريدك</li>
          <li>افتح <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a> واضغط <b>Create</b> ← <b>Developer</b></li>
          <li>وافق على الشروط واملأ النموذج: نوع الاستخدام Personal، اسم التطبيق Cinematheque، والرابط رابط تطبيقك على GitHub Pages</li>
          <li>بعد الإرسال تظهر صفحة فيها <b>API Key</b>، انسخه والصقه هنا</li></ol>
        <p>المفتاحان يُحفظان على هذا الجهاز فقط ولا يظهران في كود التطبيق.</p>
      </details></div>

    <div class="panel"><h3>⏬ جلب البيانات لكل المكتبة</h3>
      <p>البيانات تُجلب تلقائياً لكل فيلم تراه على الشاشة. هذا الزر يجلبها للمكتبة كلها في الخلفية، وتحتاجه الإحصائيات والسلاسل والممثلون واللعبة. ويُحفظ كل شيء على الجهاز فيعمل بعدها دون إنترنت.</p>
      <div id="bulkPanel">${bulkPanelInner()}</div></div>

    <div class="panel"><h3>💾 نسخة احتياطية لسجل المشاهدة</h3>
      <p>انسخ سجل المشاهدة وقائمتي وتقييماتك لنقلها إلى جهاز آخر (iPhone ↔ iPad).</p>
      <div class="field"><button class="btn" id="expU">📤 تصدير السجل</button>
      <label class="btn file-btn">📥 استيراد سجل<input type="file" accept=".json" id="impU"></label></div></div>

    <div class="panel"><h3>🧹 أخرى</h3>
      <div class="field"><button class="btn red" id="clrMeta">مسح بيانات الأفلام المحمّلة</button><button class="btn red" id="clrUser">مسح سجل المشاهدة</button></div>
      <p class="sub">الإصدار ${VERSION}</p></div>`;

    $('#fileIn2').onchange = e => importFile(e.target.files[0]);
    $('#saveKeys').onclick = async () => {
      Settings.set('omdbKey', $('#kOmdb').value.trim()); Settings.set('tmdbKey', $('#kTmdb').value.trim());
      fatal = false;
      const m = $('#keyMsg'); m.textContent = 'جاري الاختبار…';
      const r = await Meta.testKeys();
      const part = (n, v) => v === undefined ? '' : `<span class="${v ? 'ok-t' : 'bad-t'}">${n} ${v ? '✔ يعمل' : '✖ غير صحيح'}</span> `;
      m.innerHTML = part('OMDb', r.omdb) + part('TMDB', r.tmdb) || 'لم تُدخل مفتاحاً';
      // retry items that failed with no keys before
      for (const id in App.meta) if (App.meta[id].none) delete App.meta[id];
    };
    $('#expU').onclick = () => {
      const blob = new Blob([JSON.stringify({ app: 'cinematheque', v: 1, at: Date.now(), user: User, overrides: App.overrides })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cinematheque-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    };
    $('#impU').onchange = async e => {
      try {
        const j = JSON.parse(await e.target.files[0].text());
        if (!j.user) throw 0;
        for (const k2 of ['watched', 'list', 'rate', 'eps', 'game']) Object.assign(User[k2], j.user[k2] || {});
        saveUser();
        if (j.overrides) { Object.assign(App.overrides, j.overrides); await DB.put('kv', 'overrides', App.overrides); }
        toast('تم استيراد السجل ✔');
      } catch (err) { toast('ملف غير صالح'); }
    };
    $('#clrMeta').onclick = async () => { if (!confirm('مسح كل البيانات المحمّلة من الإنترنت؟')) return; await DB.clear('meta'); await DB.clear('coll'); await DB.clear('person'); App.meta = {}; toast('تم المسح'); route(); };
    $('#clrUser').onclick = () => { if (!confirm('مسح سجل المشاهدة وقائمتي وتقييماتك؟ لا يمكن التراجع.')) return; for (const k2 of ['watched', 'list', 'rate', 'eps']) User[k2] = {}; saveUser(); toast('تم المسح'); };
  };

  /* ---------- boot ---------- */
  async function boot() {
    try {
      const [lib, meta, over] = await Promise.all([DB.get('kv', 'library'), DB.all('meta'), DB.get('kv', 'overrides')]);
      App.meta = meta || {}; App.overrides = over || {};
      if (lib) setLibrary(lib);
    } catch (e) { console.error(e); }
    route();
  }
  // re-route after orientation changes so layouts recompute cleanly
  let lastW = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - lastW) > 120) { lastW = innerWidth; document.documentElement.style.width = '100%'; } });
  document.addEventListener('DOMContentLoaded', boot);
})();
