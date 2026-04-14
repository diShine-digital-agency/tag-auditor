#!/usr/bin/env node

/**
 * Basic test suite for tag-auditor.
 * Runs without external test frameworks — zero dependencies.
 */

import { readFileSync } from "fs";
import { parseContainer } from "../src/parser.js";
import { auditContainer } from "../src/auditor.js";
import { formatTable, formatJSON, formatMarkdown, formatCSV } from "../src/reporter.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    failed++;
    console.error(`  ✗ ${message} (did not throw)`);
  } catch {
    passed++;
    console.log(`  ✓ ${message}`);
  }
}

// ── Load sample container ──────────────────────────────────────────────
const raw = JSON.parse(readFileSync(new URL("./sample-container.json", import.meta.url), "utf-8"));

// ── Parser tests ───────────────────────────────────────────────────────
console.log("\nParser");

const container = parseContainer(raw);
assert(container !== null, "parseContainer returns a valid container");
assert(container.name === "My Website", "container name parsed correctly");
assert(container.publicId === "GTM-SAMPLE1", "container publicId parsed correctly");
assert(container.stats.totalTags === 8, "correct tag count (8)");
assert(container.stats.totalTriggers === 5, "correct trigger count (5)");
assert(container.stats.totalVariables === 3, "correct variable count (3)");
assert(container.stats.totalFolders === 0, "correct folder count (0)");

// Tag parsing
const ga4Config = container.tags.find(t => t.name === "GA4 - Config - All Pages");
assert(ga4Config !== undefined, "GA4 config tag found");
assert(ga4Config.platform === "GA4", "GA4 platform detected");
assert(ga4Config.type === "gaawc", "tag type preserved");
assert(ga4Config.firingTriggerIds.length === 1, "firing triggers parsed");
assert(ga4Config.consentSettings !== null, "consent settings parsed");

const metaTag = container.tags.find(t => t.name === "Meta - Pageview - All Pages");
assert(metaTag.platform === "Meta", "Meta platform detected");
assert(metaTag.consentSettings === null, "missing consent returns null");

const pausedTag = container.tags.find(t => t.name === "GA4 - Event - Button Click");
assert(pausedTag.paused === true, "paused tag detected");

// Invalid input
assert(parseContainer({}) === null, "empty object returns null");
assert(parseContainer({ foo: "bar" }) === null, "unrelated object returns null");

// Alternative formats
const asArray = parseContainer([raw]);
assert(asArray !== null, "array-wrapped container parsed");

const directVersion = parseContainer(raw.containerVersion);
assert(directVersion !== null, "direct containerVersion parsed");

// ── Auditor tests ──────────────────────────────────────────────────────
console.log("\nAuditor");

const audit = auditContainer(container);
assert(Array.isArray(audit.issues), "audit returns issues array");
assert(typeof audit.scores === "object", "audit returns scores object");
assert(typeof audit.scores.overall === "number", "overall score is a number");
assert(audit.scores.overall >= 0 && audit.scores.overall <= 100, "overall score in 0-100 range");
assert(audit.scores.governance >= 0 && audit.scores.governance <= 100, "governance score in range");
assert(audit.scores.consent >= 0 && audit.scores.consent <= 100, "consent score in range");
assert(audit.scores.security >= 0 && audit.scores.security <= 100, "security score in range");
assert(audit.scores.performance >= 0 && audit.scores.performance <= 100, "performance score in range");

// Specific issues expected from sample
const consentIssues = audit.issues.filter(i => i.category === "consent" && i.severity === "critical");
assert(consentIssues.length === 3, "3 critical consent issues (Meta, UA, LinkedIn)");

const unusedTagIssues = audit.issues.filter(i => i.category === "unused" && i.itemType === "tag");
assert(unusedTagIssues.length === 1, "1 unused tag (Untitled Tag)");

const deprecatedIssues = audit.issues.filter(i => i.category === "deprecated");
assert(deprecatedIssues.length === 1, "1 deprecated tag (Old UA Tag)");

const securityIssues = audit.issues.filter(i => i.category === "security");
assert(securityIssues.length === 1, "1 security issue (HTTP script)");

const pausedIssues = audit.issues.filter(i => i.title.includes("Paused"));
assert(pausedIssues.length === 1, "1 paused tag issue");

// Severity ordering
for (let i = 1; i < audit.issues.length; i++) {
  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  assert(
    SEVERITY_ORDER[audit.issues[i].severity] >= SEVERITY_ORDER[audit.issues[i - 1].severity],
    `issues sorted by severity (${audit.issues[i - 1].severity} <= ${audit.issues[i].severity})`
  );
  if (SEVERITY_ORDER[audit.issues[i].severity] < SEVERITY_ORDER[audit.issues[i - 1].severity]) break;
}

// Severity filter
const highOnly = auditContainer(container, { minSeverity: "high" });
assert(highOnly.issues.every(i => i.severity === "critical" || i.severity === "high"), "severity filter works");

const criticalOnly = auditContainer(container, { minSeverity: "critical" });
assert(criticalOnly.issues.every(i => i.severity === "critical"), "critical-only filter works");

// Issue structure
for (const issue of audit.issues) {
  assert(typeof issue.severity === "string", `issue has severity: ${issue.title.slice(0, 40)}`);
  assert(typeof issue.category === "string", `issue has category: ${issue.title.slice(0, 40)}`);
  assert(typeof issue.title === "string", `issue has title`);
  assert(typeof issue.fix === "string", `issue has fix: ${issue.title.slice(0, 40)}`);
  break; // Only check the first to keep output manageable
}

// Naming conventions
const namingAudit = auditContainer(container, {
  namingConfig: {
    separator: " - ",
    segments: ["platform", "type", "detail"],
    platforms: ["GA4", "Meta", "LinkedIn", "Google Ads"],
    types: ["Event", "Pageview", "Config", "Conversion"],
  },
});
const namingIssues = namingAudit.issues.filter(i => i.category === "naming");
assert(namingIssues.length > 0, "custom naming convention finds violations");

// Empty container
const emptyContainer = parseContainer({ containerVersion: {} });
const emptyAudit = auditContainer(emptyContainer);
assert(emptyAudit.issues.length === 0, "empty container has no issues");
assert(emptyAudit.scores.overall === 100, "empty container scores 100");

// Conversion Linker check
const adsContainer = parseContainer({ containerVersion: {
  tag: [
    { tagId: "1", name: "Google Ads - Conversion", type: "awct", firingTriggerId: ["1"],
      parameter: [] },
  ],
  trigger: [{ triggerId: "1", name: "All Pages", type: "pageview" }],
} });
const adsAudit = auditContainer(adsContainer);
const linkerIssues = adsAudit.issues.filter(i => i.title === "No Conversion Linker tag for Google Ads");
assert(linkerIssues.length === 1, "missing Conversion Linker detected for Google Ads");

const adsWithLinker = parseContainer({ containerVersion: {
  tag: [
    { tagId: "1", name: "Google Ads - Conversion", type: "awct", firingTriggerId: ["1"], parameter: [] },
    { tagId: "2", name: "Conversion Linker", type: "gclidw", firingTriggerId: ["1"], parameter: [] },
  ],
  trigger: [{ triggerId: "1", name: "All Pages", type: "pageview" }],
} });
const adsWithLinkerAudit = auditContainer(adsWithLinker);
const noLinkerIssues = adsWithLinkerAudit.issues.filter(i => i.title === "No Conversion Linker tag for Google Ads");
assert(noLinkerIssues.length === 0, "no Conversion Linker issue when linker tag exists");

// Circular dependency check
const circularContainer = parseContainer({ containerVersion: {
  tag: [
    { tagId: "1", name: "Tag A", type: "html", firingTriggerId: ["1"],
      setupTag: [{ tagName: "Tag B" }], parameter: [] },
    { tagId: "2", name: "Tag B", type: "html", firingTriggerId: ["1"],
      setupTag: [{ tagName: "Tag A" }], parameter: [] },
  ],
  trigger: [{ triggerId: "1", name: "All Pages", type: "pageview" }],
} });
const circularAudit = auditContainer(circularContainer);
const circularIssues = circularAudit.issues.filter(i => i.title.includes("Circular"));
assert(circularIssues.length === 1, "circular tag dependency detected");

const noCircularContainer = parseContainer({ containerVersion: {
  tag: [
    { tagId: "1", name: "Tag A", type: "html", firingTriggerId: ["1"],
      setupTag: [{ tagName: "Tag B" }], parameter: [] },
    { tagId: "2", name: "Tag B", type: "html", firingTriggerId: ["1"], parameter: [] },
  ],
  trigger: [{ triggerId: "1", name: "All Pages", type: "pageview" }],
} });
const noCircularAudit = auditContainer(noCircularContainer);
const noCircularIssues = noCircularAudit.issues.filter(i => i.title.includes("Circular"));
assert(noCircularIssues.length === 0, "no circular dependency when sequencing is one-way");

// GA4 Measurement ID check
const ga4NoId = parseContainer({ containerVersion: {
  tag: [
    { tagId: "1", name: "GA4 Config", type: "gaawc", firingTriggerId: ["1"], parameter: [] },
  ],
  trigger: [{ triggerId: "1", name: "All Pages", type: "pageview" }],
} });
const ga4NoIdAudit = auditContainer(ga4NoId);
const measIdIssues = ga4NoIdAudit.issues.filter(i => i.title.includes("Measurement ID"));
assert(measIdIssues.length === 1, "missing GA4 Measurement ID detected");

const ga4WithId = parseContainer({ containerVersion: {
  tag: [
    { tagId: "1", name: "GA4 Config", type: "gaawc", firingTriggerId: ["1"],
      parameter: [{ key: "measurementId", value: "G-ABC123", type: "template" }] },
  ],
  trigger: [{ triggerId: "1", name: "All Pages", type: "pageview" }],
} });
const ga4WithIdAudit = auditContainer(ga4WithId);
const noMeasIdIssues = ga4WithIdAudit.issues.filter(i => i.title.includes("Measurement ID"));
assert(noMeasIdIssues.length === 0, "no Measurement ID issue when ID is present");

// ── Reporter tests ─────────────────────────────────────────────────────
console.log("\nReporter");

const report = { container, audit };

const tableOutput = formatTable(report);
assert(typeof tableOutput === "string", "formatTable returns string");
assert(tableOutput.includes("Tag Auditor Report"), "table includes header");
assert(tableOutput.includes("My Website"), "table includes container name");

const jsonOutput = formatJSON(report);
assert(typeof jsonOutput === "string", "formatJSON returns string");
const parsed = JSON.parse(jsonOutput);
assert(parsed.container.name === "My Website", "JSON output parseable and correct");
assert(parsed.scores.overall === audit.scores.overall, "JSON scores match");

const mdOutput = formatMarkdown(report);
assert(typeof mdOutput === "string", "formatMarkdown returns string");
assert(mdOutput.includes("# Tag Auditor Report"), "markdown has H1 header");
assert(mdOutput.includes("| Area | Score |"), "markdown has scores table");

const csvOutput = formatCSV(report);
assert(typeof csvOutput === "string", "formatCSV returns string");
const csvLines = csvOutput.trim().split("\n");
assert(csvLines[0] === "severity,category,title,item,item_type,fix", "CSV has correct header");
assert(csvLines.length === audit.issues.length + 1, "CSV has one row per issue + header");

// ── Summary ────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
