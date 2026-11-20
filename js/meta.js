/* Online metadata: TMDB (posters, cast, trailers, collections) + OMDb (official IMDb rating) */
(function () {
  'use strict';
  const TMDB = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/';
  const OMDB = 'https://www.omdbapi.com/';
  const OMDB_DAILY = 950;

  const GENRES = {
    28: 'أكشن', 12: 'مغامرة', 16: 'رسوم متحركة', 35: 'كوميديا', 80: 'جريمة', 99: 'وثائقي', 18: 'دراما',
    10751: 'عائلي', 14: 'فانتازيا', 36: 'تاريخي', 27: 'رعب', 10402: 'موسيقى', 9648: 'غموض', 10749: 'رومانسي',
    878: 'خيال علمي', 10770: 'فيلم تلفزيوني', 53: 'إثارة', 10752: 'حرب', 37: 'غربي',
    10759: 'أكشن ومغامرة', 10762: 'أطفال', 10763: 'أخبار', 10764: 'واقع', 10765: 'خيال علمي وفانتازيا',
    10766: 'مسلسل طويل', 10767: 'حوارات', 10768: 'حرب وسياسة'
  };
  const OMDB_GENRES = {
    Action: 'أكشن', Adventure: 'مغامرة', Animation: 'رسوم متحركة', Comedy: 'كوميديا', Crime: 'جريمة',
    Documentary: 'وثائقي', Drama: 'دراما', Family: 'عائلي', Fantasy: 'فانتازيا', History: 'تاريخي', Horror: 'رعب',
    Music: 'موسيقى', Musical: 'موسيقى', Mystery: 'غموض', Romance: 'رومانسي', 'Sci-Fi': 'خيال علمي', Thriller: 'إثارة',
    War: 'حرب', Western: 'غربي', Biography: 'سيرة ذاتية', Sport: 'رياضة', Short: 'قصير', 'Film-Noir': 'نوار'
  };

  const keys = () => ({ tmdb: (Settings.get('tmdbKey', '') || '').trim(), omdb: (Settings.get('omdbKey', '') || '').trim() });
  const hasKeys = () => { const k = keys(); return !!(k.tmdb || k.omdb); };

  async function tmdb(path, params = {}) {
    const k = keys().tmdb; if (!k) throw new Error('no-tmdb');
    const u = new URL(TMDB + path);
    const headers = { accept: 'application/json' };
    if (k.length > 40) headers.Authorization = 'Bearer ' + k; else u.searchParams.set('api_key', k);
    for (const [a, b] of Object.entries(params)) if (b != null && b !== '') u.searchParams.set(a, b);
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(u, { headers });
      if (r.status === 429) { await sleep(1200 * (attempt + 1)); continue; }
      if (r.status === 401) throw new Error('tmdb-401');
      if (!r.ok) throw new Error('tmdb-' + r.status);
      return r.json();
    }
    throw new Error('tmdb-429');
  }

  function omdbBudget() {
    const d = new Date().toISOString().slice(0, 10);
    const b = Settings.get('omdbBudget', { d, n: 0 });
    if (b.d !== d) return { d, n: 0 };
    return b;
  }
  function omdbLeft() { return OMDB_DAILY - omdbBudget().n; }
  async function omdb(params) {
    const k = keys().omdb; if (!k) throw new Error('no-omdb');
    const b = omdbBudget(); if (b.n >= OMDB_DAILY) throw new Error('omdb-limit');
    const u = new URL(OMDB); u.searchParams.set('apikey', k);
    for (const [a, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(a, v);
    const r = await fetch(u);
    b.n++; Settings.set('omdbBudget', b);
    if (r.status === 401) throw new Error('omdb-401');
    const j = await r.json();
    if (j.Response === 'False' && /invalid api key/i.test(j.Error || '')) throw new Error('omdb-401');
    if (j.Response === 'False' && /limit/i.test(j.Error || '')) { b.n = OMDB_DAILY; Settings.set('omdbBudget', b); throw new Error('omdb-limit'); }
    return j;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function searchQuery(title) {
    return title.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/[._]/g, ' ')
      .replace(/\b(part|pt)\s+(\d)/i, 'Part $2').replace(/\s{2,}/g, ' ').trim();
  }
  function isArabicItem(it) { return it.lang === 'ar' || it.sec === 'arabic' || it.sec === 'cartoon'; }

  async function tmdbSearch(it, query, year) {
    const ar = isArabicItem(it);
    const lang = ar ? 'ar' : 'en-US';
    const order = it.type === 'tv' ? (it.sec === 'cartoon' ? ['tv', 'movie'] : ['tv']) : (it.type === 'collection' ? ['movie'] : ['movie', 'tv']);
    for (const mt of order) {
      const tries = year ? [year, null] : [null];
      for (const y of tries) {
        const p = { query, language: lang, include_adult: 'false' };
        if (y) { if (mt === 'movie') p.year = y; else p.first_air_date_year = y; }
        const j = await tmdb('/search/' + mt, p);
        if (j.results && j.results.length) {
          // prefer exact-ish title and nearest year
          const q = Parser.slug(query);
          const scored = j.results.slice(0, 8).map((r, i) => {
            const t = Parser.slug(r.title || r.name || ''), o = Parser.slug(r.original_title || r.original_name || '');
            const ry = +((r.release_date || r.first_air_date || '').slice(0, 4)) || 0;
            let s = -i;
            if (t === q || o === q) s += 10;
            if (year && ry) s += Math.max(0, 5 - Math.abs(ry - year) * 2);
            s += Math.min(3, (r.vote_count || 0) / 500);
            return { r, s };
          }).sort((a, b) => b.s - a.s);
          return { id: scored[0].r.id, mt };
        }
      }
      if (it.type === 'movie' && mt === 'movie' && order.length > 1) continue;
    }
    return null;
  }

  async function tmdbDetails(id, mt, it) {
    const ar = isArabicItem(it);
    const d = await tmdb(`/${mt}/${id}`, {
      language: ar ? 'ar' : 'en-US',
      append_to_response: 'credits,videos,external_ids,translations' + (mt === 'tv' ? ',aggregate_credits' : ''),
      include_video_language: ar ? 'ar,en,null' : 'en,null'
    });
    const tr = (d.translations && d.translations.translations) || [];
    const arT = tr.find(t => t.iso_639_1 === 'ar'), enT = tr.find(t => t.iso_639_1 === 'en');
    const ov = (arT && arT.data && arT.data.overview) || d.overview || (enT && enT.data && enT.data.overview) || '';
    const credits = d.credits || {};
    const castSrc = (credits.cast && credits.cast.length ? credits.cast : ((d.aggregate_credits && d.aggregate_credits.cast) || []));
    const cast = castSrc.slice(0, 16).map(c => ({ id: c.id, name: c.name, ch: c.character || (c.roles && c.roles[0] && c.roles[0].character) || '', p: c.profile_path || '' }));
    const crew = credits.crew || [];
    let directors = crew.filter(c => c.job === 'Director').map(c => ({ id: c.id, name: c.name }));
    if (mt === 'tv' && d.created_by) directors = d.created_by.map(c => ({ id: c.id, name: c.name }));
    const vids = (d.videos && d.videos.results || []).filter(v => v.site === 'YouTube');
    const trailer = (vids.find(v => v.type === 'Trailer' && v.official) || vids.find(v => v.type === 'Trailer') || vids.find(v => v.type === 'Teaser') || vids[0] || {}).key || '';
    const date = d.release_date || d.first_air_date || '';
    return {
      src: 'tmdb', tmdbId: d.id, mt,
      title: d.title || d.name || '', orig: d.original_title || d.original_name || '',
      overview: ov, poster: d.poster_path ? IMG + 'w342' + d.poster_path : '', posterBig: d.poster_path ? IMG + 'w780' + d.poster_path : '',
      backdrop: d.backdrop_path ? IMG + 'w1280' + d.backdrop_path : '',
      genres: (d.genres || []).map(g => GENRES[g.id] || g.name).filter(Boolean),
      runtime: d.runtime || (d.episode_run_time && d.episode_run_time[0]) || 0,
      date, year: +date.slice(0, 4) || null,
      directors, cast,
      trailer, imdbId: d.imdb_id || (d.external_ids && d.external_ids.imdb_id) || '',
      coll: d.belongs_to_collection ? { id: d.belongs_to_collection.id, name: d.belongs_to_collection.name, poster: d.belongs_to_collection.poster_path ? IMG + 'w342' + d.belongs_to_collection.poster_path : '' } : null,
      tmdbRate: d.vote_average || 0, tmdbVotes: d.vote_count || 0,
      seasons: d.number_of_seasons || 0, episodes: d.number_of_episodes || 0,
      country: (d.production_countries || []).map(c => c.iso_3166_1).join(', ') || (d.origin_country || []).join(', '),
      fetchedAt: Date.now()
    };
  }

  function omdbToMeta(j) {
    const poster = j.Poster && j.Poster !== 'N/A' ? j.Poster : '';
    return {
      src: 'omdb', tmdbId: null, mt: j.Type === 'series' ? 'tv' : 'movie',
      title: j.Title || '', orig: '', overview: j.Plot && j.Plot !== 'N/A' ? j.Plot : '',
      poster, posterBig: poster.replace(/_SX\d+/, '_SX800'), backdrop: '',
      genres: (j.Genre || '').split(',').map(s => OMDB_GENRES[s.trim()] || s.trim()).filter(s => s && s !== 'N/A'),
      runtime: parseInt(j.Runtime, 10) || 0, date: '', year: parseInt(j.Year, 10) || null,
      directors: (j.Director || '').split(',').map(s => s.trim()).filter(s => s && s !== 'N/A').map(n => ({ id: 'n:' + n, name: n })),
      cast: (j.Actors || '').split(',').map(s => s.trim()).filter(s => s && s !== 'N/A').map(n => ({ id: 'n:' + n, name: n, ch: '', p: '' })),
      trailer: '', imdbId: j.imdbID || '', coll: null, tmdbRate: 0, tmdbVotes: 0, fetchedAt: Date.now()
    };
  }
  function applyImdb(meta, j) {
    meta.imdb = {
      rating: j.imdbRating && j.imdbRating !== 'N/A' ? +j.imdbRating : null,
      votes: j.imdbVotes && j.imdbVotes !== 'N/A' ? +String(j.imdbVotes).replace(/,/g, '') : 0,
      rated: j.Rated && j.Rated !== 'N/A' ? j.Rated : '',
      awards: j.Awards && j.Awards !== 'N/A' ? j.Awards : '',
      at: Date.now()
    };
    if (!meta.date && j.Released && j.Released !== 'N/A') {
      const d = new Date(j.Released); if (!isNaN(d)) meta.date = d.toISOString().slice(0, 10);
    }
    if ((!meta.cast || !meta.cast.length) && j.Actors && j.Actors !== 'N/A')
      meta.cast = j.Actors.split(',').map(n => ({ id: 'n:' + n.trim(), name: n.trim(), ch: '', p: '' }));
    return meta;
  }

  /* ---------- public resolver ---------- */
  const inflight = new Map();

  // level: 'basic' (TMDB only, for posters while browsing) | 'full' (adds IMDb rating via OMDb)
  function resolve(it, level = 'full', force = false) {
    const key = it.id + '|' + level + (force ? '!' : '');
    if (inflight.has(key)) return inflight.get(key);
    const p = doResolve(it, level, force).finally(() => inflight.delete(key));
    inflight.set(key, p); return p;
  }

  async function doResolve(it, level, force) {
    const k = keys();
    let meta = force ? null : App.meta[it.id];
    const over = App.overrides[it.id];
    if (meta && meta.none && !force && Date.now() - meta.fetchedAt < 7 * 864e5) return meta;
    if (meta && meta.none) meta = null;
    if (!meta) {
      if (k.tmdb) {
        let hit = over && over.tmdbId ? { id: over.tmdbId, mt: over.mt } : null;
        if (!hit) hit = await tmdbSearch(it, searchQuery(it.title), it.year);
        if (!hit && it.alt) hit = await tmdbSearch(it, searchQuery(it.alt), it.year);
        if (hit) meta = await tmdbDetails(hit.id, hit.mt, it);
      } else if (k.omdb) {
        let j = null;
        if (over && over.imdbId) j = await omdb({ i: over.imdbId, plot: 'full' });
        else {
          j = await omdb({ t: searchQuery(it.title), y: it.year || '', type: it.type === 'tv' ? 'series' : '', plot: 'full' });
          if (j.Response === 'False' && it.year) j = await omdb({ t: searchQuery(it.title), plot: 'full' });
        }
        if (j && j.Response !== 'False') meta = applyImdb(omdbToMeta(j), j);
      } else return null;
      if (!meta) meta = { none: true, fetchedAt: Date.now() };
      await save(it.id, meta);
    }
    if (level === 'full' && !meta.none && k.omdb && meta.imdbId && omdbLeft() > 0 &&
        (!meta.imdb || Date.now() - meta.imdb.at > 30 * 864e5)) {
      try { const j = await omdb({ i: meta.imdbId }); if (j.Response !== 'False') { applyImdb(meta, j); await save(it.id, meta); } }
      catch (e) { if (e.message === 'omdb-401') throw e; }
    }
    return meta;
  }

  async function save(id, meta) { App.meta[id] = meta; await DB.put('meta', id, meta); }

  async function searchCandidates(it, q) {
    const k = keys();
    if (k.tmdb) {
      const ar = isArabicItem(it); const out = [];
      for (const mt of it.type === 'tv' ? ['tv', 'movie'] : ['movie', 'tv']) {
        const j = await tmdb('/search/' + mt, { query: q, language: ar ? 'ar' : 'en-US' });
        for (const r of (j.results || []).slice(0, 10)) out.push({
          tmdbId: r.id, mt, title: r.title || r.name, orig: r.original_title || r.original_name,
          year: (r.release_date || r.first_air_date || '').slice(0, 4), poster: r.poster_path ? IMG + 'w154' + r.poster_path : ''
        });
      }
      return out;
    }
    if (k.omdb) {
      const j = await omdb({ s: q });
      return (j.Search || []).map(r => ({ imdbId: r.imdbID, mt: r.Type === 'series' ? 'tv' : 'movie', title: r.Title, year: r.Year, poster: r.Poster !== 'N/A' ? r.Poster : '' }));
    }
    return [];
  }

  async function collection(id) {
    let c = await DB.get('coll', id);
    if (c && Date.now() - c.at < 14 * 864e5) return c;
    const j = await tmdb('/collection/' + id, { language: 'en-US' });
    c = { id, name: j.name, overview: j.overview, poster: j.poster_path ? IMG + 'w342' + j.poster_path : '', backdrop: j.backdrop_path ? IMG + 'w1280' + j.backdrop_path : '',
      parts: (j.parts || []).filter(p => p.release_date).sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
        .map(p => ({ id: p.id, title: p.title, year: (p.release_date || '').slice(0, 4), poster: p.poster_path ? IMG + 'w342' + p.poster_path : '' })), at: Date.now() };
    await DB.put('coll', id, c); return c;
  }

  async function person(id) {
    let p = await DB.get('person', id);
    if (p) return p;
    let j = await tmdb('/person/' + id, { language: 'ar' });
    let bio = j.biography;
    if (!bio) { const e = await tmdb('/person/' + id, { language: 'en-US' }); bio = e.biography; }
    p = { id, name: j.name, bio: bio || '', photo: j.profile_path ? IMG + 'w342' + j.profile_path : '', born: j.birthday || '', died: j.deathday || '', place: j.place_of_birth || '', job: j.known_for_department || '' };
    await DB.put('person', id, p); return p;
  }

  async function testKeys() {
    const k = keys(); const out = {};
    if (k.tmdb) { try { await tmdb('/configuration'); out.tmdb = true; } catch (e) { out.tmdb = false; } }
    if (k.omdb) { try { const j = await omdb({ i: 'tt0111161' }); out.omdb = j.Response !== 'False'; } catch (e) { out.omdb = false; } }
    return out;
  }

  window.Meta = { resolve, searchCandidates, collection, person, testKeys, hasKeys, keys, omdbLeft, IMG, GENRES, OMDB_DAILY, save };
})();
