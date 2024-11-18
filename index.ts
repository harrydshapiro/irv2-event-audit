import fs from "fs"
import path from "path"
import { diff as deepDiff, Diff } from "deep-diff"
import readline from 'readline/promises'
import { AuditResults, EventName, FLAG_STATE, GroupedTaskLogs, ParsedCloudwatchLog, TaskSid } from "./types"

const LOGS_PATH = path.join(__dirname, 'logs.txt')
const AUDIT_RESULTS_OUTPUT = path.join(__dirname, 'audit-results.output.json')

auditAllLogs()

async function auditAllLogs () {
    const auditResults: AuditResults = {
        success: [],
        failure: {
            missingFlagOff: {},
            missingFlagOn: {},
            diff: {},
            duplicates: {}
        }
    }
    const groupedLogs = await groupLogsByTask();
    for (const taskSid in groupedLogs) {
        const taskLogs = groupedLogs[taskSid];
        auditLogsForTask(taskSid, taskLogs, auditResults)
    }
    fs.writeFileSync(AUDIT_RESULTS_OUTPUT, JSON.stringify(auditResults))
}

async function groupLogsByTask (): Promise<GroupedTaskLogs> {
    const groupedByTask: GroupedTaskLogs = {}
    await processStreamLineByLine(fs.createReadStream(LOGS_PATH), (line) => {
        const parsedMessage: ParsedCloudwatchLog = JSON.parse(line)
        const flagState = parsedMessage.isIrV2 ? 'flagOn' : 'flagOff';
        const eventPayload = parsedMessage.event;
        const taskSid = eventPayload.taskSid;
        if (!taskSid) {
            console.error('ERROR: Missing task sid', eventPayload)
            return
        } else if (!groupedByTask[taskSid]) {
            groupedByTask[taskSid] = {
                flagOff: {},
                flagOn: {}
            }
        }
        if (!groupedByTask[taskSid][flagState][eventPayload.name]) {
            groupedByTask[taskSid][flagState][eventPayload.name] = []
        }
        groupedByTask[taskSid][flagState][eventPayload.name].push(eventPayload)
    })
    return groupedByTask
}


function auditLogsForTask (taskSid: string, taskLogs: GroupedTaskLogs[''], auditResults: AuditResults) {
    confirmNoDuplicateEvents(taskSid, taskLogs, auditResults)
    diffAllEvents(taskSid, taskLogs, auditResults)
}

function confirmNoDuplicateEvents (taskSid: string, taskLogs: GroupedTaskLogs[''], auditResults: AuditResults) {
    Object.entries(taskLogs[FLAG_STATE.FLAG_ON]).forEach((eventData) => {
        const [eventName, eventArrays] = eventData as [string, any[]];
        // It's ok to have tons of task updated events for a task, and IRV2 doesn't change the trigger for task updated events
        // so just ignoring them completely here
        if (eventName === 'Task Updated') {
            return
        }
        if (eventArrays.length > 1) {
            if (!auditResults.failure.duplicates[eventName]) {
                auditResults.failure.duplicates[eventName] = []
            }
            auditResults.failure.duplicates[eventName].push(taskSid)
        }
    })
}

function diffAllEvents (taskSid: string, taskLogs: GroupedTaskLogs[''], auditResults: AuditResults) {
    for (const [eventName, eventArrays] of Object.entries(taskLogs[FLAG_STATE.FLAG_OFF])) {
        if (!['Reservation Created', 'Reservation Accepted', 'Reservation Wrapup', 'Task Wrapup', 'Reservation Completed'].includes(eventName)) {
            continue;
        }
        const flagOffEvent = eventArrays?.[0];
        const flagOnEvent = taskLogs[FLAG_STATE.FLAG_ON][eventName]?.[0];
        if (flagOnEvent) {
            const diff = deepDiff(flagOffEvent, flagOnEvent);
            if (!diff) {
                handleLogDiffSuccess(auditResults, taskSid, eventName);
            } else {
                handleLogDiffFailure(auditResults, taskSid, eventName, contextualizedDiff(diff));
            }
        } else {
            handleMissingFlagOn(auditResults, taskSid, eventName);
        }
    }
    for (const [eventName, eventArrays] of Object.entries(taskLogs[FLAG_STATE.FLAG_ON])) {
        const flagOnEvent = eventArrays?.[0];
        const flagOffEvent = taskLogs[FLAG_STATE.FLAG_OFF][eventName]?.[0];
        if (!flagOffEvent) {
            handleMissingFlagOff(auditResults, taskSid, eventName)
        }
    }
}

function handleLogDiffSuccess (auditResults: AuditResults, taskSid: TaskSid, eventName: EventName) {
    auditResults.success.push({ taskSid, eventName })
}

function handleLogDiffFailure(auditResults: AuditResults, taskSid: TaskSid, eventName: EventName, diffs: Diff<any, any>[]) {
    for (const diff of diffs) {
        const path = diff.path;
        if (!path) {
            console.error("missing path for diffs", taskSid, eventName, diffs)
            continue
        }
        const flagOffValue = diff.kind === 'E' || diff.kind === 'D' ? diff.lhs : undefined;
        const flagOnValue = diff.kind === 'E' || diff.kind === 'N' ? diff.rhs : undefined;
        if (!auditResults.failure.diff[path.join('.')]) {
            auditResults.failure.diff[path.join('.')] = []
        }
        auditResults.failure.diff[path.join('.')].push({
            taskSid,
            eventName,
            flagOffValue,
            flagOnValue
        })
    }
}

function handleMissingFlagOn(auditResults: AuditResults, taskSid: TaskSid, eventName: EventName) {
    if (!auditResults.failure.missingFlagOn[eventName]) {
        auditResults.failure.missingFlagOn[eventName] = []
    }
    auditResults.failure.missingFlagOn[eventName].push(taskSid)
}

function handleMissingFlagOff(auditResults: AuditResults, taskSid: TaskSid, eventName: EventName) {
    if (!auditResults.failure.missingFlagOff[eventName]) {
        auditResults.failure.missingFlagOff[eventName] = []
    }
    auditResults.failure.missingFlagOff[eventName].push(taskSid)
}

function contextualizedDiff (diffs: Diff<any, any>[]) {
    return diffs.reduce<Diff<any, any>[]>((acc, currDiff) => {
        // Add some lenience to age - can be a few seconds off
        if (currDiff.kind === 'E' && currDiff.path?.[0] === 'age') {
            if (Math.abs(currDiff.lhs - currDiff.rhs) > 5) {
                acc.push(currDiff)
            }
        } 
        // Add some lenience to age - can be a few seconds off
        else if (currDiff.kind === 'E' && currDiff.path?.[0] === 'createdAt') {
            if (Math.abs(Number(currDiff.lhs) - Number(currDiff.rhs)) > 5) {
                acc.push(currDiff)
            }
        } 
        // Ignore middle of the diff in description since it can be an optimistic res and thats ok
        else if (currDiff.kind === 'E' && currDiff.path?.[0] === 'description') {
            const lhsDesc = removeMiddlePartFromEventDescription(currDiff.lhs)
            const rhsDesc = removeMiddlePartFromEventDescription(currDiff.rhs)
            if (lhsDesc !== rhsDesc) {
                acc.push(currDiff)
            }
        } 
        // Ignore source altogether if we know it's correct
        else if (currDiff.kind === 'N' && currDiff.path?.[0] === 'source' && currDiff.rhs === 'Regal Voice') {
            // Do nothing
        } 
        // Ignore email altogether if it's been added
        else if (currDiff.kind === 'N' && currDiff.path?.[0] === 'email') {
            // Do nothing
        } 
        // Ignore priority altogether, we know we're changing it (for the better)
        else if (currDiff.kind === 'E' && currDiff.path?.[0] === 'priority') {
            // Do nothing
        } 
        else {
            acc.push(currDiff)
        }
        return acc
    }, [])
}

function removeMiddlePartFromEventDescription(description: string) {
    return description.split(' ').filter((_,i) => i !== 1).join(' ')
}

// This may be a dumb way to achieve my goals
// But basically I just wanted a way to read one line of the logs file at a time
async function processStreamLineByLine(fileStream: fs.ReadStream, handler: (line: string) => void | Promise<void>) {  
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break.
  
    for await (const line of rl) {
        try {
            // Each line in input.txt will be successively available here as `line`.
            await handler(line)
        } catch (error) {
            console.error(`Error processing line: ${line}`, error)
        }
    }
}


