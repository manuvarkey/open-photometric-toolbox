# Photometric Toolbox 2.14: Reverse Engineering & Architecture Documentation

This repository contains the decompiled artifacts, extracted modules, and technical documentation for **Photometric Toolbox 2.14** (Installer package: `PhotometricToolbox_2.14.0.41.exe`).

## Documentation Index

Standards acquisition and validation: [Required standards and technical references](./required_standards.md).

Current work: [Direct-ratio follow-up](./direct_ratio_investigation.md), [Core, vector views, and interface implementation plan](./feature_implementation_plan.md), [verification results and limits](./feature_verification.md), with [core-only investigation findings](./core_module_findings.md). These findings qualify earlier parity claims in the historical specifications below.

1. **[Installer & Extraction Analysis](./installer_and_extraction.md)**
   * Complete binary layout of the PE32 executable and overlay.
   * Reverse-engineered specification of the InstallShield `ISSetupStream` v4 container format.
   * Decryption (nibble-swapped XOR) and decompression (zlib) algorithms.
   * OLE Compound Document (MSI) and Cabinet (`Data1.cab`) structure.

2. **[Architecture & Component Specifications](./architecture_and_components.md)**
   * Multi-tier hybrid architecture (Visual Basic 6.0 + .NET Framework 4.0 via COM Interop).
   * Dependency map: DevExpress v20.2, Microsoft Jet 3.5 DB engine, OpenGL (`vbogl.tlb`), LEADTOOLS 14.
   * Interop communication bridge.

3. **[Calculation Engines Reference](./calculation_engines.md)**
   * Decompiled symbols and algorithms in `LAICalcNETRev2.dll` (IES TM-15 BUG Rating, Zonal Lumens, LER, STV, VL).
   * `laiglarenet.dll` (CIE 117-1995 Unified Glare Rating UGR table generation, Type B to Type C goniophotometer conversion).
   * `laicontournet1.dll` (Iso-illuminance / Iso-candela contour plotting).
   * `laiinfonet.dll` (Licensing and client telemetry).

4. **[Modular Tools Specification](./modular_tools.md)**
   * Breakdown of the 11 standalone sub-tool executables (`tool_viewpe.exe`, `tool_comparepe.exe`, `tool_convertpe.exe`, `tool_roadreportpe.exe`, etc.).
   * Command-line invocation and IPC patterns.

5. **[Modern Reconstruction Specification](./modern_reconstruction.md)**
   * Tauri v2 + Vue 3 + Three.js cross-platform architecture.
   * Ribbon toolbar with dynamic canvas degradation matching GEstimator.
   * Core calculation parity (Simpson's zonal lumens, IES TM-15 BUG rating, CIE classification).
   * Development and build instructions.

## Extracted Locations

* **Extracted Installers & MSI**: [`../extracted_installer/`](../extracted_installer/)
* **Extracted Application Files (146 files)**: [`../extracted_installer/cab_contents/`](../extracted_installer/cab_contents/)
