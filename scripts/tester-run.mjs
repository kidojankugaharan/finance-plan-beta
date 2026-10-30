import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {chromium, devices} from '@playwright/test';
import {createPreviewServer} from './serve-dist.mjs';
import {openTesterPage,checkpointTesterPage} from './tester-profile.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const inside = (base, relative) => {
  const target = path.resolve(base, relative);
  if (!target.startsWith(path.resolve(base) + path.sep)) throw new Error('Path must stay inside ' + base);
  return target;
};
async function build() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--configLoader', 'native'], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
    child.stdout.on('data', chunk => process.stderr.write(chunk));
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('Build failed: ' + code)));
  });
}

export async function startTester(personaId, {acceptance = false, profileName = 'agent', skipBuild = false} = {}) {
  // Resolve all artifacts from this repository, regardless of the caller's cwd.
  if (path.resolve(process.cwd()) !== path.resolve(root)) throw new Error('Run from the project root.');
  const personas = JSON.parse(await fs.readFile(new URL('../testers/personas.json', import.meta.url), 'utf8'));
  const persona = personas.find(p => p.id === personaId);
  if (!persona) throw new Error('Unknown persona. Choose: ' + personas.map(p => p.id).join(', '));
  if (!/^[a-z0-9_-]+$/i.test(profileName)) throw new Error('Use a simple profile name.');
  if (!skipBuild) await build();
  const directory = inside(path.join(root, 'testers'), personaId);
  await fs.mkdir(path.join(directory, 'screenshots'), {recursive: true});
  // Playwright creates launch artifacts in the parent process's temp directory.
  // The tester sandbox cannot write the Windows user temp directory.
  const temp = path.join(directory, 'temp');
  await fs.mkdir(temp, {recursive: true});
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = temp;
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(directory, 'run-log.jsonl');
  const log = record => fs.appendFile(logFile, JSON.stringify({at: new Date().toISOString(), runId, ...record}) + '\n');
  const server = createPreviewServer();
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  // Stable origin keeps localStorage attached to the persistent browser profile,
  // while an ephemeral server port allows independent persona sessions.
  const origin = 'http://127.0.0.1:4173';
  const url = origin + '/finance-plan-beta/';
  let context;
  const errors = [], pendingLogs = new Set();
  const eventLog = record => {
    const pending = log(record); pendingLogs.add(pending);
    pending.then(() => pendingLogs.delete(pending), () => {});
  };
  try {
    const profile = path.join(directory, 'profile', acceptance ? `acceptance-${runId}` : profileName);
    context = await chromium.launchPersistentContext(profile, {
      ...devices['iPhone 13'], headless: true, acceptDownloads: true, serviceWorkers: 'block',
      downloadsPath: path.join(directory, 'downloads'),
    });
    await context.route(origin + '/**', async route => {
      const target = route.request().url().replace(origin, `http://127.0.0.1:${server.address().port}`);
      const response = await route.fetch({url: target});
      await route.fulfill({response});
    });
    const page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => {const entry = {kind: 'pageerror', message: error.message}; errors.push(entry); eventLog(entry);});
    page.on('console', message => {if (message.type() === 'error') {const entry = {kind: 'console-error', message: message.text()}; errors.push(entry); eventLog(entry);}});
    await log({kind: 'start', persona: personaId, profile: path.relative(directory, profile), viewport: devices['iPhone 13'].viewport, serviceWorkers: 'blocked; offline behavior belongs to e2e suite'});
    await openTesterPage(context, url, profile);
    function locator(command) {
      if (command.label) return page.getByLabel(command.label, {exact: true});
      if (command.role) return page.getByRole(command.role, {name: command.text, exact: true});
      if (command.text) return page.getByText(command.text, {exact: true});
      if (command.selector) return page.locator(command.selector);
      throw new Error('Provide label, role/text, text, or selector.');
    }
    async function command(input) {
      try {
        let result = 'ok';
        switch (input.op) {
          case 'goto': {
            const target = new URL(input.path || './', url);
            if (target.origin !== origin || !target.pathname.startsWith('/finance-plan-beta/')) throw new Error('Only local app navigation is allowed.');
            await page.goto(target.href); break;
          }
          case 'click': await locator(input).click(); break;
          case 'fill': await locator(input).fill(String(input.value)); break;
          case 'select': await locator(input).selectOption(String(input.value)); break;
          case 'text': result = await (input.selector ? locator(input) : page.locator('body')).innerText(); break;
          case 'errors': result = [...errors]; break;
          case 'screenshot': {
            const name = input.name || 'page';
            if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error('Use a simple screenshot name.');
            result = path.join('screenshots', `${runId}-${name}.png`);
            await page.screenshot({path: path.join(directory, result), fullPage: true}); break;
          }
          case 'export': {
            const event = page.waitForEvent('download');
            await page.getByRole('button', {name: 'Export JSON backup', exact: true}).click();
            result = `${runId}-backup.json`;
            await (await event).saveAs(path.join(directory, result)); break;
          }
          case 'import': {
            const file = inside(directory, input.file);
            if (path.extname(file) !== '.json') throw new Error('Choose a JSON backup.');
            const event = page.waitForEvent('filechooser');
            await page.getByRole('button', {name: 'Import JSON backup', exact: true}).click();
            await (await event).setFiles(file);
            await page.getByRole('dialog').waitFor({state: 'visible'});
            result = 'Preview opened; inspect it, then click Import this plan.'; break;
          }
          case 'note': result = String(input.text); break;
          default: throw new Error('Unknown command: ' + input.op);
        }
        await log({kind: 'command', command: input, result});
        return result;
      } catch (error) {
        await log({kind: 'command-failed', command: input, error: error.message});
        throw error;
      }
    }
    return {persona, directory, profileName: path.basename(profile), page, command, close: async () => {
      try { await checkpointTesterPage(page, profile); }
      finally {
        await context.close(); await Promise.all([...pendingLogs]);
        await new Promise(resolve => server.close(resolve));
      }
      await log({kind: 'end', consoleErrors: errors.length});
    }};
  } catch (error) {
    await context?.close(); await new Promise(resolve => server.close(resolve)); throw error;
  }
}

async function main() {
  const [id, ...rawArgs] = process.argv.slice(2);
  const commandsIndex = rawArgs.indexOf('--commands');
  const commandsFile = commandsIndex < 0 ? null : rawArgs.splice(commandsIndex, 2)[1];
  if (commandsIndex >= 0 && !commandsFile) throw new Error('--commands requires a persona-local JSON array file');
  const skipBuild = rawArgs.includes('--skip-build');
  const args = rawArgs.filter(arg => arg !== '--skip-build');
  if (!id || (args.length && (args.length !== 2 || args[0] !== '--profile'))) throw new Error('Usage: node scripts/tester-run.mjs <persona-id> [--profile <name>] [--skip-build] [--commands <persona-local JSON array file>] (otherwise JSONL on stdin; EOF closes)');
  let commands;
  if (commandsFile) {
    if (!/^[a-z0-9_-]+$/.test(id || '')) throw new Error('Invalid persona');
    const directory = path.join(root, 'testers', id);
    commands = JSON.parse(await fs.readFile(inside(directory, path.relative(directory, path.resolve(root, commandsFile))), 'utf8'));
    if (!Array.isArray(commands)) throw new Error('Commands file must contain a JSON array');
  }
  // Attach stdin before browser startup so piped commands cannot be lost during launch.
  const lines = commands ? null : readline.createInterface({input: process.stdin, crlfDelay: Infinity});
  const inputs = commands ? commands.map(command => JSON.stringify(command)) : lines[Symbol.asyncIterator]();
  const session = await startTester(id, {profileName: args[1] || 'agent', skipBuild}).catch(error => {lines?.close(); throw error;});
  console.log(JSON.stringify({ready: id, profile: session.profileName, commands: ['goto','click','fill','select','text','screenshot','errors','export','import','note','quit']}));
  try {
    for await (const line of inputs) {
      if (!line.trim()) continue;
      try {
        const input = JSON.parse(line);
        if (input.op === 'quit') break;
        console.log(JSON.stringify({ok: true, result: await session.command(input)}));
      } catch (error) {console.log(JSON.stringify({ok: false, error: error.message})); process.exitCode = 1;}
    }
  } finally {lines?.close(); await session.close();}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error(error.message); process.exitCode = 1;});
