import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { ParsedCloudwatchLog } from "./types"

// Pass in credentials however you prefer
// I was having problems with my local env so just ended up grabbing them from the login page and doing this:
// const creds = {
//     accessKeyId: '...',
//     secretAccessKey: '...',
//     sessionToken: '...'
// }
// AWS.config.credentials = creds;

AWS.config.update({ region: 'us-east-1', apiVersion: 'latest' });

const cloudwatchlogs = new AWS.CloudWatchLogs();
const stagingLogGroupName = '...'; // can grab these from DD logs
const prodLogGroupName = '...';
const filterPattern = '{($.isIrV2 IS TRUE) || ($.event.name = %Reservation Created|Reservation Accepted|Reservation Wrapup|Task Wrapup|Reservation Completed% )}';
const outputFilePath = path.join(__dirname, 'logs.txt');

async function fetchLogs() {
    let nextToken;
    fs.writeFileSync(outputFilePath, '');
    const logStream = fs.createWriteStream(outputFilePath, { flags: 'a' });

    do {
        const params: AWS.CloudWatchLogs.FilterLogEventsRequest = {
            logGroupName: prodLogGroupName,
            filterPattern,
            nextToken,
            startTime: Date.now() - 300_000,
        };

        const data = await cloudwatchlogs.filterLogEvents(params).promise();
        data.events?.forEach(event => {
            const parsedLogContents = parseLog(event.message)
            if (!parsedLogContents) {
                return
            }
            logStream.write(`${event.message}\n`);
        });

        nextToken = data.nextToken;
    } while (nextToken);

    logStream.end();
}

function parseLog (unparsedLogMessage?: string): ParsedCloudwatchLog | null {
    return unparsedLogMessage ? JSON.parse(unparsedLogMessage) : null
}

fetchLogs()
    .then(() => console.log('Logs have been written to logs.txt'))
    .catch(err => console.error('Error fetching logs:', err));