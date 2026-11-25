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
  const TIMES = [{ v: 0, t: '不限' }, { v: 15, t: '15 分钟' }, { v: 30, t: '半小时' }, { v: 60, t: '一小时也行' }];
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
  const KEY = 'whattoeat.prefs.v1';
  const DEFAULTS = { goal: 'none', avoid: [], taste: [], tex: [], have: [], time: 0 };
  let S = { view: 'list', dishId: null, seed: 0, prefs: load() };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return Object.assign({}, DEFAULTS, raw);
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S.prefs)); } catch (e) { }
  }

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
    const g = S.prefs.goal;
    if (!g || g === 'none') return kcalBalance(d);
    const t = d.taste, tags = d.tags || [];
    let s = 50;
    const kcal = typeof d.kcal === 'number' ? d.kcal : null;
    if (g === 'fat') s += (kcal === null ? 0 : kcal < 300 ? 22 : kcal < 450 ? 6 : -18) + (tags.includes('低脂') ? 12 : 0) - (tags.includes('高脂') ? 20 : 0);
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
    if (!S.prefs.have.length) return 60;
    if (!d.ing) return 30;
    const have = S.prefs.have;
    const hit = d.ing.filter(x => have.some(h => x.n.includes(h) || h.includes(x.n))).length;
    return clamp((hit / d.ing.length) * 100, 0, 100);
  }
  function timeOf(d) {
    return typeof d.time === 'number' && d.time > 0 ? d.time : 30;
  }
  function timeFit(d) {
    // 没设时间时按 30 分钟兜底：晚饭大多数时候想快点吃上，先推快手家常菜
    const lim = S.prefs.time || 30;
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
  function timeFit(d) {
    // 没设时间时按 30 分钟兜底：晚饭大多数时候想快点吃上，先推快手家常菜
    const lim = S.prefs.time || 30;
    const t = timeOf(d);
    if (t <= lim) return 100 - (t / lim) * 20;
    return clamp(60 - (t - lim) * 2.2, 0, 60);
  }
  function score(d) {
    return healthScore(d) * 0.42 + senseScore(d) * 0.30 + haveCoverage(d) * 0.16 + paceFit(d) * 0.12;
  }
  function blocked(d) {
    return S.prefs.avoid.some(a => {
      const names = (d.name || '') + (d.ing || []).map(x => x.n).join('');
      if (a === '辣') return d.taste.spice >= 3;
      if (a === '海鲜') return d.cat === 'aquatic' || /虾|鱼|蟹|海鲜|蚝/.test(names);
      if (a === '牛羊肉') return /牛|羊/.test(names);
      if (a === '素食') return /肉|虾|鸡|鱼|蛋/.test(names) || d.cat === 'meat_dish' || d.cat === 'aquatic';
      return false;
    });
  }

  /* ---------- 推荐 ---------- */
  function recommend(n = 3) {
    const pool = DISHES.filter(d => !blocked(d));
    const ranked = pool
      .map(d => ({ d, s: score(d) + ((strHash(d.id + S.seed) % 100) / 100) * 6 }))
      .sort((a, b) => b.s - a.s)
      .map(x => x.d);

    // 一次三张别全是同一类：先每类取一个，不够再回填
    const picked = [], used = new Set();
    for (const d of ranked) {
      if (picked.length >= n) break;
      if (used.has(d.cat)) continue;
      used.add(d.cat); picked.push(d);
    }
    for (const d of ranked) {
      if (picked.length >= n) break;
      if (!picked.includes(d)) picked.push(d);
    }
    return picked.slice(0, n);
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
    </button>`;
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  }
  function goalLabel() {
    const g = GOALS.find(x => x.v === S.prefs.goal);
    return g ? g.t : '随便吃';
  }
  function tasteLabel() {
    const t = S.prefs.taste.concat(S.prefs.tex);
    return t.length ? t.join('·') : '没设';
  }

  /* ---------- list ---------- */
  function renderList() {
    const list = recommend(3);
    const haveN = S.prefs.have.length;
    const anyAsked = S.prefs.goal !== 'none' || S.prefs.taste.length || S.prefs.tex.length || haveN || S.prefs.time;
    const lede = anyAsked
      ? (haveN ? '按你冰箱里的东西和口味排的，点一道看成怎么做。' : '按你的条件和口味排的，点一道看成怎么做。')
      : '还没设条件，先按好做、热量适中排。点一道就能看到怎么做、怎么点。';

    let block;
    if (!list.length) {
      block = `<div class="empty"><div class="e">🍽️</div><p>这些条件凑不出菜了。<br>放宽一项试试。</p>
        <button class="btn ghost" style="margin-top:16px" data-act="reset">清空条件</button></div>`;
    } else {
      block = `<div class="stack">${list.map((d, i) => dishCard(d, i === 0)).join('')}</div>`;
    }

    return `
      <div class="hero">
        <div class="eyebrow">${greeting()}</div>
        <h1>今晚吃<span class="dim">什么</span></h1>
        <div class="lede">${lede}</div>
      </div>

      <div class="quick" style="margin-top:16px">
        <button class="qpill" data-act="sheet"><span>目标</span><b>${goalLabel()}</b></button>
        <button class="qpill" data-act="sheet"><span>味道</span><b>${tasteLabel()}</b></button>
        <button class="qpill" data-act="sheet"><span>冰箱</span><b>${haveN ? haveN + ' 样' : '未选'}</b></button>
        <button class="qpill" data-act="sheet"><span>时间</span><b>${S.prefs.time ? S.prefs.time >= 60 ? '一小时' : S.prefs.time + ' 分钟' : '不限'}</b></button>
      </div>

      <div class="section pad">
        <div class="section-h">
          <h2>${haveN ? '用这些能做' : '给你挑的'}</h2>
          <button class="link" data-act="reroll">换一批</button>
        </div>
        ${block}
      </div>

      <div class="actionbar">
        <button class="btn ghost" data-act="reroll" style="flex:0 0 44%">换一批</button>
        <button class="btn" data-act="lucky">随便来一道</button>
      </div>`;
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
  function orderCard(d) {
    const o = d.order;
    // 没有点单数据就不编价位和备注，只给一条能照做的建议
    if (!o) {
      return `<div class="card order-card">
        <div class="why-h">不想做，点它</div>
        <div class="calc-line">在外卖 App 里直接搜「${d.name}」，选销量高的那家。<br>备注写「少油少盐，不要香菜」，口味重就加一句「多放辣」。</div>
      </div>`;
    }
    return `<div class="card order-card">
      <div class="why-h">不想做，点它</div>
      <div class="frow2"><span>点什么</span><b>${o.cat || d.name}</b></div>
      <div class="frow2"><span>大致价位</span><b>${o.price || '¥25–35'}</b></div>
      <div class="frow2"><span>备注照抄</span><b>${o.note || '少油少盐，不要香菜'}</b></div>
    </div>`;
  }
  function renderDetail() {
    const d = byId(S.dishId);
    if (!d) return renderList();
    const [w1, w2] = whyLines(d);
    const vid = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(d.name + ' 做法')}`;

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
      </div>
      <div class="pad">
        <div class="card why-card ${d.takeoutOnly ? 'cool' : ''}">
          <div class="why-h">为什么推它</div>
          <div class="why-line">${w1}</div>
          <div class="why-line">${w2}</div>
        </div>
        <div style="margin-top:14px">${orderCard(d)}</div>
        ${body}
        <a class="btn ghost" style="margin-top:22px;text-decoration:none" href="${vid}" target="_blank" rel="noopener">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 5v14l11-7z"/></svg>
          看视频
        </a>
        <div class="hint2" style="text-align:center;margin-top:8px">打开小红书搜「${d.name} 做法」</div>
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

  function viewHTML() { return S.view === 'detail' ? renderDetail() : renderList(); }

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
    }, { passive: true });
  }

  function go(view, opts) {
    if (busy) return;
    busy = true;
    S.view = view;
    if (opts && opts.id) S.dishId = opts.id;
    paint(true, 'fwd');
    setTimeout(() => { busy = false; }, 480);
    location.hash = view === 'detail' ? 'v=detail&id=' + S.dishId : '';
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
  function renderSheet() {
    const p = S.prefs;
    sheetBody.innerHTML = `
      <div class="sh-sec">
        <div class="sh-lab">健康目标</div>
        <div class="chips">${GOALS.map(g => chip(g.t, p.goal === g.v, `data-goal="${g.v}"`)).join('')}</div>
      </div>
      <div class="sh-sec">
        <div class="sh-lab">不吃这些</div>
        <div class="chips">${AVOID.map(a => chip(a, p.avoid.includes(a), `data-avoid="${a}"`)).join('')}</div>
      </div>
      <div class="sh-sec">
        <div class="sh-lab">想吃的味道</div>
        <div class="chips">${TASTES.map(t => chip(t, p.taste.includes(t), `data-taste="${t}"`)).join('')}</div>
      </div>
      <div class="sh-sec">
        <div class="sh-lab">口感偏好</div>
        <div class="chips">${TEXES.map(t => chip(t, p.tex.includes(t), `data-tex="${t}"`)).join('')}</div>
      </div>
      <div class="sh-sec">
        <div class="sh-lab">冰箱里有什么<span class="sh-sub">不选也行</span></div>
        <div class="chips">${HAVE_LIST.map(h => chip(h, p.have.includes(h), `data-have="${h}"`)).join('')}</div>
      </div>
      <div class="sh-sec">
        <div class="sh-lab">有多少时间</div>
        <div class="seg">${TIMES.map(t => `<button class="${p.time === t.v ? 'on' : ''}" data-time="${t.v}">${t.t}</button>`).join('')}</div>
      </div>
      <div class="callout" style="margin-top:18px"><div>🙈</div><div>条件只存在这台手机上，不会上传。</div></div>`;
  }
  function openSheet() {
    renderSheet();
    scrim.classList.add('on');
    sheet.classList.add('on');
  }
  function closeSheet() {
    scrim.classList.remove('on');
    sheet.classList.remove('on');
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
    if (t.dataset.goal) { p.goal = t.dataset.goal; save(); renderSheet(); return; }
    if (t.dataset.avoid) {
      toggle(p.avoid, t.dataset.avoid);
      if (t.dataset.avoid === '辣') p.taste = p.taste.filter(x => x !== '辣');
      save(); renderSheet(); return;
    }
    if (t.dataset.taste) {
      toggle(p.taste, t.dataset.taste);
      if (t.dataset.taste === '辣') p.avoid = p.avoid.filter(x => x !== '辣');
      save(); renderSheet(); return;
    }
    if (t.dataset.tex) { toggle(p.tex, t.dataset.tex); save(); renderSheet(); return; }
    if (t.dataset.have) { toggle(p.have, t.dataset.have); save(); renderSheet(); return; }
    if (t.dataset.time) { p.time = +t.dataset.time; save(); renderSheet(); return; }

    switch (t.dataset.act) {
      case 'open': go('detail', { id: t.dataset.id }); break;
      case 'back': back(); break;
      case 'sheet': openSheet(); break;
      case 'reroll': S.seed++; paint(false); break;
      case 'lucky': {
        const pool = recommend(6);
        go('detail', { id: pool[Math.floor(Math.random() * pool.length)].id });
        break;
      }
      case 'reset':
        S.prefs = Object.assign({}, DEFAULTS); save(); paint(false); break;
      case 'pick': toast('记下了 · ' + byId(t.dataset.id).name); setTimeout(back, 420); break;
    }
  });
  function toggle(arr, v) {
    const i = arr.indexOf(v);
    if (i < 0) arr.push(v); else arr.splice(i, 1);
  }

  scrim.addEventListener('click', closeSheet);
  document.getElementById('sheetClose').addEventListener('click', closeSheet);

  /* ---------- boot ---------- */
  function fromHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return;
    const q = Object.fromEntries(h.split('&').map(kv => kv.split('=')));
    if (q.v === 'detail' && q.id && byId(q.id)) { S.view = 'detail'; S.dishId = q.id; }
  }
  fromHash();
  paint(false);
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace(/^#/, '');
    if (!h && S.view === 'detail') back();
  });
})();
