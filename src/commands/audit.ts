import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import log from '../logger';
import { Assets } from '../types';
import { runAuditChecks } from '../tools/audit';
import { Finding, Severity } from '../tools/audit/types';
import { AuditParams } from '../args';
import { loadAssets } from './loadAssets';

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: '🔴 CRITICAL',
  high:     '🟠 HIGH',
  medium:   '🟡 MEDIUM',
};

const SECRET_FIELD_NAMES = new Set([
  'client_secret', 'secret', 'auth_token', 'smtp_pass', 'api_key',
  'signing_secret', 'private_key', 'access_token', 'refresh_token',
  'twilio_token',
]);

const PLACEHOLDER_RE = /^##.+##$/;

function redactSecrets(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(redactSecrets);
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SECRET_FIELD_NAMES.has(k)) {
        result[k] = '[REDACTED]';
      } else if (typeof v === 'string' && PLACEHOLDER_RE.test(v)) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redactSecrets(v);
      }
    }
    return result;
  }
  return obj;
}

function buildConfigExcerpt(assets: Assets): object {
  return redactSecrets({
    tenant: assets.tenant,
    clients: assets.clients,
    connections: assets.connections,
    attackProtection: assets.attackProtection,
    guardianPolicies: assets.guardianPolicies,
    riskAssessment: assets.riskAssessment,
    logStreams: assets.logStreams,
    clientGrants: assets.clientGrants,
  }) as object;
}

function printToConsole(findings: Finding[], inputFile: string): void {
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

  console.log(`\n  Found ${findings.length} issue(s): ${counts.critical} critical  ${counts.high} high  ${counts.medium} medium\n`);

  for (const finding of sorted) {
    console.log('─'.repeat(70));
    console.log(`  ${SEVERITY_BADGE[finding.severity]}  [${finding.resource}] ${finding.resourceName}`);
    console.log(`\n  Issue:  ${finding.message}`);
    console.log(`\n  Fix:    ${finding.fix}\n`);
  }

  console.log('═'.repeat(70) + '\n');
}

function buildReport(findings: Finding[], inputFile: string): string {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  const counts = { critical: 0, high: 0, medium: 0 };
  for (const f of findings) counts[f.severity]++;

  const lines: string[] = [];
  lines.push(`# Auth0 Security Audit — \`${path.basename(inputFile)}\``);
  lines.push('');

  if (findings.length === 0) {
    lines.push('✅ **No security issues found.**');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`**${findings.length} issue(s) found:** ${counts.critical} critical · ${counts.high} high · ${counts.medium} medium`);
  lines.push('');
  lines.push('| # | Severity | Resource | Name |');
  lines.push('|---|----------|----------|------|');
  sorted.forEach((f, i) => {
    lines.push(`| ${i + 1} | ${SEVERITY_BADGE[f.severity]} | \`${f.resource}\` | ${f.resourceName} |`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  sorted.forEach((f, i) => {
    lines.push(`## ${i + 1}. ${SEVERITY_BADGE[f.severity]} — ${f.resourceName}`);
    lines.push('');
    lines.push(`**Resource:** \`${f.resource}\``);
    lines.push('');
    lines.push(`**Issue:** ${f.message}`);
    lines.push('');
    lines.push(`**Fix:** ${f.fix}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

async function runAiAnalysis(findings: Finding[], assets: Assets): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('  ⚠️  ANTHROPIC_API_KEY not set — skipping AI analysis.\n');
    return '';
  }

  const header = '## 🤖 AI Threat Analysis\n\n';
  console.log('\n' + '─'.repeat(70));
  console.log('  🤖  AI Threat Analysis');
  console.log('─'.repeat(70) + '\n');

  const client = new Anthropic({ apiKey });
  const excerpt = buildConfigExcerpt(assets);

  const userPrompt = `Auth0 tenant security audit findings:

${findings.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.resource} / ${f.resourceName}: ${f.message}`).join('\n')}

CONFIG (secrets redacted):
${JSON.stringify(excerpt, null, 2)}

Provide:
1. TOP 3 PRIORITIES — which 3 to fix first and one sentence why each is most urgent.
2. ATTACK CHAINS — 1-2 realistic scenarios showing how findings combine (2-3 sentences each).
3. QUICK WINS — any fixes that take under 5 minutes.

Be concise. No preamble.`;

  const stream = await client.messages.stream({
    model: 'claude-4-6-sonnet',
    max_tokens: 800,
    system: 'You are a security expert reviewing Auth0 identity infrastructure. Be concise. No preamble.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  let aiText = '';
  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      process.stdout.write(chunk.delta.text);
      aiText += chunk.delta.text;
    }
  }

  console.log('\n\n' + '═'.repeat(70) + '\n');

  return '\n' + header + aiText + '\n';
}

export default async function auditCMD(params: AuditParams): Promise<void> {
  const { input_file: inputFile, ai, output } = params;

  log.info(`Running security audit on: ${inputFile}`);

  const assets = loadAssets(inputFile);
  const findings = runAuditChecks(assets);

  const report = buildReport(findings, inputFile);
  printToConsole(findings, inputFile);

  let aiSection = '';
  if (ai) {
    if (findings.length === 0) {
      console.log('  ✅  No findings to analyze.\n');
    } else {
      aiSection = await runAiAnalysis(findings, assets);
    }
  }

  const outFile = output ? path.basename(output) : ai ? 'audit-report-ai.md' : 'audit-report.md';
  const outPath = path.resolve(process.cwd(), outFile);
  fs.writeFileSync(outPath, report + aiSection, 'utf8');
  console.log(`\n  📄  Report saved to: ${outPath}\n`);

  const hasCritical = findings.some((f) => f.severity === 'critical');
  if (hasCritical) {
    process.exitCode = 1;
  }
}
