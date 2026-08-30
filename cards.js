window.__CARD_DATA__ = {
  "meta": {
    "game": "入局者",
    "version": "v3_含馈赠卡与乐谱卡",
    "last_updated": "2026-08-17",
    "total_cards": 134,
    "notes": "基于用户提供的所有卡牌图片逐张读取确认。属性颜色：无序=灰/黑，热忱=红，理智=蓝，混沌=紫。\"拦路者\"已加入。碰碰冰茶文件名为老大.png。"
  },
  "rules": {
    "deck": "8道具卡 + 4角色携带卡(攻击/技能)",
    "permanent_limit": 2,
    "chaos_weakness": "混沌攻击无克制加成(打混沌除外)，受所有属性攻击多1伤害",
    "attack_power_divide_2": "攻击力数值÷2才是实际伤害加成",
    "sacrifice": "每回合1次，送1卡入墓回2音韵",
    "team": "队长提供【被动+SP】，队员仅提供【SP】（需卡面写明'作为队员编组也生效'，队员SP通常有冲突）",
    "crit": "初始暴击率0，默认爆伤150%，超频加爆伤不加暴击率",
    "multi_hit": "多段判定每段单独算，每段吃增伤",
    "control_dice_no_calibration": "判定伤害最多可适用20%控骰能力（骰子点数±1）",
    "max_cost": 12,
    "default_refill": 5,
    "hand_limit": 5,
    "initial_hand": 4,
    "max_movement": "单次位移量超过20格的按照20格计算"
  },
  "characters": [
    {
      "name": "现实间冬马",
      "attribute": "无序",
      "passive": "分析大师的游刃有余：自己回合内每累计移动5格可以对一名玩家造成1点无序属性伤害(随等级成长，Lv4/Lv7时触发要求降低至4/3格，造成的无序属性伤害提升至2/3点)。Lv7追加：每回合首次使用道具卡也能触发该效果。",
      "sp": "使用攻击卡或技能卡之后前进1-3格。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 7.9,
      "grade": "A+",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "椎名小春",
        "设计师的直尺",
        "能量饮料",
        "四叶草发卡",
        "弱点分析",
        "钢筋铁肘"
      ],
      "combo_notes": "适用位移队。冬马被动移动累计造无序伤害，SP弱点分析加暴击率和暴击伤害，是位移队（泛用）输出。搭配小春（位移累计先机追加掷骰）、设计师的直尺、能量饮料最大化位移收益。",
      "roles": [
        "输出",
        "位移"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_DOIdJt59Ud.webp",
      "sync": 5,
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 7.7,
        "flex": 7.6,
        "synergy": 7.4,
        "stable": 7.7
      },
      "growth": 0.3,
      "brief": "强势，收益直接，位移队组件。"
    },
    {
      "name": "入间枫",
      "attribute": "混沌",
      "passive": "敏锐洞察：每次使用[战术]或[增益]标签的卡后可于结算完毕后抽取一张[馈赠卡]。那之后可以抽取1张卡并展示，若为同色卡则保留，异色卡则送入墓地（也可视为一次献祭）并回复2点音韵值。",
      "sp": "游戏开始时队伍从以下效果中选择两项适用：①回复6点音韵值②抽2张卡③每回合献祭次数+1，并且每次献祭后可以支付1点音韵值来对一名其他玩家造成1点混沌属性伤害。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。",
      "score": 7.6,
      "grade": "A+",
      "archetypes": [
        "资源运转队",
        "进攻队"
      ],
      "recommended_with": [
        "木原光太郎",
        "松山惠",
        "黑色卡片",
        "镌刻的艺术",
        "底牌",
        "音叉"
      ],
      "combo_notes": "适用资源运转队和进攻队。枫被动每次使用战术或增益卡后位移1-4格+滤抽回费，SP开局20%控骰+回6抽2，资源运转和进攻均极强。搭配光太郎（额外抽卡+献祭回费）、惠（乐曲序列回费抽卡）、黑色卡片（每回合额外抽卡+献祭回费）。",
      "roles": [
        "位移",
        "控制"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_oAjMFutXGf.webp",
      "sync": 6,
      "_category": "characters",
      "type": "术士/增幅者/位移手",
      "sync_value": 6,
      "dims": {
        "power": 8.2,
        "flex": 6.9,
        "synergy": 7.8,
        "stable": 6.8
      },
      "growth": 0.1,
      "brief": "强势，收益直接，资源运转队组件。"
    },
    {
      "name": "木原光太郎",
      "attribute": "无序",
      "passive": "千金之势：初始手牌+1；每个自己回合开始时可以额外抽取1张卡；每回合的首次献祭可以额外回复1点音韵值。此外，光太郎献祭的卡牌视为因卡的效果送入墓地。",
      "sp": "队伍每回合献祭次数+1，每回合首次完成献祭后可以从以下效果中选择一项执行：①获得1000金币②增加1点队伍攻击力③抽取一张[馈赠卡]。这个效果即使作为队员编组也会生效。这个效果会与其他队员编组类效果冲突。",
      "score": 7.7,
      "grade": "A+",
      "archetypes": [
        "资源运转队"
      ],
      "recommended_with": [
        "入间枫",
        "松山惠",
        "黑色卡片",
        "镌刻的艺术",
        "对弈",
        "集中"
      ],
      "combo_notes": "适用资源运转队。光太郎被动初始手牌+1+额外抽卡+献祭回费+献祭视为效果送墓，SP献祭次数+1+三选一，资源运转极强，献祭流核心。搭配枫（开局回费抽卡+控骰）、惠（乐曲序列回费）、黑色卡片（额外抽卡+献祭回费）。",
      "roles": [
        "资源"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_qLeSrXDAwN.webp",
      "sync": 5,
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 8.0,
        "flex": 6.8,
        "synergy": 7.5,
        "stable": 7.6
      },
      "growth": 0.2,
      "brief": "强势，收益直接、泛用度高，资源运转队组件。"
    },
    {
      "name": "松山惠",
      "attribute": "理智",
      "passive": "音律感应：编排旋律以触发效果：当你使用3张牌后，若这些牌所需的音韵值为依次递增则执行[乐曲α]，依次递减则执行[乐曲β]；数字相同则执行乐曲δ；若为特殊音韵值[3, 2, 5]则执行[乐曲γ]。那之后保留最后一张牌的音韵值并重新编排旋律。",
      "sp": "①乐曲α，回复4点音韵值并抽1张②乐曲β，执行一次献祭动作，且那次献祭回复的音韵值+1③乐曲γ，回复7点同步值并提升自身1点防御值④乐曲δ，本回合献祭次数+1，那之后对一名其他玩家造成3点理智属性伤害。",
      "score": 7.9,
      "grade": "A+",
      "archetypes": [
        "资源运转队",
        "位移队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "黑色卡片",
        "镌刻的艺术",
        "放轻松些",
        "逃脱"
      ],
      "combo_notes": "适用资源运转队/位移队。惠被动乐曲序列回费抽卡位移回同步，是资源运转队核心。搭配枫（开局回费抽卡）、光太郎（献祭回费）、黑色卡片（额外抽卡）。",
      "roles": [
        "位移",
        "防御"
      ],
      "sync": 6,
      "sp_member": false,
      "image_url": "assets/images/img_rrp8EJPR1r.webp",
      "_category": "characters",
      "type": "术士/调度者/增益者",
      "sync_value": 6,
      "dims": {
        "power": 8.1,
        "flex": 7.5,
        "synergy": 8.4,
        "stable": 7.0
      },
      "growth": 0.2,
      "brief": "核心级，收益直接、泛用度高，资源运转队组件。"
    },
    {
      "name": "小野结衣",
      "attribute": "热忱",
      "passive": "小野一刀流：使用攻击卡或[侵略]道具卡指定目标后可将其一张卡直到本回合结束前移出游戏",
      "sp": "使用攻击卡或[侵略]技能卡最终伤害+1，无视1护盾。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 6.7,
      "grade": "B",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "宫樱子",
        "横扫之刃",
        "祓禊",
        "妖刀五月雨",
        "拿手好戏",
        "惊吓礼盒"
      ],
      "combo_notes": "适用快攻侵略队。结衣被动使用攻击/侵略卡可移出对方一张卡，SP最终伤害+1无视1护盾（作为队员也生效），是快攻侵略队核心。搭配樱子（免费使用卡+全队攻击+2）、横扫之刃（多段伤害）、祓禊（伤害+回收侵略卡）。",
      "roles": [
        "输出",
        "控制",
        "防御"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_Gyx7WO51lv.webp",
      "sync": 6,
      "_category": "characters",
      "sync_value": 6,
      "dims": {
        "power": 7.2,
        "flex": 6.2,
        "synergy": 5.6,
        "stable": 7.6
      },
      "brief": "合格可用，收益直接、泛用度高，协同依赖低，快攻侵略队组件。"
    },
    {
      "name": "小野葵",
      "attribute": "无序",
      "passive": "福音雅颂：初始手牌+1；游戏开始时所有携带卡首次使用费用-1",
      "sp": "每名成员自然回复音韵+50%(向下)，队伍暴击伤害+1。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 7.5,
      "grade": "A+",
      "archetypes": [
        "泛用辅助",
        "资源运转流"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "霜烬",
        "莉莉·缇雅菲洛",
        "宁雨清",
        "里尔亚斯·斯塔芙莉娅斯特"
      ],
      "combo_notes": "适用泛用辅助。葵被动初始手牌+1+携带卡首次费用-1+全队回费+50%+暴击伤害+1，是泛用辅助，可搭配任何队伍。搭配资源运转队（枫/光太郎/惠）进一步提升资源效率，搭配快攻队提升爆发。",
      "roles": [
        "输出",
        "防御",
        "辅助"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_4B2CDgTng0.webp",
      "sync": 4,
      "_category": "characters",
      "sync_value": 4,
      "dims": {
        "power": 7.3,
        "flex": 7.7,
        "synergy": 7.2,
        "stable": 7.6
      },
      "brief": "全队自然回费光环（约全队每回合多2费）叠加12张携带卡首用-1费的全局省费，另带全队暴伤+1；不占队长位、队员编组即生效，百搭资源运转组件。"
    },
    {
      "name": "里尔亚斯·斯塔芙莉娅斯特",
      "attribute": "混沌",
      "passive": "Huginn&Muninn：①获取激励点数时额外+1。②每回合自然回复音韵和上限+2(Lv4/7/10变为4/5/6)",
      "sp": "队伍每回合献祭次数+1，每次献祭后回自身1同步。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 7.7,
      "grade": "A+",
      "archetypes": [
        "资源运转队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "松山惠",
        "黑色卡片",
        "镌刻的艺术",
        "鸣奏之\"圣音\""
      ],
      "combo_notes": "适用资源运转队。里尔亚斯被动激励点数+1+回费上限+2+献祭次数+1，是资源运转队核心。搭配枫（开局回费抽卡）、光太郎（献祭回费）、黑色卡片（献祭回费）、鸣奏之圣音（献祭回费）。",
      "roles": [
        "防御"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_RTunmQRx7X.webp",
      "sync": 4,
      "_category": "characters",
      "sync_value": 4,
      "dims": {
        "power": 7.2,
        "flex": 8.1,
        "synergy": 6.8,
        "stable": 7.9
      },
      "growth": 0.2,
      "brief": "强势，收益直接、泛用度高，资源运转队组件。"
    },
    {
      "name": "现实间里绪",
      "attribute": "热忱",
      "passive": "不用羡慕人家哦！：在你需要时可以使用2枚六面骰替换原本使用的骰子进行投掷（不可用于判定伤害的伤害判定）；此外里绪在单回合内每累计移动8格后可以支付1点音韵值来对一名其他玩家造成一次四面骰判定伤害，每回合首次触发时还会附加一段1点热忱属性伤害。",
      "sp": "全队造成的判定伤害+1。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。",
      "score": 8.1,
      "grade": "S",
      "archetypes": [
        "移动造伤队"
      ],
      "recommended_with": [
        "予(水着)",
        "星奈(水着)",
        "设计师的直尺",
        "能量饮料",
        "清凉时间！",
        "风纪委员的手段",
        "狡黠之跃",
        "这不是逃跑！"
      ],
      "combo_notes": "适用移动造伤队。里绪被动可使用2枚六面骰替换投掷，骰子判定伤害-4但单回合累计移动9格后可对一名其他玩家造成一次四面骰判定伤害（Lv7降至6格且判定伤害+1）。2枚六面骰平均7点，-4后平均3点，Lv7时平均4点。SP队伍使用[移动]标签道具卡后前进1-3格，需构筑移动卡体系。搭配予水着（蓝队移动核心）、星奈水着（大位移造伤+移动卡回收）。搭配设计师的直尺、能量饮料、清凉时间、风纪委员的手段、狡黠之跃、这不是逃跑！等移动道具卡触发SP位移。",
      "roles": [
        "近卫",
        "位移手"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_mxWESMi7kU.webp",
      "sync": 6,
      "_category": "characters",
      "type": "近卫/位移手",
      "sync_value": 6,
      "dims": {
        "power": 8.3,
        "flex": 7.7,
        "synergy": 8.0,
        "stable": 7.3
      },
      "growth": 0.2,
      "brief": "核心级，收益直接，移动造伤队组件。"
    },
    {
      "name": "莉莉·缇雅菲洛",
      "attribute": "无序",
      "passive": "\"逝者之眼\"：每次投掷结果出现前，可以在原本投掷点数与其对立面上点数中选择一项作为最终结果。莉莉每次抽卡前可以观看牌组最下方的一张卡然后选择在牌组最上方或最下方抽卡。",
      "sp": "莉莉不会被经过类效果影响；此外每个自己回合可以发动一次：把墓地最下方的一张卡放回牌组最下方，如果放回的卡是单次种类的卡还可以执行那张卡的效果。",
      "score": 7.8,
      "grade": "A+",
      "archetypes": [
        "泛用辅助"
      ],
      "recommended_with": [
        "小野葵",
        "霜烬",
        "安静些",
        "绿宝之杖·择",
        "特制手套",
        "Twice"
      ],
      "combo_notes": "适用泛用辅助。莉莉被动骰子对立面选择+抽卡方向选择，是泛用辅助。搭配任何队伍提供控骰和抽卡选择。搭配安静些（全图伤害+手牌破坏）、绿宝之杖（灵活三选一）。",
      "roles": [
        "资源"
      ],
      "sp_member": false,
      "image_url": "assets/images/img_vv28zwy3db.webp",
      "sync": 6,
      "_category": "characters",
      "sync_value": 6,
      "type": "术士/位移手",
      "dims": {
        "power": 7.5,
        "flex": 7.8,
        "synergy": 8.1,
        "stable": 7.5
      },
      "growth": 0.1,
      "brief": "强势，收益直接，泛用辅助组件。"
    },
    {
      "name": "小沙香琉璃",
      "attribute": "混沌",
      "passive": "与子同行：每次造成判定伤害后回自身1音韵。累计触发4/7/11/18次后抽1卡，之后全队判定伤害+1",
      "sp": "造成判定伤害且适用最大伤害后抽1卡回1音韵。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 7.9,
      "grade": "A+",
      "archetypes": [
        "判定伤害队"
      ],
      "recommended_with": [
        "入间予",
        "人格修正拳！",
        "秘技！摸头杀",
        "钢笔",
        "蓝宝之杖·命",
        "破损电子设备"
      ],
      "combo_notes": "适用判定伤害队。琉璃被动每次判定伤害后回音韵+累计触发全队判定伤害+1，SP判定最大伤害抽卡回费，是判定伤害队的队长核心。搭配钢笔（判定伤害+1+减费）、蓝宝之杖·命（每回合追加判定伤害）、破损电子设备（低费判定伤害+回收）形成判定循环。搭配予（全队判定+1+控骰）进一步提升判定伤害。",
      "roles": [
        "输出",
        "辅助"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_QOINVelwDg.webp",
      "sync": 5,
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 7.6,
        "flex": 7.8,
        "synergy": 8.4,
        "stable": 7.0
      },
      "growth": 0.2,
      "brief": "强势，收益直接、泛用度高，判定伤害队组件。"
    },
    {
      "name": "琉璃(水着)",
      "attribute": "热忱",
      "passive": "为君绽放的微笑：使用热忱属性的卡后可以适用效果：对一名其他玩家造成1点热忱属性伤害并回复自身1点同步值。使用攻击卡和技能卡之后立刻抽一张（不论是否发动成功）。",
      "sp": "队伍中每有一名热忱属性的角色都会让队伍初始攻击力+1，三名都是热忱属性角色还会额外+1。队伍造成热忱属性伤害后回复1点音韵值。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。",
      "score": 7.7,
      "grade": "A+",
      "archetypes": [
        "热忱快攻队"
      ],
      "recommended_with": [
        "比翼恋理",
        "夏日海滩踢击",
        "打起精神来！",
        "放轻松些",
        "绿宝之杖·择",
        "祓禊"
      ],
      "combo_notes": "适用热忱快攻队。琉璃水着被动用技能卡造热忱伤害+回同步+用卡抽卡，是热忱快攻队核心。搭配比翼恋理（热忱领域全队增益）、夏日海滩踢击（AOE判定伤害+位移）、打起精神来（追加掷骰阶段）。",
      "roles": [
        "输出",
        "防御"
      ],
      "sync": 4,
      "sp_member": true,
      "image_url": "assets/images/img_cZetlLUOKV.webp",
      "image": "assets/images/img_GOMwgHu0y8.webp",
      "sync_value": 4,
      "tags": [
        "猎手",
        "增益者",
        "增幅者"
      ],
      "_category": "characters",
      "dims": {
        "power": 8.0,
        "flex": 7.1,
        "synergy": 8.4,
        "stable": 7.6
      },
      "brief": "热忱快攻队核心：用攻击/技能卡后无条件抽1（不论成败）的卡差引擎，用热忱卡还附带1点热忱伤害并回1同步；SP给纯热忱队高额初始攻击力加成、热忱伤害回1音韵，队员位也生效。"
    },
    {
      "name": "露璐缇雅·爱德华",
      "attribute": "理智",
      "passive": "别眨眼！：自己回合内发动/使用的卡的费用与上一张卡相同时可以回复自身1/2/3点音韵值。（随着回合内的触发次数增加回复量。每次增加1点，最多增加至3点）这个效果单回合内每触发3次，还可以破坏一名玩家的手卡。",
      "sp": "这张卡编组时会作为2名[破坏者]角色计数；队伍中的[破坏者]角色合计在三名以上时每个自己回合都可以发动一次：破坏一名玩家区域内的一张卡，然后其回复4点音韵值。",
      "score": 7.6,
      "grade": "A+",
      "archetypes": [
        "资源运转队",
        "控场队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "拿手好戏",
        "谢幕",
        "黑色卡片",
        "镌刻的艺术"
      ],
      "combo_notes": "适用资源运转队/控场队。露璐缇雅被动同费卡回音韵，是资源运转队核心。搭配枫/光太郎/惠形成资源循环。搭配拿手好戏（破坏对方卡）、谢幕（驱散+位移+判定伤害）。",
      "roles": [
        "控制"
      ],
      "sp_member": false,
      "image_url": "assets/images/img_IvJzfVxSP3.webp",
      "sync": 5,
      "_category": "characters",
      "sync_value": 5,
      "type": "术士/破坏者",
      "dims": {
        "power": 8.0,
        "flex": 7.0,
        "synergy": 8.0,
        "stable": 6.9
      },
      "growth": 0.1,
      "brief": "强势，收益直接，资源运转队组件。"
    },
    {
      "name": "霜烬",
      "attribute": "热忱",
      "passive": "黎明灰烬：霜烬的同步值高于14则适用效果：全队不会受到来自其他玩家以任何形式施加的负面效果。这个效果每触发一次都会让霜烬回复3点音韵值和3点同步值并增加3点攻击力。霜烬的同步值低于14则适用效果：每回合自然回复的音韵值+2。",
      "sp": "霜烬不会为队伍提供攻击卡和技能卡，但队伍自然回复的音韵值+1，初始手牌+1；这个效果即使作为队员编组也会生效。这个效果会与其他队员编组类效果冲突。",
      "score": 6.9,
      "grade": "B",
      "archetypes": [
        "泛用辅助"
      ],
      "recommended_with": [
        "小野葵",
        "莉莉·缇雅菲洛",
        "入间枫",
        "木原光太郎",
        "黑色卡片",
        "镌刻的艺术"
      ],
      "combo_notes": "适用泛用辅助。霜烬被动高同步全队免疫负面+低同步回费+全队回费+1初始手牌+1，是泛用辅助。搭配资源运转队提升回费效率，搭配任何队伍提供免疫负面保护。",
      "roles": [
        "输出",
        "防御"
      ],
      "sync": 5,
      "sp_member": true,
      "image_url": "assets/images/img_MXyCY33zoe.webp",
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 7.8,
        "flex": 5.9,
        "synergy": 6.7,
        "stable": 7.2
      },
      "brief": "优秀，收益直接，较挑构筑与时机，泛用辅助组件。"
    },
    {
      "name": "小仓霞",
      "attribute": "热忱",
      "passive": "整肃：每回合一次，选至多2张手卡和1张区域内卡放回牌组洗切，然后抽相同数量，放回3张时回1音韵",
      "sp": "到达公共站/地铁可直接移动至该线路或转乘线路下车点，无需判定和支付费用。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 7.1,
      "grade": "A",
      "archetypes": [
        "资源运转队",
        "位移队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "松山惠",
        "逃脱",
        "黑色卡片",
        "镌刻的艺术"
      ],
      "combo_notes": "适用资源运转队/位移队。霞被动滤牌+公交站免费移动，是资源运转队/位移队辅助。搭配枫/光太郎/惠提升资源效率，搭配逃脱（大范围位移）。",
      "roles": [
        "位移"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_4VvmbV3Vt4.webp",
      "sync": 5,
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 7.7,
        "flex": 6.7,
        "synergy": 6.4,
        "stable": 7.2
      },
      "brief": "优秀，收益直接，资源运转队组件。"
    },
    {
      "name": "椎名小春",
      "attribute": "热忱",
      "passive": "侦探直觉：自己回合内每累计位移5格或经过其他玩家获得1点[先机]。每使用1张[移动]道具卡也获得1先机，上限6",
      "sp": "先机：自己回合内可消耗1/2/3点先机追加一个掷骰阶段(每回合首次消耗1点后每次使用+1，最多消耗3点)。每消耗1点先机回1音韵",
      "score": 7.5,
      "grade": "A+",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "现实间冬马",
        "设计师的直尺",
        "能量饮料",
        "四叶草发卡",
        "案件还原",
        "这不是逃跑！"
      ],
      "combo_notes": "适用位移队。小春被动位移累计先机追加掷骰，是位移队辅助。搭配冬马（移动累计造伤害）、设计师的直尺、能量饮料最大化位移收益。",
      "roles": [
        "位移"
      ],
      "sp_member": false,
      "image_url": "assets/images/img_qc47HgvVbP.webp",
      "sync": 5,
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 8.1,
        "flex": 6.3,
        "synergy": 7.6,
        "stable": 7.3
      },
      "growth": 0.2,
      "brief": "优秀，收益直接、泛用度高，协同依赖低，位移队组件。"
    },
    {
      "name": "小野伊织",
      "attribute": "理智",
      "passive": "恩典：抽馈赠卡时不会抽到[500$]；每次投掷结果出现时可在其和2中选一项为最终结果",
      "sp": "到达[神社]后回自身5音韵并抽1张馈赠卡。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 7.5,
      "grade": "A+",
      "archetypes": [
        "破局队"
      ],
      "recommended_with": [
        "里绪(水着)",
        "共鸣者",
        "结晶碎弧",
        "遥控骰子",
        "特制手套",
        "祛祟"
      ],
      "combo_notes": "适用破局队。伊织被动抽馈赠卡不会抽到500$+投掷可在点数和2中选择，SP到达神社回费抽馈赠，是破局队队长核心。搭配里绪水着（首次馈赠必中和声+首次神社必中大吉）稳定获取高价值馈赠。搭配共鸣者（抽馈赠时卡池不含200$）、结晶碎弧（直接降入迷值）、遥控骰子（控馈赠骰）、特制手套（改骰+检索）。",
      "roles": [
        "功能型"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_RfDiPoID9G.webp",
      "sync": 6,
      "_category": "characters",
      "sync_value": 6,
      "dims": {
        "power": 7.6,
        "flex": 7.3,
        "synergy": 6.7,
        "stable": 8.3
      },
      "brief": "强势，收益直接、泛用度高，破局队组件。"
    },
    {
      "name": "宫樱子",
      "attribute": "混沌",
      "passive": "真是没办法了呢：消耗次数让使用的卡不消耗音韵(初始1次)，队伍同步降至20/15/10/5时各获取1次",
      "sp": "队伍攻击+2，属性克制伤害+1，造成伤害后回1同步。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 7.2,
      "grade": "A",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小野结衣",
        "横扫之刃",
        "祓禊",
        "杂鱼！杂鱼！",
        "妖刀五月雨",
        "善意面具"
      ],
      "combo_notes": "适用快攻侵略队。樱子被动免费使用卡+全队攻击+2+克制伤害+1，是快攻侵略队核心。搭配结衣（移出对方卡+伤害+1）、横扫之刃（多段伤害）、杂鱼杂鱼（降防+墓地增伤）。",
      "roles": [
        "输出",
        "辅助"
      ],
      "sync": 5,
      "sp_member": true,
      "image_url": "assets/images/img_r90f2XiaVP.webp",
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 6.4,
        "flex": 7.9,
        "synergy": 7.2,
        "stable": 7.7
      },
      "brief": "优秀，收益直接、泛用度高，快攻侵略队组件。"
    },
    {
      "name": "入间予",
      "attribute": "无序",
      "passive": "解构与求索：初始20%控骰。队伍中编组了光太郎、葵、莉莉、霞中任意一名提升予20%控骰(可叠加)。编组琉璃、里绪或枫时提升予40%控骰(不可叠加)。Lv7追加：每进行一次投掷后回复自身1点音韵值。",
      "sp": "全队判定伤害+1，每有1名无序属性成员全队自然回复音韵+1。这个效果即使作为队员编组也会生效。",
      "score": 7.8,
      "grade": "A+",
      "archetypes": [
        "判定伤害队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "人格修正拳！",
        "秘技！摸头杀",
        "钢笔",
        "蓝宝之杖·命",
        "破损电子设备"
      ],
      "combo_notes": "适用判定伤害队。予被动初始20%控骰+编组特定角色提升控骰，SP全队判定伤害+1，是判定伤害队的核心队员。搭配琉璃（判定伤害后回音韵+累计全队判定+1）形成判定增伤循环。搭配钢笔（判定伤害+1+减费）、蓝宝之杖·命（追加判定伤害）、破损电子设备（低费判定伤害）。注意：20面骰和碰碰冰茶会降低判定伤害，判定伤害队不要带。",
      "roles": [
        "输出",
        "防御",
        "辅助"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_cxgxyxmGfe.webp",
      "sync": 4,
      "_category": "characters",
      "sync_value": 4,
      "dims": {
        "power": 7.4,
        "flex": 7.4,
        "synergy": 8.2,
        "stable": 7.2
      },
      "growth": 0.3,
      "brief": "强势，收益直接，判定伤害队组件。"
    },
    {
      "name": "予(水着)",
      "attribute": "理智",
      "passive": "归纳演绎法：队伍使用的无序以外的[战术]或[移动]道具卡视为理智属性[移动]道具卡；每使用1张理智属性卡回1音韵；队伍造成的伤害均变为理智属性",
      "sp": "全队理智属性伤害+1，使用理智属性[移动]道具卡后对一名玩家造硬币判定伤害(正面2点，背面0)。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 7.6,
      "grade": "A+",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "枫(水着)",
        "星奈(水着)",
        "雨宫羽奈",
        "设计师的直尺",
        "能量饮料",
        "夏日畅饮时间！"
      ],
      "combo_notes": "适用位移队。予水着被动移动/战术道具视为理智属性+用理智卡回费+全队伤害变理智，是位移队（蓝队）核心。搭配枫水着（理智伤害追加+位移+回收）、星奈水着（大位移多段理智伤害）、羽奈（移动道具追加理智伤害）。搭配设计师的直尺（移动造伤害）、能量饮料（移动倍率）、夏日畅饮时间（检索移动道具+硬币判定）。",
      "roles": [
        "输出",
        "位移手",
        "辅助"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_ynGbhERmQy.webp",
      "sync": 4,
      "_category": "characters",
      "sync_value": 4,
      "dims": {
        "power": 7.8,
        "flex": 7.0,
        "synergy": 9.0,
        "stable": 7.1
      },
      "brief": "强势，收益直接、流派协同强，位移队组件。"
    },
    {
      "name": "雨宫羽奈",
      "attribute": "理智",
      "passive": "风纪委员的手段：使用[侵略]道具卡造伤害后追加1段1理智伤害；使用[移动]道具卡后对一名玩家造1理智伤害(一次行动内仅触发一次)",
      "sp": "使用[侵略]道具卡最终伤害+1。作为队员编组也生效。与其他队员编组类效果冲突。",
      "score": 7.6,
      "grade": "A+",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "予(水着)",
        "枫(水着)",
        "星奈(水着)",
        "设计师的直尺",
        "能量饮料",
        "正义风纪委员飞踢"
      ],
      "combo_notes": "适用位移队。羽奈被动侵略/移动道具追加理智伤害，是位移队输出辅助。搭配予水着/枫水着/星奈水着形成位移队铁三角。搭配设计师的直尺（移动造伤害）、能量饮料（移动倍率）。",
      "roles": [
        "输出",
        "位移",
        "辅助"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_WqKZD5V99F.webp",
      "sync": 5,
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 7.6,
        "flex": 7.2,
        "synergy": 7.6,
        "stable": 8.1
      },
      "brief": "强势，收益直接，位移队组件。"
    },
    {
      "name": "宁雨清",
      "attribute": "理智",
      "passive": "图书管理员的矜持：游戏开始时抽7张卡，从中选5张卡作为初始手卡，那之后将剩余的卡送入墓地；雨清每次抽手卡后都会回复自身1点音韵值，每次用效果把卡加入手卡时可以扣除一名其他玩家3点同步值。",
      "sp": "队伍使用因效果加入手卡的卡时所需要的音韵值-1。这个效果即使作为队员编组时也会生效。这个效果会与其他队员编组类效果冲突。",
      "score": 8.1,
      "grade": "S",
      "archetypes": [
        "资源运转队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "查阅",
        "你呀你呀",
        "黑色卡片",
        "镌刻的艺术"
      ],
      "combo_notes": "适用资源运转队。雨清被动初始7选5+抽卡回费，是资源运转队核心。搭配枫/光太郎/惠提升资源效率。搭配查阅（检索丰沛/投掷/侵略/声乐卡）。",
      "roles": [
        "资源",
        "控制"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_KKuE94JDue.webp",
      "sync": 5,
      "_category": "characters",
      "sync_value": 5,
      "type": "术士/调度者/增益者",
      "dims": {
        "power": 8.7,
        "flex": 7.5,
        "synergy": 8.2,
        "stable": 7.6
      },
      "growth": 0.1,
      "brief": "核心级，收益直接，资源运转队组件。"
    },
    {
      "name": "枫(水着)",
      "attribute": "理智",
      "passive": "自信少女的连续攻势：使用理智属性的卡造成伤害后追加1段1点理智属性伤害，那之后可以前进1-3格。此外，单回合内累计移动了8格的场合可以回收墓地一张[移动]或[战术]标签的道具卡。",
      "sp": "小队中每名成员自然回复的音韵值增加50%（向下），造成的理智属性伤害+1。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。",
      "score": 7.0,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "予(水着)",
        "星奈(水着)",
        "雨宫羽奈",
        "设计师的直尺",
        "能量饮料",
        "夏日泳圈攻击！"
      ],
      "combo_notes": "适用位移队。枫水着被动用理智卡造伤害后追加1点理智伤害+前进1-3格+大位移可回收移动/战术道具，是位移队核心输出。搭配予水着（全队伤害变理智+回费）、星奈水着（大位移多段伤害）、羽奈（移动道具追加伤害）。搭配设计师的直尺、能量饮料最大化位移收益。",
      "roles": [
        "术士",
        "增益者",
        "增幅者"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_IgtUM936ei.webp",
      "sync": 4,
      "_category": "characters",
      "sync_value": 4,
      "dims": {
        "power": 7.1,
        "flex": 6.6,
        "synergy": 7.4,
        "stable": 7.3
      },
      "brief": "优秀，收益直接，位移队组件。"
    },
    {
      "name": "星奈(水着)",
      "attribute": "理智",
      "passive": "戏水：单次移动的位移量大于5格的场合可以对一名其他玩家造成2段1点理智属性伤害。此外，星奈使用的[移动]标签的道具卡因为结算而进入墓地后可以支付4点同步值将其重新加入手卡。",
      "sp": "造成多段伤害时每命中一段可以前进1格，然后回复自身1点音韵值。这个效果即使作为队员编组时也会生效。这个效果会与其他队员编组类效果冲突。",
      "score": 7.7,
      "grade": "A+",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "予(水着)",
        "枫(水着)",
        "雨宫羽奈",
        "设计师的直尺",
        "能量饮料",
        "清凉时间！",
        "风纪委员的手段",
        "狡黠之跃"
      ],
      "combo_notes": "适用位移造伤队。星奈水着被动大位移（>5格）造2段1点理智伤害且无回合次数限制，移动道具卡进入墓地后可支付4同步值回收反复使用，是位移队核心输出兼资源循环点。搭配予水着（全队伤害变理智+回费）、枫水着（理智伤害追加+位移）、羽奈（移动道具追加伤害）。搭配设计师的直尺、能量饮料、风纪委员的手段、狡黠之跃最大化位移收益和回收循环。SP多段伤害每段前进1格并回1音韵值，作为队员也生效。",
      "roles": [
        "猎手",
        "位移手",
        "突破手"
      ],
      "sync": 5,
      "sp_member": true,
      "image_url": "assets/images/img_fQ0HIqECEs.webp",
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 8.2,
        "flex": 7.1,
        "synergy": 7.6,
        "stable": 7.6
      },
      "brief": "强势，收益直接，位移队组件。"
    },
    {
      "name": "里绪(水着)",
      "attribute": "热忱",
      "passive": "令人羡慕的运气!：首次抽取[馈赠卡]时必定抽中[和声]，首次到达[神社]时必定抽中[大吉]（这两个效果只会生效其中1个）。此外，里绪在抽取[馈赠卡]时可以随机剔除奖池中的2张卡。",
      "sp": "首次投掷后可以回复与骰子点数相同的音韵值；首次移动后还能再抽2张卡。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。",
      "score": 8.2,
      "grade": "S",
      "archetypes": [
        "破局流"
      ],
      "recommended_with": [
        "小野伊织",
        "结晶碎弧",
        "共鸣者",
        "护符",
        "吊坠",
        "经文",
        "校准",
        "颠倒骰子"
      ],
      "combo_notes": "破局流核心队长。里绪水着被动首次馈赠必抽和声/神社必抽大吉二选一，馈赠抽取可剔除2张卡定向检索关键卡，SP首投回音韵+首移抽2，是破局流资源调度和入迷控制的绝对核心。搭配小野伊织（破局副核，抽卡滤抽）、结晶碎弧（唯一直接降入迷道具）、共鸣者（永续降入迷）。搭配护符/吊坠/经文（唯三保命卡）确保生存。搭配校准/颠倒骰子（控骰）确保馈赠和御神签定向抽取。",
      "roles": [
        "近卫",
        "调度者",
        "增益者"
      ],
      "sp_member": true,
      "image_url": "assets/images/img_VUVuLkxGJJ.webp",
      "sync": 5,
      "_category": "characters",
      "sync_value": 5,
      "dims": {
        "power": 8.6,
        "flex": 7.7,
        "synergy": 7.4,
        "stable": 8.8
      },
      "brief": "核心级，收益直接，破局流组件。"
    }
  ],
  "attack_cards": [
    {
      "name": "闲暇时光",
      "character": "冬马",
      "cost": 4,
      "attribute": "无序",
      "type": "疗愈",
      "effect": "立即回复自身4点同步值并抽一张，之后每回合回复2点同步值（持续3回合）。",
      "sp": "自身同步值低于3的场合使用回复量提升50%（向下）。",
      "score": 6.8,
      "grade": "B",
      "baseDamage": 0,
      "segments": 0,
      "damageType": "特殊",
      "scaling": "立即回4同步，之后每回合回2同步(3回合)",
      "archetypes": [
        "资源运转队"
      ],
      "recommended_with": [
        "黑色卡片",
        "善意面具",
        "入间予",
        "弱点分析",
        "集中",
        "打起精神来！"
      ],
      "combo_notes": "通用功能卡，可根据构筑需求加入",
      "image_url": "assets/images/img_iUyI2lzUe6.webp",
      "character_full": "现实间冬马",
      "attack_range": "无（治疗卡）",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 7.6,
        "flex": 6.2,
        "synergy": 6.2,
        "stable": 6.7
      },
      "brief": "合格可用，收益直接，资源运转队组件，冬马专属。"
    },
    {
      "name": "得分！",
      "character": "枫",
      "cost": 3,
      "attribute": "混沌",
      "type": "侵略",
      "effect": "提升自身1点防御值，然后对自身前后4格内的一名其他玩家造成2点混沌属性伤害。那之后对手除非将一张混沌属性的卡送入墓地（视为一次献祭），否则将再次受到2点混沌属性伤害。",
      "sp": "",
      "score": 7.1,
      "grade": "A",
      "baseDamage": 2,
      "segments": 1,
      "damageType": "普通",
      "scaling": "对手不献祭则追加2点混沌伤害",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间枫",
        "宫樱子",
        "人格修正拳！",
        "杂鱼！杂鱼！",
        "鼓舞"
      ],
      "combo_notes": "适用位移队/泛用/资源运转队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_lYL7RgQUOC.webp",
      "character_full": "入间枫",
      "attack_range": "前后4格内一名玩家",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 7.3,
        "flex": 6.5,
        "synergy": 6.9,
        "stable": 7.8
      },
      "brief": "优秀，收益直接，快攻侵略队组件，枫专属。"
    },
    {
      "name": "对弈",
      "character": "光太郎",
      "cost": 2,
      "attribute": "无序",
      "type": "侵略",
      "effect": "对同一行内的一名其他玩家发起一次[决斗]。",
      "sp": "决斗双方各出示一张卡，根据卡片属性（颜色）决定胜负（适用属性克制关系），胜者对败者造成3点伤害，伤害属性与胜出的卡属性一致。分出胜负后，双方将出示的卡送入墓地。",
      "score": 6.2,
      "grade": "B",
      "baseDamage": 3,
      "segments": 1,
      "damageType": "特殊",
      "scaling": "决斗机制，双方轮流攻击直到一方同步≤0",
      "archetypes": [
        "泛用"
      ],
      "recommended_with": [
        "黑色卡片",
        "善意面具",
        "入间予",
        "弱点分析",
        "集中",
        "打起精神来！"
      ],
      "combo_notes": "适用热忱快攻队/控场队。搭配多张拆卡卡快速消耗对手资源。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_2b1PUt19RN.webp",
      "character_full": "木原光太郎",
      "attack_range": "同一行内一名玩家",
      "range_adjustment": 0.15,
      "_category": "attack_cards",
      "dims": {
        "power": 6.7,
        "flex": 5.5,
        "synergy": 6.0,
        "stable": 6.4
      },
      "brief": "合格可用，收益直接，较挑构筑与时机，泛用组件，光太郎专属。"
    },
    {
      "name": "放轻松些",
      "character": "惠",
      "cost": 1,
      "attribute": "理智",
      "type": "侵略",
      "effect": "对自身前后3格内的一名其他玩家造成2点理智属性伤害，那之后自己回复1点音韵值。",
      "sp": "造成的伤害和回复的音韵值将在Lv4/LV7/LV10(Max)提升至2,2/3,2/4,3。",
      "score": 7.8,
      "grade": "A+",
      "baseDamage": 2,
      "segments": 1,
      "damageType": "普通",
      "scaling": "造成伤害后回自身1音韵",
      "archetypes": [
        "资源运转队",
        "快攻侵略队"
      ],
      "recommended_with": [
        "松山惠",
        "予(水着)",
        "枫(水着)",
        "夏日畅饮时间！",
        "钢笔",
        "设计师的直尺"
      ],
      "combo_notes": "适用资源运转队/位移队/位移队。搭配高费卡或爆发卡，提供音韵支持。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_ZHjGwRrQmE.webp",
      "character_full": "松山惠",
      "attack_range": "前后3格内一名玩家",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 7.7,
        "flex": 6.9,
        "synergy": 7.7,
        "stable": 8.3
      },
      "growth": 0.2,
      "brief": "强势，收益直接，资源运转队组件，惠专属。"
    },
    {
      "name": "横扫之刃",
      "character": "结衣",
      "cost": 3,
      "attribute": "热忱",
      "type": "侵略",
      "effect": "对最远距离自身3格的一名其他玩家造成1点热忱属性伤害，然后身后2格以内的玩家造成1点热忱属性伤害。",
      "sp": "目标离自己越近伤害越高（每靠近1格伤害+1）。",
      "score": 7.1,
      "grade": "A",
      "baseDamage": 1,
      "segments": 2,
      "damageType": "普通",
      "scaling": "两段独立伤害，目标越近每段伤害+1",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小野结衣",
        "宫樱子",
        "最佳化",
        "该结束了！",
        "杂鱼！杂鱼！",
        "善意面具"
      ],
      "combo_notes": "适用热忱快攻队/位移队。搭配移动倍增/控骰卡最大化位移收益。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_TCWVHjtq0i.webp",
      "character_full": "小野结衣",
      "attack_range": "前方最远3格+身后2格",
      "range_adjustment": -0.1,
      "_category": "attack_cards",
      "dims": {
        "power": 6.9,
        "flex": 6.7,
        "synergy": 7.1,
        "stable": 8.0
      },
      "brief": "优秀，收益直接，快攻侵略队组件，结衣专属。"
    },
    {
      "name": "休息时间！",
      "character": "葵",
      "cost": 2,
      "attribute": "无序",
      "type": "投掷",
      "effect": "对同一行内的一名其他玩家使用，其扣除2点同步值并获得[神醉]。[神醉]：下一次投掷的点数减半。",
      "sp": "对入间予使用时双方都可以获得1点引导核心。",
      "score": 6.2,
      "grade": "B",
      "baseDamage": 0,
      "segments": 0,
      "damageType": "特殊",
      "scaling": "扣2同步并施加神醉(下次投掷点数减半)",
      "archetypes": [
        "控场队"
      ],
      "recommended_with": [
        "黑色卡片",
        "善意面具",
        "入间予",
        "弱点分析",
        "集中",
        "打起精神来！"
      ],
      "combo_notes": "适用搭配减速/缴械卡形成控制链",
      "image_url": "assets/images/img_8j1QiILJvu.webp",
      "character_full": "小野葵",
      "attack_range": "同一行内一名玩家",
      "range_adjustment": 0.15,
      "_category": "attack_cards",
      "dims": {
        "power": 6.2,
        "flex": 5.9,
        "synergy": 6.3,
        "stable": 6.6
      },
      "brief": "合格可用，收益直接、泛用度高，控场队组件，葵专属。"
    },
    {
      "name": "最佳化",
      "character": "里尔亚斯",
      "cost": 4,
      "attribute": "混沌",
      "type": "增益",
      "effect": "提升自身5点攻击力（直到本回合结束），然后对自身前后4格内的一名其他玩家造成2点混沌属性伤害。",
      "sp": "这次攻击命中后可以再支付1点音韵值来造成1点混沌属性伤害。",
      "score": 7.8,
      "grade": "A+",
      "baseDamage": 2,
      "segments": 1,
      "damageType": "普通",
      "scaling": "命中后支付1音韵追加1点混沌伤害",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小野结衣",
        "宫樱子",
        "横扫之刃",
        "该结束了！",
        "杂鱼！杂鱼！",
        "红宝之杖·运"
      ],
      "combo_notes": "适用资源运转队/位移队/泛用。搭配高费卡或爆发卡，提供音韵支持。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_F65crB5KU9.webp",
      "character_full": "里尔亚斯·斯塔芙莉娅斯特",
      "attack_range": "前后4格内一名玩家",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 8.2,
        "flex": 7.1,
        "synergy": 7.3,
        "stable": 8.5
      },
      "brief": "强势，收益直接，快攻侵略队组件，里尔亚斯专属。"
    },
    {
      "name": "钢筋铁肘",
      "character": "里绪",
      "cost": 3,
      "attribute": "热忱",
      "type": "侵略",
      "effect": "向前方快速移动5格，之后可以对自身前后3格以内的一名其他玩家造成3点热忱属性伤害，此攻击具有贯穿效果。贯穿：成功破盾后仍旧给予其多出的伤害。",
      "sp": "造成的伤害将在角色等级达到Lv4/Lv7/Lv10(Max)时变为3/4/5点。",
      "score": 7.5,
      "grade": "A+",
      "baseDamage": 3,
      "segments": 1,
      "damageType": "普通",
      "scaling": "向前移动5格后攻击，具有贯穿(破盾后多余伤害生效)",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "幸运护符",
        "现实间里绪",
        "认真起来了！",
        "逃脱",
        "能量饮料",
        "小仓霞"
      ],
      "combo_notes": "适用热忱快攻队/位移队/快攻侵略队。搭配移动倍增/控骰卡最大化位移收益。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_uVrQLrUbyb.webp",
      "character_full": "现实间里绪",
      "attack_range": "前移5格后前后3格内一名玩家",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 7.3,
        "flex": 6.6,
        "synergy": 7.3,
        "stable": 7.7
      },
      "growth": 0.3,
      "brief": "优秀，收益直接，位移队组件，里绪专属。"
    },
    {
      "name": "安静些",
      "character": "莉莉",
      "cost": 3,
      "attribute": "无序",
      "type": "侵略",
      "effect": "对全图范围内的一名其他玩家使用，对其造成2点无序属性伤害。那之后检查其手牌，若其中有攻击卡的场合则将那张攻击卡送入墓地并对其施加1轮的[缴械]。",
      "sp": "[缴械]：持续期间内不可打出带有[侵略]标签的卡。",
      "score": 7.5,
      "grade": "A+",
      "baseDamage": 2,
      "segments": 1,
      "damageType": "普通",
      "scaling": "全图范围，命中后若目标手牌有攻击卡则送墓并缴械1轮",
      "archetypes": [
        "控场队"
      ],
      "recommended_with": [
        "黑色卡片",
        "善意面具",
        "入间予",
        "弱点分析",
        "集中",
        "打起精神来！"
      ],
      "combo_notes": "适用控场队/控场队/泛用。搭配多张拆卡卡快速消耗对手资源。搭配减速/缴械卡形成控制链",
      "image_url": "assets/images/img_yDHF6JTmH5.webp",
      "character_full": "莉莉·缇雅菲洛",
      "attack_range": "全图范围内一名玩家",
      "range_adjustment": 0.3,
      "_category": "attack_cards",
      "dims": {
        "power": 7.8,
        "flex": 7.3,
        "synergy": 7.1,
        "stable": 7.7
      },
      "brief": "强势，收益直接，控场队组件，莉莉专属。"
    },
    {
      "name": "人格修正拳！",
      "character": "琉璃",
      "cost": 3,
      "attribute": "混沌",
      "type": "侵略",
      "effect": "（可以向前移动3格）对自身前后4格范围内的一名其他玩家造成一次四面骰判定伤害，命中且造成4点以上伤害后可以随机打落其一张手卡。打落：受击者将被打落的卡送入墓地并且失去3点音韵值。",
      "sp": "这张卡在墓地时自己受到伤害后可以发动，将这张卡移出游戏来抵消那次伤害。",
      "score": 8.1,
      "grade": "S",
      "baseDamage": 2.5,
      "segments": 1,
      "damageType": "判定",
      "scaling": "4面骰判定伤害，造4点以上伤害时打落1张手卡",
      "archetypes": [
        "判定伤害队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间予",
        "钢笔",
        "蓝宝之杖·命",
        "破损电子设备",
        "秘技！摸头杀"
      ],
      "combo_notes": "适用判定伤害队。3费可前进3格+四面骰判定伤害，4点以上打落手卡（送墓+失去3音韵），sp墓地受伤害可移出游戏抵消伤害，攻防一体。搭配琉璃（判定伤害后回音韵+全队判定+1）、予（全队判定+1+控骰）、钢笔（判定+1+减费）、蓝杖（每回合追加判定伤害）、破损电子设备（低费判定+回收）形成判定循环。",
      "image_url": "assets/images/img_rytBHz0SiP.webp",
      "character_full": "小沙香琉璃",
      "attack_range": "前后4格内一名玩家",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 9.4,
        "flex": 7.1,
        "synergy": 8.6,
        "stable": 7.1
      },
      "brief": "核心级，收益直接，判定伤害队组件，琉璃专属。"
    },
    {
      "name": "夏日海滩踢击",
      "character": "琉璃(水着)",
      "cost": 3,
      "attribute": "热忱",
      "type": "移动",
      "effect": "对自身前方6格范围内的所有其他玩家造成一次四面骰判定伤害，那之后可以前进3格。",
      "sp": "命中且累计造成了4点以上伤害的场合后可以回复2点音韵值。",
      "score": 7.5,
      "grade": "A+",
      "baseDamage": 2.5,
      "segments": 1,
      "damageType": "判定",
      "scaling": "4面骰判定伤害，前方6格全体，之后前进3格",
      "archetypes": [
        "判定伤害队",
        "位移队",
        "热忱快攻队"
      ],
      "recommended_with": [
        "琉璃(水着)",
        "比翼恋理",
        "打起精神来！",
        "放轻松些",
        "小沙香琉璃",
        "入间予"
      ],
      "combo_notes": "适用判定伤害队、位移队、热忱快攻队。3费前方6格所有玩家四面骰判定伤害+前进3格，AOE判定伤害+位移，累计4点以上回2音韵。琉璃水着队长时搭配比翼恋理（热忱领域全队增益）；判定伤害队时搭配琉璃/予/钢笔/蓝杖提升判定伤害。",
      "image_url": "assets/images/img_9FUfMuUIbJ.webp",
      "character_full": "琉璃(水着)",
      "attack_range": "前方6格内所有玩家(AOE)",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 8.2,
        "flex": 6.6,
        "synergy": 8.2,
        "stable": 7.1
      },
      "brief": "强势，收益直接，判定伤害队组件，琉璃(水着)专属。"
    },
    {
      "name": "谢幕",
      "character": "露璐缇雅",
      "cost": 2,
      "attribute": "理智",
      "type": "移动",
      "effect": "后退4格，那之后驱散自身所有负面效果（在受到负面效果时也能发动）。",
      "sp": "如果在后退过程中触碰到其他玩家的场合还能对其造成1次四面骰判定伤害，如果目标正好与自己位于同一个格子上则改为造成1次六面骰判定伤害。",
      "score": 7.2,
      "grade": "A",
      "baseDamage": 2.5,
      "segments": 1,
      "damageType": "判定",
      "scaling": "后退4格并驱散自身所有负面效果",
      "archetypes": [
        "位移队",
        "判定伤害队"
      ],
      "recommended_with": [
        "露璐缇雅·爱德华",
        "小沙香琉璃",
        "入间予",
        "钢笔",
        "蓝宝之杖·命",
        "破损电子设备"
      ],
      "combo_notes": "适用判定伤害队、位移队。2费后退4格+驱散自身所有负面(受负面时也能发动)，后退过程中触碰身后4格内玩家造四面骰判定伤害(平均2.5)，同格改六面骰(平均3.5)，位移+驱散+判定伤害一体极低费。判定伤害队核心低费输出，搭配琉璃/予/钢笔/蓝杖吃判定增伤；位移队搭配予水着/枫水着/直尺。",
      "image_url": "assets/images/img_P9z9TVKULK.webp",
      "character_full": "露璐缇雅·爱德华",
      "attack_range": "后退4格过程中触碰玩家",
      "range_adjustment": -0.05,
      "_category": "attack_cards",
      "dims": {
        "power": 6.7,
        "flex": 6.9,
        "synergy": 8.5,
        "stable": 7.6
      },
      "brief": "优秀，收益直接，位移队组件，露璐缇雅专属。"
    },
    {
      "name": "该结束了！",
      "character": "霞",
      "cost": 5,
      "attribute": "热忱",
      "type": "侵略",
      "effect": "对同一行的一名其他玩家使用，对其造成足以击碎其当前护盾的伤害。",
      "sp": "对没有护盾的单位固定造成5点伤害。",
      "score": 6.9,
      "grade": "B",
      "baseDamage": 5,
      "segments": 1,
      "damageType": "普通",
      "scaling": "伤害=目标当前护盾值(足以击碎护盾)",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小野结衣",
        "宫樱子",
        "横扫之刃",
        "最佳化",
        "杂鱼！杂鱼！",
        "善意面具"
      ],
      "combo_notes": "适用搭配减速/缴械卡形成控制链",
      "image_url": "assets/images/img_rVfi2yisPj.webp",
      "character_full": "小仓霞",
      "attack_range": "同一行内一名玩家",
      "range_adjustment": 0.15,
      "_category": "attack_cards",
      "dims": {
        "power": 7.5,
        "flex": 6.1,
        "synergy": 6.3,
        "stable": 7.4
      },
      "brief": "合格可用，收益直接，快攻侵略队组件，霞专属。"
    },
    {
      "name": "案件还原",
      "character": "小春",
      "cost": 3,
      "attribute": "热忱",
      "type": "丰沛",
      "effect": "回收上一张使用的卡牌。",
      "sp": "如果被回收的卡标签为[侵略]还能对一名其他玩家造成2点热忱属性伤害。",
      "score": 7.4,
      "grade": "A",
      "baseDamage": 2,
      "segments": 1,
      "damageType": "普通",
      "scaling": "回收上一张使用的卡牌",
      "archetypes": [
        "位移队",
        "资源运转队"
      ],
      "recommended_with": [
        "怪怪幽灵吊坠",
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "逃脱"
      ],
      "combo_notes": "适用热忱快攻队。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_RhBCWqW0x2.webp",
      "character_full": "椎名小春",
      "attack_range": "SP：一名玩家（无距离限制）",
      "range_adjustment": 0.1,
      "_category": "attack_cards",
      "dims": {
        "power": 7.1,
        "flex": 6.9,
        "synergy": 7.7,
        "stable": 8.3
      },
      "brief": "优秀，收益直接，位移队组件，小春专属。"
    },
    {
      "name": "祛祟",
      "character": "伊织",
      "cost": 1,
      "attribute": "理智",
      "type": "驱散",
      "effect": "驱散一名玩家的所有负面效果以及附加的效果（在受到负面效果时也能发动）并选一名其他玩家适用效果：失去1点同步值。",
      "sp": "",
      "score": 6.5,
      "grade": "B",
      "baseDamage": 0,
      "segments": 0,
      "damageType": "特殊",
      "scaling": "驱散自身负面，选一名玩家失去1同步",
      "archetypes": [
        "破局队",
        "控场队"
      ],
      "recommended_with": [
        "小野伊织",
        "里绪(水着)",
        "共鸣者",
        "结晶碎弧",
        "遥控骰子",
        "特制手套"
      ],
      "combo_notes": "适用控场队。搭配减速/缴械卡形成控制链",
      "image_url": "assets/images/img_CEYwyNKafJ.webp",
      "character_full": "小野伊织",
      "attack_range": "无（驱散卡）",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 6.6,
        "flex": 6.1,
        "synergy": 6.5,
        "stable": 7.1
      },
      "brief": "合格可用，收益直接，破局队组件，伊织专属。"
    },
    {
      "name": "杂鱼！杂鱼！",
      "character": "樱子",
      "cost": 2,
      "attribute": "混沌",
      "type": "侵略",
      "effect": "对全图范围内的一名其他玩家使用，降低其3点防御值（直到本回合结束）。",
      "sp": "只要这张卡在墓地，防御值为负数的玩家受到的最终伤害+1。",
      "score": 7.8,
      "grade": "A+",
      "baseDamage": 0,
      "segments": 0,
      "damageType": "特殊",
      "scaling": "全图范围降低目标3点防御(直到回合结束)",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小野结衣",
        "宫樱子",
        "横扫之刃",
        "最佳化",
        "该结束了！",
        "善意面具"
      ],
      "combo_notes": "适用热忱快攻队。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_c56HyLkQLO.webp",
      "character_full": "宫樱子",
      "attack_range": "全图范围内一名玩家",
      "range_adjustment": 0.3,
      "_category": "attack_cards",
      "dims": {
        "power": 8.3,
        "flex": 7.3,
        "synergy": 7.2,
        "stable": 8.1
      },
      "brief": "强势，收益直接，快攻侵略队组件，樱子专属。"
    },
    {
      "name": "秘技！摸头杀",
      "character": "予",
      "cost": 2,
      "attribute": "无序",
      "type": "侵略",
      "effect": "对同一行内的一名其他玩家造成1点无序属性伤害，并且附加一次4面骰判定伤害。",
      "sp": "若目标包含枫则基础伤害提升至2点。",
      "score": 7.0,
      "grade": "A",
      "baseDamage": 3.5,
      "segments": 1,
      "damageType": "判定",
      "scaling": "1点无序伤害+4面骰判定伤害(平均2.5)",
      "archetypes": [
        "判定伤害队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间予",
        "人格修正拳！",
        "钢笔",
        "蓝宝之杖·命",
        "破损电子设备"
      ],
      "combo_notes": "适用判定伤害队/泛用。搭配判定增伤/回费卡形成判定循环",
      "image_url": "assets/images/img_5EzxBXInfH.webp",
      "character_full": "入间予",
      "attack_range": "同一行内一名玩家",
      "range_adjustment": 0.15,
      "_category": "attack_cards",
      "dims": {
        "power": 7.1,
        "flex": 6.5,
        "synergy": 8.1,
        "stable": 6.8
      },
      "brief": "优秀，收益直接，判定伤害队组件，予专属。"
    },
    {
      "name": "水枪攻击！",
      "character": "予(水着)",
      "cost": 2,
      "attribute": "理智",
      "type": "侵略",
      "effect": "对同一行的所有玩家造成2点理智属性伤害。（这张卡可以额外消耗音韵值打出，每额外消耗1点音韵值来增加1点理智属性伤害，最多额外消耗3点）",
      "sp": "受到伤害的玩家下一次使用的卡所需要的音韵值+1。",
      "score": 7.7,
      "grade": "A+",
      "baseDamage": 2,
      "segments": 1,
      "damageType": "普通",
      "scaling": "可额外消耗音韵+1伤害(最多+3)",
      "archetypes": [
        "位移队",
        "控场队"
      ],
      "recommended_with": [
        "予(水着)",
        "枫(水着)",
        "星奈(水着)",
        "设计师的直尺",
        "能量饮料",
        "夏日畅饮时间！"
      ],
      "combo_notes": "适用资源运转队/位移队。搭配高费卡或爆发卡，提供音韵支持",
      "image_url": "assets/images/img_d3Z599tJ4l.webp",
      "character_full": "予(水着)",
      "attack_range": "同一行所有玩家(AOE)",
      "range_adjustment": 0.25,
      "_category": "attack_cards",
      "dims": {
        "power": 8.7,
        "flex": 6.5,
        "synergy": 7.6,
        "stable": 8.0
      },
      "brief": "强势，收益直接，位移队组件，予(水着)专属。"
    },
    {
      "name": "正义风纪委员飞踢",
      "character": "羽奈",
      "cost": 3,
      "attribute": "理智",
      "type": "移动",
      "effect": "前进/后退3-6格，那之后可以对和自身处于同一个格子上的其他玩家造成2点理智属性伤害并将其击退4格。",
      "sp": "[击退]：因击退而到达的格子无法触发其效果。",
      "score": 6.8,
      "grade": "B",
      "baseDamage": 2,
      "segments": 1,
      "damageType": "普通",
      "scaling": "前进/后退3-6格，同格造2伤害并击退4格",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "予(水着)",
        "枫(水着)",
        "星奈(水着)",
        "设计师的直尺",
        "能量饮料",
        "四叶草发卡"
      ],
      "combo_notes": "适用位移队/位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_6u1ljvBnvy.webp",
      "character_full": "雨宫羽奈",
      "attack_range": "同格玩家",
      "range_adjustment": -0.25,
      "_category": "attack_cards",
      "dims": {
        "power": 6.6,
        "flex": 6.7,
        "synergy": 6.8,
        "stable": 7.2
      },
      "brief": "合格可用，收益直接，位移队组件，羽奈专属。"
    },
    {
      "name": "你呀你呀",
      "character": "雨清",
      "cost": 2,
      "attribute": "理智",
      "type": "增益",
      "effect": "对一名玩家使用，其提升1点防御值并且下一次的攻击无视3点护盾。",
      "sp": "队伍中的[增益者][增幅者]角色合计为2名以上时提升的防御值改为2点。",
      "score": 6.9,
      "grade": "B",
      "baseDamage": 0,
      "segments": 0,
      "damageType": "特殊",
      "scaling": "目标+1防御且下次攻击无视3护盾",
      "archetypes": [
        "泛用辅助"
      ],
      "recommended_with": [
        "松山惠",
        "予(水着)",
        "枫(水着)",
        "放轻松些",
        "夏日畅饮时间！",
        "钢笔"
      ],
      "combo_notes": "适用搭配减速/缴械卡形成控制链",
      "image_url": "assets/images/img_e6yk5jnQa0.webp",
      "character_full": "宁雨清",
      "attack_range": "无（增益卡）",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 6.2,
        "flex": 7.1,
        "synergy": 6.6,
        "stable": 8.2
      },
      "brief": "合格可用，收益直接、泛用度高，泛用辅助组件，雨清专属。"
    },
    {
      "name": "狩猎之少女",
      "character": "里绪(水着)",
      "cost": 2,
      "attribute": "热忱",
      "type": "移动",
      "effect": "立即移动到与自身所处同一行的一名其他玩家所在的格子。",
      "sp": "本次移动超过6格的场合可以抽取一张[馈赠卡]。",
      "score": 7.8,
      "grade": "A+",
      "baseDamage": 0,
      "segments": 0,
      "damageType": "特殊",
      "scaling": "立即移动到同一行一名其他玩家所在格子",
      "archetypes": [
        "破局队",
        "位移队"
      ],
      "recommended_with": [
        "小野伊织",
        "里绪(水着)",
        "共鸣者",
        "结晶碎弧",
        "遥控骰子",
        "特制手套"
      ],
      "combo_notes": "适用位移队/破局队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_76lHT2rq0d.webp",
      "character_full": "里绪(水着)",
      "attack_range": "移动到同一行目标格",
      "range_adjustment": -0.05,
      "_category": "attack_cards",
      "dims": {
        "power": 7.4,
        "flex": 7.4,
        "synergy": 8.4,
        "stable": 8.8
      },
      "brief": "强势，收益直接，破局队组件，里绪(水着)专属。"
    },
    {
      "name": "清凉时间！",
      "character": "星奈(水着)",
      "cost": 3,
      "attribute": "理智",
      "type": "侵略",
      "effect": "星奈向前移动3格，然后对自身前方2格范围内的所有玩家造成2段伤害：1点判定伤害和1点理智属性伤害。",
      "sp": "本次攻击会无视目标2点防御值。",
      "score": 7.6,
      "grade": "A+",
      "baseDamage": 2,
      "segments": 2,
      "damageType": "判定",
      "scaling": "2段伤害：1点判定+1点理智",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "予(水着)",
        "枫(水着)",
        "星奈(水着)",
        "设计师的直尺",
        "能量饮料",
        "夏日畅饮时间！"
      ],
      "combo_notes": "适用判定伤害队/位移队/位移队。搭配判定增伤/回费卡形成判定循环。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_9YPerM1CwR.webp",
      "character_full": "星奈(水着)",
      "attack_range": "前方2格内所有玩家(AOE)",
      "range_adjustment": -0.05,
      "_category": "attack_cards",
      "dims": {
        "power": 7.9,
        "flex": 7.1,
        "synergy": 8.6,
        "stable": 7.2
      },
      "brief": "强势，收益直接，位移队组件，星奈(水着)专属。"
    },
    {
      "name": "夏日泳圈攻击！",
      "character": "枫(水着)",
      "cost": 3,
      "attribute": "理智",
      "type": "破甲",
      "effect": "枫向自身前方或后方方向飞掷一个泳圈飞行物，泳圈在不触碰到玩家的场合最远可以飞行4格。泳圈在命中其他玩家单位后会对其造成2点理智属性伤害并降低其1点防御值。随后继续沿着当前方向继续飞行，这次飞行命中玩家后会造成同等伤害和破甲效果。泳圈会在飞行至最远距离并且没有触碰到玩家后立即销毁，否则会保持飞行状态。",
      "sp": "",
      "score": 7.6,
      "grade": "A+",
      "baseDamage": 2,
      "segments": 1,
      "damageType": "普通",
      "scaling": "可连续命中多个目标",
      "archetypes": [
        "位移队",
        "控场队"
      ],
      "recommended_with": [
        "予(水着)",
        "枫(水着)",
        "星奈(水着)",
        "设计师的直尺",
        "能量饮料",
        "四叶草发卡"
      ],
      "combo_notes": "适用位移队/位移队/快攻侵略队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_AzVyk90HGB.webp",
      "character_full": "枫(水着)",
      "attack_range": "前/后方飞行物最远4格，命中后继续飞行(穿透)",
      "range_adjustment": 0.0,
      "_category": "attack_cards",
      "dims": {
        "power": 7.8,
        "flex": 6.8,
        "synergy": 7.5,
        "stable": 8.4
      },
      "brief": "强势，收益直接，位移队组件，枫(水着)专属。"
    }
  ],
  "skill_cards": [
    {
      "name": "弱点分析",
      "character": "冬马",
      "cost": 3,
      "attribute": "无序",
      "type": "增益",
      "effect": "选择一名玩家才能使用。其在一次行动内获得以下效果：获得25%的暴击率，造成的暴击伤害增加50%。",
      "sp": "",
      "score": 7.8,
      "grade": "A+",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "黑色卡片",
        "善意面具",
        "入间予",
        "集中",
        "打起精神来！",
        "剖析"
      ],
      "combo_notes": "适用热忱快攻队。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_OU0nirkKeu.webp",
      "character_full": "现实间冬马",
      "_category": "skill_cards",
      "dims": {
        "power": 7.3,
        "flex": 8.1,
        "synergy": 7.9,
        "stable": 8.2
      },
      "brief": "强势，收益直接、泛用度高，快攻侵略队组件，冬马专属。"
    },
    {
      "name": "鼓舞",
      "character": "枫",
      "cost": 3,
      "attribute": "混沌",
      "type": "增益",
      "effect": "选择一名玩家，其一次行动内：①+20%控骰 ②期间内一次位移x2。",
      "sp": "每次使用后费用-1，最多降至1点(入间予在场可降至0)",
      "score": 7.2,
      "grade": "A",
      "archetypes": [
        "位移队",
        "判定伤害队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间枫",
        "宫樱子",
        "人格修正拳！",
        "杂鱼！杂鱼！",
        "好孩子的奖励"
      ],
      "combo_notes": "适用位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_mUgBpdwDZR.webp",
      "character_full": "入间枫",
      "_category": "skill_cards",
      "dims": {
        "power": 7.1,
        "flex": 7.0,
        "synergy": 7.0,
        "stable": 7.8
      },
      "brief": "优秀，收益直接，位移队组件，枫专属。"
    },
    {
      "name": "集中",
      "character": "光太郎",
      "cost": 2,
      "attribute": "无序",
      "type": "增益",
      "effect": "自己回合选一名玩家，其+1攻击并获得500金币。",
      "sp": "",
      "lv": "Lv1/7: 2/1",
      "score": 7.3,
      "grade": "A",
      "archetypes": [
        "泛用"
      ],
      "recommended_with": [
        "黑色卡片",
        "善意面具",
        "入间予",
        "弱点分析",
        "打起精神来！",
        "剖析"
      ],
      "combo_notes": "适用资源运转队",
      "image_url": "assets/images/img_qhKTTGtFmB.webp",
      "character_full": "木原光太郎",
      "_category": "skill_cards",
      "dims": {
        "power": 6.7,
        "flex": 7.5,
        "synergy": 7.3,
        "stable": 8.1
      },
      "brief": "优秀，收益直接、泛用度高，泛用组件，光太郎专属。"
    },
    {
      "name": "共鸣",
      "character": "惠",
      "cost": 4,
      "attribute": "理智",
      "type": "丰沛",
      "effect": "自己回合选一名玩家，其抽1张馈赠卡。",
      "sp": "此卡进墓地后可花2音韵回收，被回收后使用放回牌组最下方",
      "lv": "Lv1/7: 4/3",
      "score": 7.3,
      "grade": "A",
      "archetypes": [
        "破局队"
      ],
      "recommended_with": [
        "松山惠",
        "予(水着)",
        "枫(水着)",
        "放轻松些",
        "夏日畅饮时间！",
        "钢笔"
      ],
      "combo_notes": "适用资源运转队/资源运转队/破局队。搭配高费卡或爆发卡，提供音韵支持",
      "image_url": "assets/images/img_81V0l2An2A.webp",
      "character_full": "松山惠",
      "_category": "skill_cards",
      "dims": {
        "power": 7.2,
        "flex": 6.9,
        "synergy": 7.3,
        "stable": 8.1
      },
      "brief": "优秀，收益直接，破局队组件，惠专属。"
    },
    {
      "name": "祓禊",
      "character": "结衣",
      "cost": 3,
      "attribute": "热忱",
      "type": "侵略",
      "effect": "自己回合选一名其他玩家，对其造1热忱伤害，之后从墓地回收1张[侵略]标签的卡。",
      "sp": "",
      "score": 7.8,
      "grade": "A+",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "怪怪幽灵吊坠",
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "逃脱"
      ],
      "combo_notes": "适用热忱快攻队。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_SjMpZy96gh.webp",
      "character_full": "小野结衣",
      "_category": "skill_cards",
      "dims": {
        "power": 7.4,
        "flex": 7.5,
        "synergy": 7.9,
        "stable": 8.8
      },
      "brief": "强势，收益直接，快攻侵略队组件，结衣专属。"
    },
    {
      "name": "打起精神来！",
      "character": "葵",
      "cost": 3,
      "attribute": "无序",
      "type": "投掷",
      "effect": "为一名玩家追加一个掷骰阶段。Lv4追加：使用后让自己抽一张。Lv7追加：使用后让目标抽一张。",
      "sp": "",
      "lv": "Lv1/4: 3/2",
      "score": 7.0,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "黑色卡片",
        "善意面具",
        "入间予",
        "弱点分析",
        "集中",
        "剖析"
      ],
      "combo_notes": "通用功能卡，可根据构筑需求加入",
      "image_url": "assets/images/img_DESkelBkoU.webp",
      "character_full": "小野葵",
      "_category": "skill_cards",
      "dims": {
        "power": 6.7,
        "flex": 6.4,
        "synergy": 6.6,
        "stable": 7.2
      },
      "growth": 0.3,
      "brief": "优秀，收益直接，位移队组件，葵专属。"
    },
    {
      "name": "超频",
      "character": "里尔亚斯",
      "cost": 3,
      "attribute": "混沌",
      "type": "增益",
      "effect": "选择一名玩家才能发动，扣除其1点同步值然后赋予其持续2次行动的[超频]和50%的暴击伤害加成。",
      "sp": "[超频]持续期间内可以额外消耗最多5点音韵值，超出持有的音韵值的那部分将作为负数扣除。Lv7追加：额外消耗的音韵值提升至7点，但会扣除目标3点同步值。",
      "score": 8.1,
      "grade": "S",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间枫",
        "宫樱子",
        "人格修正拳！",
        "杂鱼！杂鱼！",
        "鼓舞"
      ],
      "combo_notes": "适用资源运转队。搭配高费卡或爆发卡，提供音韵支持",
      "image_url": "assets/images/img_MSmVvAVVOv.webp",
      "character_full": "里尔亚斯·斯塔芙莉娅斯特",
      "_category": "skill_cards",
      "dims": {
        "power": 7.7,
        "flex": 7.7,
        "synergy": 7.8,
        "stable": 8.2
      },
      "growth": 0.3,
      "brief": "核心级，收益直接，快攻侵略队组件，里尔亚斯专属。"
    },
    {
      "name": "认真起来了！",
      "character": "里绪",
      "cost": 2,
      "attribute": "热忱",
      "type": "移动",
      "effect": "自己回合发动，前进3格。",
      "sp": "此卡进墓地后可花1音韵回收，被回收后使用放回牌组最下方",
      "score": 7.1,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "怪怪幽灵吊坠",
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "逃脱",
        "Twice"
      ],
      "combo_notes": "适用资源运转队/位移队。搭配高费卡或爆发卡，提供音韵支持。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_rJAMoFKD8h.webp",
      "character_full": "现实间里绪",
      "_category": "skill_cards",
      "dims": {
        "power": 6.5,
        "flex": 7.1,
        "synergy": 7.2,
        "stable": 8.1
      },
      "brief": "优秀，收益直接、泛用度高，位移队组件，里绪专属。"
    },
    {
      "name": "狡黠之跃",
      "character": "莉莉",
      "cost": 3,
      "attribute": "无序",
      "type": "移动",
      "effect": "莉莉跃向对行相同位置的格子。Lv4追加：发动后可以在本回合结束前跳跃回此技能发动前所在的位置，但这次移动不会触发格子效果。",
      "sp": "",
      "lv": "Lv1/7: 3/2",
      "score": 7.4,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "剖析",
        "绿宝之杖·择",
        "魔法清点名单",
        "现实间冬马",
        "某女士爱用球棒",
        "\"拦路者\""
      ],
      "combo_notes": "适用位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_VUvv4VTU9X.webp",
      "character_full": "莉莉·缇雅菲洛",
      "_category": "skill_cards",
      "dims": {
        "power": 6.4,
        "flex": 7.6,
        "synergy": 7.4,
        "stable": 8.0
      },
      "growth": 0.2,
      "brief": "优秀，收益直接、泛用度高，位移队组件，莉莉专属。"
    },
    {
      "name": "比翼恋理",
      "character": "琉璃(水着)",
      "cost": 5,
      "attribute": "热忱",
      "type": "领域",
      "effect": "展开自身前后4格领域，持续3次行动。领域内友方：热忱克制伤害+100%，攻击+50%，判定伤害+2。新领域覆盖旧领域。",
      "sp": "",
      "lv": "Lv1/4/7/10: 5/4/3/2",
      "score": 7.3,
      "grade": "A",
      "archetypes": [
        "热忱快攻队",
        "判定伤害队"
      ],
      "recommended_with": [
        "琉璃(水着)",
        "夏日海滩踢击",
        "打起精神来！",
        "放轻松些",
        "小沙香琉璃",
        "入间予"
      ],
      "combo_notes": "适用判定伤害队/热忱快攻队/位移队。搭配判定增伤/回费卡形成判定循环。搭配移动倍增/控骰卡最大化位移收益。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_0PdJIYEiwY.webp",
      "character_full": "琉璃(水着)",
      "_category": "skill_cards",
      "dims": {
        "power": 6.9,
        "flex": 7.1,
        "synergy": 8.4,
        "stable": 7.6
      },
      "brief": "优秀，收益直接，热忱快攻队组件，琉璃(水着)专属。"
    },
    {
      "name": "好孩子的奖励",
      "character": "琉璃",
      "cost": 2,
      "attribute": "混沌",
      "type": "疗愈",
      "effect": "选择一名玩家，其回3同步，之后自己和其下一次使用卡费用-1(新减费替换旧减费)。",
      "sp": "Lv4/7/10时回复同步变为4/6/8点",
      "score": 7.5,
      "grade": "A+",
      "archetypes": [
        "判定伤害队",
        "资源运转队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间予",
        "人格修正拳！",
        "秘技！摸头杀",
        "钢笔",
        "蓝宝之杖·命"
      ],
      "combo_notes": "通用功能卡，可根据构筑需求加入",
      "image_url": "assets/images/img_XLQKhlAY5H.webp",
      "character_full": "小沙香琉璃",
      "_category": "skill_cards",
      "dims": {
        "power": 6.8,
        "flex": 7.1,
        "synergy": 7.5,
        "stable": 8.3
      },
      "growth": 0.2,
      "brief": "强势，收益直接，判定伤害队组件，琉璃专属。"
    },
    {
      "name": "拿手好戏",
      "character": "露璐缇雅",
      "cost": 4,
      "attribute": "理智",
      "type": "破坏",
      "effect": "自己的回合选择一名其他玩家才能发动，破坏其区域内的一张卡。Lv4追加：根据被破坏卡的属性还可以适用效果：①无序(灰)，将被破坏的卡片移出游戏。那之后此技能卡销毁，自己失去3点音韵值。②热忱(红)，给予其3点热忱属性伤害③理智(蓝)回复3点音韵值④混沌(紫)，回复3点同步值。",
      "sp": "",
      "score": 7.9,
      "grade": "A+",
      "archetypes": [
        "控场队"
      ],
      "recommended_with": [
        "钢笔",
        "露璐缇雅·爱德华",
        "宁雨清",
        "掌握",
        "风纪委员的手段",
        "镇定药片"
      ],
      "combo_notes": "适用热忱快攻队/资源运转队/控场队。搭配高费卡或爆发卡，提供音韵支持。搭配多张拆卡卡快速消耗对手资源。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_vfIGnYFOBC.webp",
      "character_full": "露璐缇雅·爱德华",
      "_category": "skill_cards",
      "dims": {
        "power": 9.3,
        "flex": 6.5,
        "synergy": 6.7,
        "stable": 7.4
      },
      "growth": 0.2,
      "brief": "强势，收益直接，控场队组件，露璐缇雅专属。"
    },
    {
      "name": "逃脱",
      "character": "霞",
      "cost": 3,
      "attribute": "热忱",
      "type": "移动",
      "effect": "立即移动至当前回合玩家所在行的任意交互格，或者任意公交站/地铁格的前后1格以内的格子。",
      "sp": "Lv4追加：移动完成后的下一次投掷点数可以增减1点。",
      "lv": "Lv1/4: 3/2",
      "score": 7.4,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "能量饮料",
        "小仓霞"
      ],
      "combo_notes": "适用位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_rUvawLYCzy.webp",
      "character_full": "小仓霞",
      "_category": "skill_cards",
      "dims": {
        "power": 6.4,
        "flex": 7.6,
        "synergy": 7.2,
        "stable": 8.0
      },
      "growth": 0.2,
      "brief": "优秀，收益直接、泛用度高，位移队组件，霞专属。"
    },
    {
      "name": "这不是逃跑！",
      "character": "小春",
      "cost": 2,
      "attribute": "热忱",
      "type": "移动",
      "effect": "自己回合发动，后退3格。",
      "sp": "",
      "lv": "Lv1/7: 2/1",
      "score": 7.2,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "怪怪幽灵吊坠",
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "逃脱"
      ],
      "combo_notes": "适用位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_SmAkxElXYP.webp",
      "character_full": "椎名小春",
      "_category": "skill_cards",
      "dims": {
        "power": 6.6,
        "flex": 7.2,
        "synergy": 7.3,
        "stable": 8.2
      },
      "brief": "优秀，收益直接、泛用度高，位移队组件，小春专属。"
    },
    {
      "name": "掌握",
      "character": "伊织",
      "cost": 3,
      "attribute": "理智",
      "type": "丰沛",
      "effect": "自己的回合选择一名玩家才能发动，其抽二张卡，然后选一张卡送入墓地。",
      "sp": "",
      "lv": "Lv1/7: 3/2",
      "score": 7.5,
      "grade": "A+",
      "archetypes": [
        "资源运转队"
      ],
      "recommended_with": [
        "小野伊织",
        "小沙香琉璃",
        "现实间里绪",
        "黑色卡片",
        "钢笔",
        "鸣奏之\"圣音\""
      ],
      "combo_notes": "适用资源运转队/滤牌队。选队友可帮助过牌滤牌，选对手可迫使弃牌打乱节奏。搭配抽卡/回费卡形成资源优势",
      "image_url": "assets/images/img_dD5sVjOACw.webp",
      "character_full": "小野伊织",
      "_category": "skill_cards",
      "dims": {
        "power": 7.2,
        "flex": 7.1,
        "synergy": 7.6,
        "stable": 8.4
      },
      "brief": "强势，收益直接，资源运转队组件，伊织专属。"
    },
    {
      "name": "交给我就好了",
      "character": "樱子",
      "cost": 2,
      "attribute": "混沌",
      "type": "疗愈",
      "effect": "自己回合选一名玩家，其前进2格并回2同步。",
      "sp": "Lv4/7/10时回复同步变为3/4/6点",
      "score": 7.8,
      "grade": "A+",
      "archetypes": [
        "位移队",
        "资源运转队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间枫",
        "宫樱子",
        "人格修正拳！",
        "杂鱼！杂鱼！",
        "鼓舞"
      ],
      "combo_notes": "适用位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_fUm4ElXvzh.webp",
      "character_full": "宫樱子",
      "_category": "skill_cards",
      "dims": {
        "power": 7.0,
        "flex": 7.6,
        "synergy": 7.7,
        "stable": 8.6
      },
      "growth": 0.2,
      "brief": "强势，收益直接、泛用度高，位移队组件，樱子专属。"
    },
    {
      "name": "剖析",
      "character": "予",
      "cost": 2,
      "attribute": "无序",
      "type": "移动",
      "effect": "自己回合发动，前进/后退1格。可额外消耗音韵发动，每额外耗1音韵+1格位移。",
      "sp": "",
      "lv": "Lv1/4: 2/1",
      "score": 7.3,
      "grade": "A",
      "archetypes": [
        "判定伤害队",
        "位移队"
      ],
      "recommended_with": [
        "黑色卡片",
        "善意面具",
        "入间予",
        "弱点分析",
        "集中",
        "打起精神来！"
      ],
      "combo_notes": "适用资源运转队/位移队。搭配高费卡或爆发卡，提供音韵支持。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_bqofyINGAU.webp",
      "character_full": "入间予",
      "_category": "skill_cards",
      "dims": {
        "power": 6.4,
        "flex": 7.6,
        "synergy": 7.7,
        "stable": 8.0
      },
      "brief": "优秀，收益直接、泛用度高，判定伤害队组件，予专属。"
    },
    {
      "name": "夏日畅饮时间！",
      "character": "予(水着)",
      "cost": 3,
      "attribute": "理智",
      "type": "增益",
      "effect": "所有友方获得：①立即从牌组加入无序以外的[战术]或[移动]道具卡(无法加入则不处理) ②下一次造伤害附带硬币判定伤害(正面2点，背面0)。",
      "sp": "此卡使用时视为[移动]标签道具卡",
      "lv": "Lv1/7: 3/2",
      "score": 7.7,
      "grade": "A+",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "予(水着)",
        "枫(水着)",
        "星奈(水着)",
        "设计师的直尺",
        "能量饮料",
        "四叶草发卡"
      ],
      "combo_notes": "适用位移队。3费所有友方从牌组加入战术/移动道具卡+下次造伤害附带硬币判定（正面2背面0），检索+增伤一体，视为移动标签卡。搭配予水着（全队伤害变理智+回费）、枫水着（理智伤害追加+位移）、星奈水着（大位移多段伤害）、直尺（移动造伤害）、能量饮料（移动倍率）。",
      "image_url": "assets/images/img_8xf7XNWneb.webp",
      "character_full": "予(水着)",
      "_category": "skill_cards",
      "dims": {
        "power": 7.4,
        "flex": 7.7,
        "synergy": 8.9,
        "stable": 7.4
      },
      "brief": "强势，收益直接，位移队组件，予(水着)专属。"
    },
    {
      "name": "风纪委员的手段",
      "character": "羽奈",
      "cost": 4,
      "attribute": "理智",
      "type": "移动",
      "effect": "自己的回合才能使用。向前方快速移动3格，如果终点处有其他玩家还可以破坏其一张卡。Lv7追加：现在羽奈可以破坏快速移动路径上的其他玩家的卡，但每次移动仅能破坏一张卡。",
      "sp": "",
      "lv": "Lv1/4: 4/3",
      "score": 7.3,
      "grade": "A",
      "archetypes": [
        "位移队",
        "控场队"
      ],
      "recommended_with": [
        "入间枫",
        "绿宝之杖·择",
        "松山惠",
        "予(水着)",
        "枫(水着)",
        "夏日畅饮时间！"
      ],
      "combo_notes": "适用位移队/控场队。搭配移动倍增/控骰卡最大化位移收益。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_9dEk7BbeP3.webp",
      "character_full": "雨宫羽奈",
      "_category": "skill_cards",
      "dims": {
        "power": 7.2,
        "flex": 6.3,
        "synergy": 7.0,
        "stable": 7.6
      },
      "growth": 0.3,
      "brief": "优秀，收益直接，位移队组件，羽奈专属。"
    },
    {
      "name": "查阅",
      "character": "雨清",
      "cost": 4,
      "attribute": "理智",
      "type": "丰沛",
      "effect": "自己的回合才能发动，从牌组、墓地、移出游戏的卡中将一张标签为[丰沛]、[投掷]、[侵略]或[声乐]的卡加入手卡。",
      "sp": "雨清使用此技能加入的卡时所消耗的音韵值-1。",
      "lv": "Lv1/7: 4/3",
      "score": 7.9,
      "grade": "A+",
      "archetypes": [
        "资源运转队",
        "判定伤害队"
      ],
      "recommended_with": [
        "松山惠",
        "予(水着)",
        "枫(水着)",
        "放轻松些",
        "夏日畅饮时间！",
        "钢笔"
      ],
      "combo_notes": "适用资源运转队/控场队。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_PDuiTSUGUV.webp",
      "character_full": "宁雨清",
      "_category": "skill_cards",
      "dims": {
        "power": 8.2,
        "flex": 7.2,
        "synergy": 8.0,
        "stable": 8.6
      },
      "brief": "核心级，收益直接，资源运转队组件，雨清专属。"
    },
    {
      "name": "一刀两断！打西瓜！",
      "character": "枫(水着)",
      "cost": 3,
      "attribute": "理智",
      "type": "攻击",
      "effect": "对一名其他玩家造成2点理智伤害，然后降低其2点防御值（持续2次行动）。",
      "sp": "这张卡在墓地存在时，自己可以把一张卡送入墓地来发动，墓地的这张卡加入手卡。",
      "score": 7.8,
      "grade": "A+",
      "archetypes": [
        "位移队",
        "控场队"
      ],
      "recommended_with": [
        "枫(水着)",
        "小沙香琉璃",
        "予(水着)",
        "夏日畅饮时间！",
        "设计师的直尺",
        "侦探放大镜"
      ],
      "combo_notes": "适用位移队/快攻侵略队。搭配枫(水着)队长触发追伤被动，降防后配合高伤攻击卡爆发。墓地回收SP可配合献祭/送墓卡循环",
      "image_url": "assets/images/img_uZjl4gBK6Y.webp",
      "character_full": "枫(水着)",
      "_category": "skill_cards",
      "dims": {
        "power": 8.3,
        "flex": 7.0,
        "synergy": 7.5,
        "stable": 8.4
      },
      "brief": "强势，收益直接，位移队组件，枫(水着)专属。"
    }
  ],
  "item_permanent": [
    {
      "name": "风纪委员臂章",
      "cost": 6,
      "attribute": "理智",
      "type": "侵略",
      "effect": "发动时：给予一名玩家3理智伤害。永续：理智最终伤害+1，0-13格范围内20%控骰",
      "score": 7.5,
      "grade": "A+",
      "archetypes": [
        "控场队"
      ],
      "recommended_with": [
        "松山惠",
        "予(水着)",
        "枫(水着)",
        "放轻松些",
        "夏日畅饮时间！",
        "钢笔"
      ],
      "combo_notes": "适用热忱快攻队/位移队/位移队。搭配移动倍增/控骰卡最大化位移收益。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_WRw1FlKIMG.webp",
      "_category": "item_permanent",
      "dims": {
        "power": 8.5,
        "cost": 6.4,
        "flex": 7.1,
        "synergy": 7.0,
        "stable": 8.0
      },
      "brief": "强势，收益直接、泛用度高，控场队组件。"
    },
    {
      "name": "Huginn&Muninn",
      "cost": 5,
      "attribute": "战术",
      "type": "永续",
      "effect": "一红一蓝，一明一暗。发动时作为效果处理：对一名其他玩家造成3点混沌属性伤害并让自身攻击力+3。一局游戏只能使用一次：支付3点音韵值发动，从墓地或移出游戏的卡中选一张[侵略]标签的卡加入手卡。那之后造成的最终伤害+1。",
      "score": 7.9,
      "grade": "A+",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小野结衣",
        "宫樱子",
        "横扫之刃",
        "最佳化",
        "该结束了！",
        "善意面具"
      ],
      "combo_notes": "适用快攻侵略队。发动即造3混沌并加攻，再付费回收墓地/移出区侵略卡形成资源循环，搭配攻击增伤/破甲卡提升输出。",
      "image_url": "assets/images/img_d6WbOr2gL9.webp",
      "_category": "item_permanent",
      "card_type": "道具/永续",
      "tags": [
        "战术",
        "永续",
        "直伤",
        "混沌",
        "攻击力上升",
        "回收",
        "侵略",
        "最终伤害"
      ],
      "dims": {
        "power": 8.5,
        "cost": 6.8,
        "flex": 7.4,
        "synergy": 7.7,
        "stable": 8.8
      },
      "brief": "发动即造3点混沌并自我攻击力+3，可一局一次付费从墓地/移出区回收[侵略]卡并强化最终伤害，侵略快攻多功能永续。"
    },
    {
      "name": "钢笔",
      "cost": 7,
      "attribute": "理智",
      "type": "战术",
      "effect": "发动时作为效果处理：从牌组、墓地将一张攻击卡或技能卡加入手卡。那之后可以选一张手卡送入墓地然后抽一张。使用攻击卡和技能卡所需要的音韵值-1。造成的判定伤害+1。",
      "score": 8.0,
      "grade": "S",
      "archetypes": [
        "判定伤害队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间予",
        "人格修正拳！",
        "秘技！摸头杀",
        "蓝宝之杖·命",
        "破损电子设备"
      ],
      "combo_notes": "适用判定伤害队。7费发动检索攻击/技能卡+可丢1抽1，永续攻击/技能卡费用-1+判定伤害+1，检索+减费+判定增伤三合一，判定伤害队最强永续。搭配琉璃（判定后回音韵+全队判定+1）、予（全队判定+1+控骰）、人格修正拳/摸头杀/蓝杖/破损电子设备形成判定循环。",
      "image_url": "assets/images/img_v3L1fg9il2.webp",
      "_category": "item_permanent",
      "dims": {
        "power": 8.2,
        "cost": 6.9,
        "flex": 7.9,
        "synergy": 8.8,
        "stable": 8.4
      },
      "brief": "核心级，收益直接、泛用度高，判定伤害队组件。"
    },
    {
      "name": "共鸣者",
      "cost": 5,
      "attribute": "热忱",
      "type": "声乐",
      "effect": "发动时作为效果处理：抽取一张馈赠卡。只要此卡以正面形式存在区域内则使用者获得效果：持有者抽到[Noise]和[和声]的概率增加（持有者在抽取馈赠卡时，馈赠卡卡池中不会出现[200$]，其余卡数量不变）。",
      "score": 7.0,
      "grade": "A",
      "archetypes": [
        "破局队"
      ],
      "recommended_with": [
        "小野伊织",
        "里绪(水着)",
        "结晶碎弧",
        "遥控骰子",
        "特制手套",
        "狩猎之少女"
      ],
      "combo_notes": "适用破局队。5费发动抽1馈赠卡，永续抽馈赠时卡池不含200$（提高中高奖概率），破局队稳定抽馈赠。搭配伊织（馈赠不抽500$+投掷选2+神社回费抽馈赠）、里绪水着（首次馈赠必中和声+首次神社必中大吉）、结晶碎弧（降入迷值）、遥控骰子（控馈赠骰）、特制手套（改骰+检索）。",
      "image_url": "assets/images/img_JFnk4AwmUZ.webp",
      "_category": "item_permanent",
      "dims": {
        "power": 6.8,
        "cost": 6.9,
        "flex": 7.0,
        "synergy": 6.9,
        "stable": 7.7
      },
      "brief": "优秀，收益直接，破局队组件。"
    },
    {
      "name": "黑色卡片",
      "cost": 6,
      "attribute": "无序",
      "type": "丰沛",
      "effect": "每个自己回合开始时可以额外抽取1张卡；消耗金币的场合可以减少1000金币的花费（最少降至0）。每个自己回合的首次献祭可以额外回复1点音韵值。",
      "score": 8.2,
      "grade": "S",
      "archetypes": [
        "破局流",
        "资源运转队"
      ],
      "recommended_with": [
        "里绪(水着)",
        "小野伊织",
        "结晶碎弧",
        "共鸣者",
        "护符",
        "吊坠",
        "经文"
      ],
      "combo_notes": "适用资源运转队/资源运转队/资源运转队。搭配高费卡或爆发卡，提供音韵支持",
      "image_url": "assets/images/img_uDJ22RFVA7.webp",
      "_category": "item_permanent",
      "dims": {
        "power": 8.2,
        "cost": 6.8,
        "flex": 9.5,
        "synergy": 7.9,
        "stable": 8.7
      },
      "brief": "核心级，收益直接、泛用度高，破局流组件。"
    },
    {
      "name": "镌刻的艺术",
      "cost": 4,
      "attribute": "战术",
      "type": "永续",
      "effect": "这份思念是否过于沉重？发动时作为效果处理：从牌组或移出游戏的卡中选一张[侵略]标签的卡加入手卡。每个自己的回合可以发动一次，支付4点同步值来回复2点音韵值（自己的同步值低于50%后发动会让回复的音韵值增加100%）。自己每失去4点同步值都会让队伍攻击力+1。",
      "score": 7.6,
      "grade": "A+",
      "archetypes": [
        "资源运转队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "松山惠",
        "黑色卡片",
        "智能手机",
        "血之佑戒·红泪拉克莎"
      ],
      "combo_notes": "适用资源运转队/资源运转队/控场队。搭配高费卡或爆发卡，提供音韵支持。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_VK0GAj3BqV.webp",
      "_category": "item_permanent",
      "card_type": "道具/永续",
      "tags": [
        "战术",
        "永续",
        "检索",
        "侵略",
        "卖血",
        "回复音韵",
        "攻击力上升"
      ],
      "dims": {
        "power": 9.3,
        "cost": 6.8,
        "flex": 6.7,
        "synergy": 6.7,
        "stable": 7.3
      },
      "brief": "强势，收益直接，资源运转队组件。"
    },
    {
      "name": "蓝宝之杖·命",
      "cost": 5,
      "attribute": "理智",
      "type": "侵略",
      "effect": "发动时作为效果处理：对一名其他玩家造成一次6面骰判定伤害。每回合首次造成判定伤害后可以对目标追加一次硬币判定伤害：正面的场合造成2点判定伤害，背面则不造成伤害。",
      "score": 7.8,
      "grade": "A+",
      "archetypes": [
        "判定伤害队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间予",
        "人格修正拳！",
        "秘技！摸头杀",
        "钢笔",
        "破损电子设备"
      ],
      "combo_notes": "适用判定伤害队。搭配判定增伤/回费卡形成判定循环",
      "image_url": "assets/images/img_aGVPDZCwUr.webp",
      "_category": "item_permanent",
      "dims": {
        "power": 9.0,
        "cost": 7.2,
        "flex": 6.8,
        "synergy": 7.9,
        "stable": 7.4
      },
      "brief": "强势，收益直接，判定伤害队组件。"
    },
    {
      "name": "善意面具",
      "cost": 5,
      "attribute": "无序",
      "type": "侵略",
      "effect": "发动时：若手中有攻击卡可不耗音韵且无视距离打出，那次最终伤害+1。使用攻击卡造伤害时可付金币增伤(每500金币+1最终伤害)。SP：攻击卡最终伤害+1",
      "score": 7.1,
      "grade": "A",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小野结衣",
        "宫樱子",
        "横扫之刃",
        "最佳化",
        "该结束了！",
        "Huginn&Muninn"
      ],
      "combo_notes": "适用热忱快攻队/资源运转队/资源运转队。搭配高费卡或爆发卡，提供音韵支持。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_m6djAaFjGZ.webp",
      "sp": "使用攻击卡造成的最终伤害+1。",
      "_category": "item_permanent",
      "dims": {
        "power": 6.7,
        "cost": 6.7,
        "flex": 7.4,
        "synergy": 7.0,
        "stable": 8.0
      },
      "brief": "优秀，收益直接、泛用度高，快攻侵略队组件。"
    },
    {
      "name": "智能手机",
      "cost": 4,
      "attribute": "丰沛",
      "type": "永续",
      "effect": "掘弃按键后将拥有超大屏幕的手机，你会喜欢上它所提供的付费功能的。发动时作为效果处理：获得2000金币。等价交换：每个自己的回合可以发动一次（可以扣除500金币来增加发动次数），扣除700金币从以下效果中选择一项适用：①上升1点攻击力②选一张手卡送入墓地，对一名玩家造成3点理智属性伤害。",
      "score": 7.6,
      "grade": "A+",
      "archetypes": [
        "金币队",
        "资源运转队",
        "进攻队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "松山惠",
        "黑色卡片",
        "镌刻的艺术",
        "血之佑戒·红泪拉克莎"
      ],
      "combo_notes": "适用资源运转队/资源运转队。搭配高费卡或爆发卡，提供音韵支持",
      "image_url": "assets/images/img_1oUPlAbKu4.webp",
      "_category": "item_permanent",
      "card_type": "道具/永续",
      "tags": [
        "丰沛",
        "永续",
        "金币",
        "攻击力上升",
        "伤害",
        "送墓"
      ],
      "dims": {
        "power": 8.0,
        "cost": 7.2,
        "flex": 7.4,
        "synergy": 8.0,
        "stable": 7.2
      },
      "brief": "强势，收益直接，金币队组件。"
    },
    {
      "name": "血之佑戒·红泪拉克莎",
      "cost": 8,
      "attribute": "热忱",
      "type": "丰沛",
      "effect": "发动时作为效果处理：立即回复3点音韵值，之后每回合回复2点音韵值，但自己每次被破坏卡后都会受到没有攻击来源的2点热忱属性伤害。受到伤害后回复1点音韵值。",
      "score": 8.0,
      "grade": "S",
      "archetypes": [
        "破局流",
        "资源运转队"
      ],
      "recommended_with": [
        "里绪(水着)",
        "小野伊织",
        "结晶碎弧",
        "共鸣者",
        "黑色卡片",
        "护符",
        "吊坠"
      ],
      "combo_notes": "适用热忱快攻队/资源运转队/控场队。搭配高费卡或爆发卡，提供音韵支持。搭配多张拆卡卡快速消耗对手资源。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_mM3FRRhUt1.webp",
      "_category": "item_permanent",
      "dims": {
        "power": 9.6,
        "cost": 6.4,
        "flex": 7.2,
        "synergy": 7.5,
        "stable": 8.6
      },
      "brief": "核心级，收益直接、泛用度高，破局流组件。"
    },
    {
      "name": "妖刀五月雨",
      "cost": 5,
      "attribute": "混沌",
      "type": "战术",
      "effect": "发动时：破坏场上1张卡，之后对一名玩家造5混沌伤害，自己失3同步。每回合一次：单次造5点以上伤害时可选：①破坏场上1张卡，自己失3同步 ②抽1张卡，自己失3同步",
      "score": 7.9,
      "grade": "A+",
      "archetypes": [
        "控场队",
        "快攻侵略队"
      ],
      "recommended_with": [
        "入间枫",
        "小沙香琉璃",
        "钢笔",
        "绿宝之杖·择",
        "鸣奏之\"圣音\"",
        "露璐缇雅·爱德华"
      ],
      "combo_notes": "适用资源运转队/控场队/泛用。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_dCb0XRv5vc.webp",
      "_category": "item_permanent",
      "dims": {
        "power": 9.4,
        "cost": 7.4,
        "flex": 6.7,
        "synergy": 7.0,
        "stable": 8.1
      },
      "brief": "强势，收益直接、费用效率出色，控场队组件。"
    },
    {
      "name": "设计师的直尺",
      "cost": 4,
      "attribute": "移动",
      "type": "永续",
      "effect": "直尺，仅此。发动时作为效果处理：前进4格。每个自己回合可以发动一次，支付音韵值来前进，每支付1点音韵值来前进1格。SP：单回合内每移动8格后适用效果：对一名其他玩家造成2点理智属性伤害。（队伍中有两名以上[位移手]角色时造成的基础理智属性伤害提升至3点）",
      "score": 8.2,
      "grade": "S",
      "archetypes": [
        "移动造伤队"
      ],
      "recommended_with": [
        "现实间里绪",
        "予(水着)",
        "星奈(水着)",
        "能量饮料",
        "清凉时间！",
        "风纪委员的手段",
        "狡黠之跃"
      ],
      "combo_notes": "移动造伤队核心永续卡。3费前进4格，每回合可支付音韵值额外移动，SP单回合移动8格后对一名其他玩家造成2点理智伤害，队伍中每有一名[位移手]角色触发格数要求-1（3名位移手可降至5格触发）。搭配里绪、予水着、星奈水着等位移手角色降低触发门槛，搭配能量饮料、清凉时间等移动卡快速累计位移。",
      "image_url": "assets/images/img_R5ZTbMb8Vi.webp",
      "sp": "",
      "_category": "item_permanent",
      "card_type": "道具/永续",
      "tags": [
        "移动",
        "永续",
        "位移",
        "付费移动",
        "移动伤害"
      ],
      "dims": {
        "power": 8.8,
        "cost": 7.8,
        "flex": 7.0,
        "synergy": 9.1,
        "stable": 8.3
      },
      "brief": "核心级，收益直接、费用效率出色，移动造伤队组件。"
    },
    {
      "name": "永奏进行曲",
      "cost": 5,
      "attribute": "无序",
      "type": "声乐",
      "effect": "永远无法停下……\n发动时作为效果处理：立即抽2张卡，然后选一张手卡或区域内的卡送入墓地。\n自己的回合内，自己的回合内每有1张卡进入墓地就可以对一名玩家造成1点无序属性伤害。这个效果单回合触发7/14次后造成的基础伤害提升至2/3点无序属性伤害。\nSP：可以支付4点同步值并把墓地的这张卡移出游戏来发动让自己抽2张卡。",
      "sp": "可以支付4点同步值并把墓地的这张卡移出游戏来发动让自己抽2张卡。",
      "flavor": "永远无法停下......",
      "grade": "A+",
      "score": 7.5,
      "archetypes": [
        "资源运转队",
        "快攻侵略队"
      ],
      "image_url": "assets/images/img_LPcsEHSUna.webp",
      "recommended_with": [
        "黑色卡片",
        "来自地狱的盒子",
        "拿手好戏",
        "掌握",
        "风纪委员的手段",
        "案件还原"
      ],
      "combo_notes": "资源运转队/快攻侵略队核心永续卡。5费抽2送墓1，每有卡进墓地造1点无序伤害，单回合触发7/14次后伤害提升至2/3点。削弱后高伤害门槛大幅提高，更依赖大量送墓配合。SP支付4同步值移出墓地抽2张卡。搭配黑色卡片（灰卡基底+献祭）、来自地狱的盒子（回收）、拿手好戏/掌握（送墓+滤抽）、风纪委员的手段（炸卡送墓）。",
      "_category": "item_permanent",
      "dims": {
        "power": 8.4,
        "cost": 7.4,
        "flex": 6.9,
        "synergy": 6.7,
        "stable": 7.4
      },
      "brief": "强势，收益直接、费用效率出色，资源运转队组件。"
    },
    {
      "name": "\"狼牙鹰爪\"",
      "cost": 7,
      "attribute": "侵略",
      "type": "永续",
      "card_type": "道具/永续",
      "image_url": "assets/images/img_cdT3OVgPih.webp",
      "effect": "传说中的欺诈之神洛基曾使用过的武器。发动时作为效果处理：从墓地中选一张[侵略]标签的卡加入手卡，然后可以选一张卡送入墓地并抽一张。一回合一次，选墓地一张[侵略]标签的单次种类的卡发动，支付那张卡使用时所需要的音韵值+1点音韵值来适用那张卡的效果。受到的最终伤害+1，造成的最终伤害+1。",
      "tags": [
        "侵略",
        "永续",
        "墓地回收",
        "墓地发动",
        "伤害增减"
      ],
      "score": 7.8,
      "grade": "A+",
      "dims": {
        "power": 8.2,
        "cost": 7.3,
        "flex": 7.7,
        "synergy": 7.8,
        "stable": 7.8
      },
      "brief": "强势，收益直接。"
    },
    {
      "name": "\"巧匠之手\"",
      "cost": 5,
      "attribute": "战术",
      "type": "永续",
      "card_type": "道具/永续",
      "image_url": "assets/images/img_iYccn3axZ6.webp",
      "effect": "锻造！锻造！锻造！发动时作为效果处理：立即进行一次献祭动作，那次献祭完成后可以抽一张。每回合的献祭次数+1。一局游戏只能发动一次：选一张手卡献祭，被献祭的那张卡不去墓地而是移出游戏。那之后可以选那张卡以外的自己被移出游戏的卡加入手卡。",
      "tags": [
        "战术",
        "永续",
        "献祭",
        "献祭次数",
        "移出游戏回收"
      ],
      "score": 8.0,
      "grade": "S",
      "dims": {
        "power": 8.5,
        "cost": 7.6,
        "flex": 7.7,
        "synergy": 8.0,
        "stable": 8.0
      },
      "brief": "核心级，收益直接。"
    },
    {
      "name": "核心的供给者",
      "cost": 5,
      "attribute": "丰沛",
      "type": "永续",
      "card_type": "道具/永续",
      "image_url": "assets/images/img_iTclHZs9kb.webp",
      "effect": "振聋发聩的轰鸣声是为了迎接神的到来。发动时作为效果处理：获取1点引导核心。每个自己回合可以发动一次：获得3点激励点数。每次提升等级后可以从以下效果中选择一项适用：①队伍攻击力+1②选移出游戏的一张卡加入手卡（限一次）③对一名玩家造成一次四面骰判定伤害。",
      "tags": [
        "丰沛",
        "永续",
        "引导核心",
        "激励点数",
        "升级",
        "攻击力上升",
        "回收",
        "判定伤害"
      ],
      "score": 7.7,
      "grade": "A+",
      "dims": {
        "power": 8.2,
        "cost": 7.3,
        "flex": 7.7,
        "synergy": 7.7,
        "stable": 7.2
      },
      "brief": "强势，收益直接、泛用度高。"
    }
  ],
  "item_single": [
    {
      "name": "20面骰",
      "cost": 1,
      "attribute": "无序",
      "type": "投掷",
      "effect": "自己回合选一名玩家，其下次投掷改为20面骰(因此次投掷造成的判定伤害-8)",
      "score": 7.1,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "现实间冬马",
        "椎名小春",
        "设计师的直尺",
        "能量饮料",
        "四叶草发卡",
        "侦探放大镜"
      ],
      "combo_notes": "适用判定伤害队。搭配判定增伤/回费卡形成判定循环",
      "image_url": "assets/images/img_fdt8Wq6uSJ.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.1,
        "cost": 8.9,
        "flex": 6.9,
        "synergy": 7.5,
        "stable": 6.6
      },
      "brief": "优秀，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "Twice",
      "cost": 2,
      "attribute": "热忱",
      "type": "战术",
      "effect": "自己回合使用：为一名玩家追加一个掷骰阶段，或让一名玩家重新进行一次判定。可盖伏在其他玩家回合使用",
      "score": 7.6,
      "grade": "A+",
      "archetypes": [
        "位移队",
        "判定伤害队"
      ],
      "recommended_with": [
        "现实间里绪",
        "小仓霞",
        "比翼恋理",
        "小沙香琉璃",
        "夏日海滩踢击",
        "入间予"
      ],
      "combo_notes": "适用判定伤害队。搭配判定增伤/回费卡形成判定循环",
      "image_url": "assets/images/img_QvvGQo3W4L.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.4,
        "cost": 9.4,
        "flex": 7.0,
        "synergy": 6.8,
        "stable": 7.3
      },
      "brief": "强势，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "底牌",
      "cost": 4,
      "attribute": "理智",
      "type": "丰沛",
      "effect": "自己回合，手卡只有这张或全同色才能发动。抽2卡回10音韵(全同色方式只回6)，之后将墓地和移出游戏的卡全部放回牌组洗切。发动后直接销毁不进墓",
      "score": 7.6,
      "grade": "A+",
      "archetypes": [
        "资源运转队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "松山惠",
        "黑色卡片",
        "镌刻的艺术",
        "音叉"
      ],
      "combo_notes": "适用资源运转队/资源运转队/控场队。搭配高费卡或爆发卡，提供音韵支持。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_IgHm5zNViX.webp",
      "_category": "item_single",
      "dims": {
        "power": 9.3,
        "cost": 8.7,
        "flex": 5.5,
        "synergy": 6.5,
        "stable": 6.8
      },
      "brief": "强势，收益直接、费用效率出色，较挑构筑与时机，资源运转队组件。"
    },
    {
      "name": "颠倒骰子",
      "cost": 2,
      "attribute": "热忱",
      "type": "战术",
      "effect": "自己回合使用，改变一名玩家下一次移动的方向。对自己使用可根据方向执行对应效果。可盖伏在其他玩家回合使用",
      "sp": "默认方向：移动完成后再进行一段相同移动；相反方向：取消移动并回到起点",
      "score": 6.2,
      "grade": "B",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "逃脱",
        "能量饮料"
      ],
      "combo_notes": "适用位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_j1iLJkDcgD.webp",
      "_category": "item_single",
      "dims": {
        "power": 5.2,
        "cost": 7.5,
        "flex": 6.3,
        "synergy": 5.6,
        "stable": 6.9
      },
      "brief": "合格可用，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "怪怪幽灵吊坠",
      "cost": "1+",
      "attribute": "热忱",
      "type": "战术",
      "effect": "其他玩家回合也能从手卡发动，抵消一次即将受到的伤害，之后回1音韵",
      "sp": "费用随使用次数增加，每用一次+1",
      "score": 8.3,
      "grade": "S",
      "archetypes": [
        "泛用"
      ],
      "recommended_with": [
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "逃脱",
        "Twice"
      ],
      "combo_notes": "适用资源运转队。搭配高费卡或爆发卡，提供音韵支持",
      "image_url": "assets/images/img_A9zAXt2zav.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.8,
        "cost": 9.6,
        "flex": 7.9,
        "synergy": 7.4,
        "stable": 9.1
      },
      "brief": "核心级，收益直接、费用效率出色，泛用组件。"
    },
    {
      "name": "四叶草发卡",
      "cost": 2,
      "attribute": "热忱",
      "type": "战术",
      "effect": "自己回合使用，下一次移动完成后追加3格移动",
      "sp": "因卡效果加入手卡时立即前进/后退1-5格；在其他玩家回合触发时还能对一名玩家造3热忱伤害",
      "score": 7.0,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "逃脱",
        "能量饮料"
      ],
      "combo_notes": "适用热忱快攻队/资源运转队/位移队。搭配移动倍增/控骰卡最大化位移收益。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_vGIf8rucmy.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.4,
        "cost": 8.0,
        "flex": 6.9,
        "synergy": 6.6,
        "stable": 7.4
      },
      "brief": "优秀，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "侦探放大镜",
      "cost": 1,
      "attribute": "理智",
      "type": "移动",
      "effect": "让一次移动动作的位移量增减2格。可盖伏在其他玩家回合使用",
      "sp": "队伍中有位移手时增减效果提升至4格",
      "score": 7.1,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "松山惠",
        "予(水着)",
        "枫(水着)",
        "夏日畅饮时间！",
        "设计师的直尺",
        "雨宫羽奈"
      ],
      "combo_notes": "适用位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_MSJ42tn2pr.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.0,
        "cost": 9.0,
        "flex": 7.1,
        "synergy": 6.3,
        "stable": 7.6
      },
      "brief": "优秀，费用效率出色，单点收益有限，位移队组件。"
    },
    {
      "name": "来自地狱的盒子",
      "cost": 3,
      "attribute": "无序",
      "type": "丰沛",
      "effect": "自己回合使用，选墓地2张卡加入手卡",
      "sp": "因卡效果送墓时可选：①4面骰判定，按点数回同数值音韵 ②对一名玩家造一次4面骰判定伤害",
      "score": 7.7,
      "grade": "A+",
      "archetypes": [
        "判定伤害队",
        "资源运转队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间予",
        "人格修正拳！",
        "钢笔",
        "蓝宝之杖·命",
        "破损电子设备"
      ],
      "combo_notes": "适用判定伤害队、资源运转队。3费回收墓地2张卡，因效果送墓时可选4面骰按点数回音韵或造4面骰判定伤害，回收+选项灵活。判定伤害队搭配琉璃/予/钢笔/蓝杖/破损电子设备；资源运转队搭配枫/光太郎/惠/黑色卡片。",
      "image_url": "assets/images/img_ZXkWqiqmEt.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.6,
        "cost": 8.0,
        "flex": 7.4,
        "synergy": 8.2,
        "stable": 7.5
      },
      "brief": "强势，收益直接、费用效率出色，判定伤害队组件。"
    },
    {
      "name": "红宝之杖·运",
      "cost": "1-10",
      "attribute": "热忱",
      "type": "侵略",
      "effect": "自己回合付1-10音韵发动，对一名玩家造与支付音韵相同数值的热忱伤害",
      "sp": "每次付7以上音韵打出后，下一次使用伤害+20%。叠加5次后从第6次开始直接秒杀目标",
      "score": 6.5,
      "grade": "B",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小野结衣",
        "宫樱子",
        "横扫之刃",
        "最佳化",
        "该结束了！",
        "善意面具"
      ],
      "combo_notes": "适用热忱快攻队/资源运转队。搭配高费卡或爆发卡，提供音韵支持。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_O8SSYi9PkE.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.8,
        "cost": 6.1,
        "flex": 6.1,
        "synergy": 6.1,
        "stable": 7.4
      },
      "brief": "合格可用，收益直接，快攻侵略队组件。"
    },
    {
      "name": "幸运护符",
      "cost": "2+",
      "attribute": "热忱",
      "type": "战术",
      "effect": "自己回合使用，抵消一次即将受到的伤害及附加效果，然后前进2格。可盖伏在其他玩家回合使用",
      "sp": "费用随使用次数增加，每用一次+1",
      "score": 7.7,
      "grade": "A+",
      "archetypes": [
        "位移队",
        "泛用"
      ],
      "recommended_with": [
        "怪怪幽灵吊坠",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "逃脱",
        "Twice"
      ],
      "combo_notes": "适用位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_ybMFzHObZj.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.9,
        "cost": 8.6,
        "flex": 7.6,
        "synergy": 7.1,
        "stable": 8.5
      },
      "brief": "强势，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "经文",
      "cost": 3,
      "attribute": "热忱",
      "type": "疗愈",
      "effect": "自己回合使用，回自身1同步，获得2护盾。可盖伏在其他玩家回合使用",
      "sp": "每有1名圣女角色回复量+100%",
      "score": 7.4,
      "grade": "A",
      "archetypes": [
        "泛用"
      ],
      "recommended_with": [
        "怪怪幽灵吊坠",
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "逃脱"
      ],
      "combo_notes": "适用搭配减速/缴械卡形成控制链",
      "image_url": "assets/images/img_VFLLB04nAP.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.7,
        "cost": 8.1,
        "flex": 7.8,
        "synergy": 6.4,
        "stable": 8.4
      },
      "brief": "优秀，收益直接、费用效率出色，泛用组件。"
    },
    {
      "name": "魔法蓝图",
      "cost": 3,
      "attribute": "无序",
      "type": "战术",
      "effect": "自己回合选手卡或墓地中一张单次种类的卡发动，此卡直到使用结算完毕前视为与那张卡相同",
      "score": 8.1,
      "grade": "S",
      "archetypes": [
        "泛用"
      ],
      "recommended_with": [
        "黑色卡片",
        "善意面具",
        "入间予",
        "弱点分析",
        "集中",
        "打起精神来！"
      ],
      "combo_notes": "通用功能卡，可根据构筑需求加入",
      "image_url": "assets/images/img_oPYSlc1pF5.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.3,
        "cost": 8.8,
        "flex": 8.2,
        "synergy": 7.8,
        "stable": 8.8
      },
      "brief": "核心级，收益直接、费用效率出色，泛用组件。"
    },
    {
      "name": "惊吓礼盒",
      "cost": 4,
      "attribute": "无序",
      "type": "侵略",
      "effect": "自己回合选一名玩家，破坏其1张手卡，扣其2同步，之后根据其被移出游戏的卡数量造相同数值的无序伤害",
      "score": 7.2,
      "grade": "A",
      "archetypes": [
        "控场队"
      ],
      "recommended_with": [
        "绿宝之杖·择",
        "安静些",
        "来自地狱的盒子",
        "制裁之刃",
        "对弈",
        "入间枫"
      ],
      "combo_notes": "适用控场队/泛用。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_qAx9XRp4iw.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.4,
        "cost": 7.3,
        "flex": 6.9,
        "synergy": 6.7,
        "stable": 7.6
      },
      "brief": "优秀，收益直接、费用效率出色，控场队组件。"
    },
    {
      "name": "神乐铃",
      "cost": 1,
      "attribute": "热忱",
      "type": "侵略",
      "effect": "自己回合使用，对一名玩家造1热忱伤害",
      "sp": "每进入墓地一次，下次使用最终伤害+1(可叠加，上限9次)",
      "score": 7.8,
      "grade": "A+",
      "archetypes": [
        "快攻侵略队"
      ],
      "recommended_with": [
        "小野结衣",
        "宫樱子",
        "横扫之刃",
        "最佳化",
        "该结束了！",
        "善意面具"
      ],
      "combo_notes": "适用热忱快攻队。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_oG0h5KxjBT.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.0,
        "cost": 9.7,
        "flex": 7.1,
        "synergy": 7.1,
        "stable": 8.4
      },
      "brief": "强势，收益直接、费用效率出色，快攻侵略队组件。"
    },
    {
      "name": "绿宝之杖·择",
      "cost": 3,
      "attribute": "无序",
      "type": "战术",
      "effect": "自己的回合才能从以下效果中选择一项发动：①选一名玩家抽一张卡，然后自己后退2格②选自己区域内的一张卡送入墓地，然后自己前进3格③选墓地中的一张卡加入手卡，然后选一张手卡送入墓地。那两张卡同色或同费的场合自己可以回复1点音韵值。（可以将这张卡盖伏来在其他玩家回合使用）",
      "score": 7.7,
      "grade": "A+",
      "archetypes": [
        "位移队",
        "资源运转队",
        "泛用"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "松山惠",
        "黑色卡片",
        "镌刻的艺术",
        "音叉"
      ],
      "combo_notes": "适用位移队、资源运转队、泛用。3费三选一：①让目标抽1卡自己后退2格②送自己区域1卡前进3格③回收墓地1卡丢1手卡，同色/同费回1音韵，可盖伏，灵活性极强。资源运转队搭配枫/光太郎/惠/黑色卡片/镌刻的艺术；位移队搭配予水着/枫水着/直尺/能量饮料。",
      "image_url": "assets/images/img_YH4uedK3SX.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.3,
        "cost": 8.2,
        "flex": 8.2,
        "synergy": 7.1,
        "stable": 7.8
      },
      "brief": "强势，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "破损电子设备",
      "cost": 2,
      "attribute": "混沌",
      "type": "侵略",
      "effect": "对一名其他玩家造成一次4面骰判定伤害，之后后退2格。",
      "sp": "这张卡进入墓地后可以花费2点音韵值将其回收，被回收后的此卡使用后放回牌组最下方。",
      "score": 7.8,
      "grade": "A+",
      "archetypes": [
        "判定伤害队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间予",
        "人格修正拳！",
        "秘技！摸头杀",
        "钢笔",
        "蓝宝之杖·命"
      ],
      "combo_notes": "适用判定伤害队。2费造4面骰判定伤害+后退2格，墓地花2音韵回收（回收后用了放牌组底），判定伤害+回收循环。搭配琉璃（判定后回音韵+全队判定+1）、予（全队判定+1+控骰）、钢笔（判定+1+减费）、蓝杖（每回合追加判定伤害）、人格修正拳/摸头杀形成判定循环。",
      "image_url": "assets/images/img_5oo6fhAIO6.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.4,
        "cost": 9.1,
        "flex": 7.3,
        "synergy": 7.9,
        "stable": 7.4
      },
      "brief": "强势，收益直接、费用效率出色，判定伤害队组件。"
    },
    {
      "name": "魔法清点名单",
      "cost": 2,
      "attribute": "无序",
      "type": "战术",
      "effect": "自己回合发动，从牌组/墓地/移出游戏选这张卡以外的[移动]或[战术]标签的1张卡加入手卡。可盖伏在其他玩家回合使用",
      "score": 7.2,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "剖析",
        "绿宝之杖·择",
        "现实间冬马",
        "狡黠之跃",
        "某女士爱用球棒",
        "\"拦路者\""
      ],
      "combo_notes": "适用资源运转队/位移队/控场队。搭配移动倍增/控骰卡最大化位移收益。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_HQjja6r4wF.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.8,
        "cost": 8.5,
        "flex": 7.2,
        "synergy": 6.2,
        "stable": 7.2
      },
      "brief": "优秀，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "某女士爱用球棒",
      "cost": 5,
      "attribute": "无序",
      "type": "侵略",
      "effect": "自己回合使用，对一名玩家造一次6面骰判定伤害，之后进行一次移动，位移量为本次附加伤害值",
      "sp": "每有1名突破手角色最终伤害+1",
      "score": 6.2,
      "grade": "B",
      "archetypes": [
        "判定伤害队",
        "位移队"
      ],
      "recommended_with": [
        "小沙香琉璃",
        "入间予",
        "人格修正拳！",
        "钢笔",
        "蓝宝之杖·命",
        "破损电子设备"
      ],
      "combo_notes": "适用判定伤害队/热忱快攻队/位移队。搭配判定增伤/回费卡形成判定循环。搭配移动倍增/控骰卡最大化位移收益。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_KiBcNRVHYZ.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.1,
        "cost": 5.4,
        "flex": 6.4,
        "synergy": 7.4,
        "stable": 5.9
      },
      "brief": "合格可用，收益直接、泛用度高，费用偏重，判定伤害队组件。"
    },
    {
      "name": "制裁之刃",
      "cost": 9,
      "attribute": "无序",
      "type": "侵略",
      "effect": "自己回合发动，选一名角色区域内1张卡破坏并移出游戏，之后根据其被移出游戏的卡数量造相同数值+5点无序伤害。可盖伏在其他玩家回合使用。发动后直接销毁不进墓",
      "score": 6.4,
      "grade": "B",
      "archetypes": [
        "控场队"
      ],
      "recommended_with": [
        "绿宝之杖·择",
        "安静些",
        "来自地狱的盒子",
        "惊吓礼盒",
        "对弈",
        "入间枫"
      ],
      "combo_notes": "适用控场队/泛用。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_o0uUfCC7h2.webp",
      "_category": "item_single",
      "dims": {
        "power": 8.4,
        "cost": 3.7,
        "flex": 6.4,
        "synergy": 5.7,
        "stable": 6.7
      },
      "brief": "合格可用，收益直接、泛用度高，费用偏重，控场队组件。"
    },
    {
      "name": "鸣奏之\"圣音\"",
      "cost": 1,
      "attribute": "热忱",
      "type": "声乐",
      "effect": "自己的回合才能使用。回复自身2点同步值，（可以将这张卡盖伏来在其他玩家回合使用）",
      "sp": "这张卡被献祭或是因卡的效果而送入墓地时可以回复自身2点音韵值。",
      "score": 7.9,
      "grade": "A+",
      "archetypes": [
        "资源运转队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "松山惠",
        "黑色卡片",
        "镌刻的艺术",
        "里尔亚斯·斯塔芙莉娅斯特"
      ],
      "combo_notes": "适用资源运转队/控场队/资源运转队。搭配高费卡或爆发卡，提供音韵支持。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_nxCZJc5gDO.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.2,
        "cost": 9.5,
        "flex": 7.6,
        "synergy": 7.1,
        "stable": 8.4
      },
      "brief": "强势，收益直接、费用效率出色，资源运转队组件。"
    },
    {
      "name": "特制手套",
      "cost": 3,
      "attribute": "理智",
      "type": "战术",
      "effect": "自己回合从手卡发动，三选一：①从牌组选1张卡加入手卡 ②修改一次掷骰结果 ③选对手墓地1张卡放回其牌组。可盖伏在其他玩家回合使用",
      "score": 8.0,
      "grade": "S",
      "archetypes": [
        "泛用",
        "判定伤害队"
      ],
      "recommended_with": [
        "小野伊织",
        "里绪(水着)",
        "小沙香琉璃",
        "入间予",
        "共鸣者",
        "结晶碎弧"
      ],
      "combo_notes": "适用资源运转队",
      "image_url": "assets/images/img_IqtKa1PoPL.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.1,
        "cost": 8.6,
        "flex": 8.5,
        "synergy": 7.7,
        "stable": 8.7
      },
      "brief": "核心级，收益直接、费用效率出色，泛用组件。"
    },
    {
      "name": "搜查令",
      "cost": 3,
      "attribute": "理智",
      "type": "侵略",
      "effect": "自己回合使用，查看一名玩家当前手牌，选其中1张在3次行动内移出游戏，之后根据其被移出游戏的卡数量造相同数值+1点理智伤害。可盖伏在其他玩家回合使用",
      "score": 7.1,
      "grade": "A",
      "archetypes": [
        "控场队"
      ],
      "recommended_with": [
        "松山惠",
        "予(水着)",
        "枫(水着)",
        "放轻松些",
        "夏日畅饮时间！",
        "钢笔"
      ],
      "combo_notes": "适用控场队/位移队。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_sxdAPzKsvO.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.4,
        "cost": 7.8,
        "flex": 6.5,
        "synergy": 6.1,
        "stable": 7.4
      },
      "brief": "优秀，收益直接、费用效率出色，控场队组件。"
    },
    {
      "name": "结晶碎弧",
      "cost": 7,
      "attribute": "理智",
      "type": "战术",
      "effect": "自己的回合可以从以下效果中选择一项发动：①前进4格。那之后进行一次六面骰判定，若那次点数大于4则降低自身2点入迷值②下次造成伤害前先扣除目标5点同步值。",
      "score": 7.4,
      "grade": "A",
      "archetypes": [
        "破局队"
      ],
      "recommended_with": [
        "小野伊织",
        "里绪(水着)",
        "共鸣者",
        "遥控骰子",
        "特制手套",
        "狩猎之少女"
      ],
      "combo_notes": "适用判定伤害队/位移队。搭配判定增伤/回费卡形成判定循环。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_BDREHzsWvA.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.6,
        "cost": 6.4,
        "flex": 7.9,
        "synergy": 7.2,
        "stable": 7.9
      },
      "brief": "优秀，收益直接、泛用度高，破局队组件。"
    },
    {
      "name": "遥控骰子",
      "cost": 2,
      "attribute": "理智",
      "type": "投掷",
      "effect": "修改一次投掷动作中的所有点数。其他玩家回合也能从手卡发动",
      "score": 7.1,
      "grade": "A",
      "archetypes": [
        "破局队",
        "位移队"
      ],
      "recommended_with": [
        "小野伊织",
        "里绪(水着)",
        "共鸣者",
        "结晶碎弧",
        "特制手套",
        "狩猎之少女"
      ],
      "combo_notes": "通用功能卡，可根据构筑需求加入",
      "image_url": "assets/images/img_hVKZnAy85U.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.1,
        "cost": 8.4,
        "flex": 7.0,
        "synergy": 6.8,
        "stable": 7.8
      },
      "brief": "优秀，收益直接、费用效率出色，破局队组件。"
    },
    {
      "name": "镇定药片",
      "cost": 2,
      "attribute": "理智",
      "type": "疗愈",
      "effect": "回/扣自身2同步，扣同步的场合此卡不耗音韵。其他玩家回合也能从手卡发动",
      "sp": "造伤害时可从手卡把此卡送墓让最终伤害+2",
      "score": 6.7,
      "grade": "B",
      "archetypes": [
        "快攻侵略队",
        "资源运转队"
      ],
      "recommended_with": [
        "松山惠",
        "予(水着)",
        "枫(水着)",
        "放轻松些",
        "夏日畅饮时间！",
        "钢笔"
      ],
      "combo_notes": "适用热忱快攻队/资源运转队。搭配高费卡或爆发卡，提供音韵支持。搭配攻击增伤/破甲卡提升输出效率",
      "image_url": "assets/images/img_i0K2c1ud3K.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.1,
        "cost": 8.0,
        "flex": 6.2,
        "synergy": 6.1,
        "stable": 7.4
      },
      "brief": "合格可用，收益直接、费用效率出色，快攻侵略队组件。"
    },
    {
      "name": "音叉",
      "cost": 3,
      "attribute": "无序",
      "type": "丰沛",
      "effect": "自己回合发动，立即抽2卡，然后20面骰判定(>10成功)，成功再回1音韵，失败选1张手卡放回牌组最下方",
      "score": 7.5,
      "grade": "A+",
      "archetypes": [
        "资源运转队"
      ],
      "recommended_with": [
        "入间枫",
        "木原光太郎",
        "松山惠",
        "黑色卡片",
        "镌刻的艺术",
        "底牌"
      ],
      "combo_notes": "适用判定伤害队/资源运转队/资源运转队。搭配判定增伤/回费卡形成判定循环。搭配高费卡或爆发卡，提供音韵支持",
      "image_url": "assets/images/img_FqchbTcRFp.webp",
      "_category": "item_single",
      "dims": {
        "power": 8.9,
        "cost": 7.5,
        "flex": 6.7,
        "synergy": 6.4,
        "stable": 6.9
      },
      "brief": "强势，收益直接、费用效率出色，资源运转队组件。"
    },
    {
      "name": "能量饮料",
      "cost": 3,
      "attribute": "热忱",
      "type": "移动",
      "effect": "鬼屋能量公司最新产品……怪爪饮料！\n自己的回合才能使用，让一次移动动作的位移量x2（最多增加8格）。（可以将这张卡盖伏来在其他玩家回合使用）\nSP：下次移动每有4格位移量回复1点音韵值（上限回复6点）。",
      "sp": "",
      "score": 7.2,
      "grade": "A",
      "archetypes": [
        "移动造伤队"
      ],
      "recommended_with": [
        "设计师的直尺",
        "现实间里绪",
        "予(水着)",
        "星奈(水着)",
        "清凉时间！",
        "风纪委员的手段"
      ],
      "combo_notes": "移动造伤队核心单次卡。3费让一次移动动作位移量x2（最多+8格），可盖伏在对手回合使用。SP下次移动每4格回复1点音韵值（上限6点），配合直尺的大位移可回费。搭配设计师的直尺、里绪、予水着、星奈水着等位移手角色，快速累计位移触发造伤效果。",
      "image_url": "assets/images/img_veg0bIdJ43.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.5,
        "cost": 6.9,
        "flex": 6.8,
        "synergy": 7.5,
        "stable": 7.3
      },
      "brief": "优秀，收益直接，移动造伤队组件。"
    },
    {
      "name": "再来一次招待券",
      "cost": 4,
      "attribute": "热忱",
      "type": "声乐",
      "effect": "自己回合使用，抽1张馈赠卡",
      "sp": "队伍中增益者+增幅者合计3名时改为抽2张馈赠卡",
      "score": 7.2,
      "grade": "A",
      "archetypes": [
        "破局队"
      ],
      "recommended_with": [
        "小野伊织",
        "里绪(水着)",
        "共鸣者",
        "结晶碎弧",
        "遥控骰子",
        "特制手套"
      ],
      "combo_notes": "适用资源运转队/破局队",
      "image_url": "assets/images/img_1CBBfStonz.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.7,
        "cost": 7.5,
        "flex": 6.4,
        "synergy": 6.4,
        "stable": 7.7
      },
      "brief": "优秀，收益直接、费用效率出色，破局队组件。"
    },
    {
      "name": "猎手爪链",
      "cost": 3,
      "attribute": "混沌",
      "type": "移动",
      "effect": "打断一名玩家的移动动作，之后自己向其方向前进3格。可盖伏在其他玩家回合使用",
      "sp": "每有1/2/3名猎手，使用时还对目标造2/3/4点混沌伤害",
      "score": 7.3,
      "grade": "A",
      "archetypes": [
        "位移队",
        "控场队"
      ],
      "recommended_with": [
        "入间枫",
        "人格修正拳！",
        "交给我就好了",
        "破损电子设备",
        "执勤证明",
        "幸运护符"
      ],
      "combo_notes": "适用位移队/泛用。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_MNhUyBOigo.webp",
      "_category": "item_single",
      "dims": {
        "power": 7.5,
        "cost": 7.8,
        "flex": 6.8,
        "synergy": 6.9,
        "stable": 7.4
      },
      "brief": "优秀，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "柔软枕头",
      "cost": 2,
      "attribute": "热忱",
      "type": "移动",
      "effect": "自己回合使用，回自身3同步并前进3格",
      "sp": "把墓地的此卡移出游戏发动：前进3-6格",
      "score": 7.1,
      "grade": "A",
      "archetypes": [
        "位移队",
        "资源运转队"
      ],
      "recommended_with": [
        "怪怪幽灵吊坠",
        "幸运护符",
        "现实间里绪",
        "钢筋铁肘",
        "认真起来了！",
        "逃脱"
      ],
      "combo_notes": "适用位移队/控场队。搭配移动倍增/控骰卡最大化位移收益。搭配多张拆卡卡快速消耗对手资源",
      "image_url": "assets/images/img_UAmTOmSfVB.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.9,
        "cost": 8.8,
        "flex": 6.2,
        "synergy": 6.3,
        "stable": 7.3
      },
      "brief": "优秀，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "执勤证明",
      "cost": 4,
      "attribute": "混沌",
      "type": "移动",
      "effect": "打断自己正在进行的移动，之后立即前往地图任意一格。适用后自己下一次移动位移量固定为1(不可驱散)",
      "sp": "每有1名位移手使用时费用-1(最多-2)",
      "score": 7.0,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "入间枫",
        "人格修正拳！",
        "交给我就好了",
        "破损电子设备",
        "猎手爪链",
        "幸运护符"
      ],
      "combo_notes": "适用位移队/控场队。搭配移动倍增/控骰卡最大化位移收益。搭配减速/缴械卡形成控制链",
      "image_url": "assets/images/img_xnIcNjn6LF.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.3,
        "cost": 7.4,
        "flex": 7.4,
        "synergy": 6.5,
        "stable": 7.8
      },
      "brief": "优秀，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "碰碰冰茶",
      "cost": 1,
      "attribute": "无序",
      "type": "投掷",
      "effect": "自己回合选一名玩家，其下次投掷改为2枚6面骰(因此次投掷造成的判定伤害-4)",
      "sp": "完成投掷后回2同步",
      "score": 7.1,
      "grade": "A",
      "archetypes": [
        "位移队"
      ],
      "recommended_with": [
        "现实间冬马",
        "椎名小春",
        "设计师的直尺",
        "能量饮料",
        "四叶草发卡",
        "侦探放大镜"
      ],
      "combo_notes": "适用判定伤害队。搭配判定增伤/回费卡形成判定循环",
      "image_url": "assets/images/img_vYloMrqWFL.webp",
      "_category": "item_single",
      "dims": {
        "power": 6.1,
        "cost": 8.9,
        "flex": 6.9,
        "synergy": 7.5,
        "stable": 6.6
      },
      "brief": "优秀，收益直接、费用效率出色，位移队组件。"
    },
    {
      "name": "\"拦路者\"",
      "cost": 3,
      "attribute": "无序",
      "type": "移动",
      "effect": "\"Stop!此路不通！\" 自己的回合选择地图上的一个格子才能发动，在那个格子上放置路障。路障放置期间如果有玩家的移动路径经过路障且终点不为路障所在格则强制改为前往路障所在格；除非有玩家被路障阻止了一次移动，否则路障不会消失。（可以将这张卡盖伏来在其他玩家回合使用）",
      "sp": "路障成功阻止玩家移动后自己可以前进3格。",
      "score": 6.4,
      "grade": "B",
      "archetypes": [
        "控场队",
        "位移队"
      ],
      "recommended_with": [
        "剖析",
        "绿宝之杖·择",
        "魔法清点名单",
        "现实间冬马",
        "狡黠之跃",
        "某女士爱用球棒"
      ],
      "combo_notes": "适用位移队。搭配移动倍增/控骰卡最大化位移收益",
      "image_url": "assets/images/img_0ke1FyYmtn.webp",
      "_category": "item_single",
      "dims": {
        "power": 5.3,
        "cost": 7.0,
        "flex": 7.1,
        "synergy": 6.2,
        "stable": 7.0
      },
      "brief": "合格可用，收益直接、泛用度高，控场队组件。"
    },
    {
      "name": "\"崩塌之乌托邦\"",
      "cost": "1+",
      "attribute": "反制",
      "type": "单次",
      "card_type": "道具/单次",
      "image_url": "assets/images/img_rkxp2U3sUX.webp",
      "effect": "终究是黄粱一梦罢了。当有玩家发动了包含把卡（道具卡、事件卡、馈赠卡、乐谱卡）加入手卡或送入墓地的效果时可以把这张卡送入墓地来发动，那个效果无效。",
      "tags": [
        "反制",
        "单次",
        "无效化",
        "检索反制",
        "墓地发动"
      ],
      "score": 7.3,
      "grade": "A",
      "dims": {
        "power": 7.6,
        "cost": 7.2,
        "flex": 7.2,
        "synergy": 7.2,
        "stable": 7.2
      },
      "brief": "优秀，收益直接。"
    },
    {
      "name": "先哲之\"馈赠\"",
      "cost": 1,
      "attribute": "侵略",
      "type": "单次",
      "card_type": "道具/单次",
      "image_url": "assets/images/img_Wk4wr3SIRr.webp",
      "effect": "一位先哲的密藏，上面详尽记述了她伟大的思想以及……体术。自己的回合才能使用。抽一张卡然后选自己的手卡或区域内的至多两张卡送入墓地。SP：把墓地的这张卡移出游戏可以发动，对一名其他玩家造成4点热忱属性伤害。",
      "tags": [
        "侵略",
        "单次",
        "抽卡",
        "送墓",
        "墓地发动",
        "伤害"
      ],
      "score": 8.1,
      "grade": "S",
      "dims": {
        "power": 8.3,
        "cost": 8.3,
        "flex": 7.9,
        "synergy": 7.9,
        "stable": 7.9
      },
      "brief": "核心级，收益直接。"
    }
  ],
  "gift_cards": [
    {
      "name": "200$",
      "number": 1,
      "type": "金币",
      "effect": "获得200金币",
      "flavor": "少量金币，眨眼的功夫就会花完，但积少成多总是有用的不是吗。",
      "image_url": "assets/images/img_gBJhY1CYEC.webp",
      "score": 3.6,
      "grade": "D",
      "inspire": 2,
      "_category": "gift_cards",
      "dims": {
        "power": 2.5,
        "flex": 4.4,
        "synergy": 3.2,
        "stable": 4.4
      },
      "brief": "弱势，泛用度高、稳定可靠，单点收益有限。"
    },
    {
      "name": "500$",
      "number": 2,
      "type": "金币",
      "effect": "获得500金币",
      "flavor": "不少的金币，携带在身上会有一定安全感。",
      "image_url": "assets/images/img_RyIra6KCxm.webp",
      "score": 4.6,
      "grade": "C",
      "inspire": 3,
      "_category": "gift_cards",
      "dims": {
        "power": 3.9,
        "flex": 5.2,
        "synergy": 4.0,
        "stable": 5.2
      },
      "brief": "偏特化，收益直接、泛用度高。"
    },
    {
      "name": "Noise(>10)",
      "number": 2,
      "type": "校准",
      "effect": "进行Noise级别的校准：使用1枚20面骰进行1次投掷，结果大于10则成功。成功完成校准后降低自身1点入迷值。",
      "success_rate": "50%",
      "image_url": "assets/images/img_g9AH2dwzNl.webp",
      "score": 4.9,
      "grade": "C",
      "archetypes": [
        "破局队"
      ],
      "inspire": 2,
      "_category": "gift_cards",
      "dims": {
        "power": 3.6,
        "flex": 6.4,
        "synergy": 5.1,
        "stable": 4.6
      },
      "brief": "偏特化，泛用度高，单点收益有限，破局队组件。"
    },
    {
      "name": "Noise(≤10)",
      "number": 2,
      "type": "校准",
      "effect": "进行Noise级别的校准：使用1枚20面骰进行1次投掷，结果小于等于10则成功。成功完成校准后降低自身1点入迷值。",
      "success_rate": "50%",
      "image_url": "assets/images/img_tpECuBlVSb.webp",
      "score": 4.9,
      "grade": "C",
      "archetypes": [
        "破局队"
      ],
      "inspire": 2,
      "_category": "gift_cards",
      "dims": {
        "power": 3.6,
        "flex": 6.4,
        "synergy": 5.1,
        "stable": 4.6
      },
      "brief": "偏特化，泛用度高，单点收益有限，破局队组件。"
    },
    {
      "name": "和声",
      "number": 3,
      "type": "校准",
      "effect": "进行和声级别的校准：使用1枚20面骰进行1次投掷，结果大于等于14则成功。成功完成校准后降低自身2点入迷值。",
      "success_rate": "35%",
      "image_url": "assets/images/img_WaE5tlQ25w.webp",
      "score": 5.6,
      "grade": "B",
      "archetypes": [
        "破局队"
      ],
      "inspire": 3,
      "_category": "gift_cards",
      "dims": {
        "power": 4.3,
        "flex": 7.1,
        "synergy": 5.8,
        "stable": 5.3
      },
      "brief": "合格可用，泛用度高，单点收益有限，破局队组件。"
    },
    {
      "name": "1000$",
      "number": 4,
      "type": "金币",
      "effect": "获得1000金币",
      "flavor": "大量的金币，其数量之多就连予也会为之动容。",
      "image_url": "assets/images/img_EUcoM94UDI.webp",
      "score": 6.1,
      "grade": "B",
      "inspire": 4,
      "_category": "gift_cards",
      "dims": {
        "power": 4.0,
        "flex": 7.5,
        "synergy": 6.2,
        "stable": 7.4
      },
      "brief": "合格可用，泛用度高、稳定可靠，单点收益有限。"
    }
  ],
  "gift_card_rules": {
    "pity": "每抽取6次馈赠卡必定附赠1张和声，之后重置计数",
    "draw_immediate": "馈赠卡抽到即用，抽到金币立即获得对应数字的金币",
    "resonance_effect": "共鸣者永续：抽馈赠卡时卡池中不出现200$，其余卡数量不变(提升Noise/和声概率)",
    "iori_passive": "伊织被动：抽馈赠卡时不会抽到500$"
  },
  "music_cards": [
    {
      "name": "乐谱碎片·序幕",
      "number": 2,
      "inspiration_gain": 2,
      "note": "获得时立即给予2点激励点数",
      "options": [
        "获得1点引导核心",
        "抽取1张馈赠卡",
        "进入过载状态，持续3次行动"
      ],
      "image_url": "assets/images/img_IdcxSaltiv.webp",
      "score": 4.1,
      "grade": "C",
      "inspire": 2,
      "effect": "获得时立即给予2点激励点数。三选一：获得1点引导核心；抽取1张馈赠卡；进入过载状态，持续3次行动。过载：持续期间内每因使用而让卡进入墓地的场合抽1张。",
      "_category": "music_cards",
      "dims": {
        "power": 3.3,
        "flex": 4.8,
        "synergy": 3.6,
        "stable": 4.8
      },
      "brief": "偏特化，泛用度高，单点收益有限。"
    },
    {
      "name": "乐谱碎片·渐起",
      "number": 3,
      "inspiration_gain": 3,
      "note": "获得时立即给予3点激励点数",
      "options": [
        "获得1点引导核心",
        "抽取1张馈赠卡",
        "前进/后退2格"
      ],
      "image_url": "assets/images/img_VCzoMObTzi.webp",
      "score": 4.6,
      "grade": "C",
      "inspire": 3,
      "effect": "获得时立即给予3点激励点数。三选一：获得1点引导核心；抽取1张馈赠卡；前进/后退2格。",
      "_category": "music_cards",
      "dims": {
        "power": 4.0,
        "flex": 5.2,
        "synergy": 4.0,
        "stable": 5.2
      },
      "brief": "偏特化，收益直接、泛用度高。"
    },
    {
      "name": "乐谱碎片·回响",
      "number": 4,
      "inspiration_gain": 4,
      "note": "获得时立即给予4点激励点数",
      "options": [
        "获得1点引导核心",
        "抽取1张馈赠卡",
        "前进/后退3格"
      ],
      "image_url": "assets/images/img_qje6aeAIwP.webp",
      "score": 5.1,
      "grade": "C",
      "inspire": 4,
      "effect": "获得时立即给予4点激励点数。三选一：获得1点引导核心；抽取1张馈赠卡；前进/后退3格。",
      "_category": "music_cards",
      "dims": {
        "power": 4.6,
        "flex": 5.6,
        "synergy": 4.4,
        "stable": 5.6
      },
      "brief": "偏特化，收益直接、泛用度高，协同依赖低。"
    },
    {
      "name": "乐谱碎片·高涨",
      "number": 5,
      "inspiration_gain": 5,
      "note": "获得时立即给予5点激励点数",
      "options": [
        "获得1点引导核心",
        "抽取1张馈赠卡",
        "前进/后退4格"
      ],
      "image_url": "assets/images/img_YbvDbFDiqJ.webp",
      "score": 5.6,
      "grade": "B",
      "inspire": 5,
      "effect": "获得时立即给予5点激励点数。三选一：获得1点引导核心；抽取1张馈赠卡；前进/后退4格。",
      "_category": "music_cards",
      "dims": {
        "power": 5.3,
        "flex": 6.0,
        "synergy": 4.8,
        "stable": 6.0
      },
      "brief": "合格可用，收益直接、泛用度高，协同依赖低。"
    },
    {
      "name": "乐谱碎片·尾声",
      "number": 6,
      "inspiration_gain": 6,
      "note": "获得时立即给予6点激励点数",
      "options": [
        "获得1点引导核心",
        "抽取1张馈赠卡",
        "前进/后退5格"
      ],
      "image_url": "assets/images/img_TXaVuOWff7.webp",
      "score": 6.1,
      "grade": "B",
      "inspire": 6,
      "effect": "获得时立即给予6点激励点数。三选一：获得1点引导核心；抽取1张馈赠卡；前进/后退5格。",
      "_category": "music_cards",
      "dims": {
        "power": 6.0,
        "flex": 6.4,
        "synergy": 5.2,
        "stable": 6.4
      },
      "brief": "合格可用，收益直接、泛用度高，协同依赖低。"
    },
    {
      "name": "乐谱碎片·谢幕",
      "number": 7,
      "inspiration_gain": 7,
      "note": "获得时立即给予7点激励点数",
      "options": [
        "获得1点引导核心",
        "抽取1张馈赠卡",
        "进入过载状态，直到本场游戏结束"
      ],
      "image_url": "assets/images/img_nnUdIaSfOk.webp",
      "score": 6.6,
      "grade": "B",
      "inspire": 7,
      "effect": "获得时立即给予7点激励点数。三选一：获得1点引导核心；抽取1张馈赠卡；进入过载状态，直到本场游戏结束。过载：持续期间内每因使用而让卡进入墓地的场合抽1张。",
      "_category": "music_cards",
      "dims": {
        "power": 6.7,
        "flex": 6.8,
        "synergy": 5.6,
        "stable": 6.8
      },
      "brief": "合格可用，收益直接、泛用度高，协同依赖低。"
    }
  ],
  "music_card_rules": {
    "consumable": "乐谱是一次性消耗品，获得时立即积累对应激励点数",
    "overload": "过载：持续期间内，每因为使用而让卡进入墓地的场合抽一张",
    "guide_core": "1点引导核心可以直接提升1等级"
  },
  "level_system": {
    "max_level": 10,
    "cost_1_to_5": "Lv1→2需1点，Lv2→3需2点，Lv3→4需3点，Lv4→5需4点，Lv5→6需5点（当前等级-1）",
    "cost_6_plus": "从Lv6开始每升一级需要7点激励点数",
    "inspiration_cap_1_to_5": "Lv1至Lv5激励条上限为5",
    "key_levels": "Lv1, Lv4, Lv7, Lv10(Max)为关键等级（蓝色标记）",
    "guide_core": "1点引导核心可直接提升1等级"
  },
  "event_cards": [
    {
      "name": "交互冲动",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "触发者立即瞬移至最近的交互格，那之后获得500$。交互格：商城、公交/地铁站、配电室和标明可交互的格子。[入间枫]总是被各种甜品吸引，其触发时改为前往任意一个交互格且获得1000$，若[入间予]也在场则改为获得[入间予]2000$。",
      "image": "assets/images/img_N1w8AiTdJN.webp",
      "image_url": "assets/images/img_KlpWEtQ3do.webp",
      "score": 6.0,
      "grade": "B",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 6.1,
        "flex": 5.8,
        "synergy": 6.0,
        "stable": 6.0
      },
      "brief": "合格可用，收益直接，较挑构筑与时机。"
    },
    {
      "name": "即兴演出",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "弹奏者投掷2枚6面骰，根据结果执行对应效果：1.<8，可以回复3点音韵值；2.=8，可以回复1名玩家1点入迷值；3.>8，可以降低自身1点入迷值。[松山惠]触发时可以使用3枚6面骰并且立即回复3点音韵值。",
      "image": "assets/images/img_HkLkbvQmi2.webp",
      "image_url": "assets/images/img_d96Q2Pq2Vu.webp",
      "score": 5.2,
      "grade": "C",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 5.6,
        "flex": 5.2,
        "synergy": 5.2,
        "stable": 4.6
      },
      "brief": "偏特化，收益直接、泛用度高，吃判定/略有波动。"
    },
    {
      "name": "命运之回声",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "触发者选场上一张功能卡破坏，那之后将被破坏的卡移出本局游戏。[露璐缇雅·爱德华]在进行破坏后可以将一张移出游戏的卡加入手卡。",
      "image": "assets/images/img_upjIantKpx.webp",
      "image_url": "assets/images/img_GUKoeQAYIx.webp",
      "score": 5.5,
      "grade": "B",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 6.6,
        "flex": 4.8,
        "synergy": 4.9,
        "stable": 4.9
      },
      "brief": "偏特化，收益直接，较挑构筑与时机。"
    },
    {
      "name": "圆桌会议",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "所有玩家降低1点入迷值，之后降低了入迷值的玩家依次移动至「Game」格。",
      "image": "assets/images/img_4V3I8IBqQJ.webp",
      "image_url": "assets/images/img_8AnE4XfvvN.webp",
      "score": 5.8,
      "grade": "B",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 5.8,
        "flex": 5.8,
        "synergy": 5.8,
        "stable": 5.8
      },
      "brief": "合格可用，收益直接。"
    },
    {
      "name": "大风",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "终止所有的移动动作。触发后，所有玩家下次执行的位移效果-2。[现实间里绪]与[木原光太郎]不受此事件影响。",
      "image": "assets/images/img_jV73D6KuZa.webp",
      "image_url": "assets/images/img_vd2h3iGpbb.webp",
      "score": 5.0,
      "grade": "C",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 5.0,
        "flex": 5.0,
        "synergy": 5.0,
        "stable": 5.0
      },
      "brief": "偏特化，收益直接。"
    },
    {
      "name": "独奏",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "触发者进行一次掷骰动作（使用一枚20面骰）根据点数执行满足条件的效果：1.偶数，回复2点音韵值；2.个位数字为4的正整数倍数，降低自身1点入迷值；3.为4的正整数倍数，回复2点音韵值；4.≥16，降低自身1点入迷值。[松山惠]触发此事件时立即降低自身1点入迷值。",
      "image": "assets/images/img_87sC24sldD.webp",
      "image_url": "assets/images/img_dA4qry3waW.webp",
      "score": 5.0,
      "grade": "C",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 5.4,
        "flex": 5.0,
        "synergy": 5.0,
        "stable": 4.4
      },
      "brief": "偏特化，收益直接、泛用度高，吃判定/略有波动。"
    },
    {
      "name": "王车易位",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "触发者可以交换地图上两个格子的效果，持续两轮。",
      "image": "assets/images/img_BwRKfuQpyR.webp",
      "image_url": "assets/images/img_HiBI3ULlfv.webp",
      "score": 6.2,
      "grade": "B",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 6.2,
        "flex": 6.2,
        "synergy": 6.2,
        "stable": 6.2
      },
      "brief": "合格可用，收益直接。"
    },
    {
      "name": "赌徒游戏",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "触发者支付500金币，投掷3枚6面骰，若结果：①有两个数字相同，获得2000金币；②有三个数字相同，获得3000金币；③没有数字相同，后退一步。[木原]家族成员在进行该游戏时，可以投掷4枚6面骰。",
      "image": "assets/images/img_pbGTUDQGn6.webp",
      "image_url": "assets/images/img_oflxrBF4j3.webp",
      "score": 5.0,
      "grade": "C",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 5.3,
        "flex": 5.0,
        "synergy": 5.0,
        "stable": 4.5
      },
      "brief": "偏特化，收益直接、泛用度高，吃判定/略有波动。"
    },
    {
      "name": "躁动之心",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "触发者进行3次校准（成功点数标明在括号内）：第一次使用12面骰（点数≥6），第二次使用8面骰（点数≥6），第三次使用6面骰（点数≥6）。根据校准成功次数执行效果：1次，降低自身1点入迷值；2次，降低自身1点入迷值；3次，降低自身1点入迷值。[入间予]每进行一次校准都会回复1点音韵值。",
      "image": "assets/images/img_y6w4wR8vJ2.webp",
      "image_url": "assets/images/img_McCy379mIF.webp",
      "score": 5.8,
      "grade": "B",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 6.2,
        "flex": 5.8,
        "synergy": 5.8,
        "stable": 5.2
      },
      "brief": "合格可用，收益直接、泛用度高，吃判定/略有波动。"
    },
    {
      "name": "闲庭信步",
      "type": "事件卡",
      "category": "event_cards",
      "attribute": "无序",
      "cost": 0,
      "effect": "触发者从以下效果选择一项适用：1.前进/后退一格，获得2点音韵值；2.原地跳跃一次。[现实间里绪]触发此事件时可以先后执行两项。",
      "image": "assets/images/img_X01v4ZlVFJ.webp",
      "image_url": "assets/images/img_FRVcQa2fbd.webp",
      "score": 5.2,
      "grade": "C",
      "archetypes": [],
      "_category": "event_cards",
      "dims": {
        "power": 5.4,
        "flex": 5.1,
        "synergy": 5.1,
        "stable": 5.1
      },
      "brief": "偏特化，收益直接，较挑构筑与时机。"
    }
  ],
  "omikuji": [
    {
      "name": "御神签·大吉",
      "count": 1,
      "type": "和声校准",
      "effect": "进行一次[和声]级别的校准（使用一枚20面骰，点数≥14则为成功），成功校准后降低自身2点入迷值并回复3点音韵值。",
      "flavor": "大吉，是大吉啊！恭喜恭喜！",
      "image_url": "assets/images/img_MRGVhU53ZN.webp",
      "inspiration": 6,
      "grade": "A",
      "score": 7.0,
      "inspire": 6,
      "_category": "omikuji",
      "dims": {
        "power": 7.4,
        "flex": 7.0,
        "synergy": 7.0,
        "stable": 6.4
      },
      "brief": "优秀，收益直接、泛用度高。"
    },
    {
      "name": "御神签·大凶",
      "count": 1,
      "type": "和声校准",
      "effect": "进行一次[和声]级别的校准（使用一枚20面骰，点数≥17则为成功），成功校准后降低自身2点入迷值。校准失败则失去8点同步值和2点音韵值。",
      "flavor": "不过是神明大人的考验罢了！对...吧......",
      "image_url": "assets/images/img_EVV6OYujed.webp",
      "inspiration": 6,
      "grade": "C",
      "score": 4.0,
      "inspire": 6,
      "_category": "omikuji",
      "dims": {
        "power": 4.2,
        "flex": 4.2,
        "synergy": 4.1,
        "stable": 3.3
      },
      "brief": "偏特化，收益直接、泛用度高，吃判定/略有波动。"
    },
    {
      "name": "御神签·吉",
      "count": 1,
      "type": "Noise校准",
      "effect": "进行一次[Noise]级别的校准（使用一枚20面骰，自选难度：①点数>10为成功 ②点数≤10为成功），成功校准后降低自身1点入迷值并回复2点音韵值。",
      "flavor": "吉！马上要有好事发生了！",
      "image_url": "assets/images/img_RGWkKS88f9.webp",
      "inspiration": 4,
      "grade": "B",
      "score": 6.2,
      "inspire": 4,
      "_category": "omikuji",
      "dims": {
        "power": 6.6,
        "flex": 6.2,
        "synergy": 6.2,
        "stable": 5.6
      },
      "brief": "合格可用，收益直接、泛用度高，吃判定/略有波动。"
    },
    {
      "name": "御神签·凶",
      "count": 1,
      "type": "Noise校准",
      "effect": "进行一次[Noise]级别的校准（使用一枚20面骰，点数>13为成功），成功校准后降低自身1点入迷值。校准失败则失去5点同步值和1点音韵值。",
      "flavor": "非常可惜！相信你总有办法转危为安的！",
      "image_url": "assets/images/img_K8SVIsmytW.webp",
      "inspiration": 4,
      "grade": "C",
      "score": 4.8,
      "inspire": 4,
      "_category": "omikuji",
      "dims": {
        "power": 5.0,
        "flex": 5.0,
        "synergy": 4.9,
        "stable": 4.1
      },
      "brief": "偏特化，收益直接、泛用度高，吃判定/略有波动。"
    },
    {
      "name": "御神签·小吉",
      "count": 4,
      "type": "基础祝福",
      "effect": "回复自身3点音韵值或前进3-6格。",
      "flavor": "是小吉呢！会有好事发生的！",
      "image_url": "assets/images/img_UZLHwKeLMk.webp",
      "inspiration": 3,
      "grade": "B",
      "score": 5.8,
      "inspire": 3,
      "_category": "omikuji",
      "dims": {
        "power": 5.8,
        "flex": 5.8,
        "synergy": 5.8,
        "stable": 5.8
      },
      "brief": "合格可用，收益直接。"
    },
    {
      "name": "御神签·中吉",
      "count": 3,
      "type": "基础祝福",
      "effect": "回复自身5点音韵值或前进3-8格。",
      "flavor": "中吉啊！运势不断积累中哦！",
      "image_url": "assets/images/img_P7dKpYqBT1.webp",
      "inspiration": 5,
      "grade": "B",
      "score": 6.4,
      "inspire": 5,
      "_category": "omikuji",
      "dims": {
        "power": 6.7,
        "flex": 6.2,
        "synergy": 6.2,
        "stable": 6.2
      },
      "brief": "合格可用，收益直接。"
    },
    {
      "name": "御神签·绪吉",
      "count": 1,
      "type": "和声校准",
      "effect": "进行一次[和声]级别的校准（使用一枚20面骰，点数≥12则为成功），成功校准后降低自身2点入迷值并回复6点音韵值。",
      "flavor": "是和那家伙一样的好运呢！",
      "image_url": "assets/images/img_Yg30GI2UTj.webp",
      "inspiration": 7,
      "grade": "A+",
      "score": 7.8,
      "inspire": 7,
      "_category": "omikuji",
      "dims": {
        "power": 8.2,
        "flex": 7.8,
        "synergy": 7.8,
        "stable": 7.2
      },
      "brief": "强势，收益直接、泛用度高。"
    }
  ],
  "emojis": [
    {
      "name": "不想动",
      "character": "入间予",
      "image_url": "assets/images/img_TWFCX4Sic2.webp",
      "description": "瘫倒不想动"
    },
    {
      "name": "交给我",
      "character": "入间予",
      "image_url": "assets/images/img_TR8BdPl4jU.webp",
      "description": "自信交给我"
    },
    {
      "name": "让我想想",
      "character": "入间予",
      "image_url": "assets/images/img_nd3vdc5CUi.webp",
      "description": "思考中"
    },
    {
      "name": "问号",
      "character": "入间予",
      "image_url": "assets/images/img_IB3QmT4tzO.webp",
      "description": "疑惑问号"
    },
    {
      "name": "你再说一遍",
      "character": "小沙香琉璃",
      "image_url": "assets/images/img_8T4L6s1TYr.webp",
      "description": "威胁表情"
    },
    {
      "name": "哼",
      "character": "小沙香琉璃",
      "image_url": "assets/images/img_4wFYTQVqoE.webp",
      "description": "傲娇生气"
    },
    {
      "name": "好的",
      "character": "小沙香琉璃",
      "image_url": "assets/images/img_Qxmz2JsNwW.webp",
      "description": "开心答应"
    },
    {
      "name": "诶",
      "character": "小沙香琉璃",
      "image_url": "assets/images/img_nOdDGEkHif.webp",
      "description": "惊讶疑惑"
    },
    {
      "name": "冲",
      "character": "小野里绪",
      "image_url": "assets/images/img_aCXEeWokDk.webp",
      "description": "干劲十足"
    },
    {
      "name": "好耶",
      "character": "小野里绪",
      "image_url": "assets/images/img_WEJVNpU3Cv.webp",
      "description": "开心欢呼"
    },
    {
      "name": "开黑",
      "character": "小野里绪",
      "image_url": "assets/images/img_gvJ0SG9rkU.webp",
      "description": "一起开黑"
    },
    {
      "name": "累死了",
      "character": "小野里绪",
      "image_url": "assets/images/img_buq5UBTRkI.webp",
      "description": "疲惫瘫倒"
    }
  ]
};
