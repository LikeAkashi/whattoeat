/* 吃什么 / WhatToEat — 单一流程：设需求 → 推荐 → 点开一道菜
   页面只有两个：list（首屏推荐）与 detail（一道菜）。
   设置是一个浮层，不占流程。 */
(() => {
  'use strict';

  /* ---------- constants ---------- */
  const GOALS = [
    { v: 'none', t: '随便吃' }, { v: 'fat', t: '减脂' }, { v: 'muscle', t: '增肌' },
    { v: 'sugar', t: '控糖' }, { v: 'sodium', t: '低钠' }, { v: 'stomach', t: '养胃' }
  ];
  const AVOID = ['辣', '海鲜', '牛羊肉', '素食'];
  const TASTES = ['辣', '咸香', '酸甜', '浓郁'];
  const TEXES = ['脆', '嫩', '软糯', '有嚼劲', '带汤汁'];
  const HAVE_LIST = ['鸡蛋', '番茄', '土豆', '青椒', '洋葱', '五花肉', '鸡胸肉', '牛肉', '虾', '豆腐',
    '西兰花', '包菜', '蘑菇', '面条', '米饭', '白菜', '木耳', '粉丝', '葱', '蒜', '姜'];

  const TEX_PHRASE = { 脆: '够脆', 嫩: '够嫩', 软糯: '够软糯', 有嚼劲: '有嚼劲', 带汤汁: '有汤有汁' };
  const DIFF_PHRASE = {
    1: ['不挑手艺，第一次做也稳', '食材好买，楼下超市都有', '步骤少，边做边刷手机都行'],
    2: ['调个味就行，不容易翻车', '有点工序，但成功率不低'],
    3: ['火候到位就是馆子味', '慢工出细活，周末做刚好'],
    0: ['不用洗锅，到手就吃', '不想动的时候点它最省事', '热一下就能吃，锅都不用洗']
  };
  const SENSE_FRAMES = [
    (a, b) => `${a}味打底，主打一个${b}`,
    (a, b) => `吃的是${a}，图的就是${b}`,
    (a, b) => `${a}是主调，口感${b}`,
    (a, b) => `第一口${a}，然后是${b}的底子`
  ];

  /* ---------- state ---------- */
  const KEY = 'whattoeat.prefs.v2';
  const OLD_KEY = 'whattoeat.prefs.v1';
  const DEFAULTS = { goals: [], avoid: [], taste: [], tex: [], have: [], q: '', useP: true, useF: true, sort: '' };
  let S = { view: 'list', dishId: null, shown: 12, prefs: load() };
  let poolCache = null;
  let readyCount = 0;   // 「能直接做」有几道，用来插那条灰线

  function load() {
    try {
      let raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw) {
        // 从 v1（健康目标是单选 + 冰箱在同一个面板）迁移，老用户不用重设
        const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
        raw = old ? {
          goals: old.goal && old.goal !== 'none' ? [old.goal] : [],
          avoid: old.avoid || [], taste: old.taste || [], tex: old.tex || [],
          have: old.have || [], q: ''
        } : {};
      }
      const p = Object.assign({}, DEFAULTS, raw);
      ['goals', 'avoid', 'taste', 'tex', 'have'].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
      p.q = typeof p.q === 'string' ? p.q : '';
      p.useP = p.useP !== false;
      p.useF = p.useF !== false;
      p.sort = ['time', 'ing'].includes(p.sort) ? p.sort : '';
      return p;
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S.prefs)); } catch (e) { }
  }
  function invalidate() { poolCache = null; S.shown = 12; }
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const DISHES = window.DISHES || [];
  // 真实数据可能缺字段（开源菜谱没有风味/口感/热量标注），统一补默认值，
  // 缺 kcal 或 tag 时健康分回落到中性 50，不做假判断。
  DISHES.forEach(d => {
    d.tags = d.tags || [];
    d.taste = Object.assign({ sour: 0, salt: 0, sweet: 0, spice: 0, rich: 0 }, d.taste || {});
    d.tex = Object.assign({ crisp: 0, tender: 0, soft: 0, chew: 0, soup: 0 }, d.tex || {});
    d.ing = d.ing || [];
    if (typeof d.kcal !== 'number') d.kcal = null;
    if (typeof d.time !== 'number') d.time = null;
  });
  const byId = (id) => DISHES.find(d => d.id === id);

  /* ---------- 收藏 ---------- */
  const FKEY = 'whattoeat.favs.v1';
  let FAVS = loadFavs();
  function loadFavs() {
    try {
      const a = JSON.parse(localStorage.getItem(FKEY) || '[]');
      // 数据源换了以后老收藏可能对不上，过滤掉找不到的
      return Array.isArray(a) ? a.filter(id => DISHES.some(d => d.id === id)) : [];
    } catch (e) { return []; }
  }
  function saveFavs() { try { localStorage.setItem(FKEY, JSON.stringify(FAVS)); } catch (e) { } }
  const isFav = (id) => FAVS.includes(id);
  function toggleFav(id) {
    const i = FAVS.indexOf(id);
    if (i < 0) FAVS.push(id); else FAVS.splice(i, 1);
    saveFavs();
  }

  /* ---------- 今晚就吃它 ---------- */
  // 「就它了」原来只弹个 toast，等于假确认。现在真的记下来：
  // 首屏顶部横条里攒着，最多 10 道，隔夜自动清。
  const PKEY = 'whattoeat.pick.v2';
  const PICK_MAX = 10;
  let PICK = loadPick();
  function loadPick() {
    try {
      const raw = JSON.parse(localStorage.getItem(PKEY) || '[]');
      const arr = Array.isArray(raw) ? raw : (raw && raw.id ? [raw] : []); // 兼容旧版单条
      const cut = Date.now() - 18 * 3600 * 1000;
      return arr.filter(p => p && p.at > cut && byId(p.id)).slice(0, PICK_MAX);
    } catch (e) { return []; }
  }
  function savePick() {
    try { localStorage.setItem(PKEY, JSON.stringify(PICK)); } catch (e) { }
  }
  function addPick(id) {
    PICK = [{ id: id, at: Date.now() }, ...PICK.filter(p => p.id !== id)].slice(0, PICK_MAX);
    savePick();
  }
  function removePick(id) {
    PICK = PICK.filter(p => p.id !== id);
    savePick();
  }
  function clearPick() { PICK = []; savePick(); }
  const STAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3.9c.2 0 .5.1.6.4l2.4 4.9 5.4.8c.4.1.6.4.5.8l-3.9 3.8.9 5.4c.1.4-.3.7-.7.5L12.2 18l-4.8 2.5c-.4.2-.8-.1-.7-.5l.9-5.4-3.9-3.8c-.3-.3-.1-.7.3-.8l5.4-.8 2.4-4.9c.1-.3.4-.4.6-.4z"/></svg>`;
  const strHash = (s) => [...(s || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 0);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  /* ---------- 健康 / 感官 ---------- */
  // 没设目标时不能一律给 50——那样 374 道菜排序就退化成随机。
  // 用「热量离一顿晚饭的合理区间（~550 kcal）有多远」当默认的健康维度，讲得通也不算编造。
  function kcalBalance(d) {
    if (typeof d.kcal !== 'number') return 55;
    return clamp(100 - Math.abs(d.kcal - 550) / 10, 0, 100);
  }
  function healthScore(d) {
    const gs = S.prefs.goals;
    if (!gs.length) return kcalBalance(d);
    // 多个目标同时选：各自算一遍取均值，别让某一项独大
    return gs.reduce((sum, g) => sum + oneGoal(d, g), 0) / gs.length;
  }
  function oneGoal(d, g) {
    const t = d.taste, tags = d.tags || [];
    let s = 50;
    const kcal = typeof d.kcal === 'number' ? d.kcal : null;
    // 减脂不是越低越好：一顿晚饭 250–450 kcal 最合适，太低的汤汤水水不算一顿饭
    if (g === 'fat') s += (kcal === null ? 0 : kcal < 250 ? 8 : kcal < 450 ? 22 : kcal < 620 ? 8 : -18) + (tags.includes('低脂') ? 12 : 0) - (tags.includes('高脂') ? 20 : 0);
    if (g === 'muscle') s += (tags.includes('高蛋白') ? 22 : 0) + (kcal !== null && kcal > 400 ? 6 : 0);
    if (g === 'sugar') s += (t.sweet >= 3 ? -22 : 8) + (tags.includes('高碳水') ? -16 : 0);
    if (g === 'sodium') s += (t.salt >= 4 ? -24 : 10) + (tags.includes('高钠') ? -20 : 0) + (tags.includes('清淡') ? 12 : 0);
    if (g === 'stomach') s += (t.spice >= 3 ? -20 : 6) + (tags.includes('养胃') ? 24 : 0) + (tags.includes('清淡') ? 10 : 0);
    return clamp(s, 0, 100);
  }
  function senseScore(d) {
    const p = S.prefs;
    const dims = [];
    if (p.taste.includes('辣')) dims.push(d.taste.spice * 20);
    if (p.taste.includes('咸香')) dims.push(d.taste.salt * 20);
    if (p.taste.includes('酸甜')) dims.push(((d.taste.sour + d.taste.sweet) / 2) * 20);
    if (p.taste.includes('浓郁')) dims.push(d.taste.rich * 20);
    if (p.tex.includes('脆')) dims.push(d.tex.crisp * 20);
    if (p.tex.includes('嫩')) dims.push(d.tex.tender * 20);
    if (p.tex.includes('软糯')) dims.push(d.tex.soft * 20);
    if (p.tex.includes('有嚼劲')) dims.push(d.tex.chew * 20);
    if (p.tex.includes('带汤汁')) dims.push(d.tex.soup * 20);
    if (!dims.length) return 60;
    return dims.reduce((a, b) => a + b, 0) / dims.length;
  }
  function haveCoverage(d) {
    const have = S.prefs.have;
    if (!have.length) return 60;
    if (!d.ing || !d.ing.length) return 30;
    const hit = d.ing.filter(x => have.some(h => x.n.includes(h) || h.includes(x.n))).length;
    // 只命中 1 样就给满分的话，任何带鸡蛋的菜都会霸榜；
    // 命中越多才越像「真的能做」，所以乘一个命中数的饱和系数
    return clamp((hit / d.ing.length) * Math.min(1, hit / 2) * 100, 0, 100);
  }
  function timeOf(d) {
    return typeof d.time === 'number' && d.time > 0 ? d.time : 30;
  }
  function timeFit(d) {
    // 界面上去掉了「有多少时间」：晚饭基本都想快点吃上，按 30 分钟当先验
    const lim = 30;
    const t = timeOf(d);
    if (t <= lim) return 100 - (t / lim) * 20;
    return clamp(60 - (t - lim) * 2.2, 0, 60);
  }
  // 真实菜谱里没有「烹饪时长」，用步骤条数当省事程度的替身，只参与排序、不当时间显示
  function effort(d) {
    const n = (d.cook || []).length + (d.prep || []).length + (d.cut || []).length;
    return clamp(100 - n * 6, 10, 100);
  }
  function paceFit(d) {
    return typeof d.time === 'number' && d.time > 0 ? timeFit(d) : effort(d);
  }
  function score(d) {
    // 顶栏那两个勾选框没勾时，对应的维度整个不参与排序
    const pOn = S.prefs.useP, fOn = S.prefs.useF;
    const h = pOn ? healthScore(d) : 55;
    const se = pOn ? senseScore(d) : 55;
    const hv = fOn ? haveCoverage(d) : 55;
    return h * 0.42 + se * 0.30 + hv * 0.16 + paceFit(d) * 0.12 - (pOn ? mealPenalty(d) : 0);
  }
  // 晚饭时段把早餐类往下压一点，但别压死——蒸水蛋当晚饭也很正常
  function mealPenalty(d) {
    const h = new Date().getHours();
    const dinner = h >= 15 || h < 4;
    const breakfasty = d.cat === 'breakfast' || (d.tags || []).includes('早餐');
    return dinner && breakfasty ? 7 : 0;
  }
  function blocked(d) {
    if (!S.prefs.useP) return false;
    return S.prefs.avoid.some(a => {
      const names = (d.name || '') + (d.ing || []).map(x => x.n).join('');
      if (a === '辣') return d.taste.spice >= 3;
      if (a === '海鲜') return d.cat === 'aquatic' || /虾|鱼|蟹|海鲜|蚝/.test(names);
      if (a === '牛羊肉') return /牛|羊/.test(names);
      if (a === '素食') return /肉|虾|鸡|鱼|蛋/.test(names) || d.cat === 'meat_dish' || d.cat === 'aquatic';
      return false;
    });
  }

  // 深链：装了 App 就直接跳进去搜，没装就退回网页搜索
  const APP_SCHEME = {
    bili: k => `bilibili://search?keyword=${encodeURIComponent(k)}`,
    douyin: k => `snssdk1128://search?keyword=${encodeURIComponent(k)}`,
    xhs: k => `xhsdiscover://search/result?keyword=${encodeURIComponent(k)}`
  };
  const APP_WEB = {
    bili: k => `https://search.bilibili.com/all?keyword=${encodeURIComponent(k)}`,
    douyin: k => `https://www.douyin.com/search/${encodeURIComponent(k)}?type=video`,
    xhs: k => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(k)}`
  };
  function openAppSearch(app, kw) {
    const scheme = APP_SCHEME[app] && APP_SCHEME[app](kw);
    if (!scheme) return;
    let left = false;
    const onVis = () => { if (document.hidden) left = true; };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onVis);
    try { location.href = scheme; } catch (e) { }
    setTimeout(() => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onVis);
      if (left || document.hidden) return;   // 切走了，说明跳成功了
      const web = APP_WEB[app](kw);
      try { window.open(web, '_blank'); } catch (e) { location.href = web; }
    }, 900);
  }

  /* ---------- 推荐池 ---------- */
  // 基础调料当作家家都有，不计入「还缺什么」，所以「不缺东西」= 能直接做。
  // 用显式清单而不是 includes，否则「油麦菜」会被「油」误判成调料。
  const PANTRY_RE = /^(盐|糖|白糖|冰糖|红糖|生抽|老抽|酱油|醋|白醋|陈醋|米醋|料酒|黄酒|淀粉|生粉|食用油|花生油|菜籽油|橄榄油|香油|蚝油|味精|鸡精|胡椒粉|白胡椒|黑胡椒|花椒|干辣椒|辣椒粉|豆瓣酱|芝麻|蒜|大蒜|姜|生姜|葱|小葱|水|清水)$/;
  const inFridge = (x) => S.prefs.have.some(h => x.n.includes(h) || h.includes(x.n));
  function missingOf(d) {
    return (d.ing || []).filter(x => !inFridge(x) && !PANTRY_RE.test(x.n));
  }
  function matchesQ(d, q) {
    if (!q) return true;
    const hay = [d.name || '', d.catLabel || '', d.method || '',
      (d.tags || []).join(' '), (d.ing || []).map(x => x.n).join(' ')].join(' ');
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
  }
  const byTime = (a, b) => timeOf(a) - timeOf(b);
  const byIng = (a, b) => (a.ing || []).length - (b.ing || []).length;

  function buildPool() {
    const p = S.prefs;
    const q = p.q.trim();
    // 两个勾选框都没勾、输入框也空 → 「随便」，纯随机，不掺任何偏好
    if (!p.useP && !p.useF && !q) {
      readyCount = 0;
      return DISHES
        .filter(d => !BROWSE_OUT.includes(d.cat))
        .map(d => ({ d, r: Math.random() }))
        .sort((a, b) => a.r - b.r).map(x => x.d);
    }

    const sorted = diversify(DISHES
      // 调料和饮品不算「晚饭吃什么」，但在搜索里还能搜到
      .filter(d => !blocked(d) && matchesQ(d, q) && (q || !BROWSE_OUT.includes(d.cat)))
      // 没选排序方式时掺一点随机：同样的条件每次点搜索，顺序都不一样
      .map(d => ({ d, s: score(d) + (p.sort ? 0 : Math.random() * 5) }))
      .sort((a, b) => b.s - a.s)
      .map(x => x.d));

    // 有冰箱清单才分「能直接做 / 还缺东西」，否则分不出来（全是缺的）
    if (p.useF && p.have.length) {
      const ready = [], todo = [];
      // 原料都解析不出来的菜，不能算「能直接做」，宁可放进下面那组
      const isReady = (d) => (d.ing || []).length > 0 && missingOf(d).length === 0;
      sorted.forEach(d => (isReady(d) ? ready : todo).push(d));
      const rank = p.sort === 'time' ? byTime : p.sort === 'ing' ? byIng : null;
      if (rank) { ready.sort(rank); todo.sort(rank); }
      readyCount = ready.length;
      return ready.concat(todo);
    }
    readyCount = 0;
    if (p.sort === 'time') return sorted.sort(byTime);
    if (p.sort === 'ing') return sorted.sort(byIng);
    return sorted;
  }
  // 浏览时不给：调料、饮品、甜点。它们不是「晚饭吃什么」的候选，
  // 但搜索里照样能搜到（想找蛋糕配方不会搜不到）。
  const BROWSE_OUT = ['condiment', 'drink', 'dessert'];

  // 排序出来常常一类连着好几道（全蛋类、全主食）。在 12 道的窗口内换一下，
  // 让相邻两张不同类，同时保证高分菜不会被推走太远。
  function diversify(list) {
    const out = [], rest = list.slice();
    while (rest.length) {
      const prev = out[out.length - 1];
      let pick = 0;
      if (prev) {
        const limit = Math.min(rest.length, 12);
        for (let i = 0; i < limit; i++) {
          if (rest[i].cat !== prev.cat) { pick = i; break; }
        }
      }
      out.push(rest.splice(pick, 1)[0]);
    }
    return out;
  }
  function pool() {
    if (!poolCache) poolCache = buildPool();
    return poolCache;
  }

  /* ---------- 文案 ---------- */
  const PLAIN_SENSE = [
    '步骤写得细，照着做就行',
    '原料和份量都给了，不用自己换算',
    '来自公开菜谱库，不是编的',
    '火候和时间都写清楚了，按着来不会太差'
  ];
  function hasTasteData(d) {
    return Object.values(d.taste || {}).some(v => v > 0) || Object.values(d.tex || {}).some(v => v > 0);
  }
  function whyLines(d) {
    const pool = DIFF_PHRASE[clamp(d.diff ?? 1, 0, 3)];
    const first = pool[strHash(d.id) % pool.length];
    // 没有风味/口感标注的菜，不编「第一口辣」「够脆」这种话
    if (!hasTasteData(d)) {
      return [first, PLAIN_SENSE[strHash(d.id + 's') % PLAIN_SENSE.length]];
    }
    const topTex = TEXES.slice().sort((a, b) => tVal(d, b) - tVal(d, a))[0];
    const topTaste = TASTES.slice().sort((a, b) => taVal(d, b) - taVal(d, a))[0];
    const frame = SENSE_FRAMES[strHash(d.id) % SENSE_FRAMES.length];
    return [first, frame(topTaste, TEX_PHRASE[topTex])];
  }
  function tVal(d, k) {
    return d.tex[{ 脆: 'crisp', 嫩: 'tender', 软糯: 'soft', 有嚼劲: 'chew', 带汤汁: 'soup' }[k]] || 0;
  }
  function taVal(d, k) {
    return d.taste[{ 辣: 'spice', 咸香: 'salt', 酸甜: 'sour', 浓郁: 'rich' }[k]] || 0;
  }
  function tagCls(t) {
    if (/减脂|高蛋白|低脂|低碳水|清淡|养胃|老少皆宜/.test(t)) return 'green';
    if (/辣|重口|高钠|高脂|高碳水/.test(t)) return 'warm';
    return '';
  }

  /* ---------- 组件 ---------- */
  function tagsOf(d) {
    const out = [], seen = new Set();
    const push = (txt, cls) => {
      if (!txt || seen.has(txt) || out.length >= 4) return;
      seen.add(txt); out.push(`<span class="tag ${cls || ''}">${txt}</span>`);
    };
    if (d.takeoutOnly) push('外卖', 'cool'); else push(d.method);
    if (!d.takeoutOnly && typeof d.time === 'number') push(d.time + ' 分钟');
    if (typeof d.kcal === 'number') push('约 ' + d.kcal + ' kcal');
    if (!(d.tags || []).length && d.catLabel) push(d.catLabel);
    (d.tags || []).slice(0, 2).forEach(t => push(t, tagCls(t)));
    return out.join('');
  }

  function dishCard(d, big) {
    const [w1, w2] = whyLines(d);
    return `<button class="dish ${big ? 'big' : ''} ${d.takeoutOnly ? 'cool' : ''}" data-act="open" data-id="${d.id}">
      <div class="thumb">${d.emoji || '🍽️'}</div>
      <div class="body">
        <div class="nm">${d.name}</div>
        <div class="why"><span>${w1}</span><span>${w2}</span></div>
        <div class="meta">${tagsOf(d)}</div>
      </div>
      <i class="fstar ${isFav(d.id) ? 'on' : ''}" data-act="fav" data-id="${d.id}" aria-label="收藏">${STAR}</i>
    </button>`;
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  }
  // 顶栏两个按钮上只放「有没有设过」，细节在浮层里，避免一行塞满字
  const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.4"/><path d="M4.8 20c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6"/></svg>`;
  const ICON_FRIDGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5.5" y="2.8" width="13" height="18.4" rx="2.6"/><path d="M5.5 9.6h13M8.6 5.6v1.8M8.6 12.6v2.2"/></svg>`;
  const ICON_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;

  function prefsActive() {
    const p = S.prefs;
    return p.goals.length || p.avoid.length || p.taste.length || p.tex.length;
  }

  /* ---------- list ---------- */
  const gsep = () => `<div class="gsep"><span>下面这些还缺料</span></div>`;
  function cardsFor(from, to, big0) {
    const all = pool(), out = [];
    for (let i = from; i < to; i++) {
      if (i === readyCount && readyCount > 0 && readyCount < all.length) out.push(gsep());
      out.push(dishCard(all[i], big0 && i === 0));
    }
    return out.join('');
  }
  function sortChips() {
    const s = S.prefs.sort;
    return `<div class="sorts">
      <button class="sort ${s === 'time' ? 'on' : ''}" data-act="sortTime">时间短</button>
      <button class="sort ${s === 'ing' ? 'on' : ''}" data-act="sortIng">用料少</button>
    </div>`;
  }

  function renderList() {
    const all = pool();
    const p = S.prefs;
    const q = p.q.trim();
    const haveN = p.have.length;
    // 两个勾选框都没勾、输入框也空 → 按钮变「随便」，点一下随机出
    const loose = !p.useP && !p.useF && !q;
    const asked = (p.useP && prefsActive()) || (p.useF && haveN);

    const lede = loose ? '没勾条件也没搜什么，那就随便来。'
      : q ? `「${q}」的搜索结果。`
        : asked
          ? (p.useF && haveN ? '按你的条件和冰箱里的东西排的。' : '按你的条件和口味排的。')
          : '没在按条件筛，先按好做、热量适中排。';
    const head = q ? `搜到 ${all.length} 道` : (p.useF && haveN) ? '用这些能做' : '给你挑的';

    const shown = Math.min(S.shown, all.length);
    let block;
    if (!all.length) {
      block = `<div class="empty"><div class="e">🍽️</div><p>${q ? '没搜到这道菜。' : '这些条件凑不出菜了。<br>放宽一项试试。'}</p>
        <button class="btn ghost" style="margin-top:16px" data-act="reset">清空条件</button></div>`;
    } else {
      block = `<div class="stack" id="stack">${cardsFor(0, shown, !q && !haveN)}</div>`
        + (shown < all.length
          ? `<div class="more" id="more">继续往下滑</div>`
          : `<div class="more end">一共 ${all.length} 道</div>`);
    }

    return `
      <div class="hero">
        <div class="eyebrow">${greeting()}</div>
        <h1>吃<span class="dim">什么</span></h1>
        <div class="lede">${lede}</div>
      </div>

      <div class="bar">
        <button class="bbtn ${p.useP ? 'on' : 'off'}" data-act="sheetPrefs" aria-label="个人偏好">
          <i class="cbx ${p.useP ? 'ck' : ''}" data-act="toggleP"></i>
          ${ICON_USER}
        </button>
        <button class="bbtn ${p.useF ? 'on' : 'off'}" data-act="sheetFridge" aria-label="冰箱里有什么">
          <i class="cbx ${p.useF ? 'ck' : ''}" data-act="toggleF"></i>
          ${ICON_FRIDGE}${haveN ? `<i class="cnt">${haveN}</i>` : ''}
        </button>
        <div class="sbox">
          <input id="q" type="search" inputmode="search" enterkeyhint="search"
                 placeholder="我找找" value="${esc(q)}" autocomplete="off" autocorrect="off" spellcheck="false">
          <button class="clr ${q ? 'on' : ''}" data-act="clearQ" aria-label="清空">×</button>
        </div>
        <button class="sgo" data-act="search">${loose ? '随便' : '搜索'}</button>
      </div>

      ${nowBar()}

      <div class="section pad">
        <div class="section-h">
          <h2>${head}</h2>
          <div class="sech-right">
            ${loose ? '' : sortChips()}
            <button class="fentry ${FAVS.length ? 'on' : ''}" data-act="favs" aria-label="收藏">
              ${STAR}${FAVS.length ? `<i class="fcnt">${FAVS.length}</i>` : ''}
            </button>
          </div>
        </div>
        ${block}
      </div>`;
  }

  /* ---------- 今晚吃它：定了就留在首屏，最多 10 道 ---------- */
  function nowBar() {
    if (!PICK.length) return '';
    const chips = PICK.map(p => {
      const d = byId(p.id);
      if (!d) return '';
      return `<span class="nb-chip">
        <b data-act="openPick" data-id="${d.id}">${esc(d.name)}</b>
        <i data-act="unpick" data-id="${d.id}" aria-label="去掉">×</i>
      </span>`;
    }).join('');
    if (!chips) return '';
    return `
      <div class="nowbar">
        <div class="nb-head">
          <span class="nb-tag">今晚吃它</span>
          <span class="nb-count">${PICK.length}/${PICK_MAX}</span>
          <button class="nb-clr" data-act="unpickAll">全清</button>
        </div>
        <div class="nb-list">${chips}</div>
      </div>`;
  }

  /* ---------- 收藏列表 ---------- */
  function renderFavs() {
    const list = FAVS.map(byId).filter(Boolean);
    const body = list.length
      ? `<div class="stack">${list.map(d => dishCard(d, false)).join('')}</div>`
      : `<div class="empty"><div class="e">⭐</div><p>还没收藏。<br>在卡片右上角点星星，就存下来了。</p></div>`;
    return `
      <div class="nav">
        <button class="nav-btn" data-act="back">${ICON_BACK}返回</button>
      </div>
      <div class="hero" style="padding-top:4px">
        <h1>收藏<span class="dim">的菜</span></h1>
        <div class="lede">${list.length ? `共 ${list.length} 道，点星星可以取消。` : '想做的都先攒在这儿。'}</div>
      </div>
      <div class="section pad">${body}</div>`;
  }

  /* ---------- detail ---------- */
  function ingPills(d) {
    const have = S.prefs.have;
    return (d.ing || []).map(x => {
      const owned = have.some(h => x.n.includes(h) || h.includes(x.n));
      return `<span class="need ${owned ? 'have' : ''}">${x.n}${x.q ? ' ' + x.q : ''}</span>`;
    }).join('');
  }
  function listRows(arr) {
    if (!arr || !arr.length) return '';
    return `<div class="plain-steps">${arr.map(s => `<div class="pstep">${s}</div>`).join('')}</div>`;
  }
  function cookBlock(d) {
    if (!d.cook) return '';
    return `
      <div class="section">
        <div class="section-h"><h2>烹饪</h2>${typeof d.time === 'number' ? `<span class="hint2">${d.time} 分钟</span>` : ''}</div>
        <div class="steps">${d.cook.map(s => `<div class="step"><p>${s}</p></div>`).join('')}</div>
      </div>`;
  }
  function renderDetail() {
    const d = byId(S.dishId);
    if (!d) return renderList();
    const [w1, w2] = whyLines(d);
    // 「教学」三个入口：装了 App 直接跳进去搜，没装退回网页搜索
    const kwRaw = d.name + ' 做法';

    let body;
    if (d.takeoutOnly) {
      const near = d.near ? byId(d.near.id) : null;
      const sh = d.shell || {};
      body = `
        <div class="section">
          <div class="section-h"><h2>怎么做</h2></div>
          <div class="shell-note">这道菜开源菜谱库里没有现成做法，先不瞎编。</div>
          ${sh.why || sh.idea ? `<div class="card" style="margin-top:12px">
            <div class="why-h" style="color:var(--sub);font-size:13.5px">${sh.why || '照着做也行'}</div>
            ${sh.idea ? `<div class="calc-line" style="margin-top:8px">${sh.idea}</div>` : ''}
          </div>` : ''}
          ${near ? `<button class="dish ${near.takeoutOnly ? 'cool' : ''}" data-act="open" data-id="${near.id}" style="margin-top:12px">
            <div class="thumb">${near.emoji}</div>
            <div class="body"><div class="nm">${near.name}</div>
            <div class="why"><span>${d.near.why || '做法相近，可以照着做'}</span></div></div>
          </button>` : ''}
        </div>`;
    } else {
      // 空的分段不要留标题，否则真实数据里会出现「备菜」「切菜」下面啥也没有
      const seg = (title, arr) => (arr && arr.length
        ? `<div class="section"><div class="section-h"><h2>${title}</h2></div>${listRows(arr)}</div>`
        : '');
      body = `
        <div class="section">
          <div class="section-h"><h2>买菜</h2><span class="hint2">${S.prefs.have.length ? '浅色是家里已有的' : ''}</span></div>
          <div class="needs">${ingPills(d)}</div>
          ${d.calc ? `<div class="calc-line">${d.calc}</div>` : ''}
        </div>
        ${seg('备菜', d.prep)}
        ${seg('切菜', d.cut)}
        ${cookBlock(d)}
        ${d.extra ? `<div class="callout" style="margin-top:22px"><div>💡</div><div><b>关键一步</b><br>${d.extra}</div></div>` : ''}`;
    }

    return `
      <div class="nav">
        <button class="nav-btn" data-act="back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>返回
        </button>
      </div>
      <div class="detail-hero">
        <div class="big">${d.emoji || '🍽️'}</div>
        <div>
          <h2>${d.name}</h2>
          <p>${[d.takeoutOnly ? '外卖菜' : d.method, typeof d.time === 'number' ? d.time + ' 分钟' : '', typeof d.kcal === 'number' ? '约 ' + d.kcal + ' kcal' : ''].filter(Boolean).join(' · ')}</p>
        </div>
        <i class="fstar hero-star ${isFav(d.id) ? 'on' : ''}" data-act="fav" data-id="${d.id}" aria-label="收藏">${STAR}</i>
      </div>
      <div class="pad">
        <div class="card why-card ${d.takeoutOnly ? 'cool' : ''}">
          <div class="why-h">为什么推它</div>
          <div class="why-line">${w1}</div>
          <div class="why-line">${w2}</div>
        </div>
        ${body}
        <div class="vids-app">
          <span class="va-lab">教学：</span>
          <button class="va-btn" data-act="appSearch" data-app="bili" data-kw="${esc(kwRaw)}">B 站</button>
          <button class="va-btn" data-act="appSearch" data-app="douyin" data-kw="${esc(kwRaw)}">抖音</button>
          <button class="va-btn" data-act="appSearch" data-app="xhs" data-kw="${esc(kwRaw)}">小红书</button>
        </div>
      </div>
      <div class="actionbar">
        <button class="btn ghost" data-act="back" style="flex:0 0 38%">再看看</button>
        <button class="btn" data-act="pick" data-id="${d.id}">就它了</button>
      </div>`;
  }

  /* ---------- 视图栈 ---------- */
  const stage = document.getElementById('stage');
  let curEl = null;
  let busy = false;

  function viewHTML() {
    return S.view === 'detail' ? renderDetail() : S.view === 'favs' ? renderFavs() : renderList();
  }

  function paint(animate, dir) {
    const el = document.createElement('div');
    el.className = 'view' + (animate ? (dir === 'back' ? ' back-enter' : ' off-right') : '');
    el.innerHTML = viewHTML();
    stage.appendChild(el);
    const old = curEl;
    curEl = el;
    el.scrollTop = 0;
    if (!animate) { if (old) old.remove(); return; }
    requestAnimationFrame(() => {
      el.classList.remove('off-right', 'back-enter');
      if (old) old.classList.add(dir === 'back' ? 'leaving' : 'off-left');
      setTimeout(() => { if (old && old.parentNode) old.remove(); busy = false; }, 460);
    });
    el.addEventListener('scroll', () => {
      const nav = el.querySelector('.nav');
      if (nav) nav.classList.toggle('stuck', el.scrollTop > 4);
      if (S.view === 'list') loadMore(el);
    }, { passive: true });
  }

  // 往下滑加载新的：一次 12 道，滑到底部前 400px 就开始补
  const PAGE = 12;
  function loadMore(el) {
    const all = pool();
    if (S.shown >= all.length) return;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 400) return;
    const next = all.slice(S.shown, S.shown + PAGE);
    if (!next.length) return;
    const from = S.shown;
    S.shown += next.length;
    const stack = el.querySelector('#stack');
    if (stack) stack.insertAdjacentHTML('beforeend', cardsFor(from, from + next.length, !S.prefs.q.trim() && !S.prefs.have.length));
    const more = el.querySelector('#more');
    if (S.shown >= all.length && more) more.outerHTML = `<div class="more end">一共 ${all.length} 道</div>`;
  }

  function go(view, opts) {
    if (busy) return;
    busy = true;
    S.view = view;
    if (opts && opts.id) S.dishId = opts.id;
    paint(true, 'fwd');
    setTimeout(() => { busy = false; }, 480);
    location.hash = view === 'detail' ? 'v=detail&id=' + S.dishId : view === 'favs' ? 'v=favs' : '';
  }
  function back() {
    if (busy) return;
    busy = true;
    S.view = 'list';
    paint(true, 'back');
    setTimeout(() => { busy = false; }, 480);
    location.hash = '';
  }

  /* ---------- 浮层 ---------- */
  const scrim = document.getElementById('scrim');
  const sheet = document.getElementById('sheet');
  const sheetBody = document.getElementById('sheetBody');

  function chip(txt, on, attr, cls) {
    return `<button class="chip ${on ? 'on' : ''} ${cls || ''}" ${attr}>${txt}</button>`;
  }
  let sheetKind = 'prefs';
  function renderSheet(kind) {
    if (kind) sheetKind = kind;
    const p = S.prefs;
    const title = document.getElementById('sheetTitle');
    if (sheetKind === 'fridge') {
      title.textContent = '冰箱里有什么';
      // 列表里没有的食材，自己打进去加进来
      const extra = p.have.filter(h => !HAVE_LIST.includes(h));
      sheetBody.innerHTML = `
        <div class="sh-sec">
          <div class="sh-lab">有的勾一下<span class="sh-sub">不选也行，勾了先推能做的</span></div>
          <div class="chips">${HAVE_LIST.map(h => chip(h, p.have.includes(h), `data-have="${h}"`)).join('')}</div>
        </div>
        <div class="sh-sec">
          <div class="sh-lab">再加一样<span class="sh-sub">列表里没有的就自己打</span></div>
          <div class="addrow">
            <input id="newHave" type="text" placeholder="比如 藕、香菜、鸡腿" autocomplete="off" enterkeyhint="done">
            <button class="addbtn" data-act="addHave">添加</button>
          </div>
          ${extra.length ? `<div class="chips" style="margin-top:10px">${extra.map(h => chip(h + ' ×', true, `data-have="${h}"`)).join('')}</div>` : ''}
        </div>
        <div class="callout" style="margin-top:18px"><div>🧊</div><div>勾中的食材会在详情页标记成「已有」，买菜清单一眼看出还缺什么。</div></div>`;
    } else {
      title.textContent = '个人偏好';
      sheetBody.innerHTML = `
        <div class="sh-sec">
          <div class="sh-lab">健康目标<span class="sh-sub">可多选</span></div>
          <div class="chips">${GOALS.filter(g => g.v !== 'none').map(g => chip(g.t, p.goals.includes(g.v), `data-goal="${g.v}"`)).join('')}</div>
        </div>
        <div class="sh-sec">
          <div class="sh-lab">不吃这些<span class="sh-sub">可多选</span></div>
          <div class="chips">${AVOID.map(a => chip(a, p.avoid.includes(a), `data-avoid="${a}"`)).join('')}</div>
        </div>
        <div class="sh-sec">
          <div class="sh-lab">想吃的味道<span class="sh-sub">可多选</span></div>
          <div class="chips">${TASTES.map(t => chip(t, p.taste.includes(t), `data-taste="${t}"`)).join('')}</div>
        </div>
        <div class="sh-sec">
          <div class="sh-lab">口感偏好<span class="sh-sub">可多选</span></div>
          <div class="chips">${TEXES.map(t => chip(t, p.tex.includes(t), `data-tex="${t}"`)).join('')}</div>
        </div>
        <div class="callout" style="margin-top:18px"><div>🙈</div><div>偏好只存在这台手机上，不会上传。</div></div>`;
    }
  }
  function openSheet(kind) {
    renderSheet(kind);
    scrim.classList.add('on');
    sheet.classList.add('on');
  }
  function closeSheet() {
    scrim.classList.remove('on');
    sheet.classList.remove('on');
    invalidate();
    if (S.view === 'list') paint(false);
  }

  /* ---------- toast ---------- */
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1600);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-goal],[data-avoid],[data-taste],[data-tex],[data-have],[data-time]');
    if (!t) return;

    /* 浮层内的多选 */
    const p = S.prefs;
    if (t.dataset.goal) { toggle(p.goals, t.dataset.goal); save(); renderSheet(); return; }
    if (t.dataset.avoid) {
      toggle(p.avoid, t.dataset.avoid);
      // 「不吃辣」和「想吃辣」互斥，别同时成立
      if (t.dataset.avoid === '辣' && p.avoid.includes('辣')) p.taste = p.taste.filter(x => x !== '辣');
      save(); renderSheet(); return;
    }
    if (t.dataset.taste) {
      toggle(p.taste, t.dataset.taste);
      if (t.dataset.taste === '辣' && p.taste.includes('辣')) p.avoid = p.avoid.filter(x => x !== '辣');
      save(); renderSheet(); return;
    }
    if (t.dataset.tex) { toggle(p.tex, t.dataset.tex); save(); renderSheet(); return; }
    if (t.dataset.have) { toggle(p.have, t.dataset.have); save(); renderSheet(); return; }

    switch (t.dataset.act) {
      case 'open': go('detail', { id: t.dataset.id }); break;
      case 'back': back(); break;
      case 'favs': go('favs'); break;
      case 'fav': {
        const id = t.dataset.id;
        toggleFav(id);
        const on = isFav(id);
        // 卡片上的星星就地改状态，不整页重绘，点起来才跟手
        document.querySelectorAll(`.fstar[data-id="${id}"]`).forEach(el => el.classList.toggle('on', on));
        const fe = document.querySelector('.fentry');
        if (fe) fe.innerHTML = STAR + (FAVS.length ? `<i class="fcnt">${FAVS.length}</i>` : '');
        if (S.view === 'favs') paint(false);   // 在收藏页取消的，得把那道菜拿掉
        break;
      }
      case 'sheetPrefs': openSheet('prefs'); break;
      case 'sheetFridge': openSheet('fridge'); break;
      case 'search': runSearch(); break;
      case 'toggleP': S.prefs.useP = !S.prefs.useP; save(); invalidate(); paint(false); break;
      case 'toggleF': S.prefs.useF = !S.prefs.useF; save(); invalidate(); paint(false); break;
      case 'sortTime': S.prefs.sort = S.prefs.sort === 'time' ? '' : 'time'; save(); invalidate(); paint(false); break;
      case 'sortIng': S.prefs.sort = S.prefs.sort === 'ing' ? '' : 'ing'; save(); invalidate(); paint(false); break;
      case 'clearQ': {
        const inp = document.getElementById('q');
        if (inp) inp.value = '';
        S.prefs.q = ''; save(); invalidate(); paint(false);
        break;
      }
      case 'addHave': {
        const inp = document.getElementById('newHave');
        const v = inp ? inp.value.trim() : '';
        if (!v) { toast('先打点字'); break; }
        if (S.prefs.have.includes(v)) { toast('已经有了'); break; }
        S.prefs.have.push(v);
        if (!S.prefs.useF) S.prefs.useF = true;   // 加了东西就把冰箱勾上，不然加了没反应
        save(); renderSheet('fridge');
        if (inp) inp.value = '';
        break;
      }
      case 'reset':
        S.prefs = Object.assign({}, DEFAULTS); save(); invalidate(); paint(false); break;
      case 'pick': {
        const d = byId(t.dataset.id);
        if (!d) break;
        addPick(d.id);
        toast(PICK.length > 1 ? `记下了 · 第 ${PICK.length} 道` : '今晚就吃它 · ' + d.name);
        setTimeout(() => { back(); paint(false); }, 420);
        break;
      }
      case 'unpick': removePick(t.dataset.id); paint(false); break;
      case 'unpickAll': clearPick(); paint(false); toast('清空了'); break;
      case 'openPick': if (t.dataset.id) go('detail', { id: t.dataset.id }); break;
      case 'appSearch': openAppSearch(t.dataset.app, t.dataset.kw); break;
    }
  });

  // 搜索：输入框回车 / 点「搜索」都算，条件是「个人 + 冰箱 + 关键词」三者叠加
  function runSearch() {
    const input = document.getElementById('q');
    S.prefs.q = input ? input.value.trim() : '';
    save();
    invalidate();
    if (S.view !== 'list') { S.view = 'list'; location.hash = ''; }
    paint(false);
    const top = stage.querySelector('.view');
    if (top) top.scrollTop = 0;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target) return;
    if (e.target.id === 'q') { e.preventDefault(); e.target.blur(); runSearch(); }
    if (e.target.id === 'newHave') {
      e.preventDefault();
      const b = document.querySelector('[data-act="addHave"]');
      if (b) b.click();
    }
  });
  function toggle(arr, v) {
    const i = arr.indexOf(v);
    if (i < 0) arr.push(v); else arr.splice(i, 1);
  }

  // 打字时只动叉号 和 按钮文字，不整页重绘，否则输入框会失焦
  document.addEventListener('input', (e) => {
    if (!e.target || e.target.id !== 'q') return;
    const has = !!e.target.value.trim();
    const clr = document.querySelector('.clr');
    if (clr) clr.classList.toggle('on', has);
    const go = document.querySelector('.sgo');
    if (go) go.textContent = (!S.prefs.useP && !S.prefs.useF && !has) ? '随便' : '搜索';
  });

  scrim.addEventListener('click', closeSheet);
  document.getElementById('sheetClose').addEventListener('click', closeSheet);

  /* ---------- boot ---------- */
  function fromHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return;
    const q = Object.fromEntries(h.split('&').map(kv => kv.split('=')));
    if (q.v === 'detail' && q.id && byId(q.id)) { S.view = 'detail'; S.dishId = q.id; }
    else if (q.v === 'favs') S.view = 'favs';
  }
  fromHash();
  paint(false);
  // 调试钩子：控制台里 __wte.top() 能看到每道菜的分项打分
  window.__wte = {
    S, pool, score, healthScore, senseScore, haveCoverage, paceFit, missingOf,
    rebuild: () => { invalidate(); paint(false); },
    top: (n = 8) => pool().slice(0, n).map(d => ({
      name: d.name, cat: d.cat, kcal: d.kcal,
      total: +score(d).toFixed(1), health: +healthScore(d).toFixed(1),
      sense: +senseScore(d).toFixed(1), have: +haveCoverage(d).toFixed(1),
      pace: +paceFit(d).toFixed(1)
    }))
  };
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace(/^#/, '');
    if (!h && S.view === 'detail') back();
  });
})();
