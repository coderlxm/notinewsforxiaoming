# 服务器部署速记

## 连接
```bash
ssh bwgdc01
```

## 项目路径
`~/NotiNewsForXiaoming`

## 关键文件位置
- service: `/etc/systemd/system/notinews.service`
- timer: `/etc/systemd/system/notinews.timer`

## systemd 常用命令

```bash
# 查看 timer 状态和下次触发时间
systemctl list-timers notinews.timer

# 查看最近日志
journalctl -u notinews.service -n 100 --no-pager

# 手动执行一次
sudo systemctl start notinews.service

# 停止定时器
sudo systemctl disable --now notinews.timer

# 修改 service/timer 后重载
sudo systemctl daemon-reload
```

## 部署方式

**定时推送**：服务器 `systemd timer` 独立执行，不依赖 GitHub Actions。

**代码更新**（手动）：
```bash
rsync -az --delete --exclude node_modules --exclude .git ./ bwgdc01:~/NotiNewsForXiaoming/
# 然后在服务器上:
cd ~/NotiNewsForXiaoming && pnpm install
```

## GitHub Actions
- `daily-push.yml`：已移除 `schedule`，仅保留 `workflow_dispatch` 手动触发。
