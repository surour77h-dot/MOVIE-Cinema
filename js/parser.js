/* سينماتيك حمد — Excel library parser
   Reads the "All Movies & Series DATABASE" workbook and turns it into clean items. */
(function (root) {
  'use strict';

  const VIDEO = new Set(['.mkv', '.mp4', '.avi', '.m4v', '.wmv', '.mpg', '.mpeg', '.mov', '.ts', '.vob', '.part']);
  const SUBS = new Set(['.srt', '.ass', '.sub', '.ssa', '.vtt']);

  const SECTIONS = [
    { key: 'foreign', sheet: ['MOVIES'], kind: 'movies' },
    { key: 'arabic', sheet: ['Arabic MOVIE'], kind: 'arabic' },
    { key: 'series', sheet: ['SERIES'], kind: 'series' },
    { key: 'kids', sheet: ['MOVIES For Kids'], kind: 'movies' },
    { key: 'dubbed', sheet: ['مدبلج'], kind: 'movies' },
    { key: 'cartoon', sheet: ['مسلسلات كرتون عربية'], kind: 'cartoon' },
    { key: 'new', sheet: ['NEW Release'], kind: 'movies' }
  ];

  const norm = s => (s == null ? '' : String(s)).trim();
  const lower = s => norm(s).toLowerCase();

  function slug(s) {
    return lower(s)
      .replace(/[ً-ْ]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9؀-ۿ]+/g, '');
  }

  function findSheet(wb, names) {
    for (const n of names) if (wb.Sheets[n]) return wb.Sheets[n];
    const low = names.map(n => n.toLowerCase());
    for (const sn of wb.SheetNames) if (low.includes(sn.toLowerCase().trim())) return wb.Sheets[sn];
    return null;
  }

  function colIndex(header, tests) {
    for (let i = 0; i < header.length; i++) {
      const h = lower(header[i]);
      if (tests.some(t => (t instanceof RegExp ? t.test(h) : h === t))) return i;
    }
    return -1;
  }

  const QUALITY_RX = /(2160p|4k|uhd|1080p|1080i|720p|576p|480p|dvdrip|bdrip|brrip|webrip|hdtv)/i;
  function qualityOf(s) {
    const m = norm(s).match(QUALITY_RX);
    if (!m) return '';
    const q = m[1].toLowerCase();
    if (q === '4k' || q === 'uhd') return '2160p';
    if (q === '1080i') return '1080p';
    if (/rip|hdtv/.test(q)) return 'SD';
    return q;
  }

  // Strip noise from a title so it reads well and searches well.
  function cleanTitle(t) {
    let s = norm(t);
    if (!/\s/.test(s) && /[._]/.test(s)) s = s.replace(/[._]/g, ' ');
    s = s.replace(/_/g, ' ')
      .replace(/\b(2160p|1080p|720p|480p|4k|uhd|bluray|blu-ray|brrip|bdrip|dvdrip|webrip|web-dl|x264|x265|hevc|aac|dts|hdtv|xvid)\b.*$/i, '')
      .replace(/\s+arabic\s*$/i, '')
      .replace(/^\d{1,2}\s*-\s*(?=\S)/, '')
      .replace(/\s*[-–]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return s;
  }

  // "Dante's Peak(1997) 1080p" -> {title, year, quality}
  function parseName(raw) {
    const s = norm(raw).replace(/_/g, ' ');
    let title = s, year = null;
    let m = s.match(/^(.*?)[\s.\-]*[\(\[]((?:18|19|20)\d{2})[\)\]](.*)$/);
    if (m && m[1].trim()) { title = m[1]; year = +m[2]; }
    else {
      m = s.match(/^(.*?)[\s.]((?:19|20)\d{2})(?:[\s.].*)?$/);
      if (m && m[1].trim()) { title = m[1]; year = +m[2]; }
    }
    return { title: cleanTitle(title), year, quality: qualityOf(s) };
  }

  // The workbook splits file names into three columns: [A=last word, B=start, C=end]
  function rebuildName(a, b, c) {
    return [norm(b), norm(a), norm(c)].filter(Boolean).join(' ').replace(/\s{2,}/g, ' ');
  }

  function lastSeg(path) {
    const parts = norm(path).replace(/[\\/]+$/, '').split(/[\\/]+/);
    return parts[parts.length - 1] || '';
  }

  const GENERIC_FOLDER = /^(movies|movies for kids|مدبلج|arabic movie|new releases?|disney|video|\d{4}(-\d{4})?( movies)?)$/i;

  function makeId(sec, title, year) { return sec + ':' + slug(title) + ':' + (year || ''); }

  function rowsOf(ws, XLSX) {
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  }

  /* ---------- movie-like sheets: group files by folder ---------- */
  function parseMovies(rows, sec) {
    const h = rows[0] || [];
    const cA = colIndex(h, ['year']), cB = colIndex(h, ['name']), cC = colIndex(h, ['quality']);
    const cS = colIndex(h, [/size/]), cE = colIndex(h, [/^ext/]), cP = colIndex(h, [/folder/, /path/]);
    const folders = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const ext = lower(r[cE]); const path = norm(r[cP]);
      if (!ext || !path || !ext.startsWith('.')) continue;
      if (!folders.has(path)) folders.set(path, []);
      folders.get(path).push({ ext, size: +r[cS] || 0, name: rebuildName(r[cA], r[cB], r[cC]) });
    }
    const items = [];
    for (const [path, files] of folders) {
      const vids = files.filter(f => VIDEO.has(f.ext));
      if (!vids.length) continue;
      const subs = files.some(f => SUBS.has(f.ext));
      const folder = lastSeg(path);
      const generic = GENERIC_FOLDER.test(folder.trim());
      if (sec === 'new' && vids.length > 3 && !generic) {
        // a collection folder (e.g. Chaplin filmography) -> one item with a file list
        const p = parseName(folder);
        const eps = vids.map((v, idx) => ({ k: 'F' + (idx + 1), n: cleanTitle(v.name) || v.name, size: v.size }))
          .sort((x, y) => x.n.localeCompare(y.n, 'en', { numeric: true }));
        items.push({ id: makeId(sec, p.title, p.year), sec, type: 'collection', title: p.title, year: p.year,
          quality: p.quality, size: vids.reduce((a, v) => a + v.size, 0), subs, eps });
        continue;
      }
      if (generic) {
        for (const v of vids) {
          const p = parseName(v.name);
          items.push({ id: makeId(sec, p.title, p.year), sec, type: 'movie', title: p.title, year: p.year,
            quality: p.quality, size: v.size, subs, ext: v.ext });
        }
        continue;
      }
      let p = parseName(folder);
      if (!p.year) { const q = parseName(vids[0].name); if (q.year) p = { ...p, year: q.year }; }
      if (!p.quality) p.quality = qualityOf(vids[0].name);
      const main = vids.reduce((a, b) => (b.size > a.size ? b : a));
      items.push({ id: makeId(sec, p.title, p.year), sec, type: 'movie', title: p.title, year: p.year,
        quality: p.quality, size: main.size, subs, ext: main.ext, versions: vids.length > 1 ? vids.length : undefined });
    }
    return items;
  }

  /* ---------- Arabic movies: one row per film ---------- */
  function parseArabic(rows, sec) {
    const h = rows[0] || [];
    const cY = colIndex(h, ['year']), cN = colIndex(h, ['name']), cS = colIndex(h, [/size/]), cE = colIndex(h, [/^ext/]);
    const items = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const ext = lower(r[cE]); if (!VIDEO.has(ext)) continue;
      const ym = norm(r[cY]).match(/(18|19|20)\d{2}/);
      const title = norm(r[cN]).replace(/\s{2,}/g, ' ');
      if (!title) continue;
      const year = ym ? +ym[0] : null;
      items.push({ id: makeId(sec, title, year), sec, type: 'movie', title, year, quality: qualityOf(title),
        size: +r[cS] || 0, subs: false, ext, lang: 'ar' });
    }
    return items;
  }

  /* ---------- Series ---------- */
  function parseSeries(rows, sec) {
    const h = rows[0] || [];
    const cE = colIndex(h, ['extension', /^ext/]), cSe = colIndex(h, ['series']), cN = colIndex(h, ['name episode', /episode name|name/]);
    const cSn = colIndex(h, ['season']), cEp = colIndex(h, ['episode']), cS = colIndex(h, [/size/]);
    const map = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const ext = lower(r[cE]); const name = norm(r[cSe]); if (!name) continue;
      if (!map.has(name)) map.set(name, { vids: [], subs: new Set() });
      const s = parseInt(String(r[cSn] || '').replace(/\D/g, ''), 10) || 1;
      const e = parseInt(String(r[cEp] || '').replace(/\D/g, ''), 10) || 0;
      const k = 'S' + String(s).padStart(2, '0') + 'E' + String(e).padStart(2, '0');
      if (VIDEO.has(ext)) map.get(name).vids.push({ k, s, e, n: norm(r[cN]), size: +r[cS] || 0 });
      else if (SUBS.has(ext)) map.get(name).subs.add(k);
    }
    const items = [];
    for (const [name, g] of map) {
      if (!g.vids.length) continue;
      const seen = new Set();
      const eps = g.vids.filter(v => (seen.has(v.k) ? false : seen.add(v.k)))
        .sort((a, b) => a.s - b.s || a.e - b.e)
        .map(v => ({ ...v, sub: g.subs.has(v.k) }));
      const p = parseName(name);
      items.push({ id: makeId(sec, p.title, p.year), sec, type: 'tv', title: p.title, year: p.year, quality: '',
        size: eps.reduce((a, v) => a + v.size, 0), subs: g.subs.size > 0, eps,
        seasons: new Set(eps.map(e => e.s)).size });
    }
    return items;
  }

  /* ---------- Old Arabic cartoon series: grouped by first folder under the root ---------- */
  function parseCartoon(rows, sec) {
    const h = rows[0] || [];
    const cA = colIndex(h, ['year']), cB = colIndex(h, ['name']), cC = colIndex(h, ['quality']);
    const cS = colIndex(h, [/size/]), cE = colIndex(h, ['extension', /^ext/]), cP = colIndex(h, [/folder/, /path/]);
    const map = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const ext = lower(r[cE]); if (!VIDEO.has(ext)) continue;
      const parts = norm(r[cP]).replace(/[\\/]+$/, '').split(/[\\/]+/);
      let at = parts.findIndex(p => /كرتون/.test(p));
      const series = (at >= 0 && parts[at + 1]) ? parts[at + 1] : parts[parts.length - 1];
      if (!series) continue;
      if (!map.has(series)) map.set(series, []);
      map.get(series).push({ n: rebuildName(r[cA], r[cB], r[cC]), size: +r[cS] || 0, sub: parts.slice(at + 2).join(' / ') });
    }
    const items = [];
    for (const [series, vids] of map) {
      vids.sort((a, b) => (a.sub + ' ' + a.n).localeCompare(b.sub + ' ' + b.n, 'ar', { numeric: true }));
      const eps = vids.map((v, i) => ({ k: 'E' + (i + 1), e: i + 1, n: v.n, size: v.size, grp: /^new folder/i.test(v.sub) ? 'إضافات' : (v.sub || '') }));
      const title = series.replace(/\s*-\s*[A-Za-z].*$/, '').replace(/\s+[A-Za-z][A-Za-z\- ]+$/, '').trim() || series;
      items.push({ id: makeId(sec, title, null), sec, type: 'tv', title, year: null, quality: '',
        size: eps.reduce((a, v) => a + v.size, 0), subs: false, eps, lang: 'ar', alt: series !== title ? series : undefined });
    }
    return items;
  }

  function parseWorkbook(XLSX, data, fileName) {
    const wb = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false });
    const items = []; const report = {};
    for (const s of SECTIONS) {
      const ws = findSheet(wb, s.sheet);
      if (!ws) { report[s.key] = 0; continue; }
      const rows = rowsOf(ws, XLSX);
      let list = [];
      if (s.kind === 'movies') list = parseMovies(rows, s.key);
      else if (s.kind === 'arabic') list = parseArabic(rows, s.key);
      else if (s.kind === 'series') list = parseSeries(rows, s.key);
      else if (s.kind === 'cartoon') list = parseCartoon(rows, s.key);
      // keep ids unique
      const seen = new Map();
      for (const it of list) {
        const n = seen.get(it.id) || 0; seen.set(it.id, n + 1);
        if (n) it.id += '~' + (n + 1);
      }
      report[s.key] = list.length;
      items.push(...list);
    }
    return { items, report, fileName: fileName || '', importedAt: Date.now() };
  }

  const api = { parseWorkbook, parseName, cleanTitle, slug, qualityOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parser = api;
})(typeof window !== 'undefined' ? window : globalThis);
