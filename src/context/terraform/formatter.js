/* eslint-disable no-use-before-define */

import { tfNameSantizer } from '../../utils';

function handleRawValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  // multi-line
  if (value.indexOf('\n') > -1) {
    return `<<EOT
${value}
EOT`;
  }
  if (value.startsWith('${') && value.endsWith('}')) {
    return value.substring(2, value.length - 1);
  }
  return `"${value}"`;
}

function indent(tabs) {
  return '  '.repeat(tabs);
}

const isNil = value => value === null || value === undefined;

function formatObject(key, value, tabs) {
  const ind = indent(tabs);

  // Empty Object
  if (Object.keys(value).length === 0) {
    return `${ind}${key} {}`;
  }

  // Recursively process Object
  return `${ind}${key} {
${formatHCLContent(value, tabs + 1)}
${ind}}`;
}

function formatArray(key, value, tabs) {
  const ind = indent(tabs);

  // Empty Array
  if (!value.length) return `${ind}${key} = []`;

  // Array of Objects
  if (typeof value[0] === 'object') {
    return value
      .map(subContent => formatObject(key, subContent, tabs))
      .join('\n');
  }

  // Array of Other
  const ind1 = indent(tabs + 1);
  return `${ind}${key} = [
${ind1}${value.map(handleRawValue).join(`,\n${ind1}`)}
${ind}]`;
}

function formatOther(key, value, tabs) {
  return `${indent(tabs)}${key} = ${handleRawValue(value)}`;
}

function formatHCLContent(content, tabs) {
  return Object.keys(content).map((key) => {
    const value = content[key];

    // undefined
    if (isNil(value)) return value;

    // Array
    if (Array.isArray(value)) {
      return formatArray(key, value, tabs);
    }

    // Object
    if (typeof value === 'object') {
      return formatObject(key, value, tabs);
    }

    // Other - String, Number, Boolean
    return formatOther(key, value, tabs);
  }).filter(x => !isNil(x)).join('\n');
}

export default function(jsonObject) {
  const resourceName = tfNameSantizer(jsonObject.name);
  return `resource ${jsonObject.type} "${resourceName}" {
${formatHCLContent(jsonObject.content, 1)}
}`;
}
