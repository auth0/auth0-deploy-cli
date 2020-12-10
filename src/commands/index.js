import importCMD from './import';
import exportCMD from './export';
import convertCMD from './convert';

export default {
  import: importCMD,
  export: exportCMD,
  deploy: importCMD,
  dump: exportCMD,
  convert: convertCMD
};
