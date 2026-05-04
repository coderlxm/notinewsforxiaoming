# 健身私教进阶方案：记忆、恢复与氛围 (V3.6)

## 1. 核心目标
通过引入**状态持久化**，使健身教练具备“记忆力”，实现循序渐进的强度提升和科学的肌群轮换，并配合 BGM 增强训练沉浸感。

## 2. 状态持久化方案 (Fitness Status Storage)
为了解决脚本“即跑即走”导致的失忆问题，在本地引入 `data/fitness_status.json` 文件。

### 2.1 数据结构定义
```json
{
  "user_profile": {
    "height": 172,
    "weight": 68
  },
  "training_state": {
    "current_level": 1, 
    "total_completed": 0,
    "last_workout_date": "2026-05-01",
    "last_focus_area": "上肢力量 + 腹部核心"
  }
}
```

## 3. 功能模块详解

### 3.1 阶梯式强度 (Progressive Overload)
*   **计算逻辑**：
    - 每完成一次训练，`total_completed` +1。
    - 每满 3 次有效训练（即完成一周周期），`current_level` 自动 +1。
*   **AI 联动**：
    - 将 `current_level` 传入 DeepSeek。
    - **Prompt 策略**：告知 AI “当前用户等级为 Level X（1-100），请根据等级线性调整动作难度、组数及间歇时间。”

### 3.2 肌肉疲劳度感知 (Muscle Recovery)
*   **逻辑设计**：
    - 在生成新计划前，读取 `last_focus_area`。
    - **避震机制**：如果上次是“下肢”，本次强制要求 AI 侧重“上肢”或“核心”。
*   **AI 联动**：
    - **Prompt 策略**：增加约束“用户上次训练了【${last_focus_area}】，本次请务必避开该肌群，确保肌肉得到充分恢复。”

### 3.3 伴随式 BGM 推送 (Workout Soundtrack)
*   **氛围匹配逻辑**：
    - **周一 (爆发力)**：匹配 **Phonk / Industrial Rock**（高频、重节拍）。
    - **周三 (耐力)**：匹配 **Deep House / Progressive Trance**（线性、节奏感强）。
    - **周六 (大循环)**：匹配 **Hardstyle / Eurodance**（极度亢奋、燃脂氛围）。
*   **输出展示**：
    - 在 Telegram 消息底部增加 `🎵 教练推荐 BGM 风格` 板块，并提供对应的搜索关键字或预设的网易云/Spotify 链接。

## 4. 技术实施步骤 (Implementation)
1.  **文件初始化**：在 `data/` 目录下创建状态文件。
2.  **Service 层升级**：新建 `src/services/fitness.ts` 专门负责状态的读写逻辑。
3.  **AI 接口升级**：修改 `generateFitnessPlanWithAI` 函数，接收 `FitnessStatus` 对象作为参数。
4.  **自动迭代逻辑**：在消息成功发送给 Telegram 后，程序自动更新并保存最新的 `fitness_status.json`。

## 5. 预期效果
小明每天收到的不再是“千篇一律”的课表，而是一个**“知道你上次练了什么、知道你现在多厉害、甚至知道你现在想听什么”**的贴身管家。
