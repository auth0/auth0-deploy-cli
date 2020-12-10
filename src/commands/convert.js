import log from '../logger';
import { getImportContext } from './import';
import { getExportContext } from './export';

export default async function convert(params) {
  const importContext = await getImportContext(params);
  log.info('Import Successful');
  const exportContext = await getExportContext(params);
  log.info(exportContext);
  await exportContext.dump(importContext.assets);
}
