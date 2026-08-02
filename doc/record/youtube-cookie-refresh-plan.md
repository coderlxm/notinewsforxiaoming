# YouTube 登录 Cookie 刷新方案

## 目标

让服务端使用一份不容易因为普通 Chrome 标签页活动而被 YouTube 轮换的登录 Cookie，并在替换后确认它确实能用于需要登录的视频。

当前代码已经会把以下文件传给服务端 yt-dlp：

```text
/root/.config/yt-dlp/youtube-cookies.txt
```

因此，后续刷新 Cookie 不需要修改代码、重新提交或重新部署；只需要安全替换服务器上的这个文件。

## 推荐的刷新流程

### 一、准备专用的无痕会话

1. 在本机 Chrome 新建一个无痕窗口。
2. 只在这个无痕窗口中登录拥有目标视频访问权限的 YouTube 账号。
3. 登录后，在同一个无痕标签页访问：

   ```text
   https://www.youtube.com/robots.txt
   ```

4. 在这个无痕会话仍然存在时导出 Cookie。导出工具必须明确读取这次无痕会话，不要回到普通 Chrome 配置中提取。
5. 优先只导出 `youtube.com` 域名 Cookie，生成 Netscape 格式文件；不要把普通浏览器的全部网站 Cookie 放进服务器。
6. 导出完成后关闭这个无痕窗口，使这份会话不再继续被浏览器使用。

这套流程依据 yt-dlp 当前的 YouTube Cookie 说明：普通打开的 YouTube 标签页可能触发账号 Cookie 轮换，而无痕会话访问 `robots.txt` 后再导出，可以减少这种情况。[官方说明](https://github.com/yt-dlp/yt-dlp/wiki/Extractors)

### 二、替换服务器文件

将新的 Cookie 文件上传到服务器并覆盖：

```text
/root/.config/yt-dlp/youtube-cookies.txt
```

替换后保持以下安全条件：

- 所有者为 `root`；
- 权限为 `600`；
- 不写入 Git、`.env`、日志或 Telegram 消息；
- 本机导出文件和临时副本在上传后清理。

这一步不需要重启 `notinews-bot.service`，因为每个新下载任务启动 yt-dlp 时都会重新读取这个路径。

### 三、做一次登录态对照确认

准备一个当前账号确实有权限、但未登录无法访问的视频，例如年龄限制、会员或账号专属视频。只解析格式，不下载内容：

1. 使用新 Cookie 解析一次，应该成功获得视频信息或格式列表。
2. 对同一个 URL 使用完全相同的服务器、yt-dlp 版本和参数，但不传 Cookie 再解析一次，应该失败或无法取得同样的信息。
3. 只有“带 Cookie 成功、不带 Cookie 失败”时，才把这次刷新标记为成功。

普通公开视频带不带 Cookie 获得相同清晰度，不能作为登录态证明；清晰度差异也只能作为辅助证据，因为 YouTube 的 client、地区、PO Token 和反爬策略都可能改变格式列表。[yt-dlp 格式说明](https://github.com/yt-dlp/yt-dlp/wiki/Extractors)

## 什么时候需要刷新

当前项目没有单独的 Cookie 健康检查任务，也不应该依靠普通公开视频成功来判断 Cookie 仍然有效。以下情况出现时，按本方案重新导出：

- Telegram 下载失败消息出现 `Sign in to confirm your age`；
- 出现 `Sign in to confirm you're not a bot`；
- 以前可以访问的年龄限制、会员或账号专属视频再次失败；
- 服务器上的 Cookie 与当前浏览器指纹出现明显差异。

Cookie 文件中的时间字段只能说明某些 Cookie 尚未超过本地记录的过期时间，不能证明 YouTube 服务器仍接受这次账号会话。

## 操作边界

这是一项服务器凭据维护操作，不属于代码发布：更新 Cookie 时不 commit、不 push、不触发 GitHub Actions。只有代码本身变化时，才沿用项目既有的 `main` 发布流程。

如果需要执行刷新，只要提出“按无痕窗口方案更新 YouTube Cookie”，就按本文件的顺序操作。

## 本次刷新执行结论（2026-08-02）

本次刷新按照无痕窗口方案完成。Chrome 无痕会话导出的 `Downloads/cookies.txt` 经筛选后只保留了 YouTube 域名条目，共 39 条；服务器文件已经替换为这份新 Cookie：

```text
/root/.config/yt-dlp/youtube-cookies.txt
```

服务器文件最终状态为 root 所有、权限 `600`。本次没有修改代码、提交代码或重新部署，也不需要重启 bot。

替换前，用旧 Cookie 解析年龄限制视频 `8xWch6lS6bo` 时，带 Cookie 和不带 Cookie 都返回：

```text
Sign in to confirm your age
```

替换后，在相同服务器、相同 yt-dlp 和相同解析参数下，仅列出格式、不下载视频的请求成功，最高可用清晰度为 `1920×1080`。这组前后对照说明，本次新 Cookie 已经被 YouTube 接受，并且确实解决了该年龄限制视频的登录访问问题。

本次还对比了普通 Chrome Cookie 与服务器旧文件：两者并非同一份快照，服务器保存的是较早状态。这进一步支持了“普通 Chrome 标签页活动导致 Cookie 轮换”的判断。

本次刷新后没有固定的保证有效期。后续仍采用事件驱动的维护方式：普通公开视频不作为健康信号；当登录限制视频出现登录、年龄或反爬错误时，再按本方案重新导出。无痕窗口完成导出后应关闭；本机 `Downloads/cookies.txt` 是敏感凭据，确认不再需要后应删除，且不得提交到 Git。
