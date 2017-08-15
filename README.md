# Trello to Pivotal

Migrate a project from Trello (JSON export) to Pivotal Tracker (CSV import)

## Trello

 
## Pivotal Tracker

### Field Names for CSV Data

From https://www.pivotaltracker.com/help/articles/csv_import_export/ 

|Column Header|Content|Possible values or restrictions|
|--- |--- |--- |
|Title|The title of the story|There is a 5,000-character limit. This is the only required column (except when importing epics, in which case both the “Title” and “Type” columns are required).|
|Labels|Tags which you can associate to your stories|Separate multiple labels by comma. Epics may have only one label and the label must be unique.|
|Type|The type of story|Feature, bug, chore, epic, releaseIf empty or omitted, the story type will default to feature.|
|Estimate|The numerical point value to assign to the story|The story must be of type feature. The value must correspond to the selected point scale for the project. Note:  A value of “-1” indicates an unestimated story. However, if an estimate of “-1” is assigned, the state must be compatible (i.e., a feature story can’t be in the accepted state without a point estimate). Epic and releases may not contain estimates. Bug and chores may contain estimates if the Bugs and Chores May Be Given Points setting is enabled in the destination project’s settings.|
|Current State|The current state of the story|unscheduled, unstarted, started, finished, delivered, accepted, rejected  If empty or omitted, the state will default to unscheduled and the story will be placed in the Icebox.Stories of type Chore can only have the following states: unscheduled, unstarted, started, acceptedStories of type Release can only have the following states: unscheduled, unstarted, accepted|
|Created at|The date the story was created (i.e., “Nov 22, 2014” or “11/22/2014)|If empty or omitted, the created date defaults to today’s date. Future dates are not allowed.|
|Accepted at|The date the story was accepted (i.e., “Jan 15, 2015” or “01/15/2015”)|Current state must equal accepted. If empty or omitted, the accepted at date will default to today’s date. Must be empty for any state other than accepted. Future dates are not allowed.|
|Requested By|The name of the user who requested/created the story|If empty or omitted, the requester will be set to the user importing the CSV file. If specified, the name must match the Tracker username exactly to be linked properly. For example, if the user’s name in Tracker is “David Smith” and the CSV file contains “Dave Smith,” then Tracker will create an uninvited usernamed “Dave Smith.”|
|Description|The content that describes the story|There is a 20,000-character limit.|
|Owned By|The name(s) of the user(s) who own the story|You can assign up to three owners, but each must be comma separated.  Again, names in your CSV file must match the user’s name in Tracker exactly.|
|Comment|Comments related to your story|There is a 20,000-character limit. You can add as many comments as you like, but each must be separated into its own column. You can specify an author and date using:  comment text (project member name - date)  e.g. Please see the attached. (Zoe Washburne - Apr 21, 2016)|
|Task|“To-do” items related to your story|There is a 1,000-character limit. Tasks can only be added with new stories (created in the same import file as their story). Tasks cannot be added via import to existing stories. You can add as many tasks as you like, but each must be separated into its own column. Each “Task” column must be paired with a “Task Status” column.|
|Task Status|The status of your task|Completed, not completed|
|Deadline|A deadline date that can be added to a story of type “release”|The story must be of type release. Future dates are allowed.|
|Blocker|Information about something blocking a story, can include a link to another story|For example: “blocked by #9999999”|
|Blocker Status|The current status of the blocker|“blocked” or “resolved”|
