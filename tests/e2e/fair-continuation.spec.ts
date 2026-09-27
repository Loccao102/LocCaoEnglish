import { test } from "./fair-fixture";
import { expect, type Locator, type Page } from "@playwright/test";

async function click(page:Page,control:Locator){
  await expect(control).toBeVisible({timeout:15000});await expect(control).toBeEnabled();
  await control.evaluate(element=>element.scrollIntoView({block:"center",behavior:"instant"}));
  const box=(await control.boundingBox())!;await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
}

test("the journey opens the next sky page and the fair returns to an unfinished course",async({page},testInfo)=>{
  test.setTimeout(180000);
  await page.clock.install({time:new Date("2026-09-16T00:00:00Z")});
  await page.addInitScript(()=>{window.requestAnimationFrame=callback=>window.setTimeout(()=>callback(performance.now()),160);window.cancelAnimationFrame=handle=>window.clearTimeout(handle);});
  await page.goto("/festival/cloud-hop");await click(page,page.getByRole("button",{name:"Let’s play →"}));
  await page.clock.pauseAt(new Date("2026-09-16T02:00:00Z"));
  for(let ring=0;ring<6;ring++){
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${ring+1} / 6`);
    await click(page,page.getByRole("button",{name:`Ring ${ring+1}`,exact:true}));
    await page.clock.runFor(ring===1||ring===4?240:350);await page.keyboard.press("Space");await page.clock.runFor(2400);
  }
  await expect(page.getByText("Friendship stamp and best score saved on this device.")).toBeVisible();
  await page.goto("/journey");await page.clock.runFor(320);
  const atlas=page.getByRole("region",{name:"Sky atlas journey"});
  await expect(atlas).toContainText("1 / 6 pages · 2 / 18 badges");
  await expect(atlas.getByRole("heading",{name:"Paper Trail"})).toBeVisible();
  await expect(atlas.getByRole("link",{name:"Explore this trail →"})).toHaveAttribute("href","/festival/cloud-hop?course=cloud-02");
  // Let navigation settle with a running clock; a prefetched production route can
  // commit after the old fixed 320 ms window and otherwise remain frozen on CI.
  await page.clock.resume();await click(page,atlas.getByRole("link",{name:"Explore this trail →"}));
  await expect(page).toHaveURL(/course=cloud-02/);
  await expect(page.getByRole("heading",{name:"2. Paper Trail",exact:true})).toBeVisible({timeout:15000});
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+10_000));
  await click(page,page.getByRole("button",{name:"Let’s play →"}));await page.clock.runFor(320);
  await click(page,page.getByRole("button",{name:"Ring 1",exact:true}));await page.clock.runFor(350);await page.keyboard.press("Space");await page.clock.runFor(2400);
  await expect(page.locator(".fair-objective")).toContainText("ROUND 2 / 6");
  await page.clock.resume();await click(page,page.getByRole("link",{name:"Leave game and return to the fair"}));
  const resume=page.getByRole("region",{name:"Games to continue"});
  await expect(resume).toContainText("Round 2 of 6");
  await expect(resume.getByRole("link",{name:"Continue Cloud Hop: Paper Trail"})).toHaveAttribute("href","/festival/cloud-hop?course=cloud-02");
  await page.goto("/festival/cloud-hop");await page.clock.runFor(320);
  await expect(page.getByRole("heading",{name:"2. Paper Trail",exact:true})).toBeVisible();
  await click(page,page.getByRole("button",{name:"Continue saved game →"}));await page.clock.runFor(320);
  await expect(page.locator(".fair-objective")).toContainText("ROUND 2 / 6");
  await page.goto("/festival/cloud-hop?course=cloud-06");await page.clock.runFor(320);
  await expect(page.getByRole("heading",{name:"2. Paper Trail",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Course 6: Homeward Sky, locked",exact:true})).toBeDisabled();
  await page.goto("/festival/cloud-hop?course=cloud-01");await page.clock.runFor(320);
  await expect(page.getByRole("heading",{name:"1. First Flight",exact:true})).toBeVisible();
  await page.evaluate(()=>window.history.pushState(null,"","?course=cloud-02"));
  await expect(page.getByRole("heading",{name:"2. Paper Trail",exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading",{name:"1. First Flight",exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});await page.goto("/journey");await page.clock.runFor(320);
  await expect(atlas).toContainText("1 / 6 pages");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await atlas.screenshot({path:testInfo.outputPath("sky-atlas-journey-mobile.png")});
});

test("resume cards follow the signed-in identity and keep the guest checkpoint separate",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/festival/tea-time");await page.getByRole("button",{name:"Let’s play →"}).click();
  await page.getByRole("group",{name:"Playfield choices"}).getByRole("button",{name:"Tea",exact:true}).click();
  await page.getByRole("link",{name:"Leave game and return to the fair"}).click();
  await expect(page.getByRole("link",{name:"Continue Tea Time",exact:true})).toBeVisible();
  await page.goto("/account");await page.getByRole("button",{name:"Create account",exact:true}).click();
  await page.getByLabel("Display name").fill("Atlas Explorer");
  await page.getByLabel("Email",{exact:true}).fill(`atlas-resume-${Date.now()}@example.test`);
  await page.getByLabel("Password",{exact:true}).fill("SunlitTest123!");
  await page.locator("form").getByRole("button",{name:"Create account",exact:true}).last().click();
  await page.getByRole("link",{name:"Continue account adventure →"}).click();
  await expect(page.getByText(/Atlas Explorer’s scrapbook/)).toBeVisible();
  await expect(page.getByRole("region",{name:"Games to continue"})).toHaveCount(0);
  await page.goto("/account");await page.getByRole("button",{name:"Play as guest"}).click();
  await page.goto("/festival");await page.getByRole("link",{name:"Continue Tea Time",exact:true}).click();
  await page.getByRole("button",{name:"Continue saved game →"}).click();
  await expect(page.getByRole("group",{name:"Playfield choices"}).getByRole("button",{name:"Tea",exact:true})).toHaveAttribute("aria-pressed","true");
});
