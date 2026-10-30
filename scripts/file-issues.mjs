import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = ['bug', 'confusing', 'wrong-number', 'idea'];
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function parseIssues(markdown, persona) {
  const sections = markdown.split(/^## /m).slice(1);
  return sections.map(section => {
    const [heading, ...lines] = section.split(/\r?\n/);
    const match = heading.match(/^\[(bug|confusing|wrong-number|idea)\] (.+)$/);
    if (!match) throw new Error(`${persona}: invalid issue heading: ${heading}`);
    const [, type, title] = match, body = lines.join('\n').trim();
    for (const field of ['Steps', 'Expected', 'Actual', 'Screenshot']) {
      if (!new RegExp(`^${field}:\\s*\\S`, 'm').test(body)) throw new Error(`${persona}/${title}: missing ${field}`);
    }
    const key = body.match(/^Dedupe-key:\s*(.+)$/m)?.[1] || title;
    const fingerprint = createHash('sha256').update(type + ':' + normalize(key)).digest('hex').slice(0, 20);
    return {type, title, body, persona, fingerprint};
  });
}
export function dedupeIssues(issues) {
  const groups = new Map();
  for (const issue of issues) {
    const existing = groups.get(issue.fingerprint);
    if (existing) existing.reports.push(issue);
    else groups.set(issue.fingerprint, {...issue, reports: [issue]});
  }
  return [...groups.values()];
}
const gh = args => execFileSync('gh', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--file', '--dry-run'].includes(arg)) || args.includes('--file') && args.includes('--dry-run')) throw new Error('Usage: node scripts/file-issues.mjs [--dry-run | --file]');
  const personas = JSON.parse(await fs.readFile(path.join(root, 'testers/personas.json'), 'utf8'));
  const reports = [];
  for (const persona of personas) {
    try {reports.push(...parseIssues(await fs.readFile(path.join(root, 'testers', persona.id, 'issues.md'), 'utf8'), persona.id));}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  const groups = dedupeIssues(reports);
  console.log(`${args.includes('--file') ? 'FILE' : 'DRY RUN'}: ${reports.length} reports -> ${groups.length} unique issues`);
  // Dry-run is entirely local: no GitHub login or network needed.
  let existing = [];
  if (args.includes('--file')) {
    existing = JSON.parse(gh(['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/issues?state=all&labels=tester&per_page=100'])).flat();
    const labels = JSON.parse(gh(['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/labels?per_page=100'])).flat().map(label => label.name);
    for (const label of new Set(['tester', ...groups.map(g => g.type), ...reports.map(r => `persona:${r.persona}`)])) {
      if (!labels.includes(label)) gh(['label', 'create', label, '--color', '7057ff', '--description', 'Persona testing']);
    }
  }
  for (const group of groups) {
    const marker = `<!-- persona-tester:${group.fingerprint} -->`;
    const duplicate = existing.find(issue => issue.body?.includes(marker));
    const labels = ['tester', group.type, ...new Set(group.reports.map(r => `persona:${r.persona}`))];
    const body = `${marker}\n\n` + group.reports.map(r => `### Persona: ${r.persona}\n${r.body}`).join('\n\n');
    console.log(JSON.stringify({title: group.title, fingerprint: group.fingerprint, labels, status: duplicate ? 'already filed' : 'ready', body}));
    if (args.includes('--file') && !duplicate) {
      console.log(gh(['issue', 'create', '--title', `[tester] ${group.title}`, '--body', body, ...labels.flatMap(label => ['--label', label])]).trim());
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error(error.message); process.exitCode = 1;});
