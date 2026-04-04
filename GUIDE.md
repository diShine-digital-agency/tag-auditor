# tag-auditor -- User Guide

**A step-by-step guide to auditing your Google Tag Manager containers.**

You don't need to be a developer to use tag-auditor. This guide walks you through everything.

---

## Table of Contents

1. [What Does This Tool Do?](#1-what-does-this-tool-do)
2. [Installation](#2-installation)
3. [Getting Your GTM Container File](#3-getting-your-gtm-container-file)
4. [Running Your First Audit](#4-running-your-first-audit)
5. [Understanding the Report](#5-understanding-the-report)
6. [Saving Reports](#6-saving-reports)
7. [Filtering by Severity](#7-filtering-by-severity)
8. [Custom Naming Conventions](#8-custom-naming-conventions)
9. [All Options Explained](#9-all-options-explained)
10. [Common Issues Explained](#10-common-issues-explained)
11. [Troubleshooting](#11-troubleshooting)
12. [FAQ](#12-faq)

---

## 1. What Does This Tool Do?

Google Tag Manager (GTM) is used by most websites to manage tracking tags -- Google Analytics, Meta Pixel, LinkedIn Insight Tag, etc. Over time, GTM containers become messy:

- Tags that were added for a campaign but never removed
- Tags with no triggers (they never fire)
- Tracking tags that fire without user consent (GDPR violation)
- Inconsistent naming that makes the container hard to maintain
- Deprecated tags (like Universal Analytics, which sunset in July 2024)
- Security risks in Custom HTML tags

tag-auditor takes your GTM container export (a JSON file) and finds all of these problems in seconds. It gives you:

- **Scores** (0-100) across 4 areas: Governance, Consent, Security, Performance
- **Issues** with severity levels (Critical, High, Medium, Low)
- **Fixes** telling you exactly what to do for each issue

---

## 2. Installation

### What you need

- **Node.js 18 or later** on your computer
  - Check: open a terminal and run `node --version`
  - If not installed: download from [nodejs.org](https://nodejs.org) (choose LTS)

### Install

```bash
npm install -g @dishine/tag-auditor
```

### Or run without installing

```bash
npx @dishine/tag-auditor container.json
```

---

## 3. Getting Your GTM Container File

tag-auditor needs a GTM container export -- a JSON file you download from Google Tag Manager.

### Step-by-step

1. Go to [tagmanager.google.com](https://tagmanager.google.com)
2. Log in with your Google account
3. Click on the **container** you want to audit
4. Click the **Admin** tab (gear icon in the top navigation)
5. In the "Container" column, click **Export Container**
6. Choose which version to export:
   - **Current workspace** -- your unpublished changes
   - **A specific version** -- what's currently live, or a past version
7. Click **Export** -- a `.json` file will download
8. That file is what you feed to tag-auditor

### Can't find the export option?

You need at least **"Read"** access to the GTM container. If you don't see the Export option, ask your GTM admin to either grant you access or export the file for you.

### What about multiple containers?

If a website uses multiple GTM containers (e.g., one for marketing, one for analytics), export and audit each one separately:

```bash
tag-auditor marketing-container.json analytics-container.json
```

---

## 4. Running Your First Audit

Once you have the JSON file, open your terminal and run:

```bash
tag-auditor path/to/container.json
```

For example:

```bash
tag-auditor ~/Downloads/GTM-XXXXX_v42.json
```

### What you'll see

The report shows:

1. **Scores** -- 4 area scores plus an overall score
2. **Container overview** -- how many tags, triggers, and variables
3. **Tags by platform** -- breakdown by GA4, Meta, LinkedIn, etc.
4. **Issues** -- sorted by severity, with fix instructions

---

## 5. Understanding the Report

### Scores

| Score | Area | What it measures |
|-------|------|-----------------|
| **Governance** | Organization, naming, unused items, maintenance hygiene |
| **Consent** | GDPR compliance -- do tracking tags respect consent? |
| **Security** | Are Custom HTML tags safe? Any insecure scripts? |
| **Performance** | Container size, tag count, how many fire on every page |
| **Overall** | Weighted average of all four |

**Score interpretation:**

| Range | Rating |
|-------|--------|
| 90-100 | Excellent -- minor tweaks only |
| 70-89 | Good -- a few improvements needed |
| 50-69 | Fair -- several issues to address |
| 0-49 | Poor -- needs immediate attention |

### Issue Severity

| Severity | What it means | Action |
|----------|--------------|--------|
| **Critical** | Likely violates GDPR or poses security risk | Fix immediately |
| **High** | Significant problem affecting tracking quality | Fix soon |
| **Medium** | Best practice violation | Plan to fix |
| **Low** | Minor improvement opportunity | Fix when convenient |

### Platform Detection

tag-auditor automatically identifies which platform each tag belongs to:

- **GA4** -- Google Analytics 4 config and event tags
- **Google Ads** -- Conversion and remarketing tags
- **Meta** -- Facebook/Instagram Pixel
- **LinkedIn** -- Insight Tag and conversion tags
- **TikTok**, **Twitter/X**, **Pinterest**, **Snapchat**
- **Hotjar**, **HubSpot**, **Mixpanel**, **Amplitude**
- **Custom HTML** -- Manually written script tags
- **Other** -- Unrecognized tag types

---

## 6. Saving Reports

### As Markdown (best for sharing with clients)

```bash
tag-auditor container.json -f markdown -o audit-report.md
```

Open the `.md` file in any text editor, Notion, or convert to PDF for client delivery.

### As JSON (for dashboards or automation)

```bash
tag-auditor container.json -f json -o audit.json
```

### As CSV (for spreadsheets)

```bash
tag-auditor container.json -f csv -o issues.csv
```

Open in Excel or Google Sheets. Each row is one issue with severity, category, and fix.

---

## 7. Filtering by Severity

If you only want to see the most important issues:

```bash
# Only critical and high
tag-auditor container.json -s high

# Only critical
tag-auditor container.json -s critical
```

The `-s` flag sets the **minimum** severity to show. Everything below that level is hidden.

---

## 8. Custom Naming Conventions

Most teams have (or should have) a naming convention for GTM tags. For example:

```
Platform - Type - Detail
```

Like:
- `GA4 - Event - Form Submit`
- `Meta - Pageview - All Pages`
- `LinkedIn - Conversion - Thank You`

### Setting up custom rules

Create a JSON file (e.g., `naming-rules.json`):

```json
{
  "separator": " - ",
  "segments": ["platform", "type", "detail"],
  "platforms": ["GA4", "Meta", "LinkedIn", "Google Ads", "GTM", "Hotjar", "TikTok"],
  "types": ["Event", "Pageview", "Config", "Conversion", "Remarketing", "Variable"]
}
```

Run with:

```bash
tag-auditor container.json --naming naming-rules.json
```

Tags that don't follow the convention will be flagged. This is great for enforcing team standards.

---

## 9. All Options Explained

| Flag | What it does | Default |
|------|-------------|---------|
| `-f, --format` | Output format: `table`, `json`, `markdown`, `csv` | `table` |
| `-o, --output` | Save to a file | Print to screen |
| `-s, --severity` | Minimum severity: `critical`, `high`, `medium`, `low` | `low` (show all) |
| `--naming` | Path to naming convention rules (JSON) | Basic name checks |
| `-q, --quiet` | No progress messages | Off |
| `-h, --help` | Show help | |
| `-v, --version` | Show version | |

### Examples

```bash
# Basic audit
tag-auditor container.json

# Save as Markdown
tag-auditor container.json -f markdown -o report.md

# Only high+ severity, quiet mode
tag-auditor container.json -s high -q

# With naming convention enforcement
tag-auditor container.json --naming naming-rules.json

# Audit two containers at once
tag-auditor container1.json container2.json -f json -o combined.json
```

---

## 10. Common Issues Explained

### "No consent configuration" (Critical)

**What it means:** A tracking tag (GA4, Meta, LinkedIn, etc.) has no consent settings configured.

**Why it matters:** Under GDPR, tracking tags must wait for user consent before firing. Without consent configuration, the tag fires for everyone -- including users who haven't accepted cookies.

**How to fix:**
1. Open GTM
2. Edit the tag
3. Go to **Advanced Settings** > **Consent Settings**
4. Select **"Require additional consent for tag to fire"**
5. Add the relevant consent types:
   - `analytics_storage` for analytics tags (GA4, Hotjar, etc.)
   - `ad_storage` for advertising tags (Meta, Google Ads, LinkedIn, etc.)

### "No consent management tag detected" (High)

**What it means:** The container has tracking tags but no Consent Management Platform (CMP) integration.

**Why it matters:** Since March 2024, Google requires Consent Mode v2 for EU traffic. Without it, your Google Ads data will be limited.

**How to fix:** Add a CMP tag to GTM (Cookiebot, OneTrust, CookieYes, or similar) and configure Google Consent Mode v2.

### "Tag has no firing triggers" (High)

**What it means:** A tag exists in the container but has no trigger attached -- it will never fire.

**Why it matters:** Dead tags add weight to the container (bigger download, slower page load) and create confusion for team members.

**How to fix:** Either add a trigger (if the tag should fire) or delete the tag.

### "Deprecated tag type" (High)

**What it means:** The container uses a tag type that's been retired -- most commonly Universal Analytics (sunset July 2024).

**How to fix:** Replace with the current equivalent. For UA, migrate to GA4.

### "HTTP (non-secure) script in Custom HTML" (High)

**What it means:** A Custom HTML tag loads a script over plain HTTP instead of HTTPS.

**Why it matters:** Mixed content (HTTPS page loading HTTP resources) triggers browser warnings, may be blocked entirely, and is vulnerable to interception.

**How to fix:** Change `http://` to `https://` in the script URL.

### "Inconsistent naming convention" (Medium)

**What it means:** Tags use different separators or naming patterns (some use " - ", others use " | " or " / ").

**How to fix:** Pick one convention and apply it across all tags. The most common is `Platform - Type - Detail`.

### "Paused tag" (Low)

**What it means:** A tag is paused (disabled) but still in the container.

**How to fix:** If you don't need it anymore, delete it. If it's temporary, set a reminder to review it.

---

## 11. Troubleshooting

### "Does not appear to be a valid GTM container export"

**Cause:** The file is not a standard GTM container export JSON.
**Fix:** Make sure you exported from GTM using Admin > Export Container. The file should contain a `containerVersion` object with `tag`, `trigger`, and `variable` arrays.

### "Invalid JSON"

**Cause:** The file is corrupted or truncated.
**Fix:** Re-export from GTM. Make sure the download completed fully.

### "File not found"

**Cause:** Wrong file path.
**Fix:** Use the full path to the file, or navigate to the directory first:
```bash
cd ~/Downloads
tag-auditor GTM-XXXXX_v42.json
```

### No issues found but container seems messy

**Cause:** tag-auditor may not catch every possible issue.
**Tips:** Try adding a naming convention file (`--naming`) to enforce stricter standards. Also manually review Custom HTML tags for outdated code.

---

## 12. FAQ

**Q: Does this tool connect to my GTM account?**
A: No. It only reads the JSON file you provide. It never connects to Google servers or modifies anything in your GTM account.

**Q: Is it safe to share the container JSON with a colleague?**
A: The container export contains your tag configurations, tracking IDs (like GA4 measurement IDs or Meta Pixel IDs), and custom code. These are not secrets (they're visible in your website's source code), but treat them with reasonable care.

**Q: Can I audit someone else's container?**
A: Yes, if they give you the exported JSON file. You need "Read" access to export from GTM, or the container admin can export and share the file.

**Q: How often should I audit my GTM container?**
A: Monthly is ideal for active containers. At minimum: before major launches, after adding new tags, and quarterly as a maintenance check.

**Q: Can I use this in my CI/CD pipeline?**
A: Yes. Exit code 0 = no critical issues, exit code 1 = critical issues found. Use it as a gate before deployment:
```bash
tag-auditor container.json -s critical -q || echo "GTM audit failed"
```

**Q: Zero dependencies? Really?**
A: Yes. tag-auditor only uses Node.js built-in modules (`fs`, `path`). No `npm install` needed beyond the tool itself. The GTM container is pure JSON, so no special parsing libraries are needed.

**Q: Does it support GTM 360 (enterprise)?**
A: Yes. The container export format is the same for standard and 360 accounts.

---

*Built by [diShine Digital Agency](https://dishine.it). MIT License.*
