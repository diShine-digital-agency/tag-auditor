/**
 * Output formatters for tag-auditor reports.
 */

const isColorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  bold:    (s) => isColorEnabled ? `\x1b[1m${s}\x1b[0m` : s,
  dim:     (s) => isColorEnabled ? `\x1b[2m${s}\x1b[0m` : s,
  red:     (s) => isColorEnabled ? `\x1b[31m${s}\x1b[0m` : s,
  green:   (s) => isColorEnabled ? `\x1b[32m${s}\x1b[0m` : s,
  yellow:  (s) => isColorEnabled ? `\x1b[33m${s}\x1b[0m` : s,
  blue:    (s) => isColorEnabled ? `\x1b[34m${s}\x1b[0m` : s,
  cyan:    (s) => isColorEnabled ? `\x1b[36m${s}\x1b[0m` : s,
  gray:    (s) => isColorEnabled ? `\x1b[90m${s}\x1b[0m` : s,
  bgRed:   (s) => isColorEnabled ? `\x1b[41m\x1b[37m${s}\x1b[0m` : s,
};

// ── Table (terminal) ───────────────────────────────────────────────────

export function formatTable(report) {
  const { container, audit } = report;
  const { scores, summary, issues } = audit;
  const lines = [];

  // Header
  lines.push("");
  lines.push(c.bold("  Tag Auditor Report"));
  lines.push(c.dim(`  Container: ${container.name}${container.publicId ? ` (${container.publicId})` : ""}`));
  lines.push(c.dim(`  ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}`));
  lines.push("");

  // Scores
  lines.push(c.bold("  Scores"));
  lines.push(`  Overall:      ${scoreBar(scores.overall)}`);
  lines.push(`  Governance:   ${scoreBar(scores.governance)}`);
  lines.push(`  Consent:      ${scoreBar(scores.consent)}`);
  lines.push(`  Security:     ${scoreBar(scores.security)}`);
  lines.push(`  Performance:  ${scoreBar(scores.performance)}`);
  lines.push("");

  // Container stats
  lines.push(c.bold("  Container Overview"));
  lines.push(`  Tags: ${container.stats.totalTags}  |  Triggers: ${container.stats.totalTriggers}  |  Variables: ${container.stats.totalVariables}`);
  if (container.stats.totalFolders > 0) lines.push(`  Folders: ${container.stats.totalFolders}  |  Custom Templates: ${container.stats.totalCustomTemplates}`);
  if (summary.pausedTags > 0) lines.push(`  Paused: ${summary.pausedTags}  |  Custom HTML: ${summary.customHTMLTags}`);
  lines.push("");

  // Platform breakdown
  const platforms = Object.entries(summary.platforms).sort((a, b) => b[1] - a[1]);
  if (platforms.length > 0) {
    lines.push(c.bold("  Tags by Platform"));
    for (const [platform, count] of platforms) {
      const bar = "#".repeat(Math.min(count * 2, 30));
      lines.push(`  ${padRight(platform, 20)} ${c.cyan(bar)} ${count}`);
    }
    lines.push("");
  }

  // Issue summary
  if (issues.length > 0) {
    lines.push(c.bold(`  Issues (${issues.length})`));
    const sev = summary.issuesBySeverity;
    const parts = [];
    if (sev.critical > 0) parts.push(c.red(`${sev.critical} critical`));
    if (sev.high > 0) parts.push(c.yellow(`${sev.high} high`));
    if (sev.medium > 0) parts.push(`${sev.medium} medium`);
    if (sev.low > 0) parts.push(c.dim(`${sev.low} low`));
    lines.push(`  ${parts.join("  |  ")}`);
    lines.push("");

    for (const issue of issues) {
      const label = severityLabel(issue.severity);
      lines.push(`  ${label} ${c.dim(`[${issue.category}]`)} ${issue.title}`);
      if (issue.fix) {
        lines.push(`  ${" ".repeat(12)}${c.green(issue.fix)}`);
      }
    }
    lines.push("");
  } else {
    lines.push(c.green("  No issues found. Container looks clean!"));
    lines.push("");
  }

  return lines.join("\n");
}

// ── JSON ───────────────────────────────────────────────────────────────

export function formatJSON(report) {
  const clean = {
    container: {
      name: report.container.name,
      publicId: report.container.publicId,
      containerId: report.container.containerId,
    },
    stats: report.container.stats,
    scores: report.audit.scores,
    summary: report.audit.summary,
    issues: report.audit.issues.map((i) => ({
      severity: i.severity,
      category: i.category,
      title: i.title,
      detail: i.detail,
      item: i.item,
      itemType: i.itemType,
      fix: i.fix,
    })),
    tags: report.container.tags.map((t) => ({
      name: t.name,
      type: t.type,
      platform: t.platform,
      paused: t.paused,
      hasTriggers: t.firingTriggerIds.length > 0,
      hasBlockingTriggers: t.blockingTriggerIds.length > 0,
      hasConsent: !!(t.consentSettings && t.consentSettings.consentStatus !== "notSet"),
    })),
  };
  return JSON.stringify(clean, null, 2);
}

// ── Markdown ───────────────────────────────────────────────────────────

export function formatMarkdown(report) {
  const { container, audit } = report;
  const { scores, summary, issues } = audit;
  const lines = [];

  lines.push("# Tag Auditor Report");
  lines.push("");
  lines.push(`**Container:** ${container.name}${container.publicId ? ` (${container.publicId})` : ""}  `);
  lines.push(`**Date:** ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}  `);
  lines.push("");

  // Scores
  lines.push("## Scores");
  lines.push("");
  lines.push("| Area | Score |");
  lines.push("|------|-------|");
  lines.push(`| Overall | ${scores.overall}/100 |`);
  lines.push(`| Governance | ${scores.governance}/100 |`);
  lines.push(`| Consent | ${scores.consent}/100 |`);
  lines.push(`| Security | ${scores.security}/100 |`);
  lines.push(`| Performance | ${scores.performance}/100 |`);
  lines.push("");

  // Stats
  lines.push("## Container Overview");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|-------|");
  lines.push(`| Tags | ${container.stats.totalTags} |`);
  lines.push(`| Triggers | ${container.stats.totalTriggers} |`);
  lines.push(`| Variables | ${container.stats.totalVariables} |`);
  lines.push(`| Folders | ${container.stats.totalFolders} |`);
  lines.push(`| Paused tags | ${summary.pausedTags} |`);
  lines.push(`| Custom HTML tags | ${summary.customHTMLTags} |`);
  lines.push("");

  // Platform breakdown
  const platforms = Object.entries(summary.platforms).sort((a, b) => b[1] - a[1]);
  if (platforms.length > 0) {
    lines.push("## Tags by Platform");
    lines.push("");
    lines.push("| Platform | Count |");
    lines.push("|----------|-------|");
    for (const [platform, count] of platforms) {
      lines.push(`| ${platform} | ${count} |`);
    }
    lines.push("");
  }

  // Issues
  if (issues.length > 0) {
    lines.push(`## Issues (${issues.length})`);
    lines.push("");
    for (const issue of issues) {
      lines.push(`### [${issue.severity.toUpperCase()}] ${issue.title}`);
      lines.push(`**Category:** ${issue.category}  `);
      lines.push(issue.detail);
      if (issue.fix) {
        lines.push("");
        lines.push(`**Fix:** ${issue.fix}`);
      }
      lines.push("");
    }
  } else {
    lines.push("## Issues");
    lines.push("");
    lines.push("No issues found. Container looks clean!");
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Generated by [tag-auditor](https://github.com/diShine-digital-agency/tag-auditor)*`);

  return lines.join("\n");
}

// ── CSV ────────────────────────────────────────────────────────────────

export function formatCSV(report) {
  const { audit } = report;
  const lines = [];

  lines.push("severity,category,title,item,item_type,fix");
  for (const issue of audit.issues) {
    lines.push([
      issue.severity,
      issue.category,
      csvEscape(issue.title),
      csvEscape(issue.item),
      issue.itemType,
      csvEscape(issue.fix || ""),
    ].join(","));
  }

  return lines.join("\n");
}

// ── Utilities ──────────────────────────────────────────────────────────

function scoreBar(score) {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  const bar = "#".repeat(filled) + " ".repeat(width - filled);
  const colorFn = score >= 80 ? c.green : score >= 50 ? c.yellow : c.red;
  return colorFn(`[${bar}]`) + ` ${score}/100`;
}

function severityLabel(sev) {
  const labels = {
    critical: c.bgRed(" CRITICAL "),
    high:     c.red("   HIGH   "),
    medium:   c.yellow(" MEDIUM   "),
    low:      c.dim("   LOW    "),
  };
  return labels[sev] || `   ${sev}   `;
}

function padRight(str, len) {
  return str.length < len ? str + " ".repeat(len - str.length) : str;
}

function csvEscape(str) {
  if (!str) return '""';
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
