import { build } from 'esbuild';
const {outputFiles}=await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:String.raw`
import assert from 'node:assert/strict';
import {createCandelaSampler,createFluxIntegrator,directionFromAngles,anglesFromDirection} from './src/core/photometricSampling';
import {convertPhotometric} from './src/core/goniometerConversion';
import {computePhotometrics} from './src/core/calculations';
import {parseIES,serializeIES} from './src/core/iesParser';
import {reportFontCSS} from './src/services/systemFonts';
import {decodePhotometricBytes} from './src/services/photometricFiles';
import {buildIlluminanceField} from './src/core/illuminance';
import {COMMERCIAL_DOWNLIGHT_IES,FLOODLIGHT_NEMA_IES,ROADWAY_COBRA_HEAD_IES} from './src/core/samples';
assert.ok(!reportFontCSS('Example </style> \"').includes('<'));
assert.equal(decodePhotometricBytes(new Uint8Array([0xb0])), '°');
assert.equal(decodePhotometricBytes(new TextEncoder().encode('Ω')), 'Ω');
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),a+' != '+b);
const web=(type,v,h,f)=>({photometricType:type,verticalAngles:v,horizontalAngles:h,candela:h.map(c=>v.map(g=>f(g,c))),multiplier:1});
const sphere=web(1,[0,30,90,180],[0],()=>100);
close(createFluxIntegrator(sphere)(),400*Math.PI);
const hemisphere=web(1,[0,30,90],[0],()=>100);
close(createFluxIntegrator(hemisphere)(),200*Math.PI);
const gamma=Array.from({length:91},(_,i)=>i);
const lambert=web(1,gamma,[0],g=>100*Math.max(0,Math.cos(g*Math.PI/180)));
close(createFluxIntegrator(lambert)(),100*Math.PI,0.0001);
const fullB=web(2,[-90,-60,0,60,90],[-90,-30,0,45,90],()=>100);
const symmetricB=web(2,[0,30,90],[0,30,90],()=>100);
close(createFluxIntegrator(fullB)(),200*Math.PI);
close(createFluxIntegrator(symmetricB)(),200*Math.PI);
assert.equal(createFluxIntegrator(fullB)(90,180),0);
for(const [g,c,h,v] of [[30,0,0,30],[30,90,-30,0],[30,180,0,-30],[30,270,30,0]]){
 const b=anglesFromDirection(2,directionFromAngles(1,g,c));close(b.horizontal,h);close(b.vertical,v);
 const back=anglesFromDirection(1,directionFromAngles(2,b.vertical,b.horizontal));close(back.vertical,g);close(back.horizontal,c);
}
const half=web(1,[0,45,90],[90,180,270],(g,h)=>g===0?10:100+h);
const sampleHalf=createCandelaSampler(half);close(sampleHalf(45,0),sampleHalf(45,180));close(sampleHalf(45,300),sampleHalf(45,240));
const nonuniform=web(1,[0,30,90],[0,30,140,240,360],(g,h)=>g===0?100:g*(1+h/1000));
nonuniform.candela.at(-1).splice(0,3,...nonuniform.candela[0]);
const ns=createCandelaSampler(nonuniform);
const refined=web(1,[0,30,90],[0,15,30,85,140,190,240,300,360],(g,h)=>ns(g,h));
close(createFluxIntegrator(nonuniform)(),createFluxIntegrator(refined)());
assert.throws(()=>createCandelaSampler({...sphere,photometricType:3}),/Type A/);
assert.throws(()=>createCandelaSampler(web(1,[0,90],[0,180],(g,h)=>g===0?h:10)),/pole/);
assert.throws(()=>createCandelaSampler(web(1,[0,90],[0,360],(g,h)=>g===0?0:h)),/seam/);
const data=(w)=>({...w,fileName:'analytic.ies',fileFormat:'IES',headerVersion:'IESNA:LM-63-2002',keywords:{},lampCount:1,lumensPerLamp:3600,numVerticalAngles:w.verticalAngles.length,numHorizontalAngles:w.horizontalAngles.length,unitsType:2,luminousLength:.4,luminousWidth:.4,luminousHeight:.1,ballastFactor:1,inputWatts:40,calculated:computePhotometrics(w.verticalAngles,w.horizontalAngles,w.candela,1,3600,w.multiplier,40,.4,.4,.1,2,w.photometricType)});
const exponent=Math.log(.5)/Math.log(Math.cos(27.5*Math.PI/180));const i0=3600*(exponent+1)/(2*Math.PI);
const source=data(web(1,gamma,[0],g=>i0*Math.max(0,Math.cos(g*Math.PI/180))**exponent));
const errors=[];
for(const step of [5,2.5,1]){
 const b=convertPhotometric(source,2,step);assert.equal(b.verticalAngles[0],-90);assert.equal(b.horizontalAngles[0],-90);
 assert.equal(b.calculated.upwardLumens,0);close(b.calculated.totalLuminaireLumens,3600,step===5?.02:.01);
 const reopened=parseIES(serializeIES(b));assert.deepEqual(reopened.candela,b.candela);assert.equal(reopened.photometricType,2);
 errors.push(Math.abs(b.calculated.totalLuminaireLumens-3600));
}
assert.ok(errors[2]<errors[0]);assert.equal(convertPhotometric(source,1),source);
const asym=data(web(1,gamma,[0,90,180,270,360],(g,c)=>100*Math.max(0,Math.cos(g*Math.PI/180))*(1+.4*Math.sin(g*Math.PI/180)*Math.cos(c*Math.PI/180))));
const converted=convertPhotometric(asym,2,2.5),bs=createCandelaSampler(converted),cs=createCandelaSampler(asym);
for(const c of [0,90,180,270])close(bs(30,c),cs(30,c),.005);
const field=buildIlluminanceField(lambert);
close(field.at(0,0),100);close(field.at(1,0),25,.0001);
close(field.maximum,100);assert.equal(field.values.length,121*121);assert.ok(field.bands.length>0);
const fine=buildIlluminanceField(lambert,241);close(field.maximum,fine.maximum);close(field.at(2,1),fine.at(2,1));
// Compare the sampled grid with the analytic Lambertian field, including
// interpolation between cells rather than calling the same point evaluator.
let worstGridError=0;
for(let k=0;k<100;k++){
 const x=-4.4+8.8*(k+.37)/100,y=-4.4+8.8*((k*37)%100+.23)/100;
 const col=(x+field.extent)*(field.resolution-1)/(2*field.extent),row=(field.extent-y)*(field.resolution-1)/(2*field.extent);
 const i=Math.floor(col),j=Math.floor(row),tx=col-i,ty=row-j,n=field.resolution;
 const a=field.values[j*n+i]*(1-tx)+field.values[j*n+i+1]*tx,b=field.values[(j+1)*n+i]*(1-tx)+field.values[(j+1)*n+i+1]*tx;
 worstGridError=Math.max(worstGridError,Math.abs(a*(1-ty)+b*ty-100/(1+x*x+y*y)**2));
}
console.log('Illuminance grid worst error (% peak):',worstGridError);assert.ok(worstGridError<1,'121-point grid exceeds 1% of peak error');
const ring=buildIlluminanceField(web(1,gamma,[0],g=>100*Math.sin(g*Math.PI/180)**4));
assert.ok((ring.bands.at(-1).path.match(/M/g)||[]).length>=2,'annular contour must preserve its central hole');
const lobes=buildIlluminanceField(web(1,gamma,Array.from({length:37},(_,i)=>i*10),(g,c)=>100*Math.sin(g*Math.PI/180)**2*Math.cos(c*Math.PI/180)**2));
assert.ok((lobes.bands.at(-1).path.match(/M/g)||[]).length>=2,'separate beam lobes must remain disconnected');
assert.ok(ring.bands.every(b=>b.path.endsWith('Z')&&!/NaN|Infinity/.test(b.path)));
const zero=buildIlluminanceField(web(1,[0,90],[0],()=>0));assert.equal(zero.maximum,0);assert.equal(zero.bands.length,0);
for(const sample of [COMMERCIAL_DOWNLIGHT_IES,FLOODLIGHT_NEMA_IES,ROADWAY_COBRA_HEAD_IES]){const d=parseIES(sample);assert.ok(d.calculated.totalLuminaireLumens>0);assert.ok(d.calculated.zonalLumens.every(z=>z.lumens>=0));}
console.log('Core analytic, conversion, symmetry, and vector-field checks passed.', {conversionErrorsLm:errors});
`},bundle:true,platform:'node',format:'esm',write:false});
await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].contents).toString('base64'));
