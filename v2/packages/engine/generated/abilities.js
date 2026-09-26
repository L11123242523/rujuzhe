/**
 * 入局者 v2 · 逐卡能力（**自动生成，请勿手改**）
 * ---------------------------------------------------------------------------
 * 来源：content/abilities.json（人可读真源）+ content/cards/characters（角色名与 sp_member）。
 *   卡能力 13 条：已实现 12 / 已登记待实现 1
 *   角色被动 27 条：已实现 26 / 已登记待实现 1
 *   角色名未解析：（按唯一子串解析）sakura.startStats:樱→宫樱子
 * 运行时不碰 fs —— 内容在这里以 ESM 常量形式提供。
 */

export const ABILITY_SOURCE = {
  "note": "逐卡能力声明（内容层）。这里放的是**编译器产不出来的东西**：永续卡的常驻修正、反制整效、专用卡脚本。旧引擎对应的是散落在 computeDamageValue / runOneOp / SPECIAL_CARD_HANDLERS 里的按卡名 indexOf 硬编。",
  "schema": {
    "id": "唯一 id（来源:机制）",
    "card": "卡名（与 content/cards 里的 name 一致）",
    "chainKind": "可选：显式连锁种类（编译不出 ops 但确有连锁语义时用）",
    "modifiers": "[{ when:'always|counter|judge|sanity', add:N, source:'permanent|passive', label }] 常驻伤害修正",
    "regen": "自然回复加成（仅当来源在效果处理区时生效）",
    "maxCost": "音韵上限加成",
    "damagePay": "{ sync:N, add:N } 造伤时可付同步值让最终伤害 +N（一回合一次）",
    "negateEffect": "true = 可反制整效（把 C1 标记 cancelled）",
    "script": "专用卡脚本 id（编译器与 ops 都表达不了的流程，如堆沙堡的配对）",
    "status": "'implemented' | 'declared'（declared 表示已登记但实现排后续阶段）"
  }
};

export const CARD_ABILITIES = [
  {
    "id": "xuejie.regen",
    "card": "血之佑戒·红泪拉克莎",
    "regen": 2,
    "maxCost": 2,
    "damagePay": {
      "sync": 2,
      "add": 1,
      "oncePerTurn": true
    },
    "status": "implemented",
    "note": "旧引擎是 C 类（编译不出）＋6 处按卡名 indexOf 硬编；卡面 2026-09-25 版：发动时回3音韵 / 每回合自然回复+2 / 上限+2 / 一回合一次付2同步让最终伤害+1"
  },
  {
    "id": "shanyi.mask",
    "card": "善意面具",
    "modifiers": [
      {
        "when": "always",
        "add": 1,
        "source": "permanent",
        "label": "善意面具·攻击卡最终+1",
        "onlyIf": {
          "cardCategory": "attack_cards"
        }
      }
    ],
    "status": "implemented",
    "note": "旧引擎在 computeDamageValue 里按永续卡名 indexOf('善意面具') 硬编；文本有效果但编译成空 ops（被 P3 的'空 ops'闸抓到）"
  },
  {
    "id": "wutuobang.negate",
    "card": "崩塌之乌托邦",
    "chainKind": "negate_effect",
    "negateEffect": true,
    "status": "implemented",
    "note": "反制整效：旧引擎靠 __isCounterText 文本判定 + SPECIAL 兜底；新引擎用显式 chainKind + 窗口的 C1 取消通道"
  },
  {
    "id": "fengji.armband",
    "card": "风纪委员臂章",
    "modifiers": [
      {
        "when": "sanity",
        "add": 1,
        "source": "permanent",
        "label": "风纪委员臂章·理智最终+1"
      }
    ],
    "status": "implemented",
    "note": "旧引擎在 computeDamageValue 里 hasPerm('风纪委员') 硬编；作者口径：C1 在结算期间就算在场，可以吃到自己的光环 —— 新引擎 playCard 已让永续卡先入场再结算"
  },
  {
    "id": "resonator.giftFilter",
    "card": "共鸣者",
    "giftPoolFilter": {
      "exclude": [
        "200$"
      ]
    },
    "status": "implemented",
    "note": "卡面：只要此卡以正面形式存在区域内，持有者抽馈赠卡时卡池中不会出现[200$]（其余卡数量不变）"
  },
  {
    "id": "coreProvider.opsOverride",
    "card": "核心的供给者",
    "mechanism": "opsOverride",
    "status": "implemented",
    "params": {
      "main": [
        {
          "op": "gain_core",
          "n": 1
        }
      ],
      "activated": [
        {
          "op": "gain_motivation",
          "n": 3,
          "oncePerTurn": true
        }
      ],
      "triggers": [
        {
          "point": "on_level_up",
          "ops": [
            {
              "op": "choice",
              "labels": [
                "①队伍攻击力+1",
                "②选移出游戏的一张卡加入手卡（限一次）",
                "③对一名玩家造成一次四面骰判定伤害"
              ],
              "branches": [
                [
                  {
                    "op": "attack_buff",
                    "amount": 1
                  }
                ],
                [
                  {
                    "op": "search",
                    "sources": [
                      "removed"
                    ],
                    "need": 1,
                    "to": "hand"
                  }
                ],
                [
                  {
                    "op": "damage",
                    "judge": true,
                    "dice": "d4",
                    "base": 0
                  }
                ]
              ]
            }
          ]
        }
      ]
    },
    "note": "**编译产物与卡面不符**：编译器把『每次提升等级后三选一』编进了主效果，而卡面『发动时作为效果处理』只该给 1 点引导核心。这里用内容层覆盖（main 真源优先于编译产物），并把三选一登记为**升级触发**（on_level_up 时点，P4c 第十批接线）"
  },
  {
    "id": "engraving.opsOverride",
    "card": "镌刻的艺术",
    "mechanism": "opsOverride",
    "status": "implemented",
    "params": {
      "main": [
        {
          "op": "search",
          "sources": [
            "deck",
            "removed"
          ],
          "tags": [
            "侵略"
          ],
          "need": 1,
          "to": "hand"
        }
      ],
      "activated": [
        {
          "op": "pay_sync",
          "amount": 4
        },
        {
          "op": "gain_cost",
          "amount": 2
        }
      ]
    },
    "note": "编译产物把『每个自己的回合可以发动一次，支付 4 点同步值回复 2 点音韵』也编进了发动效果（于是打出就白回 2 音韵）。卡面里那是**主动发动**的能力，发动时只有检索。故覆盖 main，主动能力登记为 activated"
  },
  {
    "id": "yokai.opsOverride",
    "card": "妖刀五月雨",
    "mechanism": "opsOverride",
    "status": "implemented",
    "params": {
      "main": [
        {
          "op": "destroy_pick",
          "zone": "permanent",
          "to": "grave",
          "who": "target"
        },
        {
          "op": "damage",
          "base": 5,
          "kind": "混沌"
        },
        {
          "op": "loss_sync",
          "amount": 3,
          "targetWho": "self"
        }
      ],
      "triggers": [
        {
          "point": "on_damage_ge_5",
          "oncePerTurn": true,
          "optional": true,
          "ops": [
            {
              "op": "choice",
              "labels": [
                "①破坏场上1张卡，自己失3同步",
                "②抽1张卡，自己失3同步"
              ],
              "branches": [
                [
                  {
                    "op": "destroy_pick",
                    "zone": "permanent",
                    "to": "grave",
                    "who": "target"
                  },
                  {
                    "op": "loss_sync",
                    "amount": 3,
                    "targetWho": "self"
                  }
                ],
                [
                  {
                    "op": "draw",
                    "n": 1
                  },
                  {
                    "op": "loss_sync",
                    "amount": 3,
                    "targetWho": "self"
                  }
                ]
              ]
            }
          ]
        }
      ]
    },
    "note": "编译产物把**『每回合一次』的触发式可选（①②）当成了发动效果**，而真正的『发动时：破坏场上1张卡 → 造5混沌 → 自己失3同步』被丢了；且破坏目标被编成 who:self（旧引擎破坏的是**对手**的卡）。故内容层覆盖 main 并把 ①② 登记为触发"
  },
  {
    "id": "ruler.opsOverride",
    "card": "设计师的直尺",
    "mechanism": "opsOverride",
    "status": "implemented",
    "params": {
      "main": [
        {
          "op": "move",
          "n": 4
        }
      ],
      "activated": [
        {
          "op": "pay_cost_move",
          "perCost": 1,
          "perTile": 1
        }
      ]
    },
    "note": "编译产物把**主动能力**『每支付 1 点音韵前进 1 格』编成了发动时的第二次 `move 1`（于是打出就多走 1 格，落到别的格子又触发格子效果，位置差 4 格、金币差 200）。发动时只有『前进 4 格』。另：SP『单回合每移动 8 格→2 点理智』尚未实现"
  },
  {
    "id": "craftsman.opsOverride",
    "card": "巧匠之手",
    "mechanism": "opsOverride",
    "status": "implemented",
    "params": {
      "main": [
        {
          "op": "sacrifice_now",
          "toRemoved": true
        },
        {
          "op": "draw",
          "n": 1
        }
      ],
      "optional": [
        {
          "op": "search",
          "sources": [
            "removed"
          ],
          "need": 1,
          "to": "hand",
          "who": "self",
          "excludeSelf": true
        }
      ]
    },
    "note": "卡面写『那之后**可以**选…加入手卡』是**可选**，编译成了必发；且被献祭的卡应进**移出游戏**而不是墓地（`toRemoved`）"
  },
  {
    "id": "blueGem.opsOverride",
    "card": "蓝宝之杖·命",
    "mechanism": "opsOverride",
    "status": "implemented",
    "params": {
      "main": [
        {
          "op": "damage",
          "judge": true,
          "dice": "d6",
          "base": 2
        }
      ],
      "triggers": [
        {
          "point": "on_judge_damage",
          "oncePerTurn": true,
          "optional": true,
          "ops": [
            {
              "op": "damage",
              "judge": true,
              "dice": "coin",
              "base": 2
            }
          ]
        }
      ]
    },
    "note": "编译产物把『每回合首次造成判定伤害后可以追加一次硬币判定』也编进了发动效果（变成两段必发）。卡面是：**发动时**只有 6 面骰判定伤害；硬币那半是**触发式可选**（每回合首次）。故覆盖 main，并把追加部分登记为触发（P4c 第十二批接 on_judge_damage）"
  },
  {
    "id": "blackCard.opsOverride",
    "card": "黑色卡片",
    "mechanism": "opsOverride",
    "status": "implemented",
    "params": {
      "main": [],
      "triggers": [
        {
          "point": "on_turn_start",
          "ops": [
            {
              "op": "draw",
              "n": 1
            }
          ]
        },
        {
          "point": "on_sacrifice",
          "oncePerTurn": true,
          "ops": [
            {
              "op": "gain_cost",
              "amount": 1
            }
          ]
        }
      ]
    },
    "note": "编译产物把三条**被动**（每回合开始额外抽 1 / 金币花费减 1000 / 每回合首次献祭额外回 1 音韵）编成了发动时的即时效果（抽 1 张 + 回 1 音韵）。卡面里这张是永续卡、**发动时没有效果**。故覆盖 main 为空，三条被动登记为触发/减免（后续批次接线；金币减免需进 quoteCost 的修正通道）"
  },
  {
    "id": "duishabao.script",
    "card": "小试身手！堆沙堡",
    "script": "sandcastle",
    "status": "declared",
    "phase": "P4b",
    "note": "配对流程（亮出牌组顶 → 手卡同属性/同费配对 → 放回洗切 → 按配对数分级）：需要专用脚本而不是 ops；已登记，实现排 P4b"
  }
];

/** 角色卡数据（名字 → 队员位 SP 是否生效）。**这是"队员位是否生效"的唯一真源**。 */
export const CHARACTERS = [
  {
    "name": "现实间冬马",
    "spMember": true,
    "groupSP": true,
    "sp": "使用攻击卡或技能卡之后前进1-3格。作为队员编组也生效。与其他队员编组类效果冲突。"
  },
  {
    "name": "入间枫",
    "spMember": true,
    "groupSP": true,
    "sp": "游戏开始时队伍从以下效果中选择两项适用：①回复6点音韵值②抽2张卡③每回合献祭次数+1。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。"
  },
  {
    "name": "枫(水着)",
    "spMember": true,
    "groupSP": true,
    "sp": "小队中每名成员自然回复的音韵值增加50%（向下），造成的理智属性伤害+1。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。"
  },
  {
    "name": "木原光太郎",
    "spMember": true,
    "groupSP": true,
    "sp": "队伍每回合献祭次数+1，每回合首次完成献祭后可以从以下效果中选择一项执行：①获得500金币②增加1点队伍攻击力③对一名其他玩家造成1点无序属性伤害。这个效果即使作为队员编组也会生效。这个效果会与其他队员编组类效果冲突。"
  },
  {
    "name": "松山惠",
    "spMember": false,
    "groupSP": false,
    "sp": "以下为目前已有的乐曲：①乐曲α，回复4点音韵值并抽1张②乐曲β，执行一次献祭动作，且那次献祭回复的音韵值+2③乐曲γ，回复6点同步值并抽取一张[馈赠卡]④乐曲δ，本回合献祭次数+1，那之后对一名其他玩家造成4点理智属性伤害。"
  },
  {
    "name": "小野结衣",
    "spMember": true,
    "groupSP": true,
    "sp": "使用攻击卡或[侵略]技能卡最终伤害+1，无视1护盾。作为队员编组也生效。与其他队员编组类效果冲突。"
  },
  {
    "name": "小野葵",
    "spMember": true,
    "groupSP": true,
    "sp": "初始手牌+1，暴击伤害+1；游戏开始时队伍携带的所有卡在首次使用时所需要的音韵值-1。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。"
  },
  {
    "name": "里尔亚斯·斯塔芙莉娅斯特",
    "spMember": true,
    "groupSP": true,
    "sp": "队伍每回合献祭次数+1，每次献祭后回自身1同步。作为队员编组也生效。与其他队员编组类效果冲突。"
  },
  {
    "name": "莉莉·缇雅菲洛",
    "spMember": false,
    "groupSP": false,
    "sp": "莉莉不会被经过类效果影响；此外每个自己回合可以发动一次：把墓地最下方的一张卡放回牌组最下方。如果放回的卡是单次种类的卡并且当前墓地最下方的卡不为单次种类的卡则适用效果：视为使用一次放回牌组的那张卡并回复1点音韵值。"
  },
  {
    "name": "小沙香琉璃",
    "spMember": true,
    "groupSP": true,
    "sp": "造成判定伤害且适用最大伤害后可以抽一张卡并回复2点音韵值。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。"
  },
  {
    "name": "琉璃(水着)",
    "spMember": true,
    "groupSP": true,
    "sp": "队伍初始攻击力+1，三名都是热忱属性角色还会额外+1。此外一回合一次，队伍造成热忱属性伤害后回复1点音韵值。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。"
  },
  {
    "name": "琉璃(万圣祭)",
    "spMember": true,
    "groupSP": true,
    "sp": "一回合一次，当有玩家的卡不因使用而离开其原本所在的区域时可以发动，自己抽一张卡。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。"
  },
  {
    "name": "现实间里绪",
    "spMember": true,
    "groupSP": true,
    "sp": "全队造成的判定伤害+1。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。"
  },
  {
    "name": "里绪(水着)",
    "spMember": true,
    "groupSP": true,
    "sp": "首次投掷后可以回复与骰子点数相同的音韵值；首次移动后还能再抽2张卡。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。"
  },
  {
    "name": "露璐缇雅·爱德华",
    "spMember": false,
    "groupSP": false,
    "sp": "这张卡编组时会作为2名[破坏者]角色计数；队伍中的[破坏者]角色合计在三名以上时每个自己回合都可以发动一次：破坏一名玩家区域内的一张卡，然后其回复4点音韵值。"
  },
  {
    "name": "霜烬",
    "spMember": true,
    "groupSP": true,
    "sp": "霜烬不会为队伍提供攻击卡和技能卡，但队伍每回合自然回复的音韵值+1，初始手牌+1；这个效果即使作为队员编组也会生效。这个效果会与其他队员编组类效果冲突。"
  },
  {
    "name": "XHZD",
    "spMember": true,
    "groupSP": true,
    "sp": "在投掷阶段可以选择使用8面骰，6面骰或4面骰中的一个进行投掷。此外，队伍可以在每名玩家的回合结束阶段支付音律值来回复等同于支付数值2倍的同步值。这个效果即使作为队员编组也会生效。这个效果会与其他队员编组类效果冲突。"
  },
  {
    "name": "小仓霞",
    "spMember": true,
    "groupSP": true,
    "sp": "到达公共站/地铁可直接移动至该线路或转乘线路下车点，无需判定和支付费用。作为队员编组也生效。与其他队员编组类效果冲突。"
  },
  {
    "name": "椎名小春",
    "spMember": false,
    "groupSP": false,
    "sp": "[先机]：自己的回合内可以消耗1/2/3点先机来让自己追加一个掷骰阶段（每回合首次消耗1点之后每次使用+1，最多消耗3点）。小春每消耗1点先机可以回复1点音韵值。"
  },
  {
    "name": "星奈(水着)",
    "spMember": true,
    "groupSP": true,
    "sp": "造成多段伤害时每命中一段可以前进1格，然后回复自身1点音韵值。这个效果即使作为队员编组时也会生效。这个效果会与其他队员编组类效果冲突。"
  },
  {
    "name": "宫樱子",
    "spMember": true,
    "groupSP": true,
    "sp": "队伍攻击+2，属性克制伤害+1，造成伤害后回1同步。作为队员编组也生效。与其他队员编组类效果冲突。"
  },
  {
    "name": "小野伊织",
    "spMember": true,
    "groupSP": true,
    "sp": "到达[神社]后可以回复自身5点音韵值并抽取一张[馈赠卡]。这个效果即使作为队员编组也会生效。这个效果会与其他队员的编组类效果冲突。"
  },
  {
    "name": "入间予",
    "spMember": false,
    "groupSP": false,
    "sp": "全队造成的判定伤害+1，队伍中每有1名无序属性的成员都会让全队自然回复的音韵值+1。"
  },
  {
    "name": "雨宫羽奈",
    "spMember": true,
    "groupSP": true,
    "sp": "使用[侵略]道具卡最终伤害+1。作为队员编组也生效。与其他队员编组类效果冲突。"
  },
  {
    "name": "羽奈(往昔)",
    "spMember": true,
    "groupSP": true,
    "sp": "自己每有一张公开的卡片都会让全队造成的最终伤害+1。这个效果即使作为队员编组时也会生效。这个效果会与其他队员编组类效果冲突。"
  },
  {
    "name": "宁雨清",
    "spMember": true,
    "groupSP": true,
    "sp": "队伍使用因效果加入手卡的卡时所需要的音韵值-1。这个效果即使作为队员编组时也会生效。这个效果会与其他队员编组类效果冲突。"
  },
  {
    "name": "予(水着)",
    "spMember": true,
    "groupSP": true,
    "sp": "全队理智属性伤害+1，使用理智属性[移动]道具卡后对一名玩家造硬币判定伤害(正面2点，背面0)。作为队员编组也生效。与其他队员编组类效果冲突。"
  }
];

export const CHARACTER_PASSIVES = [
  {
    "id": "toma.moveAccumulate",
    "card": "现实间冬马",
    "role": "captain",
    "mechanism": "moveAccumulateDamage",
    "params": {
      "kind": "无序",
      "label": "冬马被动·分析大师的游刃有余",
      "tiers": [
        {
          "minLevel": 1,
          "every": 5,
          "damage": 1
        },
        {
          "minLevel": 4,
          "every": 4,
          "damage": 2
        },
        {
          "minLevel": 7,
          "every": 3,
          "damage": 3
        }
      ]
    },
    "status": "implemented",
    "note": "旧引擎 accumulateMovePassives（game.html:11003-11014）逐字口径：阈值 5/4/3、伤害 1/2/3；单回合累计，回合结束归零（counters.moveTotalTurn 类）",
    "cardResolved": "现实间冬马",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "sena.singleMoveDamage",
    "card": "星奈(水着)",
    "role": "captainOrMember",
    "memberAllowed": true,
    "mechanism": "singleMoveDamage",
    "params": {
      "minSteps": 6,
      "damage": 1,
      "segments": 2,
      "kind": "理智",
      "label": "星奈(水着)被动·戏水"
    },
    "status": "implemented",
    "note": "旧引擎同函数（11016-11021）：单次移动 >5 格 → 2 段 1 点理智伤害",
    "cardResolved": "星奈(水着)",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "lilith.motivationBonus",
    "card": "里尔亚斯·斯塔芙莉娅斯特",
    "role": "captain",
    "mechanism": "motivationBonus",
    "params": {
      "amount": 1,
      "label": "里尔亚斯被动：获取激励点数额外 +1"
    },
    "status": "implemented",
    "note": "旧引擎 runOneOp 的 gain_motivation 分支（17856）：`op.n + (p._lilithPassive ? 1 : 0)`",
    "cardResolved": "里尔亚斯·斯塔芙莉娅斯特",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "aoi.firstUseDiscount",
    "card": "小野葵",
    "role": "captain",
    "mechanism": "costFlag",
    "params": {
      "flag": "aoiPassive",
      "label": "小野葵被动：携带卡首次使用费用 −1"
    },
    "status": "implemented",
    "note": "旧引擎 computeActualCost（22117-22121）；新引擎 rules/cost.js 的 `aoiFirstUse` 修正读 seat.flags.aoiPassive",
    "cardResolved": "小野葵",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "ning.addedByEffectDiscount",
    "card": "宁雨清",
    "role": "captain",
    "mechanism": "costFlag",
    "params": {
      "flag": "ningSP",
      "label": "宁雨清SP：因效果加入手卡的卡费用 −1"
    },
    "status": "implemented",
    "note": "旧引擎 computeActualCost（22123）；新引擎 rules/cost.js 的 `ningSP` 修正读 seat.flags.ningSP",
    "cardResolved": "宁雨清",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "iori.giftNoP500",
    "card": "小野伊织",
    "role": "captain",
    "mechanism": "giftPoolFilter",
    "params": {
      "exclude": [
        "500$"
      ],
      "label": "小野伊织被动·恩典：抽馈赠卡时不会抽到[500$]"
    },
    "status": "implemented",
    "note": "旧引擎 drawGiftCard（13569-13573）用 `p._ioriPassive` 硬编；注意这是**被动**，与她的 SP（神社加成）是两条",
    "cardResolved": "小野伊织",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "iori.shrineBonus",
    "card": "小野伊织",
    "role": "captain",
    "mechanism": "tileBonus",
    "params": {
      "tile": "shrine",
      "gainCost": 5,
      "drawGift": 1,
      "label": "小野伊织SP：到达神社回 5 音韵并抽 1 张馈赠卡"
    },
    "status": "implemented",
    "note": "旧引擎 `_ioriSP`（19978）",
    "cardResolved": "小野伊织",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "kaedeMizugi.intellect",
    "card": "枫(水着)",
    "role": "captainOrMember",
    "memberAllowed": true,
    "mechanism": "damageModifier",
    "params": {
      "when": "sanity",
      "add": 1,
      "label": "枫(水着)SP：理智伤害 +1"
    },
    "status": "implemented",
    "note": "旧引擎 `p._intellectBonus = (p._intellectBonus||0)+1`（19925）",
    "cardResolved": "枫(水着)",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "yuMizugi.intellect",
    "card": "予(水着)",
    "role": "captainOrMember",
    "memberAllowed": true,
    "mechanism": "damageModifier",
    "params": {
      "when": "sanity",
      "add": 1,
      "label": "予(水着)SP：全队理智伤害 +1"
    },
    "status": "implemented",
    "note": "旧引擎 19990",
    "cardResolved": "予(水着)",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "rio.judge",
    "card": "现实间里绪",
    "role": "captainOrMember",
    "memberAllowed": true,
    "mechanism": "damageModifier",
    "params": {
      "when": "judge",
      "add": 1,
      "label": "里绪SP：判定伤害 +1"
    },
    "status": "implemented",
    "note": "旧引擎 `_judgeDamageBonus`（19949）",
    "cardResolved": "现实间里绪",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "yu.judge",
    "card": "入间予",
    "role": "captainOrMember",
    "memberAllowed": true,
    "mechanism": "damageModifier",
    "params": {
      "when": "judge",
      "add": 1,
      "label": "予SP：判定伤害 +1"
    },
    "status": "implemented",
    "note": "旧引擎 19986",
    "cardResolved": "入间予",
    "spMember": false,
    "groupSP": false
  },
  {
    "id": "yui.skillDamage",
    "card": "小野结衣",
    "role": "captainOrMember",
    "memberAllowed": true,
    "mechanism": "damageModifier",
    "params": {
      "when": "attackSkill",
      "add": 1,
      "label": "小野结衣SP：攻击/侵略技能最终伤害 +1（无视 1 护盾**待实现**）"
    },
    "status": "implemented",
    "note": "旧引擎 `_yuiSP`（19936）：伤害 +1 与`无视1护盾`两半；本条目只落伤害 +1，`无视护盾`部分尚未实现（不假装已做）",
    "cardResolved": "小野结衣",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "hina.aggressionItem",
    "card": "雨宫羽奈",
    "role": "captainOrMember",
    "memberAllowed": true,
    "mechanism": "damageModifier",
    "params": {
      "when": "aggressionItem",
      "add": 1,
      "label": "雨宫羽奈SP：[侵略]道具最终伤害 +1"
    },
    "status": "implemented",
    "note": "旧引擎 `_hinaSP`（19992）",
    "cardResolved": "雨宫羽奈",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "sakura.startStats",
    "card": "宫樱子",
    "role": "captain",
    "mechanism": "startOfGameStat",
    "params": {
      "stats": {
        "attackBuff": 2
      },
      "statuses": {
        "attrBonus": 1
      },
      "label": "樱SP：攻击力 +2、属性克制伤害 +1"
    },
    "status": "implemented",
    "note": "旧引擎在被动注册时**直接改座位字段**（19981：`p.attackBuff += 2; p._attrBonus += 1`）——新引擎改成声明，开局统一施加",
    "cardResolved": "宫樱子",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "yu.afterRollGainCost",
    "card": "入间予",
    "role": "captain",
    "mechanism": "afterRollGainCost",
    "params": {
      "amount": 1,
      "label": "入间予被动·解构与求索：每进行一次投掷后回复自身 1 点音韵值"
    },
    "status": "implemented",
    "note": "卡面（2026-09-26 重做）：『每进行一次投掷后回复自身1点音韵值』",
    "cardResolved": "入间予",
    "spMember": false,
    "groupSP": false
  },
  {
    "id": "yu.prepareMajority",
    "card": "入间予",
    "role": "captain",
    "mechanism": "prepareMajority",
    "params": {
      "label": "入间予被动·解构与求索：准备阶段结束时公开手卡，按数量最多的属性执行效果",
      "branches": {
        "无序": [
          {
            "op": "register_mechanic",
            "kind": "extraRollPhases",
            "n": 2
          }
        ],
        "热忱": [
          {
            "op": "register_mechanic",
            "kind": "followUpJudgeOnDamage",
            "amount": 1
          }
        ],
        "理智": [
          {
            "op": "register_mechanic",
            "kind": "afterSingleItem",
            "draw": 1,
            "discard": 1
          }
        ],
        "混沌": [
          {
            "op": "gain_cost",
            "amount": 4
          },
          {
            "op": "team_attack_buff",
            "amount": 2
          }
        ]
      }
    },
    "status": "implemented",
    "note": "卡面四分支逐字：无序→本回合投掷阶段额外投掷2次；热忱→本回合造成属性伤害后再对相同目标造成1点判定伤害；理智→使用单次种类的卡后抽1张，然后选手卡或区域内1张卡送入墓地；混沌→回复自己4点音韵值，那之后增加2点队伍攻击力",
    "cardResolved": "入间予",
    "spMember": false,
    "groupSP": false
  },
  {
    "id": "aoi.initialHand",
    "card": "小野葵",
    "role": "captain",
    "mechanism": "startOfGameStat",
    "params": {
      "stats": {},
      "statuses": {
        "initialHandBonus": 1,
        "critDamageBonus": 1
      },
      "label": "小野葵SP：初始手牌+1、暴击伤害+1"
    },
    "status": "implemented",
    "note": "卡面（重做后）SP 前两句。**注意**：旧 SP 的『每名成员自然回复音韵+50%（向下）』**已按新卡面删除**（旧引擎 `_aoiRegenPct` 那条不再适用）",
    "cardResolved": "小野葵",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "aoi.gospel",
    "card": "小野葵",
    "role": "captain",
    "mechanism": "secondRollGift",
    "params": {
      "gainCost": 2,
      "oncePerPlayerPerRound": true,
      "label": "小野葵被动·福音雅颂"
    },
    "status": "implemented",
    "note": "卡面：『一轮内每名玩家限一次，当有玩家在同一个回合进行了第二次投掷后可以发动，其可以选择自己墓地的一张单次种类的卡加入手卡（以此法加入的那张卡使用后放回牌组最下方）那之后自身与其各回复2点音韵值』",
    "cardResolved": "小野葵",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "iori.diceChoice",
    "card": "小野伊织",
    "role": "captain",
    "mechanism": "diceChoice",
    "params": {
      "options": [
        2
      ],
      "label": "小野伊织被动·恩典：投掷结果可在其与 2 中选一项作为最终结果"
    },
    "status": "implemented",
    "note": "卡面：『每次投掷结果出现时可以在其和2中选一项作为最终结果』；另『一次性抽取两张卡的场合可以发动，抽一张并回复自身1点音韵值』见 iori.drawTwoBonus",
    "cardResolved": "小野伊织",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "iori.drawTwoBonus",
    "card": "小野伊织",
    "role": "captain",
    "mechanism": "drawTwoBonus",
    "params": {
      "draw": 1,
      "gainCost": 1,
      "label": "小野伊织被动·恩典：一次性抽两张卡时抽 1 张并回自身 1 音韵值"
    },
    "status": "implemented",
    "note": "卡面被动后半",
    "cardResolved": "小野伊织",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "kaedeMizugi.sanityFollow",
    "card": "枫(水着)",
    "role": "captain",
    "mechanism": "sanityFollowUp",
    "params": {
      "damage": 1,
      "kind": "理智",
      "moveMin": 1,
      "moveMax": 3,
      "label": "枫(水着)被动·少女的连续攻势"
    },
    "status": "implemented",
    "note": "卡面：『使用理智属性的卡造成伤害后追加1段1点理智属性伤害，那之后可以前进1-3格』（该段内容本就在内容层，此次重做只改了标题「自信少女的连续攻势」→「少女的连续攻势」）",
    "cardResolved": "枫(水着)",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "liuliShuizhuo.fervorFollowUp",
    "card": "琉璃(水着)",
    "role": "captain",
    "mechanism": "fervorFollowUp",
    "params": {
      "damage": 1,
      "kind": "热忱",
      "heal": 1,
      "drawAfterAttack": 1,
      "nextFervorPlus": 1,
      "oncePerTurn": true,
      "label": "琉璃(水着)被动·为君绽放的微笑"
    },
    "status": "implemented",
    "note": "卡面：『使用热忱属性的卡后可以适用效果，对一名其他玩家造成1点热忱属性伤害并回复自身1点同步值。使用攻击卡和技能卡之后立刻抽一张并让下次造成的热忱属性的最终伤害+1（这个效果一回合只能触发一次）』",
    "cardResolved": "琉璃(水着)",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "liuliWansheng.cheapCard",
    "card": "琉璃(万圣祭)",
    "role": "captain",
    "mechanism": "damageModifier",
    "params": {
      "when": "cheapCard",
      "add": 1,
      "maxCost": 3,
      "label": "琉璃(万圣祭)被动：费用≤3 的卡最终伤害 +1"
    },
    "status": "implemented",
    "note": "卡面：『琉璃使用费用小于等于3的卡造成的最终伤害+1』",
    "cardResolved": "琉璃(万圣祭)",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "liuliWansheng.counterPlus",
    "card": "琉璃(万圣祭)",
    "role": "captain",
    "mechanism": "damageModifier",
    "params": {
      "when": "counter",
      "add": 1,
      "onlyIfMaxCost": 3,
      "label": "琉璃(万圣祭)被动：费用≤3 的卡产生属性克制时那次克制伤害 +1"
    },
    "status": "implemented",
    "note": "卡面：『如果产生属性克制关系则那次属性克制伤害+1』（同属“费用≤3的卡”这一前提）",
    "cardResolved": "琉璃(万圣祭)",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "liuliWansheng.recycle",
    "card": "琉璃(万圣祭)",
    "role": "captain",
    "mechanism": "activatedAbility",
    "params": {
      "cost": {
        "sync": 3
      },
      "ops": [
        {
          "op": "recover_own_permanent"
        }
      ],
      "label": "琉璃(万圣祭)：支付 3 同步回收自己效果处理区的一张永续卡"
    },
    "status": "implemented",
    "note": "卡面：『此外，琉璃可以支付3点同步值来回收自己效果处理区的永续种类的卡』",
    "cardResolved": "琉璃(万圣祭)",
    "spMember": true,
    "groupSP": true
  },
  {
    "id": "songshanhui.musicSequence",
    "card": "松山惠",
    "role": "captain",
    "mechanism": "musicSequence",
    "params": {
      "label": "松山惠被动·音律感应：使用 3 张牌后按音韵值编排旋律执行乐曲",
      "special": [
        3,
        2,
        5
      ],
      "pieces": {
        "α": [
          {
            "op": "gain_cost",
            "amount": 4
          },
          {
            "op": "draw",
            "n": 1
          }
        ],
        "β": [
          {
            "op": "sacrifice_now",
            "costBack": 2
          }
        ],
        "γ": [
          {
            "op": "heal_sync",
            "amount": 6
          },
          {
            "op": "draw_gift",
            "n": 1
          }
        ],
        "δ": [
          {
            "op": "sacrifice_count_plus",
            "amount": 1
          },
          {
            "op": "damage",
            "base": 4,
            "kind": "理智"
          }
        ]
      }
    },
    "status": "implemented",
    "note": "卡面 SP 四条数值（重做后）：α 回复4音韵并抽1；β 执行一次献祭且那次献祭回复的音韵值+2；γ 回复6同步并抽1张[馈赠卡]；δ 本回合献祭次数+1，那之后对一名其他玩家造成4点理智伤害。判定：3 张牌的音韵值依次递增→α、依次递减→β、数字相同→δ、特殊[3,2,5]→γ；之后保留最后一张的音韵值并重新编排",
    "cardResolved": "松山惠",
    "spMember": false,
    "groupSP": false
  },
  {
    "id": "tomakoharu.todo",
    "card": "椎名小春",
    "role": "captain",
    "mechanism": "moveAccumulateGain",
    "params": {
      "every": 4,
      "gain": "先机",
      "cap": 6,
      "label": "小春被动·侦探直觉"
    },
    "status": "declared",
    "phase": "P4c",
    "note": "旧引擎同函数（10988-11000）：累计位移 4 格或经过玩家 → +1 先机（上限 6）；需要『先机』资源与经过判定，排 P4c",
    "cardResolved": "椎名小春",
    "spMember": false,
    "groupSP": false
  }
];

export const ABILITY_STATS = {
  "total": 13,
  "implemented": [
    "xuejie.regen",
    "shanyi.mask",
    "wutuobang.negate",
    "fengji.armband",
    "resonator.giftFilter",
    "coreProvider.opsOverride",
    "engraving.opsOverride",
    "yokai.opsOverride",
    "ruler.opsOverride",
    "craftsman.opsOverride",
    "blueGem.opsOverride",
    "blackCard.opsOverride"
  ],
  "declared": [
    {
      "id": "duishabao.script",
      "card": "小试身手！堆沙堡",
      "phase": "P4b"
    }
  ],
  "passivesTotal": 27,
  "passivesImplemented": [
    "toma.moveAccumulate",
    "sena.singleMoveDamage",
    "lilith.motivationBonus",
    "aoi.firstUseDiscount",
    "ning.addedByEffectDiscount",
    "iori.giftNoP500",
    "iori.shrineBonus",
    "kaedeMizugi.intellect",
    "yuMizugi.intellect",
    "rio.judge",
    "yu.judge",
    "yui.skillDamage",
    "hina.aggressionItem",
    "sakura.startStats",
    "yu.afterRollGainCost",
    "yu.prepareMajority",
    "aoi.initialHand",
    "aoi.gospel",
    "iori.diceChoice",
    "iori.drawTwoBonus",
    "kaedeMizugi.sanityFollow",
    "liuliShuizhuo.fervorFollowUp",
    "liuliWansheng.cheapCard",
    "liuliWansheng.counterPlus",
    "liuliWansheng.recycle",
    "songshanhui.musicSequence"
  ],
  "passivesDeclared": [
    {
      "id": "tomakoharu.todo",
      "card": "椎名小春",
      "phase": "P4c"
    }
  ],
  "unresolvedPassiveNames": [
    "（按唯一子串解析）sakura.startStats:樱→宫樱子"
  ]
};
