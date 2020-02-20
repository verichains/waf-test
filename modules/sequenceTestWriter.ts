import * as utils from "./utils";

export class SequenceTestWriter {

    protected filePath: string;
    protected currentTest: ITestCase;
    protected numTest = 0;
    protected numTestPass = 0;
    protected date: Date;

    protected headers = [
        {id: 'description', title: 'Description'},
        {id: 'url', title: 'Url'},
        {id: 'body', title: 'Body'},
        {id: 'status', title: 'Status'},
        {id: 'expect', title: 'Expect'},
        {id: 'result', title: 'Result'}
    ];

    constructor(filePath) {
        this.filePath = filePath;
        this.date = new Date();
    }

    public getCurrentTest() {
        return this.currentTest;
    }

    public getSummaryInfo(): ISummaryInfo {
        return {
            totalTest: this.numTest,
            numPassTest: this.numTestPass,
            numFailTest: this.numTest - this.numTestPass,
            date: this.date
        }
    }

    public async newTestCase(description: string, expect: Expect = "PASS") {
        if (this.currentTest) {
            await this.commit();
        }

        this.currentTest = {
            description,
            data: [],
            expect,
            result: "FAILED"
        };

        this.numTest++;
    }

    public appendData(data: ITestCaseData) {
        if (this.currentTest) {
            this.currentTest.data.push(data);
        }
    }

    protected async commit() {
        let result: Result = this.currentTest.data.every(i => i.expect === this.currentTest.expect)? "SUCCESS": "FAILED";

        if (result === "SUCCESS") this.numTestPass++;

        await utils.appendCSV(this.filePath, this.headers, {
            description: this.currentTest.description,
            expect: this.currentTest.expect,
            result
        });

        await Promise.all(this.currentTest.data.map(item => {
            return utils.appendCSV(this.filePath, this.headers, item);
        }));

        this.currentTest = null;
    }

}

export type Expect = "BLOCK" | "PASS";
export type Result = "FAILED" | "SUCCESS";

export interface ITestCase {
    description: string;
    data: ITestCaseData[];
    expect: Expect;
    result: Result;
}

export interface ITestCaseData {
    url?: string;
    body?: string;
    status?: number;
    expect?: Expect;
    result?: Result;
}

export interface ISummaryInfo {
    totalTest: number;
    numPassTest: number;
    numFailTest: number;
    date: Date;
}
