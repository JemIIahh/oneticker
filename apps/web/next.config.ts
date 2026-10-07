import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @oneticker/core and @oneticker/clients ship TypeScript source, not a dist.
  transpilePackages: ['@oneticker/core', '@oneticker/clients'],
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  // The shell reads fixtures at request time (T6); the tracer cannot see dynamic fs paths.
  outputFileTracingIncludes: { '/s/[ticker]': ['../../fixtures/**/*.json'] },
  // The repo's own CLAUDE.md is the source of truth; do not generate another one here.
  agentRules: false,
};

export default nextConfig;
