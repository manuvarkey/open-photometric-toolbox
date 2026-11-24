# Photometric Toolbox 2.14: Modular Tools Specification

Photometric Toolbox decouples functionality into independent 32-bit PE GUI executables, all compiled natively with Visual Basic 6.0 (`MSVBVM60.DLL`).

The primary launcher (`photometric_toolbox_2._.exe`) acts as a shell that spawns these sub-tools with command-line arguments specifying the active photometric file path.

---

## Tool Catalog

| Executable | Size | Functional Domain | Key Capabilities | Modern App Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| `photometric_toolbox_2._.exe` | 1,556,384 bytes | **Main Application Shell** | Desktop host, file manager, luminaire search engine (Jet DB), tool launcher. | **Fully Implemented**: Tauri v2 desktop host, unified GEstimator ribbon, CSD decorations. |
| `tool_viewpe.exe` | 491,400 bytes | **Viewer & Polar Curves** | Plots 2D polar curves (candela vs. vertical angle), Cartesian candela plots, and launches 3D photometric web visualization (`vbogl.tlb`). | **Fully Implemented**: Three.js 3D web with heatmap shader, SVG Polar 2D (Max, 0°, 90°), and Cartesian X-Y Candela plot. |
| `tool_editpe.exe` | 483,208 bytes | **Photometric Editor** | Interactive editor for candela arrays, multiplier, angles, lamp wattages, and IES header keywords (e.g. `[LUMCAT]`, `[LUMINAIRE]`, `[MANUFAC]`). | **Fully Implemented**: Live inspector panel for keywords, lamp parameters, geometry, and real-time multiplier adjustment. |
| `tool_comparepe.exe` | 610,192 bytes | **Comparison Tool** | Side-by-side photometric comparison between two or more luminaires; overlays polar curves and computes delta percentage differences in efficiency and zonal distribution. | **Fully Implemented**: `LuminaireCompare.vue` with curve overlay, delta metrics, BUG comparison, and multi-file selection. |
| `tool_convertpe.exe` | 208,784 bytes | **Format Converter** | Converts files between IES LM-63 (1986, 1991, 1995, 2002), EULUMDAT (`.ldt`), and CIBSE TM14 formats. Adjusts coordinate orientations. | **Fully Implemented**: `GoniometerConverterModal.vue` (Type B <-> Type C web converter) and `eulumdatConverter.ts` (.ldt import/export). |
| `tool_indoorreportpe.exe` | 548,760 bytes | **Indoor Luminaire Report** | Generates formal indoor photometric reports: CIE classification, Coefficients of Utilization (CU) table for RCR 0–10 via the Zonal Cavity Method, Spacing Criterion (SC along 0° and across 90°), Luminance summary (cd/m²), and UGR tables. | **Fully Implemented**: `CUTableModal.vue` (full RCR 0-10 zonal cavity CU matrix), CIE classification, SC, and `ReportModal.vue`. |
| `tool_roadreportpe.exe` | 614,288 bytes | **Roadway Report** | Evaluates IES RP-8 roadway classifications: IES Type (Type I through Type V), Longitudinal distribution (Short, Medium, Long), and Cutoff classifications (Full Cutoff, Cutoff, Semi-Cutoff, Non-Cutoff). | **Fully Implemented**: TM-15 BUG Rating (`BUGRatingViewer.vue`) and IES classification in calculation engine. |
| `tool_floodreportpe.exe` | 462,744 bytes | **Floodlight Report** | Computes NEMA beam spread classifications (Type 1 to Type 7) across horizontal and vertical axes; calculates field lumens, beam efficiency, and isocandela curves. | **Fully Implemented**: Type B floodlight coordinate support and beam calculations in `calculations.ts`. |
| `tool_templatepe.exe` | 499,600 bytes | **Iso-illuminance Template** | Generates iso-footcandle / iso-lux template curves plotted at user-specified mounting heights. | **Implemented**: Floor plane illuminance grid calculation in core engine. |
| `tool_newpe.exe` | 434,056 bytes | **New Luminaire Creator** | Wizard for creating photometric files from scratch or generating synthetic symmetrical distributions. | **Fully Implemented**: `NewLuminaireModal.vue` with 6 interactive distribution presets, live polar preview, and instant IES generation. |
| `tool_openexpe.exe` | 266,120 bytes | **Batch Open / Catalog** | Handles batch loading, file validation, and photometric database ingestion. | **Fully Implemented**: `PhotometricLibraryCatalog.vue` multi-file catalog browser with search, filters, polar preview thumbnails. |
| `tool_saveexpe.exe` | 331,656 bytes | **Export & Batch Save** | Batch file export, renaming, custom header injection, and data formatting. | **Fully Implemented**: IES and LDT file serialization, download, and clean PDF / HTML report generation. |

---

## Sub-Tool In-Depth: Indoor Report Tool (`tool_indoorreportpe.exe`)

* **Internal Executable**: `tool_indoorreportpe.exe` (548,760 bytes, VB6 native)
* **Associated Help Manual**: `Indoor_Report_Tool/ies_indoor_report_cu_table.htm` in `photometric_toolbox_html.chm`
* **Underlying Calculation DLL**: `LAICalcNETRev2.dll` (`CalcCU()`, `gsbCalcCU()`, `gfnCalcCUShort()`, `CalcRCR()`)

### Capabilities & Report Sections:
1. **Coefficients of Utilization (CU) - Zonal Cavity Method**:
   * Evaluates $11 \times 18$ grid across:
     * **Effective Floor Cavity Reflectance ($\rho_{fc}$)**: Fixed default $0.20$ ($20\%$).
     * **Ceiling Cavity Reflectance ($\rho_{cc}$)**: $80\%, 70\%, 50\%, 30\%, 10\%, 0\%$.
     * **Wall Reflectance ($\rho_w$)**: Combinations of $70\%, 50\%, 30\%, 10\%, 0\%$.
     * **Room Cavity Ratio (RCR)**: $0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10$.
2. **Spacing Criterion (SC)**:
   * SC Along ($0^\circ$ transverse) and SC Across ($90^\circ$ longitudinal).
3. **Zonal Lumen Summary**:
   * 18 zones from $0^\circ$ to $180^\circ$ with percent luminaire and percent total lamp flux.
4. **Luminance Data Table**:
   * Average luminance values in $\text{cd/m}^2$ computed across $45^\circ, 55^\circ, 65^\circ, 75^\circ, 85^\circ$ vertical angles.
5. **CIE 117-1995 Unified Glare Rating (UGR)**:
   * Uncorrected and corrected tabular UGR outputs for 19 standard room configurations ($2H \times 2H$ to $12H \times 8H$).

---

## Inter-Process Communication (IPC)

Tools are invoked by the main executable passing parameters via command-line arguments:
```cmd
tool_viewpe.exe "<path_to_ies_file>" [options]
tool_convertpe.exe "<input_file>" "<output_file>" /format=ldt
```
Output reports and temporary data interchanges are serialized to disk or held in the local Access/Jet cache before being rendered via the DevExpress print engine.
