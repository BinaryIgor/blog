export function logInfo(message, ...params) {
    console.log(`${formattedDate()}, [INFO]: ${message}`, ...params);
}

function formattedDate() {
    return new Date().toISOString();
}

export function logWarn(message, ...params) {
    console.warn(`${formattedDate()}, [WARN]: ${message}`, ...params);
}

export function logError(message, ...params) {
    console.error(`${formattedDate()}, [ERROR]: ${message}`, ...params);
}