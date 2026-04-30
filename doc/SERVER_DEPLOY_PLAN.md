# 服务器部署实施方案

## 目标

把当前项目的定时新闻推送从 GitHub Actions 迁移到你自己的服务器执行，避免 GitHub Actions `schedule` 延迟数小时的问题。

最终目标：

- 服务器按北京时间准点执行 `pnpm start`
- 项目部署在服务器目录 `~/NotiNewsForXiaoming`
- 本机 `.env` 同步到服务器
- 使用服务器自己的定时器作为主调度
- 部署成功后，移除 GitHub Actions 的定时触发，只保留手动触发或后续部署用途
- 预留后续提交代码后的自动部署方案

## 已确认信息

```text
SSH 连接命令: ssh bwgdc01
服务器项目目录: ~/NotiNewsForXiaoming
是否同步本机 .env 到服务器: 是
是否允许使用 sudo 配置 systemd: 是
如果服务器缺少 Node.js/pnpm，是否允许安装: 是
偏好的定时方式: 由我选择，稳定即可
服务器时区策略: 不修改服务器时区；如果不是 Asia/Shanghai，则保持当前时区
GitHub Actions 定时触发策略: 服务器部署成功后移除
```

## 总体方案

分两个阶段执行。

第一阶段：先把服务器定时执行跑稳。

- 使用 `systemd timer` 作为主定时器。
- 使用 `systemd service` 执行一次 `pnpm start`。
- 同步当前项目代码和本机 `.env` 到服务器。
- 手动执行一次验证 Telegram 推送。
- 启用定时器并确认下一次触发时间。
- 成功后修改 GitHub Actions workflow，移除 `schedule`，只保留 `workflow_dispatch`。

第二阶段：补充后续代码提交后的自动部署。

- 定时任务不依赖 GitHub Actions。
- 代码部署可以选择依赖 GitHub Actions 的 `push` 事件，或者完全由服务器主动拉取。
- 推荐先完成第一阶段，再做第二阶段，避免同时改动调度和部署链路导致问题难排查。

## 第一阶段：服务器定时执行

### 1. 连接服务器并检查环境

使用：

```bash
ssh bwgdc01
```

检查内容：

```bash
uname -a
whoami
pwd
date
command -v node
node -v
command -v pnpm
pnpm -v
command -v systemctl
systemctl --version
sudo -n true
```

判断结果：

- 如果 Node.js 已存在且版本可用，直接使用。
- 如果 pnpm 已存在，直接使用。
- 如果 Node.js 或 pnpm 缺失，允许安装。
- 如果 systemd 可用且 sudo 可用，使用系统级 `systemd timer`。
- 如果 systemd 不可用，再退回 cron。

### 2. 创建服务器项目目录

目标目录：

```bash
~/NotiNewsForXiaoming
```

执行前会确认远端目录是否已存在：

```bash
ssh bwgdc01 'test -d ~/NotiNewsForXiaoming && echo exists || echo missing'
```

如果目录不存在则创建：

```bash
ssh bwgdc01 'mkdir -p ~/NotiNewsForXiaoming'
```

如果目录已存在，会先查看里面内容，不会直接覆盖未知文件。

### 3. 同步项目文件

从本机当前项目同步到服务器：

```bash
rsync -az --delete \
  --exclude node_modules \
  --exclude .git \
  ./ bwgdc01:~/NotiNewsForXiaoming/
```

说明：

- 同步源码、`package.json`、`pnpm-lock.yaml`、`.env`、`.env.example`、配置文件。
- 不同步 `node_modules`，依赖在服务器上重新安装。
- 不同步 `.git`，第一阶段先按“本机同步部署”处理，减少远端复杂度。
- 使用 `--delete` 前会先做一次 dry run，确认不会删除不该删的文件。

预检查命令：

```bash
rsync -azn --delete \
  --exclude node_modules \
  --exclude .git \
  ./ bwgdc01:~/NotiNewsForXiaoming/
```

### 4. 安装依赖

在服务器项目目录执行：

```bash
cd ~/NotiNewsForXiaoming
pnpm install
```

如果服务器没有 pnpm：

```bash
corepack enable
corepack prepare pnpm@10.33.2 --activate
```

如果服务器没有 Node.js，会根据服务器系统选择合适安装方式。优先使用系统包管理器或现有 Node 版本管理工具，避免手工散装二进制。

### 5. 验证环境变量

因为你确认同步本机 `.env` 到服务器，部署后检查服务器文件存在性和权限：

```bash
ls -l ~/NotiNewsForXiaoming/.env
```

`.env` 需要包含：

```env
TG_TOKEN=
TG_CHAT_ID=
QWEATHER_API_KEY=
QWEATHER_CITY_ID=
DEEPSEEK_API_KEY=
```

不在终端输出密钥内容，只确认字段是否存在。

### 6. 手动执行一次

先在服务器上手动运行：

```bash
cd ~/NotiNewsForXiaoming
pnpm start
```

成功标准：

- 命令退出码为 0
- Telegram 收到推送
- 日志没有缺少环境变量、API 鉴权、网络请求失败等错误

只有手动执行成功后，再启用定时器。

### 7. 创建 systemd service

计划创建：

```text
/etc/systemd/system/notinews.service
```

模板：

```ini
[Unit]
Description=NotiNews daily push
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=REMOTE_USER
WorkingDirectory=/home/REMOTE_USER/NotiNewsForXiaoming
EnvironmentFile=/home/REMOTE_USER/NotiNewsForXiaoming/.env
ExecStart=PNPM_PATH start
```

部署时替换：

- `REMOTE_USER`：服务器实际用户名
- `PNPM_PATH`：服务器上 `command -v pnpm` 的结果
- `WorkingDirectory`：服务器实际项目绝对路径
- `EnvironmentFile`：服务器实际 `.env` 绝对路径

### 8. 创建 systemd timer

计划创建：

```text
/etc/systemd/system/notinews.timer
```

优先使用 `Timezone=Asia/Shanghai`，这样无需修改服务器系统时区：

```ini
[Unit]
Description=Run NotiNews on schedule

[Timer]
OnCalendar=Mon..Fri *-*-* 08:30:00
OnCalendar=*-*-* 09:55:00
OnCalendar=*-*-* 15:00:00
OnCalendar=*-*-* 00:10:00
Persistent=true
Timezone=Asia/Shanghai
Unit=notinews.service

[Install]
WantedBy=timers.target
```

如果服务器上的 systemd 版本不支持 `Timezone=`：

- 不修改服务器时区。
- 读取服务器当前时区。
- 把北京时间换算成服务器当前时区后写入 `OnCalendar`。

### 9. 启用并验证 timer

执行：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now notinews.timer
systemctl list-timers notinews.timer
systemctl status notinews.timer
```

手动触发 service 验证：

```bash
sudo systemctl start notinews.service
systemctl status notinews.service
journalctl -u notinews.service -n 100 --no-pager
```

成功标准：

- `notinews.timer` 是 active
- `list-timers` 能看到下一次执行时间
- `notinews.service` 手动执行成功
- Telegram 收到推送

### 10. 移除 GitHub Actions 定时触发

服务器定时器验证成功后，修改：

```text
.github/workflows/daily-push.yml
```

移除：

```yaml
schedule:
  - cron: ...
```

保留：

```yaml
on:
  workflow_dispatch:
```

这样 GitHub Actions 不再自动定时推送，避免和服务器重复发送。

## 第二阶段：后续提交代码后的自动部署方案

这个阶段用于解决：以后你修改代码并提交后，服务器上的项目如何自动更新。

### 方案 A：GitHub Actions 只负责部署，不负责定时

推荐程度：高。

做法：

- GitHub Actions 不再使用 `schedule`。
- 新增一个 `deploy.yml`，只在 `push` 到 `main` 时触发。
- GitHub Actions 通过 SSH 登录服务器。
- 在服务器项目目录执行代码更新、安装依赖、手动跑一次轻量检查。
- 服务器上的 `systemd timer` 继续负责准点运行。

优点：

- 定时任务不依赖 GitHub Actions，因此不受 schedule 延迟影响。
- 每次 push 后服务器自动更新。
- 部署日志可以在 GitHub Actions 和服务器上同时查看。

缺点：

- 需要在 GitHub 仓库配置部署用 SSH secret。
- GitHub Actions 仍参与“部署”，但不参与“准点调度”。

需要新增的 GitHub Secrets：

```text
SERVER_HOST
SERVER_USER
SERVER_SSH_KEY
SERVER_PORT
```

可选：

```text
SERVER_PROJECT_DIR
```

部署命令大致为：

```bash
cd ~/NotiNewsForXiaoming
git pull --ff-only
pnpm install --frozen-lockfile
```

注意：如果第一阶段用 `rsync` 部署且没有 `.git`，第二阶段切换到这个方案时，需要把服务器目录改成 `git clone` 方式，或者让 GitHub Actions 继续用 `rsync/scp` 上传代码。

### 方案 B：服务器主动拉取代码

推荐程度：中。

做法：

- 服务器项目目录保留为一个 Git 仓库。
- 服务器上创建一个额外的 `systemd timer` 或 cron。
- 每隔几分钟执行一次：

```bash
git fetch origin main
git reset --hard origin/main
pnpm install --frozen-lockfile
```

优点：

- 不需要 GitHub Actions 部署 workflow。
- GitHub 不负责执行任何任务，只作为代码仓库。

缺点：

- 不是 push 后立即部署，取决于轮询间隔。
- `git reset --hard` 是破坏性操作，必须确保服务器目录没有手动修改。
- 如果部署失败，需要在服务器日志里排查。

### 方案 C：继续手动同步

推荐程度：低，但最简单。

做法：

- 每次本机改完代码后，用 `rsync` 手动同步到服务器。
- 同步后在服务器运行：

```bash
pnpm install
sudo systemctl start notinews.service
```

优点：

- 简单。
- 不需要新增 GitHub Secrets。

缺点：

- 容易忘记同步。
- 不是真正自动部署。

### 自动部署推荐结论

建议路线：

1. 先完成第一阶段，确认服务器准点执行稳定。
2. 然后采用方案 A：GitHub Actions 只做 `push` 后部署，不再做 `schedule` 定时。
3. 保留服务器 `systemd timer` 作为唯一自动定时推送来源。

这样职责清晰：

- GitHub Actions：代码变更后部署
- 服务器 systemd timer：按时执行推送
- `workflow_dispatch`：人工备用入口

## 回滚方案

如果服务器部署后出现问题：

1. 停止服务器定时器：

   ```bash
   sudo systemctl disable --now notinews.timer
   ```

2. 保留或恢复 GitHub Actions 的 `workflow_dispatch` 手动触发。
3. 如果需要临时恢复 GitHub Actions 定时触发，再把 `schedule` 配置加回 `.github/workflows/daily-push.yml`。

## 风险点

- 服务器网络如果无法访问 Telegram、和风天气、DeepSeek，会导致脚本失败。
- 如果 `.env` 同步失败或字段缺失，脚本会失败。
- 如果服务器时区不是 Asia/Shanghai 且 systemd 不支持 `Timezone=`，需要做时间换算。
- 如果 GitHub Actions 定时触发没有移除，可能和服务器定时器重复推送。
- 后续自动部署如果使用 `git reset --hard`，服务器目录不能有手动改动。

## 待执行前确认

执行前需要你最后确认：

```text
确认可以连接: ssh bwgdc01
确认部署目录: ~/NotiNewsForXiaoming
确认同步本机 .env: 是
确认允许 sudo 配置 systemd: 是
确认允许安装 Node.js/pnpm: 是
确认部署成功后移除 GitHub Actions schedule: 是
确认第一阶段先做服务器定时，第二阶段再做自动部署: 是
```
