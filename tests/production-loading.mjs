import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const output=process.env.PHOTOMETRIC_ARTIFACTS ?? '/tmp/photometric-ui-checks';
await fs.mkdir(output,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','1422','--strictPort'],{stdio:['ignore','pipe','inherit']});
let browser;
try {
 await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{if(data.toString().includes('Local:'))resolve()});server.on('exit',code=>reject(new Error('Preview exited '+code)));});
 browser=await chromium.launch({executablePath:process.env.PHOTOMETRIC_CHROMIUM||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();const loaded=new Map();
 page.on('response',response=>{const url=new URL(response.url());if(url.pathname.endsWith('.js'))loaded.set(url.pathname,Number(response.headers()['content-length']));});
 await page.goto('http://127.0.0.1:1422');await page.locator('.three-canvas canvas').waitFor();
 const startup=[...loaded.keys()];assert.ok(startup.some(p=>p.includes('Photometric3DViewer')));assert.ok(!startup.some(p=>/ReportViewer|IsoIlluminanceViewer/.test(p)));
 await page.getByRole('combobox',{name:'View',exact:true}).click();await page.getByRole('option',{name:'Iso-illuminance',exact:true}).click();await page.locator('.template-svg').waitFor();
 const afterIso=[...loaded.keys()];assert.ok(afterIso.some(p=>p.includes('IsoIlluminanceViewer')));
 await page.getByRole('tab',{name:'Reports',exact:true}).click();await page.locator('.report-paper').waitFor();const afterReport=[...loaded.keys()];assert.ok(afterReport.some(p=>p.includes('ReportViewer')));
 await page.getByRole('tab',{name:'Visualize',exact:true}).click();await page.getByRole('tab',{name:'Reports',exact:true}).click();await page.locator('.report-paper').waitFor();assert.deepEqual([...loaded.keys()],afterReport);
 const failure=await browser.newPage();await failure.route('**/ReportViewer-*.js',route=>route.abort());await failure.goto('http://127.0.0.1:1422');await failure.getByRole('tab',{name:'Reports',exact:true}).click();await failure.getByRole('alert').filter({hasText:'could not be loaded'}).waitFor();await failure.getByRole('button',{name:'Reload application',exact:true}).waitFor();await failure.close();
 await fs.writeFile(output+'/production-loading.json',JSON.stringify({startup,afterIso,afterReport,bytes:Object.fromEntries(await Promise.all([...loaded.keys()].map(async path=>[path,(await fs.stat('dist'+path)).size]))),failedChunkFeedback:true},null,2));
 console.log('Production lazy loading, cached reopen, and failed-chunk feedback passed.');
} finally {await browser?.close();server.kill();}
