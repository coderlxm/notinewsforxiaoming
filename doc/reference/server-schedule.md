# 服务器触发规则（Source of Truth）

最后更新：2026-05-03（Asia/Shanghai）

## 1. 线上实际调度（systemd timer）

线上机器的真实触发规则以 `/etc/systemd/system/notinews.timer` 为准：

```ini
OnCalendar=*-*-* 08:30:00 Asia/Shanghai
OnCalendar=*-*-* 09:10:00 Asia/Shanghai
OnCalendar=*-*-* 09:55:00 Asia/Shanghai
OnCalendar=*-*-* 10:30:00 Asia/Shanghai
OnCalendar=*-*-* 12:30:00 Asia/Shanghai
OnCalendar=Sat *-*-* 14:00:00 Asia/Shanghai
OnCalendar=*-*-* 15:00:00 Asia/Shanghai
OnCalendar=*-*-* 16:00:00 Asia/Shanghai
OnCalendar=*-*-* 18:30:00 Asia/Shanghai
OnCalendar=*-*-* 20:00:00 Asia/Shanghai
OnCalendar=Mon,Wed *-*-* 20:30:00 Asia/Shanghai
OnCalendar=*-*-* 21:00:00 Asia/Shanghai
OnCalendar=*-*-* 00:10:00 Asia/Shanghai
```

说明：
- 除 `Sat 14:00` 与 `Mon,Wed 20:30` 外，其余时点每天触发。

## 2. 时点对应业务模式（代码）

代码入口：`src/index.ts`，固定时点映射如下：

- `00:10` -> `Midnight Sleep Reminder`
- `08:30` -> `Morning Wake-up`
- `09:10` -> `Server Health Check`
- `09:55` -> `Morning News`
- `12:30` -> `Vitamin Reminder`
- `14:00`（仅周六）-> `Fitness Coach`
- `15:00` -> `Afternoon Github Trending`
- `18:30` -> `Vitamin Reminder`
- `20:00` -> `Evening V2EX Hot Topics`
- `20:30`（仅周一、周三）-> `Fitness Coach`
- 其他触发时点（如 `10:30` / `16:00` / `21:00`）-> `Daily English Teacher`

补充（非工作日 wake-up 展示规则）：
- 非工作日触发 `Morning Wake-up` 时，隐藏所有“出门相关提示”文案（含雨天带伞、阴天可能有雨）。

## 3. 部署通知里的“下次模式”映射

workflow：`.github/workflows/deploy.yml`

`Notify deploy success to Telegram` 步骤会读取 `notinews.timer` 的下一次触发时间，并按时间点映射模式；该映射必须和本文件第 2 节保持一致。

## 4. 运维核对命令

```bash
ssh bwgdc01 'systemctl cat notinews.timer --no-pager'
ssh bwgdc01 'systemctl list-timers notinews.timer --no-pager'
ssh bwgdc01 'journalctl -u notinews.service -n 80 --no-pager'
```

## 5. 修改规则后的标准动作

1. 编辑 `/etc/systemd/system/notinews.timer`
2. 执行：
   ```bash
   ssh bwgdc01 'systemctl daemon-reload && systemctl restart notinews.timer'
   ```
3. 更新本文件和 `.github/workflows/deploy.yml` 的模式映射，避免“线上规则”和“仓库文档”漂移。
