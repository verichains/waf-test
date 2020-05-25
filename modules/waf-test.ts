import * as yargs from "yargs";
import {promisify} from 'util';
import {Chrome} from './chrome';
import * as utils from "./utils";
import {Logger} from "./logger";

export namespace WafTest {

  export interface ISequenceConfig {
    command: string;
    verbose: number;
    output: string;
    ignoreDialog: boolean;
    headless: boolean;
    logAllRequests: boolean;
    test: string;
  }

}

export class WafTest {

  private readonly argv: any;

  constructor() {
    this.argv = this.parseCommand();
  }

  parseCommand() {
    let argv: any = yargs
      .command('$0', 'Sequence testing', {
        headless: {
          description: 'run headless mode or not',
          type: 'boolean',
          default: false
        },
        test: {
          description: 'glob pattern of test files. Ex: ./testcases/*.js',
          type: 'string',
          alias: 't',
          demandOption: true
        },
        'log-all-requests': {
          description: 'Log all requests',
          type: 'boolean',
          default: true
        }
      })
      .count('verbose')
      .describe('verbose', 'verbose')
      .alias('v', 'verbose')
      .option('output', {
        description: 'output directory',
        type: 'string',
        alias: 'o',
        default: './outputs'
      })
      .help()
      .alias('help', 'h')
      .argv;

    argv.ignoreDialog = argv["ignore-dialog"];
    argv.noReset = argv["no-reset"];
    argv.logAllRequests = argv["log-all-requests"];
    argv.command = argv._;

    console.log('vztlog (waf-test.ts:parseCommand) argb ', argv);

    return argv;
  }

  async run() {
    const glob = promisify(require('glob'));

    let chrome = new Chrome(this.argv as Chrome.IConfig);
    await chrome.openBrowser();

    let sequenceConfig = this.argv as WafTest.ISequenceConfig;

    let testPath = utils.getAbsolutePath(sequenceConfig.test);
    let files = await glob(testPath);

    for (let file of files) {
      Logger.green(`[+] Running ${file} ...`);
      try {
        const TestModule = (await import(file)).default;
        let test = new TestModule(chrome, this.argv);
        await test.run();
      } catch (err) {
        Logger.red(err);
      }
    }


    if (this.argv.headless) {
      this.argv.verbose >= 1 && console.log('[+] Closing browser ...');
      await chrome.closeBrowser();
    }
  }
}
