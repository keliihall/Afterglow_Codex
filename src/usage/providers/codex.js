const { listJsonlFiles, readLinesMatching, expandHome } = require("../file-utils");

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIsoFromEpochSeconds(value) {
  const seconds = asNumber(value);
  if (seconds === null) return null;
  return new Date(seconds * 1000).toISOString();
}

function windowFromLimit(id, label, limit) {
  if (!limit) {
    return {
      id,
      label,
      status: "missing",
      remainingPercent: null,
      usedPercent: null
    };
  }

  const usedPercent = asNumber(limit.used_percent);
  const remainingPercent = usedPercent === null ? null : Math.max(0, 100 - usedPercent);
  return {
    id,
    label,
    status: "ok",
    sourceType: "direct",
    usedPercent,
    remainingPercent,
    windowMinutes: asNumber(limit.window_minutes),
    resetsAt: toIsoFromEpochSeconds(limit.resets_at)
  };
}

function extractCodexEvent(entry) {
  if (entry?.type !== "event_msg") return null;
  if (entry?.payload?.type !== "token_count") return null;
  const rateLimits = entry.rate_limits || entry.payload.rate_limits;
  if (!rateLimits) return null;

  const timestamp = Date.parse(entry.timestamp);
  return {
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    isoTimestamp: entry.timestamp,
    rateLimits,
    tokenInfo: entry.payload.info || null
  };
}

async function getCodexUsage(config) {
  if (config.enabled === false) {
    return {
      id: "codex",
      label: "Codex",
      status: "disabled",
      statusText: "已关闭",
      windows: []
    };
  }

  const files = listJsonlFiles(config.sessionDir, { maxAgeDays: config.maxAgeDays }).slice(0, config.maxFiles || 80);
  let latest = null;

  for (const file of files) {
    readLinesMatching(file.path, "\"rate_limits\"", (entry) => {
      const event = extractCodexEvent(entry);
      if (!event) return;
      if (!latest || event.timestamp > latest.timestamp) {
        latest = { ...event, file: file.path };
      }
    });
  }

  if (!latest) {
    return {
      id: "codex",
      label: "Codex",
      status: "missing",
      statusText: "未找到 Codex rate_limits",
      source: expandHome(config.sessionDir),
      scannedFiles: files.length,
      windows: [
        { id: "5h", label: "5h", status: "missing" },
        { id: "1w", label: "1w", status: "missing" }
      ]
    };
  }

  const primary = latest.rateLimits.primary;
  const secondary = latest.rateLimits.secondary;
  const lastUsage = latest.tokenInfo?.last_token_usage || null;

  return {
    id: "codex",
    label: "Codex",
    status: "ok",
    statusText: latest.rateLimits.rate_limit_reached_type ? "已触限" : "正常",
    sourceType: "direct",
    source: latest.file,
    planType: latest.rateLimits.plan_type || null,
    updatedAt: latest.isoTimestamp,
    scannedFiles: files.length,
    lastUsage,
    windows: [
      windowFromLimit("5h", "5h", primary),
      windowFromLimit("1w", "1w", secondary)
    ]
  };
}

module.exports = {
  getCodexUsage
};
