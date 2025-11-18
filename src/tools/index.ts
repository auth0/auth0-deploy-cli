import constants from './constants';
import deploy from './deploy';
import Auth0 from './auth0';
import {
  keywordReplace,
  loadFileAndReplaceKeywords,
  wrapArrayReplaceMarkersInQuotes,
} from './utils';

// Explicit type to avoid non-portable type inference
const tools: {
  constants: typeof constants;
  deploy: typeof deploy;
  keywordReplace: typeof keywordReplace;
  loadFileAndReplaceKeywords: typeof loadFileAndReplaceKeywords;
  wrapArrayReplaceMarkersInQuotes: typeof wrapArrayReplaceMarkersInQuotes;
  Auth0: typeof Auth0;
} = {
  constants,
  deploy,
  keywordReplace,
  loadFileAndReplaceKeywords,
  wrapArrayReplaceMarkersInQuotes,
  Auth0,
};

export default tools;

export {
  constants,
  deploy,
  keywordReplace,
  loadFileAndReplaceKeywords,
  wrapArrayReplaceMarkersInQuotes,
  Auth0,
};
