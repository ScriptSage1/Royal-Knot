// Data source boundary. Every page loads data through these functions, so a
// later module can swap the mock imports for real API calls (e.g. fetch to an
// Express + SQL backend) without touching components.
//
// Each function returns a deep copy so screens can mutate their in-memory
// state freely for preview interactions. Nothing is persisted.

import { CASES, PLANNERS, AS_OF, weddingDetail } from './agency-mock.js';
import { COUPLE } from './couple-mock.js';

const copy = (v) => structuredClone(v);

// INTEGRATION: GET /api/agent/weddings
export async function listWeddings() {
  return copy(CASES);
}

// INTEGRATION: GET /api/agent/planners
export async function listPlanners() {
  return copy(PLANNERS);
}

// The mock's reference date. Real data would use the server clock.
export const asOf = () => AS_OF;

// INTEGRATION: GET /api/agent/weddings/:workspaceId
export async function loadWedding(mockKey) {
  const w = weddingDetail(mockKey);
  return w ? copy(w) : null;
}

// INTEGRATION: GET /api/couple/workspace (couple-safe projection only)
export async function loadCoupleWorkspace() {
  return copy(COUPLE);
}
