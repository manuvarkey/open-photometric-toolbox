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
| Native fonts | Linux font-kit enumeration through the declared native capability returned 688 installed family options. Rust host builds with the new byte decoding and enumeration commands |
| Production loading | Startup requests shell + 3D only; illuminance/report chunks arrive on first use. Reopening uses cached chunks. An aborted report chunk produces a recovery message/button |

The PDF screenshots and raw downloaded fixtures are temporary verification artifacts under `/tmp/photometric-ui-checks` and `/tmp/photometric-verification`. They are not dependencies of the tests.

## Performance and bundle

| Measurement | Before | After |
| --- | ---: | ---: |
| Sample heatmap / field + contours | 497.3 ms | cold 9.1 ms; warm median 4.0 ms |
| Dense 181 × 73 heatmap / field + contours | 2,720.2 ms | cold 6.7 ms; warm median 5.4 ms |
| Shell JavaScript | 835,162 bytes | approximately 336,411 bytes |
| Shell gzip | 219,268 bytes | approximately 104,194 bytes |
| 3D chunk | included in shell | 474,433 bytes; 120,547 gzip |
| Chunk-size warning | present | absent; threshold unchanged |

Timings are Chromium/headless software-WebGL measurements on the same machine. Before measures pixel heatmap generation; after measures field plus contour path generation, not complete paint latency. The dense benchmark retains the same grid dimensions but corrects inconsistent pole values in the old synthetic fixture. Height/unit/theme changes reuse geometry rather than building it again.

Shell size falls about 60%; the default 3D view still needs both shell and 3D chunks: approximately 810.8 kB raw / 224.7 kB gzip of JavaScript. This is a small raw startup reduction and a small gzip increase compared with the old monolith, **not** a 60% total startup reduction. All optional feature JavaScript totals approximately 897 kB; only requested features are loaded. The focused contour dependency is included in the approximately 10.4 kB illuminance chunk.

## Manufacturer interoperability provenance

Source: [SPX Lighting LDT photometry](https://www.spx-lighting.com/en/ldt-photometry/), [ILYAD F TW download](https://www.spx-lighting.com/telechargement/photometries_ldt_ilyad_f_tw/?tmstv=1667831848). Two independently supplied Windows-1252 files identify LEDiL Oy / ILYAD F TW 42° and 61° 2700K. Both parse as 361 vertical × 73 horizontal planes including closure. Parsed/re-exported/reopened totals remain 2,466 and 2,473 lm, with zero sampled candela difference. SHA-256 values are retained in the JSON record. The fixture files remain outside the repository; repository test fixtures are clearly identified synthetic data.

## Remaining limits and verification gaps

- **IES-to-LDT export remains gated:** no independently validated generator for the ten LITG room-index direct ratios has been established. LDT sources retain supplied ratios; an export lacking them produces an actionable error. No guessed ratios or “unknown” zeros are written. This is the unresolved formula dependency from the plan, not an import limitation.
- Type A directional analysis and non-NONE IES tilt data are rejected explicitly. This change does not validate unrelated CU/UGR/roadway classifications against a complete standards certification suite.
- The final native keyboard-only LDT→comparison→selected-font PDF workflow has not been completed. Native font enumeration was observed, and browser HTML/PDF outputs were checked, but those are separate evidence. Native byte decoding compiles; final end-to-end native LDT decoding remains a verification gap. No Windows/macOS font enumeration or native PDF run was performed here.
- HTML references the chosen local font with a fallback; recipients need that installed family. Font bytes are not bundled in HTML. Browser discovery depends on Local Font Access support and explicit permission.

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

Set `PHOTOMETRIC_CHROMIUM` to use an existing Chromium executable and `PHOTOMETRIC_ARTIFACTS` to choose an output directory. Browser UI tests use a development server; production loading tests start an isolated local preview after the build.
