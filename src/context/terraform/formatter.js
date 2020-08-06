function handleRawValue(value) {
  if (typeof value === 'string') {
    if (value.indexOf('\n') !== -1) {
      return `<<EOT
${value}
EOT`;
    }
    return `"${value}"`;
  }
  return value;
}
function indent(tabs) {
  return '  '.repeat(tabs);
}
function formatHCLContent(content, tabs) {
  return Object.keys(content).map((key) => {
    const value = content[key];
    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] !== 'object') {
        return `${indent(tabs)}${key} = [
${indent(tabs + 1)}${value.map(arrVal => handleRawValue(arrVal)).join(`${indent(tabs + 1)}\n`)}
${indent(tabs)}]`;
      }
      return value.map(subContent => `${indent(tabs)}${key} {
${formatHCLContent(subContent, tabs + 1)}
${indent(tabs)}}`).join('\n');
    } else if (typeof value === 'object') {
      return `${indent(tabs)}${key} {
${formatHCLContent(value, tabs + 1)}
${indent(tabs)}}`;
    }
    return `${indent(tabs)}${key} = ${handleRawValue(value)}`;
  }).join('\n');
}

export default function(jsonObject) {
  return `resource ${jsonObject.type} "${jsonObject.name.replace(/[^A-Z,^a-z,^0-9,^_,^-]/g, '_')}" {
${formatHCLContent(jsonObject.content, 1)}
}`;
}
