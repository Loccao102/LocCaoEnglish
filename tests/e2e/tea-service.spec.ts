import { test } from "./fair-fixture";
import { expect, type Locator, type Page } from "@playwright/test";

async function click(page:Page,control:Locator){
  await expect(control).toBeVisible({timeout:15000});await expect(control).toBeEnabled();
  await control.evaluate(element=>element.scrollIntoView({block:"center",behavior:"instant"}));
  const box=(await control.boundingBox())!;await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
}
async function openShift(page:Page){
  await page.clock.install();
  await page.addInitScript(()=>{window.requestAnimationFrame=callback=>window.setTimeout(()=>callback(performance.now()),160);window.cancelAnimationFrame=handle=>window.clearTimeout(handle);});
  await page.goto("/festival/tea-time");await click(page,page.getByRole("button",{name:"Serve visiting friends →"}));
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+500));
}
async function recipe(page:Page){
  const card=page.getByRole("region",{name:"Visiting friend's order"});
  await click(page,card.getByRole("button",{name:"Recipe card"}));
  const text=await card.locator("p").innerText(),[from,to]=text.match(/[\d.]+(?=–)|[\d.]+(?= seconds)/g)!.map(Number);
  for(const ingredient of text.split(" · ")[0].split(" → "))await click(page,page.getByRole("group",{name:"Playfield choices"}).getByRole("button",{name:ingredient,exact:true}));
  return {card,from,to};
}

test("a café shift serves three different friends with timed cups and saves once",async({page})=>{
  test.setTimeout(120000);await openShift(page);const friends=new Set<string>();
  for(let round=0;round<3;round++){
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round+1} / 3`);
    const {card,from,to}=await recipe(page);friends.add(await card.locator(".tea-order-heading strong").innerText());
    await click(page,page.getByRole("button",{name:"Start steeping",exact:true}));
    await page.clock.runFor((from+to)/2*1000);
    await expect(page.getByRole("group",{name:"Playfield choices"}).getByRole("button",{name:"Tea",exact:true})).toBeDisabled();
    await click(page,page.getByRole("button",{name:"Lift tea",exact:true}));
    const seconds=Number(await page.getByRole("meter",{name:"Tea steeping time"}).getAttribute("aria-valuenow"));
    expect(seconds).toBeGreaterThanOrEqual(from);expect(seconds).toBeLessThanOrEqual(to);
    await click(page,page.getByRole("button",{name:"Serve tea →",exact:true}));await page.clock.runFor(3100);
  }
  expect(friends.size).toBe(3);
  await expect(page.getByRole("heading",{name:"A memory made together"})).toBeVisible();
  await expect(page.getByText("375 points",{exact:true})).toBeVisible();
  await expect(page.getByText("Friendship stamp and best score saved on this device.")).toBeVisible();
  // Count stored completion receipts, which is the same source used for guest replay protection.
  const receipts=()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith("loccao.fair.v2.guest.run.")).length);
  expect(await receipts()).toBe(1);
  await page.clock.resume();await page.reload();expect(await receipts()).toBe(1);
  await expect(page.getByRole("button",{name:"Continue saved game →"})).toHaveCount(0);
});

test("a short-screen café pauses and resumes an unfinished brew with the same order",async({page},testInfo)=>{
  test.setTimeout(90000);await page.setViewportSize({width:390,height:551});await openShift(page);
  const {card}=await recipe(page),order=await card.locator(".tea-order-heading strong").innerText();
  await click(page,page.getByRole("button",{name:"Start steeping",exact:true}));await page.clock.runFor(700);
  await click(page,page.getByRole("button",{name:"Pause game",exact:true}));
  const meter=page.getByRole("meter",{name:"Tea steeping time",includeHidden:true}),before=await meter.getAttribute("aria-valuenow");
  await page.clock.runFor(5000);expect(await meter.getAttribute("aria-valuenow")).toBe(before);
  await page.clock.resume();await page.reload();
  await expect(page.getByRole("button",{name:"Continue saved game →"})).toBeVisible({timeout:15000});
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+500));
  await click(page,page.getByRole("button",{name:"Continue saved game →"}));
  await expect(card.locator(".tea-order-heading strong")).toHaveText(order);
  expect(await meter.getAttribute("aria-valuenow")).toBe(before);
  await expect(page.getByRole("button",{name:"Lift tea",exact:true})).toBeVisible();
  await page.clock.runFor(9000);
  await expect(page.getByText("This cup steeped too long. Empty it to brew again before serving.")).toBeVisible();
  await expect(page.getByLabel("3 hearts",{exact:true})).toBeVisible();
  await click(page,page.getByRole("button",{name:"Empty cup",exact:true}));await page.clock.runFor(160);
  await expect(meter).toHaveAttribute("aria-valuenow","0");
  // Render normally for visual inspection; a frozen WebGL drawing buffer may be
  // discarded before the browser's screenshot compositor samples it.
  await page.clock.resume();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const choices=page.getByRole("group",{name:"Playfield choices"});
  for(const name of ["Tea","Milk","Honey","Mint"]){
    const choice=choices.getByRole("button",{name,exact:true});await expect(choice).toBeVisible();
    const box=(await choice.boundingBox())!;expect(box.y).toBeGreaterThan(0);expect(box.y+box.height).toBeLessThan(551);
  }
  const boxes=await choices.getByRole("button").evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)expect(boxes[i].right<=boxes[j].x||boxes[j].right<=boxes[i].x||boxes[i].bottom<=boxes[j].y||boxes[j].bottom<=boxes[i].y).toBe(true);
  await page.screenshot({path:testInfo.outputPath("tea-service-short-screen.png")});
});
