import {
  PromptTypes,
  ScreenTypes,
  Prompts,
  PromptsCustomText,
  PromptSettings,
} from './tools/auth0/handlers/prompts';

import { ThemeResponse, ThemeRequest } from './tools/auth0/handlers/themes';

type SharedPaginationParams = {
  checkpoint?: boolean;
  paginate?: boolean;
  is_global?: boolean;
  include_totals?: boolean;
  id?: string;
  strategy?: 'auth0';
};

export type CheckpointPaginationParams = SharedPaginationParams & {
  from: string;
  take: number;
};

export type PagePaginationParams = SharedPaginationParams & {
  page: number;
  per_page: number;
};

type APIClientBaseFunctions = {
  getAll: (arg0: SharedPaginationParams) => Promise<Asset[]>;
  create: (arg0: { id: string }) => Promise<Asset>;
  update: (arg0: {}, arg1: Asset) => Promise<Asset>;
  delete: (arg0: Asset) => Promise<void>;
};

export type ApiResponse = {
  start: number;
  limit: number;
  total: number;
  next?: string;
} & { [key in AssetTypes]: Asset[] };

export type BaseAuth0APIClient = {
  actions: APIClientBaseFunctions & {
    deploy: ({ id: string }) => Promise<void>;
    getAllTriggers: () => Promise<{ triggers: Asset[] }>;
    getTriggerBindings: ({ trigger_id: string }) => Promise<{ bindings: Asset[] }>;
    updateTriggerBindings: (
      { trigger_id: string },
      { bindings: Object }
    ) => Promise<{ bindings: Asset[] }>;
  };
  attackProtection: APIClientBaseFunctions & {
    getBreachedPasswordDetectionConfig: () => Promise<Asset>;
    getBruteForceConfig: () => Promise<Asset>;
    getSuspiciousIpThrottlingConfig: () => Promise<Asset>;
    updateBreachedPasswordDetectionConfig: ({}, arg1: Asset) => Promise<void>;
    updateSuspiciousIpThrottlingConfig: ({}, arg1: Asset) => Promise<void>;
    updateBruteForceConfig: ({}, arg1: Asset) => Promise<void>;
  };
  branding: APIClientBaseFunctions & {
    getSettings: () => Promise<Asset>;
    getUniversalLoginTemplate: () => Promise<Asset>;
    updateSettings: ({}, Asset) => Promise<void>;
    setUniversalLoginTemplate: ({}, Asset) => Promise<void>;
    getDefaultTheme: () => Promise<Asset>;
    updateTheme: (arg0: { id: string }, ThemeRequest) => Promise<ThemeResponse>;
    deleteTheme: (arg0: { id: string }) => Promise<void>;
    createTheme: (ThemeRequest) => Promise<ThemeResponse>;
  };
  clients: APIClientBaseFunctions;
  clientGrants: APIClientBaseFunctions;
  connections: APIClientBaseFunctions & {
    get: (arg0: Asset) => Promise<Asset>;
    getAll: (arg0: PagePaginationParams | CheckpointPaginationParams) => Promise<Asset[]>;
  };
  customDomains: APIClientBaseFunctions & {
    getAll: () => Promise<Asset[]>;
  };
  emailProvider: APIClientBaseFunctions & {
    delete: () => Promise<void>;
    get: (arg0: Asset) => Promise<Asset>;
    configure: (arg0: Object, arg1: Object) => Promise<Asset>;
  };
  emailTemplates: APIClientBaseFunctions & {
    get: (arg0: Asset) => Promise<Asset>;
  };
  guardian: APIClientBaseFunctions & {
    getFactorProvider: (arg0: Asset) => Promise<Asset>;
    updateFactorProvider: (arg0: {}, arg1: Asset) => Promise<void>;
    getFactors: () => Promise<Asset[]>;
    updateFactor: (arg0: {}, arg1: Asset) => Promise<void>;
    getPolicies: () => Promise<Asset[]>;
    updatePolicies: (arg0: {}, arg1: Asset) => Promise<void>;
    getFactorTemplates: (arg0: { name: string }) => Promise<Asset[]>;
    updateFactorTemplates: (arg0: {}, arg1: Asset) => Promise<void>;
    updatePhoneFactorMessageTypes: (arg0: {}, arg1: Asset) => Promise<void>;
    getPhoneFactorSelectedProvider: () => Promise<Asset[]>;
    getPhoneFactorMessageTypes: () => Promise<Asset[]>;
    updatePhoneFactorSelectedProvider: (arg0: {}, arg1: Asset) => Promise<void>;
  };
  hooks: APIClientBaseFunctions & {
    get: ({ id: string }) => Promise<Asset>;
    removeSecrets: (arg0: {}, arg1: Asset) => Promise<void>;
    updateSecrets: (arg0: {}, arg1: Asset) => Promise<void>;
    getSecrets: ({ id: string }) => Promise<Promise<Asset[]>>;
    addSecrets: (arg0: {}, arg1: Asset) => Promise<void>;
  };
  logStreams: APIClientBaseFunctions;
  migrations: APIClientBaseFunctions & {
    getMigrations: () => Promise<{ flags: Asset[] }>;
    updateMigrations: (arg0: { flags: Asset[] }) => Promise<void>;
  };
  organizations: APIClientBaseFunctions & {
    updateEnabledConnection: (arg0: {}, arg1: Asset) => Promise<void>;
    addEnabledConnection: (arg0: {}, arg1: Asset) => Promise<void>;
    removeEnabledConnection: (arg0: Asset) => Promise<void>;
    connections: {
      get: (arg0: Asset) => Promise<Asset>;
    };
  };
  prompts: {
    updateCustomTextByLanguage: (arg0: {
      prompt: PromptTypes;
      language: Language;
      body: Partial<{ [key in ScreenTypes]: { [key: string]: string } }>;
    }) => Promise<void>;
    getCustomTextByLanguage: (arg0: {
      prompt: PromptTypes;
      language: Language;
    }) => Promise<Partial<PromptsCustomText>>;
    getSettings: () => Promise<PromptSettings>;
    updateSettings: (arg0: {}, arg1: Partial<PromptSettings>) => Promise<void>;
  };
  resourceServers: APIClientBaseFunctions;
  roles: APIClientBaseFunctions & {
    permissions: APIClientBaseFunctions & {
      delete: (arg0: { id: string }, arg1: { permissions: Asset[] }) => Promise<void>;
      create: (arg0: { id: string }, arg1: { permissions: Asset[] }) => Promise<Asset>;
    };
  };
  rules: APIClientBaseFunctions;
  rulesConfigs: APIClientBaseFunctions & {
    getAll: () => Promise<Asset[]>;
  };
  tenant: APIClientBaseFunctions & {
    getSettings: () => Promise<Asset & { enabled_locales: Language[] }>;
    updateSettings: (arg0: Asset) => Promise<void>;
  };
  triggers: APIClientBaseFunctions & {
    getTriggerBindings: () => Promise<Asset>;
  };
}; // TODO: replace with a more accurate representation of the Auth0APIClient type

export type Auth0APIClient = BaseAuth0APIClient & {
  pool: {
    addSingleTask: (arg0: { data: Object; generator: any }) => {
      promise: () => Promise<ApiResponse>;
    };
    addEachTask: (arg0: { data: Object; generator: any }) => {
      promise: () => Promise<Asset[][]>;
    };
  };
};

export type Config = {
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_INPUT_FILE: string;
  AUTH0_ALLOW_DELETE: boolean;
  AUTH0_EXCLUDED: AssetTypes[];
  EXTENSION_SECRET: string;
  AUTH0_ACCESS_TOKEN?: string;
  AUTH0_BASE_PATH?: string;
  AUTH0_AUDIENCE?: string;
  AUTH0_API_MAX_RETRIES?: number;
  AUTH0_KEYWORD_REPLACE_MAPPINGS?: KeywordMappings;
  AUTH0_EXPORT_IDENTIFIERS?: boolean;
  AUTH0_CONNECTIONS_DIRECTORY?: string;
  EXCLUDED_PROPS?: {
    [key: string]: string[];
  };
  INCLUDED_PROPS?: {
    [key: string]: string[];
  };
  AUTH0_IGNORE_UNAVAILABLE_MIGRATIONS?: boolean;
  // Eventually deprecate. See: https://github.com/auth0/auth0-deploy-cli/issues/451#user-content-deprecated-exclusion-props
  AUTH0_EXCLUDED_RULES?: string[];
  AUTH0_EXCLUDED_CLIENTS?: string[];
  AUTH0_EXCLUDED_DATABASES?: string[];
  AUTH0_EXCLUDED_CONNECTIONS?: string[];
  AUTH0_EXCLUDED_RESOURCE_SERVERS?: string[];
  AUTH0_EXCLUDED_DEFAULTS?: string[];
}; // TODO: replace with a more accurate representation of the Config type

export type Asset = { [key: string]: any };

export type Assets = Partial<{
  actions: Asset[] | null;
  attackProtection: Asset | null;
  branding: {
    templates?: { template: string; body: string }[] | null;
  } | null;
  clients: Asset[] | null;
  clientGrants: Asset[] | null;
  connections: Asset[] | null;
  customDomains: Asset[] | null;
  databases: Asset[] | null;
  emailProvider: Asset | null;
  emailTemplates: Asset[] | null;
  guardianFactorProviders: Asset[] | null;
  guardianFactors: Asset[] | null;
  guardianFactorTemplates: Asset[] | null;
  guardianPhoneFactorMessageTypes: {
    message_types: Asset[]; //TODO: eliminate this intermediate level for consistency
  } | null;
  guardianPhoneFactorSelectedProvider: Asset | null;
  guardianPolicies: {
    policies: Asset[]; //TODO: eliminate this intermediate level for consistency
  } | null;
  hooks: Asset[] | null;
  logStreams: Asset[] | null;
  migrations: Asset[] | null;
  organizations: Asset[] | null;
  pages: Asset[] | null;
  prompts: Prompts | null;
  resourceServers: Asset[] | null;
  roles: Asset[] | null;
  rules: Asset[] | null;
  rulesConfigs: Asset[] | null;
  tenant: Asset | null;
  triggers: Asset[] | null;
  //non-resource types
  exclude?: {
    [key: string]: string[];
  };
  clientsOrig: Asset[] | null;
  themes: ThemeRequest[] | null;
}>;

export type CalculatedChanges = {
  del: Asset[];
  update: Asset[];
  conflicts: Asset[];
  create: Asset[];
};

export type AssetTypes =
  | 'rules'
  | 'rulesConfigs'
  | 'hooks'
  | 'pages'
  | 'databases'
  | 'clientGrants'
  | 'resourceServers'
  | 'clients'
  | 'connections'
  | 'tenant'
  | 'emailProvider'
  | 'emailTemplates'
  | 'guardianFactors'
  | 'guardianFactorProviders'
  | 'guardianFactorTemplates'
  | 'migrations'
  | 'guardianPhoneFactorMessageTypes'
  | 'guardianPhoneFactorSelectedProvider'
  | 'guardianPolicies'
  | 'roles'
  | 'actions'
  | 'organizations'
  | 'triggers'
  | 'attackProtection'
  | 'branding'
  | 'logStreams'
  | 'prompts'
  | 'customDomains'
  | 'themes';

export type KeywordMappings = { [key: string]: (string | number)[] | string | number };

export type ParsedAsset<Key extends AssetTypes, T> = {
  [key in Key]: T | null;
};

export const languages = [
  'ar',
  'bg',
  'bs',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'fi',
  'fr',
  'fr-CA',
  'fr-FR',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'is',
  'it',
  'ja',
  'ko',
  'lt',
  'lv',
  'nb',
  'nl',
  'pl',
  'pt',
  'pt-BR',
  'pt-PT',
  'ro',
  'ru',
  'sk',
  'sl',
  'sr',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-CN',
  'zh-TW',
] as const;

export type Language = typeof languages[number];
