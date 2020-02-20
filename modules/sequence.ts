import { Page, Response } from "puppeteer";
import * as utils from "./utils";
import path from "path";
import { WafTest } from "./waf-test";
import { Chrome } from "./chrome";
import EventEmitter from "events";
import {Logger} from "./logger";
import {Expect, SequenceTestWriter} from "./sequenceTestWriter";

export const BLOCK_EVENT = "block";
export const ERROR_EVENT = "error";
export const NEW_TESTCASE = "new_testcase";

export class SequenceTest {

    page: Page;
    outputPath: string;
    outputFile: string;
    protected filterDomain: string;
    protected testCaseWriter: SequenceTestWriter;

    protected headers = [
        {id: 'description', title: 'Description'},
        {id: 'url', title: 'Url'},
        {id: 'body', title: 'Body'},
        {id: 'status', title: 'Status'},
        {id: 'expect', title: 'Expect'},
        {id: 'result', title: 'Result'}
    ];

    protected eventEmitter: EventEmitter;

    constructor(protected chrome: Chrome, protected _argv: WafTest.ISequenceConfig) {
        const { output } = this._argv;
        this.outputPath = utils.getAbsolutePath(output);
        this.outputFile = path.join(this.outputPath, this.constructor.name + '.csv');
        this.testCaseWriter = new SequenceTestWriter(this.outputFile);

        this.page = chrome.page;
    }

    registerEventListener() {
        this.page.on('response', async (res: Response) => {
            let isBlock = false;

            // ignore other domains
            let domain = (new URL(res.url())).host;
            if (this.filterDomain && !domain.endsWith(this.filterDomain))
                return;

            let req = await res.request();
            this._argv.verbose >= 1 && console.log(req.method(), res.url(), res.status());

            if (res.status() === 403) {
                // blocked by polaris
                isBlock = true;
                this.emit(BLOCK_EVENT, res.url());
            }

            this.testCaseWriter.appendData({
                url: res.url(),
                body: req.postData(),
                status: res.status(),
                expect: "PASS",
                result: isBlock ? "FAILED" : "SUCCESS"
            });
        });

        this.eventEmitter = new EventEmitter();

        this.on(ERROR_EVENT, (testCase, ...args) => {
            Logger.red(`[x] Test case ${testCase} ${args.join(" ")} failed`);
        });

        this.on(BLOCK_EVENT, url => {
            Logger.red(`[x] Blocked in url ${url}`);
        });

        this.on(NEW_TESTCASE, async (testCase, expect, ...params) => {
            await this.onNewTestCase(testCase, expect, ...params);
        });
    }

    async onNewTestCase(testCase, expect, ...params) {
        await this.testCaseWriter.newTestCase(testCase + " " + params.join(" "), expect);
    }

    public setFilterDomain(domain: string) {
        this.filterDomain = domain;
    }

    public async run() {
        Logger.yellow("[+] Begin test " + this.constructor.name);

        // open new page
        this.page = await this.chrome.newPage();
        this.registerEventListener();
        await utils.createFolderIfNotExist(this.outputPath);
        await utils.removeFileIfExists(this.outputFile);
    }

    public emit(eventName: string, ...args) {
        this.eventEmitter.emit(eventName, ...args);
    }

    public on(eventName: string, handler) {
        this.eventEmitter.on(eventName, handler);
    }
}

// method decorator
export function TestCase(testName: string, expect: Expect = "PASS") {
    return function (target, propertyKey: string, descriptor: PropertyDescriptor) {
        let originalMethod: Function = descriptor.value;
        descriptor.value = async function (...args) {
            Logger.green("[+] TestCase: " + testName, ...args);
            this.emit(NEW_TESTCASE, testName, expect, ...args);
            try {
                return await originalMethod.apply(this, args);
            }
            catch (err) {
                Logger.red("[x] Error in TestCase: " + testName, ...args);
                this._argv.verbose >= 1 && Logger.red(err);
                this.emit(ERROR_EVENT, testName);
            }
        }
    }
}

export function PrintSummary() {
    return function (target, propertyKey: string, descriptor: PropertyDescriptor) {
        let originalMethod: Function = descriptor.value;
        descriptor.value = async function (...args) {
            await originalMethod.apply(this, args);
            Logger.yellow(JSON.stringify(this.testCaseWriter.getSummaryInfo()));
        }
    }
}