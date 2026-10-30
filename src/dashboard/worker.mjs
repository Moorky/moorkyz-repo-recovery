import { parentPort, workerData } from 'node:worker_threads';
import { executeTask } from './engine.mjs';

try {
  parentPort.postMessage({ result: executeTask(workerData.repository, workerData.action, workerData.input, workerData.forbiddenRoots) });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
