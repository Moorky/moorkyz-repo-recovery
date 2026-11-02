import { parentPort, workerData } from 'node:worker_threads';
import { executeTask } from './engine.mjs';
import { fix } from './fixes.mjs';

try {
  const result = workerData.action.startsWith('fix-') ?
    fix(workerData.repository, workerData.action, workerData.input) :
    executeTask(workerData.repository, workerData.action, workerData.input, workerData.forbiddenRoots);
  parentPort.postMessage({ result });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
