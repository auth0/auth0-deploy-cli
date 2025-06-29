import chalk from 'chalk';
import { intro, select } from '@clack/prompts';
import Auth0 from './auth0';
import log from '../logger';
import { ConfigFunction } from '../configFactory';
import { Assets, Auth0APIClient } from '../types';
import { exportDiffLog } from './calculateChanges';

export default async function deploy(
  assets: Assets,
  client: Auth0APIClient,
  config: ConfigFunction
) {
  // Setup log level
  log.level = process.env.AUTH0_DEBUG === 'true' ? 'debug' : 'info';

  const isDryRun = config('AUTH0_DRY_RUN') === true || config('AUTH0_DRY_RUN') === 'true';

  log.info(
    `Getting access token for ${
      config('AUTH0_CLIENT_ID') !== undefined ? `${config('AUTH0_CLIENT_ID')}/` : ''
    }${config('AUTH0_DOMAIN')}`
  );

  const auth0 = new Auth0(client, assets, config);

  // Validate Assets
  await auth0.validate();

  if (isDryRun) {
    // In dry run mode, perform a dry run instead of processing changes
    const allChanges = await auth0.dryRun();

    // Build formatted output
    const allowDelete =
      config('AUTH0_ALLOW_DELETE') === 'true' || config('AUTH0_ALLOW_DELETE') === true;

    // Get tenant domain and input path for header
    const tenantDomain = config('AUTH0_DOMAIN');
    const inputPath = config('AUTH0_INPUT_FILE') || './tenant-config-directory/';

    let output = '\n';
    output += chalk.bold('Auth0 Deploy CLI - Dry Run Preview\n\n');
    output += chalk.bold('Tenant:') + ` ${tenantDomain}\n`;
    output += chalk.bold('Input:') + ` ${inputPath}\n\n`;
    output += 'Simulating deployment... The following changes are proposed:\n\n';

    // Prepare table data
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
        // Format type name for display
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);

        // Add each change to table data
        typeChanges.changes.forEach((change, index) => {
          const deleteNote = change.action === 'DELETE' && !allowDelete ? ' *' : '';
          tableData.push({
            resource: index === 0 ? typeName : '', // Only show resource name for first item in group
            status: change.action + deleteNote,
            name: change.identifier,
          });
        });
      }
    });

    // Create table
    if (tableData.length > 0) {
      // Calculate column widths
      const resourceWidth = Math.max(10, ...tableData.map((d) => d.resource.length));
      const statusWidth = Math.max(8, ...tableData.map((d) => d.status.length));
      const nameWidth = Math.max(25, ...tableData.map((d) => d.name.length));

      // Table header
      const separator = `|${'-'.repeat(resourceWidth + 2)}|${'-'.repeat(
        statusWidth + 2
      )}|${'-'.repeat(nameWidth + 2)}|`;

      output += `| ${chalk.bold('Resource'.padEnd(resourceWidth))} | ${chalk.bold(
        'Status'.padEnd(statusWidth)
      )} | ${chalk.bold('Name / Identifier'.padEnd(nameWidth))} |\n`;
      output += `${separator}\n`;

      // Table rows
      tableData.forEach((row) => {
        let statusColor;
        const baseStatus = row.status.replace(' *', '');
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

        const status = row.status.includes('*')
          ? statusColor(baseStatus) + chalk.dim(' *')
          : statusColor(baseStatus);

        output += `| ${row.resource.padEnd(resourceWidth)} | ${status.padEnd(
          statusWidth + (row.status.includes('*') ? 10 : 10)
        )} | ${row.name.padEnd(nameWidth)} |\n`;
      });

      if (!allowDelete && tableData.some((d) => d.status.includes('*'))) {
        output += '\n' + chalk.dim('* Requires AUTH0_ALLOW_DELETE to be enabled');
      }
    } else {
      output += chalk.dim('No changes detected.');
    }

    output += '\n\n';
    output +=
      chalk.green('Dry Run completed successfully.') +
      ' No changes have been made to your Auth0 tenant.\n\n';

    // Print the complete formatted output
    console.log(output);

    // if (tableData.length === 0) {
    //   console.log(chalk.dim('No changes to apply.'));
    //   return;
    // }

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

    // Handle selectedType
    switch (selectedType) {
      case 'dry-run-apply':
        console.log('\n' + chalk.green('Applying changes...') + '\n');
        await auth0.processChanges();
        break;
      case 'dry-run-export': {
        const fileName = 'dry-run-diff-log.json';
        await exportDiffLog(fileName);
        console.log('\n' + chalk.cyan(`Exported on ./${fileName}`) + '\n');
        break;
      }
      case 'dry-run-exit':
        console.log('\n' + chalk.yellow('Deployment cancelled. No changes were made.') + '\n');
        process.exit(0);
        break;
      default:
        console.log(chalk.red('Invalid option selected.'));
        process.exit(1);
    }
  } else {
    // Process changes normally
    await auth0.processChanges();
  }

  return auth0.handlers.reduce((accum, h) => {
    accum[h.type] = {
      deleted: h.deleted,
      created: h.created,
      updated: h.updated,
    };
    return accum;
  }, {});
}
