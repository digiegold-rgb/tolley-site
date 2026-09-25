import { checkDiscoveryHealth } from "../lib/discovery-health";
const base = process.env.DISCOVERY_BASE_URL || "https://www.tolley.io";
checkDiscoveryHealth(base).then(results => {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base, results }, null, 2));
  if (results.some(r => !r.ok)) process.exitCode = 1;
});
