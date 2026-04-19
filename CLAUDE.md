# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
just dev      # Start live-server with hot reload on port 5173
just serve    # Serve static files via http-server (no live reload)
just watch    # Use entr to auto-restart dev server on src/ file changes
```

Enter the dev shell first: `nix develop` (or via `direnv allow` if `.envrc` is set up).

No build step — the page runs directly from source via browser importmaps.

## Architecture

This is a **vanilla JS + Three.js** interactive educational visualizer for the Marching Cubes (3D) and Marching Squares (2D) algorithms. No bundler; Three.js is resolved from `node_modules/` via an `<script type="importmap">` in `index.html`.

### Module structure

```
src/
  main.js                    # App class: UI wiring, mode switching, animation loop
  marching/
    Algorithm.js             # MarchingCubesSolver — generates scalar field (radial sphere), runs algorithm
    SceneManager.js          # Three.js scene: camera, renderer, OrbitControls, mesh/grid/point groups
    MarchingSquares.js       # 2D canvas-based Marching Squares solver and renderer
    lut2.js                  # Static lookup tables: EDGE_TABLE, TRI_TABLE, VERTEX_OFFSETS, EDGE_V_MAP
```

### Core pattern: Generator-based step-by-step execution

Both `MarchingCubesSolver` and `MarchingSquares` expose a `*solveStepByStep()` generator. Each `yield` emits either:
- `{ type: 'cell_start', pos }` — highlight the current cell
- `{ type: 'cell_complete', pos, triangles/lines }` — add geometry for that cell

`App` drives this generator via `step()`, called either manually or on a `setTimeout` loop (`animate()`). This enables Play/Pause and single-step controls without any separate scheduler.

### 3D rendering (SceneManager)

Four `THREE.Group`s are added to the scene:
- `gridGroup` — bounding box wireframe
- `meshGroup` — accumulated isosurface triangles (`BufferGeometry`, `MeshPhongMaterial`)
- `highlightGroup` — current cell wireframe cube
- `pointsGroup` — scalar field vertices colored by above/below threshold

`addTriangles()` appends new `BufferGeometry` meshes per step; `updateFullMesh()` clears and rebuilds all at once (used by the iso-value slider during pause).

### Cache busting

Import paths use `?v=2` query strings (e.g. `import '…/Algorithm.js?v=2'`) to bypass browser cache during development. Bump this version suffix when you need to force a reload.

### Color theme

All colors follow the **Nord palette** (background `#2e3440`, accent `#88c0d0`, grid `#d8dee9`, highlight `#ebcb8b`, above-threshold `#a3be8c`, below-threshold `#bf616a`).
