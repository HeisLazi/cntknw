/**
 * Architectural boundaries, checked.
 *
 * INV-014 says UI components do not directly write arbitrary
 * database records. A code review can enforce that for a while; a
 * test enforces it for the life of the project, including against
 * the agent who arrives in Phase 6 with no memory of why the rule
 * exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');

function filesUnder(directory: string, extensions = ['.ts', '.tsx']): string[] {
  const found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'legacy-v1') continue;
      found.push(...filesUnder(full, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      found.push(full);
    }
  }
  return found;
}

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const isTest = (path: string) => /\.test\.tsx?$/.test(path);

/** Every import specifier in a module. */
function importsOf(source: string): string[] {
  const code = withoutComments(source);
  const specifiers: string[] = [];
  for (const match of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    specifiers.push(match[1]!);
  }
  for (const match of code.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    specifiers.push(match[1]!);
  }
  return specifiers;
}

describe('architecture', () => {
  it('lets no UI module import a storage adapter', () => {
    // The UI depends on the `Repositories` interface. If a component
    // could name the Dexie adapter it could name a table, and
    // INV-014 would rest on nobody doing so.
    const uiRoots = [
      join(SRC, 'components'),
      join(SRC, 'app', 'routes'),
      join(SRC, 'app', 'providers'),
      join(SRC, 'app', 'hooks'),
      join(SRC, 'features'),
    ];

    const offenders: string[] = [];
    for (const root of uiRoots) {
      for (const file of filesUnder(root)) {
        if (isTest(file)) continue;
        for (const specifier of importsOf(readFileSync(file, 'utf-8'))) {
          if (
            /adapters\/(indexeddb|memory)/.test(specifier) ||
            /@data\/db\//.test(specifier) ||
            specifier === 'dexie'
          ) {
            offenders.push(`${relative(SRC, file)} -> ${specifier}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has exactly one composition module naming the production adapter', () => {
    const offenders: string[] = [];
    for (const file of filesUnder(SRC)) {
      if (isTest(file)) continue;
      const path = relative(SRC, file).replace(/\\/g, '/');
      // The adapter itself, the memory adapter, and the composition
      // root are the three places allowed to know it exists.
      if (
        path.startsWith('data/adapters/') ||
        path === 'app/composition/production.ts' ||
        path.startsWith('tests/')
      ) {
        continue;
      }
      for (const specifier of importsOf(readFileSync(file, 'utf-8'))) {
        if (/adapters\/indexeddb/.test(specifier)) {
          offenders.push(`${path} -> ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the domain free of React and of the data layer', () => {
    // Domain modules are schemas and pure functions. A domain that
    // imports React cannot be used from a worker or a migration, and
    // one that imports the data layer inverts the dependency.
    const offenders: string[] = [];
    for (const file of filesUnder(join(SRC, 'domain'))) {
      if (isTest(file)) continue;
      for (const specifier of importsOf(readFileSync(file, 'utf-8'))) {
        if (
          specifier === 'react' ||
          specifier.startsWith('react/') ||
          specifier.startsWith('@data') ||
          specifier.startsWith('@components')
        ) {
          offenders.push(`${relative(SRC, file)} -> ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the application layer free of React', () => {
    // Use cases are orchestration over repositories. Nothing there
    // should need a component, and a use case that imports one
    // cannot be tested without a renderer.
    const offenders: string[] = [];
    for (const file of filesUnder(join(SRC, 'application'))) {
      if (isTest(file)) continue;
      for (const specifier of importsOf(readFileSync(file, 'utf-8'))) {
        if (specifier === 'react' || specifier.startsWith('@components')) {
          offenders.push(`${relative(SRC, file)} -> ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('routes every component style through the token layer', () => {
    // A component with an inline hex colour is outside the token
    // system and outside the future light theme with it.
    const offenders: string[] = [];
    for (const file of filesUnder(join(SRC, 'components'), ['.tsx'])) {
      if (isTest(file)) continue;
      const code = withoutComments(readFileSync(file, 'utf-8'));
      const hex = code.match(/#[0-9a-f]{6}\b/gi) ?? [];
      if (hex.length > 0) {
        offenders.push(`${relative(SRC, file)}: ${hex.join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
