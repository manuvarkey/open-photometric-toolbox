# Ribbon redesign acceptance evidence

Verified on 25 November 2026 against the working tree based on `41b740a`, including the dialog and printing fixes in this change. Baseline source is `5d321c9`.

## Layout and dialogs

[matrix.json](matrix.json) records 136 browser states: two window sizes (1400 × 900 and 900 × 600), two themes, and two UI scales (100% and 130%), each covering eleven workspace/report views and six dialogs. Chromium rendered the actual Vite application with software WebGL.

All states passed checks for ribbon/dialog controls staying within the viewport, button names, and document overflow. All 48 dialog cases passed initial focus, backward/forward Tab wrapping, Escape dismissal, and return to a visible trigger. Screenshots of all seventeen states at 900 × 600 / 130% are retained for both themes in this directory and were visually reviewed. Scrollable dialog bodies, tables, comparison content, and report previews retain their scroll areas; a report remains a fixed-size paper preview.

The checks cover New, Edit, Library, CIE, Converter, and About. Headers, footers, action buttons, and close buttons share spacing and theme tokens. In-memory editing/conversion actions use Apply; file-writing actions use Save IES. Unsupported LDT input is no longer offered by the open/library filters.

## Workflows and output parity

[workflow.json](workflow.json) records browser workflow checks at 900 × 600 / 130%: IES open/save, both plot modes and every plane, CU, comparison B from file/library/sample, New, Edit, LDT export, conversion save/apply, library import/search/load, BUG, CIE, clipboard summary, illuminance unit/height round trips, and all three report types and standalone HTML exports. No browser page errors were observed. Browser file selection used Playwright at the chooser boundary; the separate native workflow below exercised actual keyboard file selection and PDF saving.

[fixture-parity.json](fixture-parity.json) compares all three built-in fixtures against the baseline. Complete calculated results and unedited IES serialization match exactly. LDT fields outside metadata match exactly; manufacturer, catalog, lamp, and other metadata now use source values instead of fallbacks. These are regression checks, not independent validation of the engineering formulas.

## Native keyboard and PDF

The actual Linux Tauri application was exercised with keyboard events at a 900 × 600 content size and 130% UI scale. After establishing webview focus, the workflow used keyboard input throughout:

1. Display → UI Scale → 130%.
2. Ctrl+O, native file chooser, Ctrl+L, absolute IES path, Enter.
3. Visualize → 2D Candela Plot → Cartesian → 90° Longitudinal.
4. Arrow-key tab navigation to Analyze → CU Table.
5. Compare → Choose Luminaire → Floodlight sample.
6. Reports → Print / Save PDF.
7. In the native print dialog, Tab to the printer list and Home to select Print to File. Tab/Enter opened its filename chooser. Ctrl+A and an absolute temporary PDF filename selected the output; Alt+P completed printing.

[native-keyboard.pdf](native-keyboard.pdf) is the resulting one-page A4 report. [Rendered inspection](native-keyboard.png) confirms that the report, polar graph, CU table, and footer are present, with white margins and no application controls. Text extraction also confirmed the fixture identity and expected values. All three report types were additionally printed through Chromium's print renderer, rendered with Poppler, and visually checked.

Native automation used GTK/X11 accessibility to inspect focus and XTest to send keys. Reading the webview accessibility subtree while the synchronous print dialog was open timed out; completing the print dialog with keyboard events avoided that issue. No physical printer was used. A retry process set `GTK_PRINT_BACKENDS=file`, but the system still enumerated installed printers; Print to File was explicitly selected in the dialog.

Printing from the dark theme initially produced dark page margins. A print-only `color-scheme: light !important` fixes the inherited runtime theme. Report headings now have spacing before the badge, and the badge stays on one line in the preview and exported HTML.

## Gates and limits

- `npm test`: passed metadata and photometry round-trip checks.
- `npm run build`: passed TypeScript checking and production bundling; existing chunk-size warning remains (about 835 kB minified main JavaScript).
- `cargo check`: passed.
- `git diff --check`: passed.

The ribbon acceptance work is complete. LDT import and independent engineering validation of Type C ↔ B conversion remain separate limitations. In particular, the previously recorded generated-fixture Type C → B flux discrepancy was not repaired by these UI changes. Other operating systems and physical printer drivers were not exercised.
