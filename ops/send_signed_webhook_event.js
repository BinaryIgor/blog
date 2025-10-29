import crypto from "crypto";

const signingKey = process.env["SIGNING_KEY"];
if (!signingKey) {
    throw new Error("SIGNING_KEY is required but wasn't supplied");
}

function signedWebhookEvent(event, signingKey) {
    const eventBytes = Buffer.from(JSON.stringify(event), "utf-8");
    const signature = crypto.createHmac('sha256', signingKey)
        .update(eventBytes)
        .digest("hex");
    return signature;
}

const event = {
    "id": "5619888f-0f96-4a9e-8b45-7e6a7f89cd99",
    "event_type": "subscriber.clicked",
    "data": {
        "subscriber": "fc533803-b0a0-4f88-948e-201134cd1c27",
        "email": "71fdb39c-e78c-4029-ac4c-d02d8795e306",
        "url": "https://www.google.com"
    }
};
const signature = signedWebhookEvent(event, signingKey);
console.log("Sending event:", event);
console.log("Signature:", signature);

const response = await fetch("https://api.binaryigor.com/webhooks/newsletter", {
    method: "POST",
    body: JSON.stringify(event),
    headers: {
        "content-type": "application/json",
        "x-buttondown-signature": `sha256=${signature}`
    }
});
console.log("Response: ", response);