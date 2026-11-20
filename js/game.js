/* Guess-the-movie game: blurred poster, cast photos, or release year */
(function () {
  'use strict';
  const { $, esc, shuffle, fmtNum } = App;
  const MODES = {
    poster: { ic: '🖼️', label: 'البوستر المموّه', d: 'البوستر يتضح تدريجياً — أسرع إجابة = نقاط أكثر' },
    cast: { ic: '🎭', label: 'من الممثلين', d: 'ثلاثة ممثلين من الفيلم — ما هو؟' },
    year: { ic: '📅', label: 'سنة الإصدار', d: 'تعرف الفيلم، لكن متى صدر؟' }
  };
  const ROUNDS = 10, TIME = 20;
  let G = null, timer = null;

  function poolFor(mode, secs) {
    return App.items.filter(it => secs.includes(it.sec) && it.type !== 'collection' && (() => {
      const m = App.m(it.id); if (!m || !m.poster) return false;
      if (mode === 'cast') return (m.cast || []).filter(c => c.p).length >= 3;
      if (mode === 'year') return !!App.year(it);
      return true;
    })());
  }

  App.views.game = function (view) {
    clearInterval(timer);
    const secs = App._gSecs || ['foreign', 'kids', 'dubbed'];
    const best = User.game || {};
    view.innerHTML = `<div class="game"><h1 class="page">🎮 خمّن الفيلم</h1><p class="sub">${ROUNDS} أسئلة · ${TIME} ثانية لكل سؤال · من أفلام مكتبتك</p>
      <div class="tabs" id="gSecs" style="justify-content:center">${App.SECTIONS.filter(s => !s.tv || s.key === 'series').map(s => `<button class="chip${secs.includes(s.key) ? ' on' : ''}" data-s="${s.key}">${s.ic} ${s.label}</button>`).join('')}</div>
      <div class="modes">${Object.entries(MODES).map(([k, m]) => { const n = poolFor(k, secs).length;
        return `<button class="mode" data-mode="${k}" ${n < 8 ? 'disabled style="opacity:.5"' : ''}><div class="ic">${m.ic}</div><b>${m.label}</b><small>${m.d}</small>
        <div class="sub" style="margin:8px 0 0">${n < 8 ? 'يحتاج بيانات أكثر' : fmtNum(n) + ' فيلماً'}${best[k] ? ' · أفضل نتيجة ' + best[k] : ''}</div></button>`; }).join('')}</div>
      ${poolFor('poster', secs).length < 8 ? '<div class="panel"><p>اللعبة تحتاج بوسترات الأفلام. أضف مفتاحاً واجلب البيانات من <a href="#/settings" style="color:var(--gold)">الإعدادات</a>.</p></div>' : ''}</div>`;
    $('#gSecs').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; const k = b.dataset.s;
      App._gSecs = secs.includes(k) ? secs.filter(x => x !== k) : secs.concat(k); App.route(); };
    view.querySelector('.modes').onclick = e => { const b = e.target.closest('[data-mode]'); if (b && !b.disabled) start(view, b.dataset.mode, secs); };
  };

  function start(view, mode, secs) {
    const pool = poolFor(mode, secs);
    const qs = shuffle(pool.slice()).slice(0, ROUNDS);
    G = { mode, pool, qs, i: 0, score: 0, results: [], view };
    ask();
  }

  function options(it) {
    if (G.mode === 'year') {
      const y = App.year(it); const set = new Set([y]);
      while (set.size < 4) { const d = Math.round((Math.random() * 2 - 1) * 12); if (d && y + d <= new Date().getFullYear()) set.add(y + d); }
      return shuffle([...set]).map(v => ({ v: String(v), ok: v === y }));
    }
    const m = App.m(it.id);
    const others = shuffle(G.pool.filter(o => o.id !== it.id && Parser.slug(o.title) !== Parser.slug(it.title)))
      .sort((a, b) => (App.genres(b).some(g => m.genres.includes(g)) ? 1 : 0) - (App.genres(a).some(g => m.genres.includes(g)) ? 1 : 0)).slice(0, 3);
    return shuffle([it, ...others]).map(o => ({ v: o.title, ok: o.id === it.id }));
  }

  function ask() {
    clearInterval(timer);
    const it = G.qs[G.i]; const m = App.m(it.id);
    const opts = options(it); G.opts = opts; G.t0 = Date.now(); G.done = false;
    let visual = '';
    if (G.mode === 'poster') visual = `<div class="g-poster"><img id="gImg" src="${esc(m.posterBig || m.poster)}" style="filter:blur(28px) saturate(1.2)" alt=""></div>`;
    else if (G.mode === 'cast') visual = `<div class="g-cast">${m.cast.filter(c => c.p).slice(0, 3).map(c => `<div class="person"><div class="ph-face"><img src="${Meta.IMG}w185${esc(c.p)}" alt=""></div><b class="ltr">${esc(c.name)}</b></div>`).join('')}</div>`;
    else visual = `<div class="g-poster" style="width:min(200px,50vw)"><img src="${esc(m.poster)}" alt=""></div><div class="hero-title" dir="auto" style="font-size:20px;margin-bottom:14px">${esc(it.title)}</div>`;
    G.view.innerHTML = `<div class="game">
      <div class="g-top"><span>السؤال ${G.i + 1}/${G.qs.length}</span><span>${MODES[G.mode].ic} ${MODES[G.mode].label}</span><span>⭐ ${G.score}</span></div>
      <div class="g-timer"><i id="gBar" style="width:100%"></i></div>${visual}
      <div class="g-opts">${opts.map((o, i) => `<button class="g-opt" data-o="${i}" dir="auto">${esc(o.v)}</button>`).join('')}</div>
      <p class="sub" style="margin-top:14px"><a href="javascript:void 0" onclick="App.route()" style="color:var(--muted)">إنهاء اللعبة</a></p></div>`;
    G.view.querySelector('.g-opts').onclick = e => { const b = e.target.closest('[data-o]'); if (b) answer(+b.dataset.o); };
    timer = setInterval(() => {
      const el = (Date.now() - G.t0) / 1000; const left = Math.max(0, 1 - el / TIME);
      const bar = $('#gBar'); if (!bar) { clearInterval(timer); return; }
      bar.style.width = (left * 100) + '%';
      const img = $('#gImg'); if (img) img.style.filter = `blur(${Math.max(0, 28 * (1 - el / (TIME * 0.85)))}px) saturate(1.2)`;
      if (left <= 0) answer(-1);
    }, 100);
  }

  function answer(idx) {
    if (G.done) return; G.done = true; clearInterval(timer);
    const it = G.qs[G.i]; const right = idx >= 0 && G.opts[idx].ok;
    const el = (Date.now() - G.t0) / 1000;
    const pts = right ? Math.max(10, Math.round(100 * (1 - el / TIME))) : 0;
    G.score += pts; G.results.push({ it, right, pts, pick: idx >= 0 ? G.opts[idx].v : '—' });
    const btns = G.view.querySelectorAll('.g-opt');
    G.opts.forEach((o, i) => { if (o.ok) btns[i].classList.add('right'); else if (i === idx) btns[i].classList.add('wrong'); });
    const img = $('#gImg'); if (img) img.style.filter = 'none';
    setTimeout(() => { G.i++; if (G.i < G.qs.length) ask(); else finish(); }, right ? 1100 : 1900);
  }

  function finish() {
    const best = User.game[G.mode] || 0; const isBest = G.score > best;
    if (isBest) { User.game[G.mode] = G.score; saveUser(); }
    const n = G.results.filter(r => r.right).length;
    G.view.innerHTML = `<div class="game"><h1 class="page">${n >= 8 ? '🏆' : n >= 5 ? '👏' : '🎬'} النتيجة: ${G.score} نقطة</h1>
      <p class="sub">${n} إجابات صحيحة من ${G.results.length}${isBest ? ' · 🎉 رقم قياسي جديد!' : best ? ' · أفضل نتيجة ' + best : ''}</p>
      <div class="list">${G.results.map((r, i) => { const m = App.m(r.it.id);
        return `<div class="li" data-id="${esc(r.it.id)}"><span class="rk">${r.right ? '✅' : '❌'}</span><div class="thumb"><img src="${esc(m.poster)}" alt=""></div>
        <div class="tx"><b dir="auto">${esc(r.it.title)}</b><small>${App.year(r.it) || ''}${!r.right ? ' · إجابتك: ' + esc(r.pick) : ''}</small></div><span class="end">+${r.pts}</span></div>`; }).join('')}</div>
      <div class="field" style="justify-content:center;margin-top:16px"><button class="btn gold" id="gAgain">🔁 العب مجدداً</button><a class="btn" href="#/home">الرئيسية</a></div></div>`;
    const mode = G.mode, secs = App._gSecs || ['foreign', 'kids', 'dubbed'];
    $('#gAgain').onclick = () => start(G.view, mode, secs);
  }
})();
