# Direct-ratio follow-up

Status: **CU zone mapping and normalization repaired; automatic LiTG direct-ratio generation remains unvalidated.** This follows the planned core-only investigation, not a new UI feature or an approximate exporter.

## Confirmed CU defect and repair

`computeCUTable` used eight coefficient pairs starting with the pair for the second downward zone. It therefore attenuated 0°–10° with the 10°–20° multiplier, shifted every following pair, and omitted 80°–90° altogether. The first zone instead has multiplier one; nine zones must contribute.

The nine-zone mapping is independently corroborated by Ferial Shayeganfar's TU Wien doctoral thesis, *Application of Semantic Web Material Libraries in AEC Context* (2009), Listing 4.5 on printed pp.87–88 / PDF pp.99–100. The author's CU implementation identifies its coefficient source as the IESNA Lighting Handbook, eighth edition, Fig.9-27. The [university-hosted PDF](https://repositum.tuwien.at/bitstream/20.500.12708/13645/2/Shayeganfar%20Ferial%20-%202009%20-%20Application%20of%20semantic%20web%20material%20libraries%20in...pdf#page=99) was downloaded and the coefficient page visually checked; the following page also confirms lamp-flux normalization. SHA-256: `06417a23283d26ffca71f53b8b927d5474bca413370ff5386602c28ea976dd96`.

The previously decompiled **core** method `LAICalcNET.Module1.gsbCalcZonalLumens2` independently has the same nine indexed entries. No additional UI code was inspected or decompiled. Neither that method nor the thesis establishes LiTG equivalence.

The repair inserts the missing first pair and iterates over all nine pairs. It also supplies rated lamp flux to the relative-photometry CU denominator; absolute photometry uses emitted flux. The transfer equations themselves are unchanged. The new regression check first failed on the old implementation: a source emitting solely into 0°–10° returned CU 0.96 rather than 1.00 at RCR 1 with black ceiling/walls. It now passes. A source emitting solely into 80°–90° gives 0.12 at RCR 1 instead of zero. The black-ceiling/black-wall column isolates the direct component because reflected floor light is absorbed above it.

A second regression first failed with CU 1.00 instead of 0.63 for a uniform 100 cd downward source with 1,000 rated lamp lumens. The corrected result includes the fixture efficiency. The same absolute-photometry web gives CU 1.00, while zero-output data gives zero CU throughout the table.

The test covers each individual zone at RCR 1, 5 and 10, a mixed distribution, upward flux normalization RCR zero, relative/absolute normalization and zero output. Reference multiplier values were evaluated separately with Python Decimal at 40-digit precision. This validates the IES mapping repair; it is not a claim of comprehensive CU certification.

## Export candidate comparison

The candidate calculation was:

`candidate(k) = Σ[flux(zone n) × exp(−A[n] × (5/k)^B[n])] / downward flux`

It uses all nine IES zones, unrounded physical zone flux and the ten EULUMDAT room indices. Two manufacturer-supplied LDTs from the existing [SPX/LEDiL interoperability check](feature_verification.md#manufacturer-interoperability-provenance) supply independent ratio records. The [comparison JSON](direct-ratio-comparison.json) retains every value, source identity and method.

| Fixture | Room index | Supplied LDT ratio | IES candidate |
| --- | ---: | ---: | ---: |
| ILYAD F TW 42° 2700K | 0.6 | 0.57 | 0.594841 |
| ILYAD F TW 42° 2700K | 5.0 | 0.81 | 0.913774 |
| ILYAD F TW 61° 2700K | 0.6 | 0.55 | 0.498928 |
| ILYAD F TW 61° 2700K | 5.0 | 0.81 | 0.899279 |

The maximum absolute differences are 0.103774 and 0.089279, far beyond rounding of the supplied two-decimal values. These files are independent comparison evidence, not certified LiTG reference cases: their ratio calculation provenance is not known. The mismatch cannot establish which method generated their values. It does show that this candidate does not reproduce them and is insufficient evidence for enabling automatic export. Intensities were not rescaled to improve agreement.

## Missing validation contract

The [official LiTG 3.5 summary](https://www.litg.de/media/19228.3.5_Kurzfassung_Wirkunsgradverfahren) distinguishes point-source zonal multipliers from a linear-source strip method and specifies luminaire layout assumptions. The public summary lacks the detailed tables and worked cases. The full publication remains listed by the [publisher](https://www.litg.de/Weiterbildung/LiTG-Publikationen.html), ISBN 978-3-927787-01-8.

Before implementation, obtain the applicable point/linear definitions, room dimensions and arrangement rules, normalization convention, multipliers/strip equations and independent worked numerical cases for the ten room indices. Then validate the algorithm separately before wiring it into serialization. Do not substitute IES coefficients, fit the manufacturer records, or write zeros for missing values. Imported LDT ratios remain preserved; sources without supplied ratios continue to receive the existing explicit export error.
