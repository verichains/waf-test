import * as utils from "./utils";
import {ISummaryInfo, ITestCaseWriter, Result, TestCaseData} from "./sequence";

export class SequenceTestWriter implements ITestCaseWriter {

    protected filePath: string;
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

    constructor(filePath: string) {
        this.filePath = filePath;
        this.date = new Date();
    }

    public getSummaryInfo(): ISummaryInfo {
        return {
            totalTest: this.numTest,
            numPassTest: this.numTestPass,
            numFailTest: this.numTest - this.numTestPass,
            date: this.date
        }
    }

    public async addTestCase(data: TestCaseData) {
        let result: Result = data.responses.every(i => i.result === data.expect) ? "SUCCESS": "FAILED";
        if (data.error) result = "FAILED";

        this.numTest++;
        if (result === "SUCCESS") this.numTestPass++;

        await utils.appendCSV(this.filePath, this.headers, {
            description: data.name + " " + data.params.join(", "),
            expect: data.expect,
            result,
            message: data.error
        });

        // write detail info for failed test case
        if (result !== "SUCCESS") {
            await Promise.all(data.responses.map(item => {
                return utils.appendCSV(this.filePath, this.headers, {
                    url: item.url,
                    body: item.body,
                    status: item.status,
                    expect: data.expect,
                    result: item.result
                });
            }));
        }
    }
}
