/* Tools: wheel, golden lists, collections, actors, library check, statistics */
(function () {
  'use strict';
  const { $, $$, esc, fmtSize, fmtNum, decadeOf, shuffle } = App;
  const V = App.views;
  const needData = (msg) => `<div class="panel" style="border-color:var(--gold)"><p>${msg}</p>
    <a class="btn gold" href="#/settings">⏬ الإعدادات ← جلب بيانات الكل</a></div>`;
  const metaCount = () => App.items.filter(it => App.m(it.id)).length;

  /* ================= WHEEL ================= */
  const W = { secs: ['foreign', 'arabic', 'kids'], genre: '', dec: '', min: 0, unseen: true };
  V.wheel = function (view) {
    const genres = [...new Set(App.items.flatMap(App.genres))].sort((a, b) => a.localeCompare(b, 'ar'));
    const decs = [...new Set(App.items.map(it => decadeOf(App.year(it))).filter(Boolean))].sort((a, b) => b - a);
    view.innerHTML = `<h1 class="page">🎰 ماذا أشاهد الليلة؟</h1><p class="sub">حدّد ما تريد ثم لُفّ العجلة، وستختار لك من مكتبتك.</p>
      <div class="tabs" id="wSecs">${App.SECTIONS.map(s => `<button class="chip${W.secs.includes(s.key) ? ' on' : ''}" data-s="${s.key}">${s.ic} ${s.label}</button>`).join('')}</div>
      <div class="toolbar">
        <select id="wGen"><option value="">كل الأنواع</option>${genres.map(g => `<option${W.genre === g ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select>
        <select id="wDec"><option value="">كل العقود</option>${decs.map(d => `<option value="${d}"${String(W.dec) === String(d) ? ' selected' : ''}>${d}s</option>`).join('')}</select>
        <select id="wMin">${[0, 6, 7, 7.5, 8].map(v => `<option value="${v}"${W.min === v ? ' selected' : ''}>${v ? 'تقييم ' + v + '+' : 'أي تقييم'}</option>`).join('')}</select>
        <div class="seg" id="wSeen"><button data-v="1" class="${W.unseen ? 'on' : ''}">لم أشاهده</button><button data-v="0" class="${!W.unseen ? 'on' : ''}">الكل</button></div>
        <span class="count" id="wCount"></span>
      </div>
      <div class="wheel-wrap"><div class="wheel-box"><div class="wheel-pin"></div><div id="wSvg"></div><div class="wheel-hub">🎬</div></div>
      <button class="btn gold" id="wSpin" style="height:52px;font-size:18px;padding:0 34px">🎰 لُفّ العجلة</button><div id="wWin"></div></div>`;
    let cands = [], rot = 0, spinning = false;
    const pool = () => App.items.filter(it => W.secs.includes(it.sec) &&
      (!W.genre || App.genres(it).includes(W.genre)) && (!W.dec || decadeOf(App.year(it)) === +W.dec) &&
      (!W.min || (App.anyRating(it) || 0) >= W.min) && (!W.unseen || !App.isWatched(it)));
    function draw() {
      const p = pool(); $('#wCount').textContent = fmtNum(p.length) + ' مرشّح';
      cands = shuffle(p.slice()).slice(0, 12);
      const n = Math.max(cands.length, 1), R = 200, cx = 210, cy = 210;
      const colors = ['#e8b94f', '#c4553f', '#2f6f8f', '#6b4e9b', '#3a8f6a', '#b0603a', '#3e5c9a', '#8f3f6b'];
      let svg = `<svg viewBox="0 0 420 420" id="wheelSvg" style="transform:rotate(${rot}deg)"><circle cx="210" cy="210" r="206" fill="#1a1405"/>`;
      if (!cands.length) svg += `<circle cx="210" cy="210" r="${R}" fill="#262c3b"/><text x="210" y="150" fill="#b9b5ac" font-size="16" text-anchor="middle">لا يوجد مرشحون</text>`;
      cands.forEach((it, i) => {
        const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
        const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
        const mid = (a0 + a1) / 2, deg = mid * 180 / Math.PI;
        const t = it.title.length > 20 ? it.title.slice(0, 19) + '…' : it.title;
        svg += `<path d="M${cx},${cy} L${x0},${y0} A${R},${R} 0 ${n === 1 ? 1 : 0} 1 ${x1},${y1} Z" fill="${colors[i % colors.length]}" stroke="#1a1405" stroke-width="2"/>`;
        svg += `<text transform="translate(${cx},${cy}) rotate(${deg}) translate(${R - 14},0)" fill="${i % colors.length === 0 ? '#1a1405' : '#fff'}" font-size="${n > 9 ? 12 : 14}" font-weight="700" dominant-baseline="middle" ${/[\u0600-\u06FF]/.test(t) ? 'direction="rtl" text-anchor="start"' : 'direction="ltr" text-anchor="end"'}>${esc(t)}</text>`;
      });
      svg += '</svg>';
      $('#wSvg').innerHTML = svg;
    }
    function spin() {
      if (spinning) return; if (!cands.length) { App.toast('لا يوجد مرشحون — غيّر الفلاتر'); return; }
      spinning = true; $('#wWin').innerHTML = '';
      const n = cands.length, win = Math.floor(Math.random() * n);
      // segment i center angle (from top, clockwise) = (i+0.5)/n*360 ; pin at top -> rotate so that center goes to 0
      const target = 360 - ((win + 0.5) / n) * 360 + (Math.random() - 0.5) * (300 / n);
      const base = rot - (rot % 360);
      rot = base + 360 * 6 + target;
      const el = $('#wheelSvg'); el.style.transform = `rotate(${rot}deg)`;
      setTimeout(() => {
        spinning = false; const it = cands[win]; const m = App.m(it.id);
        $('#wWin').innerHTML = `<div class="winner card" data-open="${esc(it.id)}" style="cursor:pointer">
          ${m && m.poster ? `<img src="${esc(m.poster)}" alt="">` : `<div class="ph-mini">${App.placeholder(it)}</div>`}
          <div><div class="hero-tag">🎉 اختيار الليلة</div><div class="hero-title" dir="auto" style="font-size:22px">${esc(it.title)}</div>
          <div class="hero-meta">${[App.year(it), App.secOf(it.sec).label, App.anyRating(it) ? '★ ' + App.anyRating(it) : '', App.genres(it).slice(0, 2).join('، ')].filter(Boolean).join(' · ')}</div>
          <div class="sub" style="margin-top:6px">اضغط لعرض التفاصيل</div></div></div>`;
      }, 5300);
    }
    $('#wSecs').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; const k = b.dataset.s;
      W.secs = W.secs.includes(k) ? W.secs.filter(x => x !== k) : W.secs.concat(k); b.classList.toggle('on'); draw(); };
    $('#wGen').onchange = e => { W.genre = e.target.value; draw(); };
    $('#wDec').onchange = e => { W.dec = e.target.value; draw(); };
    $('#wMin').onchange = e => { W.min = +e.target.value; draw(); };
    $('#wSeen').onclick = e => { const b = e.target.closest('button'); if (!b) return; W.unseen = b.dataset.v === '1'; $$('#wSeen button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
    $('#wSpin').onclick = () => { if (!spinning) { draw(); requestAnimationFrame(() => requestAnimationFrame(spin)); } };
    draw();
  };

  /* ================= TOP / GOLDEN LISTS ================= */
  V.top = function (view) {
    const rated = App.items.filter(it => App.rating(it) && it.type !== 'collection');
    const tab = App._topTab || 'all';
    const tabs = [['all', '🏆 الأعلى تقييماً'], ['dec', '📆 حسب العقد'], ['hidden', '💎 جواهر مخفية'], ['unseen', '👁️ لم تشاهدها بعد'], ['arabic', '🎭 العربي'], ['series', '📺 المسلسلات']];
    let body = '';
    const votes = it => (App.m(it.id).imdb || {}).votes || 0;
    const row = (it, i) => { const m = App.m(it.id);
      return `<div class="li" data-id="${esc(it.id)}"><span class="rk">${i + 1}</span><div class="thumb">${m.poster ? `<img src="${esc(m.poster)}" loading="lazy" alt="">` : ''}</div>
        <div class="tx"><b dir="auto">${esc(it.title)}</b><small>${[App.year(it), App.secOf(it.sec).label, (m.genres || []).slice(0, 2).join('، '), App.isWatched(it) ? '✓ شاهدته' : ''].filter(Boolean).join(' · ')}</small></div>
        <span class="end"><span class="bdg rate">★ ${App.rating(it).toFixed(1)}</span><br><small>${fmtNum(votes(it))}</small></span></div>`; };
    const byR = (a, b) => App.rating(b) - App.rating(a) || votes(b) - votes(a);
    if (!rated.length) body = needData('هذه القوائم تعتمد على تقييمات IMDb. أضف مفتاح OMDb ثم اجلب البيانات من الإعدادات.');
    else if (tab === 'all') body = `<div class="list">${rated.filter(it => votes(it) >= 25000 && it.sec !== 'cartoon').sort(byR).slice(0, 100).map(row).join('')}</div>`;
    else if (tab === 'dec') {
      const decs = [...new Set(rated.map(it => decadeOf(App.year(it))).filter(Boolean))].sort((a, b) => b - a);
      body = decs.map(d => { const a = rated.filter(it => decadeOf(App.year(it)) === d && votes(it) >= 5000).sort(byR).slice(0, 10);
        return a.length ? `<h2 class="sec">${d}s</h2><div class="list">${a.map(row).join('')}</div>` : ''; }).join('');
    } else if (tab === 'hidden') body = `<p class="sub">أفلام عالية التقييم (7.3+) لكن قليلة الشهرة (أقل من 30 ألف تقييم)</p><div class="list">${rated.filter(it => App.rating(it) >= 7.3 && votes(it) < 30000 && votes(it) > 500).sort(byR).slice(0, 60).map(row).join('')}</div>`;
    else if (tab === 'unseen') body = `<div class="list">${rated.filter(it => !App.isWatched(it) && votes(it) >= 10000).sort(byR).slice(0, 60).map(row).join('')}</div>`;
    else if (tab === 'arabic') body = `<div class="list">${rated.filter(it => it.sec === 'arabic' && votes(it) >= 100).sort(byR).slice(0, 60).map(row).join('')}</div>`;
    else body = `<div class="list">${rated.filter(it => it.sec === 'series').sort(byR).map(row).join('')}</div>`;
    view.innerHTML = `<h1 class="page">🏆 القوائم الذهبية</h1><p class="sub">ترتيب مكتبتك حسب تقييم IMDb الرسمي · ${fmtNum(rated.length)} عنواناً مقيّماً</p>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>${body}`;
    view.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { App._topTab = b.dataset.t; App.route(); } };
  };

  /* ================= COLLECTIONS ================= */
  V.collections = function (view) {
    const map = new Map();
    for (const it of App.items) { const m = App.m(it.id); if (m && m.coll) { if (!map.has(m.coll.id)) map.set(m.coll.id, { c: m.coll, items: [] }); map.get(m.coll.id).items.push(it); } }
    const list = [...map.values()].sort((a, b) => b.items.length - a.items.length || a.c.name.localeCompare(b.c.name));
    view.innerHTML = `<h1 class="page">🔗 السلاسل</h1><p class="sub">${fmtNum(list.length)} سلسلة في مكتبتك. اضغط على السلسلة لترى أجزاءها والناقص منها.</p>
      ${!Meta.keys().tmdb ? needData('السلاسل تحتاج مفتاح TMDB.') : ''}
      ${metaCount() < App.items.length * 0.6 ? `<p class="sub">💡 لاكتمال القائمة اجلب بيانات الكل من <a href="#/settings" style="color:var(--gold)">الإعدادات</a>.</p>` : ''}
      <div class="grid">${list.map(({ c, items }) => `<a class="card" href="#/coll/${c.id}" data-nav="1"><div class="poster">
        <div class="ph" style="background:var(--surface2)"><span class="ltr">${esc(c.name)}</span></div>
        ${c.poster ? `<img src="${esc(c.poster)}" alt="" loading="lazy" onload="this.classList.add('ok')">` : ''}
        <div class="badges"><span></span><span class="bdg">${items.length} عندك</span></div></div>
        <div class="card-t ltr">${esc(c.name.replace(/ Collection$/, ''))}</div></a>`).join('')}</div>`;
  };
  V.coll = async function (view, [id]) {
    view.innerHTML = '<p class="sub">⏳ جاري التحميل…</p>';
    try {
      const col = await Meta.collection(+id);
      const owned = App.ownedByTmdb();
      const have = col.parts.filter(p => owned.has(p.id));
      view.innerHTML = `${col.backdrop ? `<div class="hero" style="min-height:200px"><div class="hero-bg" style="background-image:url('${esc(col.backdrop)}')"></div>
        <div class="hero-body"><div><div class="hero-tag">🔗 سلسلة</div><div class="hero-title ltr">${esc(col.name)}</div><div class="hero-meta">عندك ${have.length} من ${col.parts.length} أجزاء</div></div></div></div>`
        : `<h1 class="page ltr">${esc(col.name)}</h1><p class="sub">عندك ${have.length} من ${col.parts.length}</p>`}
        ${col.overview ? `<p class="overview ltr" style="text-align:left">${esc(col.overview)}</p>` : ''}
        <div class="grid" style="margin-top:16px">${col.parts.map(p => { const o = owned.get(p.id);
          return o ? App.card(o, { sub: p.year }) : `<div class="card missing"><div class="poster">${p.poster ? `<img class="ok" src="${esc(p.poster)}" alt="">` : ''}</div><div class="card-t ltr">${esc(p.title)}</div><div class="card-y">${p.year}</div></div>`; }).join('')}</div>`;
    } catch (e) { view.innerHTML = '<p class="sub bad-t">تعذّر تحميل السلسلة (تحقق من الإنترنت ومفتاح TMDB)</p>'; }
  };

  /* ================= ACTORS ================= */
  function peopleIndex() {
    const actors = new Map(), dirs = new Map();
    for (const it of App.items) {
      const m = App.m(it.id); if (!m) continue;
      (m.cast || []).slice(0, 10).forEach(c => { if (!actors.has(c.id)) actors.set(c.id, { id: c.id, name: c.name, p: c.p, items: [] }); const a = actors.get(c.id); a.items.push(it); if (!a.p && c.p) a.p = c.p; });
      (m.directors || []).forEach(d => { if (!dirs.has(d.id)) dirs.set(d.id, { id: d.id, name: d.name, p: '', items: [] }); dirs.get(d.id).items.push(it); });
    }
    return { actors, dirs };
  }
  App.peopleIndex = peopleIndex;
  V.actors = function (view) {
    const { actors, dirs } = peopleIndex();
    const tab = App._actTab || 'a';
    const src = tab === 'a' ? actors : dirs;
    const st = { q: '' };
    view.innerHTML = `<h1 class="page">👤 الممثلون والمخرجون</h1><p class="sub">من في مكتبتك أكثر حضوراً؟ اضغط على الاسم لترى كل أعماله عندك.</p>
      <div class="tabs"><button class="chip${tab === 'a' ? ' on' : ''}" data-t="a">🎭 الممثلون (${fmtNum(actors.size)})</button><button class="chip${tab === 'd' ? ' on' : ''}" data-t="d">🎬 المخرجون (${fmtNum(dirs.size)})</button></div>
      ${!actors.size ? needData('هذه الصفحة تُبنى من بيانات الأفلام. اجلب بيانات الكل من الإعدادات.') : ''}
      <div class="toolbar"><input type="search" id="aq" placeholder="ابحث عن اسم…"></div><div class="list" id="alist"></div>`;
    const draw = () => {
      const q = st.q.toLowerCase();
      const arr = [...src.values()].filter(p => !q || p.name.toLowerCase().includes(q)).sort((a, b) => b.items.length - a.items.length).slice(0, 150);
      $('#alist').innerHTML = arr.map((p, i) => `<a class="li" href="#/actor/${encodeURIComponent(p.id)}" data-nav="1"><span class="rk">${i + 1}</span>
        <div class="face">${p.p ? `<img src="${Meta.IMG}w185${esc(p.p)}" loading="lazy" alt="">` : '👤'}</div>
        <div class="tx"><b class="ltr" style="text-align:right">${esc(p.name)}</b><small>${p.items.slice(0, 3).map(it => esc(it.title)).join(' · ')}</small></div>
        <span class="end">${p.items.length} ${tab === 'a' ? 'عمل' : 'فيلم'}</span></a>`).join('') || '<div class="empty">لا نتائج</div>';
    };
    $('#aq').oninput = e => { st.q = e.target.value; draw(); };
    view.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { App._actTab = b.dataset.t; App.route(); } };
    draw();
  };
  V.actor = async function (view, [pid]) {
    const { actors, dirs } = peopleIndex();
    const key = /^\d+$/.test(pid) ? +pid : pid;
    const a = actors.get(key), d = dirs.get(key);
    const name = (a || d || {}).name || '';
    const items = [...new Set([...(a ? a.items : []), ...(d ? d.items : [])])].sort((x, y) => (App.year(y) || 0) - (App.year(x) || 0));
    const seen = items.filter(App.isWatched).length;
    view.innerHTML = `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
      <div class="person" style="width:130px;cursor:default"><div class="ph-face" style="width:130px;height:130px" id="pPhoto">${a && a.p ? `<img src="${Meta.IMG}w342${esc(a.p)}" alt="">` : '👤'}</div></div>
      <div style="flex:1;min-width:220px"><h1 class="page ltr" style="text-align:right">${esc(name)}</h1>
      <p class="sub">${items.length} عمل في مكتبتك · شاهدت ${seen}${d ? ' · مخرج' : ''}${a ? ' · ممثل' : ''}</p><div id="pInfo"></div></div></div>
      <h2 class="sec">🎞️ أعماله في مكتبتك</h2><div class="grid">${items.map(it => App.card(it)).join('') || '<div class="empty">لا توجد أعمال محمّلة</div>'}</div>`;
    if (typeof key === 'number' && Meta.keys().tmdb) {
      try {
        const p = await Meta.person(key);
        if (!$('#pInfo')) return;
        if (p.photo && $('#pPhoto')) $('#pPhoto').innerHTML = `<img src="${esc(p.photo)}" alt="">`;
        const age = p.born ? Math.floor(((p.died ? new Date(p.died) : new Date()) - new Date(p.born)) / 31557600000) : null;
        $('#pInfo').innerHTML = `<p class="sub">${[p.born ? 'مواليد ' + p.born + (age ? ` (${p.died ? 'توفي عن' : 'العمر'} ${age})` : '') : '', p.place].filter(Boolean).map(esc).join(' · ')}</p>
          ${p.bio ? `<p class="overview" dir="auto" style="max-height:9.5em;overflow:hidden" id="pBio">${esc(p.bio)}</p><button class="btn sm" onclick="document.getElementById('pBio').style.maxHeight='none';this.remove()">المزيد</button>` : ''}`;
      } catch (e) {}
    }
  };

  /* ================= LIBRARY CHECK ================= */
  V.check = function (view) {
    const tab = App._chkTab || 'dup';
    const tabs = [['dup', '👯 المكررات'], ['subs', '💬 بلا ترجمة'], ['low', '📉 جودة منخفضة'], ['eps', '🧩 حلقات ناقصة'], ['none', '❓ بلا بيانات']];
    const item = (it, extra) => `<div class="li" data-id="${esc(it.id)}"><div class="thumb">${App.posterInner(it)}</div>
      <div class="tx"><b dir="auto">${esc(it.title)}</b><small>${[App.year(it), App.secOf(it.sec).label, it.quality, fmtSize(it.size)].filter(Boolean).join(' · ')}</small></div><span class="end">${extra || ''}</span></div>`;
    let body = '';
    if (tab === 'dup') {
      const g = new Map();
      for (const it of App.items) { if (it.type !== 'movie') continue; const m = App.m(it.id);
        const k = m && m.tmdbId ? 't' + m.tmdbId : Parser.slug(it.title) + ':' + (it.year || ''); if (!g.has(k)) g.set(k, []); g.get(k).push(it); }
      const dups = [...g.values()].filter(a => a.length > 1);
      const same = dups.filter(a => new Set(a.map(x => x.sec)).size < a.length);
      const cross = dups.filter(a => !same.includes(a));
      const waste = same.reduce((s, a) => s + a.slice().sort((x, y) => y.size - x.size).slice(1).reduce((t, x) => t + x.size, 0), 0);
      body = `<p class="sub">${dups.length} عنواناً مكرراً. ${same.length} منها مكرر داخل نفس القسم (يمكن توفير ${fmtSize(waste)}). أما تكرار الأطفال مع المدبلج فطبيعي (نسخة أصلية ونسخة عربية).</p>
        ${same.length ? `<h2 class="sec">داخل نفس القسم</h2>${same.map(a => `<div class="list" style="margin-bottom:10px">${a.map(it => item(it)).join('')}</div>`).join('')}` : ''}
        ${cross.length ? `<h2 class="sec">بين قسمين (${cross.length})</h2>${cross.map(a => `<div class="list" style="margin-bottom:10px">${a.map(it => item(it)).join('')}</div>`).join('')}` : ''}`;
    } else if (tab === 'subs') {
      const a = App.items.filter(it => ['foreign', 'kids', 'new'].includes(it.sec) && !it.subs).sort((x, y) => x.title.localeCompare(y.title));
      body = `<p class="sub">${a.length} فيلماً أجنبياً بدون ملف ترجمة (.srt) في مجلده — قد تكون الترجمة مدمجة داخل ملف mkv.</p><div class="list">${a.slice(0, 400).map(it => item(it)).join('')}</div>`;
    } else if (tab === 'low') {
      const a = App.items.filter(it => ['foreign', 'kids', 'dubbed', 'new'].includes(it.sec) && it.type === 'movie' && !['2160p', '1080p'].includes(it.quality))
        .sort((x, y) => (App.anyRating(y) || 0) - (App.anyRating(x) || 0));
      body = `<p class="sub">${a.length} فيلماً بجودة 720p أو أقل — مرتبة حسب التقييم (الأعلى أولاً يستحق الترقية).</p><div class="list">${a.slice(0, 400).map(it => item(it, `<span class="bdg">${it.quality || '؟'}</span>${App.anyRating(it) ? `<br><small>★ ${App.anyRating(it)}</small>` : ''}`)).join('')}</div>`;
    } else if (tab === 'eps') {
      const rows = [];
      for (const it of App.items.filter(x => x.sec === 'series')) {
        const bySeason = new Map(); for (const e of it.eps) { if (!bySeason.has(e.s)) bySeason.set(e.s, []); bySeason.get(e.s).push(e.e); }
        const miss = [];
        for (const [s, eps] of bySeason) { const mx = Math.max(...eps); for (let i = 1; i <= mx; i++) if (!eps.includes(i)) miss.push(`S${String(s).padStart(2, '0')}E${String(i).padStart(2, '0')}`); }
        const seasons = [...bySeason.keys()].sort((a, b) => a - b); const gaps = [];
        for (let s = 1; s < seasons[seasons.length - 1]; s++) if (!bySeason.has(s)) gaps.push('الموسم ' + s);
        const m = App.m(it.id);
        const tot = m && m.episodes ? `عندك ${it.eps.length} من ${m.episodes} حلقة` : '';
        if (miss.length || gaps.length || (m && m.episodes > it.eps.length)) rows.push(item(it, `<small class="ltr">${[...gaps, ...miss].slice(0, 8).join(' ')}${miss.length > 8 ? ' …' : ''}</small><br><small>${tot}</small>`));
      }
      body = `<p class="sub">حلقات أو مواسم ناقصة في المسلسلات (من أرقام الحلقات، ومن عدد الحلقات الكامل في TMDB).</p><div class="list">${rows.join('') || '<div class="empty">لا نواقص 🎉</div>'}</div>`;
    } else {
      const a = App.items.filter(it => App.meta[it.id] && App.meta[it.id].none);
      body = `<p class="sub">${a.length} عنواناً لم يتعرّف عليها البحث التلقائي — افتح العنوان واضغط «تصحيح المطابقة».</p><div class="list">${a.map(it => item(it)).join('') || '<div class="empty">لا شيء 🎉</div>'}</div>`;
    }
    view.innerHTML = `<h1 class="page">🔍 فحص المكتبة</h1>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>${body}`;
    view.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { App._chkTab = b.dataset.t; App.route(); } };
  };

  /* ================= STATISTICS ================= */
  function hbars(rows, opts = {}) {
    const max = Math.max(1, ...rows.map(r => r[1]));
    return rows.map(([l, v, extra]) => `<div class="hbar" title="${esc(l)}: ${fmtNum(v)}${extra ? ' · ' + extra : ''}"><span class="lb" dir="auto">${esc(l)}</span>
      <span class="tr"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><span class="vl">${opts.fmt ? opts.fmt(v) : fmtNum(v)}</span></div>`).join('');
  }
  V.stats = function (view) {
    const it = App.items;
    const movies = it.filter(x => x.type === 'movie');
    const eps = it.reduce((s, x) => s + (x.eps ? x.eps.length : 0), 0);
    const size = it.reduce((s, x) => s + x.size, 0);
    const watched = it.filter(App.isWatched).length;
    const epW = it.reduce((s, x) => s + (x.eps ? App.epProgress(x).n : 0), 0);
    const runtime = it.filter(App.isWatched).reduce((s, x) => { const m = App.m(x.id); if (!m || !m.runtime) return s; return s + (x.eps ? m.runtime * x.eps.length : m.runtime); }, 0);
    const rated = it.filter(x => App.rating(x));
    const avg = rated.length ? rated.reduce((s, x) => s + App.rating(x), 0) / rated.length : 0;

    const decMap = new Map(); for (const x of movies) { const d = decadeOf(App.year(x)); if (d) decMap.set(d, (decMap.get(d) || 0) + 1); }
    const decs = [...decMap.entries()].sort((a, b) => a[0] - b[0]);
    const decMax = Math.max(1, ...decs.map(d => d[1]));
    const qMap = {}; for (const x of movies.filter(m => m.sec !== 'arabic')) { const q = x.quality || 'غير محدد'; qMap[q] = (qMap[q] || 0) + 1; }
    const qOrder = ['2160p', '1080p', '720p', '576p', '480p', 'SD', 'غير محدد'];
    const gMap = {}; for (const x of it) for (const g of App.genres(x)) gMap[g] = (gMap[g] || 0) + 1;
    const { actors, dirs } = peopleIndex();
    const topA = [...actors.values()].sort((a, b) => b.items.length - a.items.length).slice(0, 10);
    const topD = [...dirs.values()].sort((a, b) => b.items.length - a.items.length).slice(0, 10);
    const sizeBySec = App.SECTIONS.map(s => [s.label, it.filter(x => x.sec === s.key).reduce((t, x) => t + x.size, 0)]);
    const sec = App.SECTIONS.map(s => { const a = it.filter(x => x.sec === s.key); return [s, a.length, a.filter(App.isWatched).length]; });
    const longest = movies.filter(x => App.m(x.id) && App.m(x.id).runtime).sort((a, b) => App.m(b.id).runtime - App.m(a.id).runtime)[0];
    const oldest = movies.filter(x => App.year(x)).sort((a, b) => App.year(a) - App.year(b))[0];
    const biggest = movies.slice().sort((a, b) => b.size - a.size)[0];

    view.innerHTML = `<h1 class="page">📊 إحصائيات المكتبة</h1><p class="sub">أرقام من ملفك ومن بيانات IMDb/TMDB المحمّلة (${fmtNum(metaCount())} من ${fmtNum(it.length)})</p>
      <div class="stat-row">
        <div class="stat"><div class="v">${fmtNum(movies.length)}</div><div class="l">فيلماً</div></div>
        <div class="stat"><div class="v">${fmtNum(it.filter(x => x.type === 'tv').length)}</div><div class="l">مسلسلاً · ${fmtNum(eps)} حلقة</div></div>
        <div class="stat"><div class="v ltr" style="text-align:right">${fmtSize(size)}</div><div class="l">الحجم الكلي</div></div>
        <div class="stat"><div class="v">${fmtNum(watched)}</div><div class="l">شاهدته (${it.length ? (watched / it.length * 100).toFixed(1) : 0}%) · ${fmtNum(epW)} حلقة</div></div>
        <div class="stat"><div class="v">${runtime ? fmtNum(Math.round(runtime / 60)) : '—'}</div><div class="l">ساعة مشاهدة تقريباً</div></div>
        <div class="stat"><div class="v">${avg ? avg.toFixed(2) : '—'}</div><div class="l">متوسط تقييم IMDb للمكتبة</div></div>
      </div>
      <div class="charts" style="margin-top:14px">
        <div class="chart"><h3>المشاهدة حسب القسم</h3>
          <div class="legend"><span style="--c:var(--green)">شاهدته</span><span style="--c:#3a4152">لم أشاهده</span></div>
          ${sec.map(([s, n, w]) => `<div style="margin:9px 0" title="${s.label}: ${w} من ${n}"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${s.ic} ${s.label}</span><span class="sub" style="margin:0">${fmtNum(w)} / ${fmtNum(n)}</span></div>
            <div class="split">${w ? `<i style="width:${w / n * 100}%;background:var(--green)"></i>` : ''}<i style="flex:1;background:#3a4152"></i></div></div>`).join('')}</div>
        <div class="chart"><h3>الأفلام حسب العقد</h3><div class="vbars">${decs.map(([d, n]) => `<div class="vb" title="${d}s: ${n} فيلماً"><span>${n}</span><i style="height:${n / decMax * 100}%"></i>${String(d).slice(2)}s</div>`).join('')}</div></div>
        <div class="chart"><h3>الأفلام حسب الجودة <small class="sub">(بدون العربية)</small></h3>${hbars(qOrder.filter(q => qMap[q]).map(q => [q === '2160p' ? '4K (2160p)' : q, qMap[q]]))}</div>
        <div class="chart"><h3>الحجم حسب القسم</h3>${hbars(sizeBySec.filter(r => r[1]).sort((a, b) => b[1] - a[1]), { fmt: fmtSize })}</div>
        ${Object.keys(gMap).length ? `<div class="chart"><h3>أكثر الأنواع</h3>${hbars(Object.entries(gMap).sort((a, b) => b[1] - a[1]).slice(0, 12))}</div>` : ''}
        ${topA.length ? `<div class="chart"><h3>الممثلون الأكثر حضوراً</h3>${hbars(topA.map(a => [a.name, a.items.length]))}</div>` : ''}
        ${topD.length ? `<div class="chart"><h3>المخرجون الأكثر حضوراً</h3>${hbars(topD.map(a => [a.name, a.items.length]))}</div>` : ''}
        <div class="chart"><h3>أرقام طريفة</h3><dl class="kv">
          ${oldest ? `<dt>أقدم فيلم</dt><dd dir="auto">${esc(oldest.title)} (${App.year(oldest)})</dd>` : ''}
          ${longest ? `<dt>أطول فيلم</dt><dd dir="auto">${esc(longest.title)} (${App.m(longest.id).runtime} دقيقة)</dd>` : ''}
          ${biggest ? `<dt>أكبر ملف</dt><dd dir="auto">${esc(biggest.title)} (${fmtSize(biggest.size)})</dd>` : ''}
          <dt>أفلام 4K</dt><dd>${fmtNum(qMap['2160p'] || 0)}</dd>
          <dt>بترجمة</dt><dd>${fmtNum(movies.filter(x => x.subs).length)} فيلماً</dd>
          <dt>قائمتي</dt><dd>${fmtNum(Object.keys(User.list).length)}</dd>
          <dt>قيّمت بنفسك</dt><dd>${fmtNum(Object.keys(User.rate).length)}</dd></dl></div>
      </div>`;
  };
})();
