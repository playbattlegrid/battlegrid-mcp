import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The npm tarball is the skill package: `npx skills add` and tarball consumers read the skills
 * from the published files, so a skill missing from `files`, a frontmatter without its required
 * fields, or a name that no longer matches its directory ships a broken install. These checks
 * run against the repo exactly as `npm pack` would read it.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  version: string;
  files: string[];
};

/** Minimal frontmatter read: the `---` fence plus `name:` / `description:` scalars. */
function readFrontmatter(path: string): { name: string | null; description: string | null } {
  const lines = readFileSync(path, 'utf8').split('\n');
  expect(lines[0]?.trim(), `${path} must open with a frontmatter fence`).toBe('---');
  const closing = lines.indexOf('---', 1);
  expect(closing, `${path} must close its frontmatter fence`).toBeGreaterThan(0);
  const block = lines.slice(1, closing);
  const scalar = (key: string): string | null => {
    const line = block.find((entry) => entry.startsWith(`${key}:`));
    if (line === undefined) return null;
    const value = line.slice(key.length + 1).trim();
    return value.length > 0 ? value : null;
  };
  return { name: scalar('name'), description: scalar('description') };
}

describe('skill package', () => {
  it('ships both skill surfaces in the npm tarball file list', () => {
    expect(packageJson.files).toContain('SKILL.md');
    expect(packageJson.files).toContain('skills');
  });

  it('root SKILL.md carries valid frontmatter naming the battlegrid skill', () => {
    const frontmatter = readFrontmatter(join(repoRoot, 'SKILL.md'));
    expect(frontmatter.name).toBe('battlegrid');
    expect(frontmatter.description).not.toBeNull();
  });

  it('every skills/<dir> has a SKILL.md whose name matches its directory', () => {
    const skillsDir = join(repoRoot, 'skills');
    const directories = readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(directories.length).toBeGreaterThan(0);

    for (const directory of directories) {
      const skillFile = join(skillsDir, directory, 'SKILL.md');
      expect(existsSync(skillFile), `${directory} must carry a SKILL.md`).toBe(true);
      const frontmatter = readFrontmatter(skillFile);
      expect(frontmatter.name, `${skillFile} name must match its directory`).toBe(directory);
      expect(frontmatter.description, `${skillFile} must describe itself`).not.toBeNull();
    }
  });

  it('the strategy-studio skill ships the references its SKILL.md points at', () => {
    const studioDir = join(repoRoot, 'skills', 'battlegrid-strategy-studio');
    const body = readFileSync(join(studioDir, 'SKILL.md'), 'utf8');
    const referenced = [...body.matchAll(/references\/[a-z0-9-]+\.md/g)].map((match) => match[0]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const reference of new Set(referenced)) {
      expect(existsSync(join(studioDir, reference)), `${reference} is named but not shipped`).toBe(true);
    }
  });

  it('all four release version values agree (the publish gate fails closed on a mismatch)', () => {
    const lock = JSON.parse(readFileSync(join(repoRoot, 'package-lock.json'), 'utf8')) as {
      version: string;
      packages: Record<string, { version?: string }>;
    };
    const source = readFileSync(join(repoRoot, 'src', 'index.ts'), 'utf8');
    const declared = source.match(/PACKAGE_VERSION = '([^']+)'/)?.[1];

    expect(lock.version).toBe(packageJson.version);
    expect(lock.packages['']?.version).toBe(packageJson.version);
    expect(declared).toBe(packageJson.version);
  });
});
