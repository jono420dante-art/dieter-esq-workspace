# Dieter Tower (Three.js)

This folder contains a small, offline-friendly 3D “tower generator” you can open in your browser.

## Run it

From PowerShell:

```powershell
cd "c:\Users\Michelle\Downloads\dIETER JONO TOWEER_files"
python -m http.server 5173
```

Open:

- `http://localhost:5173/dieter-tower.html`

## Use it

- **Change the tower**: use the sliders (Floors / Radius / Twist / Taper).
- **Move around**: drag to orbit, scroll to zoom, `Shift` + drag to pan.
- **Export**:
  - **GLB**: click **Export GLB** (best for Blender/Unity/Godot).
  - **OBJ**: click **Export OBJ** (simple geometry, no materials).

Files download into your browser’s default downloads folder.

## Work with exports

### Blender
- **GLB**: `File > Import > glTF 2.0 (.glb/.gltf)`
- **OBJ**: `File > Import > Wavefront (.obj)`

Tip: GLB preserves transforms/materials better than OBJ.

### Unity
- Put the `.glb` in `Assets/` and use a glTF importer (Unity doesn’t import glTF/GLB natively in many setups).
  - Common option: install a glTF package (e.g. Khronos or community importer) in Package Manager.

### Using the model on a website (Three.js)
- Prefer **GLB** and load it with `GLTFLoader` in your own Three.js scene.

## Customize / extend

The generator lives in:

- `dieter-tower.js`

Key spots:
- **`buildTower()`**: where the geometry is created.
- **`exportGLB()` / `exportOBJ()`**: export logic.

Vendor libraries (kept local so it works without CDNs):

- `vendor/three/three.module.js`
- `vendor/three/OrbitControls.js`
- `vendor/three/exporters/GLTFExporter.js`
- `vendor/three/exporters/OBJExporter.js`
