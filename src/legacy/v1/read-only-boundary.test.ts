/**
 * The v1 read-only boundary, checked rather than asserted.
 *
 * The Phase 0C checkpoint originally described `readers.ts` as
 * "structurally write-incapable". That was an overclaim: the module
 * holds a live `Dexie` handle inside `readV1Snapshot`, and a Dexie
 * handle can write. What is actually true — and is what these tests
 * establish — is narrower and checkable:
 *
 *   v1 access is read-only by module boundary and public API; no
 *   schema upgrade is declared, and no raw database or table handle
 *   escapes the reader module.
 *
 * Three separate things have to hold, and each is checked on its own
 * terms rather than inferred from the other two:
 *
 *   1. No `.version()` is declared for v1, so no upgrade transaction
 *      can fire and irreversibly break the v1 app (ADR-0002 §1).
 *   2. Nothing the module exports can write, and no handle escapes
 *      through a return value.
 *   3. No module outside `legacy/v1` opens the v1 database at all.
 *
 * These read the source text. That is deliberate: the properties
 * being checked are about what the code *may* do, and a runtime test
 * can only observe what it *did* do on one path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as readers from './readers';

const SRC = join(process.cwd(), 'src');
const READERS = join(SRC, 'legacy', 'v1', 'readers.ts');

function readersSource(): string {
  return readFileSync(READERS, 'utf-8');
}

/** Every .ts/.tsx file under src/, excluding the frozen v1 prototype. */
function allSourceFiles(directory: string = SRC): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      // The frozen v1 prototype is input, never part of v2.
      if (entry === 'legacy-v1') continue;
      found.push(...allSourceFiles(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
}

/** Strip block and line comments, so prose about writing is not a hit. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('v1 read-only boundary', () => {
  it('declares no schema version for v1', () => {
    // Dexie's dynamic mode — no `.version()` call — attaches to the
    // existing schema. Declaring one at a higher number would upgrade
    // `philosophy-journal` irreversibly, after which the v1 app,
    // which opens at version 1, throws VersionError forever.
    expect(withoutComments(readersSource())).not.toMatch(/\.version\s*\(/);
  });

  it('never calls a Dexie write, delete or upgrade method', () => {
    const code = withoutComments(readersSource());
    const forbidden = [
      /\.put\s*\(/,
      /\.add\s*\(/,
      /\.bulkPut\s*\(/,
      /\.bulkAdd\s*\(/,
      /\.update\s*\(/,
      /\.modify\s*\(/,
      /\.delete\s*\(/,
      /\.clear\s*\(/,
      /Dexie\.delete\s*\(/,
      /deleteDatabase\s*\(/,
      /'rw'/,
      /"rw"/,
      /readwrite/,
    ];
    for (const pattern of forbidden) {
      expect(code, `readers.ts must not contain ${pattern}`).not.toMatch(pattern);
    }
  });

  it('exports only reads, and no handle escapes through them', async () => {
    // A returned Dexie or Table would make the boundary decorative:
    // a caller could write through it without importing Dexie at all.
    expect(Object.keys(readers).sort()).toEqual([
      'emptyV1Snapshot',
      'readV1Snapshot',
      'v1DatabaseExists',
    ]);

    const snapshot = readers.emptyV1Snapshot();
    for (const [key, value] of Object.entries(snapshot)) {
      const plain =
        Array.isArray(value) ||
        value === null ||
        ['string', 'number', 'boolean', 'undefined'].includes(typeof value);
      expect(plain, `${key} must be plain data, not a handle`).toBe(true);
    }

    // `openV1` does return a live Dexie handle — that is what
    // opening a database means — but it is module-private, and the
    // one caller closes it in a `finally`. The boundary is that the
    // handle never crosses the module edge, not that it never exists.
    const code = withoutComments(readersSource());
    expect(code).toMatch(/^async function openV1\(/m);
    expect(code).not.toMatch(/export\s+(async\s+)?function\s+openV1/);
    expect(code).toMatch(/finally\s*\{\s*db\.close\(\);?\s*\}/);

    // No exported signature hands back a Dexie or a Table.
    const exportedSignatures = code.match(/export\s+(async\s+)?function[\s\S]*?\{/g) ?? [];
    expect(exportedSignatures.length).toBeGreaterThan(0);
    for (const signature of exportedSignatures) {
      expect(signature).not.toMatch(/Promise<\s*Dexie\s*>|:\s*Dexie\b|Table</);
    }
  });

  it('is the only module outside legacy/v1 that can reach v1', () => {
    // `V1_DATABASE_NAME` is declared in schemaVersions.ts, which is
    // where the constant belongs; what matters is that nothing else
    // opens a database with it.
    const offenders: string[] = [];
    for (const file of allSourceFiles()) {
      const path = relative(SRC, file);
      const inLegacyV1 = path.split(sep).slice(0, 2).join('/') === 'legacy/v1';
      if (inLegacyV1) continue;
      // schemaVersions.ts declares the name and documents it.
      if (path === join('data', 'db', 'schemaVersions.ts')) continue;

      const code = withoutComments(readFileSync(file, 'utf-8'));
      if (/V1_DATABASE_NAME|['"`]philosophy-journal['"`]/.test(code)) {
        offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no applyMigration anywhere in the tree', () => {
    // ADR-0002 §7: the absence of an apply path is the guarantee. If
    // one is ever added it must arrive with its own tests and an ADR,
    // not quietly.
    const offenders = allSourceFiles()
      // This file names it in order to forbid it.
      .filter((file) => file !== __filename)
      .filter((file) =>
        /\bapplyMigration\b/.test(withoutComments(readFileSync(file, 'utf-8'))),
      );
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });
});
