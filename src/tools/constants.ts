const PAGE_GUARDIAN_MULTIFACTOR = 'guardian_multifactor';
const PAGE_PASSWORD_RESET = 'password_reset';
const PAGE_LOGIN = 'login';
const PAGE_ERROR = 'error_page';
const RULES_STAGES = ['login_success'];
const DATABASE_SCRIPTS_GET_USER = 'get_user';
const DATABASE_SCRIPTS_CHANGE_EMAIL = 'change_email';

const EMAIL_VERIFY = 'verify_email';
const EMAIL_VERIFY_BY_CODE = 'verify_email_by_code';
const EMAIL_RESET = 'reset_email';
const EMAIL_WELCOME = 'welcome_email';
const EMAIL_BLOCKED = 'blocked_account';
const EMAIL_STOLEN_CREDENTIALS = 'stolen_credentials';
const EMAIL_ENROLLMENT = 'enrollment_email';
const EMAIL_CHANGE_PASSWORD = 'change_password';
const EMAIL_PASSWORD_RESET = 'password_reset';
const EMAIL_MFA_OOB_CODE = 'mfa_oob_code';
const EMAIL_USER_INVITATION = 'user_invitation';

const UNIVERSAL_LOGIN_TEMPLATE = 'universal_login';

const OBFUSCATED_SECRET_VALUE = '_VALUE_NOT_SHOWN_';

const constants = {
  CONCURRENT_CALLS: 5,
  RULES_DIRECTORY: 'rules',
  RULES_STAGES,
  DEFAULT_RULE_STAGE: RULES_STAGES[0],
  HOOKS_HIDDEN_SECRET_VALUE: OBFUSCATED_SECRET_VALUE,
  OBFUSCATED_SECRET_VALUE,
  HOOKS_DIRECTORY: 'hooks',
  ACTIONS_DIRECTORY: 'actions',
  TRIGGERS_DIRECTORY: 'triggers',
  RULES_CONFIGS_DIRECTORY: 'rules-configs',
  PAGES_DIRECTORY: 'pages',
  PAGE_LOGIN,
  PAGE_GUARDIAN_MULTIFACTOR,
  PAGE_PASSWORD_RESET,
  PAGE_ERROR,
  DATABASE_CONNECTIONS_DIRECTORY: 'database-connections',
  DATABASE_SCRIPTS_CHANGE_EMAIL,
  DATABASE_SCRIPTS_GET_USER,
  EMAIL_TEMPLATES_TYPES: [
    'verify_email',
    'verify_email_by_code',
    'reset_email',
    'welcome_email',
    'blocked_account',
    'stolen_credentials',
    'enrollment_email',
    'mfa_oob_code',
    'change_password',
    'password_reset',
    'user_invitation',
  ],
  ACTIONS_TRIGGERS: [
    'post-login',
    'credentials-exchange',
    'pre-user-registration',
    'post-user-registration',
    'post-change-password',
    'send-phone-message',
  ],
  EMAIL_TEMPLATES_DIRECTORY: 'emails',
  EMAIL_VERIFY,
  EMAIL_VERIFY_BY_CODE,
  EMAIL_RESET,
  EMAIL_WELCOME,
  EMAIL_BLOCKED,
  EMAIL_STOLEN_CREDENTIALS,
  EMAIL_ENROLLMENT,
  EMAIL_CHANGE_PASSWORD,
  EMAIL_PASSWORD_RESET,
  EMAIL_MFA_OOB_CODE,
  EMAIL_USER_INVITATION,
  GUARDIAN_DIRECTORY: 'guardian',
  GUARDIAN_FACTORS_DIRECTORY: 'factors',
  GUARDIAN_PROVIDERS_DIRECTORY: 'providers',
  GUARDIAN_TEMPLATES_DIRECTORY: 'templates',
  UNIVERSAL_LOGIN_TEMPLATE,
  RESOURCE_SERVERS_DIRECTORY: 'resource-servers',
  RESOURCE_SERVERS_CLIENT_NAME: 'resourceServers',
  RESOURCE_SERVERS_MANAGEMENT_API_NAME: 'Auth0 Management API',
  RESOURCE_SERVERS_ID_NAME: 'id',
  CLIENTS_DIRECTORY: 'clients',
  CLIENTS_GRANTS_DIRECTORY: 'grants',
  BRANDING_DIRECTORY: 'branding',
  BRANDING_TEMPLATES_DIRECTORY: 'templates',
  BRANDING_TEMPLATES_YAML_DIRECTORY: 'branding_templates',
  CLIENTS_CLIENT_NAME: 'clients',
  CLIENTS_CLIENT_ID_NAME: 'client_id',
  CONNECTIONS_DIRECTORY: 'connections',
  CONNECTIONS_CLIENT_NAME: 'connections',
  CONNECTIONS_ID_NAME: 'id',
  ROLES_DIRECTORY: 'roles',
  ATTACK_PROTECTION_DIRECTORY: 'attack-protection',
  GUARDIAN_FACTORS: [
    'sms',
    'push-notification',
    'otp',
    'email',
    'duo',
    'webauthn-roaming',
    'webauthn-platform',
    'recovery-code',
  ],
  GUARDIAN_POLICIES: ['all-applications', 'confidence-score'],
  GUARDIAN_PHONE_PROVIDERS: ['auth0', 'twilio', 'phone-message-hook'],
  GUARDIAN_PHONE_MESSAGE_TYPES: ['sms', 'voice'],
  GUARDIAN_FACTOR_TEMPLATES: ['sms'],
  GUARDIAN_FACTOR_PROVIDERS: {
    sms: ['twilio'],
    'push-notification': ['sns'],
  },
  PAGE_NAMES: [
    `${PAGE_GUARDIAN_MULTIFACTOR}.html`,
    `${PAGE_GUARDIAN_MULTIFACTOR}.json`,
    `${PAGE_PASSWORD_RESET}.html`,
    `${PAGE_PASSWORD_RESET}.json`,
    `${PAGE_LOGIN}.html`,
    `${PAGE_LOGIN}.json`,
    `${PAGE_ERROR}.html`,
    `${PAGE_ERROR}.json`,
  ],
  DATABASE_SCRIPTS: [
    DATABASE_SCRIPTS_GET_USER,
    'create',
    'verify',
    'login',
    'change_password',
    'delete',
    DATABASE_SCRIPTS_CHANGE_EMAIL,
  ],
  DATABASE_SCRIPTS_NO_IMPORT: [
    DATABASE_SCRIPTS_GET_USER,
    'create',
    'verify',
    'login',
    'change_password',
    'delete',
  ],
  DATABASE_SCRIPTS_IMPORT: [DATABASE_SCRIPTS_GET_USER, 'login'],
  EMAIL_TEMPLATES_NAMES: [
    `${EMAIL_VERIFY}.json`,
    `${EMAIL_VERIFY}.html`,
    `${EMAIL_VERIFY_BY_CODE}.json`,
    `${EMAIL_VERIFY_BY_CODE}.html`,
    `${EMAIL_RESET}.json`,
    `${EMAIL_RESET}.html`,
    `${EMAIL_WELCOME}.json`,
    `${EMAIL_WELCOME}.html`,
    `${EMAIL_BLOCKED}.json`,
    `${EMAIL_BLOCKED}.html`,
    `${EMAIL_STOLEN_CREDENTIALS}.json`,
    `${EMAIL_STOLEN_CREDENTIALS}.html`,
    `${EMAIL_ENROLLMENT}.json`,
    `${EMAIL_ENROLLMENT}.html`,
    `${EMAIL_CHANGE_PASSWORD}.json`,
    `${EMAIL_CHANGE_PASSWORD}.html`,
    `${EMAIL_PASSWORD_RESET}.json`,
    `${EMAIL_PASSWORD_RESET}.html`,
    `${EMAIL_MFA_OOB_CODE}.json`,
    `${EMAIL_MFA_OOB_CODE}.html`,
    `${EMAIL_USER_INVITATION}.json`,
    `${EMAIL_USER_INVITATION}.html`,
  ],
  SUPPORTED_BRANDING_TEMPLATES: [UNIVERSAL_LOGIN_TEMPLATE],
  LOG_STREAMS_DIRECTORY: 'log-streams',
  PROMPTS_DIRECTORY: 'prompts',
  CUSTOM_DOMAINS_DIRECTORY: 'custom-domains',
  THEMES_DIRECTORY: 'themes',
};

export default constants;
