import constants from './constants';
import deploy from './deploy';
import Auth0 from './auth0';
import {
  keywordReplace,
  loadFileAndReplaceKeywords,
  wrapArrayReplaceMarkersInStrings,
} from './utils';

export default {
  constants,
  deploy,
  keywordReplace,
  loadFileAndReplaceKeywords,
  wrapArrayReplaceMarkersInStrings,
  Auth0,
};

export {
  constants,
  deploy,
  keywordReplace,
  loadFileAndReplaceKeywords,
  wrapArrayReplaceMarkersInStrings,
  Auth0,
};
