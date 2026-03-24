function $(id) {
  return document.getElementById(id);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatUptime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const rem = s % 86400;
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  const ss = rem % 60;
  return `${d}d ${pad2(h)}:${pad2(m)}:${pad2(ss)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const headers = ["id", "severity", "tool", "source", "description", "status", "lastSeen"];
  const out = [headers.map(esc).join(",")];
  for (const r of rows) out.push(headers.map((h) => esc(r[h])).join(","));
  return out.join("\n");
}

const state = {
  paused: false,
  startUptimeSeconds: 47 * 86400 + 3 * 3600 + 12 * 60 + 8,
  nodesUp: 15,
  nodesTotal: 16,
  signatures: 847_291,
  shield: { level: "MAXIMUM", active: true },
  defenses: [
    { category: "Encryption", name: "AES-256-GCM encryption engine", state: "LOADED", tone: "good" },
    { category: "Firewall/IDS", name: "Anti-Ettercap", state: "LOADED", tone: "good" },
    { category: "Firewall/IDS", name: "Anti-Nmap", state: "LOADED", tone: "good" },
    { category: "Firewall/IDS", name: "Anti-BDProxy", state: "LOADED", tone: "good" },
    { category: "Firewall/IDS", name: "IDS signatures", state: "847,291 loaded", tone: "info" },
    { category: "ML/AI", name: "Anomaly classifier", state: "ONLINE", tone: "good" },
    { category: "ML/AI", name: "Neural Core", state: "ACTIVE", tone: "good" },
    { category: "ML/AI", name: "Neural Engine", state: "ACTIVE", tone: "good" },
    { category: "Zero Trust", name: "Micro-segmentation", state: "ENFORCED", tone: "good" },
    { category: "Zero Trust", name: "Zero-Trust", state: "ENFORCED", tone: "good" },
    { category: "Defenses", name: "Prompt injection", state: "NEUTRALIZED", tone: "good" },
    { category: "Defenses", name: "MITM Defense", state: "100%", tone: "good" },
    { category: "Defenses", name: "Threat Shield", state: "99.7%", tone: "warn" },
  ],
  modules: [
    { name: "Neural Core", state: "ACTIVE", tone: "good" },
    { name: "DIETER SDC", state: "ACTIVE", tone: "good" },
    { name: "Threat Intel", state: "STREAMING", tone: "good" },
    { name: "Network Grid", state: "ONLINE", tone: "good" },
    { name: "Firewall Engine", state: "ENFORCED", tone: "good" },
    { name: "System Processes", state: "MONITORING", tone: "info" },
    { name: "Connections", state: "TRACKING", tone: "info" },
    { name: "Pentest Suite", state: "READY", tone: "warn" },
  ],
  sdc: [
    { name: "Endpoints mapped", state: "16", tone: "info" },
    { name: "Vulns catalogued", state: "18", tone: "warn" },
    { name: "Traffic replay", state: "READY", tone: "good" },
    { name: "LLM/MCP/RAG/Agent scanning", state: "ACTIVE", tone: "good" },
    { name: "Swagger/Postman dependency", state: "NONE", tone: "good" },
  ],
  events: [
    {
      id: "T-001",
      severity: "CRITICAL",
      tool: "Ettercap",
      source: "192.168.1.45",
      description: "ARP spoofing attempt detected — Ettercap signature matched. Packet injection neutralized at L2.",
      status: "BLOCKED",
      lastSeen: nowISO(),
    },
    {
      id: "T-002",
      severity: "HIGH",
      tool: "Nmap SYN Scan (-sS)",
      source: "203.0.113.77",
      description: "SYN stealth scan across 65535 ports. Honeypot engaged, attacker fingerprinted.",
      status: "BLOCKED",
      lastSeen: nowISO(),
    },
    {
      id: "T-003",
      severity: "CRITICAL",
      tool: "Proxy Injection (polymorphic)",
      source: "172.16.0.88",
      description: "Payload intercepted at proxy layer. Sandbox detonation confirmed C2 callback attempt.",
      status: "MITIGATED",
      lastSeen: nowISO(),
    },
    {
      id: "T-004",
      severity: "HIGH",
      tool: "Hydra (credential stuffing)",
      source: "198.51.100.23",
      description: "Brute-force attempts on SSH. 2,847 attempts in 60s. IP blackholed at edge firewall.",
      status: "BLOCKED",
      lastSeen: nowISO(),
    },
    {
      id: "T-005",
      severity: "CRITICAL",
      tool: "UDP Reflection + SYN Flood",
      source: "Multiple (Botnet)",
      description: "Volumetric DDoS — 12.4Gbps peak. Traffic scrubbing activated. Clean pipe restored.",
      status: "MITIGATED",
      lastSeen: nowISO(),
    },
    {
      id: "T-006",
      severity: "MEDIUM",
      tool: "DNS Exfiltration (tunneling)",
      source: "10.0.0.34",
      description: "DNS tunneling pattern detected. Exfil rate: 2.3KB/s encoded in TXT queries.",
      status: "INVESTIGATING",
      lastSeen: nowISO(),
    },
  ],
};

function toneDotClass(sevOrTone) {
  const v = String(sevOrTone || "").toUpperCase();
  if (v === "CRITICAL") return "bad";
  if (v === "HIGH") return "warn";
  if (v === "MEDIUM") return "warn";
  if (v === "LOW") return "good";
  if (v === "GOOD") return "good";
  if (v === "WARN") return "warn";
  if (v === "BAD") return "bad";
  return "";
}

function renderList(target, rows) {
  target.innerHTML = "";
  for (const r of rows) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; min-width:0;">
        <span class="dot ${toneDotClass(r.tone)}"></span>
        <div class="name" style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.name}</div>
      </div>
      <div class="state mono">${r.state}</div>
    `;
    target.appendChild(el);
  }
}

function formatLastSeen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

function currentViewEvents() {
  const sev = $("sevFilter")?.value || "ALL";
  const q = ($("q")?.value || "").trim().toLowerCase();
  return state.events.filter((e) => {
    if (sev !== "ALL" && e.severity !== sev) return false;
    if (!q) return true;
    const hay = `${e.id} ${e.severity} ${e.tool} ${e.source} ${e.description} ${e.status}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderEvents() {
  const body = $("eventsBody");
  const rows = currentViewEvents();
  body.innerHTML = "";
  for (const e of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${e.id}</td>
      <td><span class="sev ${e.severity}">${e.severity}</span></td>
      <td>${e.tool}</td>
      <td class="mono">${e.source}</td>
      <td>${e.description}</td>
      <td class="mono">${e.status}</td>
      <td class="mono">${formatLastSeen(e.lastSeen)}</td>
    `;
    body.appendChild(tr);
  }
}

function renderHeader() {
  const dot = $("shieldDot");
  const text = $("shieldText");
  if (!dot || !text) return;
  dot.className = `dot ${state.shield.active ? "good" : "bad"}`;
  text.textContent = `SHIELD: ${state.shield.level}/${state.shield.active ? "ACTIVE" : "OFFLINE"}`;
}

function renderKPIs(uptimeSeconds) {
  $("uptime").textContent = formatUptime(uptimeSeconds);
  $("nodes").textContent = `${state.nodesUp} / ${state.nodesTotal}`;
  $("sigs").textContent = state.signatures.toLocaleString();
}

function addRandomEvent() {
  // purely a mock feed generator
  const tools = [
    { tool: "WAF bypass probe", sev: "MEDIUM", status: "BLOCKED" },
    { tool: "JWT tamper attempt", sev: "HIGH", status: "MITIGATED" },
    { tool: "SQLi pattern", sev: "CRITICAL", status: "BLOCKED" },
    { tool: "XSS payload", sev: "HIGH", status: "BLOCKED" },
    { tool: "Rate-limit evasion", sev: "MEDIUM", status: "INVESTIGATING" },
    { tool: "Credential spraying", sev: "HIGH", status: "BLOCKED" },
  ];
  const srcs = ["203.0.113.10", "198.51.100.9", "192.168.1.77", "10.0.0.9", "172.16.0.12"];
  const pick = tools[Math.floor(Math.random() * tools.length)];
  const id = `T-${String(100 + Math.floor(Math.random() * 900))}`;
  const source = srcs[Math.floor(Math.random() * srcs.length)];
  const descriptions = {
    "WAF bypass probe": "Suspicious payload variations detected. Normalized and blocked by policy engine.",
    "JWT tamper attempt": "JWT claims altered; signature mismatch. Request denied and fingerprint recorded.",
    "SQLi pattern": "SQLi signature in query parameters. Block rule triggered at edge and app layer.",
    "XSS payload": "Reflected XSS payload observed. Output encoding verified; request blocked.",
    "Rate-limit evasion": "Distributed bursts detected. Adaptive throttling engaged.",
    "Credential spraying": "Multiple usernames from same ASN. Login protections triggered.",
  };

  state.events.unshift({
    id,
    severity: pick.sev,
    tool: pick.tool,
    source,
    description: descriptions[pick.tool] || "Suspicious activity detected.",
    status: pick.status,
    lastSeen: nowISO(),
  });

  state.events = state.events.slice(0, 120);
}

function tick() {
  if (state.paused) return;
  state.startUptimeSeconds += 1;
  renderKPIs(state.startUptimeSeconds);

  // update “quality” metrics with tiny jitter
  const threat = $("threatShield");
  if (threat) {
    const base = 99.7;
    const jitter = (Math.random() - 0.5) * 0.06;
    threat.textContent = `Threat Shield: ${(base + jitter).toFixed(2)}%`;
  }

  if (Math.random() < 0.22) {
    addRandomEvent();
    renderEvents();
  }
}

function init() {
  renderHeader();
  renderKPIs(state.startUptimeSeconds);
  renderList($("toolsList"), state.defenses);
  renderList($("modulesList"), state.modules);
  renderList($("sdcList"), state.sdc);
  renderEvents();

  $("sevFilter").addEventListener("change", renderEvents);
  $("q").addEventListener("input", renderEvents);

  $("pause").addEventListener("click", () => {
    state.paused = !state.paused;
    $("pause").textContent = state.paused ? "Resume" : "Pause";
  });

  $("exportJson").addEventListener("click", () => {
    const payload = {
      exportedAt: nowISO(),
      view: { severity: $("sevFilter").value, query: $("q").value },
      build: {
        name: $("buildName").textContent,
        uptime: $("uptime").textContent,
        nodes: $("nodes").textContent,
        signatures: $("sigs").textContent,
      },
      events: currentViewEvents(),
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "dieter-sec-export.json");
  });

  $("exportCsv").addEventListener("click", () => {
    const csv = toCSV(currentViewEvents());
    downloadBlob(new Blob([csv], { type: "text/csv" }), "dieter-sec-events.csv");
  });

  setInterval(tick, 1000);
}

init();

