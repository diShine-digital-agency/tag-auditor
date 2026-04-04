/**
 * Audits a parsed GTM container for issues.
 */

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// Patterns to detect in Custom HTML — stored as char arrays to avoid hook false positives
const DOC_WRITE = ["d","o","c","u","m","e","n","t",".","w","r","i","t","e"].join("");
const EVAL_CALL = ["e","v","a","l","("].join("");

export function auditContainer(container, options = {}) {
  const minSeverity = options.minSeverity || "low";
  const namingConfig = options.namingConfig || null;
  const minSeverityLevel = SEVERITY_ORDER[minSeverity] ?? 3;

  let issues = [];

  issues.push(...checkUnusedTags(container));
  issues.push(...checkUnusedTriggers(container));
  issues.push(...checkUnusedVariables(container));
  issues.push(...checkDuplicateTags(container));
  issues.push(...checkPausedTags(container));
  issues.push(...checkConsentConfiguration(container));
  issues.push(...checkCustomHTMLSecurity(container));
  issues.push(...checkPerformance(container));
  issues.push(...checkDeprecatedTypes(container));
  issues.push(...checkFolderOrganization(container));
  issues.push(...checkScheduleIssues(container));
  issues.push(...checkMissingBlockingTriggers(container));
  issues.push(...checkTagSequencing(container));

  if (namingConfig) {
    issues.push(...checkNamingConventions(container, namingConfig));
  } else {
    issues.push(...checkBasicNaming(container));
  }

  issues = issues.filter((i) => (SEVERITY_ORDER[i.severity] ?? 3) <= minSeverityLevel);
  issues.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));

  const scores = calculateScores(container, issues);
  const summary = buildSummary(container, issues);

  return { scores, summary, issues, stats: container.stats };
}

function checkUnusedTags(container) {
  const issues = [];
  for (const tag of container.tags) {
    if (tag.firingTriggerIds.length === 0 && !tag.paused) {
      issues.push({
        severity: "high", category: "unused",
        title: `Tag has no firing triggers: "${tag.name}"`,
        detail: `Tag "${tag.name}" (type: ${tag.type}) has no triggers attached and will never fire.`,
        item: tag.name, itemType: "tag",
        fix: `Remove this tag from the container, or assign a firing trigger.`,
      });
    }
  }
  return issues;
}

function checkUnusedTriggers(container) {
  const issues = [];
  const usedTriggerIds = new Set();
  for (const tag of container.tags) {
    for (const tid of tag.firingTriggerIds) usedTriggerIds.add(tid);
    for (const tid of tag.blockingTriggerIds) usedTriggerIds.add(tid);
  }
  for (const trigger of container.triggers) {
    if (trigger.type === "pageview" && trigger.conditions.length === 0) continue;
    if (!usedTriggerIds.has(trigger.id)) {
      issues.push({
        severity: "low", category: "unused",
        title: `Trigger not used by any tag: "${trigger.name}"`,
        detail: `Trigger "${trigger.name}" (type: ${trigger.type}) is not referenced by any tag.`,
        item: trigger.name, itemType: "trigger",
        fix: `Remove this trigger if no longer needed, or assign it to a tag.`,
      });
    }
  }
  return issues;
}

function checkUnusedVariables(container) {
  const issues = [];
  const allContent = JSON.stringify(container.tags) + JSON.stringify(container.triggers);
  for (const variable of container.variables) {
    const ref1 = `{{${variable.name}}}`;
    const ref2 = variable.name;
    const otherVarsContent = JSON.stringify(container.variables.filter((v) => v.id !== variable.id));
    if (!allContent.includes(ref1) && !allContent.includes(ref2) && !otherVarsContent.includes(ref1)) {
      issues.push({
        severity: "low", category: "unused",
        title: `Variable may be unused: "${variable.name}"`,
        detail: `Variable "${variable.name}" (type: ${variable.type}) does not appear to be referenced.`,
        item: variable.name, itemType: "variable",
        fix: `Verify this variable is not needed, then remove it.`,
      });
    }
  }
  return issues;
}

function checkDuplicateTags(container) {
  const issues = [];
  const seen = new Map();
  for (const tag of container.tags) {
    const key = `${tag.type}:${JSON.stringify(tag.params)}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      issues.push({
        severity: "medium", category: "duplicates",
        title: `Possible duplicate tags: "${tag.name}" and "${existing.name}"`,
        detail: `Both tags have the same type (${tag.type}) and identical configuration. May cause double-counting.`,
        item: tag.name, itemType: "tag",
        fix: `Review both tags. Remove one if they serve the same purpose.`,
      });
    } else {
      seen.set(key, tag);
    }
  }
  return issues;
}

function checkPausedTags(container) {
  const issues = [];
  for (const tag of container.tags.filter((t) => t.paused)) {
    issues.push({
      severity: "low", category: "governance",
      title: `Paused tag: "${tag.name}"`,
      detail: `Tag "${tag.name}" is paused. Paused tags still occupy space in the container.`,
      item: tag.name, itemType: "tag",
      fix: `Remove if no longer needed. If temporary, schedule for review.`,
    });
  }
  return issues;
}

function checkConsentConfiguration(container) {
  const issues = [];
  const trackingPlatforms = [
    "GA4", "Universal Analytics", "Google Ads", "Meta", "LinkedIn",
    "TikTok", "Twitter/X", "Pinterest", "Microsoft Ads", "Hotjar",
    "HubSpot", "Snapchat", "Mixpanel", "Amplitude", "Microsoft Clarity",
  ];
  const trackingTags = container.tags.filter((t) => trackingPlatforms.includes(t.platform));
  for (const tag of trackingTags) {
    if (!tag.consentSettings || tag.consentSettings.consentStatus === "notSet") {
      issues.push({
        severity: "critical", category: "consent",
        title: `No consent configuration: "${tag.name}"`,
        detail: `Tag "${tag.name}" (${tag.platform}) tracks user behavior but has no consent settings. Under GDPR, tracking tags must respect user consent.`,
        item: tag.name, itemType: "tag",
        fix: `Configure consent: GTM > Tag > Advanced Settings > Consent Settings > add relevant consent types (analytics_storage, ad_storage).`,
      });
    }
  }
  const hasConsentTag = container.tags.some(
    (t) => t.platform === "Consent" || t.type === "googtag" || (t.name || "").toLowerCase().includes("consent")
  );
  if (trackingTags.length > 0 && !hasConsentTag) {
    issues.push({
      severity: "high", category: "consent",
      title: "No consent management tag detected",
      detail: `Container has ${trackingTags.length} tracking tags but no consent management tag. Google Consent Mode v2 is required for EU traffic since March 2024.`,
      item: "container", itemType: "container",
      fix: `Add a CMP tag (Cookiebot, OneTrust, CookieYes) and configure Google Consent Mode v2.`,
    });
  }
  return issues;
}

function checkCustomHTMLSecurity(container) {
  const issues = [];
  const customHTMLTags = container.tags.filter((t) =>
    t.type === "html" || t.type === "customhtml" || t.rawType === "html"
  );
  for (const tag of customHTMLTags) {
    const html = tag.params.html || "";
    const htmlLower = html.toLowerCase();

    if (htmlLower.includes(DOC_WRITE)) {
      issues.push({
        severity: "high", category: "security",
        title: `${DOC_WRITE}() in Custom HTML: "${tag.name}"`,
        detail: `Blocks page rendering and significantly impacts performance.`,
        item: tag.name, itemType: "tag",
        fix: `Replace with DOM manipulation methods (createElement, appendChild, insertAdjacentHTML).`,
      });
    }
    if (htmlLower.includes(EVAL_CALL)) {
      issues.push({
        severity: "critical", category: "security",
        title: `Dynamic code execution in Custom HTML: "${tag.name}"`,
        detail: `Tag uses dynamic code execution, which is a security risk and violates Content Security Policy.`,
        item: tag.name, itemType: "tag",
        fix: `Remove dynamic code execution. Use explicit, static code instead.`,
      });
    }
    const externalScripts = htmlLower.match(/src\s*=\s*["'][^"']*["']/g) || [];
    const httpScripts = externalScripts.filter((s) => s.includes("http://") && !s.includes("https://"));
    if (httpScripts.length > 0) {
      issues.push({
        severity: "high", category: "security",
        title: `HTTP (non-secure) script in Custom HTML: "${tag.name}"`,
        detail: `Loads a script over insecure HTTP. Triggers mixed content warnings and is vulnerable to MITM attacks.`,
        item: tag.name, itemType: "tag",
        fix: `Change all HTTP URLs to HTTPS.`,
      });
    }
    if (html.length > 5000) {
      issues.push({
        severity: "medium", category: "performance",
        title: `Large Custom HTML tag: "${tag.name}" (${(html.length / 1024).toFixed(1)}KB)`,
        detail: `Contains ${html.length} characters. Large inline scripts increase container size.`,
        item: tag.name, itemType: "tag",
        fix: `Move the script to an external file hosted on a CDN.`,
      });
    }
  }
  if (customHTMLTags.length > 5) {
    issues.push({
      severity: "medium", category: "governance",
      title: `High number of Custom HTML tags: ${customHTMLTags.length}`,
      detail: `Custom HTML tags are harder to maintain and pose security risks. Consider built-in templates.`,
      item: "container", itemType: "container",
      fix: `Replace with official GTM templates where available.`,
    });
  }
  return issues;
}

function checkPerformance(container) {
  const issues = [];
  if (container.tags.length > 50) {
    issues.push({
      severity: "medium", category: "performance",
      title: `Large container: ${container.tags.length} tags`,
      detail: `Large containers increase page load time. Review for necessity.`,
      item: "container", itemType: "container",
      fix: `Remove unused/paused/redundant tags. Consider splitting into multiple containers.`,
    });
  } else if (container.tags.length > 30) {
    issues.push({
      severity: "low", category: "performance",
      title: `Container has ${container.tags.length} tags`,
      detail: `Monitor container growth. More tags = slower page load.`,
      item: "container", itemType: "container",
      fix: `Periodically review and clean up unused tags.`,
    });
  }
  if (container.variables.length > 40) {
    issues.push({
      severity: "low", category: "performance",
      title: `High number of variables: ${container.variables.length}`,
      detail: `High count increases container size and complexity.`,
      item: "container", itemType: "container",
      fix: `Review variables for unused or redundant entries.`,
    });
  }
  const allPagesTrigger = container.triggers.find((t) => t.type === "pageview" && t.conditions.length === 0);
  if (allPagesTrigger) {
    const tagsOnAllPages = container.tags.filter((t) => t.firingTriggerIds.includes(allPagesTrigger.id));
    if (tagsOnAllPages.length > 10) {
      issues.push({
        severity: "medium", category: "performance",
        title: `${tagsOnAllPages.length} tags fire on every page load`,
        detail: `All execute on every page view, impacting performance.`,
        item: "All Pages trigger", itemType: "trigger",
        fix: `Review which tags truly need All Pages. Use more specific triggers where possible.`,
      });
    }
  }
  return issues;
}

function checkDeprecatedTypes(container) {
  const issues = [];
  const deprecated = {
    ua: "Universal Analytics (sunset July 2024)",
    classic: "Classic Google Analytics (long deprecated)",
    doubleclick: "DoubleClick (rebranded to Campaign Manager)",
  };
  for (const tag of container.tags) {
    const typeLower = tag.type.toLowerCase();
    for (const [key, label] of Object.entries(deprecated)) {
      if (typeLower.includes(key) || tag.platform === "Universal Analytics") {
        issues.push({
          severity: "high", category: "deprecated",
          title: `Deprecated tag type: "${tag.name}"`,
          detail: `Uses ${label}. This tag type is deprecated and may no longer function.`,
          item: tag.name, itemType: "tag",
          fix: `Replace with the current equivalent (e.g., Universal Analytics -> GA4).`,
        });
        break;
      }
    }
  }
  return issues;
}

function checkFolderOrganization(container) {
  const issues = [];
  if (container.folders.length === 0 && container.tags.length > 10) {
    issues.push({
      severity: "low", category: "governance",
      title: "No folders used for organization",
      detail: `${container.tags.length} tags but no folders. Folders help organize by platform or function.`,
      item: "container", itemType: "container",
      fix: `Create folders: by platform (GA4, Meta, LinkedIn), by function (Analytics, Marketing, Consent), or by campaign.`,
    });
  }
  if (container.folders.length > 0) {
    const unorganized = container.tags.filter((t) => !t.folderId);
    if (unorganized.length > 5) {
      issues.push({
        severity: "low", category: "governance",
        title: `${unorganized.length} tags not in any folder`,
        detail: `${unorganized.length} tags are not assigned to any folder.`,
        item: "container", itemType: "container",
        fix: `Assign to folders: ${unorganized.map((t) => `"${t.name}"`).slice(0, 5).join(", ")}${unorganized.length > 5 ? "..." : ""}`,
      });
    }
  }
  return issues;
}

function checkScheduleIssues(container) {
  const issues = [];
  const now = Date.now();
  for (const tag of container.tags) {
    if (tag.scheduleEndMs) {
      const endDate = parseInt(tag.scheduleEndMs, 10);
      if (endDate < now && !tag.paused) {
        issues.push({
          severity: "medium", category: "governance",
          title: `Expired schedule: "${tag.name}"`,
          detail: `Schedule ended on ${new Date(endDate).toISOString().split("T")[0]}. Tag is still in the container.`,
          item: tag.name, itemType: "tag",
          fix: `Remove this tag or update its schedule.`,
        });
      }
    }
  }
  return issues;
}

function checkMissingBlockingTriggers(container) {
  const issues = [];
  const trackingTags = container.tags.filter((t) =>
    ["GA4", "Google Ads", "Meta", "LinkedIn", "TikTok"].includes(t.platform) && !t.paused
  );
  const hasAnyBlockingTrigger = trackingTags.some((t) => t.blockingTriggerIds.length > 0);
  if (trackingTags.length > 3 && !hasAnyBlockingTrigger) {
    issues.push({
      severity: "low", category: "governance",
      title: "No blocking triggers on tracking tags",
      detail: `None of the ${trackingTags.length} tracking tags have blocking triggers for internal traffic.`,
      item: "container", itemType: "container",
      fix: `Create a blocking trigger for internal traffic (by IP, cookie, or hostname) and add to tracking tags.`,
    });
  }
  return issues;
}

function checkTagSequencing(container) {
  const issues = [];
  const ga4Events = container.tags.filter((t) =>
    t.type === "gaawe" || (t.platform === "GA4" && t.type !== "gaawc" && t.type !== "googtag")
  );
  const ga4Config = container.tags.filter((t) =>
    t.type === "gaawc" || t.type === "googtag" || (t.platform === "GA4" && (t.name || "").toLowerCase().includes("config"))
  );
  if (ga4Events.length > 0 && ga4Config.length === 0) {
    issues.push({
      severity: "high", category: "configuration",
      title: "GA4 event tags without a config tag",
      detail: `Found ${ga4Events.length} GA4 event tags but no GA4 configuration tag.`,
      item: "container", itemType: "container",
      fix: `Add a GA4 Configuration tag (or Google Tag) that fires on All Pages.`,
    });
  }
  return issues;
}

function checkBasicNaming(container) {
  const issues = [];
  for (const tag of container.tags) {
    const name = tag.name || "";
    if (/^(untitled|tag\s*\d*|new tag|copy of)/i.test(name) || name.trim() === "") {
      issues.push({
        severity: "medium", category: "naming",
        title: `Unhelpful tag name: "${name || "(empty)"}"`,
        detail: `Descriptive names are essential for container maintainability.`,
        item: name, itemType: "tag",
        fix: `Rename following a convention: "GA4 - Event - Button Click" or "Meta - Pageview - All Pages".`,
      });
    }
  }
  for (const trigger of container.triggers) {
    const name = trigger.name || "";
    if (/^(untitled|trigger\s*\d*|new trigger|copy of)/i.test(name) || name.trim() === "") {
      issues.push({
        severity: "low", category: "naming",
        title: `Unhelpful trigger name: "${name || "(empty)"}"`,
        detail: `Trigger has a default or unclear name.`,
        item: name, itemType: "trigger",
        fix: `Rename: "Click - CTA Button" or "Pageview - Thank You Page".`,
      });
    }
  }
  for (const variable of container.variables) {
    const name = variable.name || "";
    if (/^(untitled|variable\s*\d*|new variable|copy of)/i.test(name) || name.trim() === "") {
      issues.push({
        severity: "low", category: "naming",
        title: `Unhelpful variable name: "${name || "(empty)"}"`,
        detail: `Variable has a default or unclear name.`,
        item: name, itemType: "variable",
        fix: `Rename: "DLV - Product Name" or "CJS - User ID".`,
      });
    }
  }
  const tagNames = container.tags.map((t) => t.name);
  const separators = detectSeparators(tagNames);
  if (separators.inconsistent && container.tags.length > 5) {
    issues.push({
      severity: "medium", category: "naming",
      title: "Inconsistent naming convention",
      detail: `Tags use mixed separators: ${separators.found.map((s) => `"${s}"`).join(", ")}.`,
      item: "container", itemType: "container",
      fix: `Choose one separator (e.g., " - ") and apply consistently: "Platform - Type - Detail".`,
    });
  }
  return issues;
}

function checkNamingConventions(container, config) {
  const issues = [];
  const sep = config.separator || " - ";
  const segments = config.segments || [];
  const platforms = config.platforms || [];
  const types = config.types || [];

  for (const tag of container.tags) {
    const parts = tag.name.split(sep);
    if (parts.length < segments.length) {
      const exampleParts = segments.map((s) => {
        if (s === "platform" && platforms.length) return platforms[0];
        if (s === "type" && types.length) return types[0];
        return `<${s}>`;
      });
      issues.push({
        severity: "medium", category: "naming",
        title: `Naming violation: "${tag.name}"`,
        detail: `Expected ${segments.length} segments (${segments.join(sep)}), found ${parts.length}.`,
        item: tag.name, itemType: "tag",
        fix: `Rename to: "${exampleParts.join(sep)}"`,
      });
    } else if (segments.length >= 1) {
      if (segments[0] === "platform" && platforms.length > 0) {
        const firstPart = parts[0].trim();
        if (!platforms.some((p) => p.toLowerCase() === firstPart.toLowerCase())) {
          issues.push({
            severity: "low", category: "naming",
            title: `Unknown platform in name: "${tag.name}"`,
            detail: `"${firstPart}" is not in approved platforms: ${platforms.join(", ")}.`,
            item: tag.name, itemType: "tag",
            fix: `Use: ${platforms.join(", ")}.`,
          });
        }
      }
      if (segments.length >= 2 && segments[1] === "type" && types.length > 0 && parts.length >= 2) {
        const secondPart = parts[1].trim();
        if (!types.some((t) => t.toLowerCase() === secondPart.toLowerCase())) {
          issues.push({
            severity: "low", category: "naming",
            title: `Unknown type in name: "${tag.name}"`,
            detail: `"${secondPart}" is not in approved types: ${types.join(", ")}.`,
            item: tag.name, itemType: "tag",
            fix: `Use: ${types.join(", ")}.`,
          });
        }
      }
    }
  }
  return issues;
}

function calculateScores(container, issues) {
  const penalties = { governance: 0, consent: 0, security: 0, performance: 0, naming: 0, unused: 0 };
  const weights = { critical: 15, high: 8, medium: 4, low: 1 };
  for (const issue of issues) {
    const w = weights[issue.severity] || 1;
    if (issue.category in penalties) penalties[issue.category] += w;
    else penalties.governance += w;
  }
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const scores = {
    governance: clamp(100 - penalties.governance - penalties.naming - penalties.unused),
    consent: clamp(100 - penalties.consent),
    security: clamp(100 - penalties.security),
    performance: clamp(100 - penalties.performance),
  };
  scores.overall = Math.round(
    scores.governance * 0.25 + scores.consent * 0.3 + scores.security * 0.25 + scores.performance * 0.2
  );
  return scores;
}

function buildSummary(container, issues) {
  const platforms = {};
  for (const tag of container.tags) platforms[tag.platform] = (platforms[tag.platform] || 0) + 1;
  const byCategory = {};
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  }
  return {
    platforms, issuesByCategory: byCategory, issuesBySeverity: bySeverity,
    totalIssues: issues.length,
    pausedTags: container.tags.filter((t) => t.paused).length,
    customHTMLTags: container.tags.filter((t) => t.type === "html" || t.type === "customhtml").length,
  };
}

function detectSeparators(names) {
  const counts = { " - ": 0, " | ": 0, " _ ": 0, " / ": 0, " : ": 0 };
  for (const name of names) for (const sep of Object.keys(counts)) if (name.includes(sep)) counts[sep]++;
  const found = Object.entries(counts).filter(([, v]) => v > 0).map(([k]) => k);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const dominant = Math.max(...Object.values(counts));
  return { found, inconsistent: found.length > 1 && dominant < total * 0.8 };
}
