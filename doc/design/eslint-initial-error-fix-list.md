# ESLint 初始错误修复清单

## 背景

当前项目使用宽松的 ESLint 基线：`eslint:recommended` 与 `typescript-eslint` 的 `recommended`。首次扫描发现 8 个错误；本清单只记录最小修复动作，不改变既有业务流程。

## 修复顺序

先处理语法错误，再处理外部 API 类型，最后完成无副作用的清理项。

| 序号 | 文件 | 位置 | 错误 | 最小修复动作 |
| --- | --- | --- | --- | --- |
| 1 | `src/index.ts` | 88-96 行 | `Parsing error: '}' expected` | 为 V2EX 调度的 `else if` 分支补回结束花括号。健身调度整段仍保持注释，不恢复该功能。 |
| 2 | `src/fetchers/github.ts` | 27 行 | `@typescript-eslint/no-explicit-any` | 为 GitHub Search API 响应定义仅含 `items`、`full_name`、`html_url`、`description` 的最小类型，并以 Axios 泛型传入；移除 `map` 回调参数的 `any`。 |
| 3 | `src/fetchers/v2ex.ts` | 18 行 | `@typescript-eslint/no-explicit-any` | 为 V2EX 热门主题响应定义最小主题类型，并以 Axios 泛型传入；保留当前字段映射与空数组返回逻辑。 |
| 4 | `src/reminders/formatter.ts` | 3 行 | `@typescript-eslint/no-unused-vars` | 删除未使用的 `describeRecurrence` 导入。 |
| 5 | `src/reminders/parser.ts`、`src/bot/interactive.ts` | 61、614 行 | `@typescript-eslint/no-unused-vars` | 从 `parseRecurringCommand` 移除未使用的 `now` 参数，并同步移除唯一调用处传入的第二个参数。 |
| 6 | `src/services/startgg/tracker.ts` | 559 行 | `no-useless-assignment` | 移除 `eventState` 从 `eventRow.event_state` 取得的初始赋值，仅保留变量声明；后续在使用前已有来自阶段元数据或阶段跟踪数据的赋值。 |
| 7 | `src/test_v2ex.ts` | 30 行 | `@typescript-eslint/no-explicit-any` | 将捕获异常改为 `unknown`，使用 Axios 的错误类型守卫后再读取 `response`，保持现有诊断输出语义。 |
| 8 | `test_rss.ts` | 14 行 | `@typescript-eslint/no-unused-vars` | 将 `catch (e)` 改为不绑定异常变量的 `catch`，保留失败时输出 RSS 地址与 `FAILED` 的行为。 |

## 不在本次清单内

- 不启用类型感知或风格强制 ESLint 规则。
- 不接入提交钩子或修改现有提醒、抓取与推送业务逻辑。
