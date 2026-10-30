export const transientGitHubError = error => /internal server error|something went wrong|\b(?:HTTP(?:\/\S+)?\s*[:=]?\s*|status(?: code)?\s*[:=]?\s*|error:\s*|returned error:\s*)5\d\d\b|\b5\d\d\s+(?:server error|bad gateway|service unavailable|gateway timeout)/i.test([error.message, error.stderr, error.stdout].join('\n'));

// Three retries after the initial request; permanent failures surface immediately.
export async function retryGitHub(task, {wait = ms => new Promise(resolve => setTimeout(resolve, ms)), onRetry = () => {}} = {}) {
  for (let attempt = 0; ; attempt++) {
    try {return await task();}
    catch (error) {
      if (attempt === 3 || !transientGitHubError(error)) throw error;
      const delay = 1000 * 2 ** attempt;
      onRetry({attempt: attempt + 1, delay});
      await wait(delay);
    }
  }
}
