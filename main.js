/* globals console, require, process */

try {
    let App = require("./lib/trello2pivotal");
    let app = new App(process.argv[2], process.argv[3]);
    app.run();
} catch (err) {
    console.error("Error!", err,"\n");
    console.log("Usage:\n\n    trello2pivotal  /path/to/this.json  /path/to/target.csv\n");
}