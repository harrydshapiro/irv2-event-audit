# IRV2 Event Audit

1. Set your aws credentials any way you see fit
2. Run `ts-node fetch-logs.ts` to get the raw logs from cloudwatch and save them locally. A `startTime` param is passed to the log query there that can be used to deterime how far back to look. `endTime` can also be provided to select a specific range in time.
3. Run `ts-node index.ts` to run the audit. It will output to `audit-results.output.json`

The audit results are grouped by issue type.