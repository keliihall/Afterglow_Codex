const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CONFIG_DIR = path.join(os.homedir(), ".ai-usage-widget");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG = {
  refreshSeconds: 20,
  providers: {
    codex: {
      enabled: true,
      sessionDir: "~/.codex/sessions",
      maxFiles: 80,
      maxAgeDays: 8
    }
  }
};

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(base, override) {
  const result = { ...base };
  if (!isPlainObject(override)) return result;

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = mergeDeep(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function ensureConfigFile() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
  }
}

function loadConfig() {
  ensureConfigFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return mergeDeep(DEFAULT_CONFIG, parsed);
  } catch (error) {
    return {
      ...DEFAULT_CONFIG,
      configError: `配置读取失败: ${error.message}`
    };
  }
}

function saveConfig(nextConfig) {
  ensureConfigFile();
  const merged = mergeDeep(DEFAULT_CONFIG, nextConfig);
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig
};
