import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`export {buildIlluminanceField} from './src/core/illuminance';export {parseIES} from './src/core/iesParser';export {COMMERCIAL_DOWNLIGHT_IES} from './src/core/samples';`},bundle:true,platform:'node',format:'esm',write:false});
const core=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].contents).toString('base64'));
const dense={photometricType:1,verticalAngles:Array.from({length:181},(_,i)=>i),horizontalAngles:Array.from({length:73},(_,i)=>i*5),multiplier:1};
dense.candela=dense.horizontalAngles.map(c=>dense.verticalAngles.map(g=>1000*Math.max(0,Math.cos(g*Math.PI/180))*(1+.3*Math.sin(g*Math.PI/180)*Math.cos(c*Math.PI/180))));
const measurements={};for(const [name,data] of Object.entries({sample:core.parseIES(core.COMMERCIAL_DOWNLIGHT_IES),dense})){const times=[];for(let i=0;i<8;i++){const start=performance.now();core.buildIlluminanceField(data);times.push(performance.now()-start)}measurements[name]={coldMs:times[0],warmMedianMs:times.slice(1).sort((a,b)=>a-b)[3],worstMs:Math.max(...times)}}
console.log(JSON.stringify({scope:'Node normalized field and contour generation; 121x121 points; height/unit updates reuse cached geometry',measurements},null,2));
