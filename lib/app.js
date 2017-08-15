/* globals module, console, require, process */

// Trello source reading utilities
let source = require("./source-trello");

// Write File Synchronously
let fs = require("fs");

// CSV stream writer
let csvWriter = require('csv-write-stream');

/**
 * trello2pivotal
 */
class App {

    /**
     Show app intro banner and set configuration from arguments
     */
    constructor() {
        // intro
        console.log("\n");
        console.log("-=[ trello2pivotal ]=-\n");

        // arguments
        this.sourcePath = getSourcePathFromArgOne();
        this.targetPath = getTargetPathFromArgTwo();

        // parse source data
        this.sourceContent = source.readContent(this.sourcePath);
        this.board = source.parseJSON(this.sourceContent);
        source.showTrelloDetails(this.board);

        // cache objects
        this.checklists = source.cacheKeyedObjectsInAttr(this.board, "checklists");
        this.labels = source.cacheKeyedObjectsInAttr(this.board, "labels");
        this.maxTasks = source.getTrelloMaxTasks(this.checklists);

        // open target writer
        this.csvWriter = createWriteStream(this.targetPath, this.buildColumnNames());
        this.rowsWritten = 0;
    }

    /**
     Open target file write stream, write CSV, close target file
     */
    writeTarget() {
        let cards = this.board['cards'];
        for (let i = 0; i < cards.length; i++) {
            this.writePivotalTrackerRow(cards[i]);
        }

        this.csvWriter.end();
        console.log("Wrote " + this.rowsWritten + " rows to CSV file.\n");
    }

    /**
     Write the header row of a Pivotal Tracker CSV; NOTE that "Task" and "Task Status" columns are repeated with the same name
     @returns {Array} of column names
     */
    buildColumnNames() {
        let columnNames = [
            'Title',
            'Type',
            'Description',
            'Labels',
            'Current State',
            'Created at',
            'Estimate'
        ];
        for (let taskNum = 1; taskNum <= this.maxTasks; taskNum++) {
            columnNames.push('Task');
            columnNames.push('Task Status');
        }
        console.log("Will allocate " + columnNames.length + " column names for CSV file.\n");
        return columnNames;
    }

    /**
     Write one row of Pivotal Tracker CSV -- headers are implied by object keys
     * @param {Object} card from Trello Board
     */
    writePivotalTrackerRow(card) {
        let checklistItems = source.checklistItemsFromTrello(card, this.checklists);
        let columnValues = [
            csvValueSafe(source.nameFromTrello(card)), // Title
            csvValueSafe(source.typeFromTrello(card, this.labels)), // Type
            csvValueSafe(source.descFromTrello(card)), // Description
            csvValueSafe(source.labelListFromTrello(card, this.labels)), // Labels
            csvValueSafe(source.stateFromTrello(card)), // Current State
            csvValueSafe(source.createdAtFromTrello(card)), // Created at
            0 // Estimate
        ];
        for (let taskNum = 1; taskNum <= this.maxTasks; taskNum++) {
            columnValues.push(csvValueSafe(taskFromItem(checklistItems[taskNum])));
            columnValues.push(csvValueSafe(taskStatusFromItem(checklistItems[taskNum])));
        }
        this.csvWriter.write(columnValues);
        this.rowsWritten++;
    }

}

/**
 Show program usage
 */
function showUsage() {
    const usage = "Usage:\n\n    trello2pivotal  /path/to/source.json  /path/to/target.csv\n";
    console.log(usage);
}

/**
 Requires first argument: path to Trello export .JSON file
 */
function getSourcePathFromArgOne() {
    let path = process['argv'][2];
    if (!path || path.length === 0) {
        console.error("\nError! Must specify path to Trello export .JSON file.\n");
        showUsage();
        process.exit(1);
    }
    return path;
}

/**
 Requires second argument: path to target .CSV file
 */
function getTargetPathFromArgTwo() {
    let path = process['argv'][3];
    if (!path || path.length === 0) {
        console.error("\nError! Must specify path to target .CSV file, for importing to Pivotal Tracker.\n");
        showUsage();
        process.exit(1);
    }
    return path;
}

/**
 Create CSV write stream
 @param {String} path to target CSV
 @param {Array} columnNames to write to CSV header
 */
function createWriteStream(path, columnNames) {
    let writer = csvWriter({headers: columnNames});
    writer['pipe'](fs['createWriteStream'](path));
    return writer
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
 Task from Trello checklist item;  empty string if input undefined; takes into account that a card can have multiple checklists, and so the max number of tasks per card is greater than for any one checklist
 * @param {Object} item from Trello checklist
 */
function taskFromItem(item) {
    if (item && 'name' in item) {
        return item['name']
    }

    return "";
}

/**
 Task Status from Trello checklist item; empty string if input undefined; takes into account that a card can have multiple checklists, and so the max number of tasks per card is greater than for any one checklist
 * @param {Object} item from Trello checklist
 */
function taskStatusFromItem(item) {
    if (item && 'state' in item) {
        return item['state'].toLowerCase().trim() === 'complete' ? 'Completed' : 'Not Completed'
    }

    return "";
}

/**
 * Escape quotes
 * @param text
 * @returns {string|XML|*|void}
 */
function csvValueSafe(text) {
    return text.replace(/;/g, '.');
}

/**
 * Export
 * @param opts
 * @returns {App}
 */
module.exports = function (opts) {
    return new App(opts)
};
