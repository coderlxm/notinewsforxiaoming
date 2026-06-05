# 标准部署指南

适用于国内服务器（GFW 环境），Node.js + pnpm + systemd 常驻进程 + GitHub Actions 自动部署。

## 1. 服务器环境

- Debian 12+, root 用户
- Node.js 18+、pnpm 10+

```bash
# 安装 pnpm（使用国内镜像）
npm install -g pnpm@10 --registry=https://registry.npmmirror.com
```

## 2. 项目配置

### 2.1 .npmrc（包 registry 镜像）

```
registry=https://registry.npmmirror.com
```

### 2.2 package.json（允许原生模块编译）

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3"]
  }
}
```

### 2.3 package.json scripts

```json
{
  "scripts": {
    "start:bot": "node --require tsx/cjs src/resident.ts"
  }
}
```

## 3. systemd 服务

### 3.1 服务文件 `deploy/myapp.service`

```ini
[Unit]
Description=MyApp Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/myapp
EnvironmentFile=/root/myapp/.env
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--dns-result-order=ipv4first
Environment=npm_config_disturl=https://npmmirror.com/mirrors/node
ExecStart=/usr/local/bin/pnpm start:bot
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

要点：
- `npm_config_disturl` 指向 Node headers 镜像，原生模块编译需要
- `NODE_OPTIONS=--dns-result-order=ipv4first` 避免 IPv6 解析问题
- `Restart=on-failure` 确保崩溃自动重启

### 3.2 .env（敏感配置不入库）

```
TG_TOKEN=xxx
TG_CHAT_ID=xxx
WEATHER_API_KEY=xxx
DEEPSEEK_API_KEY=xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

## 4. GitHub Actions 自动部署

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-main
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SERVER_SSH_KEY }}

      - name: Add known_hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -p ${{ secrets.SERVER_PORT }} -H ${{ secrets.SERVER_HOST }} >> ~/.ssh/known_hosts

      - name: Sync files
        run: |
          ssh ... "cd /root/myapp && find . -mindepth 1 -maxdepth 1 ! -name '.env' ! -name '.npmrc' ! -name 'data' -exec rm -rf {} +"
          git archive --format=tar HEAD | ssh ... "tar -xf - -C /root/myapp"

      - name: Install dependencies
        run: |
          ssh ... "
            export npm_config_disturl=https://npmmirror.com/mirrors/node
            cd /root/myapp && pnpm install --frozen-lockfile
          "

      - name: Setup service
        run: |
          ssh ... "
            cp /root/myapp/deploy/myapp.service /etc/systemd/system/myapp.service
            systemctl daemon-reload
            systemctl enable myapp.service
            systemctl restart myapp.service
          "
```

要点：
- `find ... -exec rm` 清理旧文件但保留 `.env`、`.npmrc`、`data/`
- `git archive` 比 rsync 更干净，不会带上 git 元数据
- `concurrency` 防止重复部署冲突

## 5. 服务器初始化 check list

- [ ] Node.js 已安装
- [ ] pnpm 已安装（通过国内镜像）
- [ ] 项目目录已创建 `mkdir -p /root/myapp`
- [ ] `.env` 已手动上传到服务器
- [ ] `.npmrc` 已提交到仓库
- [ ] systemd service 文件已编写并放入 `deploy/`
- [ ] GitHub Secrets 已配置：`SERVER_HOST`、`SERVER_PORT`、`SERVER_USER`、`SERVER_PROJECT_DIR`、`SERVER_SSH_KEY`
- [ ] `data/` 目录已在 `.gitignore` 中（含 `.sqlite-*` WAL 文件）

## 6. 常用运维命令

```bash
systemctl status myapp.service -l     # 查看服务状态
journalctl -u myapp.service -f        # 实时日志
journalctl -u myapp.service -n 50     # 最近 50 行日志
systemctl restart myapp.service       # 重启服务
```
