import { build } from "esbuild";
const { outputFiles } = await build({
  stdin: { contents: String.raw`
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { parseEULUMDAT, serializeEULUMDAT, eulumdatAfterUniformEdit } from './src/core/eulumdatConverter';
    import { computePhotometrics } from './src/core/calculations';
    import { parsePhotometric } from './src/core/photometricParser';
    import { convertPhotometric } from './src/core/goniometerConversion';
    import { createCandelaSampler } from './src/core/photometricSampling';
    import { parseIES, serializeIES } from './src/core/iesParser';
    import { COMMERCIAL_DOWNLIGHT_IES } from './src/core/samples';
    const source = n => readFileSync('tests/fixtures/ldt/symmetry-'+n+'.ldt','utf8');
    const close = (a,b) => assert.ok(Math.abs(a-b) <= 1e-8*Math.max(1,Math.abs(b)), a+' != '+b);
    const expected = [[10,20,30,40],[10],[10,20,30,20],[10,20,10,40],[10,20,10,20]];
    for (let symmetry=0;symmetry<=4;symmetry++) {
      const d=parseEULUMDAT(source(symmetry),'fixture.ldt');
      assert.equal(d.fileFormat,'LDT');assert.equal(d.photometricType,1);assert.equal(d.multiplier,1);
      assert.deepEqual(d.candela.map(row=>row[1]),symmetry===1?expected[symmetry]:[...expected[symmetry],expected[symmetry][0]]);
      assert.deepEqual(d.eulumdat.bodyDimensionsMm,[400,250,80]);
      assert.deepEqual(d.eulumdat.luminousArea.heightsMm,[10,20,30,40]);
      assert.equal(d.luminousLength,.2);assert.equal(d.luminousWidth,.1);assert.equal(d.luminousHeight,.04);
      assert.equal(d.keywords.LUMCAT,'SYM-'+symmetry);
      assert.equal(d.eulumdat.conversionFactor,1);
      const serialized=serializeEULUMDAT(d);
      assert.equal(serialized,serializeEULUMDAT(d),'export must be deterministic');
      const lines=serialized.split(/\r?\n/);
      assert.deepEqual(lines.slice(17,21),['10','20','30','40']);
      assert.equal(lines[25],'1','lamp-set count is record 26');
      assert.equal(Number(lines[3]),symmetry===1?1:4,'Mc is full-circle count');
      assert.equal(Number(lines[2]),symmetry===1?1:0,'export normalized grid without inferred compact symmetry');
      const reopened=parseEULUMDAT(serialized);
      d.candela.forEach((row,h)=>row.forEach((cd,v)=>close(reopened.candela[h][v],cd)));
      assert.deepEqual(reopened.eulumdat.directRatios,d.eulumdat.directRatios);
      assert.equal(reopened.eulumdat.lightOutputRatio,d.eulumdat.lightOutputRatio);
      assert.equal(reopened.eulumdat.downwardFluxFraction,d.eulumdat.downwardFluxFraction);
      assert.equal(reopened.eulumdat.measurementTilt,d.eulumdat.measurementTilt);
      close(reopened.calculated.totalLuminaireLumens,d.calculated.totalLuminaireLumens);
      const ies=parseIES(serializeIES(d));
      assert.deepEqual(ies.candela,d.candela);
    }
    const change=(s,line,value)=>{const l=s.trimEnd().split('\n');l[line-1]=String(value);return l.join('\n')+'\n'};
    const pointNoSymmetry=parseEULUMDAT(change(source(0),2,0));assert.equal(pointNoSymmetry.eulumdat.typeIndicator,0);assert.equal(parseEULUMDAT(serializeEULUMDAT(pointNoSymmetry)).eulumdat.typeIndicator,0);
    assert.throws(()=>parseEULUMDAT(change(source(0),2,-1)),/type indicator/);assert.throws(()=>parseEULUMDAT(change(source(0),2,4)),/type indicator/);
    let relative=source(1);relative=change(relative,24,2);relative=change(relative,27,2);relative=change(relative,29,6000);
    const scaled=parseEULUMDAT(relative);assert.equal(scaled.lampCount,2);assert.equal(scaled.lumensPerLamp,3000);close(scaled.candela[0][0],1200);close(scaled.candela[0][1],120);assert.equal(parseEULUMDAT(serializeEULUMDAT(scaled)).eulumdat.conversionFactor,2);
    const feet={...parseEULUMDAT(source(1)),unitsType:1,luminousLength:1,luminousWidth:.5,luminousHeight:.25};const feetExport=parseEULUMDAT(serializeEULUMDAT(feet));close(feetExport.luminousLength,.3048);close(feetExport.luminousWidth,.1524);close(feetExport.luminousHeight,.0762);
    let absolute=change(relative,27,-2);const a=parseEULUMDAT(absolute);assert.equal(a.lampCount,2);assert.equal(a.lumensPerLamp,-1);close(a.candela[0][0],1200);assert.equal(parseEULUMDAT(serializeEULUMDAT(a)).eulumdat.lampSets[0].lampCount,-2);
    const edited=(original,scale=1,patch={})=>{
      const data={...original,...patch,candela:original.candela.map(row=>row.map(cd=>cd*scale))};
      data.calculated=computePhotometrics(data.verticalAngles,data.horizontalAngles,data.candela,data.lampCount,data.lumensPerLamp,data.multiplier,data.inputWatts,data.luminousLength,data.luminousWidth,data.luminousHeight,data.unitsType,data.photometricType);
      data.eulumdat=eulumdatAfterUniformEdit(original,data,scale);return data;
    };
    const original=parseEULUMDAT(source(0));const originalMetadata=JSON.stringify(original.eulumdat);
    const identity=edited(original,1,{keywords:{...original.keywords,LUMINAIRE:'Renamed'}});assert.equal(identity.eulumdat,original.eulumdat,'identity edits retain supplied metadata');
    const half=edited(original,.5);const halfReopened=parseEULUMDAT(serializeEULUMDAT(half));
    close(halfReopened.eulumdat.lightOutputRatio,(100*Math.PI-100)/10);assert.ok(halfReopened.eulumdat.lightOutputRatio<original.eulumdat.lightOutputRatio);
    close(halfReopened.eulumdat.downwardFluxFraction,100*(100*Math.PI-150)/(100*Math.PI-100));
    assert.deepEqual(halfReopened.eulumdat.directRatios,original.eulumdat.directRatios);
    original.candela.forEach((row,h)=>row.forEach((cd,v)=>close(halfReopened.candela[h][v],cd*.5)));
    const changedMultiplier=parseEULUMDAT(serializeEULUMDAT(edited(original,1,{multiplier:.5})));close(changedMultiplier.eulumdat.lightOutputRatio,(100*Math.PI-100)/10);
    const changedLamp=edited(original,1,{lumensPerLamp:2000});const changedLampReopened=parseEULUMDAT(serializeEULUMDAT(changedLamp));assert.equal(changedLampReopened.eulumdat.lampSets[0].totalFlux,2000);close(changedLampReopened.eulumdat.lightOutputRatio,(200*Math.PI-200)/20);
    const halfAbsolute=edited(a,.5);const halfAbsoluteReopened=parseEULUMDAT(serializeEULUMDAT(halfAbsolute));close(halfAbsoluteReopened.eulumdat.lampSets[0].totalFlux,1200*Math.PI-1920);assert.equal(halfAbsoluteReopened.eulumdat.lightOutputRatio,100);
    a.candela.forEach((row,h)=>row.forEach((cd,v)=>close(halfAbsoluteReopened.candela[h][v],cd*.5)));
    const absoluteSwitch=edited(original,1,{lumensPerLamp:-1});const switched=parseEULUMDAT(serializeEULUMDAT(absoluteSwitch));assert.equal(switched.eulumdat.lampSets[0].lampCount,-1);assert.equal(switched.eulumdat.lightOutputRatio,100);close(switched.eulumdat.lampSets[0].totalFlux,200*Math.PI-200);
    const relativeSwitch=edited(a,1,{lumensPerLamp:10000});const switchedBack=parseEULUMDAT(serializeEULUMDAT(relativeSwitch));assert.equal(switchedBack.eulumdat.lampSets[0].totalFlux,20000);close(switchedBack.eulumdat.lightOutputRatio,(2400*Math.PI-3840)/200);
    assert.throws(()=>serializeEULUMDAT(edited(original,10)),/light output ratio/);
    assert.equal(JSON.stringify(original.eulumdat),originalMetadata,'editing must not mutate source metadata');
    const multiple=change(source(0),26,2).split('\n');multiple.splice(32,0,'3','Alternative test lamp','6000','3000 K','Ra 80','90');const multi=parseEULUMDAT(multiple.join('\n'));assert.equal(multi.inputWatts,20);assert.equal(multi.eulumdat.lampSets[1].watts,90);assert.deepEqual(parseEULUMDAT(serializeEULUMDAT(multi)).eulumdat.lampSets,multi.eulumdat.lampSets);
    const circular=parseEULUMDAT(change(source(1),17,0));assert.equal(circular.luminousLength,-.2);assert.equal(circular.luminousWidth,-.2);assert.equal(parseEULUMDAT(serializeEULUMDAT(circular)).eulumdat.luminousArea.widthMm,0);
    const nonuniform=source(0).trimEnd().split('\n');nonuniform[4]='0';nonuniform[43]='60';nonuniform[44]='200';assert.deepEqual(parseEULUMDAT(nonuniform.join('\n')).horizontalAngles,[0,60,200,270,360]);
    assert.equal(parsePhotometric(source(3),'fixture.LDT').fileFormat,'LDT');assert.equal(parsePhotometric(source(3),'fixture.txt').fileFormat,'LDT');assert.equal(parsePhotometric(COMMERCIAL_DOWNLIGHT_IES,'fixture.ies').fileFormat,'IES');
    assert.throws(()=>parsePhotometric('unrelated text','x.txt'),/Unrecognized/);
    assert.throws(()=>parseEULUMDAT(change(source(0),4,100000)),/C-plane count/);
    assert.throws(()=>parseEULUMDAT(change(source(0),3,5)),/symmetry/);
    assert.throws(()=>parseEULUMDAT(change(source(0),24,'NaN')),/finite/);
    assert.throws(()=>parseEULUMDAT(change(source(0),24,0)),/positive/);
    assert.throws(()=>parseEULUMDAT(change(source(0),27,0)),/lamp count cannot/);
    assert.throws(()=>parseEULUMDAT(change(source(0),29,0)),/flux must be positive/);
    assert.throws(()=>parseEULUMDAT(change(source(0),33,1.1)),/direct ratio/);
    assert.throws(()=>parseEULUMDAT(source(0).trimEnd().split('\n').slice(0,-1).join('\n')),/incomplete intensity/);
    assert.throws(()=>parseEULUMDAT(source(0)+'1\n'),/unexpected extra/);
    assert.throws(()=>parseEULUMDAT(source(0).replace(/40(\r?\n0\r?\n)$/,'-40$1')),/negative/);
    const invalidAngles=change(source(0),44,0);assert.throws(()=>parseEULUMDAT(invalidAngles),/strictly increasing/);
    // Earlier application exports omitted three luminous heights. Never infer
    // shifted fields and silently produce a plausible but wrong luminaire.
    const shifted=source(0).split('\n');shifted.splice(18,3);assert.throws(()=>parseEULUMDAT(shifted.join('\n')),/Invalid EULUMDAT/);
    assert.throws(()=>serializeEULUMDAT(parseIES(COMMERCIAL_DOWNLIGHT_IES)),/ten validated LITG direct ratios/);
    const clipped=convertPhotometric(parseEULUMDAT(source(0)),2,5);assert.equal(clipped.eulumdat,undefined);assert.throws(()=>serializeEULUMDAT(clipped),/ten validated/);
    const downOnly=parseEULUMDAT(source(0));downOnly.verticalAngles=downOnly.verticalAngles.slice(0,3);downOnly.numVerticalAngles=3;downOnly.candela=downOnly.candela.map(row=>row.slice(0,3));downOnly.calculated={...downOnly.calculated,upwardLumens:0};
    const typeB=convertPhotometric(downOnly,2,5);const exportedB=parseEULUMDAT(serializeEULUMDAT(typeB));assert.equal(exportedB.photometricType,1);const sampleB=createCandelaSampler(typeB),sampleExport=createCandelaSampler(exportedB);for(const c of [0,90,180,270])for(const g of [0,30,60,90])close(sampleB(g,c),sampleExport(g,c));
    assert.throws(()=>serializeEULUMDAT({...parseEULUMDAT(source(0)),photometricType:3}),/Type A/);
    console.log('LDT independent symmetry, scaling, metadata, malformed input and round-trip checks passed.');
  `, resolveDir: process.cwd(), loader: "ts", sourcefile: "ldt-format.ts" },
  bundle: true, platform: "node", format: "esm", write: false,
});
try { await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`); }
catch (error) { console.error(error.message); process.exitCode = 1; }
