# Open Photometric Toolbox: Agent & Developer Guidelines

These rules apply across the entire repository. Agents and contributors must review this document before making architectural, mathematical, or user-interface modifications.

---

## 1. Project Overview

**Open Photometric Toolbox** is a cross-platform, open-source engineering suite for luminaire photometric analysis, visualization, coordinate conversion, and reporting. It is designed for lighting designers, photometric test laboratories, and fixture manufacturers.

### Core Technology Stack
- **Native Desktop Runtime**: [Tauri v2](https://v2.tauri.app/) (Rust backend) with Client-Side Decorations (CSD).
- **Frontend Framework**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup lang="ts">`) + TypeScript + Vite.
- **3D Visualization**: [Three.js](https://threejs.org/) (WebGL2 photometric candela solid web with false-color gradient shaders).
- **2D Graphics**: SVG Vector rendering for Polar candela distribution and Cartesian X-Y linear intensity curves with zoom & pan.
- **Design System & Theming**: Custom GEstimator-aligned CSS tokens (`--workspace`, `--panel`, `--well`, `--accent`, `--line`), dark/light theme switching, and responsive word-wrapping ribbon toolbar.

---

## 2. Directory Structure & Layer Responsibilities

```
Photometric/
├── docs/                                  # Engineering specifications and algorithm documentation
│   ├── README.md
│   ├── architecture_and_components.md
│   ├── calculation_engines.md
│   ├── modular_tools.md
│   └── modern_reconstruction.md
├── src-tauri/                             # Tauri v2 Desktop Host (Rust)
│   ├── src/main.rs                        # Window creation, CSD shadow handlers, Wayland assertion filters
│   ├── capabilities/                      # Tauri v2 ACL permissions (core:default, window, dialog, fs)
│   │   └── default.json
│   ├── tauri.conf.json                    # Bundle configuration, window dimensions, CSP
│   └── Cargo.toml                         # Rust crate dependencies
├── src/
│   ├── core/                              # Photometric Calculation Engines (Pure TypeScript)
│   │   ├── types.ts                       # IES LM-63 data structures, BUG ratings, zonal flux, CU matrices
│   │   ├── calculations.ts                # Simpson's rule quadrature, TM-15 rating, CIE class, CU matrix
│   │   ├── iesParser.ts                   # IES LM-63 (1986/1991/1995/2002) parser & serializer
│   │   ├── eulumdatConverter.ts           # European EULUMDAT (.ldt) bidirectional parser & serializer
│   │   └── samples.ts                     # Standard fixtures: downlight, cobra head, NEMA floodlight
│   ├── components/                        # UI Components
│   │   ├── AppIcon.vue                    # Vector icon suite matching GEstimator
│   │   ├── RibbonToolbar.vue              # Canvas-measured ribbon toolbar with degradation
│   │   ├── Photometric3DViewer.vue        # Three.js 3D candela web visualizer with heatmap shader
│   │   ├── Polar2DViewer.vue              # SVG Polar & Cartesian graphs with interactive zoom & pan
│   │   ├── ZonalLumensTable.vue           # 18-zone lumen summary table
│   │   ├── BUGRatingViewer.vue            # TM-15-11 Backlight-Uplight-Glare breakdown
│   │   ├── CUTableModal.vue               # Zonal Cavity Coefficient of Utilization matrix (RCR 0-10)
│   │   ├── GoniometerConverterModal.vue   # Type B <-> Type C spherical coordinate converter
│   │   ├── NewLuminaireModal.vue          # Luminaire profile generator wizard with 6 presets
│   │   ├── PhotometricLibraryCatalog.vue  # Multi-file catalog browser with thumbnail polar curves
│   │   ├── LuminaireCompare.vue           # Multi-file side-by-side comparison & delta curves
│   │   └── ReportViewer.vue               # Isolated print-to-PDF & standalone HTML report export
│   ├── App.vue                            # Main shell, titlebar CSD, ribbon tabs, inspector, modals
│   ├── main.ts                            # Application entry point
│   ├── theme.css                          # Color tokens, surface hierarchy, light/dark themes
│   └── style.css                          # Layout, ribbon, inspector, and viewport styling
├── package.json                           # NPM dependencies and build scripts
├── tsconfig.json                          # TypeScript configuration
├── vite.config.ts                         # Vite configuration (port 1420)
└── AGENTS.md                              # Developer & Agent instructions (this file)
```

---

## 3. Engineering Rules & Modularity

### Separation of Concerns
1. **Mathematical Core (`src/core/`)**:
   - Must remain **pure, deterministic TypeScript** with zero dependencies on Vue, DOM, Three.js, or Tauri.
   - Simpson's $1/3$ numerical integration, zonal cavity coefficient calculations, and TM-15 rating tables must be validated against standardized physical formulas.
2. **UI & Viewports (`src/components/`)**:
   - Components receive immutable data props and emit events.
   - SVG vector graphs and Three.js WebGL scenes must support dynamic resizing and theme changes without memory leaks (clean up event listeners on unmount).
3. **Native Desktop Host (`src-tauri/`)**:
   - Keep platform-specific workarounds documented (e.g. GTK Wayland assertion filtering, CSD titlebar shadow initialization).
   - All frontend-accessible native capabilities (window controls, dialogs, file system access) must be explicitly permitted in `src-tauri/capabilities/default.json`.

---

## 4. Design & Theming Principles

- **GEstimator Alignment**: Retain the unified GEstimator ribbon navigation, surface tokens (`--workspace`, `--panel`, `--well`, `--raised`, `--line`), and Client-Side Decorations (CSD).
- **High-Contrast Dark & Light Modes**:
  - In light theme, surfaces must maintain crisp visual hierarchy (`--well` `#f1f5f9` for titlebar/table headers vs. `--panel` `#ffffff` for cards/ribbon, with `--line` `#cbd5e1`).
  - Graph curve colors must remain distinctly legible against both dark and light backgrounds:
    - Max Plane: Dark mode `#fbbf24` (amber), Light mode `#d97706` (deep amber-gold).
    - 0° Transverse: Dark mode `#38bdf8` (sky), Light mode `#0284c7` (deep cobalt blue).
    - 90° Longitudinal: Dark mode `#f472b6` (pink), Light mode `#be185d` (deep magenta-rose).

---

## 5. Repository & Version Control Rules

1. **Excluded Files (NEVER COMMIT)**:
   - Original proprietary installer executables (`PhotometricToolbox_*.exe`).
   - Unpacked installer directories and decompiled binary assemblies (`extracted_installer/`, `*.dll`, `*.msi`, `*.cab`, `*.chm`, `*.tlb`).
   - Build outputs (`dist/`, `src-tauri/target/`, `node_modules/`).
2. **Branching & Commits**:
   - Use conventional, concise commit messages.
   - Ensure `npm run build` and `cargo check` pass with **0 errors** before committing.

---

## 6. Build & Verification Commands

```bash
# Install frontend dependencies
npm install

# Run frontend development server
npm run dev

# Run desktop application in development mode
npm run tauri dev

# Type check & production frontend build
npm run build

# Verify Rust backend compilation
cd src-tauri && cargo check
```
