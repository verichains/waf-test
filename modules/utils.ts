import lineByLine from "n-readlines";
import fs from "fs";
import path from "path";
import * as csvWriter from "csv-writer";

export function createFolderIfNotExist(folder: string) {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
}

export function removeFilesInFolder(directory: string) {
    fs.readdir(directory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            fs.unlink(path.join(directory, file), err => {
                if (err) throw err;
            });
        }
    });
}

export function removeFileIfExists(filePath: string) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

export function* readTxtFile(filePath: string) {
    let line;
    const liner = new lineByLine(filePath);
    while (line = liner.next()) {
        yield line.toString();
    }
}

export function* readHttpRequests(filePath: string, delim: string, hostName: string) {
    let httpFile = readTxtFile(filePath);

    let currentRequest = '';
    let ignoreLine = false;
    for (let line of httpFile) {
        if (line.search(/^(GET|PUT|POST|DELETE|OPTIONS|TRACE|HEAD|CONNECT|PATCH) /) === 0) {
            if (currentRequest) {
                yield currentRequest;
            }
            ignoreLine = false;
            currentRequest = '';
        }

        if (delim && line.search(delim) === 0) {
            ignoreLine = true;
        }

        if (!ignoreLine)
            currentRequest += line.replace(/^Host: .*$/m, `Host: ${hostName}`) + "\n";
    }
}

export async function appendCSV(filePath: string, headers, data) {
    const createCsvWriter = Array.isArray(data) ? csvWriter.createArrayCsvWriter : csvWriter.createObjectCsvWriter;

    if (!fs.existsSync(filePath)) {
        const csvWriter = createCsvWriter({
            path: filePath,
            header: headers,
        });
        await csvWriter.writeRecords([]);
    }

    const csvRecordWriter = createCsvWriter({
        path: filePath,
        header: headers,
        append: true,
    });

    await csvRecordWriter.writeRecords([data]).then(() => {
        // console.log('...Done');
    });
}

export function getAbsolutePath(currentPath: string, baseDir = '') {
    baseDir = baseDir ? baseDir : process.cwd();
    return path.isAbsolute(currentPath) ? currentPath : path.join(baseDir, currentPath);
}

export function hostFromUrl(url) {
    return url.replace(/https?:\/\//, '');
}

export function removeProtocol(url) {
    return url.replace(/(^\w+:|^)\/\//, '');
}

export function round(number, decimal = 2) {
    return +(Math.round(parseFloat(number + `e+${decimal}`)) + `e-${decimal}`);
}

export function subtract(a, b, multiplier = 100) {
    return (a * multiplier - b * multiplier) / multiplier;
}
