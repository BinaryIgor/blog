import bodyParser from "body-parser";
import express from "express";

const app = express();

app.use(bodyParser.json());

app.post("/analytics/view", (req, res) => {
    console.log("Getting view...");
    console.log(req.url);
    console.log(req.body);

    res.sendStatus(200);
});

app.post("/analytics/post-view", (req, res) => {
    console.log("Getting post view...");
    console.log(req.url);
    console.log(req.body);

    res.sendStatus(200);
});

app.get("/stats", (req, res) => {

});

app.use((error, req, res, next) => {
    console.error("Something went wrong...", error);
    res.status(500);
    res.send({
        error: "ERROR"
    });
});

app.listen(8080, () => {
    console.log(`Server started on 8080`);
});