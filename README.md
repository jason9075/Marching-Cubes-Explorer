# Marching Cubes Explorer

An interactive, step-by-step visualizer for the **Marching Cubes** (3D) and **Marching Squares** (2D) algorithms, built with vanilla JavaScript and Three.js. No bundler required.

![Nord Edition](https://img.shields.io/badge/theme-Nord-5e81ac?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-a3be8c?style=flat-square)

## Features

- **Dual mode** — switch between 2D (Marching Squares) and 3D (Marching Cubes) at any time
- **Step-by-step playback** — Play, Pause, and Step Forward to observe the algorithm cell by cell
- **Auto Speed** — skips through empty cells instantly and slows down when the isosurface is reached
- **Iso-value scrubbing** — drag the threshold slider for a live preview; releasing resets to IDLE
- **Grid resolution** — 2 to 32 cells per axis
- **Scalar field types**
  - *Continuous Float* — smooth radial (3D sphere) or metaball (2D) field, normalized to `[0, 1]`
  - *Binary (0/1)* — crisp step field; vertices are either fully inside or outside
- **Gradient coloring** — scalar points are colored by value (blue → yellow → green)
- **2D hover tooltip** — move the cursor over any grid vertex in 2D mode to see its scalar value
- **Display toggles** — show/hide grid lines and scalar points independently

## Getting Started

### Prerequisites

Enter the Nix development shell (provides Node 20, `just`, `live-server`, LSP servers):

```bash
nix develop
# or, with direnv:
direnv allow
```

### Run

```bash
just dev      # live-server with hot reload on port 8080
just serve    # http-server (no live reload)
just watch    # auto-restart dev server on src/ changes via entr
```

Then open `http://localhost:8080` in your browser.

### Dependencies

Runtime dependencies are loaded directly from `node_modules/` via a browser `importmap` — no build step needed.

```bash
# Install (bun or npm)
bun install
```

| Package | Version | Purpose |
|---------|---------|---------|
| `three` | ^0.184 | 3D rendering, OrbitControls |

## How It Works

### Algorithm

Both solvers expose a `*solveStepByStep()` generator that yields two events per processed cell:

| Event | Payload | Effect |
|-------|---------|--------|
| `cell_start` | `pos` | Highlight the current cell |
| `cell_complete` | `pos`, `triangles`/`lines` | Add geometry to the scene |

Empty cells (no isosurface intersection) only yield `cell_start` and are skipped instantly in Auto Speed mode.

### Module Structure

```
src/
  main.js                   # App — UI wiring, mode switching, animation loop
  marching/
    Algorithm.js            # MarchingCubesSolver (3D)
    MarchingSquares.js      # MarchingSquares (2D, Canvas 2D)
    SceneManager.js         # Three.js scene, camera, instanced mesh rendering
    lut2.js                 # Static lookup tables (EDGE_TABLE, TRI_TABLE, …)
```

### Scalar Field

| Mode | 3D | 2D |
|------|----|----|
| Float | Radial sphere, normalized to `[0, 1]` | Metaball sum, normalized to `[0, 1]` |
| Binary | `dist < 0.5 → 1, else 0` | Normalized metaball `> 0.5 → 1, else 0` |

## License

[MIT](LICENSE)
