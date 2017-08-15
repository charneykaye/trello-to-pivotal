/* globals console, require, process */

// Read File Synchronously
let fs = require("fs");

// CSV stream writer
let csvWriter = require('csv-write-stream');

// arguments
let sourcePath = argSourcePathToJSON();
let targetPath = argTargetPathToCSV();

// Intro banner
console.log("\n");
console.log("-=[ trello2pivotal ]=-\n");

// source JSON object
let sourceContent = readContent(sourcePath);
let board = parseJSON(sourceContent);
let checklists = cacheKeyedObjectsInAttr(board, "checklists");
let labels = cacheKeyedObjectsInAttr(board, "labels");
let maxTasks = getTrelloMaxTasks(checklists);

// Open target file write stream
let stream = createWriteStream(targetPath);

// Write CSV
writePivotalTrackerCSV(stream, maxTasks, board.cards, checklists, labels);

// Close target file
stream.end();

// Show Trello details
showTrelloDetails(board);

// all done!
console.log("OK\n");

//
// Functions Below
//
//
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
function argSourcePathToJSON() {
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
function argTargetPathToCSV() {
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
        let obj = JSON.parse(content);
        console.log("Did parse Trello export JSON.\n");
        return obj;
    } catch (err) {
        console.error("Error! Trello export was not valid JSON: " + err + "\n");
        process.exit(1);
    }
}

/**
 Show Trello details from JSON export object
 * @param {Object} obj
 */
function showTrelloDetails(obj) {
    console.log("Trello Board Details:");
    for (let k in obj) {
        if (typeof obj[k] === 'string') {
            console.log("  " + k + ": " + obj[k]);
        } else if (obj[k] && obj[k].length) {
            console.log("  " + k + "(" + obj[k].length + ")");
        }
    }
}

/**
 Get Keyed Objects in Attr
 * @param {Object} obj
 * @param {String} attr
 * @returns {Object} object containing checklists keyed by checklist id
 */
function cacheKeyedObjectsInAttr(obj, attr) {
    let objects = {};
    for (let i = 0; i < obj[attr].length; i++) {
        objects[obj[attr][i].id] = obj[attr][i];
    }
    console.log("Did cache " + Object.keys(objects).length + " " + attr + ".\n");
    return objects;
}


/**
 Get the maximum # of tasks (items) for any checklist
 * @param {Object} checklists
 */
function getTrelloMaxTasks(checklists) {
    // TODO: update this so it takes into account that a card can have multiple checklists, and so the max number of tasks per card is greater than for any one checklist
    let maxTasks = 0;
    for (let id in checklists) {
        maxTasks = Math.max(maxTasks, checklists[id].checkItems.length);
    }
    console.log("Will allocate " + maxTasks + " Task/Status column pairs.\n");
    return maxTasks;
}

/**
 Create CSV write stream
 * @param {String} path
 * @returns {CsvWriteStream}
 */
function createWriteStream(path) {
    let writer = csvWriter();
    writer.pipe(fs.createWriteStream(path));
    return writer;
}


/**
 Write Pivotal Tracker CSV
 * @param {csvWriter} stream CSV writer
 * @param {Number} maxTasks
 * @param {Array} cards from Trello Board
 * @param {Object} checklists keyed by id
 * @param {Object} labels keyed by id
 */
function writePivotalTrackerCSV(stream, maxTasks, cards, checklists, labels) {
    for (let i = 0; i < cards.length; i++) {
        writePivotalTrackerRow(stream, maxTasks, cards[i], checklists, labels);
    }
}

/**
 Write one row of Pivotal Tracker CSV -- headers are implied by object keys
 * @param {csvWriter} stream CSV writer
 * @param {Number} maxTasks
 * @param {Object} card from Trello Board
 * @param {Object} checklists keyed by id
 * @param {Object} labels keyed by id
 */
function writePivotalTrackerRow(stream, maxTasks, card, checklists, labels) {
    let columns = {
        'Title': card.name,
        'Type': typeFromTrello(card, labels),
        'Description': descFromTrello(card),
        'Labels': labelListFromTrello(card, labels),
        'Current State': stateFromTrello(card),
        'Created at': createdAtFromTrello(card)
    };
    for (let taskNum = 1; taskNum <= maxTasks; taskNum++) {
        columns[nameColTask(taskNum)] = taskFromTrello(card, checklists, taskNum);
        columns[nameColTaskStatus(taskNum)] = taskStatusFromTrello(card, checklists, taskNum);
    }
    stream.write(columns);
    // TODO confirm this works
}

/**
 Name of a Task column
 * @param {Number} num # of task
 * @returns {string}
 */
function nameColTask(num) {
    return 'Task' + num;
}

/**
 Name of a Task Status column
 * @param {Number} num # of task
 * @returns {string}
 */
function nameColTaskStatus(num) {
    return 'Task' + num + ' ' + 'Status';
}

/**
 Get the Type of a Trello card, inferred from its labels.
 * @param {Object} card from Trello
 * @param {Object} labels keyed by id
 * @returns {String} feature, bug, chore, epic, release -- If empty or omitted, the story type will default to feature.
 */
function typeFromTrello(card, labels) {
    let type = 'feature';
    for (let i = 0; i < card.idLabels.length; i++) {
        let name = labels[card.idLabels[i]].name;
        if (name && name.length > 0) {
            let sanitizedName = name.toLowerCase().trim();
            if (sanitizedName === 'Bug' || sanitizedName === 'Fire' || sanitizedName === 'Impact') {
                type = 'bug';
            }
            if (sanitizedName === 'tech debt' || sanitizedName === 'operations') {
                type = 'chore';
            }
        }
    }
    return type;
}

/**
 Get the Description of a Trello card, including links to the Short URL and any attachments.
 * @param {Object} card
 */
function descFromTrello(card) {
    let desc = card.desc;
    desc += "\n\nImported from Trello Card: " + card.url;
    for (let i = 0; i < card.attachments.length; i++) {
        desc += "\n\nAttachment: " + card.attachments[i].url;
    }
    return desc;
}

/**
 Get the Labels of a Trello card
 * @param {Object} card from Trello
 * @param {Object} labels keyed by id
 * @returns {String} comma-separated list of labels
 */
function labelListFromTrello(card, labels) {
    let list = [];
    for (let i = 0; i < card.idLabels.length; i++) {
        let name = labels[card.idLabels[i]].name;
        if (name && name.length > 0) {
            list.push(name);
        }
    }
    return list.join(", ");
}

/**

 * @param card
 * @returns {String} unscheduled, unstarted, started, finished, delivered, accepted, rejected
 */
function stateFromTrello(card) {
    return card.closed ? 'finished' : 'unstarted';
}

/**

 * @param card
 * @returns date created
 */
function createdAtFromTrello(card) {
    return card.dateLastActivity;
}


/**
 Task from Trello card, inferred from checklists
 * @param {Object} card from Trello
 * @param {Object} checklists keyed by id
 * @param {Number} taskNum to get from check
 */
function taskFromTrello(card, checklists, taskNum) {
    // TODO: update this so it takes into account that a card can have multiple checklists, and so the max number of tasks per card is greater than for any one checklist
    // TODO task
}

/**
 Task Status from Trello card, inferred from checklists
 * @param card
 * @param checklists
 * @param taskNum
 */
function taskStatusFromTrello(card, checklists, taskNum) {
    // TODO: update this so it takes into account that a card can have multiple checklists, and so the max number of tasks per card is greater than for any one checklist
    // TODO task status
}