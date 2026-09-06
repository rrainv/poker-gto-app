import { calculateEquity, estimateEquityCombinations } from '../../../shared/poker-domain/equity.js';
import { calculateWeightedEquity, estimateWeightedEquity } from '../../../shared/poker-domain/weighted-equity.js';
import { exploreRunouts, rangeStandingFacts } from './runout-explorer.mjs';
import { deepFreeze } from '../../../shared/poker-domain/freeze.js';
export function calculateEquityRequest(request, options) {
  if (request?.schemaVersion === 'runout-request/v1') return exploreRunouts(request.request, { ...request.options, ...options });
  if (request?.schemaVersion === 'weighted-equity-request/v1') {
    return calculateWeightedEquity(request, options).then(result => deepFreeze({ ...result,
      presentation: { schemaVersion: 'weighted-equity-presentation/v1',
        currentStanding: result.recipe && result.players.length ? rangeStandingFacts(result.recipe) : null } }));
  }
  return calculateEquity(request, options);
}
export function estimateEquityRequest(request) {
  if (request?.schemaVersion === 'runout-request/v1') return { ok: false };
  return request?.schemaVersion === 'weighted-equity-request/v1'
    ? estimateWeightedEquity(request) : estimateEquityCombinations(request);
}
