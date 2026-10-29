# 官方插件市场 (Marketplace) 提审指南与材料清单

本项目完全遵循 PI-Desktop 官方插件规范。待本仓库推送到 GitHub 并创建 Release 后，即可向上架官方目录提交收录申请。

---

## 一、提审材料清单 (Submission Assets)

| 材料项 | 内容 / 规范要求 | 本项目具体参数 |
| :--- | :--- | :--- |
| **插件 ID** | 符合 `^[a-zA-Z0-9][a-zA-Z0-9._-]*$` 反向域名 | `io.github.xideadev.task-dida` |
| **版本号 (SemVer)** | 标准 SemVer 规范 | `1.0.3` (Git Tag: `v1.0.3`) |
| **开源仓库** | 公开 GitHub 仓库 | `https://github.com/XideaDev/PI-Desktop-Plugin-TaskDida` |
| **开源协议** | 开放开源协议 | `MIT` |
| **安装包名称** | `<id>-<version>.piplug` | `io.github.xideadev.task-dida-1.0.3.piplug` |
| **文件大小** | < 50MB (Store-only 仅存储 ZIP) | `839,654 字节` (~820 KB) |
| **SHA-256 散列值** | 用于市场 CDN 完整性校验 | `05e78cf38806b56c868c4a5e9d04c034bb4a5bd7199557409ebd08876d73d725` |

---

## 二、官方市场提审步骤 (Release & PR Walkthrough)

### 第一步：GitHub 仓库推送与创建 Release
1. **提交代码并推送到 GitHub 远程仓库**：
   ```bash
   git init
   git remote add origin https://github.com/XideaDev/PI-Desktop-Plugin-TaskDida.git
   git add .
   git commit -m "chore: release v1.0.0 of sound-alert plugin"
   git branch -M main
   git push -u origin main
   ```
2. **打 Tag 并发布 GitHub Release**：
   - Tag 名称：`v1.0.3`
   - Release 标题：`v1.0.3: 任务提示音 (高并发智能分级节流版)`
   - **重要附件**：在 Release Assets 中上传打包好的安装包：  
     `dist/io.github.xideadev.task-dida-1.0.3.piplug`

---

### 第二步：向官方仓库提交收录 PR
1. 访问 PI-Desktop 官方仓库：[vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop)；
2. Fork 官方仓库并克隆到本地，定位到插件目录文件 `plugins/catalog.json`；
3. 在 `catalog.json` 的 `plugins` 列表中追加以下完整收录元数据：

```json
{
  "id": "io.github.xideadev.task-dida",
  "name": "任务提示音",
  "version": "1.0.3",
  "description": "在 AI 智能体完成任务回合、发生报错或等待操作时播放清脆悦耳的系统提示音，支持试听与自定义替换。",
  "author": "XideaDev",
  "license": "MIT",
  "homepage": "https://github.com/XideaDev/PI-Desktop-Plugin-TaskDida",
  "sourceRepository": "https://github.com/XideaDev/PI-Desktop-Plugin-TaskDida",
  "sourceRef": "v1.0.3",
  "categories": [
    "productivity"
  ],
  "shasum": "05e78cf38806b56c868c4a5e9d04c034bb4a5bd7199557409ebd08876d73d725",
  "i18n": {
    "en": {
      "name": "TASK Dida",
      "description": "Play pleasant native sound alerts when AI finishes tasks, errors, or requires attention. Supports audition and sound customization."
    },
    "zh-CN": {
      "name": "任务提示音",
      "description": "在 AI 智能体完成任务回合、发生报错或等待操作时播放清脆悦耳的系统提示音，支持试听与自定义替换。"
    }
  }
}
```

4. 提交 Pull Request，标题格式：`feat(plugins): update io.github.xideadev.task-dida to v1.0.3`。

---

## 三、市场合规与安全自审清单 (Security & Compliance Checklist)

- [x] **Store-only ZIP 归档**：使用 `PluginPack` 工具打包，未启用 Deflate 压缩（符合安装器规范）。
- [x] **无外部网络外联**：代码不包含任何 `fetch` / `http` / `https` / `WebSocket` 外联，100% 离线运行。
- [x] **防命令注入**：所有系统命令（`afplay` / `powershell` / `aplay` / `sqlite3`）均使用数组参数调用，严格限制用户指定音频文件为合法音频后缀，绝无任意命令执行漏洞。
- [x] **最小权限原则**：仅声明 `desktop.control` 与 `ui.panel`，且在 `safetyNotes` 中详细阐明用途。
- [x] **双语国际化完整**：`en` 与 `zh-CN` 的 `name`、`description` 与 `safetyNotes` 均完整齐备。
- [x] **无临时垃圾文件**：已配置标准 `.gitignore`，排除 `node_modules/`、`dist/`、`.pi/` 等无关文件。
