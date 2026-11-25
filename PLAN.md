# Ribbon redesign implementation plan

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

- [ ] Run the frontend and desktop app. Capture the default view and the 2D plot at 1400 × 900 and 900 × 600. Repeat the smaller layout at 130% UI scale.
- [ ] Inventory ribbon, viewer, and dialog actions in `src/App.vue` and `src/components/`. Map each action to its proposed location before removing duplicate controls.
- [ ] Exercise the current file open/save, sample, graph, analysis, comparison, conversion, and report flows. Record which plot settings survive view switches and identify where the ribbon and viewer can disagree.

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
- [ ] Standardize button styles, spacing, labels, focus indicators, and dialog action order using existing theme tokens. Use **Apply** for in-memory edits and **Save IES** for writing a file. Give icon buttons accessible names.
- [x] Implement arrow-key navigation and programmatic selected states for tabs. Check menu dismissal with Escape, focus return after dialogs close, and visible selection in both themes.

## 6. Verify the full workflow

- [x] Run `npm run build` from the repository root. Run `cargo check` from `src-tauri/`. Resolve any failures introduced by the changes.
- [ ] Check 1400 × 900 and 900 × 600 in light and dark themes at 100% and 130% UI scale. Confirm that required actions remain visible or reachable through labeled menus and that switching views leaves enough room to use the workspace.
- [ ] Run one end-to-end workflow using only the keyboard. Open an IES or LDT file, switch to Cartesian and select a plane, open CU Table, compare a second luminaire, and print or save a PDF.
- [ ] Validate new, edit, save, LDT export, conversion, library, samples, BUG, CIE, Iso-illuminance, and HTML export. Compare representative outputs with the baseline to catch changes in values, units, and file contents.

The redesign is complete when all five tabs have distinct roles, plot controls appear once, and users can complete the end-to-end workflow at the minimum window size and 130% UI scale.

## Implementation status (25 November 2026)

**In progress; paused.** The five-tab shell, compact ribbon, workspace-controlled plot settings, File and Analyze commands, comparison selection, report controls, Display menu, and inspector reorganization are implemented. The checklist above remains the source of truth for completed and outstanding plan steps.

### Verification completed

- `npm test`, `npm run build`, and `cargo check` passed on 25 November 2026. The frontend build reports a large-chunk warning.
- The browser layout was inspected at 1400 × 900 and 900 × 600 in both themes at 100% and 130% scale. At the minimum size, the 3D, 2D, illuminance, BUG, CU, comparison, report, and main dialog layouts were inspected; CU supports keyboard horizontal scrolling. The full dialog and workflow matrix remains open.
- The asymmetric roadway sample was checked in both plot modes and all plane selections. Plot mode, plane, 3D settings, and illuminance units survive view changes. Switching feet/footcandles to metres/lux preserves mounting height and updates the heatmap readout and legend.
- New and edited luminaires, IES open/save, LDT export, conversion, library, sample selection, BUG, CIE, and HTML report flows were exercised. Comparison B was changed from a file to a library fixture to a sample; its name, curve, and metrics updated together. All three report types appeared in isolated desktop print previews and exported standalone HTML.
- The three built-in fixtures matched the committed baseline for lumens, efficacy, peak candela, BUG, zonal and CU values, and unedited IES serialization. LDT numeric content matched; metadata now reflects the source fixture instead of generic fallback values.
- Ctrl+O and Ctrl+S worked in the browser and were suppressed while a modal was open. Tab arrow navigation, Escape dismissal, focus return, and a partial keyboard path through CU and comparison were checked. A complete keyboard-only run through file selection and PDF output has not been completed.
- The original browser and desktop interfaces were inspected at both requested sizes and at 130% scale. Two desktop captures from 900 × 600 at 130% are saved in [docs/ui-baseline](docs/ui-baseline/README.md); the remaining requested capture artifacts and a complete baseline flow inventory are outstanding. The original ribbon could indicate Cartesian while the current graph remained polar until a view switch.

### Remaining work and known limitations

- Finish and retain the complete baseline capture set and baseline action/flow inventory. The temporary untracked `.baseline-ui/` copy was used for baseline inspection; its recursive removal was rejected by the environment's automatic policy review. Do not commit it.
- Finish standardizing and verifying dialog controls and focus behavior, complete the responsive matrix after the latest changes, and perform the full keyboard-only workflow including saving a PDF. Desktop print previews worked, but automation could not target the system Save As dialog to finish the test PDF.
- Validate the remaining full workflow and compare representative outputs after the latest changes. The metadata round-trip test covers IES keywords, angles, candela, lumens, and LDT metadata.
- LDT import was not implemented in the original repository. The application now reports an error instead of loading LDT as empty IES data; LDT export remains available.
- The existing Type C → B converter changed a generated sample's integrated flux from 3,653 lm to 1,205 lm at 5° sampling. Its algorithm was not altered by this refactor and needs separate engineering validation. The UI now advises checking converted flux.
