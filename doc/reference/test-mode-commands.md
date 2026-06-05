# 测试直达模式命令

## 说明

测试直达模式用于本地或服务器上临时绕过时间判断，直接触发指定业务模式。

通用格式：

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=<mode> pnpm start
```

这些命令会真实发送 Telegram 消息。

## 全部模式

### 睡觉提醒

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=sleep pnpm start
```

### 起床提醒

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=wakeup pnpm start
```

### 服务器巡检

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start
```

### 游戏新闻

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=news pnpm start
```

### GitHub Trending

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=github pnpm start
```

### V2EX 热帖

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=v2ex pnpm start
```

### 健身私教

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=fitness pnpm start
```

### 维生素提醒

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=vitamin pnpm start
```

### 英语学习

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=english pnpm start
```

## 服务器上测试

进入服务器项目目录后执行同样命令：

```bash
cd /root/NotiNewsForXiaoming
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start
```

其他模式只需要替换 `TEST_FORCE_MODE`。
