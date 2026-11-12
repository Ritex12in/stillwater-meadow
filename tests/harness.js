// The specs import `test` and `expect` from here. Under `npm test` this is Playwright Test.
// Under `npm run test:quick` (MEADOW_RUNNER=1) a small in-process runner collects the tests
// instead; it needs no worker processes, so it also works in restricted sandboxes.
import { expect } from '@playwright/test';

export const collected = [];
const shim = (name, fn) => collected.push({ name, fn });
export const test = process.env.MEADOW_RUNNER ? shim : (await import('@playwright/test')).test;
export { expect };
