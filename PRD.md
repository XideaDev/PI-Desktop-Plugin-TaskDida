# 产品需求文档 (PRD)：PI-Desktop TASK Dida任务提示音插件 (SoundAlert)

> **版本**：v1.0.0  
> **状态**：已批准 / 开发中  
> **类型**：PI-Desktop 官方市场扩展插件 (Extension Plugin)  
> **插件 ID**：`io.github.xideadev.task-dida`  
> **中文名称**：TASK Dida任务提示音  
> **英文名称**：Task Sound Alert  

---

## 1. 背景与核心价值 (Background & Value Proposition)

### 1.1 痛点与背景
在 PI-Desktop 的实际开发工作流中，AI Agent 处理中大型任务（如多文件重构、复杂 Bug 排查、自动化测试、子智能体协同执行）往往需要数十秒乃至数分钟。在此期间：
- **场景痛点 1（上下文割裂）**：开发者通常会切换至浏览器、IDE 或即时通讯软件进行其他工作，不得不频繁切回 PI-Desktop 查看进度，造成心智负担。
- **场景痛点 2（无感知静默）**：虽然 PI-Desktop 原生提供系统通知（Notification），但桌面弹窗极易被其他窗口遮挡或被 macOS/Windows 专注模式静默折叠。
- **场景痛点 3（原生提示音覆盖缺失）**：宿主仅在 `ask`、`permission` 等极少数阻塞弹窗时播放高频蜂鸣，常规的 `task.completed`（任务完成）与 `turn.failed`（执行失败）目前**缺乏明确、悦耳的声音反馈**。

### 1.2 产品目标
打造一款**轻量、跨平台、低延迟、零侵入**的声音提醒插件，深度跟随 PI-Desktop 系统通知与任务状态流转，实现“任务完成即刻听见”，并严格符合 **PI-Desktop 官方插件市场合规标准**，顺利完成上架与分发。

---

## 2. 用户画像与典型用例 (User Personas & Use Cases)

| 用户角色 | 典型行为模式 | 核心诉求 |
| :--- | :--- | :--- |
| **重度全栈开发者** | 启动复杂全功能实现后切去查文档或喝咖啡 | Agent 搞定后一声清脆的“叮”，立刻返回验收代码 |
| **多任务并行用户** | 开启 Subagents（explorer、test-runner）后台跑测试 | 只听最终主任务结果，不希望被密集子任务连环“爆音”轰炸 |
| **沉浸专注型极客** | 保持窗口前台全屏盯执行过程 | 正在看着屏幕时不需要响铃（前台智能静音），后台失焦时才发声 |
| **开放式办公白领** | 在办公室或图书馆公共环境工作 | 支持一键静音、音量微调、自定义更柔和的提示音 |

---

## 3. 功能需求详细说明 (Functional Requirements)

### 3.1 事件监听与触发规则 (Event Triggering)
插件需与 PI-Desktop 原生生命周期及 `notifications` 系统深度对齐：

| 事件类型 | 触发条件 | 默认音效 | 说明 |
| :--- | :--- | :--- | :--- |
| **`task.completed` (核心)** | 当前会话 Turn/Task 执行成功（status = 'completed'） | 清脆叮咚 (`Glass` / `Complete`) | 核心场景：任务顺利完成 |
| **`task.failed` / `turn.error`** | 执行中抛出致命异常、工具报错中断、Token 耗尽 | 低沉警示 (`Basso` / `Error`) | 及时提醒开发者处理报错 |
| **`interaction.required`** | 智能体进入 `AskTool` 等待回答，或 `SubmitPlan` 拟定完成待批准 | 提示敲击 (`Tink` / `Notify`) | 提示需要人工介入审批 |
| **`subagent.done` (可选)** | 子智能体（explorer、fixer）完成阶段工作 | 轻量微音 (`Pop` / 静音) | 默认静音，避免多 Agent 嘈杂 |

### 3.2 智能播放控制策略 (Smart Playback & Anti-Fatigue)
1. **并发防抖与节流 (Debounce & Cooldown)**：
   - 设定默认 **2.0 秒全局冷却时间**。若多个子任务或通知在短时间内密集涌出，仅播放首次提示音，防止音效重叠撕裂（爆音）。
2. **窗口前后台智能感知 (Focus Awareness)**：
   - 提供选项 `onlyWhenBlurred`（仅当窗口处于后台/失去焦点时响铃）。
   - 用户正聚焦 PI-Desktop 视窗并看着文本滚动时，可配置为静音，减少听觉冗余。
3. **免打扰模式 (DND / Mute Window)**：
   - 支持全局快捷静音开关；
   - 支持自定义免打扰时段（例如 22:00 - 08:00 自动静音）。

### 3.3 音效定制与管理 (Sound Themes & Customization)
1. **内置跨平台预设方案**：
   - **Modern Minimal**（现代极简）：清脆、短促、科技感（推荐默认）；
   - **System Classic**（系统经典）：调用 macOS 原生 `Glass.aiff` / Windows `chimes.wav`；
   - **Retro Terminal**（复古终端）：柔和合成波、8-bit 确认声。
2. **自定义音效上传/指定**：
   - 允许用户在设置中指定本地音频路径（支持 `.mp3`、`.wav`、`.ogg`、`.aiff`）。
3. **音量与试听 (Volume & Audition)**：
   - 0% - 100% 独立音量滑块调节；
   - 每个音效配置项旁提供“▶ 试听（Test Play）”按钮。

### 3.4 用户界面 (UI / Settings Panel)
集成于 PI-Desktop **设置 → 扩展 / 插件配置** 及可选的侧栏/面板：
- **总开关**：一键启用 / 禁用提示音。
- **音量控制**：滑动条（0% ~ 100%）。
- **事件开关矩阵**：勾选 [任务成功]、[任务失败]、[等待审批/询问]、[子任务完成]。
- **仅后台生效**：复选框开关。
- **声音主题选择下拉菜单** + 试听按钮。

---

## 4. 技术架构与实现方案 (Technical Architecture)

### 4.1 事件捕获机制（无侵入、高可用）
采用 **双模轻量监听体系**：
1. **主通道：SQLite WAL 本地事件监视**
   - 宿主 Rust 内核在任务状态更替时，原子写入 `~/.pi-desktop/pi.sqlite` 的 `turns` 与 `notifications` 表。
   - 插件通过 Node.js 原生 `fs.watch` 监听 SQLite WAL 变化，配合轻量只读查询，在 100ms 内捕获 `status = 'completed'` / `kind = 'task.completed'` 事件，对系统资源零损耗。
2. **辅助通道：`contributes.agentExtensions` 生命周期钩子**
   - 在 `manifest.json` 中声明智能体扩展点，辅助校准当前正在执行的 `sessionId` 与 `turnId`，精准过滤历史过期数据。

### 4.2 跨平台音频驱动实现 (Zero-Dependency Audio Driver)
无需下载沉重的 npm 第三方 C++ 音频库，直接基于系统底层原生工具调用与 Webview 兜底：
- **macOS**：通过 `child_process.spawn('afplay', [soundPath, '-v', volume])`，延迟 < 50ms。
- **Windows**：调用原生 PowerShell 异步播放：
  ```powershell
  powershell -c "(New-Object Media.SoundPlayer 'path\\to\\sound.wav').PlaySync()"
  ```
- **Linux**：优先探测 `paplay` (PulseAudio)，兜底调用 `aplay` (ALSA) 或 `canberra-gtk-play`。

---

## 5. 官方插件市场合规与发布规范 (Marketplace Submission)

为了保证顺利上架官方插件市场（`plugins.aiuo.net` / `vastsa/PI-Desktop`），严格遵循以下门禁：

1. **规范 Manifest**：合法的 ID 命名、完善的中英文 i18n、明确的 `safetyNotes`（说明 `desktop.control` 用于播放声音，绝无网络外联）。
2. **存储模式打包**：使用 Store-only (无压缩) 归档为 `.piplug` 文件。
3. **体积限制与依赖约束**：包体精简，无冗余 node_modules 打包，音频无版权问题。
4. **开源合规**：包含标准 MIT License、双语 README、更新日志 CHANGELOG。
