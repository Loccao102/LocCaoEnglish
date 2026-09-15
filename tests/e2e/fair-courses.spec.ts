import { test, expect, type Page, type Locator } from "@playwright/test";
import { fairCourses } from "../../lib/game/fair-courses";

test.setTimeout(240000);
async function controlled(page:Page){
  await page.clock.install({time:new Date("2026-09-16T00:00:00Z")});
  await page.addInitScript(()=>{window.requestAnimationFrame=callback=>window.setTimeout(()=>callback(performance.now()),160);window.cancelAnimationFrame=handle=>window.clearTimeout(handle);});
}

async function clickVisible(page:Page,locator:Locator){
  await expect(locator).toBeVisible({timeout:15000});
  await expect(locator).toBeEnabled();
  await locator.evaluate(element=>element.scrollIntoView({block:"center"}));
  const rect=await locator.boundingBox();
  if(!rect)throw new Error("Missing visible control");
  await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
}

test("all six Cloud Hop courses are playable and unlock the next atlas page",async({page},testInfo)=>{
  await controlled(page);
  await page.goto("/festival/cloud-hop");
  await expect(page.getByRole("button",{name:"Course 2: Paper Trail, locked",exact:true})).toBeDisabled();
  await clickVisible(page,page.getByRole("button",{name:"Let’s play →"}));
  await page.clock.pauseAt(new Date("2026-09-16T02:00:00Z"));
  for(const [index,course]of fairCourses.entries()){
    for(let ring=0;ring<6;ring++){
      await expect(page.locator(".fair-objective")).toContainText(`ROUND ${ring+1} / 6`);
      await clickVisible(page,page.getByRole("button",{name:new RegExp(`^Ring ${ring+1}(,|$)`)}));
      await page.clock.runFor(220);await page.keyboard.press("Space");
      if(index>=2){await page.clock.runFor(400);await page.keyboard.press("Space");}
      await page.clock.runFor(2200);
      // Missed a moving target: approach again; a puddle returns the player to the last ring.
      if(await page.locator(".fair-objective").textContent().then(text=>text?.includes(`ROUND ${ring+1} / 6`)) && !await page.getByRole("heading",{name:"A memory made together"}).isVisible()){
        if((await page.locator(".fair-feedback").textContent())?.includes("Splash!")){
          await clickVisible(page,page.getByRole("button",{name:new RegExp(`^Ring ${ring+1}(,|$)`)}));
          await page.clock.runFor(350);
        }
        await page.keyboard.press("Space");await page.clock.runFor(400);
        if(index>=2)await page.keyboard.press("Space");
        await page.clock.runFor(2000);
      }
    }
    await expect(page.getByRole("heading",{name:"A memory made together"})).toBeVisible();
    await expect(page.getByText("Friendship stamp and best score saved on this device.")).toBeVisible();
    console.log(`Completed ${course.id}`);
    await page.screenshot({path:testInfo.outputPath(`${course.id}-complete.png`)});
    if(fairCourses[index+1]){
      await clickVisible(page,page.getByRole("button",{name:`Next course: ${fairCourses[index+1].name} →`}));
      await page.clock.runFor(320);
      await expect(page.getByRole("heading",{name:`${index+2}. ${fairCourses[index+1].name}`,exact:true})).toBeVisible();
      await clickVisible(page,page.getByRole("button",{name:"Let’s play →"}));
      await page.clock.runFor(320);
    }
  }
  await clickVisible(page,page.getByRole("button",{name:"Open sky atlas",exact:true}));
  await page.clock.runFor(320);
  await expect(page.getByRole("group",{name:"Choose a Cloud Hop course"}).getByRole("button",{disabled:true})).toHaveCount(0);
  await page.reload();await page.clock.runFor(320);
  await expect(page.getByRole("button",{name:"Course 6: Homeward Sky",exact:true})).toBeEnabled();
});

test("a partial recipe survives reload and can finish without duplicate rewards",async({page})=>{
  await page.goto("/festival/tea-time");await clickVisible(page,page.getByRole("button",{name:"Let’s play →"}));
  const choices=page.getByRole("group",{name:"Playfield choices"});
  await choices.getByRole("button",{name:"Tea",exact:true}).click();
  await choices.getByRole("button",{name:"Milk",exact:true}).click();
  await page.reload();await clickVisible(page,page.getByRole("button",{name:"Continue saved game →"}));
  await expect(choices.getByRole("button",{name:"Tea",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(choices.getByRole("button",{name:"Milk",exact:true})).toHaveAttribute("aria-pressed","true");
  await choices.getByRole("button",{name:"Honey",exact:true}).click();await page.getByRole("button",{name:"Serve tea →"}).click();
  await expect(page.locator(".fair-objective")).toContainText("ROUND 2 / 3");
  for(const recipe of [["Tea","Mint","Honey"],["Tea","Milk","Mint"]]){
    for(const ingredient of recipe)await choices.getByRole("button",{name:ingredient,exact:true}).click();
    await page.getByRole("button",{name:"Serve tea →"}).click();
  }
  await expect(page.getByText("Friendship stamp and best score saved on this device.")).toBeVisible();
  await page.reload();await expect(page.getByRole("button",{name:"Continue saved game →"})).toHaveCount(0);
  await page.goto("/festival");await expect(page.getByText("Best 375 · 1 memory made")).toBeVisible();
});

test("a feather and safe Cloud Hop checkpoint survive a short-screen reload",async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:551});await controlled(page);
  await page.goto("/festival/cloud-hop");await clickVisible(page,page.getByRole("button",{name:"Let’s play →"}));
  await page.clock.pauseAt(new Date("2026-09-16T02:00:00Z"));
  await clickVisible(page,page.getByRole("button",{name:"Walk to feather 1",exact:true}));
  await page.clock.runFor(220);await page.keyboard.press("Space");await page.clock.runFor(1800);
  if(!await page.getByRole("button",{name:"Collected feather 1",exact:true}).isVisible()) {await page.keyboard.press("Space");await page.clock.runFor(1200);}
  await expect(page.getByRole("button",{name:"Collected feather 1",exact:true})).toBeDisabled();
  await page.screenshot({path:testInfo.outputPath("cloud-feather-mobile.png")});
  await page.reload();await page.clock.runFor(320);
  await clickVisible(page,page.getByRole("button",{name:"Continue saved game →"}));await page.clock.runFor(320);
  await expect(page.getByRole("button",{name:"Collected feather 1",exact:true})).toBeDisabled();
  await expect(page.locator(".fair-objective")).toContainText("ROUND 1 / 6");
});

test("losing a game clears its earlier checkpoint instead of reviving a failed run",async({page})=>{
  await page.goto("/festival/tea-time");await clickVisible(page,page.getByRole("button",{name:"Let’s play →"}));
  const milk=page.getByRole("group",{name:"Playfield choices"}).getByRole("button",{name:"Milk",exact:true});
  for(let attempt=0;attempt<3;attempt++){
    for(let layer=0;layer<3;layer++)await milk.click();
    await page.getByRole("button",{name:"Serve tea →"}).click();
  }
  await expect(page.getByRole("heading",{name:"Another try, little friend?"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button",{name:"Let’s play →"})).toBeEnabled();
  await expect(page.getByRole("button",{name:"Continue saved game →"})).toHaveCount(0);
});
