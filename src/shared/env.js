export function envVarOrDefault(key, defaultValue) {
    return process.env[key] ?? defaultValue;
}
