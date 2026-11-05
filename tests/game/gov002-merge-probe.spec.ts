import { expect, test } from "@playwright/test";

// Deliberate negative control for GOV-002. This branch must never enter main.
test("GOV-002 required-check failure must block an ordinary merge", () => {
  expect("intentional failing probe").toBe("merge must be refused");
});
