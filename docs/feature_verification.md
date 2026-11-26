# Feature verification — 26 November 2026

Baseline: `5d18755`. Scope and design decisions are in the [implementation plan](feature_implementation_plan.md); [core findings](core_module_findings.md) record the core-only binary investigation. No legacy UI was decompiled. No proprietary binaries, decompiled source, manufacturer fixtures, or build outputs are included in this change.

## Implemented behavior

- Shared physical-direction sampling, signed B/C conversion, type-aware flux integration, symmetry/seam/pole validation, and explicit Type A rejection. Views and analyses use the same sampler. Conversion never rescales intensities to hide integration error. A source's excluded uplight is shown before applying Type B conversion; its LDT ratio metadata is invalidated when clipping changes the distribution.
- Strict LDT reading for all five symmetries, physical normalization, six luminous-area dimensions, multiple lamp sets and absolute photometry; common IES/LDT dispatch in Open, Library and both comparison slots. Browser and native file readers decode UTF-8 with a Windows-1252 fallback. Imported LDT can be re-exported; IES saving uses the correct extension.
- Two independent comparison selectors backed by one session catalog. Current document can follow edits; imported entries retain stable identities even when filenames match.
- Shared themed selectors, SVG icons and inherited system UI fonts. Searchable installed report font selection remains independent of UI typography and persists across view changes.
- SVG polar, Cartesian, comparison, catalog and report curves; SVG iso-illuminance bands replace the heatmap canvas. Immutable-source caches reuse the field and paths for height, units, theme, resize and remounts.
- Optional tool chunks load on demand with loading and recovery states. The default view remains 3D.

## Verification results

`npm test`, `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml` and `git diff --check` pass. The browser workflow and production loading checks pass. Detailed measured output is retained in [feature-verification.json](feature-verification.json).

| Check | Evidence/result |
| --- | --- |
| Analytic flux | Constant sphere `4πI`, C/B hemispheres `2πI`, cosine distribution `πI₀`; nonuniform planes, closure, signed landmarks and asymmetric directions tested |
| Conversion | Analytic 3,600 lm source: output errors 2, 0, 0 lm at 5°, 2.5°, 1° respectively (displayed integer lumens); IES save/reopen retains signed axes and candela |
| Field accuracy | 121 × 121 Lambertian field interpolated at independent off-grid positions differs by at most 0.492% of peak in the sampled check; analytic point and finer-grid checks also pass |
| Contours | Zero field, annular hole, disconnected lobes and closed finite paths tested; all 2D geometry remains vector |
| LDT | Independent hand-authored fixtures cover Isym 0–4, factors, geometry, feet, absolute/multiple lamp sets, malformed records and round trips |
| UI matrix | 1400 × 900 and 900 × 600, dark/light, 100%/130%: eight configurations; controls, dialogs, selectors and vector views pass |
| Workflows | Independent A/B imports, Library targeting, LDT/IES export, all six new presets, dialog focus/Escape, unit/height geometry reuse, report preference persistence and browser font permission denial pass |
| Fonts/PDF | Browser font API success is mocked with actually installed DejaVu families; DejaVu Serif reaches all three HTML/PDF reports. `pdffonts` confirms embedding. Three A4 PDFs rendered and visually inspected; report title/badge overflow was repaired |
| Native fonts | Linux font-kit enumeration through the declared native capability returned 435 installed families in the isolated desktop session. DejaVu Serif was selected with the keyboard and embedded in the native one-page A4 PDF |
| Production loading | Startup requests shell + 3D only; illuminance/report chunks arrive on first use. Reopening uses cached chunks. An aborted report chunk produces a recovery message/button |

The PDF screenshots and raw downloaded fixtures are temporary verification artifacts under `/tmp/photometric-ui-checks` and `/tmp/photometric-verification`. They are not dependencies of the tests.

## Performance and bundle

| Measurement | Before | After |
| --- | ---: | ---: |
| Sample heatmap / field + contours | 497.3 ms | cold 9.1 ms; warm median 4.0 ms |
| Dense 181 × 73 heatmap / field + contours | 2,720.2 ms | cold 6.7 ms; warm median 5.4 ms |
| Shell JavaScript | 835,162 bytes | 339,974 bytes |
| Shell gzip | 219,268 bytes | 105,935 bytes |
| 3D chunk | included in shell | 474,433 bytes; 120,547 gzip |
| Chunk-size warning | present | absent; threshold unchanged |

Timings are Chromium/headless software-WebGL measurements on the same machine. Before measures pixel heatmap generation; after measures field plus contour path generation, not complete paint latency. The dense benchmark retains the same grid dimensions but corrects inconsistent pole values in the old synthetic fixture. Height/unit/theme changes reuse geometry rather than building it again.

Shell size falls about 60%; the default 3D view still needs both shell and 3D chunks: approximately 814.4 kB raw / 226.5 kB gzip of JavaScript. This is a small raw startup reduction and a small gzip increase compared with the old monolith, **not** a 60% total startup reduction. All built JavaScript totals approximately 902.6 kB; optional features load when requested. The focused contour dependency is included in the approximately 11.1 kB illuminance chunk.

## Manufacturer interoperability provenance

Source: [SPX Lighting LDT photometry](https://www.spx-lighting.com/en/ldt-photometry/), [ILYAD F TW download](https://www.spx-lighting.com/telechargement/photometries_ldt_ilyad_f_tw/?tmstv=1667831848). Two independently supplied Windows-1252 files identify LEDiL Oy / ILYAD F TW 42° and 61° 2700K. Both parse as 361 vertical × 73 horizontal planes including closure. Parsed/re-exported/reopened totals remain 2,466 and 2,473 lm, with zero sampled candela difference. SHA-256 values are retained in the JSON record. The fixture files remain outside the repository; repository test fixtures are clearly identified synthetic data.

## Remaining limits and verification gaps

- **IES-to-LDT export remains gated:** no independently validated generator for the ten LITG room-index direct ratios has been established. LDT sources retain supplied ratios; an export lacking them produces an actionable error. No guessed ratios or “unknown” zeros are written. This is the unresolved formula dependency from the plan, not an import limitation.
- Type A directional analysis and non-NONE IES tilt data are rejected explicitly. This change does not validate unrelated CU/UGR/roadway classifications against a complete standards certification suite.
- The Linux native keyboard workflow now covers a Windows-1252 manufacturer LDT, Cartesian/plane selection, independently selected A/B sources, a real installed report family and native Print to File. The rendered one-page A4 PDF was inspected and `pdffonts` confirms DejaVu Serif embedding. Windows/macOS native font enumeration and PDF output have not been run here.
- HTML references the chosen local font with a fallback; recipients need that installed family. Font bytes are not bundled in HTML. Browser discovery depends on Local Font Access support and explicit permission.

## Native follow-up findings

The new application ACL initially allowed font enumeration but omitted the existing native file commands. Actual native Open exposed `read_photometric_file not allowed`. Explicit read/save permissions are now declared in the main-window capability. Native errors remain visible in the status bar instead of silently reopening a browser file picker.

File and Converter exports share one save service: desktop uses the native chooser and write command, browser uses a download, and cancellation preserves the document. Previously LDT and Converter export used only browser anchors. A native I/O smoke script exercises real read, save, reopen and cancellation. Long manufacturer lamp identifiers also exposed unequal report columns; bounded columns and wrapping now apply to preview, HTML and PDF, with a browser regression check.

## CU direct-ratio correction

A follow-up core review found that the IES CU approximation omitted the first zone multiplier, shifted the remaining coefficients and discarded the 80°–90° contribution. All nine zones now map to their proper multipliers. Relative CU is normalized to rated lamp flux; absolute CU uses emitted flux, and zero-output data produces zero CU. `tests/cu-direct-ratio.mjs` isolates every zone through the black-ceiling/black-wall CU column at RCR 1, 5 and 10, and checks mixed flux, upward flux, relative/absolute normalization and zero output. These intentionally change affected CU/report values; flux, conversion and graph geometry are unchanged. See the [investigation and comparison evidence](direct_ratio_investigation.md).

## LDT compatibility after editing

The reader now accepts and preserves the `Ityp = 0` point-source indicator documented in [AGi32's EULUMDAT format reference](https://docs.agi32.com/PhotometricToolbox/Content/Open_Tool/eulumdat_file_format.htm). This is an LDT source classification, separate from the IES photometric coordinate type. Values below zero or above three remain invalid.

Uniform candela scaling, multiplier changes and lamp-normalization edits refresh derived DFF/LOR metadata through a pure format-layer helper. Changed absolute photometry receives a new physical normalization flux, including relative/absolute transitions. Identity-only edits retain the supplied source metadata. Supplied direct ratios remain unchanged because these uniform edits preserve the angular distribution shape; arbitrary distribution editing is outside this helper's contract.

Export rejects a light-output ratio above 100% before any save starts. Independent analytic fixture checks cover intensity, multiplier and lamp-flux edits, relative/absolute changes, immutable source metadata and parser/writer round trips. The browser editor-to-export check verifies refreshed metadata from an actual Apply action. The full eight-case UI matrix and production loading checks pass; the updated indoor PDF was rendered and inspected.

## GEstimator typography, ribbon and SVG interaction follow-up

GEstimator's local `modern/src/appearance.ts`, native GTK typography code, ribbon component and effective ribbon styles were used as references; that repository was not changed. The application now resolves interface fonts from GTK/Pango on Linux, observes GTK font-name changes, and uses CSS `font: menu` with a fallback on other WebViews. Controls inherit the resulting family and size. Report font selection remains independent. The new read-only `desktop_font` command has an explicit permission; existing font enumeration and file permissions remain present.

The compact command strip has been replaced by grouped ribbon actions with 24 px icons, measured two-line captions, font-dependent depth, reference spacing and square inset hover outlines. Narrow layouts can arrange commands into rows while retaining accessible labels. The display menu and independent A/B selectors remain available.

Candela plots already contained SVG paths, but the old zoom used a CSS-transformed stage with `will-change: transform`. Polar and Cartesian plots now zoom and pan through SVG `viewBox` coordinates, avoiding that compositing path. Iso-illuminance shares the same camera and zoom controls: cursor-anchored wheel zoom, 40%–500% buttons, captured-pointer dragging and Fit. Cartesian and illuminance readouts use inverse SVG screen coordinates. Camera operations leave plotted paths and cached field geometry unchanged.

`tests/svg-interaction.mjs` verifies all three cameras, pointer anchoring, hover after zoom, drag/Fit, zoom limits, unchanged geometry, absence of raster plot content, and font changes without changing the selected report family. The existing eight-case size/theme/scale matrix passes with the grouped ribbon. Production loading and core tests pass. Native Linux testing observed the configured **Iosevka 11** font in the interface; the native read/save/reopen/cancellation smoke test also passed after adding the desktop-font permission. Windows/macOS native typography was not exercised; those platforms currently use the WebView menu-font fallback.

Run the SVG interaction check against the development server with `node tests/svg-interaction.mjs`; it accepts the same `PHOTOMETRIC_CHROMIUM` and `PHOTOMETRIC_ARTIFACTS` variables as the other browser checks.

## Direct-ratio dependency clarified

The [official LiTG 3.5 summary](https://www.litg.de/media/19228.3.5_Kurzfassung_Wirkunsgradverfahren) identifies a zonal-multiplier method for point-like sources and a strip method for linear sources. It assumes a defined distribution of luminaires in a rectangular room. This confirms why substituting `RCR = 5/k` into the existing IES approximation does not establish equivalence. The public summary does not supply the needed multipliers, strip rules or independent numerical cases. The [publisher catalogue](https://www.litg.de/Weiterbildung/LiTG-Publikationen.html) lists the full 1988 publication, ISBN 978-3-927787-01-8, with member-restricted download. No purchase or third-party contact was made. Generation remains gated until those definitions and reference cases are available; imported direct ratios continue to be preserved.

## Reproduction

```bash
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npx playwright install chromium
npm run test:ui
node tests/production-loading.mjs
node tests/illuminance-performance.mjs
git diff --check
```

For Linux native I/O, run `cargo build --manifest-path src-tauri/Cargo.toml`, start the app and Vite on an isolated X11 display/session, then `/usr/bin/python3 tests/native-io.py [source.ldt]`. The script needs Python GI/AT-SPI, XTest and `xwininfo`; it uses temporary files and does not print. The verification session used Xvfb unpacked under `/tmp`, without a system install. Native PDF verification separately used GTK Print to File.

Set `PHOTOMETRIC_CHROMIUM` to use an existing Chromium executable and `PHOTOMETRIC_ARTIFACTS` to choose an output directory. Browser UI tests use a development server; production loading tests start an isolated local preview after the build.
