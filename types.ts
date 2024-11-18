export type TaskSid = string
export type EventName = string
export type GroupedTaskLogs = Record<TaskSid, {
    [FLAG_STATE.FLAG_ON]: Record<EventName, Array<ParsedCloudwatchLog['event']>>,
    [FLAG_STATE.FLAG_OFF]: Record<EventName, Array<ParsedCloudwatchLog['event']>>
}>
export enum FLAG_STATE {
    FLAG_ON = 'flagOn',
    FLAG_OFF = 'flagOff'
}

export type ParsedCloudwatchLog = {
    brand: string,
    bullmqContext?: {
        jobId: string
    },
    bullmqResourceName?: string,
    dd: {
        env: string,
        service: string,
        span_id: string,
        trace_id: string,
        version: string
    },
    event: {
        age: number,
        agent_fullname: string,
        agent_id: string,
        assignmentStatus: string,
        attributes: {
            autoAnswer: boolean,
            availableContactHours: {
                friday: {
                    end: number,
                    start: number
                },
                monday: {
                    end: number,
                    start: number
                },
                saturday: {
                    end: number,
                    start: number
                },
                sunday: {
                    end: number,
                    start: number
                },
                thursday: {
                    end: number,
                    start: number
                },
                tuesday: {
                    end: number,
                    start: number
                },
                wednesday: {
                    end: number,
                    start: number
                }
            },
            boolTestKC: boolean,
            callerId: string,
            campaignId: string,
            campaignInfo: {
                campaign_description: string,
                campaign_goal: string,
                campaign_name: string,
                campaign_priority: number,
                campaign_type: string,
                conversion_event: {
                    name: string
                },
                eligible_offer: any,
                friendly_id: string,
                id: string,
                script: any,
                voicemail_instructions: string
            },
            city: string,
            contactPhone: string,
            direction: string,
            email: string,
            firstHandlingAgent: string,
            first_name: string,
            from: string,
            fundingStatus: string,
            journeyExecutionName: string,
            journeyFriendlyId: number,
            journeyName: string,
            journeyNodeFriendlyId: number,
            journeyNodeUuid: string,
            journeyUuid: string,
            lastHandlingAgent: string,
            lastHandlingAgentSid: string,
            name: string,
            originalTaskQueueName: string,
            profileId: string,
            quietHoursReason: string,
            reassignAgent: string,
            regalVoicePhone: string,
            regalVoicePhoneFriendlyName: string,
            relatedObjectId: any,
            relatedObjectType: any,
            skillsNeeded: string[],
            status: string,
            targetAgentEmail: string,
            targetAgentFullname: string,
            targetAgentSid: string,
            taskType: string,
            title: string,
            triggerCall: boolean,
            workerAttributes: {
                contact_uri: string,
                current_status: string,
                disabled_skills: {
                    levels: any,
                    skills: any[]
                },
                email: string,
                full_name: string,
                image_url: string,
                roles: string[],
                routing: {
                    levels: any,
                    skills: string[]
                },
                teams: string[]
            }
        },
        brand: string,
        campaignFriendlyId: string,
        campaignId: string,
        campaignName: string,
        channelName: string,
        contactEmail: string,
        contactPhone: string,
        createdAt: string,
        description: string,
        entityType: string,
        eventType: string,
        journeyFriendlyId: number,
        journeyIsScheduled: boolean,
        journeyName: string,
        journeyUuid: string,
        name: string,
        originalTaskSid: string,
        priority: string,
        profileId: string,
        queueName: string,
        status: string,
        taskSid: string,
        workflowName: string
    },
    eventType: string,
    // TODO: Fix this type
    http?: Record<string, any>,
    isIrV2: boolean,
    level: string,
    message: "[DD_SAMPLED] Internal routing v2 event audit",
    taskSid: string,
    timestamp: string
}

type AuditResultBase = {
    taskSid: TaskSid,
    eventName: EventName 
}
type DiffEventResultContext = AuditResultBase & {
    flagOnValue: any;
    flagOffValue: any;
}
type DiffPath = string
export type AuditResults = {
    success: Array<AuditResultBase>,
    failure: {
        missingFlagOn: Record<EventName, TaskSid[]>,
        missingFlagOff: Record<EventName, TaskSid[]>,
        diff: Record<DiffPath, Array<DiffEventResultContext>>,
        duplicates: Record<EventName, TaskSid[]>
    }
}