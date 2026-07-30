function removeComment(line) {
  const index = line.indexOf("#");
  return (index === -1 ? line : line.slice(0, index)).trim();
}

function ruleToRegExp(value) {
  const anchored = value.endsWith("$");
  const raw = anchored ? value.slice(0, -1) : value;
  const escaped = raw
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

function parseRobots(content, userAgent, baseUrl) {
  const groups = [];
  const sitemaps = [];
  let currentGroup = null;
  let seenRule = false;

  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = removeComment(rawLine);

    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const directive = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (directive === "sitemap") {
      try {
        sitemaps.push(new URL(value, baseUrl).href);
      } catch {
        // Ignore malformed sitemap declarations.
      }
      continue;
    }

    if (directive === "user-agent") {
      if (!currentGroup || seenRule) {
        currentGroup = { agents: [], rules: [], crawlDelay: null };
        groups.push(currentGroup);
        seenRule = false;
      }

      currentGroup.agents.push(value.toLowerCase());
      continue;
    }

    if (!currentGroup) {
      continue;
    }

    if (directive === "allow" || directive === "disallow") {
      seenRule = true;

      if (value || directive === "allow") {
        currentGroup.rules.push({
          type: directive,
          value,
          matcher: ruleToRegExp(value || "/"),
        });
      }
    }

    if (directive === "crawl-delay") {
      const parsedDelay = Number.parseFloat(value);

      if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
        currentGroup.crawlDelay = parsedDelay;
      }
    }
  }

  const normalizedUserAgent = userAgent.toLowerCase();
  const scoredGroups = groups
    .map((group) => {
      const scores = group.agents.map((agent) => {
        if (agent === "*") {
          return 0;
        }

        return normalizedUserAgent.includes(agent) ? agent.length : -1;
      });

      return {
        group,
        score: Math.max(...scores, -1),
      };
    })
    .filter(({ score }) => score >= 0);

  const bestScore = Math.max(...scoredGroups.map(({ score }) => score), -1);
  const matchedGroups = scoredGroups
    .filter(({ score }) => score === bestScore)
    .map(({ group }) => group);
  const rules = matchedGroups.flatMap((group) => group.rules);
  const crawlDelay = matchedGroups
    .map((group) => group.crawlDelay)
    .find((value) => value !== null) ?? null;

  function isAllowed(urlValue) {
    let url;

    try {
      url = new URL(urlValue, baseUrl);
    } catch {
      return false;
    }

    const target = `${url.pathname}${url.search}`;
    const matchingRules = rules.filter((rule) => rule.matcher.test(target));

    if (matchingRules.length === 0) {
      return true;
    }

    matchingRules.sort((ruleA, ruleB) => {
      const lengthDifference = ruleB.value.length - ruleA.value.length;

      if (lengthDifference !== 0) {
        return lengthDifference;
      }

      return ruleA.type === "allow" ? -1 : 1;
    });

    return matchingRules[0].type === "allow";
  }

  return {
    blocked: false,
    crawlDelay,
    groups,
    isAllowed,
    rules,
    sitemaps: [...new Set(sitemaps)],
  };
}

function allowAllRobots() {
  return {
    blocked: false,
    crawlDelay: null,
    groups: [],
    isAllowed: () => true,
    rules: [],
    sitemaps: [],
  };
}

function denyAllRobots() {
  return {
    blocked: true,
    crawlDelay: null,
    groups: [],
    isAllowed: () => false,
    rules: [],
    sitemaps: [],
  };
}

module.exports = {
  allowAllRobots,
  denyAllRobots,
  parseRobots,
  ruleToRegExp,
};
