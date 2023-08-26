import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function currentDir() {
    return __dirname;
}

export function textFileContent(path) {
    return fs.promises.readFile(path, 'utf-8');
}

export function writeTextFileContent(path, content) {
    return fs.promises.writeFile(path, content);
}

export function fileExists(path) {
    return fs.promises.stat(path).catch(e => false).then(e => true);
}

export function deleteFile(path) {
    return fs.promises.unlink(path);
}