import { textFileContent } from "./files.js";

export function envVarOrDefault(key, defaultValue) {
    return process.env[key] ?? defaultValue;
}

export async function envVarOrThrow(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`${key} ENV is required but wasn't supplied`);
    }
    if (value.startsWith("file:")) {
        return (await textFileContent(value.replace("file:", ""))).trim();
    }
    return value;
}
