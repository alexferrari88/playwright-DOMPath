import { expect, test } from "@playwright/test";
import { cssPath } from "../src/DOMPath";

test.describe("playwright-DOMPath", () => {
  test.describe("cssPath", () => {
    test("should return the correct path for id", async ({ page }) => {
      await page.goto(pageFromTemplate(`<div id="test">test</div>`));
      const div = await page.$("#test");
      const path = await cssPath(div);
      await expect(path).toBe("div#test");
    });
    test("should return the correct path for single class", async ({
      page,
    }) => {
      await page.goto(
        pageFromTemplate(`<div class="test">test</div><div>test2</div>`)
      );
      const div = await page.$(".test");
      const path = await cssPath(div);
      await expect(path).toBe("html > body > div.test");
    });
    test("should return the correct path for multiple classes", async ({
      page,
    }) => {
      await page.goto(
        pageFromTemplate(`<div class="tst test">test</div><div>test2</div>`)
      );
      const div = await page.$(".test");
      const path = await cssPath(div);
      await expect(path).toBe("html > body > div.tst.test");
    });
    test("should return the correct path for nested classes", async ({
      page,
    }) => {
      await page.goto(
        pageFromTemplate(
          `<div class="main">main<div class="child">child</div><div></div></div>`
        )
      );
      const div = await page.$(".main .child");
      const path = await cssPath(div);
      await expect(path).toBe("html > body > div > div.child");
    });
    test("should return the correct path for multiple elements", async ({
      page,
    }) => {
      await page.goto(
        pageFromTemplate(`<div>test1</div><div>test2</div><div>test3</div>`)
      );
      const divs = await page.$$("div");
      for (let i = 0; i < divs.length; i++) {
        const path = await cssPath(divs[i]);
        await expect(path).toBe(`html > body > div:nth-child(${i + 1})`);
      }
    });
    test("should return the correct path for nested element", async ({
      page,
    }) => {
      await page.goto(pageFromTemplate(`<div><div>test</div></div>`));
      const div = await page.$("div > div");
      const path = await cssPath(div);
      await expect(path).toBe("html > body > div > div");
    });
  });
  test.describe("xPath", () => {
    test("should return the correct path for id", async ({ page }) => {
      await page.goto(pageFromTemplate(`<div id="test">test</div>`));
      const div = await page.$("#test");
      const path = await xPath(div);
      await expect(path).toBe("div#test");
    });
    test("should return the correct path for single class", async ({
      page,
    }) => {
      await page.goto(
        pageFromTemplate(`<div class="test">test</div><div>test2</div>`)
      );
      const div = await page.$(".test");
      const path = await xPath(div);
      await expect(path).toBe("html > body > div.test");
    });
    test("should return the correct path for multiple classes", async ({
      page,
    }) => {
      await page.goto(
        pageFromTemplate(`<div class="tst test">test</div><div>test2</div>`)
      );
      const div = await page.$(".test");
      const path = await xPath(div);
      await expect(path).toBe("html > body > div.tst.test");
    });
    test("should return the correct path for nested classes", async ({
      page,
    }) => {
      await page.goto(
        pageFromTemplate(
          `<div class="main">main<div class="child">child</div><div></div></div>`
        )
      );
      const div = await page.$(".main .child");
      const path = await xPath(div);
      await expect(path).toBe("html > body > div > div.child");
    });
    test("should return the correct path for multiple elements", async ({
      page,
    }) => {
      await page.goto(
        pageFromTemplate(`<div>test1</div><div>test2</div><div>test3</div>`)
      );
      const divs = await page.$$("div");
      for (let i = 0; i < divs.length; i++) {
        const path = await xPath(divs[i]);
        await expect(path).toBe(`html > body > div:nth-child(${i + 1})`);
      }
    });
    test("should return the correct path for nested element", async ({
      page,
    }) => {
      await page.goto(pageFromTemplate(`<div><div>test</div></div>`));
      const div = await page.$("div > div");
      const path = await xPath(div);
      await expect(path).toBe("html > body > div > div");
    });
  });
});

/**
 * Turns a HTML template into a data URL Playwright can navigate to without having to use a web server
 * Adapted from: https://github.com/Georgegriff/query-selector-shadow-dom/blob/main/test/protractor-locator.e2e.js
 *
 * @param {string} template
 * @returns {string}
 */
function pageFromTemplate(template /* string */) /* string */ {
  return `data:text/html;charset=utf-8,<!DOCTYPE html>
        <html>
            <body>
                ${template}
            </body>
        </html>`.replace(/[\s\n]+/s, " ");
}
