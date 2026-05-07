# parseChineseRelative 正则导致 NaN Date 崩溃

## 现象

用户发送「5分钟后提醒我洗脸刷牙」，Bot 进程崩溃退出，无任何回复。

日志：
```
RangeError: Invalid time value
    at Date.toISOString (<anonymous>)
    at Module.createReminder (.../repository.ts:33:22)
```

## 根因

`parseChineseRelative` 函数中的正则表达式 `[提醒]?` 是字符类（character class），只匹配**单个**字符「提」或「醒」，而不是词组「提醒」。这引发连锁错误：

```
输入: "5分钟后提醒我洗脸刷牙"
正则: /(\d+)\s*分钟[之以]?后[提醒]?我?\s*(.+)/

匹配结果:
  match[1] = "5"           (数字)
  match[2] = "醒我洗脸刷牙"  (余下文本，因为 [提醒]? 只吃了"提"字)
```

随后分支判断 `pattern.source.includes('提醒')` 为 true（因为正则源码中的 `[提醒]` 字符类包含了「提醒」二字），走入错误分支：

```ts
// 该分支本用于 "提醒我XXX在N分钟后" 格式
const [numStr, txt] = [match[2], match[1]];
// numStr = "醒我洗脸刷牙", txt = "5"
ms = parseInt("醒我洗脸刷牙", 10) * 60 * 1000;  // → NaN
```

`NaN` 一路传播：

```
new Date(now.getTime() + NaN)  →  Invalid Date
triggerAt.toISOString()        →  RangeError (进程崩溃)
```

## 修复

1. **正则**: `[提醒]?` → `(?:提醒我?)?`，将「提醒我」作为整体可选非捕获组
2. **分支**: 放弃 `pattern.source.includes()` 字符串匹配，改为显式三路 pattern 匹配
3. **防御**: 在 `parseChineseRelative` 中 `isNaN` 检查（隐式，通过 `num > 0` 条件保证）

## 影响范围

所有包含「提醒」二字的相对时间自然语言输入均会触发崩溃。该 bug 是 `parseChineseRelative` 函数首次引入时自带的设计错误。

## 关键教训

- 正则字符类 `[abc]` 匹配单个字符，不是字符串。需要匹配多字符可选词组时用 `(?:word)?`
- 不要对正则源码字符串做 `includes()` 来判断语义 —— 源码中的元字符可能与目标字符串意外匹配
- 涉及 `Date` 的路径必须加 `isNaN` 守卫，否则 Invalid Date 会在 `.toISOString()` 处崩溃而非返回可捕获的错误
