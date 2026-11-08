// Tracks whether the current worker job has started writing to a working copy. Each job runs in a
// fresh worker thread, so this module state belongs to exactly one job.
let started = false;
export function beginWrite() { started = true; }
export function writeStarted() { return started; }

// Actions that may change a verified working copy. If they fail or are interrupted after writing,
// downstream evidence must be invalidated; approval/precondition failures leave it intact.
export const workingCopyWriters = ['restore-apply', 'rescue-apply', 'remote-fetch', 'fix-apply', 'quality'];
