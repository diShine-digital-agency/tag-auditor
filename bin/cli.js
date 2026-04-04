#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, extname } from "path";
import { parseContainer } from "../src/parser.js";
import { auditContainer } from "../src/auditor.js";
import { formatTable, formatJSON, formatMarkdown, formatCSV } from "../src/reporter.js";

// ── Argument parsing ───────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("-h") || args.includes("--help") || args.length === 0) {
  printHelp();
  process.exit(0);
}

if (args.includes("-v") || args.includes("--version")) {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
  console.log(pkg.version);
  process.exit(0);
}

const flags = {
  format: getFlag(["-f", "--format"]) || "table",
  output: getFlag(["-o", "--output"]),
  quiet: args.includes("-q") || args.includes("--quiet"),
  severity: getFlag(["-s", "--severity"]) || "low",
  naming: getFlag(["--naming"]),
};

const flagsWithValues = new Set(["-f", "--format", "-o", "--output", "-s", "--severity", "--naming"]);
const allFlags = new Set([...flagsWithValues, "-q", "--quiet", "-h", "--help", "-v", "--version"]);

let inputFiles = [];
for (let i = 0; i < args.length; i++) {
  if (flagsWithValues.has(args[i])) { i++; continue; }
  if (allFlags.has(args[i])) continue;
  inputFiles.push(args[i]);
}

if (inputFiles.length === 0) {
  console.error("Error: No GTM container file provided. Run with --help for usage.\n");
  process.exit(1);
}

const validFormats = ["table", "json", "markdown", "md", "csv"];
if (!validFormats.includes(flags.format)) {
  console.error(`Error: Invalid format "${flags.format}". Valid: ${validFormats.join(", ")}\n`);
  process.exit(1);
}
if (flags.format === "md") flags.format = "markdown";

const validSeverities = ["critical", "high", "medium", "low"];
if (!validSeverities.includes(flags.severity)) {
  console.error(`Error: Invalid severity "${flags.severity}". Valid: ${validSeverities.join(", ")}\n`);
  process.exit(1);
}

// Parse naming convention config
let namingConfig = null;
if (flags.naming) {
  if (existsSync(flags.naming)) {
    try {
      namingConfig = JSON.parse(readFileSync(flags.naming, "utf-8"));
    } catch (e) {
      console.error(`Error: Invalid JSON in naming config "${flags.naming}": ${e.message}\n`);
      process.exit(1);
    }
  } else {
    console.error(`Error: Naming config file not found: ${flags.naming}\n`);
    process.exit(1);
  }
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  let allReports = [];

  for (const inputFile of inputFiles) {
    const filePath = resolve(inputFile);

    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      continue;
    }

    if (!flags.quiet) {
      console.log("");
      console.log("  tag-auditor — analyzing...");
      console.log(`  ${filePath}`);
      console.log("");
    }

    let raw;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch (err) {
      console.error(`Error: Cannot read file: ${err.message}`);
      continue;
    }

    let containerData;
    try {
      containerData = JSON.parse(raw);
    } catch (err) {
      console.error(`Error: Invalid JSON in ${inputFile}: ${err.message}`);
      continue;
    }

    // Parse
    const container = parseContainer(containerData);

    if (!container) {
      console.error(`Error: ${inputFile} does not appear to be a valid GTM container export.`);
      continue;
    }

    // Audit
    const audit = auditContainer(container, {
      minSeverity: flags.severity,
      namingConfig,
    });

    allReports.push({
      file: inputFile,
      container,
      audit,
    });
  }

  if (allReports.length === 0) {
    console.error("No valid container files processed. Exiting.");
    process.exit(2);
  }

  // Format
  let output;
  if (allReports.length === 1) {
    output = formatReport(allReports[0], flags.format);
  } else {
    output = allReports.map((r) => formatReport(r, flags.format)).join("\n\n---\n\n");
  }

  // Output
  if (flags.output) {
    const outPath = resolve(flags.output);
    writeFileSync(outPath, stripAnsi(output), "utf-8");
    if (!flags.quiet) console.log(`  Report saved to: ${outPath}`);
  } else {
    console.log(output);
  }

  // Exit code based on worst severity found
  const hasCritical = allReports.some((r) => r.audit.issues.some((i) => i.severity === "critical"));
  const hasHigh = allReports.some((r) => r.audit.issues.some((i) => i.severity === "high"));
  process.exit(hasCritical ? 1 : 0);
}

main();

// ── Helpers ────────────────────────────────────────────────────────────

function formatReport(report, format) {
  switch (format) {
    case "table": return formatTable(report);
    case "json": return formatJSON(report);
    case "markdown": return formatMarkdown(report);
    case "csv": return formatCSV(report);
    default: return formatTable(report);
  }
}

function getFlag(names) {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  }
  return null;
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function printHelp() {
  console.log(`
  tag-auditor — Audit Google Tag Manager containers

  USAGE
    tag-auditor <container.json> [options]
    tag-auditor <file1.json> <file2.json> [options]

  ARGUMENTS
    <file>        GTM container export JSON file
                  (Export from GTM: Admin → Export Container → choose version)

  OPTIONS
    -f, --format <type>      Output: table, json, markdown, csv        [default: table]
    -o, --output <file>      Save report to file
    -s, --severity <level>   Minimum severity to show:
                             critical, high, medium, low               [default: low]
    --naming <config.json>   Custom naming convention rules (JSON file)
    -q, --quiet              Suppress progress messages
    -h, --help               Show this help
    -v, --version            Show version

  EXAMPLES
    tag-auditor container.json
    tag-auditor container.json -f markdown -o report.md
    tag-auditor container.json -s high
    tag-auditor container.json --naming naming-rules.json
    tag-auditor v1.json v2.json -f json -o comparison.json

  NAMING CONFIG FORMAT
    {
      "separator": " - ",
      "segments": ["platform", "type", "detail"],
      "platforms": ["GA4", "Meta", "LinkedIn", "GTM"],
      "types": ["Event", "Pageview", "Config", "Conversion"]
    }

  EXIT CODES
    0   No critical issues
    1   Critical issues found
    2   Fatal error (invalid file)
`);
}
