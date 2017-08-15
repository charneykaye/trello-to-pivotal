/* globals module, console, require, process */

// Read File Synchronously
let fs = require("fs");

/**
 * Utilities for reading source Trello JSON
 */
module.exports = {

    /**
     Read Trello export .JSON file
     * @param {String} path
     * @returns {*}
     */
    readContent(path) {
        let content = fs.readFileSync(path);
        if (!content || content.length === 0) {
            console.error("Error! Trello export .JSON file was empty: " + path + "\n");
            process.exit(1);
        }
        console.log("Did read " + content.length + " bytes from Trello export .JSON file: " + path + "\n");
        return content;
    },

    /**
     Parse Trello export JSON (from file content)
     * @param {String} content
     * @returns {Object}
     */
    parseJSON(content) {
        try {
            let obj = JSON.parse(content);
            console.log("Did parse Trello export JSON.\n");
            return obj;
        } catch (err) {
            console.error("Error! Trello export was not valid JSON: " + err + "\n");
            process.exit(1);
        }
    },

    /**
     Show Trello details from JSON export object
     * @param {Object} obj
     */
    showTrelloDetails(obj) {
        console.log("Trello Board Details:");
        for (let k in obj) {
            if (typeof obj[k] === 'string') {
                console.log("  " + k + ": " + obj[k]);
            } else if (obj[k] && obj[k].length) {
                console.log("  " + k + "(" + obj[k].length + ")");
            }
        }
    },

    /**
     Get Keyed Objects in Attr
     * @param {Object} obj
     * @param {String} attr
     * @returns {Object} object containing checklists keyed by checklist id
     */
    cacheKeyedObjectsInAttr(obj, attr) {
        let objects = {};
        for (let i = 0; i < obj[attr].length; i++) {
            objects[obj[attr][i].id] = obj[attr][i];
        }
        console.log("Did cache " + Object.keys(objects).length + " " + attr + ".\n");
        return objects;
    },


    /**
     Get the maximum # of tasks (items) for any checklist; takes into account that a card can have multiple checklists, so the max number of tasks per card is greater than for any one checklist
     * @param {Object} checklists
     */
    getTrelloMaxTasks(checklists) {

        // first add up total # checklist items for each card (may sum multiple checklists for one card)
        let cardTotals = {};
        for (let id in checklists) {
            let cardId = checklists[id]['idCard'];
            let checklistTotal = checklists[id]['checkItems'].length;
            if (cardId in cardTotals) {
                cardTotals[cardId] += checklistTotal
            } else {
                cardTotals[cardId] = checklistTotal;
            }
        }

        // determine the max # of tasks for any one checklist
        let maxTasks = 0;
        for (let id in cardTotals) {
            maxTasks = Math.max(maxTasks, cardTotals[id]);
        }

        console.log("Will allocate " + maxTasks + " Task/Status column pairs.\n");
        return maxTasks;
    },


    /**
     Get the Type of a Trello card, inferred from its labels.
     * @param {Object} card from Trello
     * @param {Object} labels keyed by id
     * @returns {String} feature, bug, chore, epic, release -- If empty or omitted, the story type will default to feature.
     */
    typeFromTrello(card, labels) {
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
    },

    /**
     Get the Description of a Trello card, including links to the Short URL and any attachments.
     * @param {Object} card
     */
    descFromTrello(card) {
        let desc = card.desc;
        desc += "\n\nImported from Trello Card: " + card.url;
        for (let i = 0; i < card.attachments.length; i++) {
            desc += "\n\nAttachment: " + card.attachments[i].url;
        }
        return desc;
    },

    /**
     Get the Labels of a Trello card
     * @param {Object} card from Trello
     * @param {Object} labels keyed by id
     * @returns {String} comma-separated list of labels
     */
    labelListFromTrello(card, labels) {
        let list = [];
        for (let i = 0; i < card.idLabels.length; i++) {
            let name = labels[card.idLabels[i]].name;
            if (name && name.length > 0) {
                list.push(name);
            }
        }
        return list.join(", ");
    },

    /**

     * @param card
     * @returns {String} unscheduled, unstarted, started, finished, delivered, accepted, rejected
     */
    stateFromTrello(card) {
        return card.closed ? 'finished' : 'unstarted';
    },

    /**

     * @param card
     * @returns date created
     */
    createdAtFromTrello(card) {
        return card.dateLastActivity;
    },


    /**
     Task from Trello card, inferred from checklists
     * @param {Object} card from Trello
     * @param {Object} checklists keyed by id
     * @param {Number} taskNum to get from check
     */
    taskFromTrello(card, checklists, taskNum) {
        // TODO: update this so it takes into account that a card can have multiple checklists, and so the max number of tasks per card is greater than for any one checklist
        // TODO task
    },

    /**
     Task Status from Trello card, inferred from checklists
     * @param card
     * @param checklists
     * @param taskNum
     */
    taskStatusFromTrello(card, checklists, taskNum) {
        // TODO: update this so it takes into account that a card can have multiple checklists, and so the max number of tasks per card is greater than for any one checklist
        // TODO task status
    }

};