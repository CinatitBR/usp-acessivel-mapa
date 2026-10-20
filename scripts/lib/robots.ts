/**
 * Whether robots.txt lets a crawler with this user agent fetch a path. Only what `knowledge:fetch` needs:
 * the group for the agent (or `*`), `Allow` and `Disallow` prefixes, the longest match winning, `*` and `$`.
 */
export function robotsAllows(robotsTxt: string, agent: string, path: string): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; pattern: string }[] };
  const groups: Group[] = [];
  let current: Group | undefined;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [key, value] = [match[1]!.toLowerCase(), match[2]!.trim()];
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && current) {
      lastWasAgent = false;
      if (value) current.rules.push({ allow: key === 'allow', pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  const name = agent.toLowerCase();
  const group = groups.find((candidate) => candidate.agents.some((value) => value !== '*' && name.includes(value))) ?? groups.find((candidate) => candidate.agents.includes('*'));
  if (!group) return true;

  const matches = (pattern: string) => {
    const anchored = pattern.endsWith('$');
    const source = (anchored ? pattern.slice(0, -1) : pattern).split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path);
  };
  let best: { allow: boolean; length: number } | undefined;
  for (const rule of group.rules) {
    if (!matches(rule.pattern)) continue;
    if (!best || rule.pattern.length > best.length || (rule.pattern.length === best.length && rule.allow)) best = { allow: rule.allow, length: rule.pattern.length };
  }
  return best?.allow ?? true;
}
