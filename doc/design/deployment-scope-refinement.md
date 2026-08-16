# 部署范围细化方案

## 问题

当前部署工作流只要发现根目录 `package.json` 发生变化，就会把 Journal、Bot 和“撸了吗”都加入部署范围。这个判断安全但过于粗糙：本次只是增加本地使用的 `dev:lu` 脚本，却连带触发了 Journal 和 Bot。

最新一次运行也证明，触发判断针对的是整次 push 包含的提交范围，而不是只看最后一个提交。虽然最后一个提交只修改了“撸了吗”的界面文件，但同一批推送中包含了根目录 `package.json` 的修改。

## 建议方案

产品目录继续按文件路径判断，根目录 `package.json` 则改为按实际内容判断影响范围。

1. 从三个产品的 `dorny/paths-filter` 规则中移除 `package.json`。
2. 在现有 `changes` job 中增加一个根清单范围判断步骤。
3. 分别读取 `github.event.before` 和 `github.sha` 对应的 `package.json`，使用 `jq -S` 规范化相关字段后比较。
4. 将根清单判断结果与现有路径判断结果合并，再输出各产品最终是否部署。

这样可以继续使用当前单一工作流，不需要拆分仓库或引入另一套部署系统。

## 根清单变更分类

| 根清单变更 | Journal | Bot | 撸了吗 |
| --- | --- | --- | --- |
| `scripts.*:journal` | 部署 | 不部署 | 不部署 |
| `scripts.*:bot` 及现有未带后缀的 Bot 启动脚本 | 不部署 | 部署 | 不部署 |
| `scripts.*:lu` | 不部署 | 不部署 | 不部署 |
| 根目录 `dependencies` 或 `devDependencies` | 部署 | 部署 | 不部署 |
| `engines` | 部署 | 部署 | 不部署 |
| `packageManager` 或 pnpm 全局解析设置 | 部署 | 部署 | 部署 |
| 其他纯元数据字段 | 不部署 | 不部署 | 不部署 |

“撸了吗”的运行依赖归属于 `apps/lu-dashboard/package.json`，继续由现有的 `apps/lu-dashboard/**` 路径规则处理。根目录的 `dev:lu` 只是本地快捷入口，不属于任何生产镜像，因此单独修改它时不应触发部署。

## 多提交推送的判断

比较基准必须使用 `github.event.before`，不能使用 `HEAD^`。一次 push 可能包含多个提交，本次情况正是如此。`changes` job 的 checkout 需要具备读取推送前提交的历史深度，最直接的实现是在这个很小的 job 中获取完整历史。

手动运行 `workflow_dispatch` 时，继续沿用现有的三个显式布尔选项，不进入自动范围判断。

## 为什么不能直接忽略根清单

Journal 和 Bot 目前仍然从根目录清单安装依赖。如果直接把 `package.json` 从它们的触发范围中删除，又不检查内容，就会漏掉真实的依赖或运行环境变更。按内容分类既能消除误部署，也能保留必要部署。

## 本次推送采用该方案后的结果

- “撸了吗”：部署，因为 `apps/lu-dashboard/**` 有变化。
- Journal：跳过，因为根清单只增加了 `scripts.dev:lu`。
- Bot：同样跳过。

