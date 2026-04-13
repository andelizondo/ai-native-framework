/**
 * tests/msw/server.ts
 *
 * MSW Node server used in unit and component tests.
 * Lifecycle is managed in tests/setup.tsx (beforeAll / afterEach / afterAll).
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
