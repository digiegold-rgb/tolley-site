/** Evaluate the Allow/Disallow directives emitted by our robots route. */
export function crawlAllowed(text: string, path: string, userAgent: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; pattern: string }[] }[] = [];
  let group = { agents: [] as string[], rules: [] as { allow: boolean; pattern: string }[] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).toLowerCase(), value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && group.agents.length && value) {
      group.rules.push({ allow: key === 'allow', pattern: value });
    }
  }
  groups.push(group);
  const named = groups.filter(g => g.agents.includes(userAgent.toLowerCase()));
  const rules = (named.length ? named : groups.filter(g => g.agents.includes('*'))).flatMap(g => g.rules);
  let best = -1, allowed = true;
  for (const rule of rules) {
    const exact = rule.pattern.endsWith('$');
    const body = exact ? rule.pattern.slice(0, -1) : rule.pattern;
    const regex = body.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    if (!new RegExp('^' + regex + (exact ? '$' : '')).test(path)) continue;
    const length = body.replace(/\*/g, '').length;
    if (length > best || (length === best && rule.allow)) { best = length; allowed = rule.allow; }
  }
  return allowed;
}
