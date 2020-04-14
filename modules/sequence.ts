import {Response} from "puppeteer";
import * as utils from "./utils";
import * as path from "path";
import {WafTest} from "./waf-test";
import {Chrome} from "./chrome";
import {Logger} from "./logger";
import {SequenceTestWriter} from "./sequenceTestWriter";

export type Status = "BLOCK" | "PASS" | "ERROR";
export type Result = "FAILED" | "SUCCESS";

export interface IResponse {
  url: string;
  body: string;
  status: number;
  result: Status;
}

export class TestCaseData {

  name: string;
  params: string[];
  responses: IResponse[] = [];
  expect: Status;
  error: any;

  constructor(name: string, expect: Status = "PASS", params = []) {
    this.name = name;
    this.expect = expect;
    this.params = params;
  }
}

export interface ISummaryInfo {
  totalTest: number;
  numPassTest: number;
  numFailTest: number;
  date: Date;
}

export interface ITestCaseWriter {

  addTestCase(data: TestCaseData): Promise<any>;

  getSummaryInfo(): ISummaryInfo;

}

export class SequenceTest {
  outputPath: string;
  outputFile: string;

  protected filterDomain: string;
  protected testCaseWriter: ITestCaseWriter;
  protected currentTestCase: TestCaseData;

  constructor(protected chrome: Chrome, protected _argv: WafTest.ISequenceConfig) {
  }

  get page() {
    return this.chrome.page;
  }

  set page(value) {
    this.chrome.page.removeAllListeners();
    this.chrome.page = value;
    this.registerEventListener();
  }

  printSummary() {
    let summaryInfo = this.testCaseWriter.getSummaryInfo();
    console.log();
    Logger.yellow("[i] Summary Information");
    for (let key in summaryInfo) {
      Logger.yellow(`${key}: ${summaryInfo[key]}`);
    }
    console.log();
  }

  registerEventListener() {
    this.page.on('response', async (res: Response) => {
      let result: Status = "PASS";
      let status = res.status();
      let url = res.url();

      // ignore other domains
      let domain = (new URL(url)).host;
      if (this.filterDomain && !domain.endsWith(this.filterDomain))
        return;

      let req = await res.request();
      this._argv.verbose >= 1 && console.log(req.method(), url, status);


      if (status === 403) {
        // blocked by polaris
        Logger.red(`[x] Blocked in url ${url}`);
        result = "BLOCK";
      } else if (status >= 400 && status !== 404) {
        Logger.red(`[x] Error in url ${url}`);
        result = "ERROR";
      }

      this.currentTestCase && this.currentTestCase.responses.push({
        url: res.url(),
        body: req.postData(),
        status: res.status(),
        result: result
      });
    });
  }

  public setFilterDomain(domain: string) {
    this.filterDomain = domain;
  }

  public async run() {
    const {output} = this._argv;
    this.outputPath = utils.getAbsolutePath(output);
    this.outputFile = path.join(this.outputPath, this.constructor.name + '.csv');
    this.testCaseWriter = new SequenceTestWriter(this.outputFile);

    Logger.yellow("[+] Begin test " + this.constructor.name);

    // open new page
    this.page = await this.chrome.newPage();
    this.registerEventListener();
    await utils.createFolderIfNotExist(this.outputPath);
    await utils.removeFileIfExists(this.outputFile);
  }
}

// method decorator
export function TestCase(testName: string, expect: Status = "PASS") {
  return function (target, propertyKey: string, descriptor: PropertyDescriptor) {
    let originalMethod: Function = descriptor.value;
    descriptor.value = async function (...args) {
      Logger.green("[+] TestCase: " + testName, ...args);

      this.currentTestCase = new TestCaseData(testName, expect, args);

      let result;
      try {
        result = await originalMethod.apply(this, args);
      } catch (err) {
        Logger.red("[x] Error in TestCase: " + testName, ...args);
        console.log('vztlog (sequence.ts:value) verbose level ', this._argv.verbose);

        this._argv.verbose >= 1 && console.trace(err);

        this.currentTestCase.error = err;
      }

      if (this.testCaseWriter) {
        await this.testCaseWriter.addTestCase(this.currentTestCase);
      }

      return result;
    }
  }
}