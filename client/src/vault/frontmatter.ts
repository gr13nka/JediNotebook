import { stringify, parse } from 'yaml';

export interface ParsedFrontmatter {
  meta: Record<string, unknown>;
  body: string;
}

const FM_DELIMITER = '---';

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith(FM_DELIMITER)) {
    return { meta: {}, body: trimmed };
  }

  const endIdx = trimmed.indexOf(`\n${FM_DELIMITER}`, FM_DELIMITER.length);
  if (endIdx === -1) {
    return { meta: {}, body: trimmed };
  }

  const yamlStr = trimmed.slice(FM_DELIMITER.length + 1, endIdx);
  const body = trimmed.slice(endIdx + FM_DELIMITER.length + 2).replace(/^\n/, '');

  try {
    const meta = parse(yamlStr) as Record<string, unknown>;
    return { meta: meta ?? {}, body };
  } catch {
    return { meta: {}, body: trimmed };
  }
}

export function stringifyFrontmatter(meta: Record<string, unknown>, body: string = ''): string {
  const yamlStr = stringify(meta, {
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
    nullStr: 'null',
  }).trimEnd();

  const parts = [FM_DELIMITER, yamlStr, FM_DELIMITER];
  if (body) {
    parts.push('', body);
  }
  return parts.join('\n') + '\n';
}
