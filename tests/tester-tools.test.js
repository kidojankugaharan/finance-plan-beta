import {describe, it, expect} from 'vitest';
import {parseIssues, dedupeIssues} from '../scripts/file-issues.mjs';

const report = (title, key='debt-principal') => `# Issues\n\n## [idea] ${title}\nDedupe-key: ${key}\nSteps: Open Budget and add a loan payment.\nExpected: Track debt.\nActual: Payment only.\nScreenshot: testers/example/screenshots/debt.png\n`;
describe('persona issue filing', () => {
  it('combines cross-persona reports by type and explicit problem key, keeping evidence', () => {
    const groups = dedupeIssues([...parseIssues(report('Student debt'),'student'), ...parseIssues(report('Car loan'),'driver'), ...parseIssues(report('Another problem','different'),'third')]);
    expect(groups).toHaveLength(2);
    expect(groups[0].reports.map(r=>r.persona)).toEqual(['student','driver']);
    expect(groups[0].reports.every(r=>r.body.includes('Screenshot:'))).toBe(true);
  });
  it('normalizes titles without merging different types', () => {
    const a = report('Debt: principal!').replace(/^Dedupe-key:.*\n/m,'');
    const b = report('debt principal').replace(/^Dedupe-key:.*\n/m,'');
    expect(dedupeIssues([...parseIssues(a,'a'),...parseIssues(b,'b')])).toHaveLength(1);
    expect(dedupeIssues([...parseIssues(a,'a'),...parseIssues(b.replace('[idea]','[bug]'),'b')])).toHaveLength(2);
  });
  it('accepts an unrun/clean report and rejects malformed evidence', () => {
    expect(parseIssues('# Issues\nNo findings.','clean')).toEqual([]);
    expect(()=>parseIssues('## [other] Broken','bad')).toThrow('invalid issue heading');
    expect(()=>parseIssues(report('Missing screenshot').replace(/^Screenshot:.*$/m,''),'bad')).toThrow('missing Screenshot');
  });
});
