import { parentPort, workerData } from 'node:worker_threads';
import { runProcedure } from './procedures.mjs';

const controller = new AbortController();
parentPort.on('message', message => { if (message.cancel === true) controller.abort(); });

try {
  const result = await runProcedure(workerData.repository, workerData.action, workerData.input, workerData.forbiddenRoots, controller.signal);
  parentPort.postMessage({ result });
} catch (error) {
  parentPort.postMessage({ error: error.message });
} finally { parentPort.close(); }
