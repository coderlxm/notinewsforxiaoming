# 第一阶段实施报告（服务器定时执行）

## 执行范围

已严格执行 `SERVER_DEPLOY_PLAN.md` 第一阶段，第二阶段未执行。

## 执行结果

1. 服务器连接与环境检查完成（`ssh bwgdc01`）  
   - 用户：`root`  
   - systemd：`252` 可用  
   - `sudo` 不存在（但 root 直连可直接配置系统级服务）

2. 服务器目录创建完成  
   - `/root/NotiNewsForXiaoming`

3. 代码同步完成（包含 `.env`）  
   - 由于本机执行环境缺少 `rsync`，改为 `tar + ssh` 等价同步  
   - 同步后已清理 `._*` macOS 元数据文件

4. 运行环境安装完成  
   - Node.js：`v18.20.4`  
   - pnpm：`10.33.2`（`/usr/local/bin/pnpm`）

5. 依赖安装完成  
   - 服务器项目目录 `pnpm install` 成功

6. `.env` 校验完成  
   - `TG_TOKEN` / `TG_CHAT_ID` / `QWEATHER_API_KEY` / `QWEATHER_CITY_ID` / `DEEPSEEK_API_KEY` 均存在

7. 手动运行验证完成  
   - 初次运行出现 Telegram IPv6 连接超时  
   - 增加 `NODE_OPTIONS=--dns-result-order=ipv4first` 后，`pnpm start` 成功推送

8. systemd service/timer 创建并启用完成  
   - `/etc/systemd/system/notinews.service`
   - `/etc/systemd/system/notinews.timer`
   - `notinews.timer` 状态：`active (waiting)`  
   - 下次触发：`Wed 2026-04-29 09:55:00 PDT`

9. systemd 手动触发验证完成  
   - `systemctl start notinews.service` 成功  
   - 日志显示 `Successfully sent message to Telegram.` 且退出码 `0`

10. GitHub Actions 定时触发已移除（本地改动）  
    - 文件：`.github/workflows/daily-push.yml`  
    - 已删除 `on.schedule`，仅保留 `workflow_dispatch`

## 本阶段偏差说明

1. 方案中的 `rsync` 未执行：本机环境缺少 `rsync`，已用等价同步流程替代。  
2. 方案中的 `sudo` 未使用：远端为 root 直连，直接写入 `/etc/systemd/system`。  
3. 服务器系统时区为 `PDT`，未改动系统时区；timer 使用 `Timezone=Asia/Shanghai` 满足方案要求。

## 验收要点

1. `ssh bwgdc01 'systemctl list-timers notinews.timer --no-pager'`  
2. `ssh bwgdc01 'systemctl status notinews.timer --no-pager -l'`  
3. `ssh bwgdc01 'journalctl -u notinews.service -n 80 --no-pager'`

