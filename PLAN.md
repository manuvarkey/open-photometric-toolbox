# Ribbon redesign implementation plan

The ribbon redesign below is complete. The next requested work is specified in the [core, vector views, and interface implementation plan](docs/feature_implementation_plan.md), informed by the [core-only binary investigation](docs/core_module_findings.md).

## Goal

Reduce the ribbon from nine tabs to five and give each action a predictable location. Keep the GEstimator-aligned theme, desktop titlebar, photometric calculations, file formats, and report outputs.

| Tab | Commands and destinations |
| --- | --- |
| File | New Luminaire, Open, Save IES, Edit Luminaire, Export LDT, Library, Samples |
| Visualize | 3D Candela Web, 2D Candela Plot, Iso-illuminance, and controls for the selected view |
| Analyze | Zonal Lumens, BUG Rating, CU Table, CIE Classification, Copy Photometric Summary, Utilities |
| Compare | Active luminaire A, selected luminaire B, Choose Luminaire |
| Reports | Report Type, Print / Save PDF, Export HTML |

## 1. Record a baseline

- [x] Run the frontend and desktop app. Capture the default view and the 2D plot at 1400 × 900 and 900 × 600. Repeat the smaller layout at 130% UI scale.
- [x] Inventory ribbon, viewer, and dialog actions in `src/App.vue` and `src/components/`. Map each action to its proposed location before removing duplicate controls.
- [x] Exercise the current file open/save, sample, graph, analysis, comparison, conversion, and report flows. Record which plot settings survive view switches and identify where the ribbon and viewer can disagree.

## 2. Build the compact ribbon and migrate Visualize

- [x] In `src/App.vue`, make Visualize the initial tab with 3D Candela Web selected. Keep the selected workspace separate from the File tab so a file operation can be reached without hiding the current workspace.
- [x] In `src/components/RibbonToolbar.vue` and `src/style.css`, create one compact command row below the tabs. Preserve the existing surface and graph color tokens. Move lower-priority commands into a labeled **More** menu as space runs out. Keep primary controls legible and focusable.
- [x] Add one selector for **3D Candela Web**, **2D Candela Plot**, and **Iso-illuminance**. Remove their old tabs and Home shortcuts as their replacements become available.
- [x] Put **Solid / Wireframe** and an **Overlays** menu for axes and rings in the Visualize ribbon. Keep camera reset next to the 3D canvas.
- [x] In `src/components/Polar2DViewer.vue`, make plot mode and plane controlled by the workspace and remove their duplicate viewer controls. Keep graph zoom and **Fit** beside the graph, with one clear reset action. Keep the selected plot mode and plane when switching visualization views.
- [x] Connect the ribbon's **Illuminance Units** control to `src/components/IsoIlluminanceViewer.vue` and remove the duplicate unit selector.
- [x] Verify that plot mode updates immediately, each plane draws correctly, 3D options persist when changing views, and units and legends update together.

## 3. Consolidate File and Analyze

- [x] Replace Home with **File**. Reuse the existing handlers for **New Luminaire**, **Open**, **Save IES**, **Edit Luminaire**, **Export LDT**, and **Library**. Move the downlight, roadway, and floodlight examples under **Samples**.
- [x] Add **Ctrl/Cmd+O** and **Ctrl/Cmd+S** using the existing file handlers. Check that the shortcuts respect modal focus and that keyboard handlers are cleaned up on unmount.
- [x] Move **Zonal Lumens**, **BUG Rating**, and **CU Table** into Analyze view selection. Selecting Analyze opens its last-used view, with Zonal Lumens as the initial choice. Keep **CIE Classification** as a details action and **Convert Type B/C** under **Utilities**.
- [x] Keep a single **Copy Photometric Summary** command in Analyze. Show successful copy feedback after the clipboard write resolves and surface failures where the user can see them.
- [x] Verify that File preserves the visible workspace, that CU Table stays under Analyze, and that file import, editing, saving, export, and conversion still use the existing data paths.

## 4. Bring Compare and Reports into the same layout

- [x] Replace the redundant **Side-by-Side** button with **Choose Luminaire**. Make the active document luminaire A. Use one selected source for B across file, library, and sample choices. Keep the two filenames visible and preserve the library's **Compare** entry point.
- [x] In `src/components/LuminaireCompare.vue`, ensure switching from a library fixture to a sample replaces B and updates its name, plotted curve, and metrics together.
- [x] Give Reports one **Report Type** selector for Indoor, Roadway, and Floodlight. Place **Print / Save PDF** and **Export HTML** next to the preview. Remove **Report View** and the repeated CIE command from Reports.
- [x] Verify that all three report types render, print without application controls, and export standalone HTML. Compare B using a file, a library entry, and a sample in succession.

## 5. Standardize display settings, inspector, and dialogs

- [x] Replace the View tab and titlebar theme toggle with a **Display** menu at the right of the tab strip. Put **Show Inspector**, **Theme**, **UI Scale**, and **Status Bar** in that menu. Keep a local close control on the inspector itself.
- [x] Put lumens, watts, efficacy, and peak candela first in the inspector. Group identity and geometry into collapsible sections. Move legacy engine details to About and use the status bar for file and operation feedback.
- [x] Standardize button styles, spacing, labels, focus indicators, and dialog action order using existing theme tokens. Use **Apply** for in-memory edits and **Save IES** for writing a file. Give icon buttons accessible names.
- [x] Implement arrow-key navigation and programmatic selected states for tabs. Check menu dismissal with Escape, focus return after dialogs close, and visible selection in both themes.

## 6. Verify the full workflow

- [x] Run `npm run build` from the repository root. Run `cargo check` from `src-tauri/`. Resolve any failures introduced by the changes.
- [x] Check 1400 × 900 and 900 × 600 in light and dark themes at 100% and 130% UI scale. Confirm that required actions remain visible or reachable through labeled menus and that switching views leaves enough room to use the workspace.
- [x] Run one end-to-end workflow using only the keyboard. Open an IES or LDT file, switch to Cartesian and select a plane, open CU Table, compare a second luminaire, and print or save a PDF.
- [x] Validate new, edit, save, LDT export, conversion, library, samples, BUG, CIE, Iso-illuminance, and HTML export. Compare representative outputs with the baseline to catch changes in values, units, and file contents.

The redesign is complete when all five tabs have distinct roles, plot controls appear once, and users can complete the end-to-end workflow at the minimum window size and 130% UI scale.

## Implementation status (25 November 2026)

**Complete.** All ribbon redesign checklist items are implemented and verified. See the [baseline captures and action inventory](docs/ui-baseline/README.md) and [acceptance evidence](docs/ui-verification/README.md).

### Verification completed

- `npm test`, `npm run build`, `cargo check`, and `git diff --check` passed. The frontend retains its existing large-chunk warning.
- The full browser matrix covered 136 states across both requested sizes, themes, and scales, including all six dialogs. Ribbon/dialog controls remained reachable; dialog focus, Tab wrapping, Escape dismissal, and focus return passed. Minimum-size screenshots are retained in both themes.
- The actual desktop keyboard-only workflow completed at 900 × 600 / 130%: native IES file selection, Cartesian and 90° plane selection, CU Table, comparison, and native Print to File including the filename chooser. The resulting one-page A4 PDF and its rendered inspection are retained.
- New, Edit, IES open/save, LDT export, conversion save/apply, library import/search/load, samples, BUG, CIE, clipboard summary, illuminance units, and all report/HTML flows were checked. Comparison B updated from a file to a library fixture to a sample.
- Plot settings survive view changes. Illuminance unit changes preserve physical mounting height and update the legend. Existing 3D setting persistence was retained.
- All three built-in fixtures match the original commit for complete calculated results and unedited IES serialization. LDT non-metadata fields match; metadata uses source fixture values rather than fallback values.
- Twelve baseline captures cover the original browser and actual desktop interface, at 1400 × 900 / 100%, 900 × 600 / 100%, and 900 × 600 / 130%, in default and 2D views. The original workflows were exercised and their action mapping recorded. The original Cartesian ribbon / Polar viewer disagreement was reproduced.
- Dialog headers, footers, action buttons, and close buttons now use consistent theme tokens and spacing. File input labels and filters accurately offer IES. Dark-theme print margins and report heading/badge spacing were corrected and rechecked.

### Separate limitations

- LDT import was absent in the original repository and remains unsupported. Unsupported content is rejected; LDT export remains available.
- The existing Type C → B converter changed a generated sample's integrated flux from 3,653 lm to 1,205 lm at 5° sampling. Its algorithm was not altered by the ribbon redesign and needs separate engineering validation. The UI advises checking converted flux.
- Desktop verification used Linux/X11. Other operating systems and physical printer drivers were not exercised.
