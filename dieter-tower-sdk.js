import * as THREE from "./vendor/three/three.module.js";
import { OrbitControls } from "./vendor/three/OrbitControls.js";
import { GLTFExporter } from "./vendor/three/exporters/GLTFExporter.js";
import { OBJExporter } from "./vendor/three/exporters/OBJExporter.js";

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function fmt(v, digits = 2) {
  return Number(v).toFixed(digits);
}

function safeNumber(value, def) {
  const n = Number(value);
  return Number.isFinite(n) ? n : def;
}

function disposeObject3D(obj) {
  obj.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) {
      if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
      else n.material.dispose();
    }
  });
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

export function normalizeParams(params) {
  const floors = clamp(Math.round(safeNumber(params?.floors, 56)), 8, 240);
  const radius = clamp(safeNumber(params?.radius, 9), 2, 30);
  const twistDeg = clamp(safeNumber(params?.twistDeg, 28), 0, 180);
  const taper = clamp(safeNumber(params?.taper, 0.28), 0, 0.85);
  const floorH = clamp(safeNumber(params?.floorH, 0.62), 0.2, 2.5);
  return { floors, radius, twistDeg, taper, floorH };
}

export const DieterTowerPresets = {
  classic: { floors: 56, radius: 9, twistDeg: 28, taper: 0.28, floorH: 0.62 },
  needle: { floors: 140, radius: 6.5, twistDeg: 14, taper: 0.55, floorH: 0.56 },
  barrel: { floors: 48, radius: 12, twistDeg: 0, taper: 0.05, floorH: 0.7 },
  spiral: { floors: 72, radius: 9.5, twistDeg: 95, taper: 0.22, floorH: 0.6 },
  stubby: { floors: 24, radius: 11, twistDeg: 20, taper: 0.18, floorH: 0.85 },
};

export function createDieterTower(containerEl, opts = {}) {
  if (!containerEl) throw new Error("createDieterTower: containerEl is required");

  const options = {
    backgroundAlpha: safeNumber(opts.backgroundAlpha, 0),
    pixelRatioCap: safeNumber(opts.pixelRatioCap, 2),
    showGrid: opts.showGrid ?? true,
    showGround: opts.showGround ?? true,
    autoRotate: opts.autoRotate ?? true,
    autoRotateSpeed: safeNumber(opts.autoRotateSpeed, 0.06),
    ...opts,
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.pixelRatioCap));
  renderer.setSize(containerEl.clientWidth || window.innerWidth, containerEl.clientHeight || window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x060812, options.backgroundAlpha);
  containerEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070a12, 0.02);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  camera.position.set(26, 20, 32);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 14, 0);

  scene.add(new THREE.HemisphereLight(0xaecbff, 0x1a1330, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(18, 40, 10);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa9ff, 0.55);
  rim.position.set(-24, 18, -20);
  scene.add(rim);

  const decorations = new THREE.Group();
  scene.add(decorations);

  let ground = null;
  if (options.showGround) {
    const groundGeo = new THREE.CircleGeometry(140, 96);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a1022, roughness: 1, metalness: 0 });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    decorations.add(ground);
  }

  let grid = null;
  if (options.showGrid) {
    grid = new THREE.GridHelper(120, 60, 0x2b3c78, 0x152044);
    grid.position.y = 0;
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    decorations.add(grid);
  }

  const towerRoot = new THREE.Group();
  scene.add(towerRoot);

  const matCore = new THREE.MeshStandardMaterial({ color: 0x11182e, metalness: 0.2, roughness: 0.65 });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x9cc9ff,
    emissive: 0x0a2b5a,
    emissiveIntensity: 0.55,
    metalness: 0.1,
    roughness: 0.2,
    transparent: true,
    opacity: 0.85,
  });
  const matAccent = new THREE.MeshStandardMaterial({
    color: 0x2f6bff,
    emissive: 0x1a4bff,
    emissiveIntensity: 0.25,
    metalness: 0.6,
    roughness: 0.35,
  });

  let _params = normalizeParams(options.params || DieterTowerPresets.classic);
  let _animHandle = 0;
  const clock = new THREE.Clock();

  function buildTower(params) {
    while (towerRoot.children.length) {
      const c = towerRoot.children.pop();
      disposeObject3D(c);
    }

    const { floors, radius, twistDeg, taper, floorH } = params;
    const height = floors * floorH;
    const twist = THREE.MathUtils.degToRad(twistDeg);
    const topScale = clamp(1 - taper, 0.2, 1);

    const coreGeo = new THREE.CylinderGeometry(radius * topScale, radius, height, 64, 1, false);
    coreGeo.rotateY(Math.PI / 64);
    const core = new THREE.Mesh(coreGeo, matCore);
    core.position.y = height / 2;
    towerRoot.add(core);

    const spineGeo = new THREE.CylinderGeometry(radius * 0.12, radius * 0.14, height * 1.01, 18, 1, false);
    const spine = new THREE.Mesh(spineGeo, matAccent);
    spine.position.set(radius * 0.65, height / 2, 0);
    spine.userData.__spine = true;
    towerRoot.add(spine);

    const winGroup = new THREE.Group();
    winGroup.userData.__windows = true;
    const winW = radius * 0.14;
    const winH = floorH * 0.55;
    const winD = radius * 0.02;
    const winGeo = new THREE.BoxGeometry(winW, winH, winD);

    const ringCount = Math.max(10, Math.floor(radius * 4));
    for (let i = 0; i < floors; i++) {
      const y = (i + 0.5) * floorH;
      const t = i / Math.max(1, floors - 1);
      const r = radius * (1 - taper * t);
      const a0 = twist * t;

      for (let j = 0; j < ringCount; j++) {
        if ((j + i) % 3 === 0) continue;
        const a = a0 + (j / ringCount) * Math.PI * 2;
        const x = Math.cos(a) * (r + winD * 0.5);
        const z = Math.sin(a) * (r + winD * 0.5);

        const w = new THREE.Mesh(winGeo, matGlass);
        w.position.set(x, y, z);
        w.lookAt(0, y, 0);
        winGroup.add(w);
      }
    }
    towerRoot.add(winGroup);

    const crownGeo = new THREE.CylinderGeometry(radius * topScale * 0.86, radius * topScale * 0.92, floorH * 1.7, 48);
    const crown = new THREE.Mesh(crownGeo, matAccent);
    crown.position.y = height + floorH * 0.85;
    crown.userData.__crown = true;
    towerRoot.add(crown);

    const capGeo = new THREE.ConeGeometry(radius * topScale * 0.72, floorH * 3.2, 48);
    const cap = new THREE.Mesh(capGeo, matCore);
    cap.position.y = height + floorH * 3.0;
    cap.userData.__cap = true;
    towerRoot.add(cap);

    towerRoot.rotation.y = Math.PI * 0.18;
    controls.target.set(0, height * 0.45, 0);
    controls.update();
  }

  function resize(width = containerEl.clientWidth, height = containerEl.clientHeight) {
    const w = Math.max(1, width || window.innerWidth);
    const h = Math.max(1, height || window.innerHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setParams(next) {
    _params = normalizeParams({ ..._params, ...(next || {}) });
    buildTower(_params);
    return getParams();
  }

  function getParams() {
    return { ..._params };
  }

  function setPreset(nameOrParams) {
    if (typeof nameOrParams === "string") {
      const p = DieterTowerPresets[nameOrParams];
      if (!p) throw new Error(`Unknown preset: ${nameOrParams}`);
      return setParams(p);
    }
    return setParams(nameOrParams);
  }

  function paramsLabel() {
    const p = _params;
    return `floors${p.floors}_r${fmt(p.radius, 1)}_tw${Math.round(p.twistDeg)}_tp${fmt(p.taper, 2)}_fh${fmt(p.floorH, 2)}`.replaceAll(
      ".",
      "_",
    );
  }

  async function exportGLB({ filename } = {}) {
    const exporter = new GLTFExporter();
    const arrayBuffer = await new Promise((resolve, reject) => {
      exporter.parse(
        towerRoot,
        (result) => resolve(result),
        (error) => reject(error),
        { binary: true, onlyVisible: true },
      );
    });
    const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
    const out = filename || `dieter-tower_${paramsLabel()}.glb`;
    downloadBlob(blob, out);
    return out;
  }

  async function exportOBJ({ filename } = {}) {
    const exporter = new OBJExporter();
    const objText = exporter.parse(towerRoot);
    const blob = new Blob([objText], { type: "text/plain" });
    const out = filename || `dieter-tower_${paramsLabel()}.obj`;
    downloadBlob(blob, out);
    return out;
  }

  function toJSON() {
    return JSON.stringify({ params: _params }, null, 2);
  }

  function fromJSON(json) {
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    if (!obj || !obj.params) throw new Error("Invalid JSON: expected { params: ... }");
    return setParams(obj.params);
  }

  function diagnostics() {
    const gl = renderer.getContext();
    return {
      threeRevision: THREE.REVISION,
      webglVersion: gl instanceof WebGL2RenderingContext ? 2 : 1,
      renderer: renderer.info.render,
      memory: renderer.info.memory,
      programs: (renderer.info.programs || []).length,
      params: getParams(),
    };
  }

  function renderOnce() {
    controls.update();
    renderer.render(scene, camera);
  }

  function start() {
    if (_animHandle) return;
    clock.start();
    const tick = () => {
      _animHandle = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      controls.update();
      if (options.autoRotate) towerRoot.rotation.y = 0.45 + t * options.autoRotateSpeed;
      const spine = towerRoot.children.find((c) => c?.userData?.__spine);
      const core = towerRoot.children.find((c) => c?.geometry?.type === "CylinderGeometry");
      if (spine && core) spine.position.y = (core.position?.y ?? 0) + Math.sin(t * 1.2) * 0.05;
      renderer.render(scene, camera);
    };
    tick();
  }

  function stop() {
    if (_animHandle) cancelAnimationFrame(_animHandle);
    _animHandle = 0;
  }

  function destroy() {
    stop();
    controls.dispose();
    disposeObject3D(scene);
    renderer.dispose();
    if (renderer.domElement?.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
  }

  // init
  resize();
  buildTower(_params);
  start();

  return {
    THREE,
    scene,
    camera,
    renderer,
    controls,
    towerRoot,
    resize,
    setParams,
    getParams,
    setPreset,
    exportGLB,
    exportOBJ,
    toJSON,
    fromJSON,
    diagnostics,
    renderOnce,
    start,
    stop,
    destroy,
  };
}

