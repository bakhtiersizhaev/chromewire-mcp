import { redactForLogs } from '../src/redact.js';
import { getInfo, health, ping } from '../src/codexChromePipe.js';
const result = { health: await health(), ping: await ping(), info: await getInfo() };
console.log(JSON.stringify(redactForLogs(result), null, 2));
