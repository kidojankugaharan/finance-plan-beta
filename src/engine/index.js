import { registerModel } from './model.js';
import { registerTax } from './tax.js';
import { registerPensions } from './pensions.js';
import { registerBudget } from './budget.js';
import { registerInvestments } from './investments.js';
import { registerDrawdown } from './drawdown.js';
import { registerProjection } from './projection.js';

/** Each calculation owns its state and caches; no DOM, storage, or global singleton. */
export function createEngine(input = {}) {
  const api = {};
  registerModel(api);
  Object.assign(api.state, structuredClone(input));
  registerTax(api);
  registerPensions(api);
  registerBudget(api);
  registerInvestments(api);
  registerDrawdown(api);
  registerProjection(api);
  api.ensureYearsRange();
  api.ensureGoalsState();
  api.syncInvestmentPlanToFebruary();
  api.invalidateDrawdownCache();
  return api;
}

export function project(input) {
  const engine = createEngine(input);
  return { state: engine.state, annual: engine.computeAnnualAggregates(),
    monthly: engine.computeMonthlySeries(), salary: engine.computeSalaryChain(),
    windows: engine.resolveDrawdown().windows, goals: engine.computeGoalResults() };
}
