type APIClientBaseFunctions = {
    getAll: (arg0: { checkpoint?: boolean, is_global?: boolean, paginate?: boolean, include_totals?: boolean, id?: string }) => Promise<Asset[]>
    create: (arg0: { id: string }) => Promise<Asset>
    update: (arg0: {}, arg1: Asset) => Promise<Asset>
    delete: (arg0: Asset) => Promise<void>
}

export type Auth0APIClient = {
    pool: {
        addEachTask: (arg0: {
            data: Object
            generator: any
        }) => {
            promise: () => Promise<void>
        }
    }
    actions: APIClientBaseFunctions & {
        deploy: ({ id: string }) => Promise<void>
        getAllTriggers: () => Promise<{ triggers: Asset[] }>
        getTriggerBindings: ({ trigger_id: string }) => Promise<{ bindings: Asset[] }>
        updateTriggerBindings: ({ trigger_id: string }, { bindings: Object }) => Promise<{ bindings: Asset[] }>
    }
    attackProtection: APIClientBaseFunctions & {
        getBreachedPasswordDetectionConfig: () => Promise<Asset>
        getBruteForceConfig: () => Promise<Asset>
        getSuspiciousIpThrottlingConfig: () => Promise<Asset>
        updateBreachedPasswordDetectionConfig: ({ }, arg1: Asset) => Promise<void>
        updateSuspiciousIpThrottlingConfig: ({ }, arg1: Asset) => Promise<void>
        updateBruteForceConfig: ({ }, arg1: Asset) => Promise<void>
    }
    branding: APIClientBaseFunctions & {
        getSettings: () => Promise<Asset>
        getUniversalLoginTemplate: () => Promise<Asset>
        updateSettings: ({ }, Asset) => Promise<void>
        setUniversalLoginTemplate: ({ }, Asset) => Promise<void>
    }
    clients: APIClientBaseFunctions
    clientGrants: APIClientBaseFunctions
    connections: APIClientBaseFunctions & {
        get: (arg0: Asset) => Promise<Asset>
        getAll: (arg0: { strategy: 'auth0', checkpoint?: boolean, is_global?: boolean, paginate?: boolean, include_totals?: boolean, id?: string }) => Promise<Asset[]>
    }
    customDomains: APIClientBaseFunctions & {
        getAll: () => Promise<Asset[]>
    }
    emailProvider: APIClientBaseFunctions & {
        delete: () => Promise<void>
        get: (arg0: Asset) => Promise<Asset>
        configure: (arg0: Object, arg1: Object) => Promise<Asset>
    }
    emailTemplates: APIClientBaseFunctions & {
        get: (arg0: Asset) => Promise<Asset>
    }
    guardian: APIClientBaseFunctions & {
        getFactorProvider: (arg0: Asset) => Promise<Asset>
        updateFactorProvider: (arg0: {}, arg1: Asset) => Promise<void>
        getFactors: () => Promise<Asset[]>
        updateFactor: (arg0: {}, arg1: Asset) => Promise<void>
        getPolicies: () => Promise<Asset[]>
        updatePolicies: (arg0: {}, arg1: Asset) => Promise<void>
        getFactorTemplates: (arg0: { name: string }) => Promise<Asset[]>
        updateFactorTemplates: (arg0: {}, arg1: Asset) => Promise<void>
        updatePhoneFactorMessageTypes: (arg0: {}, arg1: Asset) => Promise<void>
        getPhoneFactorSelectedProvider: () => Promise<Asset[]>
        getPhoneFactorMessageTypes: () => Promise<Asset[]>
        updatePhoneFactorSelectedProvider: (arg0: {}, arg1: Asset) => Promise<void>
    }
    hooks: APIClientBaseFunctions & {
        get: ({ id: string }) => Promise<Asset>
        removeSecrets: (arg0: {}, arg1: Asset) => Promise<void>
        updateSecrets: (arg0: {}, arg1: Asset) => Promise<void>
        getSecrets: ({ id: string }) => Promise<Promise<Asset[]>>
        addSecrets: (arg0: {}, arg1: Asset) => Promise<void>
    }
    migrations: APIClientBaseFunctions & {
        getMigrations: () => Promise<{ flags: Asset[] }>
        updateMigrations: (arg0: { flags: Asset[] }) => Promise<void>
    }
    organizations: APIClientBaseFunctions & {
        updateEnabledConnection: (arg0: {}, arg1: Asset) => Promise<void>
        addEnabledConnection: (arg0: {}, arg1: Asset) => Promise<void>
        removeEnabledConnection: (arg0: Asset) => Promise<void>
        connections: {
            get: (arg0: Asset) => Promise<Asset>
        }
    }
    prompts: APIClientBaseFunctions & {
        getSettings: () => Promise<Asset[]>
        updateSettings: (arg0: {}, arg1: Asset) => Promise<void>
    }
    resourceServers: APIClientBaseFunctions,
    roles: APIClientBaseFunctions & {
        permissions: APIClientBaseFunctions & {
            delete: (arg0: { id: string }, arg1: { permissions: Asset[] }) => Promise<void>
            create: (arg0: { id: string }, arg1: { permissions: Asset[] }) => Promise<Asset>
        }
    }
    rules: APIClientBaseFunctions,
    rulesConfigs: APIClientBaseFunctions & {
        getAll: () => Promise<Asset[]>
    }
    tenant: APIClientBaseFunctions & {
        getSettings: () => Promise<Asset>
        updateSettings: (arg0: Asset) => Promise<void>
    }
    triggers: APIClientBaseFunctions & {
        getTriggerBindings: () => Promise<Asset>
    }
    updateRule: (arg0: { id: string }, arg1: Asset) => Promise<Asset>
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
    AUTH0_IGNORE_UNAVAILABLE_MIGRATIONS?: boolean
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
    guardianPhoneFactorMessageTypes: {
        message_types: Asset[]
    }
    guardianPhoneFactorSelectedProvider: Asset,
    guardianPolicies: {
        policies: Asset[],
    }
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
    }
    clientsOrig: Asset[],
}

export type CalculatedChanges = {
    del: Asset[],
    update: Asset[],
    conflicts: Asset[],
    create: Asset[],
}

export type AssetTypes = 'rules' | 'rulesConfigs' | 'hooks' | 'pages' | 'databases' | 'clientGrants' | 'resourceServers' | 'clients' | 'connections' | 'tenant' | 'emailProvider' | 'emailTemplates' | 'guardianFactors' | 'guardianFactorProviders' | 'guardianFactorTemplates' | 'migrations' | 'guardianPhoneFactorMessageTypes' | 'guardianPhoneFactorSelectedProvider' | 'guardianPolicies' | 'roles' | 'actions' | 'organizations' | 'triggers' | 'attackProtection' | 'branding'
