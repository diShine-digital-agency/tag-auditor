# tag-auditor

**GTM containers get messy fast. This tool reads your container export and tells you exactly what's wrong.**

Tags pile up, consent settings get missed, someone adds a "test" tag that never gets removed, and three months later nobody remembers why half the custom HTML exists. tag-auditor parses a GTM container JSON export and runs 14 checks across governance, consent, security, performance, and naming. You get scores (0-100) in four areas and a list of issues sorted by severity, each with a specific fix.

Zero dependencies. It just parses JSON -- no network requests, no browser, no build step.

Built by [diShine](https://dishine.it)

---

## Quick start

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

Or run it without installing:

```bash
npx @dishine/tag-auditor container.json
```

---

## How to get your GTM container export

1. Open [tagmanager.google.com](https://tagmanager.google.com)
2. Select your container
3. Go to **Admin** (gear icon)
4. Click **Export Container**
5. Choose a version (or the current workspace)
6. Save the `.json` file
7. Run: `tag-auditor exported-file.json`

---

## What the output looks like

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

## The 14 audit checks

| # | Check | Category | What it finds |
|---|-------|----------|---------------|
| 1 | Unused tags | unused | tags with no triggers -- they never fire |
| 2 | Unused triggers | unused | triggers not attached to any tag |
| 3 | Unused variables | unused | variables not referenced anywhere |
| 4 | Duplicate tags | duplicates | same type + configuration = double counting |
| 5 | Paused tags | governance | dead weight sitting in the container |
| 6 | Consent configuration | consent | tracking tags without GDPR consent settings |
| 7 | Consent management | consent | no CMP detected (Consent Mode v2) |
| 8 | Custom HTML security | security | dangerous patterns, insecure HTTP scripts |
| 9 | Performance | performance | too many tags, large custom HTML, All Pages overload |
| 10 | Deprecated types | deprecated | Universal Analytics, Classic GA, DoubleClick |
| 11 | Folder organization | governance | no folders, unorganized tags |
| 12 | Schedule issues | governance | expired campaign schedules nobody cleaned up |
| 13 | Blocking triggers | governance | no internal traffic filtering |
| 14 | Tag sequencing | configuration | GA4 events firing without a config tag |

Plus naming convention checks (either basic heuristics or your own custom rules).

### Scoring (0-100 per area)

| Area | What it measures |
|------|-----------------|
| **Governance** | organization, naming, unused items, paused tags |
| **Consent** | GDPR consent configuration, CMP presence |
| **Security** | custom HTML risks, insecure scripts |
| **Performance** | container size, tag count, All Pages load |

### Issue severity

| Level | Examples |
|-------|----------|
| **critical** | tracking tags without consent, dangerous code patterns |
| **high** | unused tags, deprecated types, insecure scripts, missing CMP |
| **medium** | duplicate tags, naming violations, large custom HTML |
| **low** | paused tags, unused triggers/variables, missing folders |

---

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format` | output: `table`, `json`, `markdown`, `csv` | `table` |
| `-o, --output` | save report to file | stdout |
| `-s, --severity` | minimum severity: `critical`, `high`, `medium`, `low` | `low` |
| `--naming` | custom naming convention rules (JSON file) | basic checks |
| `-q, --quiet` | suppress progress messages | off |

---

## Custom naming conventions

If your team has a naming standard (and you should), you can enforce it. Create a JSON file with your rules:

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

Tags that don't follow the convention get flagged:
- `"FB Pixel"` -- violation (should be `"Meta - Pageview - All Pages"`)
- `"GA4 - Event - Form Submit"` -- passes

---

## Platform detection

tag-auditor automatically recognizes tags from these platforms:

| Platform | How it's detected |
|----------|-------------------|
| GA4 | `gaawc`, `gaawe`, `googtag` types |
| Universal Analytics | `ua` type (flagged as deprecated) |
| Google Ads | `awct`, conversion/remarketing tags |
| Meta (Facebook) | `fbevt` type, name matching |
| LinkedIn | type or name matching |
| TikTok | type or name matching |
| Twitter/X | type or name matching |
| Pinterest | type or name matching |
| Microsoft Ads | `uet` type |
| Hotjar | type or name matching |
| HubSpot | name matching |
| Custom HTML | `html`, `customhtml` types |

---

## Programmatic usage

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
console.log(audit.issues);       // array of issues with severity and fix instructions
console.log(audit.summary);      // platform breakdown, issue counts
```

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | no critical issues |
| `1` | critical issues found |
| `2` | fatal error (invalid file) |

---

## Requirements

- **Node.js** 18 or later
- That's it. Zero dependencies -- pure JSON parsing, no external packages.

---

## License

MIT License -- see [LICENSE](LICENSE) for details.

Copyright (c) 2026 [diShine](https://dishine.it)
