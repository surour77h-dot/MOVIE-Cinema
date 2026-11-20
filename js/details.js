/* Details sheet: poster, IMDb rating, cast, trailer, collection, similar, episodes, watched */
(function () {
  'use strict';
  const { $, $$, esc, fmtSize, fmtNum } = App;
  const modal = $('#modal'), sheet = $('#modalSheet');
  let cur = null, pushed = false;

  function open(id) {
    const it = App.byId[id]; if (!it) return;
    cur = it;
    if (modal.hidden) { modal.hidden = false; document.body.style.overflow = 'hidden'; if (!pushed) { history.pushState({ modal: 1 }, ''); pushed = true; } }
    render();
    sheet.scrollTop = 0;
    if (Meta.hasKeys()) {
      Meta.resolve(it, 'full').then(() => { if (cur === it) render(true); App.refreshCards(it.id); })
        .catch(e => { if (cur === it) render(true, e.message); });
    }
  }
  function close(fromNav) {
    if (modal.hidden) return;
    modal.hidden = true; sheet.innerHTML = ''; document.body.style.overflow = ''; cur = null;
    if (pushed) { pushed = false; if (!fromNav) history.back(); }
  }
  window.addEventListener('popstate', () => { if (!modal.hidden) { pushed = false; close(true); } });
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  function similar(it, n = 14) {
    const m = App.m(it.id); if (!m) return [];
    const g = new Set(m.genres || []); const cast = new Set((m.cast || []).slice(0, 6).map(c => c.id));
    const dir = new Set((m.directors || []).map(d => d.id)); const dec = App.decadeOf(App.year(it));
    const out = [];
    for (const o of App.items) {
      if (o.id === it.id) continue;
      const om = App.m(o.id); if (!om) continue;
      if (om.tmdbId && om.tmdbId === m.tmdbId) continue;
      let s = 0;
      for (const x of om.genres || []) if (g.has(x)) s += 3;
      if (m.coll && om.coll && om.coll.id === m.coll.id) s += 6;
      for (const c of (om.cast || []).slice(0, 6)) if (cast.has(c.id)) s += 2;
      for (const d of om.directors || []) if (dir.has(d.id)) s += 3;
      if (dec && App.decadeOf(App.year(o)) === dec) s += 1;
      if ((it.sec === 'arabic') === (o.sec === 'arabic')) s += 1;
      if (s >= 7) out.push({ o, s: s + (App.anyRating(o) || 0) / 10 });
    }
    return out.sort((a, b) => b.s - a.s).slice(0, n).map(x => x.o);
  }
  App.similar = similar;

  function render(updated, err) {
    const it = cur; if (!it) return;
    const m = App.m(it.id); const raw = App.meta[it.id];
    const s = App.secOf(it.sec);
    const watched = App.isWatched(it), inList = !!User.list[it.id], myRate = User.rate[it.id] || 0;
    const year = App.year(it);
    const loading = !raw && Meta.hasKeys() && !err;

    const pills = [];
    if (year) pills.push(`<span class="pill">${year}</span>`);
    if (m && m.runtime) pills.push(`<span class="pill">${it.type === 'tv' ? m.runtime + ' د/حلقة' : Math.floor(m.runtime / 60) + 'س ' + (m.runtime % 60) + 'د'}</span>`);
    if (m && m.imdb && m.imdb.rated) pills.push(`<span class="pill ltr">${esc(m.imdb.rated)}</span>`);
    if (it.quality) pills.push(`<span class="pill g">${it.quality === '2160p' ? '4K UHD' : esc(it.quality)}</span>`);
    pills.push(`<span class="pill">${fmtSize(it.size)}</span>`);
    if (it.subs) pills.push('<span class="pill ok">ترجمة ✔</span>');
    if (it.eps) pills.push(`<span class="pill">${it.seasons ? it.seasons + ' مواسم · ' : ''}${it.eps.length} حلقة</span>`);
    pills.push(`<span class="pill">${s.ic} ${s.label}</span>`);

    let rating = '';
    if (m && m.imdb && m.imdb.rating) {
      rating = `<a class="imdb" href="https://www.imdb.com/title/${esc(m.imdbId)}/" target="_blank" rel="noopener"><span class="imdb-logo">IMDb</span>
        <div><div class="score ltr">${m.imdb.rating.toFixed(1)}<small>/10</small></div><div class="votes">${fmtNum(m.imdb.votes)} تقييم</div></div></a>`;
    } else if (m && m.imdbId) {
      rating = `<a class="imdb" href="https://www.imdb.com/title/${esc(m.imdbId)}/" target="_blank" rel="noopener"><span class="imdb-logo">IMDb</span><div class="votes">${Meta.keys().omdb ? (Meta.omdbLeft() > 0 ? 'جاري جلب التقييم…' : 'انتهى رصيد اليوم — يُجلب غداً') : 'أضف مفتاح OMDb لعرض التقييم'}<br>فتح صفحة الفيلم ↗</div></a>`;
    }
    if (m && m.tmdbVotes > 20) rating += `<div class="imdb"><span class="imdb-logo" style="background:#01b4e4;color:#fff">TMDB</span><div><div class="score ltr">${m.tmdbRate.toFixed(1)}<small>/10</small></div><div class="votes">${fmtNum(m.tmdbVotes)} تقييم</div></div></div>`;
    if (m && m.imdb && m.imdb.awards) rating += `<div class="imdb" style="max-width:340px"><span style="font-size:22px">🏆</span><div class="votes ltr" style="font-size:12px">${esc(m.imdb.awards)}</div></div>`;

    const p = App.epProgress(it);
    let h = `<button class="m-close" aria-label="إغلاق" data-close>✕</button>
      <div class="m-hero" style="${m && m.backdrop ? `background-image:url('${esc(m.backdrop)}')` : ''}"></div>
      <div class="m-head">
        <div class="m-poster">${App.placeholder(it)}${m && (m.posterBig || m.poster) ? `<img src="${esc(m.posterBig || m.poster)}" alt="" style="position:relative">` : ''}</div>
        <div class="m-info">
          <h2 class="m-title" dir="auto">${esc(it.title)}</h2>
          ${m && m.orig && Parser.slug(m.orig) !== Parser.slug(it.title) ? `<div class="m-orig" dir="auto">${esc(m.orig)}</div>` : ''}
          ${m && m.genres && m.genres.length ? `<div class="m-orig">${esc(m.genres.join(' · '))}</div>` : ''}
          <div class="m-meta">${pills.join('')}</div>
        </div></div>
      <div class="m-body">
        ${loading ? '<p class="sub">⏳ جاري جلب بيانات الفيلم…</p>' : ''}
        ${err ? `<p class="sub bad-t">تعذّر جلب البيانات (${/401/.test(err) ? 'المفتاح غير صحيح' : /limit/.test(err) ? 'انتهى رصيد اليوم' : 'تحقق من الإنترنت'})</p>` : ''}
        ${!Meta.hasKeys() && !m ? '<p class="sub">أضف مفتاح OMDb أو TMDB من <a href="#/settings" style="color:var(--gold)">الإعدادات</a> لعرض البوستر والتقييم والممثلين.</p>' : ''}
        ${raw && raw.none ? '<p class="sub">لم يُعثر على هذا العنوان تلقائياً — استخدم «تصحيح المطابقة».</p>' : ''}
        ${rating ? `<div class="ratings">${rating}</div>` : ''}
        <div class="actions">
          <button class="act${watched ? ' on' : ''}" data-act="watch">${watched ? '✓ شاهدته' : '👁️ شاهدته؟'}</button>
          <button class="act${inList ? ' on2' : ''}" data-act="list">${inList ? '📌 في قائمتي' : '➕ قائمتي'}</button>
          ${m && m.trailer ? '<button class="act" data-act="trailer">🎥 الإعلان</button>' : ''}
          ${Meta.hasKeys() ? '<button class="act" data-act="fix">🔧 تصحيح المطابقة</button>' : ''}
        </div>
        <div class="field" style="margin-top:-6px"><span class="sub" style="margin:0">تقييمي:</span>
          <div class="stars">${Array.from({ length: 10 }, (_, i) => `<button data-rate="${i + 1}" class="${i < myRate ? 'on' : ''}">★</button>`).join('')}</div>
          ${myRate ? `<b>${myRate}/10</b>` : ''}</div>
        <div id="trailerBox"></div><div id="fixBox"></div>`;

    if (m && m.overview) h += `<p class="overview" dir="auto">${esc(m.overview)}</p>`;
    const kv = [];
    if (m && m.directors && m.directors.length) kv.push([it.type === 'tv' ? 'من إنشاء' : 'إخراج', m.directors.map(d => `<a data-person="${esc(d.id)}" style="color:var(--gold);cursor:pointer">${esc(d.name)}</a>`).join('، ')]);
    if (m && m.date) kv.push(['تاريخ الإصدار', new Date(m.date).toLocaleDateString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' })]);
    if (m && m.country) kv.push(['البلد', esc(m.country)]);
    if (m && m.seasons) kv.push(['المسلسل كاملاً', `${m.seasons} مواسم · ${m.episodes} حلقة (عندك ${it.eps ? it.eps.length : 0})`]);
    if (it.versions) kv.push(['نسخ', it.versions + ' ملفات فيديو']);
    if (kv.length) h += `<dl class="kv">${kv.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`;

    if (m && m.cast && m.cast.length) {
      h += `<h2 class="sec">🎭 الممثلون</h2><div class="cast">${m.cast.map(c => `<div class="person" data-person="${esc(c.id)}">
        <div class="ph-face">${c.p ? `<img src="${Meta.IMG}w185${esc(c.p)}" alt="" loading="lazy">` : '👤'}</div>
        <b class="ltr">${esc(c.name)}</b>${c.ch ? `<small class="ltr">${esc(c.ch)}</small>` : ''}</div>`).join('')}</div>`;
    }
    if (m && m.coll) h += `<div class="coll" id="collBox"><b>🔗 ${esc(m.coll.name)}</b><p class="sub">جاري تحميل أجزاء السلسلة…</p></div>`;

    if (it.eps) h += episodesHTML(it, p);

    const sim = similar(it);
    if (sim.length) h += `<h2 class="sec">🧩 مشابه من مكتبتك</h2><div class="rail">${sim.map(o => App.card(o)).join('')}</div>`;
    h += '</div>';
    const st = sheet.scrollTop;
    sheet.innerHTML = h;
    if (updated) sheet.scrollTop = st;
    if (m && m.coll) loadCollection(it, m.coll);
  }

  function episodesHTML(it, p) {
    const w = User.eps[it.id] || {};
    const groups = new Map();
    for (const e of it.eps) {
      const g = it.sec === 'series' ? 'الموسم ' + e.s : (e.grp || (it.type === 'collection' ? 'الملفات' : 'الحلقات'));
      if (!groups.has(g)) groups.set(g, []); groups.get(g).push(e);
    }
    let h = `<h2 class="sec">📺 ${it.type === 'collection' ? 'الأفلام' : 'الحلقات'} <span class="more">${p.n}/${p.total} شاهدتها</span></h2><div class="eps">`;
    let gi = 0;
    for (const [g, list] of groups) {
      const n = list.filter(e => w[e.k]).length; const open = groups.size === 1 || (n > 0 && n < list.length) || (gi === 0 && !p.n);
      h += `<div class="season-h" data-season="${gi}"><span>${esc(g)}</span><small>${n}/${list.length}</small>
        <button class="btn sm" data-allseason="${gi}">${n === list.length ? 'إلغاء الكل' : 'شاهدت الكل'}</button></div>
        <div data-sbody="${gi}"${open ? '' : ' hidden'}>${list.map(e => `<div class="ep"><button class="chk${w[e.k] ? ' on' : ''}" data-ep="${esc(e.k)}">${w[e.k] ? '✓' : ''}</button>
          <div class="n"><span dir="auto">${it.sec === 'series' ? `<b class="ltr">E${String(e.e).padStart(2, '0')}</b> ` : ''}${esc(e.n || e.k)}</span></div>
          <small>${fmtSize(e.size)}${e.sub ? ' · ترجمة' : ''}</small></div>`).join('')}</div>`;
      gi++;
    }
    return h + '</div>';
    }

  async function loadCollection(it, c) {
    const box = $('#collBox'); if (!box) return;
    if (!Meta.keys().tmdb) { box.remove(); return; }
    try {
      const col = await Meta.collection(c.id);
      if (cur !== it || !$('#collBox')) return;
      const owned = ownedByTmdb();
      const have = col.parts.filter(p => owned.has(p.id)).length;
      $('#collBox').innerHTML = `<b>🔗 ${esc(col.name)}</b> <span class="sub">— عندك ${have} من ${col.parts.length}</span>
        <div class="rail" style="margin-top:10px">${col.parts.map(p => {
          const o = owned.get(p.id);
          if (o) return App.card(o, { sub: p.year });
          return `<div class="card missing" style="width:104px;flex:none"><div class="poster">${p.poster ? `<img class="ok" src="${esc(p.poster)}" alt="">` : ''}</div><div class="card-t ltr">${esc(p.title)}</div><div class="card-y">${p.year}</div></div>`;
        }).join('')}</div>`;
    } catch (e) { if ($('#collBox')) $('#collBox').remove(); }
  }
  function ownedByTmdb() {
    const map = new Map();
    for (const o of App.items) { const om = App.m(o.id); if (om && om.tmdbId && om.mt === 'movie' && !map.has(om.tmdbId)) map.set(om.tmdbId, o); }
    return map;
  }
  App.ownedByTmdb = ownedByTmdb;

  /* ---------- interactions ---------- */
  sheet.addEventListener('click', async e => {
    const it = cur; if (!it) return;
    const t = e.target;
    if (t.closest('[data-close]')) { close(); return; }
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'watch') { App.setWatched(it, !App.isWatched(it)); render(true); }
      else if (a === 'list') { App.toggleList(it); render(true); }
      else if (a === 'trailer') {
        const m = App.m(it.id); const box = $('#trailerBox');
        box.innerHTML = box.innerHTML ? '' : `<div class="trailer"><iframe src="https://www.youtube-nocookie.com/embed/${esc(m.trailer)}?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe></div>`;
      } else if (a === 'fix') fixUI(it);
      return;
    }
    const r = t.closest('[data-rate]');
    if (r) { const v = +r.dataset.rate; if (User.rate[it.id] === v) delete User.rate[it.id]; else User.rate[it.id] = v; saveUser(); render(true); return; }
    const ep = t.closest('[data-ep]');
    if (ep) {
      const o = User.eps[it.id] = User.eps[it.id] || {};
      if (o[ep.dataset.ep]) delete o[ep.dataset.ep]; else o[ep.dataset.ep] = Date.now();
      const p = App.epProgress(it);
      if (p.n === p.total) User.watched[it.id] = User.watched[it.id] || Date.now(); else delete User.watched[it.id];
      saveUser(); App.refreshCards(it.id); render(true); return;
    }
    const all = t.closest('[data-allseason]');
    if (all) {
      e.stopPropagation();
      const body = sheet.querySelector(`[data-sbody="${all.dataset.allseason}"]`);
      const ks = $$('[data-ep]', body).map(b => b.dataset.ep);
      const o = User.eps[it.id] = User.eps[it.id] || {};
      const allOn = ks.every(k => o[k]);
      for (const k of ks) { if (allOn) delete o[k]; else o[k] = o[k] || Date.now(); }
      const p = App.epProgress(it);
      if (p.n === p.total) User.watched[it.id] = User.watched[it.id] || Date.now(); else delete User.watched[it.id];
      saveUser(); App.refreshCards(it.id); render(true); return;
    }
    const sh = t.closest('[data-season]');
    if (sh) { const b = sheet.querySelector(`[data-sbody="${sh.dataset.season}"]`); b.hidden = !b.hidden; return; }
    const pr = t.closest('[data-person]');
    if (pr) { location.hash = '#/actor/' + encodeURIComponent(pr.dataset.person); return; }
    const pick = t.closest('[data-pick]');
    if (pick) {
      const c = JSON.parse(pick.dataset.pick);
      App.overrides[it.id] = c; await DB.put('kv', 'overrides', App.overrides);
      $('#fixBox').innerHTML = '<p class="sub">⏳ جاري التحديث…</p>';
      try { await Meta.resolve(it, 'full', true); } catch (err) {}
      App.refreshCards(it.id); render();
      return;
    }
    const card = t.closest('.card[data-id]');
    if (card) { e.stopPropagation(); open(card.dataset.id); }
  });

  function fixUI(it) {
    const box = $('#fixBox');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="panel"><h3>🔧 اختر العنوان الصحيح</h3>
      <div class="field"><input id="fixQ" value="${esc(it.title)}" style="direction:auto"><button class="btn gold" id="fixGo">بحث</button></div>
      <div id="fixRes" class="fix-list"></div></div>`;
    const go = async () => {
      const res = $('#fixRes'); res.innerHTML = '<p class="sub">⏳ جاري البحث…</p>';
      try {
        const list = await Meta.searchCandidates(it, $('#fixQ').value.trim());
        res.innerHTML = list.length ? list.map(c => `<div class="sr-item" data-pick='${esc(JSON.stringify({ tmdbId: c.tmdbId, mt: c.mt, imdbId: c.imdbId }))}'>
          ${c.poster ? `<img src="${esc(c.poster)}" alt="">` : '<div class="ph" style="position:relative;width:38px;height:56px;background:var(--surface2)">?</div>'}
          <div><div dir="auto">${esc(c.title)}</div><small>${esc(c.year || '')} · ${c.mt === 'tv' ? 'مسلسل' : 'فيلم'}${c.orig && c.orig !== c.title ? ' · ' + esc(c.orig) : ''}</small></div></div>`).join('') : '<p class="sub">لا نتائج</p>';
      } catch (err) { res.innerHTML = '<p class="sub bad-t">تعذّر البحث</p>'; }
    };
    $('#fixGo').onclick = go; $('#fixQ').onkeydown = e => { if (e.key === 'Enter') go(); };
    go();
  }

  window.Details = { open, close };
})();
