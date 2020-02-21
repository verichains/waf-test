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
        {id: 'result', title: 'Result'},
        {id: 'message', title: 'Message'}
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
            result: "FAILED",
            message: ""
        };

        this.numTest++;
    }

    public appendData(data: ITestCaseData) {
        if (this.currentTest) {
            this.currentTest.data.push(data);
        }
    }

    public async commit(error = "") {
        if (!this.currentTest) {
            return;
        }

        let result: Result = this.currentTest.data.every(i => i.result === this.currentTest.expect)? "SUCCESS": "FAILED";
        if (error) result = "FAILED";

        if (result === "SUCCESS") this.numTestPass++;

        await utils.appendCSV(this.filePath, this.headers, {
            description: this.currentTest.description,
            expect: this.currentTest.expect,
            result,
            message: error
        });

        if (result !== "SUCCESS") {
            await Promise.all(this.currentTest.data.map(item => {
                return utils.appendCSV(this.filePath, this.headers, item);
            }));
        }

        this.currentTest = null;
    }

}

export type Expect = "BLOCK" | "PASS" | "ERROR";
export type Result = "FAILED" | "SUCCESS";

export interface ITestCase {
    description: string;
    data: ITestCaseData[];
    expect: Expect;
    result: Result;
    message: string;
}

export interface ITestCaseData {
    url?: string;
    body?: string;
    status?: number;
    result?: Expect;
}

export interface ISummaryInfo {
    totalTest: number;
    numPassTest: number;
    numFailTest: number;
    date: Date;
}
