/* 吃什么 / WhatToEat — 演示数据
   字段刻意对齐 HowToCook 的 md 四段：
   必备原料 → ing[] ｜ 计算 → calc ｜ 操作 → prep[]/cut[]/cook[]（由 steps 拆出）｜ 附加内容 → extra
   口味/口感轴与外卖备注为离线标注字段。
   正式版由 tools/howtocook2json.mjs 从 GitHub 仓库生成。 */
window.DISHES = [
  {
    id: 'tomato-egg', name: '番茄炒蛋', emoji: '🍅', cat: 'vegetable_dish',
    method: '炒', time: 12, kcal: 230, diff: 1,
    tags: ['快手', '家常', '高蛋白'],
    taste: { sour: 3, salt: 3, sweet: 2, spice: 0, rich: 2 },
    tex: { crisp: 0, tender: 4, soft: 3, chew: 1, soup: 1 },
    ing: [{ n: '番茄', q: '2 个' }, { n: '鸡蛋', q: '3 个' }, { n: '葱', q: '1 根' }, { n: '盐', q: '3 g' }, { n: '糖', q: '2 g' }],
    calc: '两人份。番茄和鸡蛋按体积 2:1 配，鸡蛋多一点才够香。',
    prep: ['鸡蛋打散，加一小撮盐搅到看不见蛋白', '番茄去蒂，顶部划十字'],
    cut: ['番茄切 2cm 滚刀块（太小会炒成酱）', '葱切末'],
    cook: ['热锅冷油，油温六成热（筷子下去冒小泡）下蛋液', '蛋液边缘凝固就用铲子推成大块，半熟盛出', '余油下番茄，中火炒 2 分钟到出汁', '倒回鸡蛋，加盐和糖翻匀，撒葱末出锅'],
    extra: '糖只放半勺提鲜。放多了会压住番茄的酸，整道菜就腻了。',
    order: { cat: '家常菜', note: '少油，番茄多一点，不要放青椒', price: '¥18–25' }
  },
  {
    id: 'pepper-pork', name: '青椒肉丝', emoji: '🫑', cat: 'meat_dish',
    method: '炒', time: 15, kcal: 260, diff: 1,
    tags: ['快手', '下饭'],
    taste: { sour: 1, salt: 4, sweet: 1, spice: 1, rich: 3 },
    tex: { crisp: 2, tender: 3, soft: 1, chew: 3, soup: 1 },
    ing: [{ n: '青椒', q: '2 个' }, { n: '猪里脊', q: '200 g' }, { n: '生抽', q: '1 勺' }, { n: '淀粉', q: '1 小勺' }, { n: '蒜', q: '2 瓣' }],
    calc: '两人份。肉 200 g 配青椒 2 个，肉再少就只是炒青椒了。',
    prep: ['里脊切丝，加生抽、淀粉抓匀腌 10 分钟', '青椒去籽'],
    cut: ['里脊顺纹路切 0.3cm 细丝', '青椒切 0.3cm 丝，和肉丝一样粗'],
    cook: ['热锅多油，下肉丝快速划散，变色立刻盛出', '余油下蒜末爆香，下青椒大火炒 1 分钟', '倒回肉丝，加盐炒匀出锅'],
    extra: '肉丝腌过再下锅才嫩。下锅后别急着翻，停 5 秒再划散，不粘锅也不出水。',
    order: { cat: '家常小炒', note: '多放青椒，肉丝切细一点', price: '¥20–28' }
  },
  {
    id: 'cola-wings', name: '可乐鸡翅', emoji: '🍗', cat: 'meat_dish',
    method: '烧', time: 30, kcal: 380, diff: 1,
    tags: ['下饭', '宴客', '孩子爱吃'],
    taste: { sour: 0, salt: 3, sweet: 4, spice: 0, rich: 3 },
    tex: { crisp: 0, tender: 3, soft: 2, chew: 2, soup: 2 },
    ing: [{ n: '鸡翅中', q: '10 个' }, { n: '可乐', q: '330 ml' }, { n: '生抽', q: '2 勺' }, { n: '姜', q: '3 片' }],
    calc: '两人份。10 个鸡翅配一罐可乐刚好收干。',
    prep: ['鸡翅两面各划两刀，冷水下锅焯 3 分钟去血沫', '捞出冲净，擦干水分'],
    cut: ['鸡翅划刀就行，不用切开', '姜切片'],
    cook: ['锅里少油，鸡翅皮朝下小火煎到两面金黄', '下姜片、生抽，倒可乐没过鸡翅', '大火烧开转小火焖 15 分钟', '开盖大火收汁，收到浓稠挂勺'],
    extra: '收汁最后 1 分钟要一直翻，糖分高，糊锅只在几秒之间。',
    order: { cat: '快餐简餐', note: '不要辣，酱汁多一点拌饭', price: '¥25–35' }
  },
  {
    id: 'braised-pork', name: '红烧肉', emoji: '🥩', cat: 'meat_dish',
    method: '炖', time: 70, kcal: 520, diff: 3,
    tags: ['宴客', '下饭', '高脂'],
    taste: { sour: 0, salt: 4, sweet: 3, spice: 0, rich: 5 },
    tex: { crisp: 0, tender: 3, soft: 5, chew: 2, soup: 3 },
    ing: [{ n: '五花肉', q: '500 g' }, { n: '冰糖', q: '20 g' }, { n: '生抽', q: '2 勺' }, { n: '老抽', q: '半勺' }, { n: '姜', q: '4 片' }, { n: '八角', q: '1 个' }],
    calc: '三人份。肉和糖按 25:1 配，糖多了发苦。',
    prep: ['五花肉整块冷水下锅，加姜片焯 5 分钟', '捞出用温水冲净，切成 3cm 方块'],
    cut: ['五花肉切 3cm 见方，太小炖完会缩成渣', '姜切片，八角掰开'],
    cook: ['锅内少油，小火把冰糖炒到枣红色冒小泡', '下肉块翻炒上色，加生抽、老抽、八角', '加热水没过肉，大火烧开转小火炖 45 分钟', '开盖大火收汁到浓稠挂勺'],
    extra: '炒糖色是唯一会翻车的一步：糖一变色立刻下肉，晚 10 秒就苦。怕失手就用冰糖直接和肉一起炖，颜色浅一点但不会苦。',
    order: { cat: '家常菜', note: '要瘦一点的部位，饭少一点', price: '¥30–45' }
  },
  {
    id: 'garlic-broccoli', name: '蒜蓉西兰花', emoji: '🥦', cat: 'vegetable_dish',
    method: '炒', time: 10, kcal: 120, diff: 1,
    tags: ['减脂', '低脂', '快手', '清淡'],
    taste: { sour: 0, salt: 3, sweet: 1, spice: 0, rich: 1 },
    tex: { crisp: 4, tender: 2, soft: 0, chew: 2, soup: 0 },
    ing: [{ n: '西兰花', q: '1 颗' }, { n: '蒜', q: '4 瓣' }, { n: '盐', q: '3 g' }, { n: '蚝油', q: '1 勺' }],
    calc: '两人份。一颗西兰花焯完只剩一小盘，别嫌多。',
    prep: ['西兰花切小朵，淡盐水泡 5 分钟', '烧一锅水，加盐和几滴油'],
    cut: ['沿茎部切成一口大小的小朵，茎别扔，削皮切片一起炒'],
    cook: ['水开下西兰花焯 60 秒，捞出立刻过凉水', '热锅下油，蒜末小火炒香', '下西兰花大火翻炒 1 分钟，加蚝油和盐出锅'],
    extra: '焯水 60 秒就够，久了发黄发软。过凉水这一步决定颜色翠不翠。',
    order: { cat: '轻食', note: '少油少盐，不要勾芡', price: '¥15–22' }
  },
  {
    id: 'mapo-tofu', name: '麻婆豆腐', emoji: '🌶️', cat: 'vegetable_dish',
    method: '烧', time: 18, kcal: 290, diff: 2,
    tags: ['下饭', '重口', '辣'],
    taste: { sour: 0, salt: 4, sweet: 1, spice: 4, rich: 4 },
    tex: { crisp: 0, tender: 4, soft: 4, chew: 1, soup: 4 },
    ing: [{ n: '嫩豆腐', q: '1 盒' }, { n: '猪肉末', q: '80 g' }, { n: '豆瓣酱', q: '1 勺' }, { n: '花椒粉', q: '1 小勺' }, { n: '蒜', q: '2 瓣' }, { n: '淀粉', q: '1 小勺' }],
    calc: '两人份。豆腐和肉末 6:1，肉只是提味的。',
    prep: ['豆腐切块，淡盐水泡 3 分钟去豆腥', '淀粉加水调成水淀粉'],
    cut: ['豆腐切 2cm 方块，用刀背托着挪，别用手抓', '蒜切末'],
    cook: ['热锅下油，肉末炒散到微焦', '下豆瓣酱和蒜末，小火炒出红油', '加一碗水烧开，下豆腐轻推，中火烧 5 分钟', '淋水淀粉勾芡，撒花椒粉出锅'],
    extra: '全程用铲子背推，别翻炒，否则豆腐全碎。花椒粉最后撒，早放就没麻味了。',
    order: { cat: '川菜', note: '微辣，多花椒，豆腐要嫩豆腐', price: '¥18–26' }
  },
  {
    id: 'potato-shreds', name: '酸辣土豆丝', emoji: '🥔', cat: 'vegetable_dish',
    method: '炒', time: 12, kcal: 180, diff: 2,
    tags: ['快手', '下饭', '辣'],
    taste: { sour: 3, salt: 3, sweet: 0, spice: 3, rich: 2 },
    tex: { crisp: 5, tender: 1, soft: 0, chew: 2, soup: 0 },
    ing: [{ n: '土豆', q: '2 个' }, { n: '干辣椒', q: '4 个' }, { n: '醋', q: '2 勺' }, { n: '蒜', q: '2 瓣' }],
    calc: '两人份。土豆 2 个，切完丝大概一盘。',
    prep: ['土豆去皮，切丝后立刻泡冷水', '泡 10 分钟，换两次水洗掉表面淀粉'],
    cut: ['先切 2mm 薄片，再切 2mm 细丝，粗细要一致'],
    cook: ['热锅下油，干辣椒和蒜末小火爆香', '下土豆丝大火快炒 2 分钟', '沿锅边淋醋，加盐炒匀立刻出锅'],
    extra: '洗掉淀粉才脆，不洗就是一锅土豆泥。醋沿锅边淋，遇热锅激出香气，直接倒丝上只有酸味。',
    order: { cat: '家常小炒', note: '多放醋，要脆的', price: '¥12–18' }
  },
  {
    id: 'tomato-soup', name: '西红柿鸡蛋汤', emoji: '🍲', cat: 'soup',
    method: '煮', time: 12, kcal: 110, diff: 1,
    tags: ['清淡', '养胃', '快手', '带汤'],
    taste: { sour: 4, salt: 3, sweet: 1, spice: 0, rich: 1 },
    tex: { crisp: 0, tender: 3, soft: 3, chew: 0, soup: 5 },
    ing: [{ n: '番茄', q: '2 个' }, { n: '鸡蛋', q: '2 个' }, { n: '葱', q: '1 根' }, { n: '淀粉', q: '1 小勺' }],
    calc: '两人份。两碗水配两个番茄，汤才够浓。',
    prep: ['番茄去皮切块', '鸡蛋打散，淀粉加水调开'],
    cut: ['番茄切小块，越小越容易出沙', '葱切末'],
    cook: ['少油下番茄，中火炒到出沙', '加两碗水烧开，煮 3 分钟', '淋水淀粉勾薄芡，转小火', '蛋液沿筷子缓缓淋入，静置 5 秒再推散', '加盐、撒葱花出锅'],
    extra: '蛋液要淋成细线、淋完别马上搅，才会出蛋花。一搅就成蛋絮，汤也浑了。',
    order: { cat: '家常菜', note: '汤多一点，不要放香菜', price: '¥10–15' }
  },
  {
    id: 'steamed-egg', name: '蒸水蛋', emoji: '🥚', cat: 'breakfast',
    method: '蒸', time: 15, kcal: 120, diff: 1,
    tags: ['养胃', '低脂', '清淡', '老少皆宜'],
    taste: { sour: 0, salt: 2, sweet: 1, spice: 0, rich: 1 },
    tex: { crisp: 0, tender: 5, soft: 5, chew: 0, soup: 2 },
    ing: [{ n: '鸡蛋', q: '2 个' }, { n: '温水', q: '蛋液的 1.5 倍' }, { n: '生抽', q: '半勺' }, { n: '香油', q: '2 滴' }],
    calc: '一人份。蛋液和温水 1:1.5，水多了不成型，少了发硬。',
    prep: ['鸡蛋打散，加温水搅匀', '过筛两遍去掉泡沫'],
    cut: ['不用切。' ],
    cook: ['蛋液倒进碗里，蒙上保鲜膜扎几个小孔', '水开后中火蒸 10 分钟', '关火焖 2 分钟再开盖', '淋生抽和香油'],
    extra: '必须用温水，冷水蒸出来有蜂窝。保鲜膜或盘子盖住，防止水汽滴进去。',
    order: { cat: '家常菜', note: '不要葱，酱油少一点', price: '¥8–12' }
  },
  {
    id: 'curry-chicken', name: '咖喱鸡饭', emoji: '🍛', cat: 'meat_dish',
    method: '炖', time: 35, kcal: 480, diff: 2,
    tags: ['下饭', '一锅出'],
    taste: { sour: 1, salt: 3, sweet: 2, spice: 2, rich: 4 },
    tex: { crisp: 0, tender: 3, soft: 3, chew: 2, soup: 4 },
    ing: [{ n: '鸡腿肉', q: '300 g' }, { n: '土豆', q: '1 个' }, { n: '胡萝卜', q: '1 根' }, { n: '咖喱块', q: '2 小块' }, { n: '洋葱', q: '半个' }],
    calc: '两人份。咖喱块按包装说明，一人一块。',
    prep: ['鸡腿去骨切块，用一点盐和料酒抓匀', '洋葱切丝，土豆胡萝卜切块'],
    cut: ['鸡腿肉切 3cm 块', '土豆、胡萝卜切 2.5cm 滚刀块，和鸡肉一样大'],
    cook: ['热锅下油，洋葱炒到透明', '下鸡肉炒到表面变白', '下土豆胡萝卜翻炒 2 分钟', '加水没过食材，烧开转小火炖 15 分钟', '关火下咖喱块搅化，小火再煮 3 分钟'],
    extra: '咖喱块必须关火后再放，滚着放会结块。放了之后别大火，容易糊底。',
    order: { cat: '日式简餐', note: '咖喱多汁，饭少一点', price: '¥28–38' }
  },
  {
    id: 'boiled-shrimp', name: '白灼虾', emoji: '🦐', cat: 'aquatic',
    method: '煮', time: 10, kcal: 150, diff: 1,
    tags: ['高蛋白', '低脂', '清淡', '快手'],
    taste: { sour: 1, salt: 2, sweet: 3, spice: 0, rich: 1 },
    tex: { crisp: 1, tender: 4, soft: 1, chew: 3, soup: 0 },
    ing: [{ n: '基围虾', q: '400 g' }, { n: '姜', q: '4 片' }, { n: '葱', q: '2 根' }, { n: '生抽', q: '2 勺' }],
    calc: '两人份。400 g 大概 20 只，一人 10 只刚好。',
    prep: ['虾剪去虾枪虾须，挑出虾线', '姜切片，葱打结'],
    cut: ['虾不切。姜切片、葱切段'],
    cook: ['水烧开，下姜片、葱结和一点料酒', '下虾，煮到虾身弯成 C 形就捞出（约 2 分钟）', '立刻过冰水'],
    extra: 'C 形就熟了，卷成 O 形已经老了。过冰水虾肉才弹。',
    order: { cat: '海鲜', note: '蒸或者白灼，不要辣', price: '¥35–50' }
  },
  {
    id: 'malatang', name: '麻辣烫', emoji: '🍜', cat: 'takeout',
    method: '外食', time: 20, kcal: 600, diff: 0,
    tags: ['辣', '重口', '高钠'],
    taste: { sour: 1, salt: 5, sweet: 1, spice: 4, rich: 5 },
    tex: { crisp: 2, tender: 3, soft: 2, chew: 2, soup: 4 },
    takeoutOnly: true,
    order: { cat: '麻辣烫', note: '微辣、少盐、不要香菜，菜多丸子少，汤不要', price: '¥25–35' },
    shell: {
      why: '整锅煮，不用刀工，会烧水就会做。',
      idea: '底料炒香加水煮开，先下耐煮的土豆、藕片，再下肉丸和蔬菜，最后下粉丝，煮 3 分钟关火。'
    }
  },
  {
    id: 'huangmenji', name: '黄焖鸡米饭', emoji: '🍚', cat: 'takeout',
    method: '外食', time: 25, kcal: 680, diff: 0,
    tags: ['高碳水', '下饭'],
    taste: { sour: 0, salt: 4, sweet: 2, spice: 1, rich: 4 },
    tex: { crisp: 0, tender: 3, soft: 3, chew: 2, soup: 3 },
    takeoutOnly: true,
    order: { cat: '黄焖鸡', note: '少油、饭少一点、多蔬菜，不要辣', price: '¥25–32' }
  },
  {
    id: 'maocai', name: '冒菜', emoji: '🥘', cat: 'takeout',
    method: '外食', time: 20, kcal: 650, diff: 0,
    tags: ['辣', '重口'],
    taste: { sour: 1, salt: 5, sweet: 1, spice: 5, rich: 5 },
    tex: { crisp: 2, tender: 3, soft: 2, chew: 2, soup: 4 },
    takeoutOnly: true,
    order: { cat: '冒菜', note: '微辣、少油、不要香菜，多要蔬菜', price: '¥25–35' }
  },
  {
    id: 'luosifen', name: '螺蛳粉', emoji: '🍲', cat: 'takeout',
    method: '外食', time: 20, kcal: 550, diff: 0,
    tags: ['辣', '重口', '高钠'],
    taste: { sour: 3, salt: 5, sweet: 0, spice: 4, rich: 4 },
    tex: { crisp: 1, tender: 2, soft: 2, chew: 4, soup: 5 },
    takeoutOnly: true,
    order: { cat: '螺蛳粉', note: '微辣、少汤、不要酸笋（或不加辣油）', price: '¥20–30' }
  },
  {
    id: 'salad', name: '轻食沙拉', emoji: '🥗', cat: 'takeout',
    method: '外食', time: 15, kcal: 320, diff: 0,
    tags: ['减脂', '低脂', '高蛋白', '清淡'],
    taste: { sour: 2, salt: 2, sweet: 1, spice: 0, rich: 1 },
    tex: { crisp: 4, tender: 2, soft: 1, chew: 2, soup: 0 },
    takeoutOnly: true,
    order: { cat: '轻食沙拉', note: '酱汁分装、不要沙拉酱换成油醋汁、加鸡胸', price: '¥28–38' }
  }
];
