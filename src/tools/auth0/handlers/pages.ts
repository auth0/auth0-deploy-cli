import { Client } from 'auth0/legacy';
import DefaultHandler from './default';
import constants from '../../constants';
import { Asset, Assets } from '../../../types';
import { paginate } from '../client';

export const supportedPages = constants.PAGE_NAMES.filter((p) => p.includes('.json')).map((p) =>
  p.replace('.json', '')
);

export const pageNameMap = {
  guardian_multifactor: 'guardian_mfa_page',
  password_reset: 'change_password',
  error_page: 'error_page',
};

export type Page = {
  show_log_link?: boolean;
  name: string;
  enabled?: boolean;
  html?: string;
  url?: string;
};

// With this schema, we can only validate property types but not valid properties on per type basis
export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', enum: supportedPages },
      html: { type: 'string', default: '' },
      url: { type: 'string' },
      show_log_link: { type: 'boolean' },
      enabled: { type: 'boolean' },
    },
    required: ['name'],
  },
};

export default class PagesHandler extends DefaultHandler {
  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'pages',
      identifiers: ['name'],
    });
  }

  objString(page): string {
    return super.objString({ name: page.name, enabled: page.enabled });
  }

  async updateLoginPage(page): Promise<void> {
    const globalClient = await paginate<Client>(this.client.clients.getAll, {
      paginate: true,
      include_totals: true,
      is_global: true,
    });

    if (!globalClient[0]) {
      throw new Error('Unable to find global client id when trying to update the login page');
    }

    await this.client.clients.update(
      { client_id: globalClient[0].client_id },
      {
        custom_login_page: page.html,
        custom_login_page_on: page.enabled,
      }
    );
    this.updated += 1;
    this.didUpdate(page);
  }

  async updatePages(pages: Asset[]): Promise<void> {
    const toUpdate = pages.filter((p) => supportedPages.includes(p.name));
    const update = toUpdate.reduce((accum, page) => {
      if (supportedPages.includes(page.name)) {
        const pageName = pageNameMap[page.name];
        if (!pageName) {
          throw new Error(`Unable to map page ${page.name} into tenant level page setting`);
        }
        accum[pageName] = { ...page };
        delete accum[pageName].name;
      }
      return accum;
    }, {});

    if (Object.keys(update).length) {
      await this.client.tenants.updateSettings(update);
    }

    toUpdate.forEach((page) => {
      this.updated += 1;
      this.didUpdate(page);
    });
  }

  async getType(): Promise<Asset[]> {
    const pages: {
      name: string;
      enabled: boolean;
      html: string;
    }[] = [];

    // Login page is handled via the global client
    const globalClient = await paginate<Client>(this.client.clients.getAll, {
      paginate: true,
      include_totals: true,
      is_global: true,
    });
    if (!globalClient[0]) {
      throw new Error('Unable to find global client id when trying to dump the login page');
    }

    if (globalClient[0].custom_login_page) {
      pages.push({
        name: 'login',
        enabled: !!globalClient[0].custom_login_page_on,
        html: globalClient[0].custom_login_page,
      });
    }

    const { data: tenantSettings } = await this.client.tenants.getSettings();

    Object.entries(pageNameMap).forEach(([key, name]) => {
      const page = tenantSettings[name];
      if (tenantSettings[name]) {
        pages.push({
          ...page,
          name: key,
        });
      }
    });

    return pages;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { pages } = assets;

    // Do nothing if not set
    if (!pages) return;

    // Login page is handled via the global client
    const loginPage = pages.find((p) => p.name === 'login');
    if (loginPage !== undefined) {
      await this.updateLoginPage(loginPage);
    }

    // Rest of pages are on tenant level settings
    await this.updatePages(pages.filter((p) => p.name !== 'login'));
  }
}
