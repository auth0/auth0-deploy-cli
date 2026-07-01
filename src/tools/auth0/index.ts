import Ajv from 'ajv/lib/ajv';
import { cloneDeep } from 'lodash';
import chalk from 'chalk';
import { intro, select, spinner, log as promptsLog } from '@clack/prompts';

import { PromisePoolExecutor } from 'promise-pool-executor';
import pagedClient from './client';
import schema from './schema';
import handlers from './handlers';

import {
  Assets,
  AssetTypes,
  Auth0APIClient,
  CalculatedChanges,
  DetailedDryRunChanges,
  DetailedDryRunChange,
} from '../../types';
import APIHandler from './handlers/default';
import { ConfigFunction } from '../../configFactory';
import { dryRunFormatAssets, exportDiffLog } from '../calculateDryRunChanges';
import { isTruthy } from '../../utils';
import { printCLIMessage } from '../utils';

export type Stage = 'load' | 'validate' | 'processChanges';

type StageFunction = APIHandler['load']; // Using `load` method as a template for what type stage functions resemble

/**
 * Sorts handlers by their @order decorator metadata for a given stage.
 * Handlers are sorted in ascending order (lower values execute first).
 * Default order is 50 for handlers without explicit @order metadata.
 * Uses stable sort: preserves insertion order when order values are equal.
 *
 * @param toSort - Array of API handlers to sort
 * @param stage - The stage name (load, validate, processChanges)
 * @returns Sorted array of handlers
 */
function sortByOrder(toSort: APIHandler[], stage: Stage): APIHandler[] {
  const defaultOrder = 50;

  const sorted = [...toSort];
  sorted.sort((a, b) => {
    // @ts-ignore because stage methods may have order property
    const aOrder = a[stage]?.order || defaultOrder;
    // @ts-ignore because stage methods may have order property
    const bOrder = b[stage]?.order || defaultOrder;

    return aOrder - bOrder;
  });
  return sorted;
}

function buildTableBorder(left: string, middle: string, right: string, widths: number[]): string {
  return `${left}${widths.map((width) => '─'.repeat(width + 2)).join(middle)}${right}`;
}

function formatStatusCell(status: string, width: number): string {
  let statusColor;
  const baseStatus = status.replace(' *', '');

  switch (baseStatus) {
    case 'CREATE':
      statusColor = chalk.green;
      break;
    case 'UPDATE':
      statusColor = chalk.yellow;
      break;
    case 'DELETE':
      statusColor = chalk.red;
      break;
    default:
      statusColor = chalk.white;
  }

  if (status.includes(' *')) {
    return `${statusColor(baseStatus.padEnd(width - 2))}${chalk.dim(' *')}`;
  }

  return statusColor(baseStatus.padEnd(width));
}

export default class Auth0 {
  client: Auth0APIClient;
  config: ConfigFunction;
  assets: Assets;
  handlers: APIHandler[];

  constructor(client: Auth0APIClient, assets: Assets, config: ConfigFunction) {
    this.client = pagedClient(client);
    this.config = config;
    this.assets = assets;

    this.handlers = Object.values(handlers)
      .map((handler) => {
        //@ts-ignore because class expects `type` property but gets directly injected into class constructors
        return new handler.default({ client: this.client, config: this.config });
      })
      .filter((handler) => {
        const excludedAssetTypes: undefined | AssetTypes[] = config('AUTH0_EXCLUDED');

        if (excludedAssetTypes === undefined) return true;

        return !excludedAssetTypes.includes(handler.type as AssetTypes);
      })
      .filter((handler) => {
        const onlyIncludedAssetTypes: undefined | AssetTypes[] = config('AUTH0_INCLUDED_ONLY');

        if (onlyIncludedAssetTypes === undefined) return true;

        return onlyIncludedAssetTypes.includes(handler.type as AssetTypes);
      });
  }

  async runStage(stage: Stage): Promise<void> {
    // Sort by priority
    for (const handler of sortByOrder(this.handlers, stage)) {
      // eslint-disable-line
      try {
        const stageFn: StageFunction = Object.getPrototypeOf(handler)[stage];
        if (typeof stageFn !== 'function') {
          throw new Error(
            `Handler ${
              handler.type
            } does not have a ${stage} method or it is not a function (got ${typeof stageFn})`
          );
        }
        this.assets = {
          ...this.assets,
          ...((await stageFn.apply(handler, [this.assets])) || {}),
        };
      } catch (err) {
        err.type = handler.type;
        err.stage = stage;
        throw err;
      }
    }
  }

  async validate(): Promise<void> {
    const ajv = new Ajv({ useDefaults: true, nullable: true });
    const nonNullAssets = Object.keys(this.assets)
      .filter((k) => this.assets[k] != null)
      .reduce((a, k) => ({ ...a, [k]: this.assets[k] }), {});
    const valid = ajv.validate(schema, nonNullAssets);
    if (!valid) {
      throw new Error(`Schema validation failed loading ${JSON.stringify(ajv.errors, null, 4)}`);
    }

    await this.runStage('validate');
  }

  async loadAssetsFromAuth0(): Promise<void> {
    // Populate assets from auth0 tenant
    await this.runStage('load');
  }

  async processChanges(): Promise<void> {
    await this.runStage('processChanges');
  }

  async dryRun(opts: { interactive?: boolean } = {}): Promise<boolean> {
    const isDebug = process.env.AUTH0_DEBUG === 'true';

    const s = spinner();
    if (isDebug) {
      promptsLog.info('Preparing dry run preview...\n');
    } else {
      s.start('Preparing dry run preview...');
    }

    // Collect changes from all handlers
    const allChanges: DetailedDryRunChanges = {};
    const savedAssets = this.assets;
    this.assets = await dryRunFormatAssets(cloneDeep(this.assets), this.client);

    const dryRunPool = new PromisePoolExecutor({
      concurrencyLimit: 2,
      frequencyLimit: 8,
      frequencyWindow: 1000, // 1 sec
    });
    await dryRunPool
      .addEachTask({
        data: this.handlers,
        generator: (handler) =>
          (async () => {
            try {
              const detailedChanges: DetailedDryRunChange[] = [];
              let created = 0;
              let updated = 0;
              let deleted = 0;

              if (isDebug) {
                promptsLog.info(`Calculating dry run changes for ${handler.type}...`);
              } else {
                s.message(`Calculating dry run changes for ${handler.type}...`);
              }

              const changes: CalculatedChanges = await handler.dryRunChanges(this.assets);

              if (changes.create) {
                changes.create.forEach((item) => {
                  detailedChanges.push({
                    action: 'CREATE' as const,
                    identifier: handler.getResourceName(item),
                    details: item,
                  });
                });
                created = changes.create.length;
              }

              if (changes.update) {
                changes.update.forEach((item) => {
                  detailedChanges.push({
                    action: 'UPDATE' as const,
                    identifier: handler.getResourceName(item),
                    details: item,
                  });
                });
                updated = changes.update.length;
              }

              if (changes.del) {
                changes.del.forEach((item) => {
                  detailedChanges.push({
                    action: 'DELETE' as const,
                    identifier: handler.getResourceName(item),
                    details: item,
                  });
                });
                deleted = changes.del.length;
              }

              allChanges[handler.type] = {
                created,
                updated,
                deleted,
                changes: detailedChanges,
              };
            } catch (err) {
              err.type = handler.type;
              err.stage = 'dryRun';
              throw err;
            }
          })(),
      })
      .promise();

    // Restore original assets so processChanges() works correctly after dryRun()
    this.assets = savedAssets;

    if (!isDebug) {
      printCLIMessage('');
      s.stop('Done\n');
    }

    // Build formatted table output
    const allowDelete =
      this.config('AUTH0_ALLOW_DELETE') === 'true' || this.config('AUTH0_ALLOW_DELETE') === true;
    const tenantDomain = this.config('AUTH0_DOMAIN');
    const inputPath = this.config('AUTH0_INPUT_FILE') || './tenant-config-directory/';

    let output = '\n';
    output += chalk.bold('Auth0 Deploy CLI - Dry Run Preview\n\n');
    output += chalk.bold('Tenant:') + ` ${tenantDomain}\n`;
    output += chalk.bold('Input:') + ` ${inputPath}\n\n`;
    output += 'Simulating deployment... The following changes are proposed:\n\n';

    interface TableRow {
      resource: string;
      status: string;
      name: string;
    }
    const tableData: TableRow[] = [];
    const resourceTypes = Object.keys(allChanges).sort();

    resourceTypes.forEach((type) => {
      const typeChanges = allChanges[type];
      if (typeChanges.changes.length > 0) {
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);
        typeChanges.changes.forEach((change, index) => {
          const deleteNote = change.action === 'DELETE' && !allowDelete ? ' *' : '';
          tableData.push({
            resource: index === 0 ? typeName : '',
            status: change.action + deleteNote,
            name: change.identifier,
          });
        });
      }
    });

    if (tableData.length > 0) {
      const resourceWidth = Math.max(10, ...tableData.map((d) => d.resource.length));
      const statusWidth = Math.max(8, ...tableData.map((d) => d.status.length));
      const nameWidth = Math.max(25, ...tableData.map((d) => d.name.length));

      const widths = [resourceWidth, statusWidth, nameWidth];
      const topBorder = buildTableBorder('┌', '┬', '┐', widths);
      const headerSeparator = buildTableBorder('├', '┼', '┤', widths);
      const bottomBorder = buildTableBorder('└', '┴', '┘', widths);

      output += `${topBorder}\n`;
      output += `│ ${chalk.bold('Resource'.padEnd(resourceWidth))} │ ${chalk.bold(
        'Status'.padEnd(statusWidth)
      )} │ ${chalk.bold('Name / Identifier'.padEnd(nameWidth))} │\n`;
      output += `${headerSeparator}\n`;

      tableData.forEach((row) => {
        output += `│ ${row.resource.padEnd(resourceWidth)} │ ${formatStatusCell(
          row.status,
          statusWidth
        )} │ ${row.name.padEnd(nameWidth)} │\n`;
      });

      output += `${bottomBorder}\n`;

      if (!allowDelete && tableData.some((d) => d.status.includes('*'))) {
        output += '\n' + chalk.dim('* Requires AUTH0_ALLOW_DELETE to be enabled');
      }
    } else {
      output += chalk.dim('No changes detected.');
    }

    output += '\n\n';
    output += chalk.green('Dry Run completed successfully.') + '\n';
    printCLIMessage(output);

    const hasChanges = tableData.length > 0;
    const shouldApplyAfterPreview = isTruthy(this.config('AUTH0_DRY_RUN_APPLY'));

    if (opts.interactive && process.stdout.isTTY && !shouldApplyAfterPreview && hasChanges) {
      intro(chalk.inverse(' dry-run '));
      const selectedType = await select({
        message: 'What would you like to do?',
        options: [
          { value: 'dry-run-apply', label: 'Apply changes' },
          {
            value: 'dry-run-export',
            label: 'Export changes in a file',
            hint: 'No Apply',
          },
          { value: 'dry-run-exit', label: 'Exit', hint: '' },
        ],
      });

      switch (selectedType) {
        case 'dry-run-apply':
          printCLIMessage('\n' + chalk.green('Applying changes...') + '\n');
          await this.processChanges();
          break;
        case 'dry-run-export': {
          const fileName = 'dry-run-diff-log.json';
          await exportDiffLog(fileName);
          printCLIMessage('\n' + chalk.cyan(`Exported on ./${fileName}`) + '\n');
          break;
        }
        case 'dry-run-exit':
          printCLIMessage(
            '\n' + chalk.yellow('Deployment cancelled. No changes were made.') + '\n'
          );
          process.exit(0);
          break;
        default:
          printCLIMessage(chalk.red('Invalid option selected.'));
          process.exit(1);
      }
    }

    return hasChanges;
  }
}
