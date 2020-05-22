import {Browser, DirectNavigationOptions, ElementHandle, Page, Permission, Response} from "puppeteer";
import * as Cookie from "cookie";
import puppeteer from "puppeteer-extra";
import path from "path";
import * as utils from "../modules/utils";

const useProxy = require('puppeteer-page-proxy');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

export interface IProxyConfig {
  host: string;
  port: string | number;
  auth?: string;
}

export class Chrome {

  public browser: Browser;
  public page: Page;
  public previousPage: Page;
  public screenShotPath: string;

  constructor(private _argv?: Chrome.IConfig) {
    if (!_argv) {
      this._argv = {
        headless: false,
        ignoreDialog: true,
        verbose: 1,
        output: './outputs'
      }
    }

    this.screenShotPath = path.join(utils.getAbsolutePath(this._argv.output), "screenshots");
  }

  async openBrowser() {
    this._argv.verbose >= 1 && console.log('[+] Initializing chromium browser ...');
    console.log(`Running test with headless is ${this._argv.headless ? 'on' : 'off'}`);
    this.browser = await puppeteer.launch({headless: this._argv.headless});
    this.page = await this.newPage();

    this.page.on('dialog', async dialog => {
      if (this._argv.ignoreDialog) {
        setTimeout(() => {
          dialog.dismiss();
        }, 1000);
      } else {
        dialog.dismiss();
      }
    });
    this._argv.verbose >= 1 && console.log('[+] Chromium opened');
  }

  async closeBrowser() {
    await this.browser.close();
  }

  async newPage(replace: boolean = false): Promise<Page> {
    if (this.page && !this.page.isClosed() && replace) {
      await this.page.close();
    }
    this.previousPage = this.page;
    this.page = await this.browser.newPage();

    return this.page;
  }

  async clonePage(): Promise<Page> {
    const url = await this.page.url();
    const page = await this.newPage();
    await page.goto(url);
    return page;
  }

  async backToPreviousPage() {
    if (this.previousPage && !this.previousPage.isClosed()) {
      !this.page.isClosed() && await this.page.close();
      this.page = this.previousPage;
      this.previousPage = null;
    }
  }


  async getCurrentIP() {
    let newTab = await this.browser.newPage();

    try {
      await newTab.goto('https://ifconfig.co/ip');
      return await newTab.evaluate(e => document.body.innerText);
    } catch (e) {
      await newTab.goto('https://whatismyipaddress.com/');
      return await this.$('#ipv4>a').then(s => s.evaluate(e => e.textContent.trim()));
    } finally {
      await newTab.close();
    }
  }

  async grantPermission(url: string, permission: Permission[]) {
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions(url, permission);
  }

  async submit(inputs: Chrome.ISubmitInput[], submitSelector: string) {
    await Promise.all(inputs.map(item => this.page.waitForSelector(item.selector)));

    await this.page.evaluate((inputs, submitSelector) => {
      inputs.forEach(item => {
        document.querySelector(item.selector).value = item.payload;
      });
      document.querySelector(submitSelector).click();

    }, inputs as any[], submitSelector);
  }

  async clearSiteData(page: Page = this.page) {
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    await page.evaluate(() => {
      localStorage.clear();
    });
  }

  async goTo(url: string, options?: DirectNavigationOptions): Promise<Response> {
    let response = await this.page.goto(url, options);
    if (response) return response;
  }

  async useProxy(config: IProxyConfig) {
    const {host, port = 80, auth} = config;
    const proxy = `http://${auth ? auth + '@' : ''}${host}:${port}`;
    await useProxy(this.page, proxy);
  }

  async click(selector: string) {
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
  }

  getResponseHeader(timeout = 7000): Promise<Record<string, string> | null> {
    return new Promise((resolve, reject) => {
      const onResponse = (response: Response) => {
        this.page.removeListener("response", onResponse);
        resolve(response.headers());
      }

      this.page.on("response", onResponse);
      setTimeout(() => {
        this.page.removeListener("response", onResponse);
        resolve(null);
      }, timeout);
    });

  }

  async setCookie(_cookies: Chrome.ICookieItem[] | Chrome.ICookieItem | string) {
    let cookies;
    if (typeof _cookies === "string") {
      cookies = Cookie.parse(_cookies);
      cookies = Object.keys(cookies).map(key => {
        return {
          name: key,
          value: cookies[key]
        }
      });
    } else if (!Array.isArray(_cookies)) cookies = [_cookies];
    else cookies = _cookies;

    await Promise.all(cookies.map(i => {
      return this.page.setCookie({
        name: i.name,
        value: i.value
      })
    }));
  }

  async takeScreenshot(fileName) {
    utils.createFolderIfNotExist(this.screenShotPath);
    let filePath = path.join(this.screenShotPath, fileName);
    utils.createFolderIfNotExist(path.dirname(filePath));
    await this.page.screenshot({
      path: filePath
    })
  }

  async $(selector: string) {
    await this.page.waitForSelector(selector);
    return await this.page.$(selector);
  }

  async $$(selector: string) {
    await this.page.waitForSelector(selector);
    return await this.page.$$(selector);
  }

  async findElementContainText(selector: string, searchString: string, timeout = 15000, exact: boolean = false) {
    let waitTime = 0;
    while (waitTime < timeout) {
      let elements = await this.$$(selector);
      for (let ele of elements) {
        let textContent = await ele.evaluate(e => {
          return e.textContent
        });
        if (exact) {
          if (textContent.toLowerCase().trim() === searchString.toLowerCase().trim()) {
            return ele;
          }
        } else {
          if (textContent.toLowerCase().includes(searchString.toLowerCase())) {
            return ele;
          }
        }
      }

      await this.page.waitFor(1000);
      waitTime += 1000;
      this._argv.verbose >= 2 && console.log('debug', waitTime);
    }

    throw `Error in Chrome.findElementContainText: timeout! "${selector}" not found`;
  }

  async getElementProperty(selector: string, propertyName: string): Promise<any> {
    return await this.$(selector)
      .then(value => value.getProperty(propertyName))
      .then(value => value.jsonValue());
  }

  async getElementProperties(selector: string, propertyName: string): Promise<any[]> {
    return await this.$$(selector)
      .then(values => Promise.all(values.map(i => i.getProperty(propertyName))))
      .then(values => Promise.all(values.map(i => i.jsonValue())));
  }

  async scrollToEnd() {
    let scroll = 0;
    let oldScroll;

    do {
      oldScroll = scroll;
      scroll = await this.page.evaluate(() => {
        window.scrollBy(0, document.body.scrollHeight);
        return scrollY;
      });

      await this.page.waitFor(3000);
    }
    while (scroll > oldScroll);
  }

  async getPageHtml() {
    return await this.page.evaluate(() => {
      return document.body.innerHTML;
    });
  }

  async deleteText(element: ElementHandle) {
    await element.focus();
    const control = process.platform === "darwin" ? "Command" : "Control";
    await this.page.keyboard.down(control);
    await this.page.keyboard.press('A');
    await this.page.keyboard.up(control);
    await this.page.keyboard.press('Backspace');
  }

  async replaceText(element: ElementHandle, text: string) {
    await this.deleteText(element);
    await element.type(text);
    return element;
  }
}

export namespace Chrome {
  export interface ISubmitInput {
    selector: string;
    payload: string;
  }

  export interface ICookieItem {
    name: string,
    value: string
  }

  export interface IConfig {
    headless: boolean;
    ignoreDialog: boolean;
    verbose: number;
    output: string;
  }
}
