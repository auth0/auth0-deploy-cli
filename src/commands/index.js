import importCMD from './import.ts';
import exportCMD from './export.ts';

export default {
  import: importCMD,
  export: exportCMD,
  deploy: importCMD,
  dump: exportCMD
};
