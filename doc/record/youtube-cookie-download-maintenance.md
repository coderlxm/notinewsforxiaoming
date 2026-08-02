# YouTube Cookie 下载维护记录

## 事情是怎样开始的

故事开始于一次对视频下载功能的追问：服务端在调用 YouTube 下载器时，究竟有没有带上登录态。

我们沿着 `src/services/videoDownloadRunner.ts` 往下看，发现服务端只是把视频 URL 交给 `/usr/local/bin/yt-dlp`，参数中没有 `--cookies`，也没有 `--cookies-from-browser`。服务端环境变量和常见的 yt-dlp 配置位置里也没有 Cookie 配置。因此，当视频只有登录后才能访问时，原来的下载路径并没有可用的 YouTube 登录态。

## 我们选择的办法

为了保持个人工具的主路径短而清楚，我们没有在服务器上安装浏览器，也没有把 Cookie 放进代码仓库或 `.env`。做法是：从已经登录 YouTube 的 Chrome 中导出 Netscape 格式 Cookie，只保留 YouTube 和 Google 域名的条目，放到服务端受限目录，再让 yt-dlp 显式读取这个文件。

服务端现在使用的文件路径是：

```text
/root/.config/yt-dlp/youtube-cookies.txt
```

该文件只允许 root 读取，权限为 `600`。Cookie 本身没有写入本项目，也没有出现在 Git 提交、日志或 Telegram 消息中。yt-dlp 的 Cookie 导出和读取方式见其[官方 FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ)。

## 代码留下了什么

`src/services/videoDownloadRunner.ts` 增加了可选的 `cookiesFile` 参数；当调用方提供路径时，下载参数中会加入：

```text
--cookies /root/.config/yt-dlp/youtube-cookies.txt
```

`src/videoDownloadJob.ts` 只在服务端本地下载路径配置这个 Cookie 文件。Bilibili 仍然沿用原来的 Mac worker 路径，没有把这份 YouTube Cookie 传给它。

## 这次发布发生了什么

代码以以下提交发布：

```text
09dcdcd feat: add YouTube cookies to video downloads
```

提交已经 push 到 `main`，GitHub Actions 的 `Deploy To Servers` workflow 成功完成；服务端代码同步、依赖安装、媒体工具安装和 `notinews-bot.service` 重启均已完成。之后通过 `/download <YouTube URL>` 进入的服务端下载任务会读取上述 Cookie 文件。

## Cookie 过期时，故事应该怎样继续

Cookie 过期后，不需要重新修改代码、重新提交或重新部署。只需要：

1. 确认本机 Chrome 仍登录着有权限访问目标视频的 YouTube 账号。
2. 使用 yt-dlp 的 `--cookies-from-browser chrome` 重新导出 Cookie，并以单个公开视频 URL 作为导出时的输入，避免把 YouTube 首页当成推荐播放列表展开。
3. 过滤出 YouTube 和 Google 域名的条目。
4. 用新文件覆盖服务端的 `/root/.config/yt-dlp/youtube-cookies.txt`，保持 root-only 的 `600` 权限。

替换完成后，下一次下载任务启动时就会读取新文件，不需要重启 bot。

如果不想手工重复这套过程，只要提出“更新 YouTube Cookie”，就按本记录重新从当前 Chrome 导出、过滤并上传；这类更新不应进入 Git，也不应触发代码部署。

## 仍然需要记住的边界

这份 Cookie 只代表导出账号本身已经拥有的访问权限，不能替代会员资格、绕过 DRM，也不能保证所有受保护的视频都能下载。Cookie 会因过期、退出登录、修改密码或 YouTube 会话变化而失效，需要重新导出。

本记录只描述当前项目的服务端 YouTube 下载路径；Mac worker 的 Bilibili 下载路径不使用这份 Cookie。
