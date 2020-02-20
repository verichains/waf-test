// setup some global helper method

import chalk from "chalk";

export class Logger {

    static red(...args) {
        console.log(... args.map(i => chalk.red(i)));
    }

    static green(...args) {
        console.log(... args.map(i => chalk.green(i)));
    }

    static yellow(...args) {
        console.log(... args.map(i => chalk.yellow(i)));
    }

}