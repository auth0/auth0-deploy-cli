import importCMD from './import';
import exportCMD from './export';

export default {
  import: importCMD,
  export: exportCMD,
  deploy: importCMD,
  dump: exportCMD
};
