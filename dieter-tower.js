import { createDieterTower } from "./dieter-tower-sdk.js";

const app = document.getElementById("app");
const fallback = document.getElementById("fallback");

try {
  const ui = {
    floors: document.getElementById("floors"),
    radius: document.getElementById("radius"),
    twist: document.getElementById("twist"),
    taper: document.getElementById("taper"),
    floorsVal: document.getElementById("floorsVal"),
    radiusVal: document.getElementById("radiusVal"),
    twistVal: document.getElementById("twistVal"),
    taperVal: document.getElementById("taperVal"),
    exportGlb: document.getElementById("exportGlb"),
    exportObj: document.getElementById("exportObj"),
    exportStatus: document.getElementById("exportStatus"),
  };

  const tower = createDieterTower(app, {
    params: {
      floors: Number(ui.floors?.value ?? 56),
      radius: Number(ui.radius?.value ?? 9),
      twistDeg: Number(ui.twist?.value ?? 28),
      taper: Number(ui.taper?.value ?? 0.28),
    },
  });

  function syncLabels() {
    const p = tower.getParams();
    ui.floorsVal.textContent = String(p.floors);
    ui.radiusVal.textContent = Number(p.radius).toFixed(1);
    ui.twistVal.textContent = `${Math.round(p.twistDeg)}°`;
    ui.taperVal.textContent = Number(p.taper).toFixed(2);
  }

  function onSlider() {
    tower.setParams({
      floors: Number(ui.floors.value),
      radius: Number(ui.radius.value),
      twistDeg: Number(ui.twist.value),
      taper: Number(ui.taper.value),
    });
    syncLabels();
  }

  ui.floors.addEventListener("input", onSlider);
  ui.radius.addEventListener("input", onSlider);
  ui.twist.addEventListener("input", onSlider);
  ui.taper.addEventListener("input", onSlider);
  syncLabels();

  ui.exportGlb.addEventListener("click", () => {
    ui.exportStatus.textContent = "Exporting GLB…";
    tower
      .exportGLB()
      .then(() => {
        ui.exportStatus.textContent = "Saved GLB.";
        setTimeout(() => (ui.exportStatus.textContent = ""), 1500);
      })
      .catch((e) => {
        console.error(e);
        ui.exportStatus.textContent = `Export failed: ${e?.message ?? e}`;
      });
  });

  ui.exportObj.addEventListener("click", () => {
    ui.exportStatus.textContent = "Exporting OBJ…";
    tower
      .exportOBJ()
      .then(() => {
        ui.exportStatus.textContent = "Saved OBJ.";
        setTimeout(() => (ui.exportStatus.textContent = ""), 1500);
      })
      .catch((e) => {
        console.error(e);
        ui.exportStatus.textContent = `Export failed: ${e?.message ?? e}`;
      });
  });

  const onResize = () => tower.resize();
  window.addEventListener("resize", onResize);

  // Expose a simple API for tinkering in DevTools:
  //   window.DieterTower.setParams({ floors: 80 })
  //   window.DieterTower.exportGLB()
  window.DieterTower = tower;
} catch (e) {
  console.error(e);
  if (fallback) {
    fallback.style.display = "grid";
    const errText = document.getElementById("errText");
    if (errText) errText.textContent = String(e?.stack || e?.message || e);
  }
}

