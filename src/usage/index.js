const { loadConfig, CONFIG_FILE } = require("./config");
const { getCodexUsage } = require("./providers/codex");

async function settleProvider(id, promise) {
  try {
    return await promise;
  } catch (error) {
    return {
      id,
      label: "Codex",
      status: "error",
      statusText: "读取失败",
      error: error.message,
      windows: []
    };
  }
}

async function loadUsageSnapshot() {
  const config = loadConfig();
  const codex = await settleProvider("codex", getCodexUsage(config.providers.codex || {}));

  return {
    generatedAt: new Date().toISOString(),
    refreshSeconds: config.refreshSeconds,
    configPath: CONFIG_FILE,
    configError: config.configError || null,
    providers: [codex]
  };
}

module.exports = {
  loadUsageSnapshot
};
