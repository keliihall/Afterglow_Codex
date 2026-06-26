const metersEl = document.getElementById("meters");
function formatPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value)}%`;
}

function formatResetTime(iso) {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  const msUntilReset = date.getTime() - Date.now();
  if (msUntilReset >= 24 * 60 * 60 * 1000) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getWindow(provider, id) {
  return provider?.windows?.find((window) => window.id === id) || null;
}

function levelClass(percent) {
  if (!Number.isFinite(percent)) return "danger";
  if (percent <= 15) return "danger";
  if (percent <= 35) return "warn";
  return "";
}

function renderMeter(label, window) {
  const remaining = Number.isFinite(window?.remainingPercent)
    ? Math.max(0, Math.min(100, window.remainingPercent))
    : 0;
  const level = levelClass(remaining);
  return `
    <div class="meter">
      <span class="label">${label}</span>
      <span class="bar"><span class="fill ${level}" style="--value:${remaining}"></span></span>
      <span class="value">${formatPercent(window?.remainingPercent)}</span>
      <span class="reset"><span>↻</span><span>${formatResetTime(window?.resetsAt)}</span></span>
    </div>`;
}

function renderSnapshot(snapshot) {
  const codex = snapshot.providers.find((provider) => provider.id === "codex");
  const fiveHour = getWindow(codex, "5h");
  const weekly = getWindow(codex, "1w");

  metersEl.innerHTML = `${renderMeter("5h", fiveHour)}${renderMeter("1w", weekly)}`;
}

async function refresh() {
  const snapshot = await window.usageWidget.getUsage();
  renderSnapshot(snapshot);
}

window.usageWidget.onSnapshot(renderSnapshot);
refresh();
