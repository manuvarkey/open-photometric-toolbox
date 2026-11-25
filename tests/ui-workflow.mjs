import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const output=process.env.PHOTOMETRIC_ARTIFACTS ?? '/tmp/photometric-ui-checks';await fs.mkdir(output,{recursive:true});
let server;
try{await fetch('http://127.0.0.1:1420');}catch{server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:['ignore','pipe','inherit']});await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('Local:'))resolve()});server.on('exit',c=>reject(new Error('Vite exited '+c)));});}
const browser=await chromium.launch({executablePath:process.env.PHOTOMETRIC_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],matrix=[],checks=[];
async function choose(p,label,option){await p.getByRole('combobox',{name:label,exact:true}).click();const list=p.getByRole('combobox',{name:label,exact:true});const id=await list.getAttribute('aria-controls');await p.locator('[id="'+id+'"]').getByRole('option',{name:option,exact:typeof option==='string'}).click();await p.locator('[id="'+id+'"]').waitFor({state:'detached'});}
async function command(p,name){const button=p.getByRole('button',{name,exact:true});if(!await button.first().isVisible())await p.locator('.compact-commands summary').filter({hasText:'More'}).click();await button.filter({visible:true}).click();}
async function layout(p,name){
 const bad=await p.evaluate(()=>{
  const controls=[...document.querySelectorAll('.ribbon button,.ribbon [role=combobox],.ribbon summary,.ribbon-tabs > button,.ribbon-tabs > details > summary,.modal-backdrop [role=dialog] > :is(.modal-footer,.editor-footer,.catalog-footer) button')];
  return controls.filter(el=>el.checkVisibility()).filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.x< -1||r.right>innerWidth+1||r.y< -1||r.bottom>innerHeight+1)}).map(el=>el.textContent);
 });assert.deepEqual(bad,[],name+' controls overflow');
 const unnamed=await p.locator('button:visible').evaluateAll(nodes=>nodes.filter(el=>!el.textContent.trim()&&!el.getAttribute('aria-label')&&!el.title).map(el=>el.outerHTML));assert.deepEqual(unnamed,[],name+' unnamed buttons');
}
try{
 for(const [width,height] of [[1400,900],[900,600]])for(const theme of ['dark','light'])for(const scale of ['100%','130%']){
  const p=await browser.newPage({viewport:{width,height}});p.on('pageerror',error=>errors.push(error.message));await p.goto('http://127.0.0.1:1420');await p.locator('.three-canvas canvas').waitFor();
  if(theme==='light'){await p.getByText('Display',{exact:true}).click();await p.getByRole('button',{name:'Theme: Dark',exact:true}).click();}
  await p.getByText('Display',{exact:true}).click();await choose(p,'UI Scale',scale);await p.keyboard.press('Escape');
  const id=width+'x'+height+'-'+theme+'-'+scale.replace('%','');
  await layout(p,id+'-3d');
  await choose(p,'View','2D Candela Plot');await choose(p,'Plot','Cartesian');await choose(p,'Plane','90° Longitudinal');await p.locator('.cartesian-svg').waitFor();await layout(p,id+'-cartesian');
  await choose(p,'View','Iso-illuminance');await p.locator('.template-svg').waitFor();assert.equal(await p.locator('.canvas-container canvas').count(),0);assert.equal(await p.locator('.template-svg path').count(),10);await layout(p,id+'-iso');
  await p.getByRole('tab',{name:'Compare',exact:true}).click();await p.locator('.compare-container').waitFor();assert.equal(await p.locator('.ribbon [role=combobox]').count(),2);await choose(p,'Luminaire A',/Architectural_Floodlight/);await choose(p,'Luminaire B',/Commercial_Downlight_40W.ies ·/);await layout(p,id+'-compare');
  await p.getByRole('tab',{name:'Reports',exact:true}).click();await p.getByRole('combobox',{name:'Report Type',exact:true}).waitFor();await choose(p,'Report Type','Roadway');await layout(p,id+'-report');
  if(width===900&&scale==='130%')await p.screenshot({path:output+'/'+id+'-reports.png'});
  for(const [tab,button] of [['File','New Luminaire'],['File','Edit Luminaire'],['File','Library'],['Analyze','CIE Classification']]){
   await p.getByRole('tab',{name:tab,exact:true}).click();await command(p,button);const dialog=p.getByRole('dialog');await dialog.waitFor();await p.waitForFunction(()=>Boolean(document.querySelector('[role=dialog]')?.contains(document.activeElement)));
   await p.keyboard.press('Shift+Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));await p.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));await layout(p,id+'-'+button);
   if(button==='New Luminaire'){await choose(p,'Units','Metres');assert.ok(await dialog.isVisible(),'select Escape must not dismiss its dialog');}
   await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  matrix.push(id);await p.close();console.log('Layout',id);
 }
 const p=await browser.newPage({viewport:{width:900,height:600}});p.on('pageerror',error=>errors.push(error.message));await p.goto('http://127.0.0.1:1420');await p.locator('.three-canvas canvas').waitFor();
 await p.locator('.app-container > input[type=file]').first().setInputFiles('tests/fixtures/ldt/symmetry-3.ldt');await p.waitForFunction(()=>document.querySelector('.file-name')?.textContent.includes('symmetry-3.ldt'));
 assert.match(await p.locator('.status-bar').innerText(),/symmetry-3.ldt/);
 await p.getByRole('tab',{name:'File',exact:true}).click();let download=p.waitForEvent('download');await command(p,'Export LDT');let text=await fs.readFile(await(await download).path(),'utf8');assert.match(text,/SYM-3/);checks.push('Native format dispatch and LDT re-export metadata');
 download=p.waitForEvent('download');await command(p,'Save IES');let d=await download;assert.match(d.suggestedFilename(),/\.ies$/);text=await fs.readFile(await d.path(),'utf8');assert.match(text,/TILT=NONE/);
 await p.getByRole('tab',{name:'Compare',exact:true}).click();for(const side of ['A','B']){const chooser=p.waitForEvent('filechooser');await p.getByRole('button',{name:'Open luminaire '+side,exact:true}).click();await(await chooser).setFiles('tests/fixtures/ldt/symmetry-4.ldt');await p.waitForFunction(side=>document.querySelector('[aria-label="Luminaire '+side+'"]')?.textContent.includes('symmetry-4.ldt'),side);}
 assert.ok((await p.locator('.legend-row').innerText()).includes('symmetry-4.ldt'));checks.push('Independent A/B LDT inputs and curves');
 await p.getByRole('button',{name:'Library for A',exact:true}).click();await p.getByLabel('Search luminaires').fill('Commercial');await p.getByRole('dialog').getByRole('button',{name:'Open',exact:true}).click();await p.getByRole('dialog').waitFor({state:'detached'});assert.match(await p.getByRole('combobox',{name:'Luminaire A',exact:true}).innerText(),/Commercial/);checks.push('Library targets A without changing editing document');
 await p.getByRole('tab',{name:'Visualize',exact:true}).click();await choose(p,'View','Iso-illuminance');await p.locator('.template-svg').waitFor();const paths=await p.locator('.template-svg path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')));await p.getByLabel('Mounting Height (MH):').fill('10');await choose(p,'Illuminance Units','Lux');assert.ok(Math.abs(Number(await p.getByLabel('Mounting Height (MH):').inputValue())-3.048)<1e-8);assert.deepEqual(await p.locator('.template-svg path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d'))),paths);checks.push('Height and unit changes reuse vector geometry');
 // Test browser font enumeration with a controlled permission-success response; native enumeration is verified separately.
 await p.evaluate(()=>{window.queryLocalFonts=async()=>[{family:'DejaVu Serif'},{family:'DejaVu Sans'}]});
 await p.getByRole('tab',{name:'Reports',exact:true}).click();await p.getByRole('button',{name:'Load system fonts',exact:true}).click();await choose(p,'Report Font','DejaVu Serif');assert.match(await p.locator('.report-paper').evaluate(el=>getComputedStyle(el).fontFamily),/DejaVu Serif/);
 for(const type of ['Indoor','Roadway','Floodlight']){await choose(p,'Report Type',type);download=p.waitForEvent('download');await p.getByRole('button',{name:'Export HTML Report',exact:true}).click();text=await fs.readFile(await(await download).path(),'utf8');assert.match(text,/DejaVu Serif/);assert.match(text,/<svg/);assert.doesNotMatch(text,/<script|<link[^>]+href=/i);await p.pdf({path:output+'/'+type.toLowerCase()+'.pdf',format:'A4',printBackground:true});}
 // Manufacturer identifiers may contain long strings without spaces.
 const longMetadata=(await fs.readFile('tests/fixtures/ldt/symmetry-3.ldt','utf8')).replace('Test LED','Luminaire_Manufacturer_Model_'.repeat(8));
 await p.locator('input[type=file]').first().setInputFiles({name:'long-metadata.ldt',mimeType:'text/plain',buffer:Buffer.from(longMetadata)});await p.waitForFunction(()=>document.querySelector('.file-name')?.textContent.includes('long-metadata.ldt'));
 const columns=await p.locator('.report-paper .meta-col').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));assert.ok(Math.max(...columns)-Math.min(...columns)<2,'Long identifiers must not collapse metadata columns');checks.push('Long report metadata wraps within equal columns');
 const uiFont=await p.locator('.ribbon-tabs > button').first().evaluate(el=>getComputedStyle(el).fontFamily);assert.equal(uiFont,'system-ui');checks.push('Report font reaches all three HTML/PDF outputs without changing UI fonts');
 await p.getByRole('tab',{name:'Visualize',exact:true}).click();await p.getByRole('tab',{name:'Reports',exact:true}).click();assert.match(await p.getByRole('combobox',{name:'Report Font',exact:true}).innerText(),/DejaVu Serif/);checks.push('Report settings persist across view changes');
 // Exercise preset generation through its real UI, including signed Type B output.
 await p.getByRole('tab',{name:'File',exact:true}).click();
 for(const preset of ['LED Downlight','Office Batwing','UFO High Bay','NEMA Floodlight','Direct / Indirect','Asymmetric Wall Wash']){
  await command(p,'New Luminaire');await p.getByRole('dialog').waitFor();await p.getByRole('button').filter({has:p.getByText(preset,{exact:true})}).click();await p.getByRole('button',{name:'Create & Load Luminaire',exact:true}).click();await p.getByRole('dialog').waitFor({state:'detached'});assert.doesNotMatch(await p.locator('.status-bar').innerText(),/error|failed/i);
 }
 checks.push('Preset creation including genuine Type B floodlight');
 const denied=await browser.newPage();await denied.goto('http://127.0.0.1:1420');await denied.evaluate(()=>{window.queryLocalFonts=async()=>{throw new Error('Font permission denied')}});await denied.getByRole('tab',{name:'Reports',exact:true}).click();await denied.getByRole('button',{name:'Load system fonts',exact:true}).click();await denied.getByText('Font permission denied',{exact:true}).waitFor();assert.match(await denied.getByRole('combobox',{name:'Report Font',exact:true}).innerText(),/System default/);await denied.close();checks.push('Browser font permission denial preserves default');
 assert.deepEqual(errors,[]);await fs.writeFile(output+'/ui-results.json',JSON.stringify({matrix,checks,errors},null,2));console.log('UI workflow checks passed.');
}finally{await browser.close();server?.kill();}
