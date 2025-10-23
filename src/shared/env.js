export function envVarOrDefault(key, defaultValue) {
    return process.env[key] ?? defaultValue;
}

export function envVarOrThrow(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`${key} ENV is required but wasn't supplied`);
    }
    return value;
}
