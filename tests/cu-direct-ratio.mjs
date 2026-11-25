import { build } from 'esbuild';
const { outputFiles } = await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import assert from 'node:assert/strict';
import { computePhotometrics, computeCUTable } from './src/core/calculations';
// IES nine-zone mapping, independently corroborated in Shayeganfar (2009),
// Listing 4.5, printed pp.87–88. Expected multipliers evaluated separately with
// Python Decimal at 40-digit precision; this is not a LiTG export oracle.
const reference = [
 [1,[1,.9598291299477989,.9323938199059483,.9048374180359596,.8728426324887193,.8269591339433623,.7297888742690568,.5272924240430485,.1224564282529819]],
 [5,[1,.8199545426330986,.6843201362799531,.5452440504357139,.414899363119116,.24157353918507726,.09487696515132396,.008353153891246348,.0004953794771391676]],
 [10,[1,.6760103041237108,.45593140062457516,.2676013947807702,.1400440744784293,.03409069250305655,.0036920251821801493,.000011410367063792069,.0000017601628336332205]]
];
const round = n => Math.round(n*100)/100;
// Black ceiling and walls absorb all light reflected off the floor. The CU
// therefore isolates the direct component, without reproducing its code.
for(let zone=0;zone<9;zone++){
 const flux=Array.from({length:9},(_,i)=>i===zone?100:0);
 const table=computeCUTable(flux,100,0,100);
 for(const [rcr,multipliers] of reference) assert.equal(table.rows[rcr].cuValues['0_0'],round(multipliers[zone]),'zone '+zone+' at RCR '+rcr);
 assert.equal(table.rows[0].cuValues['0_0'],1);
}
const mixed=computeCUTable([100,200,300,400,500,600,700,800,900],4500,0,4500);
for(const [rcr,expected] of [[1,.65],[5,.25],[10,.13]]) assert.equal(mixed.rows[rcr].cuValues['0_0'],expected);
const halfUp=computeCUTable([100,0,0,0,0,0,0,0,0],100,100,200);
assert.equal(halfUp.rows[5].cuValues['0_0'],.5);
// End-to-end: relative CU is a fraction of rated lamp flux. An absolute
// file has no rated lamp flux, so its emitted flux supplies the denominator.
const calculate = lampLumens => computePhotometrics([0,30,60,90],[0],[[100,100,100,100]],1,lampLumens,1,20,.2,.2,.1,2,1);
const relative=calculate(1000),absolute=calculate(-1);
assert.equal(relative.totalLuminaireLumens,628);
assert.equal(relative.cuTable.rows[0].cuValues['0_0'],.63);
assert.equal(absolute.cuTable.rows[0].cuValues['0_0'],1);
const zero=computePhotometrics([0,90],[0],[[0,0]],1,-1,1,0,0,0,0,2,1);
assert.ok(zero.cuTable.rows.every(row=>Object.values(row.cuValues).every(value=>value===0)));
console.log('CU nine-zone, lamp normalization and zero-output checks passed.');
`},bundle:true,platform:'node',format:'esm',write:false});
try { await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].contents).toString('base64')); }
catch(error) { console.error(error.message);process.exitCode=1; }
