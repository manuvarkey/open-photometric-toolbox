# Standards and technical references for further work

Reference list checked against publisher listings on 26 November 2026. Priorities reflect this project's implementation and validation needs; not every listed publication is a formal standard or an immediate prerequisite.

**LiTG Publication 3.5 is the immediate blocker for automatic IES-to-LDT direct-ratio generation.** The other references support independent validation or extension of calculations, file compatibility and reports.

## Priority list

| Priority | Standard or technical reference | Required for |
| --- | --- | --- |
| **1 — Immediate** | **[LiTG Publication 3.5, fifth edition, 1988](https://www.litg.de/Weiterbildung/LiTG-Publikationen.html)** — *Projektierung von Beleuchtungsanlagen nach dem Wirkungsgradverfahren*. ISBN **978-3-927787-01-8** | LDT direct ratios: point-source zonal multipliers, linear-source strip method, room/layout assumptions, normalization and worked examples. The full publication is needed, not its summary. |
| **2 — Core calculations** | **[ANSI/IES LS-6-20(R25)](https://store.ies.org/product/lighting-science-calculation-of-light-and-its-effects/)** — *Calculation of Light and Its Effects* | Authoritative CU, flux-transfer and illuminance equations, particularly Annex A. |
| **2 — Coordinate systems** | **[ANSI/IES LM-75-19](https://store.ies.org/product/lm-75-19-approved-method-guide-to-goniometer-measurements-and-types-and-photometric-coordinate-systems/)** — *Goniometer Measurements and Types, and Photometric Coordinate Systems* | Independent validation of B/C conversion, future Type A support, coordinate conventions and zonal integration. Annexes A and B are particularly relevant. |
| **2 — File compatibility** | **[ANSI/IES LM-63-19(R25)](https://store.ies.org/product/approved-method-ies-standard-file-format-for-the-electronic-transfer-of-photometric-data-and-related-information/)** — *Electronic Transfer of Photometric Data* | Newer IES format support, keywords, absolute photometry and currently unsupported TILT records. Retain **LM-63-2002** for the existing writer's compatibility target. |
| **3 — Glare calculation** | **[CIE 117-1995](https://www.cie.co.at/publications/discomfort-glare-interior-lighting)** — *Discomfort Glare in Interior Lighting* | UGR equations, observer geometry and position factors. |
| **3 — Glare tables** | **[CIE 190:2010](https://www.cie.co.at/publications/calculation-and-presentation-united-glare-rating-tables-indoor-lighting-luminaires)** — *Calculation and Presentation of UGR Tables* | Standard room/array conditions and a worked example suitable for validating software-generated UGR tables. |
| **3 — BUG ratings** | **[ANSI/IES TM-15-20](https://store.ies.org/product/tm-15-20-technical-memorandum-luminaire-classification-system-for-outdoor-luminaires/)** — *Luminaire Classification System for Outdoor Luminaires* | LCS zones and BUG thresholds, including Annex A. Keep the **[2011 BUG addendum](https://www.ies.org/wp-content/uploads/2017/03/TM-15-11BUGRatingsAddendum.pdf)** for comparison with the application's existing claims. |
| **3 — Roadway reports** | **[ANSI/IES RP-8-25 + E2](https://store.ies.org/product/recommended-practice-lighting-roadway-and-parking-facilities/)** — *Lighting Roadway and Parking Facilities* | Roadway calculation and report validation. |
| **4 — Independent benchmarks** | **[CIE 171:2006](https://www.cie.co.at/publications/test-cases-assess-accuracy-lighting-computer-programs)** — *Test Cases to Assess the Accuracy of Lighting Computer Programs* | Published reference cases for systematic calculation-engine validation. |

## Additional references

- **[CIE 040-1978](https://www.cie.co.at/publications/calculations-interior-lighting-basic-method)** and **[CIE 052-1982](https://cie.co.at/publications/calculations-interior-lighting-applied-method)** — European interior-lighting calculation methods.
- **[EN 13032-2:2017](https://knowledge.bsigroup.com/products/light-and-lighting-measurement-and-presentation-of-photometric-data-of-lamps-and-luminaires-presentation-of-data-for-indoor-and-outdoor-work-places-1)** — European photometric data presentation and reporting.
- **[ANSI/IES LM-35-20(R2023)](https://ies.org/individual-standards/)** — legacy floodlight photometry; its stated scope is HID and incandescent sources.

## Acquisition and validation order

Obtain **LiTG 3.5 first**. For broader mathematical validation, prioritize **LS-6, LM-75, CIE 117 and CIE 190** next.

For LiTG implementation, retain the applicable point/linear definitions, room dimensions and arrangement rules, normalization convention, multiplier/strip equations and independent worked numerical cases for the ten room indices. The existing IES approximation is not an established substitute: see the [direct-ratio investigation](direct_ratio_investigation.md).

Keep historical editions needed to reproduce existing behavior alongside newer editions. Introduce changed formulas, thresholds or file conventions explicitly, with versioned expectations and regression cases. Publisher catalogue descriptions establish relevance; obtaining a publication does not itself establish implementation compliance.

See the [implementation plan](feature_implementation_plan.md) and [verification record](feature_verification.md) for current coverage and remaining gaps.
