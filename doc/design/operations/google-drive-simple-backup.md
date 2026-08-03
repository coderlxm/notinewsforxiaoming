# Google Drive 简单明文备份方案

状态：已实施

## 方案

当前线上使用 Google Drive 和 rclone 保存普通 `tar.gz` 恢复包，不增加额外加密层。

- Google Drive remote：`notinews-drive`
- 远端目录：`NotiNewsBackups`
- systemd timer：`notinews-backup.timer`
- 执行时间：每天北京时间 04:50
- 保留时间：30 天

rclone 官方支持 Google Drive，服务器使用 `drive.file` 权限，只能管理由当前 rclone 授权创建的文件。官方参考：[rclone Google Drive](https://rclone.org/drive/)。

## 备份内容

每份恢复包包含：

```text
/root/NotiNewsForXiaoming/.env
/root/NotiNewsForXiaoming/.deploy-commit
/root/NotiNewsForXiaoming/data/
/etc/systemd/system/notinews-bot.service
backup-manifest.txt
```

`backup-manifest.txt` 记录备份时间、Git commit、主机名和项目路径。

## 每日流程

```text
停止 notinews-bot.service
→ 打包完整恢复数据
→ 上传普通 tar.gz 到 Google Drive
→ 删除服务器临时文件
→ 删除超过 30 天的远端备份
→ 恢复 notinews-bot.service
```

systemd 的 `ExecStopPost` 负责在备份任务结束时恢复 bot。备份任务任一步骤失败时直接失败并记录到 journal，不重试、不上传到其他网盘。

## 恢复

1. 在新机器授权 rclone 访问同一个 Google Drive 账号。
2. 从 `NotiNewsBackups` 下载最新的 `tar.gz`。
3. 根据 manifest 拉取对应 Git commit。
4. 解压并恢复 `.env`、`.deploy-commit`、`data/` 和 systemd service。
5. 恢复文件权限并启动 bot。

备份包是明文压缩包。能够访问该 Google Drive 目录的人可以读取其中的 `.env`、API token 和数据库内容，这是当前明确接受的简化取舍。

## 115

115 不接入自动流程。服务器只保留 Google Drive 一条备份主路径，不增加第二上传通道或失败 fallback。
