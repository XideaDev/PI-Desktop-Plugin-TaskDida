# TASK Dida任务提示音 (Task Sound Alert for PI-Desktop)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PI-Desktop Plugin](https://img.shields.io/badge/PI--Desktop-Plugin-6366f1.svg)](https://github.com/vastsa/PI-Desktop)

A lightweight, zero-dependency sound alert plugin designed specifically for **PI-Desktop**. Plays pleasant, customizable sound notifications when AI agent tasks finish, error out, or require attention.

专为 **PI-Desktop** 打造的轻量级、零依赖任务完成声音通知插件。在 AI 智能体任务完成、发生异常中断或需要人工操作时，自动跟随系统通知播放清脆悦耳的提示音。

---

## 核心特性

- **任务完成提示音 (Task Completion Sound)**: AI 顺利跑完代码或执行完回合时提供即时声音反馈（`task.completed`）。
- **错误警示音 (Error Alert)**: 任务执行遇到异常中断或报错时播放低沉警示音。
- **系统提示接管 (Override Host Beep)**: 可选择接管并替换系统自带单调的 660Hz 蜂鸣声，带来更悦耳的交互反馈。
- **提示音在线试听 (Sound Audition)**: 内置可视化设置面板，支持一键在线试听各场景音效。
- **防爆音节流 (Audio Throttling)**: 内建 2.0 秒全局冷却时间，防止多个子任务或通知密集并发导致声音撕裂。
- **后台智能感知 (Focus Awareness)**: 可配置为仅当 PI-Desktop 窗口在后台失焦时才发声，减少前台盯屏时的听觉冗余。
- **纯本地无外联 (Privacy First)**: 零外部网络请求，绝不接触任何 API 密钥、凭据或用户个人代码。

---

## 安装方式

### 方式一：从官方插件市场一键安装 (推荐)
1. 打开 PI-Desktop 客户端；
2. 进入 **设置 (Settings)** → **插件 (Plugins)** → **插件市场 (Marketplace)**；
3. 搜索 `TASK Dida任务提示音` 或 `Task Sound Alert`；
4. 点击 **安装 (Install)** 并授权声音播放权限即可。

### 方式二：从本地 `.piplug` 文件安装
1. 前往 GitHub [Releases](https://github.com/XideaDev/PI-Desktop-Plugin-TaskDida/releases) 下载最新的 `io.github.xideadev.task-dida-1.0.0.piplug`；
2. 在 PI-Desktop 中进入 **设置 → 插件**；
3. 点击右上角的 **“从文件安装 (Install from file)”**，选择下载的 `.piplug` 文件完成导入。

---

## 配置与试听面板

安装后，可通过以下方式打开专属可视化设置与试听面板：
- 按下快捷键 `Cmd + Shift + P`（Windows 为 `Ctrl + Shift + P`），搜索命令 **“TASK Dida任务提示音: 打开设置面板”**；
- 在面板中可调节提示音量、开关各项通知，并支持针对各场景点击 **“试听音效”**。

---

## 开发者构建

```bash
# 1. 克隆仓库
git clone https://github.com/XideaDev/PI-Desktop-Plugin-TaskDida.git
cd PI-Desktop-Plugin-TaskDida

# 2. 安装开发依赖
npm install

# 3. 编译 TypeScript
npm run build

# 4. 规范校验
PluginCheck

# 5. 打包 .piplug (Store-only ZIP 规范)
PluginPack
```

---

## License

[MIT License](LICENSE) © 2025 XideaDev
