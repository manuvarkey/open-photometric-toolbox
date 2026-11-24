# Open Photometric Toolbox

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-blue.svg)](https://v2.tauri.app/)
[![Vue](https://img.shields.io/badge/Vue-3.5-emerald.svg)](https://vuejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL2-black.svg)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

**Open Photometric Toolbox** is a modern, open-source, cross-platform engineering suite for luminaire photometric analysis, visualization, calculation, conversion, and reporting. 

Built with **Tauri v2 + Vue 3 + Three.js + TypeScript**, it provides native desktop performance, mathematical precision conforming to international lighting standards, and a sleek responsive ribbon interface with high-contrast theming.

---

## Key Capabilities

- **Interactive 3D Candela Web Visualization**:
  - WebGL2 hardware-accelerated 3D photometric solid web with false-color gradient heatmap shaders.
  - Orbit navigation, wireframe overlay, reference rings, and standard Cartesian axis indicators.
- **Precision 2D Distribution Graphs**:
  - High-precision SVG Polar curves (Max candela plane, $0^\circ$ transverse, $90^\circ$ longitudinal).
  - Linear Cartesian X-Y Candela distribution plots with interactive tracking crosshairs and coordinate tooltips.
  - Interactive mouse wheel zoom ($0.4\times$ to $5.0\times$) and drag-to-pan capabilities.
- **Zonal Lumens & TM-15 BUG Ratings**:
  - Simpson's $1/3$ numerical quadrature for zonal flux distribution across 18 spherical zones ($0^\circ - 180^\circ$).
  - IES TM-15-11 Backlight, Uplight, and Glare (BUG) ratings across all 10 secondary solid angle sub-zones.
- **Indoor & Roadway Luminaire Metrics**:
  - CIE luminaire classification (Direct, Semi-Direct, General Diffuse, Semi-Indirect, Indirect).
  - Spacing Criteria (SC Along $0^\circ$ transverse and Across $90^\circ$ longitudinal).
  - Full Coefficient of Utilization (CU) tables evaluated across Room Cavity Ratios (RCR 0–10) and multiple ceiling/wall reflectance combinations via the Zonal Cavity Method.
- **Type B $\leftrightarrow$ Type C Goniometer Web Converter**:
  - Spherical coordinate transformation algorithms with bilinear candela interpolation between Floodlight (Type B) and Architectural / Roadway (Type C) angular webs.
- **New Luminaire Profile Generator Wizard**:
  - Synthesize standardized IES LM-63 files from scratch with 6 interactive distribution presets: Recessed Downlight, Batwing Linear Suspended, Industrial UFO High Bay, NEMA Floodlight, Direct/Indirect Architectural Pendant, and Asymmetric Wall Wash.
- **Multi-File Catalog & Side-by-Side Comparison**:
  - Batch open, search, and filter photometric files with polar thumbnail previews.
  - Side-by-side luminaire comparison overlaying candela curves and computing differential efficiency and lumen metrics.
- **Standard Format Interoperability**:
  - Full bidirectional support for **IES LM-63** (1986, 1991, 1995, 2002) and European **EULUMDAT** (`.ldt`) file standards.
- **Automated Photometric Reports**:
  - Standalone HTML report export with embedded CSS and vector diagrams.
  - Isolated print-to-PDF generation free of application UI elements.
- **Native Desktop Integration**:
  - Client-Side Decorations (CSD) with compositor shadows, window dragging, and instant dark/light high-contrast theme switching.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Rust](https://www.rust-lang.org/) (v1.75 or newer with `cargo`)

### Installation
```bash
git clone https://github.com/manuvarkey/open-photometric-toolbox.git
cd open-photometric-toolbox
npm install
```

### Running in Development

```bash
# Frontend development server (Vite)
npm run dev

# Native Desktop Application (Tauri v2)
npm run tauri dev
```

### Production Build

```bash
# Frontend type check & production bundle
npm run build

# Native desktop build
npm run tauri build
```

---

## Architecture

- **`src/core/`**: Pure TypeScript photometric algorithms, parsers, and mathematical engines.
- **`src/components/`**: Reusable Vue 3 components, 3D WebGL viewers, SVG charts, and modal tools.
- **`src-tauri/`**: Native Rust application host, window management, and OS integrations.
- **`docs/`**: Engineering analysis and reverse-engineering documentation.

For detailed developer conventions and agent instructions, refer to [AGENTS.md](AGENTS.md).

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
