import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {retryGitHub} from './github-retry.mjs';

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
// Conservative signatures for defects observed across the live persona reports.
// Unknown findings group only by an explicit shared key or identical title.
export function defectKey(issue) {
  const actual = issue.body?.match(/^Actual:\s*(.+)$/m)?.[1] || '';
  const text = normalize(issue.title + ' ' + actual);
  if (/\bclos(?:ed|ing|e)\b/.test(text) && /\b(?:month|january)\b/.test(text) && /\b(?:annual|year|projection)\b/.test(text) && /\btotals?\b/.test(text) && /\b(?:omit\w*|exclud\w*|remov\w*|eleven|11)\b/.test(text)) return 'defect:closed-month-annual-totals';
  if (/\bgoal\b/.test(text) && /\bnet worth\b/.test(text) && /\b(?:met|achieved|funded)\b/.test(text)) return 'defect:goal-net-worth-status';
  if (/\bassumptions?\b/.test(text) && /\b(?:choice|select|control)\b/.test(text) &&
    ((/\b(?:label|labelled)\b/.test(text) && /\b(?:missing|no|cannot|could not|not associated)\b/.test(text)) || /cannot be selected.*visible prompt/.test(text))) return 'defect:assumption-accessible-label';
  const key = issue.body?.match(/^Dedupe-key:\s*(.+)$/m)?.[1];
  return (key ? 'key:' + normalize(key) : 'title:' + normalize(issue.title));
}
export function groupOpenIssues(issues) {
  const groups = new Map();
  for (const issue of [...issues].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.number - b.number)) {
    const key = defectKey(issue);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(issue);
  }
  return [...groups.values()];
}
const gh = args => retryGitHub(() => execFileSync('gh', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
async function main() {
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf('--only');
  const only = onlyIndex < 0 ? null : args.splice(onlyIndex, 2)[1];
  const personasIndex = args.indexOf('--personas');
  const selected = personasIndex < 0 ? null : args.splice(personasIndex, 2)[1]?.split(',');
  if (personasIndex >= 0 && (!selected?.length || selected.some(id => !/^[a-z0-9_-]+$/.test(id)))) throw new Error('Invalid --personas list');
  if ((onlyIndex >= 0 && !only) || args.some(arg => !['--file', '--dry-run', '--summary-json'].includes(arg)) || args.includes('--file') && args.includes('--dry-run')) throw new Error('Usage: node scripts/file-issues.mjs [--dry-run | --file] [--only <persona>] [--summary-json]');
  const personas = JSON.parse(await fs.readFile(path.join(root, 'testers/personas.json'), 'utf8'));
  if (only && !personas.some(p => p.id === only)) throw new Error('Unknown persona: ' + only);
  if (selected?.some(id => !personas.some(p => p.id === id))) throw new Error('Unknown selected persona');
  const reports = [];
  for (const persona of personas) {
    if (only && persona.id !== only) continue;
    if (selected && !selected.includes(persona.id)) continue;
    try {reports.push(...parseIssues(await fs.readFile(path.join(root, 'testers', persona.id, 'issues.md'), 'utf8'), persona.id));}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  const groups = dedupeIssues(reports);
  console.log(`${args.includes('--file') ? 'FILE' : 'DRY RUN'}: ${reports.length} reports -> ${groups.length} unique issues`);
  // Dry-run is entirely local: no GitHub login or network needed.
  let existing = [];
  if (args.includes('--file')) {
    existing = JSON.parse(await gh(['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/issues?state=all&labels=tester&per_page=100'])).flat();
    const labels = JSON.parse(await gh(['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/labels?per_page=100'])).flat().map(label => label.name);
    for (const label of new Set(['tester', ...groups.map(g => g.type), ...reports.map(r => `persona:${r.persona}`)])) {
      if (!labels.includes(label)) await gh(['label', 'create', label, '--color', '7057ff', '--description', 'Persona testing']);
    }
  }
  const filed = [];
  for (const group of groups) {
    const marker = `<!-- persona-tester:${group.fingerprint} -->`;
    const duplicate = existing.find(issue => issue.body?.includes(marker));
    const labels = ['tester', group.type, ...new Set(group.reports.map(r => `persona:${r.persona}`))];
    const body = `${marker}\n\n` + group.reports.map(r => `### Persona: ${r.persona}\n${r.body}`).join('\n\n');
    console.log(JSON.stringify({title: group.title, fingerprint: group.fingerprint, labels, status: duplicate ? 'already filed' : 'ready', body}));
    if (args.includes('--file') && !duplicate) {
      const directory = path.join(root, '.cache', 'issue-bodies');
      await fs.mkdir(directory, {recursive: true});
      const bodyFile = path.join(directory, group.fingerprint + '.md');
      await fs.writeFile(bodyFile, body);
      const url = (await gh(['issue', 'create', '--title', `[tester] ${group.title}`, '--body-file', bodyFile, ...labels.flatMap(label => ['--label', label])])).trim();
      filed.push(url);
      console.log(url);
    }
  }
  if (args.includes('--summary-json')) console.log('LOOP_SUMMARY ' + JSON.stringify({filed}));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error(error.message); process.exitCode = 1;});
