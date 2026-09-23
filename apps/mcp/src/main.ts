// Entry point.
//
//   main.ts stdio   for Claude Code / Claude desktop (stdout is the protocol: log to stderr only).
//                   The only mode with execute_route: it runs on the user's own machine and wallet.
//   main.ts http    Streamable HTTP on $PORT (default 3333) at /mcp. Read tools only, never execute_route.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execDeps, liveDeps } from './deps';
import { startHttp } from './http';
import { createServer } from './server';

// The repo-root .env, found from this file rather than the cwd: MCP clients launch us from anywhere.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const mode = process.argv[2] ?? 'stdio';
const deps = liveDeps();

if (mode === 'stdio') {
  await createServer(deps, execDeps(deps.routes)).connect(new StdioServerTransport());
} else if (mode === 'http') {
  startHttp(deps, Number(process.env.PORT ?? 3333));
} else {
  console.error('Usage: main.ts [stdio|http]');
  process.exit(1);
}
