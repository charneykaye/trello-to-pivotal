/* globals module, console, require, process */

// Write File Synchronously
let fs = require("fs");

// CSV stream writer
let csvWriter = require("csv-write-stream");

/**
 * trello2pivotal
 */
class App {

    /**
     Show app intro banner and set configuration from arguments
     * @param {String} sourcePath of Trello .JSON to read
     * @param {String} targetPath of Pivotal Tracker .CSV to write
     */
    constructor(sourcePath, targetPath) {
        // intro
        console.log("\n");
        console.log("-=[ trello2pivotal ]=-\n");

        // path to read Trello .JSON
        if (!sourcePath || sourcePath.length === 0) {
            throw new Error("Must specify path to read Trello .JSON file.");
        }

        // path to write Pivotal tracker .CSV
        if (!targetPath || targetPath.length === 0) {
            throw new Error("Must specify path to write Pivotal Tracker .CSV file.");
        }

        // parse source data
        this.board = parseJSON(readContent(sourcePath));

        // show Trello board details
        console.log("Trello Board Details:");
        showObjectDetails(this.board);

        // cache member objects from Trello board
        this.checklists = cacheMembers(this.board, "checklists");
        this.labels = cacheMembers(this.board, "labels");
        this.lists = cacheMembers(this.board, "lists");

        // open target writer
        this.csvWriter = createWriteStream(targetPath, this.buildColumnNames());
        this.rowsWritten = 0;
    }

    /**
     Open target file write stream, write CSV, close target file
     */
    run() {
        let cards = this.board.cards;
        for (let i = 0; i < cards.length; i++) {
            this.writePivotalTrackerRow(cards[i]);
        }

        this.csvWriter.end();
        console.log("Wrote " + this.rowsWritten + " rows to CSV file.\n");
    }

    /**
     Write one row of Pivotal Tracker CSV -- headers are implied by object keys
     * @param {Object} card from Trello Board
     */
    writePivotalTrackerRow(card) {
        let checklistItems = this.cardChecklistItems(card);
        let type = this.cardType(card);
        let state = this.cardState(card, type);
        let columnValues = [
            csvValueSafe(cardName(card)),
            csvValueSafe(type),
            csvValueSafe(cardDescription(card)),
            csvValueSafe(this.cardLabelList(card)),
            csvValueSafe(state),
            csvValueSafe(cardCreatedAt(card, state)),
            csvValueSafe(cardAcceptedAt(card, state)),
            0 // Estimate
        ];
        for (let taskNum = 1; taskNum <= this.maxTasks(); taskNum++) {
            columnValues.push(csvValueSafe(taskFromItem(checklistItems[taskNum])));
            columnValues.push(csvValueSafe(taskStatusFromItem(checklistItems[taskNum])));
        }
        this.csvWriter.write(columnValues);
        this.rowsWritten++;
    }

    /**
     Get the maximum # of tasks (items) for any checklist; takes into account that a card can have multiple checklists, so the max number of tasks per card is greater than for any one checklist.
     1. add up total # checklist items for each card (may sum multiple checklists for one card)
     2. determine the max # of tasks for any one checklist
     */
    maxTasks() {
        if (!this._maxTasks) {
            let cardTotals = {};
            for (let id in this.checklists) {
                if (this.checklists.hasOwnProperty(id)) {
                    let cardId = this.checklists[id].idCard;
                    let checklistTotal = this.checklists[id].checkItems.length;
                    if (cardId in cardTotals) {
                        cardTotals[cardId] += checklistTotal;
                    } else {
                        cardTotals[cardId] = checklistTotal;
                    }
                }
            }
            this._maxTasks = 0;
            for (let id in cardTotals) {
                if (cardTotals.hasOwnProperty(id)) {
                    this._maxTasks = Math.max(this._maxTasks, cardTotals[id]);
                }
            }
            console.log("Will allocate " + this._maxTasks + " Task/Status column pairs.\n");
        }

        return this._maxTasks;
    }

    /**
     Get the Type of a Trello card, inferred from its labels.
     * @param {Object} card from Trello
     * @returns {String} feature, bug, chore, epic, release -- If empty or omitted, the story type will default to feature.
     */
    cardType(card) {
        let type = TYPE_FEATURE;
        for (let i = 0; i < card.idLabels.length; i++) {
            let name = this.labels[card.idLabels[i]].name;
            if (name && name.length > 0) {
                let sanitizedName = name.toLowerCase().trim();
                if (sanitizedName === "bug" || sanitizedName === "fire" || sanitizedName === "impact") {
                    type = TYPE_BUG;
                }
                if (sanitizedName === 'tech debt' || sanitizedName === "operations") {
                    type = TYPE_CHORE;
                }
            }
        }
        return type;
    }

    /**
     Get the Labels of a Trello card
     * @param {Object} card from Trello
     * @returns {String} comma-separated list of labels
     */
    cardLabelList(card) {
        let list = [];
        for (let i = 0; i < card.idLabels.length; i++) {
            let name = this.labels[card.idLabels[i]].name;
            if (name && name.length > 0) {
                list.push(name);
            }
        }
        return list.join(", ");
    }

    /**
     State of final Pivotal Tracker issue, from Trello card
     - state based on list the card belongs to
     - if in "done" or "released" list -- Accepted
     - if list is closed - Accepted
     - if in "review" list and NOT a Chore -- Delivered
     - if in "active" list -- Started
     - if in "ready" list -- Unstarted
     - if in "backlog" or "icebox" list -- Unscheduled
     - Chore can only have the following states: unscheduled, unstarted, started, accepted
     * @param {Object} card from Trello
     * @param {String} type of Pivotal Tracker issue
     * @returns {String} unscheduled, unstarted, started, finished, delivered, accepted, rejected
     */
    cardState(card, type) {
        let list = this.lists[card.idList];
        let listName = list.name.toLowerCase();

        if (contains(listName, "done") || contains(listName, "released")) {
            return STATE_ACCEPTED;

        } else if (list.closed) {
            return STATE_ACCEPTED;

        } else if (contains(listName, "review")) {
            if (type === TYPE_CHORE) {
                return STATE_STARTED;
            } else {
                return STATE_DELIVERED;
            }

        } else if (contains(listName, "active")) {
            return STATE_STARTED;

        } else if (contains(listName, "ready")) {
            return STATE_UNSTARTED;

        } else if (contains(listName, "backlog") || contains(listName, "icebox")) {
            return STATE_UNSCHEDULED;
        }

        return card.closed ? STATE_ACCEPTED : STATE_UNSCHEDULED;
    }

    /**
     All tasks from a given Trello card
     * @param {Object} card
     */
    cardChecklistItems(card) {
        let items = [];
        for (let id in this.checklists) {
            if (this.checklists.hasOwnProperty(id)) {
                if (this.checklists[id].idCard === card.id) {
                    for (let n = 0; n < this.checklists[id].checkItems.length; n++) {
                        items.push(this.checklists[id].checkItems[n]);
                    }
                }
            }
        }
        return items;
    }

    /**
     Write the header row of a Pivotal Tracker CSV; NOTE that "Task" and "Task Status" columns are repeated with the same name
     @returns {Array} of column names
     */
    buildColumnNames() {
        let columnNames = [
            "Title",
            "Type",
            "Description",
            "Labels",
            'Current State',
            'Created at',
            'Accepted at',
            "Estimate"
        ];
        for (let taskNum = 1; taskNum <= this.maxTasks(); taskNum++) {
            columnNames.push("Task");
            columnNames.push('Task Status');
        }
        console.log("Will allocate " + columnNames.length + " column names for CSV file.\n");
        return columnNames;
    }
}

/**
 Show object details
 * @param {Object} obj
 */
function showObjectDetails(obj) {
    for (let k in obj) {
        if (typeof obj[k] === "string") {
            console.log("  " + k + ": " + obj[k]);
        } else if (obj[k] && obj[k].length) {
            console.log("  " + k + "(" + obj[k].length + ")");
        }
    }
    console.log("");
}

/**
 Read Trello export .JSON file
 * @param {String} path of content to read
 * @returns {*}
 */
function readContent(path) {
    let content = fs.readFileSync(path);
    if (!content || content.length === 0) {
        console.error("Error! Trello .JSON file was empty: " + path + "\n");
        process.exit(1);
    }
    console.log("Did read " + content.length + " bytes from Trello .JSON file: " + path + "\n");
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
        console.log("Did parse Trello board from JSON.\n");
        return obj;
    } catch (err) {
        console.error("Error! Trello board input was not valid JSON: " + err + "\n");
        process.exit(1);
    }
}

/**
 Get Keyed Objects in Attr
 * @param {Object} obj to get member of
 * @param {String} attr name of member
 * @returns {Object} object containing member objects keyed by checklist id
 */
function cacheMembers(obj, attr) {
    let memberObjectsKeyedById = {};
    for (let i = 0; i < obj[attr].length; i++) {
        memberObjectsKeyedById[obj[attr][i].id] = obj[attr][i];
    }
    console.log("Did cache " + Object.keys(memberObjectsKeyedById).length + " " + attr + ".\n");
    return memberObjectsKeyedById;
}

/**
 Create CSV write stream
 @param {String} path to target CSV
 @param {Array} columnNames to write to CSV header
 */
function createWriteStream(path, columnNames) {
    let writer = csvWriter({headers: columnNames});
    writer.pipe(fs.createWriteStream(path));
    return writer;
}

/**
 * Get the Name of a Trello card
 * @param {Object} card
 */
function cardName(card) {
    return card.name;
}

/**
 Get the Description of a Trello card, including links to the Short URL and any attachments.
 * @param {Object} card
 */
function cardDescription(card) {
    let desc = card.desc;
    desc += "\n\nImported from Trello Card: " + card.url;
    for (let i = 0; i < card.attachments.length; i++) {
        desc += "\n\nAttachment: " + card.attachments[i].url;
    }
    return desc;
}

/**
 Date the Pivotal Tracker issue was created at, based on the Trello card
 * @param card
 * @param state
 * @returns {String} date created
 */
function cardCreatedAt(card, state) {
    switch (state) {
        case STATE_UNSCHEDULED:
        case STATE_UNSTARTED:
        case STATE_DELIVERED:
        case STATE_STARTED:
            return card.dateLastActivity;

        case STATE_ACCEPTED:
            return "";
    }
}

/**
 Date the Pivotal Tracker issue was accepted at, based on the Trello card
 * @param card
 * @param state
 * @returns {String} date accepted
 */
function cardAcceptedAt(card, state) {
    switch (state) {
        case STATE_UNSCHEDULED:
        case STATE_UNSTARTED:
        case STATE_DELIVERED:
        case STATE_STARTED:
            return "";

        case STATE_ACCEPTED:
            return card.dateLastActivity;
    }
}

/**
 Task from Trello checklist item;  empty string if input undefined; takes into account that a card can have multiple checklists, and so the max number of tasks per card is greater than for any one checklist
 * @param {Object} item from Trello checklist
 */
function taskFromItem(item) {
    if (item && "name" in item) {
        return item.name;
    }

    return "";
}

/**
 Task Status from Trello checklist item; empty string if input undefined; takes into account that a card can have multiple checklists, and so the max number of tasks per card is greater than for any one checklist
 * @param {Object} item from Trello checklist
 */
function taskStatusFromItem(item) {
    if (item && "state" in item) {
        return item.state.toLowerCase().trim() === "complete" ? STATUS_COMPLETED : STATUS_NOT_COMPLETED;
    }

    return "";
}

/**
 * Escape quotes
 * @param text
 * @returns {string|XML|*|void}
 */
function csvValueSafe(text) {
    // no known issues, thanks to CSV-stream writer
    return text;
}

/**
 String contains a string?
 * @param {String} haystack to search
 * @param {String} needle to look for
 * @returns {boolean} if found
 */
function contains(haystack, needle) {
    return haystack.indexOf(needle) > -1;
}

/**
 Pivotal Tracker issue type constants
 * @type {string}
 */
const TYPE_BUG = "Bug";
const TYPE_CHORE = "Chore";
const TYPE_FEATURE = "Feature";

/**
 Pivotal Tracker issue state constants
 * @type {string}
 */
const STATE_UNSCHEDULED = "Unscheduled";
const STATE_UNSTARTED = "Unstarted";
const STATE_STARTED = "Started";
// const STATE_FINISHED = "Finished";
const STATE_DELIVERED = "Delivered";
const STATE_ACCEPTED = "Accepted";
// const STATE_REJECTED = "Rejected";

/**
 Pivotal Tracker task status constants
 * @type {string}
 */
const STATUS_COMPLETED = "Completed";
const STATUS_NOT_COMPLETED = "Not Completed";

/**
 * Export
 * @param {String} sourcePath of Trello .JSON to read
 * @param {String} targetPath of Pivotal Tracker .CSV to write
 * @returns {App}
 */
module.exports = function (sourcePath, targetPath) {
    return new App(sourcePath, targetPath);
};
