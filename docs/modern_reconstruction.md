# Modern Photometric Toolbox Reconstruction

A cross-platform modern reconstruction of **Photometric Toolbox**, built with **Tauri v2 + Vue 3 + Three.js + TypeScript**, reproducing the calculation engines discovered from the decompiled .NET libraries and adopting the exact ribbon interface, theming, and styling from **GEstimator**.

---

## 1. Technical Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Host Runtime** | [Tauri v2](https://v2.tauri.app/) (Rust backend) | Native OS windowing, client-side window decorations (CSD), file system dialogs, hardware acceleration |
| **UI Framework** | [Vue 3](https://vuejs.org/) + TypeScript + Vite | Reactive user interface, component hierarchy, modular tool modals |
| **Styling & Theming** | Custom CSS variables + PrimeVue v4 Aura | Dark/Light themes, elevated surfaces, GEstimator color palette (`--workspace`, `--panel`, `--accent`) |
| **Ribbon Toolbar** | Custom canvas-measured `.ribbon` component | Word-wrap text degradation (`[data-ribbon-mini]`), grouped ribbon tools, unified single-level ribbon bar |
| **3D Photometry** | [Three.js](https://threejs.org/) (WebGL2) | 3D candela solid web, false-color heatmap shader, polar reference rings, natural camera orbit navigation |
| **2D Curves** | SVG Vector Polar & Cartesian Graph | High-precision nadir polar plots (Max plane, 0° transverse, 90° longitudinal) and Cartesian X-Y curves |
| **Calculation Engine** | TypeScript Core Modules | Simpson's rule zonal lumens, IES TM-15-11 BUG rating, CIE classification, Zonal Cavity CU matrix |

---

## 2. Directory Structure

```
Photometric/
├── docs/                                  # Reverse engineering documentation
│   ├── README.md
│   ├── installer_and_extraction.md
│   ├── architecture_and_components.md
│   ├── calculation_engines.md
│   ├── modular_tools.md
│   └── modern_reconstruction.md
├── extracted_installer/                   # Unpacked MSI & Data1.cab (146 files)
├── src-tauri/                             # Tauri v2 Rust backend
│   ├── src/main.rs                        # Window configuration, CSD handlers, Wayland assertions filter
│   ├── tauri.conf.json                    # Tauri v2 bundle settings
│   ├── Cargo.toml                         # Rust dependencies
│   └── icons/                             # Luminaire application vector & raster icons
├── src/
│   ├── core/                              # Decompiled Photometric Logic (Pure TypeScript)
│   │   ├── types.ts                       # IES LM-63 data structures, BUG ratings, zones, CU tables
│   │   ├── calculations.ts                # Simpson's rule integration, TM-15 rating, CIE, CU matrix
│   │   ├── iesParser.ts                   # IES LM-63 parser & serializer
│   │   ├── eulumdatConverter.ts           # EULUMDAT (.ldt) bidirectional parser & serializer
│   │   └── samples.ts                     # Commercial downlight, Cobra head, Floodlight presets
│   ├── components/
│   │   ├── AppIcon.vue                    # Vector icon suite matching GEstimator
│   │   ├── RibbonToolbar.vue              # Canvas-measured degradation ribbon
│   │   ├── Photometric3DViewer.vue        # Three.js 3D candela web visualizer with heatmap shader
│   │   ├── Polar2DViewer.vue              # SVG polar candela curve & Cartesian X-Y linear visualizer
│   │   ├── ZonalLumensTable.vue           # Zonal lumens summary table
│   │   ├── BUGRatingViewer.vue            # TM-15 Backlight-Uplight-Glare breakdown
│   │   ├── CUTableModal.vue               # Coefficient of Utilization (CU) zonal cavity matrix
│   │   ├── GoniometerConverterModal.vue   # Type B <-> Type C goniometer coordinate converter
│   │   ├── NewLuminaireModal.vue          # Luminaire profile generator wizard with 6 presets
│   │   ├── PhotometricLibraryCatalog.vue  # Multi-file catalog browser with thumbnail polar curves
│   │   ├── LuminaireCompare.vue           # Side-by-side photometric comparison & differential curves
│   │   └── ReportModal.vue                # Isolated print-to-PDF & HTML report export engine
│   ├── App.vue                            # Main shell, ribbon tabs, inspector, status bar, modal hosts
│   ├── main.ts                            # Application entry point & PrimeVue initialization
│   ├── theme.css                          # CSS variables, color tokens, dark/light themes
│   └── style.css                          # Layout, ribbon, inspector, and viewport styling
├── package.json                           # NPM dependencies & scripts
├── tsconfig.json                          # TypeScript compiler configuration
└── vite.config.ts                         # Vite configuration
```

---

## 3. Reverse-Engineered Photometric Engine Parity

### Simpson's Rule Zonal Integration (from `LAICalcNETRev2.dll`)
Computes zonal lumens across 18 spherical zones ($0^\circ - 180^\circ$) using Simpson's $1/3$ numerical quadrature:
$$\Phi_{\theta_1 \to \theta_2} = 2\pi \int_{\theta_1}^{\theta_2} I(\theta) \sin\theta \, d\theta$$
Interpolates intermediate candela points at $1^\circ$ steps with trigonometric sine weighting.

### IES TM-15-11 BUG Rating
Evaluates the 10 secondary solid angle sub-zones:
- **Backlight (B)**: BL ($0^\circ-30^\circ$), BM ($30^\circ-60^\circ$), BH ($60^\circ-80^\circ$), BVH ($80^\circ-90^\circ$).
- **Uplight (U)**: UL ($90^\circ-100^\circ$), UH ($100^\circ-180^\circ$).
- **Glare (G)**: Forward FH ($60^\circ-80^\circ$), FVH ($80^\circ-90^\circ$), and Backward BH/BVH.

### Coefficient of Utilization (CU) Table (from `tool_cupe.exe` / `laicutabnet.dll`)
Computes room utilization coefficients for Room Cavity Ratios (RCR 0 to 10) across standard ceiling ($80\%, 70\%, 50\%, 30\%, 10\%, 0\%$) and wall ($70\%, 50\%, 30\%, 10\%$) reflectances with a standard $20\%$ floor cavity reflectance.

### Type B $\leftrightarrow$ Type C Goniometer Web Conversion (from `tool_convertpe.exe` / `laiglarenet.dll`)
Performs 3D spherical coordinate transformation between Type B (floodlights / searchlights) and Type C (downlights / troffers / streetlights) with bilinear candela interpolation.

### New Luminaire Profile Synthesis (from `tool_newpe.exe`)
Generates standardized IES LM-63 files from basic photometric specifications and beam angle models:
- Recessed Downlight (narrow, medium, wide)
- Batwing Linear Suspended Distribution
- Industrial UFO High Bay
- NEMA Floodlight
- Direct / Indirect Architectural Pendant
- Asymmetric Wall Wash

### Multi-File Photometric Library Catalog (from `photometric_toolbox_2._.exe` / `tool_openexpe.exe`)
Provides instant searching, category filtering, metric badges (lumens, efficiency, BUG rating, CIE class), thumbnail polar previews, and quick loading/comparison into the active workspace.

### Report Generation Engine (from `tool_reportpe.exe`)
Generates comprehensive photometric reports:
- Standalone HTML reports with self-contained CSS and SVG diagrams.
- Clean PDF export via isolated print DOM container without application UI bleed.

---

## 4. How to Run and Build

### Development Mode (Vite Dev Server)
```bash
npm run dev
```

### Desktop Tauri Application Mode
```bash
npm run tauri dev
```

### Production Build Verification
```bash
npm run build
cd src-tauri && cargo check
```
