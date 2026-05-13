import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import log from '../logger';
import { Assets } from '../types';
import { runAuditChecks } from '../tools/audit';
import { Finding, Severity } from '../tools/audit/types';
import { AuditParams } from '../args';

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: '🔴 CRITICAL',
  high:     '🟠 HIGH    ',
  medium:   '🟡 MEDIUM  ',
};

function loadAssets(inputFile: string): Assets {
  const resolved = path.resolve(inputFile);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Input file not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);

  if (stat.isDirectory()) {
    // Directory format: read individual JSON files per resource type
    const assets: Assets = {};
    const resourceFiles = fs.readdirSync(resolved);
    for (const file of resourceFiles) {
      if (!file.endsWith('.json') && !file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const resourceName = path.basename(file, path.extname(file));
      const content = fs.readFileSync(path.join(resolved, file), 'utf8');
      try {
        (assets as any)[resourceName] = file.endsWith('.json')
          ? JSON.parse(content)
          : yaml.load(content);
      } catch {
        log.warn(`Could not parse ${file}, skipping.`);
      }
    }
    return assets;
  }

  // Single YAML or JSON file
  const content = fs.readFileSync(resolved, 'utf8');
  const parsed = resolved.endsWith('.json') ? JSON.parse(content) : yaml.load(content);
  return parsed as Assets;
}

function printResults(findings: Finding[], inputFile: string): void {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  const counts = { critical: 0, high: 0, medium: 0 };
  for (const f of findings) counts[f.severity]++;

  console.log('\n' + '═'.repeat(70));
  console.log(`  Auth0 Security Audit — ${path.basename(inputFile)}`);
  console.log('═'.repeat(70));

  if (findings.length === 0) {
    console.log('\n  ✅  No security issues found.\n');
    return;
  }

  console.log(
    `\n  Found ${findings.length} issue(s): ` +
    `${counts.critical} critical  ${counts.high} high  ${counts.medium} medium\n`
  );

  for (const finding of sorted) {
    console.log('─'.repeat(70));
    console.log(`  ${SEVERITY_LABEL[finding.severity]}  [${finding.resource}] ${finding.resourceName}`);
    console.log(`\n  Issue:  ${finding.message}`);
    console.log(`\n  Fix:    ${finding.fix}\n`);
  }

  console.log('═'.repeat(70) + '\n');
}

export default async function auditCMD(params: AuditParams): Promise<void> {
  const { input_file: inputFile } = params;

  log.info(`Running security audit on: ${inputFile}`);

  const assets = loadAssets(inputFile);
  const findings = runAuditChecks(assets);

  printResults(findings, inputFile);

  // Exit with non-zero code if critical issues found — useful for CI gating
  const hasCritical = findings.some((f) => f.severity === 'critical');
  if (hasCritical) {
    process.exitCode = 1;
  }
}
