import { Browser, Page, DirectNavigationOptions, Response } from "puppeteer";
import * as Cookie from "cookie";
import puppeteer from "puppeteer-extra";
import path from "path";
import * as utils from "../modules/utils";
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

export class Chrome {

    public browser: Browser;
    public page: Page;
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
        this.browser = await puppeteer.launch({ headless: this._argv.headless });
        this.page = await this.newPage();

        this.page.on('dialog', async dialog => {
            if (this._argv.ignoreDialog) {
                setTimeout(() => {
                    dialog.dismiss();
                }, 1000);
            }
            else {
                dialog.dismiss();
            }
        });
        this._argv.verbose >= 1 && console.log('[+] Chromium opened');
    }

    async closeBrowser() {
        await this.browser.close();
    }

    async newPage(): Promise<Page> {
        if (this.page && !this.page.isClosed()) {
            await this.page.close();
        }
        this.page = await this.browser.newPage();

        return this.page;
    }

    async submit(inputs: Chrome.ISubmitInput[], submitSelector: string) {
        await Promise.all(inputs.map(item => this.page.waitForSelector(item.selector)));

        await this.page.evaluate((inputs, submitSelector) => {
            inputs.forEach(item => {
                document.querySelector(item.selector).value = item.payload;
            });
            document.querySelector(submitSelector).click();

        }, inputs as any, submitSelector);
    }

    async clearSiteData() {
        const client = await this.page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
    }

    async goTo(url: string, options?: DirectNavigationOptions): Promise<Response> {
        let response = await this.page.goto(url, options);
        if (response) return response;
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
        }
        else if (!Array.isArray(_cookies)) cookies = [_cookies];

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

    async findElementContainText(selector: string, searchString: string) {
        await this.page.waitForSelector(selector);

        let elements = await this.page.$$(selector);
        for (let ele of elements) {
            let textContent = await ele.evaluate(e => { return e.textContent });
            if (textContent.toLowerCase().includes(searchString.toLowerCase())) {
                return ele;
            }
        }

        return null;
    }

    async getElementProperty(selector: string, propertyName: string) {
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