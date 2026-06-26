# 余晖

英文代号：Afterglow。

macOS 常驻小组件，用来显示 Codex 的 5h / 1w 剩余用量。

## 数据来源

- Codex：读取 `~/.codex/sessions/**/*.jsonl` 里的 `rate_limits`。如果本机 Codex 写入了 `primary.window_minutes = 300` 和 `secondary.window_minutes = 10080`，界面会直接显示 5h / 1w 剩余百分比。
- Claude：已移除。Claude 本地日志只有 token usage，没有像 Codex `rate_limits` 这样的官方 5h / 1w 剩余百分比字段；继续显示会变成不可靠估算。

## 运行

```bash
npm install
npm start
```

菜单栏会出现“余晖”图标；小窗可拖动，默认置顶，并可在菜单里刷新、隐藏、切换开机启动。

## 快速检查采集结果

```bash
npm run usage:once
```

## 配置

首次运行会创建：

```text
~/.ai-usage-widget/config.json
```

常用字段：

```json
{
  "refreshSeconds": 20,
  "providers": {
    "codex": {
      "sessionDir": "~/.codex/sessions",
      "maxFiles": 80,
      "maxAgeDays": 8
    }
  }
}
```

Codex 的百分比来自本地 Codex 写入的 rate limit 记录。

## 打包 mac 应用

```bash
npm run pack:mac
```

生成的 `.app/.zip` 在 `dist/` 目录。需要 DMG 时运行：

```bash
npm run dist:mac
```
