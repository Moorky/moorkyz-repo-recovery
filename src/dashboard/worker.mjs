import { parentPort, workerData } from 'node:worker_threads';
import { runProcedure } from './procedures.mjs';
import { inspect } from './engine.mjs';

const controller = new AbortController();
parentPort.on('message', message => { if (message.cancel === true) controller.abort(); });

async function scan(repositories) {
  for (const [index, repository] of repositories.entries()) {
    // Yield so a queued cancel message is handled before the next (synchronous) inspection starts.
    await new Promise(resolve => setImmediate(resolve));
    if (controller.signal.aborted) return parentPort.postMessage({ type: 'done', cancelled: true });
    parentPort.postMessage({ type: 'progress', index, id: repository.id });
    try {
      parentPort.postMessage({ type: 'result', id: repository.id, inspection: inspect(repository.path) });
    } catch (error) {
      parentPort.postMessage({ type: 'result', id: repository.id, error: error.message });
    }
  }
  parentPort.postMessage({ type: 'done', cancelled: false });
}

try {
  if (workerData.action === 'scan') await scan(workerData.repositories);
  else {
    const result = await runProcedure(workerData.repository, workerData.action, workerData.input, workerData.forbiddenRoots, controller.signal);
    parentPort.postMessage({ result });
  }
} catch (error) {
  parentPort.postMessage({ error: error.message });
} finally { parentPort.close(); }
