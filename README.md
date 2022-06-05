# Playwright DOMPath 🎭

This library implements the ChromeDevTools DOMPath functionality in Playwright.

This means that you can retrieve the CSS selector or the XPath of any element you select in your Playwright code.

## Installation 📦

Install with npm

```bash
  npm install playwright-dompath
```

## API Reference 📚

#### cssPath

```typescript
cssPath: (elHandle: Playwright.ElementHandle, optimized?: boolean) => Promise<string>
```

#### xPath

```typescript
xPath: (elHandle: Playwright.ElementHandle, optimized?: boolean) => Promise<string>
```

## Usage 🔧

Just import the `cssPath` or `xPath` from this module:

```typescript
import { cssPath, xPath } from "playwright-dompath";
```

Then use either function by passing it the element you previously selected:

```typescript
const searchBar = await page.$('input[name="q"]');
console.log("CSS Path:", await cssPath(searchBar));
console.log("XPath:", await xPath(searchBar));
```

_Since these functions return a promise, make sure to `await` the call (of course, you can also use the `.then` syntax instead. You do you.)_

## Full Example 🎁

```typescript
import { chromium } from "playwright";
import { cssPath, xPath } from "playwright-dompath";

  const url = "https://google.com";
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  const searchBar = await page.$('input[name="q"]');
  console.log("CSS Path:", await cssPath(searchBar));
  console.log("XPath:", await xPath(searchBar));
  }
  await browser.close();
};
```

Which will output (class names may vary for you):

```bash
CSS Path: body > div.L3eUgb > div.o3j99.ikrT4e.om7nvf > form > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input
XPath: /html/body/div[1]/div[3]/form/div[1]/div[1]/div[1]/div/div[2]/input
```

## Acknowledgements 🤗

- This library reimplements the [Chrome DevTools DOMPath library](https://github.com/ChromeDevTools/devtools-frontend/blob/b6a3b2ae8a4c1d5847c2bb1535377e13ee3045be/front_end/panels/elements/DOMPath.ts) with modifications to allow the use of Playwright's ElementHandle

## License 📝

[MIT](https://choosealicense.com/licenses/mit/)
