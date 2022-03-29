export type Auth0APIClient = {
    [key: string]: {
        getAll: any,
        create: any,
        update: any,
        delete: any,
    }
    pool: any
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
    EXCLUDED_PROPS?: {}
    INCLUDED_PROPS?: {}
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

export type AssetTypes = 'rules' | 'rulesConfigs' | 'hooks' | 'pages' | 'databases' | 'clientGrants' | 'resourceServers' | 'clients' | 'connections' | 'tenant' | 'emailProvider' | 'emailTemplates' | 'guardianFactors' | 'guardianFactorProviders' | 'guardianFactorTemplates' | 'migrations' | 'guardianPhoneFactorMessageTypes' | 'guardianPhoneFactorSelectedProvider' | 'guardianPolicies' | 'roles' | 'actions' | 'organizations' | 'triggers' | 'attackProtection' | 'branding'