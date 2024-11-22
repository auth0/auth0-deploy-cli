import { GetConnectionsStrategyEnum, ManagementClient, ResourceServer, SsProfile } from 'auth0';
import { PromisePoolExecutor } from 'promise-pool-executor';
import { Action } from './tools/auth0/handlers/actions';
import { Prompts } from './tools/auth0/handlers/prompts';
import { Tenant } from './tools/auth0/handlers/tenant';
import { Page } from './tools/auth0/handlers/pages';
import { LogStream } from './tools/auth0/handlers/logStreams';
import { Client } from './tools/auth0/handlers/clients';
import { ClientGrant } from './tools/auth0/handlers/clientGrants';
import { Theme } from './tools/auth0/handlers/themes';
import { Form } from './tools/auth0/handlers/forms';
import { Flow } from './tools/auth0/handlers/flows';
import { FlowVaultConnection } from './tools/auth0/handlers/flowVaultConnections';

type SharedPaginationParams = {
  checkpoint?: boolean;
  paginate?: boolean;
  is_global?: boolean;
  include_totals?: boolean;
  id?: string;
  strategy?: GetConnectionsStrategyEnum[];
};

export type CheckpointPaginationParams = SharedPaginationParams & {
  from: string;
  take: number;
};

export type PagePaginationParams = SharedPaginationParams & {
  page?: number;
  per_page?: number;
};

export type ApiResponse = {
  start: number;
  limit: number;
  total: number;
  next?: string;
} & { [key in AssetTypes]: Asset[] };

// export type BaseAuth0APIClient = ManagementClient;

export type Auth0APIClient = ManagementClient & {
  pool: PromisePoolExecutor;
};

export type Config = {
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_CLIENT_SIGNING_KEY_PATH: string;
  AUTH0_CLIENT_SIGNING_ALGORITHM: string;
  AUTH0_INPUT_FILE: string;
  AUTH0_ALLOW_DELETE: boolean;
  AUTH0_EXCLUDED?: AssetTypes[];
  AUTH0_INCLUDED_ONLY?: AssetTypes[];
  AUTH0_PRESERVE_KEYWORDS: boolean;
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
  actions: Action[] | null;
  attackProtection: Asset | null;
  branding:
    | (Asset & {
        templates?: { template: string; body: string }[] | null;
      })
    | null;
  clients: Client[] | null;
  clientGrants: ClientGrant[] | null;
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
    policies: string[]; //TODO: eliminate this intermediate level for consistency
  } | null;
  hooks: Asset[] | null;
  logStreams: LogStream[] | null;
  organizations: Asset[] | null;
  pages: Page[] | null;
  prompts: Prompts | null;
  resourceServers: ResourceServer[] | null;
  roles: Asset[] | null;
  rules: Asset[] | null;
  rulesConfigs: Asset[] | null;
  tenant: Tenant | null;
  triggers: Asset[] | null;
  //non-resource types
  exclude?: {
    [key: string]: string[];
  };
  clientsOrig: Asset[] | null;
  themes: Theme[] | null;
  forms: Form[] | null;
  flows: Flow[] | null;
  flowVaultConnections: FlowVaultConnection[] | null;
  selfServiceProfiles: SsProfile[] | null;
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
  | 'themes'
  | 'forms'
  | 'flows'
  | 'flowVaultConnections'
  | 'selfServiceProfiles';

export type KeywordMappings = { [key: string]: (string | number)[] | string | number };

export type ParsedAsset<Key extends AssetTypes, T> = {
  [key in Key]: T | null;
};

export const languages = [
  'ar',
  'bg',
  'bs',
  'ca-ES',
  'cs',
  'cy',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'eu-ES',
  'fi',
  'fr',
  'fr-CA',
  'fr-FR',
  'gl-ES',
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
  'nn',
  'no',
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
