# better-sqlite3 在 GFW 环境下安装的坑

## 背景

部署服务器（Debian 12, Node 18.20.4）位于国内，所有到海外站点的连接被墙。better-sqlite3 是原生 C++ 模块，安装时需要编译 SQLite，这引发了一连串问题。

## 问题链

### 1. npm 官方 registry 不可达

`pnpm install` 默认从 `registry.npmjs.org` 下载元数据和包，该地址被墙，请求超时。

**解决**: 项目根目录放置 `.npmrc`，指向 npmmirror 镜像：

```
registry=https://registry.npmmirror.com
```

deploy.yml 中安装 pnpm 时也需指定 `--registry=https://registry.npmmirror.com`。

### 2. better-sqlite3 无预编译二进制

better-sqlite3 对 Node 18.20.4 没有提供 prebuilt binary，pnpm 会 fallback 到源码编译，触发 node-gyp。

### 3. node-gyp 下载 Node headers 被墙

node-gyp 编译时需要 Node.js 头文件，默认从 `nodejs.org` 下载。该地址被墙，下载失败。

**解决**: 设置环境变量 `npm_config_disturl=https://npmmirror.com/mirrors/node`，让 node-gyp 从国内镜像下载 headers。

该变量需在两个地方生效：
- **deploy.yml 的 install 步骤**: `export npm_config_disturl=...`
- **systemd service 文件**: `Environment=npm_config_disturl=...`

这是因为 systemd 服务启动时 `pnpm start:bot` 可能触发 rebuild，如果此时没有该变量又会失败。

### 4. pnpm approve-builds 默认阻止原生模块编译

pnpm v10 默认只允许在 `package.json` 中显式声明的原生模块执行构建脚本。未声明时 better-sqlite3 会被静默跳过，导致 `require('better-sqlite3')` 找不到 `.node` 文件。

**解决**: `package.json` 中添加：

```json
"pnpm": {
  "onlyBuiltDependencies": ["better-sqlite3"]
}
```

### 5. SSH 连接在长时间编译中断开

better-sqlite3 编译 SQLite 从源码约需 5 分钟，期间 SSH 无输出，远程主机关闭空闲连接。

**解决**: deploy.yml 中给 pnpm 安装命令加 `timeout 180` 防止无限卡死；必要时用 `nohup` 在后台执行安装，稍后再检查结果。

### 6. node-gyp ENOENT 假失败

编译实际成功（`.node` 二进制已生成），但 node-gyp 的 post-build 步骤尝试访问 `build/node_gyp_bins` 时抛出 `ENOENT`，导致 pnpm 报告安装失败。

**解决**: 确认二进制存在后，可用 `--ignore-scripts` 跳过重复构建。这是 node-gyp 已知 bug，不影响运行。

## 关键配置汇总

| 文件 | 配置项 | 作用 |
|------|--------|------|
| `.npmrc` | `registry=https://registry.npmmirror.com` | 包下载 |
| `package.json` | `pnpm.onlyBuiltDependencies` | 允许原生编译 |
| `deploy.yml` | `npm_config_disturl` env | CI 中编译 headers |
| `deploy/notinews-bot.service` | `Environment=npm_config_disturl=...` | 运行时 rebuild |

## 经验

1. **GFW 环境下原生模块是最大风险点**。优先找有 prebuilt binary 的替代方案，或者预编译后随仓库分发。
2. **node-gyp 的 headers 下载和包 registry 是两个独立通道**，都要配镜像。
3. **systemd 和 CI 环境变量是独立的**，deploy.yml 能构建成功不代表 systemd 启动时不会卡住 rebuild。
4. **node-gyp 的 ENOENT 假失败不要被误导**——检查 `.node` 文件是否真实存在比看 exit code 更可靠。
