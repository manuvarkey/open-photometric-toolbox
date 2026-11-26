import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const output=process.env.PHOTOMETRIC_ARTIFACTS ?? '/tmp/photometric-ui-checks';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PHOTOMETRIC_CHROMIUM||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function choose(page,label,name){await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name,exact:true}).click();}
const results=[];
try {
 const page=await browser.newPage({viewport:{width:1400,height:900}});await page.goto('http://127.0.0.1:1420');await page.locator('.three-canvas canvas').waitFor();
 const markers=page.locator('.angle-markers');
 const plane=name=>markers.locator(`[data-plane="${name}"]`);
 await plane('horizontal').getByText('15°',{exact:true}).waitFor();
 assert.equal(await markers.locator('text:not([data-plane="horizontal"])').count(),0);
 await page.getByText('Overlays',{exact:true}).click();
 const horizontal=page.getByRole('checkbox',{name:'Horizontal ring',exact:true});
 const transverse=page.getByRole('checkbox',{name:'Transverse ring (C0–C180)',exact:true});
 const longitudinal=page.getByRole('checkbox',{name:'Longitudinal ring (C90–C270)',exact:true});
 const maximum=page.getByRole('checkbox',{name:'Max plane ring',exact:true});
 const angles=page.getByRole('checkbox',{name:'Angle markers',exact:true});
 assert.ok(await horizontal.isChecked()&&await angles.isChecked());
 assert.ok(!await transverse.isChecked()&&!await longitudinal.isChecked()&&!await maximum.isChecked());
 await transverse.check();await longitudinal.check();
 await plane('transverse').first().waitFor();await plane('longitudinal').first().waitFor();
 await angles.uncheck();await markers.waitFor({state:'detached'});
 assert.ok(await transverse.isChecked()&&await longitudinal.isChecked());
 await angles.check();await maximum.check();await plane('maximum').first().waitFor();
 await maximum.uncheck();await plane('maximum').first().waitFor({state:'detached'});
 await horizontal.uncheck();await plane('horizontal').first().waitFor({state:'detached'});
 await horizontal.check();await page.keyboard.press('Escape');
 const beforeOrbit=await plane('horizontal').first().getAttribute('x');
 await page.locator('.three-canvas').hover();await page.mouse.down();await page.mouse.move(930,420,{steps:4});await page.mouse.up();
 await page.waitForFunction(before=>document.querySelector('.angle-markers [data-plane="horizontal"]')?.getAttribute('x')!==before,beforeOrbit);
 await page.getByRole('button',{name:'Reset View',exact:true}).click();
 await page.screenshot({path:output+'/3d-ring-overlays.png'});
 await choose(page,'View','2D Candela Plot');
 for(const [mode,selector,width,height] of [['Polar','.polar-svg',500,500],['Cartesian','.cartesian-svg',640,400],['Iso-illuminance','.template-svg',600,600]]){
  if(mode==='Iso-illuminance')await choose(page,'View',mode);else await choose(page,'Plot',mode);
  const svg=page.locator(selector);await svg.waitFor();await page.getByRole('button',{name:'Fit',exact:true}).click();
  assert.equal(await page.locator('.canvas-container :is(canvas,image,foreignObject)').count(),0);
  const base=await svg.getAttribute('viewBox'),paths=await svg.locator('path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')));
  assert.deepEqual(base.split(' ').map(Number),[0,0,width,height]);
  await page.getByRole('button',{name:'Zoom In',exact:true}).click();assert.ok(Number((await svg.getAttribute('viewBox')).split(' ')[2])<width);
  assert.deepEqual(await svg.locator('path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d'))),paths);
  const screen=await svg.evaluate((s,{width,height})=>{const p=new DOMPoint(width*.67,height*.43).matrixTransform(s.getScreenCTM());return {x:Math.round(p.x),y:Math.round(p.y)}}, {width,height});
  await page.mouse.move(screen.x,screen.y);
  const world=()=>svg.evaluate((s,p)=>{const world=new DOMPoint(p.x,p.y).matrixTransform(s.getScreenCTM().inverse());return {x:world.x,y:world.y}},screen);
  const before=await world();const readout=mode==='Cartesian'?await svg.locator('.tooltip-text-primary').textContent():mode==='Iso-illuminance'?await page.locator('.cursor-badge').textContent():null;
  await page.mouse.wheel(0,-200);await page.waitForFunction(({selector,width})=>Number(document.querySelector(selector).getAttribute('viewBox').split(' ')[2])<width/1.25,{selector,width});
  const after=await world();assert.ok(Math.abs(before.x-after.x)<.001&&Math.abs(before.y-after.y)<.001,mode+' cursor anchor moved '+JSON.stringify({before,after,screen,viewBox:await svg.getAttribute('viewBox')}));
  if(readout){await page.mouse.move(screen.x+.01,screen.y+.01);const current=mode==='Cartesian'?await svg.locator('.tooltip-text-primary').textContent():await page.locator('.cursor-badge').textContent();assert.equal(current,readout,mode+' hover changed at the same physical coordinate');}
  const zoomed=await svg.getAttribute('viewBox');await page.mouse.down();await page.mouse.move(screen.x+60,screen.y+35,{steps:5});await page.mouse.up();assert.notEqual(await svg.getAttribute('viewBox'),zoomed,mode+' drag did not pan');
  assert.equal(await svg.evaluate(s=>getComputedStyle(s).transform),'none');
  await page.getByRole('button',{name:'Fit',exact:true}).click();assert.equal(await svg.getAttribute('viewBox'),base);
  if(mode==='Iso-illuminance'){
   const zoomIn=page.getByRole('button',{name:'Zoom In',exact:true});for(let i=0;i<12&&!await zoomIn.isDisabled();i++)await zoomIn.click();assert.equal(await page.getByLabel('Zoom level',{exact:true}).textContent(),'500%');
   const zoomOut=page.getByRole('button',{name:'Zoom Out',exact:true});for(let i=0;i<20&&!await zoomOut.isDisabled();i++)await zoomOut.click();assert.equal(await page.getByLabel('Zoom level',{exact:true}).textContent(),'40%');
   await page.getByRole('button',{name:'Fit',exact:true}).click();assert.deepEqual(await svg.locator('path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d'))),paths);
  }
  await page.screenshot({path:output+'/svg-'+mode.toLowerCase()+'.png'});results.push(mode);
 }
 // Desktop font updates must change all interface controls and refit captions.
 await page.evaluate(async()=>{const typography=await import('/src/services/interfaceTypography.ts');typography.applyDesktopFont({family:'DejaVu Sans',size:'17px'})});
 await page.setViewportSize({width:900,height:600});await page.getByRole('tab',{name:'File',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ribbon-action')?.style.getPropertyValue('--ribbon-button-width'));
 const fonts=await page.evaluate(()=>['.ribbon-tabs > button','.ribbon-label','.app-select'].map(selector=>{const el=document.querySelector(selector);return el?getComputedStyle(el).fontFamily:null}));assert.ok(fonts.filter(Boolean).every(f=>f.includes('DejaVu Sans')));
 const controls=await page.locator('.ribbon button:visible,.ribbon summary:visible').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,right:n.getBoundingClientRect().right,bottom:n.getBoundingClientRect().bottom})));assert.ok(controls.every(c=>c.right<=901&&c.bottom<=601));
 await page.screenshot({path:output+'/ribbon-desktop-font.png'});
 await page.evaluate(()=>{window.queryLocalFonts=async()=>[{family:'DejaVu Serif'}]});await page.getByRole('tab',{name:'Reports',exact:true}).click();await page.getByRole('button',{name:'Load system fonts',exact:true}).click();await choose(page,'Report Font','DejaVu Serif');
 const reportFamily=await page.locator('.report-paper').evaluate(el=>getComputedStyle(el).fontFamily);await page.evaluate(async()=>{const typography=await import('/src/services/interfaceTypography.ts');typography.applyDesktopFont({family:'DejaVu Sans',size:'15px'})});assert.equal(await page.locator('.report-paper').evaluate(el=>getComputedStyle(el).fontFamily),reportFamily);

 await fs.writeFile(output+'/svg-interaction.json',JSON.stringify({vectorCameras:results,cursorAnchors:true,hoverAfterZoom:true,dragAndFit:true,geometryReused:true,limits:[.4,5],desktopFontUpdate:true},null,2));
 console.log('SVG zoom, pan, hit testing, geometry reuse and desktop typography checks passed.');
} finally {await browser.close();}
