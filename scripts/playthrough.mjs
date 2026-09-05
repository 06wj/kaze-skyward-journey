import { launchBrowser } from './browser.mjs';
import fs from 'node:fs';
const browser = await launchBrowser();
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto((process.env.DEV_URL || 'http://localhost:5173/'));await page.waitForFunction(()=>!!window.__KAZE__);await page.getByRole('button',{name:'清晨',exact:true}).click();await page.waitForTimeout(500);console.log('MORNING',await page.evaluate(()=>({setting:window.__KAZE__.settings.timeOfDay,saved:JSON.parse(localStorage.getItem('kaze-settings-v1')).timeOfDay})));await page.screenshot({path:'artifacts/menu-morning.png'});await page.reload();await page.waitForFunction(()=>!!window.__KAZE__);console.log('PERSISTED',await page.evaluate(()=>window.__KAZE__.settings.timeOfDay));await page.getByRole('button',{name:'黄昏',exact:true}).click();
const results=[];
for(let route=0;route<3;route++){
 await page.evaluate(index=>window.__KAZE__.start('journey',index),route);
 await page.evaluate(async()=>{
  const {ROUTES}=await import('/src/simulation/game.ts');const held=new Set();
  const key=(code,on)=>{if(on&&!held.has(code)){document.body.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));held.add(code)}else if(!on&&held.has(code)){document.body.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));held.delete(code)}};
  window.__qaController=setInterval(()=>{
   const s=window.__KAZE__.state;if(s.screen!=='playing'){held.forEach(code=>key(code,false));clearInterval(window.__qaController);return}
   const t=ROUTES[s.route].gates[s.checkpoint];if(!t)return;const dx=t.x-s.position.x,dz=t.z-s.position.z,dy=t.y-s.position.y;
   let angle=Math.atan2(-dx,-dz)-s.yaw;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
   key('KeyA',angle>.035);key('KeyD',angle<-.035);
   const predictedY=s.position.y+Math.sin(s.pitch)*s.speed*.35;
   key('KeyW',t.y-predictedY>1);key('KeyS',t.y-predictedY< -1);
   key('Space',Math.abs(angle)>.6);key('ShiftLeft',false);
  },40);
 });
 await page.waitForFunction(()=>window.__KAZE__.state.screen==='result',null,{timeout:100000});
 const result=await page.evaluate(()=>({route:window.__KAZE__.state.route,rings:window.__KAZE__.state.checkpoint,integrity:window.__KAZE__.state.integrity,time:window.__KAZE__.state.elapsed,records:window.__KAZE__.records}));results.push(result);console.log('ROUTE',JSON.stringify(result));await page.screenshot({path:`artifacts/result-route-${route}.png`});
}
await page.reload();await page.waitForFunction(()=>!!window.__KAZE__);console.log('RECORDS AFTER RELOAD',await page.evaluate(()=>window.__KAZE__.records));
await page.evaluate(()=>{window.__KAZE__.start('journey',0);window.__KAZE__.state.elapsed=101});await page.waitForFunction(()=>window.__KAZE__.state.screen==='result');console.log('FAILURE',await page.locator('#result-title').textContent());
console.log('ERRORS',errors);fs.writeFileSync('artifacts/playthrough.json',JSON.stringify({results,errors},null,2));await browser.close();
