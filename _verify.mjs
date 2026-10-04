import { chromium } from "playwright";
const SP = "C:/Users/paula/AppData/Local/Temp/claude/C--Users-paula-Desktop-Claude-Code-05-arcade-vault/92cadcb8-f0c1-4def-b3aa-f338b503bd9c/scratchpad";
const b = await chromium.launch();
const out = {};
for (const [id, dpr] of [["vibora",1],["vibora",2],["caida",1],["asteroids",1],["asteroids",2],["frogger",1],["frogger",2]]) {
  const ctx = await b.newContext({ deviceScaleFactor: dpr, viewport:{width:1200,height:900}});
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", m => m.type()==="error" && errs.push(m.text()));
  p.on("pageerror", e => errs.push("PAGEERR "+e.message));
  await p.goto("http://localhost:3000/juego/"+id+"/jugar", {waitUntil:"networkidle"});
  await p.waitForSelector("canvas", {timeout:15000});
  const info = async () => p.evaluate(() => {
    const c = document.querySelector("canvas");
    const x = c.getContext("2d");
    const d = x.getImageData(0,0,c.width,c.height).data;
    let nz=0; for (let i=0;i<d.length;i+=4*50) if (d[i]||d[i+1]||d[i+2]) nz++;
    return {w:c.width,h:c.height,cssW:c.getBoundingClientRect().width,nonBlack:nz, hud:document.body.innerText.replace(/\s+/g," ").slice(0,200)};
  });
  await p.waitForTimeout(500);
  const a = await info();
  for (const k of ["ArrowUp","ArrowRight","ArrowDown","ArrowLeft","Space"]) { await p.keyboard.down(k); await p.waitForTimeout(250); await p.keyboard.up(k); }
  await p.waitForTimeout(1500);
  const bb = await info();
  await p.screenshot({path:SP+"/"+id+"-"+dpr+".png"});
  out[id+"@"+dpr] = {before:a, after:bb, errs};
  await ctx.close();
}
console.log(JSON.stringify(out,null,1));
await b.close();
