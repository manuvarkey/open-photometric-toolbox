# Ribbon action and flow inventory

Reviewed against the original `src/App.vue` and viewer/dialog components at `5d321c9`, before comparing them with the redesigned workspace on 25 November 2026.

| Original location and actions | Final location |
| --- | --- |
| Home: New IES, Open File, Save IES, Export LDT, Edit IES | File: New Luminaire, Open, Save IES, Export LDT, Edit Luminaire; secondary actions move into More when space is limited |
| Home and Analysis: Catalog | File: Library; Compare → Choose Luminaire → Library |
| Home and Analysis: Convert B/C | Analyze → Utilities → Convert Type B/C |
| Home: Downlight, Roadway, Floodlight | File → Samples |
| Home shortcuts and separate 3D Web, Polar 2D, Iso Template tabs | Visualize → View selector |
| 3D Web: Solid Mesh, Wireframe | Visualize → Rendering selector |
| 3D Web: Polar Rings, 3D Axes | Visualize → Overlays |
| 3D viewer: Reset View, orbit, pan, wheel zoom | Retained beside/in the 3D canvas |
| Polar 2D ribbon and viewer: Polar/Cartesian, All/Max/0°/90° planes | Visualize → Plot and Plane selectors; one owner for each setting |
| 2D viewer: zoom out, reset zoom, zoom in, Fit, drag pan | Retained beside/in the graph; Fit is the reset action |
| Iso Template viewer: mounting height and units | Height stays beside the heatmap; units move to Visualize |
| Analysis: Simpson Zonal, TM-15 BUG; separate CU Table tab | Analyze → View: Zonal Lumens, BUG Rating, CU Table |
| Analysis, CU Table, Reports, inspector: CIE Class | Analyze → CIE Classification; inspector retains its contextual details action |
| Polar 2D, Iso Template, Analysis: Copy Data | Analyze → Copy Photometric Summary |
| Polar 2D and Analysis: Export LDT | File → Export LDT |
| Compare: Side-by-Side; viewer sample selector; library Compare | Compare: filenames A/B and Choose Luminaire (file, library, sample); library Compare retained |
| Home Reports shortcut; Reports: Report View and CIE Class | Reports tab opens preview directly; repeated CIE action removed |
| Report viewer: three report buttons, Print/Save PDF, HTML export | One Report Type selector and the two export actions beside the preview |
| Home, 3D Web, View: inspector toggles; inspector close | Display → Show Inspector; local close retained |
| Titlebar theme toggle; View: theme, UI zoom/presets, status bar | Display → Theme, UI Scale, Status Bar |
| Titlebar: About and native window controls | Retained; About contains legacy engine details |
| New dialog: six presets, profile fields, Cancel, Create & Load | Retained; simplified title and consistent action styling |
| Edit dialog: identity, electrical/geometry fields, candela scaling, Cancel, Apply Changes | Retained; action named Apply |
| Converter: target type, sampling, IES/LDT downloads, Apply | Retained; file actions named Save IES / Export LDT, in-memory action named Apply |
| Library: import, search, category, sort, Open, Compare, Close | Retained; supported input labeled Import IES Files |
| CIE dialog: flux details, copy, Done; dialog close/backdrop | Retained; shared button spacing, named close buttons, global focus indicator and focus management |

## Baseline flow observations

The original browser was exercised for IES open/save, LDT export, all three samples, graph/view switching, BUG, CIE, CU, sample/library comparison, New, Edit, conversion save/apply, and all three HTML reports. [Recorded checks](flows.json) identify that source commit. Original and redesigned fixture outputs were separately compared in [fixture-parity.json](../ui-verification/fixture-parity.json).

- The original ribbon could select Cartesian while the mounted viewer remained Polar. This was reproduced: the viewer initialized its own mode from a prop without tracking later ribbon changes.
- Viewer-local plot changes did not update the ribbon's mode. Remounting the viewer restored the ribbon-owned value. The redesigned plot uses controlled mode and plane props.
- The original 3D rendering and overlay refs lived in the shell, so view changes preserved them. That behavior is retained.
- The original illuminance units and mounting height lived in the viewer and reset on remount. They now live in the shell; unit changes preserve physical height.
- The original comparison could retain library data while its local sample selector displayed another selection. The redesigned shell supplies one source for B.
- Both versions use the existing calculation engine and conversion algorithm. Conversion smoke checks establish that controls and file output work; they do not establish mathematical accuracy.
- LDT import was advertised but had no parser. The redesign rejects unsupported content, and input labels/filters now offer IES. LDT export remains available.
