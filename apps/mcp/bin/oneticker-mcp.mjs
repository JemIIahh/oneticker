#!/usr/bin/env node
// Launcher for MCP clients: registers tsx from this package (not the caller's cwd), then runs the TypeScript entry.
//   claude mcp add oneticker -- node /path/to/oneticker/apps/mcp/bin/oneticker-mcp.mjs
import { register } from 'tsx/esm/api';

register();
await import('../src/main.ts');
