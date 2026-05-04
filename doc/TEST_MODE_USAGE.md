# 本地测试直达模式用法

## 目标

在本地 `pnpm start` 时，临时绕过时间段判定，直接触发指定功能，快速验证新增功能效果。

## 开关设计

- `TEST_MODE_ENABLED`
  - `1`：开启测试直达模式（绕过时段）
  - 其他值或不设置：关闭（走正常调度逻辑）

- `TEST_FORCE_MODE`
  - 指定要直达的模式
  - 可选值：
    - `sleep`
    - `wakeup`
    - `server_health`
    - `news`
    - `github`
    - `v2ex`
    - `fitness`
    - `vitamin`
    - `english`

## 使用示例

### 1) 立即测试健身私教

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=fitness pnpm start
```

### 2) 立即测试 V2EX 总结

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=v2ex pnpm start
```

### 3) 立即测试早安提醒

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=wakeup pnpm start
```

### 4) 立即测试维生素提醒

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=vitamin pnpm start
```

### 5) 立即测试服务器巡检

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start
```

## 关闭测试模式

直接正常执行即可（不带环境变量）：

```bash
pnpm start
```

## 说明

- 该开关默认关闭，不会影响线上定时行为。
- 若 `TEST_MODE_ENABLED=1` 但 `TEST_FORCE_MODE` 不合法，程序会直接报错并退出，避免误测。
