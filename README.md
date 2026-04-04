# tag-auditor

**Audit Google Tag Manager containers -- find unused tags, naming violations, missing consent, security risks, and performance issues.**

Import a GTM container JSON export. Get a structured report with scores, issues, severity levels, and fixes.

Built by [diShine Digital Agency](https://dishine.it)

---

## What it does

1. Parses a GTM container export (JSON)
2. Identifies **every tag, trigger, and variable** with platform detection (GA4, Meta, LinkedIn, etc.)
3. Runs **14 audit checks** across governance, consent, security, performance, and naming
4. Scores the container in 4 areas (0-100 each)
5. Reports issues with **severity levels** and **actionable fixes**

Zero dependencies. Pure JSON parsing. No network requests, no browser needed.

---

## Quick Start

```bash
# Install globally
npm install -g @dishine/tag-auditor

# Audit a container
tag-auditor container.json

# Save a Markdown report
tag-auditor container.json -f markdown -o report.md

# Show only high and critical issues
tag-auditor container.json -s high

# Custom naming convention enforcement
tag-auditor container.json --naming naming-rules.json
```

Or run without installing:

```bash
npx @dishine/tag-auditor container.json
```

---

## How to export your GTM container

1. Open [tagmanager.google.com](https://tagmanager.google.com)
2. Select your container
3. Go to **Admin** (gear icon)
4. Click **Export Container**
5. Choose a version (or the current workspace)
6. Save the `.json` file
7. Run: `tag-auditor exported-file.json`

---

## Output Example

```
  Tag Auditor Report
  Container: My Website (GTM-XXXXX)
  4 Apr 2026

  Scores
  Overall:      [###############-----] 72/100
  Governance:   [################----] 81/100
  Consent:      [############--------] 55/100
  Security:     [####################] 100/100
  Performance:  [##################--] 89/100

  Container Overview
  Tags: 24  |  Triggers: 18  |  Variables: 12

  Tags by Platform
  GA4                  ############ 6
  Meta                 ########## 5
  Google Ads           ###### 3
  Custom HTML          ###### 3
  LinkedIn             #### 2
  ...

  Issues (8)
  2 critical  |  2 high  |  3 medium  |  1 low

   CRITICAL  [consent] No consent configuration: "Meta - Pageview"
              Configure consent: GTM > Tag > Advanced Settings > ...

   HIGH      [unused] Tag has no firing triggers: "GA4 - Event - Old Click"
              Remove this tag or assign a firing trigger.

   MEDIUM    [naming] Inconsistent naming convention
              Choose one separator and apply consistently.
  ...
```

---

## What it checks

### 14 audit checks

| # | Check | Category | What it finds |
|---|-------|----------|---------------|
| 1 | Unused tags | Unused | Tags with no triggers (never fire) |
| 2 | Unused triggers | Unused | Triggers not attached to any tag |
| 3 | Unused variables | Unused | Variables not referenced anywhere |
| 4 | Duplicate tags | Duplicates | Same type + configuration = double counting |
| 5 | Paused tags | Governance | Dead weight in the container |
| 6 | Consent configuration | Consent | Tracking tags without GDPR consent settings |
| 7 | Consent management | Consent | No CMP detected (Consent Mode v2) |
| 8 | Custom HTML security | Security | Dangerous patterns, insecure HTTP scripts |
| 9 | Performance | Performance | Too many tags, large custom HTML, All Pages overload |
| 10 | Deprecated types | Deprecated | Universal Analytics, Classic GA, DoubleClick |
| 11 | Folder organization | Governance | No folders, unorganized tags |
| 12 | Schedule issues | Governance | Expired campaign schedules |
| 13 | Blocking triggers | Governance | No internal traffic filtering |
| 14 | Tag sequencing | Configuration | GA4 events without config tag |

Plus **naming convention checks** (basic or custom rules).

### Scoring (0-100 per area)

| Area | What it measures |
|------|-----------------|
| **Governance** | Organization, naming, unused items, paused tags |
| **Consent** | GDPR consent configuration, CMP presence |
| **Security** | Custom HTML risks, insecure scripts |
| **Performance** | Container size, tag count, All Pages load |

### Issue severity

| Level | Examples |
|-------|----------|
| **Critical** | Tracking tags without consent, dangerous code patterns |
| **High** | Unused tags, deprecated types, insecure scripts, missing CMP |
| **Medium** | Duplicate tags, naming violations, large custom HTML |
| **Low** | Paused tags, unused triggers/variables, missing folders |

---

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format` | Output: `table`, `json`, `markdown`, `csv` | `table` |
| `-o, --output` | Save report to file | stdout |
| `-s, --severity` | Minimum severity: `critical`, `high`, `medium`, `low` | `low` |
| `--naming` | Custom naming convention rules (JSON file) | basic checks |
| `-q, --quiet` | Suppress progress messages | off |

---

## Custom Naming Conventions

Create a JSON file with your team's naming rules:

```json
{
  "separator": " - ",
  "segments": ["platform", "type", "detail"],
  "platforms": ["GA4", "Meta", "LinkedIn", "Google Ads", "GTM", "Hotjar"],
  "types": ["Event", "Pageview", "Config", "Conversion", "Remarketing"]
}
```

Then run:

```bash
tag-auditor container.json --naming naming-rules.json
```

Tags not following the convention will be flagged:
- `"FB Pixel"` -> violation (should be `"Meta - Pageview - All Pages"`)
- `"GA4 - Event - Form Submit"` -> passes

---

## Platform Detection

tag-auditor automatically recognizes tags from:

| Platform | Detection |
|----------|-----------|
| GA4 | `gaawc`, `gaawe`, `googtag` types |
| Universal Analytics | `ua` type (flagged as deprecated) |
| Google Ads | `awct`, conversion/remarketing tags |
| Meta (Facebook) | `fbevt` type, name matching |
| LinkedIn | Type or name matching |
| TikTok | Type or name matching |
| Twitter/X | Type or name matching |
| Pinterest | Type or name matching |
| Microsoft Ads | `uet` type |
| Hotjar | Type or name matching |
| HubSpot | Name matching |
| Custom HTML | `html`, `customhtml` types |

---

## Programmatic Usage

```javascript
import { parseContainer, auditContainer, formatMarkdown } from "@dishine/tag-auditor";
import { readFileSync } from "fs";

const raw = JSON.parse(readFileSync("container.json", "utf-8"));
const container = parseContainer(raw);
const audit = auditContainer(container, {
  minSeverity: "medium",
  namingConfig: { separator: " - ", segments: ["platform", "type", "detail"] },
});

console.log(formatMarkdown({ container, audit }));

// Access raw data
console.log(audit.scores);       // { overall, governance, consent, security, performance }
console.log(audit.issues);       // Array of issues with severity, fix instructions
console.log(audit.summary);      // Platform breakdown, issue counts
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No critical issues |
| `1` | Critical issues found |
| `2` | Fatal error (invalid file) |

---

## Requirements

- **Node.js** 18 or later
- **Zero dependencies** -- pure JSON parsing, no external packages

---

## License

MIT License -- see [LICENSE](LICENSE) for details.

Copyright (c) 2026 [diShine Digital Agency](https://dishine.it)
