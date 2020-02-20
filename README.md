# WAF Test Tool

Web Application Automation Testing Tool

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Installing

Install waf-test package

```
yarn add waf-test
```

Create tsconfig.json file

```json
{
  "compilerOptions": {
    "target": "ES5",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "module": "commonjs",
    "allowJs": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "downlevelIteration": true
  }
}
```

### Create testcase files

Create entry point index.ts

```ts
import { WafTest } from "waf-test";

(async () => {
  let wafTest = new WafTest();
  await wafTest.run();
})();
```

Create testcases folder and add testcase files. Ex: example_testcases/google.ts

```ts
import { PrintSummary, SequenceTest, TestCase } from "../modules/sequence";
import { Logger } from "../modules/logger";

export default class Google extends SequenceTest {
  async run() {
    await super.run();
    await this.setFilterDomain("google.com");

    await this.goToHome();
    let results = await this.search("corona");

    Logger.green(results);
  }

  @TestCase("Go to home page")
  async goToHome() {
    await this.chrome.goTo("https://google.com", { waitUntil: "networkidle2" });
  }

  @TestCase("Search for")
  async search(keyword) {
    let searchInput = await this.chrome.$("input[name=q]");
    await searchInput.type(keyword);
    await this.page.keyboard.press("Enter");
    await this.page.waitForNavigation({ waitUntil: "networkidle2" });
    return await this.chrome.getElementProperties(".r > a[ping]", "href");
  }
}
```

### Get Help

```
> ts-node index.ts --help
```

Output

```
index.ts

Sequence testing

Options:
  --version      Show version number                                   [boolean]
  --output, -o   output directory                [string] [default: "./outputs"]
  --help, -h     Show help                                             [boolean]
  --headless     run headless mode or not             [boolean] [default: false]
  --test, -t     location of test file                                  [string]
  -v, --verbose  verbose                                                 [count]
```

### Running test

```bash
> ts-node index.ts -t ./example_testcases/google.ts
```

Output

```
Running test with headless is off
[+] Running /mnt/shared-data/project/polaris/waf-test/example_testcases/google.ts ...
[+] Begin test Google
[+] TestCase: Go to home page
[+] TestCase: Search for corona
https://www.who.int/health-topics/coronavirus,https://www.who.int/emergencies/diseases/novel-coronavirus-2019,https://www.worldometers.info/coronavirus/,https://www.ft.com/content/d8b7ce82-5276-11ea-8841-482eed0038b1,https://www.livescience.com/what-are-coronaviruses.html,https://spaceplace.nasa.gov/sun-corona/en/,https://en.wikipedia.org/wiki/Corona,https://en.wikipedia.org/wiki/Corona_(beer),https://www.highnorthnews.com/en/corona-virus-high-north-may-have-major-consequences
```

After running tests, you can see output at `./outputs` folder

## Built With

- [Node.js](https://nodejs.org/en/) - Javascript runtime
- [Puppeteer](https://github.com/puppeteer/puppeteer) - Headless browser

## Authors

- **Ngoc Tin** - _Initial work_ - [my github repo](https://github.com/ngoctint1lvc)
