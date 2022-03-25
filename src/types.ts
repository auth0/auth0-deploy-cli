type APICLientBaseFunctions = {
    getAll: any,
    create: any,
    update: any,
    delete: any,
}

export type Auth0APIClient = {
    [key: string]: APICLientBaseFunctions
    pool: any
    actions: APICLientBaseFunctions & {
        deploy: ({ id: string }) => void
    },
    attackProtection: APICLientBaseFunctions & {
        getBreachedPasswordDetectionConfig: () => unknown
        getBruteForceConfig: () => unknown
        getSuspiciousIpThrottlingConfig: () => unknown
        updateBreachedPasswordDetectionConfig: ({}, Object) => unknown
        updateSuspiciousIpThrottlingConfig: ({}, Object) => unknown
        updateBruteForceConfig: ({}, Object) => unknown
    }
}// TODO: replace with a more accurate representation of the Auth0APIClient type 

export type Config = {
    AUTH0_DOMAIN: string
    AUTH0_CLIENT_ID: string
    AUTH0_CLIENT_SECRET: string
    AUTH0_INPUT_FILE: string
    AUTH0_ACCESS_TOKEN?: string
    AUTH0_AUDIENCE?: string
    AUTH0_API_MAX_RETRIES?: number
    AUTH0_KEYWORD_REPLACE_MAPPINGS?: any
    AUTH0_EXCLUDED_RULES?: any
    AUTH0_EXCLUDED_CLIENTS?: any
    AUTH0_EXCLUDED_DATABASES?: any
    AUTH0_EXCLUDED_CONNECTIONS?: any
    AUTH0_EXCLUDED_RESOURCE_SERVERS?: any
    AUTH0_EXCLUDED_DEFAULTS?: any
    AUTH0_EXPORT_IDENTIFIERS?: boolean
    AUTH0_CONNECTIONS_DIRECTORY?: string
    EXCLUDED_PROPS: {
        [key:string]: string[]
    }
}// TODO: replace with a more accurate representation of the Config type 

export type Asset = { [key: string]: any }

export type Assets = {
    actions: Asset[],
    attackProtection: Asset,
    clients: Asset[],
    clientGrants: Asset[],
    connections: Asset[],
    databases: Asset[],
    emailProvider: Asset,
    emailTemplates: Asset[],
    guardianFactorProviders: Asset[],
    guardianFactors: Asset[],
    guardianFactorTemplates: Asset[],
    guardianPhoneFactorMessageTypes: Asset[],
    guardianPhoneFactorSelectedProvider: Asset,
    guardianPolicies: Asset[],
    hooks: Asset[],
    migrations: Asset[]
    organizations: Asset[],
    pages: Asset[],
    resourceServers: Asset[],
    roles: Asset[],
    rules: Asset[],
    rulesConfigs: Asset[],
    tenant: Asset,
    triggers: Asset[],
    //non-resource types
    exclude: {
        [key: string]: string[]
    },
    clientsOrig: Asset[],
}

export type CalculatedChanges = {
    del: Asset[],
    update: Asset[],
    conflicts: Asset[],
    create: Asset[],
}