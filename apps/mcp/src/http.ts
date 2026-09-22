// Streamable HTTP transport, stateless: a fresh server per request, shared tool deps (so route ids survive
// between calls). POST /mcp for MCP, GET /health for uptime checks.

import { createServer as createHttpServer, type Server } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server';
import type { ToolDeps } from './tools';

const MAX_BODY = 1_000_000;

function sendJson(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function startHttp(deps: ToolDeps, port: number): Server {
  const http = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://mcp');
    if (url.pathname === '/health') return sendJson(res, 200, { ok: true });
    if (url.pathname !== '/mcp') return sendJson(res, 404, { error: 'not found; MCP lives at /mcp' });
    if (req.method !== 'POST') {
      return sendJson(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this server is stateless, POST only' }, id: null });
    }

    let body: unknown;
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BODY) return sendJson(res, 413, { error: 'body too large' });
        chunks.push(chunk as Buffer);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
    }

    const server = createServer(deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      console.error('MCP_HTTP_ERROR', error);
      if (!res.headersSent) sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
  });
  http.listen(port, () => console.error(`MCP_HTTP ${JSON.stringify({ port, path: '/mcp' })}`));
  return http;
}
