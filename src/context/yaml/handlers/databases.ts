import path from 'path';
import fs from 'fs-extra';
import { mapClientID2NameSorted, sanitize } from '../../../utils';
import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedDatabases = ParsedAsset<'databases', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedDatabases> {
  // Load the script file for custom db
  const { databases } = context.assets;

  if (!databases) return { databases: null };

  return {
    databases: [
      ...databases.map((database) => ({
        ...database,
        options: {
          ...database.options,
          // customScripts option only written if there are scripts
          ...(database.options.customScripts && {
            customScripts: Object.entries(database.options.customScripts).reduce(
              (scripts, [name, script]) => ({
                ...scripts,
                [name]: context.loadFile(script),
              }),
              {}
            ),
          }),
        },
      })),
    ],
  };
}

async function dump(context: YAMLContext): Promise<ParsedDatabases> {
  const { databases, clients } = context.assets;

  if (!databases) return { databases: null };

  const sortCustomScripts = ([name1]: [string, Function], [name2]: [string, Function]): number => {
    if (name1 === name2) return 0;
    return name1 > name2 ? 1 : -1;
  };

  return {
    databases: [
      ...databases.map((database) => ({
        ...database,
        ...(database.enabled_clients && {
          enabled_clients: mapClientID2NameSorted(database.enabled_clients, clients || []),
        }),
        options: {
          ...database.options,
          // customScripts option only written if there are scripts
          ...(database.options.customScripts && {
            customScripts: Object.entries(database.options.customScripts)
              //@ts-ignore because we'll fix this in subsequent PR
              .sort(sortCustomScripts)
              .reduce((scripts, [name, script]) => {
                // Create Database folder
                const dbName = sanitize(database.name);
                const dbFolder = path.join(context.basePath, 'databases', sanitize(dbName));
                fs.ensureDirSync(dbFolder);

                // Dump custom script to file
                const scriptName = sanitize(name);
                const scriptFile = path.join(dbFolder, `${scriptName}.js`);
                log.info(`Writing ${scriptFile}`);
                //@ts-ignore because we'll fix this in subsequent PR
                fs.writeFileSync(scriptFile, script);
                scripts[name] = `./databases/${dbName}/${scriptName}.js`;
                return scripts;
              }, {}),
          }),
        },
      })),
    ],
  };
}
const databasesHandler: YAMLHandler<ParsedDatabases> = {
  parse,
  dump,
};

export default databasesHandler;
