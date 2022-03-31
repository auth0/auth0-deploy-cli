type APICLientBaseFunctions = {
    getAll: (any) => Asset[],
    create: (any) => any,
    update: (arg0: any, arg1: any) => any,
    delete: (any) => any,
}

export type Auth0APIClient = {
    [key: string]: APICLientBaseFunctions
    pool: any
    actions: APICLientBaseFunctions & {
        deploy: ({ id: string }) => void
        getAllTriggers: () => { triggers: Asset[] }
        getTriggerBindings: ({ trigger_id: string }) => { bindings: Asset[] }
        updateTriggerBindings: ({ trigger_id: string }, { bindings: Object }) => { bindings: Asset[] }
    },
    attackProtection: APICLientBaseFunctions & {
        getBreachedPasswordDetectionConfig: () => Asset
        getBruteForceConfig: () => Asset
        getSuspiciousIpThrottlingConfig: () => Asset
        updateBreachedPasswordDetectionConfig: ({ }, Object) => Asset
        updateSuspiciousIpThrottlingConfig: ({ }, Object) => Asset
        updateBruteForceConfig: ({ }, Object) => Asset
    },
    branding: APICLientBaseFunctions & {
        getSettings: () => any,
        getUniversalLoginTemplate: () => any,
        updateSettings: ({ }, any) => any,
        setUniversalLoginTemplate: ({ }, any) => any
    },
    connections: APICLientBaseFunctions & {
        get: (Object) => Asset
    },
    customDomains: APICLientBaseFunctions & {
        getAll: any
    },
    emailProvider: APICLientBaseFunctions & {
        delete: () => void
        get: (Object) => Asset
        configure: (arg0: Object, arg1: Object) => Asset
    },
    emailTemplates: APICLientBaseFunctions & {
        get: (Object) => Asset
    },
    guardian: APICLientBaseFunctions & {
        getFactorProvider: (any) => Asset
        updateFactorProvider: (arg0: any, arg1: any) => void
        getFactors: () => Asset[]
        updateFactor: (arg0: any, arg1: any) => void
    },
    hooks: APICLientBaseFunctions & {
        get: ({ id: string }) => Asset
        removeSecrets: (arg0: any, arg1: any) => any
        updateSecrets: (arg0: any, arg1: any) => any
        getSecrets: ({ id: string }) => Promise<Asset[]>
        addSecrets: (arg0: any, arg1: any) => any
    },
    organizations: APICLientBaseFunctions & {
        updateEnabledConnection: (arg0: any, arg1: any) => any
        addEnabledConnection: (arg0: any, arg1: any) => any
        removeEnabledConnection: (arg0: any) => any
        connections: {
            get: (Object) => Asset
        }
    },
    roles: APICLientBaseFunctions & {
        permissions: APICLientBaseFunctions & {
            delete: (arg0: { id: string }, arg1: { permissions: any }) => void
            create: (arg0: { id: string }, arg1: { permissions: any }) => Asset
        }
    },
    tenant: APICLientBaseFunctions & {
        getSettings: () => Asset
        updateSettings: (Asset) => void
    },
    triggers: APICLientBaseFunctions & {

        getTriggerBindings: () => Asset
    }
}// TODO: replace with a more accurate representation of the Auth0APIClient type 

export type Config = {
    AUTH0_DOMAIN: string
    AUTH0_CLIENT_ID: string
    AUTH0_CLIENT_SECRET: string
    AUTH0_INPUT_FILE: string
    AUTH0_ALLOW_DELETE: boolean
    EXTENSION_SECRET: string
    AUTH0_ACCESS_TOKEN?: string
    AUTH0_BASE_PATH?: string
    AUTH0_AUDIENCE?: string
    AUTH0_API_MAX_RETRIES?: number
    AUTH0_KEYWORD_REPLACE_MAPPINGS?: { [key: string]: string[] | string }
    AUTH0_EXCLUDED_RULES?: string[]
    AUTH0_EXCLUDED_CLIENTS?: string[]
    AUTH0_EXCLUDED_DATABASES?: string[]
    AUTH0_EXCLUDED_CONNECTIONS?: string[]
    AUTH0_EXCLUDED_RESOURCE_SERVERS?: string[]
    AUTH0_EXCLUDED_DEFAULTS?: string[]
    AUTH0_EXPORT_IDENTIFIERS?: boolean
    AUTH0_CONNECTIONS_DIRECTORY?: string
    EXCLUDED_PROPS?: {
        [key: string]: string[]
    }
    INCLUDED_PROPS?: {}
}// TODO: replace with a more accurate representation of the Config type 

export type Asset = { [key: string]: any }

export type Assets = {
    actions: Asset[],
    attackProtection: Asset,
    branding: Asset,
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

export type AssetTypes = 'rules' | 'rulesConfigs' | 'hooks' | 'pages' | 'databases' | 'clientGrants' | 'resourceServers' | 'clients' | 'connections' | 'tenant' | 'emailProvider' | 'emailTemplates' | 'guardianFactors' | 'guardianFactorProviders' | 'guardianFactorTemplates' | 'migrations' | 'guardianPhoneFactorMessageTypes' | 'guardianPhoneFactorSelectedProvider' | 'guardianPolicies' | 'roles' | 'actions' | 'organizations' | 'triggers' | 'attackProtection' | 'branding'
