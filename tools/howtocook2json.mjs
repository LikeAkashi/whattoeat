#!/usr/bin/env node
/**
 * howtocook2json.mjs —— 把 Anduin2017/HowToCook 的 markdown 菜谱转成「吃什么」用的 JSON。
 *
 * 为什么要你本机跑：这台机器没有外网，克隆不了仓库。
 *
 * 用法（在 dinner-app 目录下）：
 *   git clone --depth 1 https://github.com/Anduin2017/HowToCook.git  (随便放哪)
 *   node tools/howtocook2json.mjs --src "C:\Users\你\HowToCook" --out data/dishes.generated.js
 *
 * 可选：
 *   --json data/dishes.generated.json   同时输出纯 JSON
 *   --limit 300                         只取前 N 道（调试用）
 *
 * 真实仓库的格式（2026 年版）：
 *   文件在 dishes/<分类>/<菜名>.md，有的仍是 dishes/<分类>/<菜名>/<菜名>.md（两种都支持）
 *   `## 必备原料和工具`  用 * 列表
 *   `## 计算`            用 * 列表，且是「1 颗 油麦菜（约 200g） * 份数」这种量在前面的写法
 *   `## 操作`            用 1. 2. 3. 有序列表
 *   `## 附加内容`
 *   头部有 `预估烹饪难度：★` 和 `预估卡路里：191 大卡`
 *
 * 输出字段对齐 HowToCook 的真实结构：
 *   ing[]   ← 必备原料和工具（工具词进 tools[]），份量从「计算」段补回来
 *   calc    ← 计算里的说明文字（原料行已经变成 pill，不再重复）
 *   prep[] / cut[] / cook[]  ← 操作，按动词拆；拆不准就整句留在 cook
 *   extra   ← 附加内容
 *   diff    ← 预估烹饪难度 ★/★★/★★★ → 1/2/3
 *   kcal    ← 预估卡路里
 *
 * 源数据里没有「烹饪时长」和「风味/口感 0–5 分」，这两项留空不猜：
 * app.js 对缺 kcal/缺标注的菜做中性处理，不会编「第一口辣、回口脆」这种话。
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2);
const getArg = (k, dflt) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 ? argv[i + 1] : dflt;
};
const SRC = getArg('src', '../HowToCook');
const OUT = getArg('out', 'data/dishes.generated.js');
const OUT_JSON = getArg('json', '');
const LIMIT = +getArg('limit', 0) || Infinity;

/* ---------- 目录 → 分类 ---------- */
const CAT = {
  vegetable_dish: { cat: 'vegetable_dish', label: '蔬菜', emoji: '🥬' },
  meat_dish: { cat: 'meat_dish', label: '荤菜', emoji: '🍖' },
  aquatic: { cat: 'aquatic', label: '水产', emoji: '🦐' },
  soup: { cat: 'soup', label: '汤', emoji: '🍲' },
  staple: { cat: 'staple', label: '主食', emoji: '🍜' },
  breakfast: { cat: 'breakfast', label: '早餐', emoji: '🥣' },
  dessert: { cat: 'dessert', label: '甜点', emoji: '🍮' },
  drink: { cat: 'drink', label: '饮品', emoji: '🥤' },
  condiment: { cat: 'condiment', label: '调料', emoji: '🧂' },
  'semi-finished': { cat: 'semi-finished', label: '半成品', emoji: '🥟' }
};
const SKIP_DIRS = new Set(['template', '.github', '.git']);

/* ---------- 工具词 ---------- */
const TOOL_WORDS = /锅|铲|刀|砧板|案板|碗|盘|碟|勺|筷|擀面杖|保鲜膜|锡纸|厨房纸|量杯|温度计|筛网|打蛋器|烤箱|微波炉|电饭|空气炸|高压|蒸屉|烤盘|模具|料理机|搅拌机|破壁机/;
const TOOL_SHAPE = /^(锅|炒锅|平底锅|不粘锅|蒸锅|高压锅|电饭锅|电饭煲|空气炸锅|烤箱|微波炉|铲|锅铲|刀|菜刀|砧板|案板|碗|盘|碟|勺|汤勺|漏勺|筷|筷子|擀面杖|保鲜膜|锡纸|厨房纸|量杯|温度计|筛|打蛋器|蒸屉|烤盘|模具|料理机|搅拌机|破壁机)[\u4e00-\u9fa5]*$/;

/* ---------- 动词 → 阶段 ---------- */
const CUT_RE = /切|剁|改刀|拍碎|拍扁|剥|去壳|去蒂|去籽|撕|片成|切丝|切块|切段|切末|切片/;
const PREP_RE = /洗|泡|腌|浸|焯|飞水|打散|解冻|淘|沥|控水|备用|静置|醒|揉|过水|冲洗|擦干/;

/* ---------- 份量 ---------- */
const UNIT = '(?:g|kg|克|千克|斤|两|ml|毫升|L|升|个|根|片|瓣|颗|只|条|把|勺|汤匙|茶匙|杯|撮|块|张|朵|粒|头|段|袋|盒|罐|片|适量|少许)';
const QTY = `[0-9]+(?:\\.[0-9]+)?(?:\\s*[-–~]\\s*[0-9]+(?:\\.[0-9]+)?)?\\s*${UNIT}`;
const ITEM = /^(?:[-*+]|\d+[.)、])\s+/;

function cleanLine(s) {
  return s
    .replace(ITEM, '')
    .replace(/\*\s*份数\s*$/g, '')
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')          // 源数据大量用 `青椒` 这类行内代码，去掉反引号
    .replace(/\s+/g, ' ')
    .trim();
}

/** `1 颗 油麦菜` / `西红柿 2 个` / `盐` → { n, q } */
function splitNameQty(body) {
  const s = cleanLine(body);
  // 有的写成「猪五花肉：约(3~4 斤)」，冒号和「约」得从名字里刮掉
  const tidy = (n) => n.replace(/[：:]\s*约?\s*$/, '').replace(/^约\s*/, '').replace(/[：:]+$/, '').trim();
  const lead = s.match(new RegExp(`^(${QTY})\\s+(.+)$`));
  if (lead) {
    const rest = lead[2].trim();
    if (rest && !new RegExp(`^${UNIT}$`).test(rest)) return { n: tidy(rest), q: lead[1].trim() };
  }
  const tail = s.match(new RegExp(`^(.+?)\\s+(${QTY})$`));
  if (tail) return { n: tidy(tail[1]), q: tail[2].trim() };
  return { n: tidy(s), q: '' };
}

/* ---------- 单文件解析 ---------- */
function parseMd(text, fileRel) {
  const lines = text.split(/\r?\n/);
  let name = '';
  let diff = null;
  let kcal = null;
  const secs = {};
  let cur = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^#\s+/.test(line) && !name) {
      name = line.replace(/^#\s+/, '').replace(/\s*的做法\s*$/, '').trim();
      continue;
    }
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      const t = h[1];
      if (/必备原料/.test(t)) cur = 'ing';
      else if (/计算/.test(t)) cur = 'calc';
      else if (/操作/.test(t)) cur = 'step';
      else if (/附加内容/.test(t)) cur = 'extra';
      else cur = null;
      if (cur) secs[cur] = secs[cur] || [];
      continue;
    }
    const dm = line.match(/预估烹饪难度[:：]\s*(★+|\d)/);
    if (dm) diff = Math.min(dm[1] === '一' ? 1 : dm[1].length || +dm[1] || 1, 3);
    const km = line.match(/预估卡路里[:：]\s*([0-9]+)/);
    if (km) kcal = +km[1];

    if (!cur) continue;
    // 源数据大量用 `青椒` 这类行内代码和 **加粗**，收集时就洗掉，别让它显示到界面上
    const plain = (s) => s.replace(ITEM, '').replace(/`/g, '').replace(/\*\*/g, '').trim();
    if (ITEM.test(line)) secs[cur].push(plain(line));
    else if (line.trim() && !/^!\[/.test(line) && !/^\|/.test(line)) secs[cur].push(plain(line.trim()));
  }

  /* 原料 / 工具：真实数据的列表里会混进长句、链接、工具名，先洗一遍 */
  const rawIng = (secs.ing || []).filter(s => s && s.length <= 24 && !/[。，?？]|\[|（|\(/.test(s) || /（[^）]*）/.test(s) && s.length <= 24);
  const isTool = (s) => TOOL_WORDS.test(s) && s.length <= 10;
  const ingLines = rawIng.filter(s => !isTool(s));
  const tools = rawIng.filter(isTool);
  const ing = ingLines.map(s => splitNameQty(s)).filter(x => x.n && x.n.length <= 16);

  /* 份量回填：从「计算」段里找带这个原料名的行 */
  const calcLines = (secs.calc || []).slice();
  for (const x of ing) {
    if (x.q) continue;
    const hit = calcLines.find(l => cleanLine(l).includes(x.n));
    if (!hit) continue;
    const parsed = splitNameQty(hit);
    if (parsed.q && (parsed.n.includes(x.n) || x.n.includes(parsed.n) || parsed.n === x.n)) x.q = parsed.q;
  }

  /* 「必备原料」在部分菜谱里写得不全（实测空气炸锅照烧鸡饭只写了酱油和糖，
     鸡肉只在「计算」段里），而计算段是按份量列的、更可靠，缺的从那里补回来 */
  for (const l of calcLines) {
    const parsed = splitNameQty(cleanLine(l));
    if (!parsed.n || !parsed.q || parsed.n.length > 16) continue;
    if (isTool(parsed.n) || /[。！？]/.test(parsed.n)) continue;
    if (ing.some(x => x.n.includes(parsed.n) || parsed.n.includes(x.n))) continue;
    ing.push({ n: parsed.n, q: parsed.q });
  }

  /* 有的菜谱把几样原料挤在一行（「大葱、姜、大蒜、干辣椒」），拆开才数得清用料 */
  const flat = [];
  for (const x of ing) {
    const parts = x.n.split(/[、,，;；]/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) parts.forEach(p => flat.push({ n: p, q: x.q }));
    else flat.push(x);
  }
  const uniq = [];
  for (const x of flat) if (!uniq.some(y => y.n === x.n)) uniq.push(x);
  ing.length = 0;
  ing.push(...uniq);

  /* 说明文字：把原料行剔掉，别和 pill 重复 */
  const calcProse = calcLines
    .map(cleanLine)
    .filter(l => l && l.length > 3 && !/[：:]$/.test(l) && !ing.some(x => l.includes(x.n)))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join('\n');

  /* 操作分三段：只拆「短句、单一动作」的步骤。
     真实菜谱的步骤常常一句话里好几个动作，硬拆会把整句挪走、烹饪流程断掉，
     那种就留在 cook 里，宁可粗一点也不拆错。 */
  const steps = secs.step || [];
  const prep = [], cut = [], cook = [];
  const simple = (s) => s.length <= 26 && (s.match(/[，,]/g) || []).length <= 1;
  for (const s of steps) {
    if (simple(s) && CUT_RE.test(s)) cut.push(s);
    else if (simple(s) && PREP_RE.test(s)) prep.push(s);
    else cook.push(s);
  }

  const dir = fileRel.split(/[\\/]/)[0];
  const c = CAT[dir] || { cat: dir, label: dir, emoji: '🍽️' };

  return {
    id: fileRel.replace(/\.md$/i, '').replace(/[\\/]/g, '-'),
    name: name || basename(fileRel, '.md'),
    emoji: c.emoji,
    cat: c.cat,
    catLabel: c.label,
    method: guessMethod(name, steps),
    time: null,
    kcal,
    diff,
    tags: [],
    taste: null,
    tex: null,
    tools,
    ing,
    calc: calcProse,
    prep,
    cut,
    cook,
    extra: mdToText((secs.extra || [])
      .filter(s => !/本指南|Issue|Pull request|欢迎贡献|开源社区/.test(s))
      .join('\n')),
    src: 'HowToCook/' + fileRel.replace(/\\/g, '/')
  };
}

function guessMethod(name, steps) {
  // 先看菜名（「水煮鱼」不该因为步骤里有炒就算炒），再看步骤
  const byName = [
    ['凉拌', /凉拌|拌/], ['蒸', /蒸/], ['炖', /炖/], ['焖', /焖/], ['烤', /烤|焗/],
    ['炸', /炸/], ['煎', /煎/], ['炒', /炒|爆/], ['烧', /红烧|烧/], ['煮', /水煮|煮|汤/]
  ];
  for (const [n, re] of byName) if (re.test(name || '')) return n;
  const all = steps.join('');
  const table = [
    ['炖', /炖/], ['焖', /焖/], ['烧', /红烧|烧/], ['蒸', /蒸/], ['炒', /炒|爆炒|翻炒/],
    ['煎', /煎/], ['炸', /炸/], ['烤', /烤|焗/], ['拌', /拌/], ['煮', /煮|汆|烫|焯/]
  ];
  for (const [n, re] of table) if (re.test(all)) return n;
  return '做';
}

/** 把 markdown 链接、标题、加粗去掉，只留能读的文字 */
function mdToText(s) {
  return s
    .split(/\r?\n/)
    .filter(l => !/^\s*#/.test(l))
    .map(l => l.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/^\s*[-*+]\s+/, '').trim())
    .filter(Boolean)
    .join('\n');
}

/* ---------- 遍历 ---------- */
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(f)) continue;
      walk(p, out);
    } else if (/\.md$/i.test(f) && !/^README/i.test(f)) {
      out.push(p);
    }
  }
  return out;
}

/* ---------- 主流程 ---------- */
const dishesDir = join(SRC, 'dishes');
let files;
try {
  files = walk(dishesDir);
} catch {
  console.error(`读不到 ${dishesDir}\n先 git clone --depth 1 https://github.com/Anduin2017/HowToCook.git`);
  process.exit(1);
}
files.sort();

const dishes = [];
let skipped = 0;
for (const f of files) {
  if (dishes.length >= LIMIT) break;
  try {
    const d = parseMd(readFileSync(f, 'utf8'), relative(dishesDir, f));
    if (!d.ing.length && !d.cook.length && !d.prep.length) { skipped++; continue; }
    dishes.push(d);
  } catch {
    skipped++;
  }
}

/* ---------- 合并补充菜谱（additions/，与上游同格式）---------- */
const EXTRA = getArg('extra', '');
let extraAdded = 0, extraDup = 0;
if (EXTRA) {
  const seen = new Set(dishes.map(d => d.name));
  let extraFiles = [];
  try {
    extraFiles = walk(EXTRA).sort();
  } catch {
    console.warn(`⚠️  读不到补充目录 ${EXTRA}，跳过`);
  }
  for (const f of extraFiles) {
    try {
      const d = parseMd(readFileSync(f, 'utf8'), relative(EXTRA, f));
      if (!d.ing.length || !d.cook.length) continue;
      if (seen.has(d.name)) { extraDup++; continue; }
      seen.add(d.name);
      dishes.push(d);
      extraAdded++;
    } catch {
      skipped++;
    }
  }
}

const meta = {
  generated: new Date().toISOString(),
  source: 'Anduin2017/HowToCook',
  license: 'Unlicense（公有领域，可自由分发）',
  url: 'https://github.com/Anduin2017/HowToCook',
  extra: EXTRA ? { dir: 'additions/', count: extraAdded, license: '与上游同许可（Unlicense）' } : null,
  total: dishes.length,
  note: 'time / taste / tex / tags 源数据里没有，留空不猜；app 对缺失值是中性处理。'
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `/* 由 tools/howtocook2json.mjs 生成 ${meta.generated}\n` +
  `   数据源 ${meta.source}（${meta.license}）\n` +
  `   共 ${dishes.length} 道 */\n` +
  `window.DISHES_META = ${JSON.stringify(meta, null, 2)};\n` +
  `window.DISHES_GENERATED = ${JSON.stringify(dishes, null, 2)};\n`,
  'utf8'
);
if (OUT_JSON) {
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify({ meta, dishes }, null, 2), 'utf8');
}

const byCat = {};
for (const d of dishes) byCat[d.catLabel] = (byCat[d.catLabel] || 0) + 1;
const noIng = dishes.filter(d => !d.ing.length).length;
const noStep = dishes.filter(d => !d.cook.length && !d.prep.length && !d.cut.length).length;
const noKcal = dishes.filter(d => d.kcal === null).length;

console.log(`✅ ${dishes.length} 道 → ${OUT}${OUT_JSON ? ' / ' + OUT_JSON : ''}`);
console.log('   分类：' + Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`   缺原料 ${noIng} · 缺操作 ${noStep} · 缺热量 ${noKcal} · 跳过 ${skipped}`);
