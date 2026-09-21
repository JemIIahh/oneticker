import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** UTC timestamp safe for file names, e.g. 20260921T135600Z. */
export function fixtureStamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Writes `<dir>/<module>/<name>-<stamp>.json` and returns its path. */
export async function saveFixture(dir: string, module: string, name: string, payload: unknown, date = new Date()): Promise<string> {
  const folder = join(dir, module);
  await mkdir(folder, { recursive: true });
  const path = join(folder, `${name}-${fixtureStamp(date)}.json`);
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}
