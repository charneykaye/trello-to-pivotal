/* globals console, require, process */

// Read File Synchronously
let fs = require("fs");

// arguments
let sourcePath = getSourcePathToJSON();
let targetPath = getTargetPathToCSV();

// Intro banner
console.log("\n");
console.log("-=[ trello2pivotal ]=-\n");

// source JSON object
let sourceContent = readContent(sourcePath);
let obj = parseJSON(sourceContent);
showTrelloDetails(obj);

// all done!
console.log("OK\n");

//
//
//
// Functions Below
//
//
//

/**
 Show program usage
 */
function showUsage() {
    console.log("Usage:\n\n    trello2pivotal  /path/to/source.json  /path/to/target.csv\n");
}

/**
 Requires first argument: path to Trello export .JSON file
 * @returns {String}
 */
function getSourcePathToJSON() {
    let path = process.argv[2];
    if (!path || path.length === 0) {
        console.error("\nError! Must specify path to Trello export .JSON file.\n");
        showUsage();
        process.exit(1);
    }
    return path;
}

/**
 Requires second argument: path to target .CSV file
 * @returns {String}
 */
function getTargetPathToCSV() {
    let path = process.argv[3];
    if (!path || path.length === 0) {
        console.error("\nError! Must specify path to target .CSV file, for importing to Pivotal Tracker.\n");
        showUsage();
        process.exit(1);
    }
    return path;
}

/**
 Read Trello export .JSON file
 * @param {String} path
 * @returns {*}
 */
function readContent(path) {
    let content = fs.readFileSync(path);
    if (!content || content.length === 0) {
        console.error("Error! Trello export .JSON file was empty: " + path + "\n");
        process.exit(1);
    }
    console.log("Did read " + content.length + " bytes from Trello export .JSON file: " + path + "\n");
    return content;
}

/**
 Parse Trello export JSON (from file content)
 * @param {String} content
 * @returns {Object}
 */
function parseJSON(content) {
    try {
        return JSON.parse(content);
    } catch (err) {
        console.error("Error! Trello export was not valid JSON: " + err + "\n");
        process.exit(1);
    }
    console.log("Did parse Trello export JSON.\n");
}

/**
 Show Trello details from JSON export object
 * @param {Object} obj
 */
function showTrelloDetails(obj) {
    console.log("Trello Board Details:");
    for (k in obj) {
        if (typeof obj[k] === 'string') {
            console.log("  " + k + ": " + obj[k]);
        } else if (obj[k] && obj[k].length) {
            console.log("  " + k + "(" + obj[k].length + ")");
        }
    }
}
