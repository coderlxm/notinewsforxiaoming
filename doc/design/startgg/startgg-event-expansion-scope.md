# start.gg 项目兴趣门控方案

## 问题定义

2026-07-26，系统通过固定关注选手 Punk 的近期 Set 自动发现了：

`TNS Marvel Tokon Beta Tournament #3 / Marvel Tokon`

当前选手近期 Set 发现链路不限制游戏。event 激活后又应用了 Top 16 种子关注，最终把“关注 Punk”扩大成“关注 Punk 参加的所有游戏及这些游戏的赛事级战果”。

从用户意图看，根因不是种子链路是否只对手动 event 生效，而是系统缺少“用户是否关心这个游戏项目”的判断。用户当前关心 Street Fighter 6 和 Fatal Fury: City of the Wolves，但并不关心 Marvel Tokon。

## 推荐方案：行为学习的项目兴趣门控

系统不要求用户预先维护游戏白名单，而是从明确的赛事操作中学习项目兴趣。

### 已关注项目

以下行为视为用户对 event 所属 videogame 的正向意图：

- 用户通过 `👊 比赛了` 主动启动该项目的赛事。
- 用户在赛事候选中明确选择该项目。
- 用户在“发现新项目”卡片中选择“以后关注这个项目”。

系统从 start.gg 的 `videogame.id` 和 `videogame.name` 记录项目身份，不使用赛事名称或 slug 猜测。

一个项目获得正向意图后，固定关注选手参加该项目的新赛事可以继续自动激活，并使用现有固定选手、种子选手和最终阶段推送能力。

### 陌生项目

固定关注选手出现在尚无正向意图的 videogame 时：

1. event 进入待确认状态，不进入 active watch。
2. 不发送该 event 的选手战果、种子战果或最终阶段消息。
3. 只发送一次可编辑的发现卡片：

```text
🎮 发现关注选手参加新项目
Punk 正在参加 Marvel Tokon
赛事：TNS Marvel Tokon Beta Tournament #3

[关注这个项目] [仅关注本届] [忽略这个项目]
```

选择结果：

- `关注这个项目`：记住 videogame，激活本届赛事；以后同项目自动识别。
- `仅关注本届`：只激活当前 event，不改变长期项目兴趣。
- `忽略这个项目`：记住该 videogame 不感兴趣，以后不再询问或激活。

Telegram 交互优先编辑或删除这张卡片，不额外产生配置消息。

### 初始兴趣迁移

首次上线不要求用户重新配置。系统可以从已有的明确操作记录建立初始兴趣：

- 历史 `subscription_source = 'manual'` 的 event。
- 当前由用户通过 `比赛了` 主动启动的 event。

不能把 `auto` event 用作正向证据，否则本次 Marvel Tokon 会反向污染兴趣画像。

如果现有历史数据不能可靠区分某个项目是否来自用户主动操作，则保持未知，等待一次确认，不猜测用户兴趣。

## 为什么这不是手工白名单

静态白名单要求用户预先列出并持续维护允许的游戏，新增感兴趣项目时还要修改配置。

兴趣门控以实际操作为依据：

- 用户正常使用 `比赛了` 时自然学习。
- 未知项目只询问一次。
- 支持“仅本届”，不强迫把一次兴趣变成长期规则。
- 支持记住忽略，避免同一陌生项目反复打扰。

底层仍然需要保存确定的选择，但用户不需要维护一份技术配置清单。

## 数据与发现链路调整

### 补齐 videogame 身份

当前 `PLAYER_RECENT_SETS_QUERY` 没有读取 event 的 videogame。需要增加：

```graphql
event {
  videogame {
    id
    name
  }
}
```

发现结果和 watch event 同步保存 `videogame_id`、`videogame_name`，所有兴趣判断只使用稳定 ID。

### 兴趣状态

单用户场景只需要一份短而直接的项目兴趣记录：

- `videogame_id`
- `videogame_name`
- `preference`: `follow` 或 `ignore`
- `updated_at`

“仅本届”继续由 event 自身的订阅来源表达，不写长期兴趣。

### 主路径

```text
固定选手近期 Set 发现 event
  -> 读取 event.videogame.id
  -> 已关注：直接激活 event
  -> 已忽略：不激活、不询问
  -> 未知：保存待确认 event，只发送一次确认卡片
```

event 只有在通过兴趣门控后才可以建立种子名单或进入两分钟 Fast Watch，因此不会先推送再补判断。

## 本次事件应用结果

采用该方案后，Punk 的 Marvel Tokon event 会被识别为陌生项目：

- 不会自动激活。
- 不会产生 Punk 战果推送。
- 不会扩展 Top 16 种子选手。
- 最多出现一次项目确认卡片。
- 用户点击忽略后，同项目以后不再打扰。

Street Fighter 6 和 Fatal Fury: City of the Wolves 在用户主动选择一次后会成为已关注项目，后续赛事仍保持自动化体验。

