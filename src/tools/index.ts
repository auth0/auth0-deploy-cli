import constants from './constants';
import deploy from './deploy';
import Auth0 from './auth0';
import { keywordReplace, loadFileAndReplaceKeywords, escapeArrayReplaceSyntax } from './utils';

export default {
  constants,
  deploy,
  keywordReplace,
  loadFileAndReplaceKeywords,
  escapeArrayReplaceSyntax,
  Auth0,
};

export {
  constants,
  deploy,
  keywordReplace,
  loadFileAndReplaceKeywords,
  escapeArrayReplaceSyntax,
  Auth0,
};
