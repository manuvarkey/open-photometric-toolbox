import { build } from "esbuild";

// Bundle the pure TypeScript core so this test runs with the project's existing Vite toolchain.
const { outputFiles } = await build({
  stdin: {
    contents: String.raw`
      import assert from "node:assert/strict";
      import { parseIES, serializeIES } from "./src/core/iesParser";
      import { serializeEULUMDAT } from "./src/core/eulumdatConverter";
      import { COMMERCIAL_DOWNLIGHT_IES } from "./src/core/samples";
      const original = parseIES(COMMERCIAL_DOWNLIGHT_IES, "fixture.ies");
      assert.equal(original.keywords.LUMCAT, "DL-100-LED-40W");
      const edited = { ...original, keywords: { ...original.keywords, LUMCAT: "EDITED-CATALOG" } };
      const saved = serializeIES(edited);
      assert.match(saved, /\[LUMCAT\] EDITED-CATALOG/);
      assert.doesNotMatch(saved, /\[\[LUMCAT\]\]/);
      const reopened = parseIES(saved, "fixture.ies");
      assert.equal(reopened.keywords.LUMCAT, "EDITED-CATALOG");
      assert.deepEqual(reopened.verticalAngles, original.verticalAngles);
      assert.deepEqual(reopened.horizontalAngles, original.horizontalAngles);
      assert.deepEqual(reopened.candela, original.candela);
      assert.equal(reopened.calculated.totalLuminaireLumens, original.calculated.totalLuminaireLumens);
      const ldt = serializeEULUMDAT(edited).split(/\r?\n/);
      assert.equal(ldt[0], "Lighting Analysts Sample");
      assert.equal(ldt[9], "EDITED-CATALOG");
      assert.throws(() => parseIES(ldt.join("\n")), /Missing IES TILT/);
      assert.throws(() => parseIES("IESNA:LM-63-2002\nTILT=NONE\n1 1000 1 2 1 1 2 0 0 0\n1 1 10\n0"), /Incomplete/);
      console.log("Metadata and photometry round-trip checks passed.");
    `,
    resolveDir: process.cwd(),
    loader: "ts",
    sourcefile: "metadata-roundtrip.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`);
