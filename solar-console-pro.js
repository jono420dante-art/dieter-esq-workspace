function $(id) {
  return document.getElementById(id);
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

function groupCount(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function fmtPercent(v) {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtMoney(v, currency = "R") {
  if (!Number.isFinite(v)) return "—";
  // v is in ZAR (or your base units). For display, we’ll compact to M/B.
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${currency}${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${currency}${(v / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${currency}${(v / 1e3).toFixed(0)}k`;
  return `${currency}${v.toFixed(0)}`;
}

function fmtKwh(v) {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(0)} kWh`;
}

function uniq(arr) {
  return [...new Set(arr)];
}

function toCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const headers = ["name", "city", "type", "dailyLoadKwh", "status"];
  const out = [headers.map(esc).join(",")];
  for (const r of rows) out.push(headers.map((h) => esc(r[h])).join(","));
  return out.join("\n");
}

// Edit this object to update the dashboard (no backend).
const data = {
  meta: {
    portfolioName: "Transparent Wealth",
    productName: "Solar Console Pro",
    version: "1.0",
    lastUpdatedISO: new Date().toISOString(),
  },
  portfolio: {
    totalInvestmentZAR: 300_000_000, // R0.3B
    totalNPVZAR: 289_000_000, // R289M
  },
  clients: [
    { id: "C-001", name: "Residential – Household A", segment: "Residential" },
    { id: "C-002", name: "Residential – Household B", segment: "Residential" },
    { id: "C-003", name: "Corporate – Logistics Group", segment: "Corporate" },
    { id: "C-004", name: "Corporate – Office Park", segment: "Corporate" },
    { id: "C-005", name: "Developer – Utility SPV", segment: "Developer" },
  ],
  properties: [
    {
      id: "P-001",
      name: "JHB Logistics Park – Roof A",
      city: "Johannesburg",
      type: "Commercial",
      status: "Installation",
      dailyLoadKwh: 1500,
      modelIRR: 0.19,
    },
    {
      id: "P-002",
      name: "Johannesburg Residential – Single Family Home",
      city: "Johannesburg",
      type: "Residential",
      status: "Complete",
      dailyLoadKwh: 25,
      modelIRR: 0.16,
    },
    {
      id: "P-003",
      name: "Northern Cape Solar Park – Site A",
      city: "Kimberley",
      type: "Utility",
      status: "Site Survey",
      dailyLoadKwh: 0,
      modelIRR: 0.18,
    },
    {
      id: "P-004",
      name: "Cape Town Residential – Double Storey",
      city: "Cape Town",
      type: "Residential",
      status: "Design",
      dailyLoadKwh: 20,
      modelIRR: 0.18,
    },
  ],
};

function compute() {
  const props = data.properties;
  const totalProps = props.length;
  const activeCount = props.filter((p) => p.status !== "Complete").length;
  const completedCount = props.filter((p) => p.status === "Complete").length;

  const avgIRR = props.length ? props.reduce((s, p) => s + (p.modelIRR || 0), 0) / props.length : 0;
  const avgLoad = props.length ? props.reduce((s, p) => s + (p.dailyLoadKwh || 0), 0) / props.length : 0;

  const cities = uniq(props.map((p) => p.city));
  const statusCounts = groupCount(props, (p) => p.status);
  const typeCounts = groupCount(props, (p) => p.type);
  const cityCounts = groupCount(props, (p) => p.city);
  const segmentCounts = groupCount(data.clients, (c) => c.segment);

  const inProgress = props.filter((p) => p.status !== "Complete").length;

  return {
    totalProps,
    activeCount,
    completedCount,
    avgIRR,
    avgLoad,
    cities,
    statusCounts,
    typeCounts,
    cityCounts,
    segmentCounts,
    inProgress,
  };
}

function renderBars(targetEl, counts) {
  targetEl.innerHTML = "";
  const max = Math.max(1, ...counts.map(([, v]) => v));
  for (const [name, count] of counts) {
    const row = document.createElement("div");
    row.className = "bar";
    row.innerHTML = `
      <div class="name">${name}</div>
      <div class="barTrack"><div class="barFill" style="width:${Math.round((count / max) * 100)}%"></div></div>
      <div class="count">${count}</div>
    `;
    targetEl.appendChild(row);
  }
}

function renderCitiesTable(targetEl, counts) {
  targetEl.innerHTML = "";
  for (const [city, count] of counts) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${city}</td><td class="mono">${count}</td>`;
    targetEl.appendChild(tr);
  }
}

function currentFilters() {
  return {
    status: $("statusFilter").value || "ALL",
    city: $("cityFilter").value || "ALL",
    q: ($("q").value || "").trim().toLowerCase(),
  };
}

function filteredProperties() {
  const f = currentFilters();
  return data.properties.filter((p) => {
    if (f.status !== "ALL" && p.status !== f.status) return false;
    if (f.city !== "ALL" && p.city !== f.city) return false;
    if (!f.q) return true;
    const hay = `${p.name} ${p.city} ${p.type} ${p.status}`.toLowerCase();
    return hay.includes(f.q);
  });
}

function renderRecent(targetEl) {
  const rows = filteredProperties();
  targetEl.innerHTML = "";
  for (const p of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name}</td>
      <td class="muted">${p.city} • ${p.type}</td>
      <td class="mono">${fmtKwh(p.dailyLoadKwh)}</td>
      <td><span class="pill"><span class="dot ${p.status === "Complete" ? "good" : p.status === "Installation" ? "warn" : "info"}"></span>${p.status}</span></td>
    `;
    targetEl.appendChild(tr);
  }
  $("recentCount").textContent = `${rows.length} of ${data.properties.length} properties shown (filters apply).`;
  return rows;
}

function populateFilters() {
  const statuses = uniq(data.properties.map((p) => p.status)).sort();
  const cities = uniq(data.properties.map((p) => p.city)).sort();

  const statusSel = $("statusFilter");
  const citySel = $("cityFilter");

  statusSel.innerHTML = `<option value="ALL">Status: ALL</option>` + statuses.map((s) => `<option value="${s}">${s}</option>`).join("");
  citySel.innerHTML = `<option value="ALL">City: ALL</option>` + cities.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function render() {
  $("lastUpdated").textContent = `Last updated: ${new Date(data.meta.lastUpdatedISO).toLocaleString()}`;

  const c = compute();
  $("mTotalProps").textContent = String(c.totalProps);
  $("mActiveCompleted").textContent = `${c.activeCount} active • ${c.completedCount} completed`;
  $("mClients").textContent = String(data.clients.length);
  $("mClientNote").textContent = "Across residential, C&I, utility";
  $("mInvestment").textContent = fmtMoney(data.portfolio.totalInvestmentZAR, "R");
  $("mIrr").textContent = fmtPercent(c.avgIRR);
  $("mLoad").textContent = (c.avgLoad || 0).toFixed(0);
  $("mCities").textContent = String(c.cities.length);

  $("mCompleted").textContent = String(c.completedCount);
  $("mInProgress").textContent = String(c.inProgress);
  $("mNpv").textContent = fmtMoney(data.portfolio.totalNPVZAR, "R");

  renderBars($("byType"), c.typeCounts);
  renderBars($("byStatus"), c.statusCounts);
  renderBars($("bySegment"), c.segmentCounts);
  renderCitiesTable($("citiesBody"), c.cityCounts);

  const visible = renderRecent($("recentBody"));

  $("exportJson").onclick = () => {
    const payload = {
      exportedAtISO: new Date().toISOString(),
      filters: currentFilters(),
      meta: data.meta,
      portfolio: data.portfolio,
      clients: data.clients,
      propertiesVisible: visible,
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "solar-console-export.json");
  };

  $("exportCsv").onclick = () => {
    const csv = toCSV(visible);
    downloadBlob(new Blob([csv], { type: "text/csv" }), "solar-console-properties.csv");
  };
}

function init() {
  populateFilters();
  render();

  $("statusFilter").addEventListener("change", () => render());
  $("cityFilter").addEventListener("change", () => render());
  $("q").addEventListener("input", () => render());

  // DevTools helpers:
  // window.SolarConsole.data.properties.push({...}); window.SolarConsole.render()
  window.SolarConsole = {
    data,
    render,
    filteredProperties,
  };
}

init();

