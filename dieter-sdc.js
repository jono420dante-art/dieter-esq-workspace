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

function toCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const headers = [
    "id",
    "fit",
    "status",
    "type",
    "city",
    "client",
    "budgetZAR",
    "categories",
    "contact",
    "budgetSource",
    "competitors",
    "signal",
  ];
  const out = [headers.map(esc).join(",")];
  for (const r of rows) {
    out.push(
      headers
        .map((h) => {
          const v =
            h === "categories" ? r.categories.join(" ") : h === "competitors" ? r.competitors.join("; ") : r[h];
          return esc(v);
        })
        .join(","),
    );
  }
  return out.join("\n");
}

function uniq(arr) {
  return [...new Set(arr)];
}

function groupCounts(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function fmtMoneyZAR(v) {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1_000_000) return `R${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R${(v / 1_000).toFixed(0)}k`;
  return `R${v.toFixed(0)}`;
}

function statusClass(status) {
  return String(status).replaceAll(" ", "-");
}

const data = {
  governmentTools: [
    { name: "Approval Tracker", state: "RUNNING" },
    { name: "Council Minutes Parser", state: "ACTIVE" },
    { name: "AI Solution Matching", state: "ACTIVE" },
    { name: "Tender Lifecycle Engine", state: "ONLINE" },
    { name: "Early Signal Detector", state: "WATCH" },
    { name: "Competitor Intel", state: "ENRICHING" },
  ],
  opportunities: [
    {
      id: "OPP-001",
      fit: 0.92,
      signal: "🔔 Early Signal",
      status: "Council Review",
      type: "Municipal",
      city: "Johannesburg",
      client: "City of Johannesburg",
      budgetZAR: 4_500_000,
      categories: ["🔒 Security", "💻 Digital"],
      contact: "Cllr. Mphumzi",
      budgetSource: "municipal budget",
      competitors: ["Securitas SA", "Bidvest Protea Coin"],
      details:
        "AI match: CCTV + access control + monitoring. Council minutes show “camera network refresh” and “public safety uplift” language.",
    },
    {
      id: "OPP-002",
      fit: 0.88,
      signal: "🔔 Early Signal",
      status: "Approved",
      type: "Municipal",
      city: "Durban",
      client: "eThekwini Municipality",
      budgetZAR: 12_000_000,
      categories: ["⚡ Energy", "🏗️ Infrastructure"],
      contact: "Mr. Dlamini",
      budgetSource: "national grant",
      competitors: ["SolarAfrica", "GreenCube Energy"],
      details: "Approval granted. Procurement timeline indicates vendor shortlist in 2 weeks; site visits begin immediately after.",
    },
    {
      id: "OPP-003",
      fit: 0.85,
      signal: "🔔 Early Signal",
      status: "Pre-Consultation",
      type: "Municipal",
      city: "Tshwane",
      client: "City of Tshwane",
      budgetZAR: 6_800_000,
      categories: ["🔒 Security", "🏗️ Infrastructure"],
      contact: "Procurement Office",
      budgetSource: "safety allocation",
      competitors: ["Fidelity ADT (services)", "Local integrators"],
      details: "Pre-consultation signals: RFI drafts mention “centralized VMS” and “camera health monitoring”.",
    },
    {
      id: "OPP-004",
      fit: 0.78,
      signal: "🔔 Early Signal",
      status: "Public Notice",
      type: "State",
      city: "Pretoria",
      client: "Provincial Government",
      budgetZAR: 3_900_000,
      categories: ["📞 PABX", "💻 Digital"],
      contact: "ICT Directorate",
      budgetSource: "operational budget",
      competitors: ["EOH", "BCX"],
      details: "Public notice posted; closing in ~5 days. Opportunity for fast pre-bid consult and requirements clarification.",
    },
    {
      id: "OPP-005",
      fit: 0.95,
      signal: "🔔 Early Signal",
      status: "Council Review",
      type: "Municipal",
      city: "Cape Town",
      client: "City of Cape Town",
      budgetZAR: 25_000_000,
      categories: ["🏙️ Smart City", "💻 Digital", "🔒 Security"],
      contact: "Smart City PMO",
      budgetSource: "capex program",
      competitors: ["Dimension Data", "Vodacom Business"],
      details: "High confidence. Multiple agenda items reference “smart precinct” and “security analytics” expansion.",
    },
    {
      id: "OPP-006",
      fit: 0.70,
      signal: "🔔 Early Signal",
      status: "In Progress",
      type: "State",
      city: "Johannesburg",
      client: "Department of Health",
      budgetZAR: 2_200_000,
      categories: ["🖨️ Copiers", "🏥 Health"],
      contact: "Facilities Admin",
      budgetSource: "operational spend",
      competitors: ["Canon SA", "Konica Minolta"],
      details: "In progress procurement. Late entry possible via subcontracting or maintenance add-ons.",
    },
  ],
};

function applyFilters() {
  const status = $("statusFilter").value || "ALL";
  const type = $("typeFilter").value || "ALL";
  const q = ($("q").value || "").trim().toLowerCase();
  let rows = data.opportunities.slice();

  if (status !== "ALL") rows = rows.filter((r) => r.status === status);
  if (type !== "ALL") rows = rows.filter((r) => r.type === type);
  if (q) {
    rows = rows.filter((r) => {
      const hay = `${r.id} ${r.status} ${r.type} ${r.city} ${r.client} ${r.categories.join(" ")} ${r.contact} ${
        r.budgetSource
      } ${r.competitors.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const sortBy = $("sortBy").value || "FIT_DESC";
  if (sortBy === "FIT_DESC") rows.sort((a, b) => b.fit - a.fit);
  if (sortBy === "FIT_ASC") rows.sort((a, b) => a.fit - b.fit);
  if (sortBy === "BUDGET_DESC") rows.sort((a, b) => b.budgetZAR - a.budgetZAR);
  if (sortBy === "CITY_ASC") rows.sort((a, b) => String(a.city).localeCompare(String(b.city)));

  return rows;
}

function renderGovTools() {
  const target = $("govTools");
  target.innerHTML = "";
  for (const t of data.governmentTools) {
    const el = document.createElement("div");
    el.className = "tool";
    el.innerHTML = `<div class="name">${t.name}</div><div class="state">${t.state}</div>`;
    target.appendChild(el);
  }
}

function renderStatusChips(counts, allCount) {
  const target = $("statusChips");
  target.innerHTML = "";

  const makeChip = (label, value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.padding = "8px 10px";
    btn.style.borderRadius = "999px";
    btn.style.border = "1px solid rgba(17,24,39,0.14)";
    btn.style.background = "rgba(255,255,255,0.9)";
    btn.style.cursor = "pointer";
    btn.onclick = () => {
      $("statusFilter").value = value;
      render();
    };
    target.appendChild(btn);
  };

  makeChip(`All (${allCount})`, "ALL");
  for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    makeChip(`${k} (${v})`, k);
  }
}

function renderStatusCountsTable(counts, allCount) {
  const row = $("statusCountsRow").children;
  const order = ["Pre-Consultation", "Public Notice", "Council Review", "Approved", "In Progress"];
  row[0].textContent = String(allCount);
  for (let i = 0; i < order.length; i++) {
    row[i + 1].textContent = String(counts.get(order[i]) || 0);
  }
}

function renderOpps(rows) {
  const grid = $("oppGrid");
  grid.innerHTML = "";

  for (const r of rows) {
    const el = document.createElement("div");
    el.className = "opp";
    el.innerHTML = `
      <div class="oppTop">
        <div>
          <div class="fit">${Math.round(r.fit * 100)}% Fit ${r.signal}</div>
          <div class="metaLine"><strong>${r.type}</strong> • ${r.client} • ${r.city} • <span class="mono">${fmtMoneyZAR(
            r.budgetZAR,
          )}</span></div>
        </div>
        <div class="badge status ${statusClass(r.status)}">${r.status}</div>
      </div>

      <div class="badges">
        ${r.categories.map((c) => `<span class="badge">${c}</span>`).join("")}
        <span class="badge">☎️ ${r.contact}</span>
        <span class="badge">🏦 ${r.budgetSource}</span>
      </div>

      <div class="row2">
        <div class="box">
          <div class="k">Details</div>
          <div class="v">${r.details}</div>
        </div>
        <div class="box">
          <div class="k">Competitors</div>
          <div class="v">🏁 ${r.competitors.join(", ")}</div>
          <small class="mono">${r.id}</small>
        </div>
      </div>
    `;
    grid.appendChild(el);
  }
}

function populateFilters() {
  const statuses = uniq(data.opportunities.map((o) => o.status)).sort();
  const types = uniq(data.opportunities.map((o) => o.type)).sort();

  const statusSel = $("statusFilter");
  const typeSel = $("typeFilter");

  statusSel.innerHTML =
    `<option value="ALL">Status: All (${data.opportunities.length})</option>` +
    statuses.map((s) => `<option value="${s}">${s}</option>`).join("");
  typeSel.innerHTML = `<option value="ALL">Type: All</option>` + types.map((t) => `<option value="${t}">${t}</option>`).join("");
}

function render() {
  const all = data.opportunities.slice();
  const statusCounts = groupCounts(all, (o) => o.status);

  renderStatusChips(statusCounts, all.length);
  renderStatusCountsTable(statusCounts, all.length);

  const rows = applyFilters();
  renderOpps(rows);

  const hiFit = rows.filter((r) => r.fit >= 0.7).length;
  $("hiFitCount").textContent = String(hiFit);
  $("totalCount").textContent = String(rows.length);

  $("exportJson").onclick = () => {
    const payload = {
      exportedAtISO: new Date().toISOString(),
      filters: {
        status: $("statusFilter").value,
        type: $("typeFilter").value,
        q: $("q").value,
        sortBy: $("sortBy").value,
      },
      opportunities: rows,
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "dieter-sdc-export.json");
  };
  $("exportCsv").onclick = () => {
    const csv = toCSV(rows);
    downloadBlob(new Blob([csv], { type: "text/csv" }), "dieter-sdc-opportunities.csv");
  };
}

function init() {
  $("hamburger").addEventListener("click", () => $("nav").classList.toggle("open"));
  renderGovTools();
  populateFilters();

  $("statusFilter").addEventListener("change", render);
  $("typeFilter").addEventListener("change", render);
  $("q").addEventListener("input", render);
  $("sortBy").addEventListener("change", render);

  render();

  // DevTools helpers:
  // window.DieterSDC.data.opportunities.push({...}); window.DieterSDC.render()
  window.DieterSDC = { data, render, applyFilters };
}

init();

