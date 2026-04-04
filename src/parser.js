/**
 * Parses a GTM container export JSON into a structured representation.
 *
 * GTM container exports have two formats:
 * 1. Direct export: { containerVersion: { tag: [], trigger: [], variable: [], ... } }
 * 2. Workspace export: { containerVersion: { ... }, ... }
 *
 * This parser normalizes both into a consistent structure.
 */

export function parseContainer(raw) {
  // Find the container version data
  let cv = null;

  if (raw.containerVersion) {
    cv = raw.containerVersion;
  } else if (raw.container && raw.containerVersion) {
    cv = raw.containerVersion;
  } else if (Array.isArray(raw)) {
    // Some exports are wrapped in an array
    const first = raw[0];
    if (first && first.containerVersion) cv = first.containerVersion;
  }

  if (!cv) {
    // Try treating the raw object itself as a container version
    if (raw.tag || raw.trigger || raw.variable) {
      cv = raw;
    } else {
      return null;
    }
  }

  const tags = (cv.tag || []).map(parseTag);
  const triggers = (cv.trigger || []).map(parseTrigger);
  const variables = (cv.variable || []).map(parseVariable);
  const builtInVariables = (cv.builtInVariable || []).map((v) => ({
    type: v.type || "unknown",
    name: v.name || v.type || "unknown",
  }));
  const folders = (cv.folder || []).map((f) => ({
    id: f.folderId || f.accountId || "unknown",
    name: f.name || "Unnamed Folder",
  }));
  const customTemplates = (cv.customTemplate || []).map((t) => ({
    id: t.templateId || "unknown",
    name: t.name || "Unnamed Template",
  }));

  // Container metadata
  const containerInfo = cv.container || raw.container || {};

  return {
    name: containerInfo.name || containerInfo.publicId || "Unknown Container",
    publicId: containerInfo.publicId || "",
    containerId: containerInfo.containerId || "",
    accountId: containerInfo.accountId || containerInfo.accountId || "",
    fingerprint: cv.fingerprint || "",
    tagManagerUrl: containerInfo.tagManagerUrl || "",
    containerVersionId: cv.containerVersionId || "",
    tags,
    triggers,
    variables,
    builtInVariables,
    folders,
    customTemplates,
    stats: {
      totalTags: tags.length,
      totalTriggers: triggers.length,
      totalVariables: variables.length,
      totalFolders: folders.length,
      totalCustomTemplates: customTemplates.length,
    },
  };
}

function parseTag(tag) {
  const params = extractParams(tag.parameter || []);
  const firingTriggerIds = tag.firingTriggerId || [];
  const blockingTriggerIds = tag.blockingTriggerId || [];
  const setupTagIds = (tag.setupTag || []).map((t) => t.tagName || t.tag || "");
  const teardownTagIds = (tag.teardownTag || []).map((t) => t.tagName || t.tag || "");

  // Detect tag type
  const tagType = tag.type || "unknown";
  const platform = detectPlatform(tagType, tag.name || "", params);

  return {
    id: tag.tagId || "",
    name: tag.name || "Unnamed Tag",
    type: tagType,
    platform,
    firingTriggerIds,
    blockingTriggerIds,
    setupTagIds,
    teardownTagIds,
    paused: tag.paused === "true" || tag.paused === true,
    consentSettings: parseConsentSettings(tag),
    monitoringMetadata: tag.monitoringMetadata || null,
    liveOnly: tag.liveOnly === "true" || tag.liveOnly === true,
    scheduleStartMs: tag.scheduleStartMs || null,
    scheduleEndMs: tag.scheduleEndMs || null,
    folderId: tag.parentFolderId || null,
    fingerprint: tag.fingerprint || "",
    params,
    rawType: tagType,
  };
}

function parseTrigger(trigger) {
  const conditions = [
    ...(trigger.filter || []).map(parseCondition),
    ...(trigger.autoEventFilter || []).map(parseCondition),
    ...(trigger.customEventFilter || []).map(parseCondition),
  ];

  return {
    id: trigger.triggerId || "",
    name: trigger.name || "Unnamed Trigger",
    type: trigger.type || "unknown",
    conditions,
    folderId: trigger.parentFolderId || null,
    fingerprint: trigger.fingerprint || "",
  };
}

function parseVariable(variable) {
  const params = extractParams(variable.parameter || []);

  return {
    id: variable.variableId || "",
    name: variable.name || "Unnamed Variable",
    type: variable.type || "unknown",
    params,
    folderId: variable.parentFolderId || null,
    fingerprint: variable.fingerprint || "",
    formatValue: variable.formatValue || null,
  };
}

function parseCondition(filter) {
  return {
    type: filter.type || "",
    parameter: (filter.parameter || []).map((p) => ({
      type: p.type || "",
      key: p.key || "",
      value: p.value || "",
    })),
  };
}

function parseConsentSettings(tag) {
  if (!tag.consentSettings) return null;

  const cs = tag.consentSettings;
  return {
    consentStatus: cs.consentStatus || "notSet",
    consentType: cs.consentType || null,
    requiredConsents: extractListParam(cs, "consentTypeList") || [],
    additionalConsents: extractListParam(cs, "additionalConsentTypeList") || [],
  };
}

function extractListParam(obj, key) {
  if (!obj[key]) return null;
  const list = obj[key];
  if (Array.isArray(list)) return list;
  if (list.list) return list.list.map((item) => item.value || item);
  return null;
}

function extractParams(paramArray) {
  const result = {};
  for (const p of paramArray) {
    const key = p.key || p.type || "unknown";
    if (p.list) {
      result[key] = p.list.map((item) => {
        if (item.map) {
          const mapObj = {};
          for (const m of item.map) {
            mapObj[m.key] = m.value;
          }
          return mapObj;
        }
        return item.value || item;
      });
    } else if (p.map) {
      const mapObj = {};
      for (const m of p.map) {
        mapObj[m.key] = m.value;
      }
      result[key] = mapObj;
    } else {
      result[key] = p.value || "";
    }
  }
  return result;
}

function detectPlatform(type, name, params) {
  const typeLower = (type || "").toLowerCase();
  const nameLower = (name || "").toLowerCase();

  // Google Analytics 4
  if (typeLower.includes("gaawc") || typeLower.includes("gaawe") || typeLower === "googtag") return "GA4";
  if (typeLower.includes("ua") && !typeLower.includes("custom")) return "Universal Analytics";

  // Google Ads
  if (typeLower.includes("awct") || typeLower.includes("google_ads") || typeLower.includes("gclidw")) return "Google Ads";
  if (typeLower.includes("adwords") || typeLower.includes("google_adwords")) return "Google Ads";
  if (typeLower.includes("flc") || typeLower.includes("floodlight")) return "Floodlight";

  // Meta / Facebook
  if (typeLower.includes("facebook") || typeLower.includes("fbevt") || typeLower.includes("meta")) return "Meta";
  if (nameLower.includes("facebook") || nameLower.includes("meta pixel") || nameLower.includes("fb ")) return "Meta";

  // LinkedIn
  if (typeLower.includes("linkedin") || nameLower.includes("linkedin")) return "LinkedIn";

  // TikTok
  if (typeLower.includes("tiktok") || nameLower.includes("tiktok")) return "TikTok";

  // Twitter / X
  if (typeLower.includes("twitter") || nameLower.includes("twitter")) return "Twitter/X";

  // Pinterest
  if (typeLower.includes("pinterest") || nameLower.includes("pinterest")) return "Pinterest";

  // Hotjar
  if (typeLower.includes("hotjar") || nameLower.includes("hotjar")) return "Hotjar";

  // Microsoft / Bing
  if (typeLower.includes("bing") || typeLower.includes("microsoft") || typeLower.includes("uet")) return "Microsoft Ads";

  // Custom HTML
  if (typeLower === "html" || typeLower === "customhtml") return "Custom HTML";

  // Custom Image (pixel)
  if (typeLower === "img" || typeLower === "customimg") return "Custom Image";

  // Consent
  if (typeLower.includes("consent") || nameLower.includes("consent") || nameLower.includes("cookie")) return "Consent";

  // GTM internal
  if (typeLower.includes("ogt") || typeLower.includes("lcet")) return "GTM";

  // Try name-based detection
  if (nameLower.includes("ga4")) return "GA4";
  if (nameLower.includes("google ads") || nameLower.includes("gads")) return "Google Ads";
  if (nameLower.includes("snapchat") || nameLower.includes("snap")) return "Snapchat";
  if (nameLower.includes("hubspot")) return "HubSpot";
  if (nameLower.includes("intercom")) return "Intercom";
  if (nameLower.includes("segment")) return "Segment";
  if (nameLower.includes("mixpanel")) return "Mixpanel";
  if (nameLower.includes("amplitude")) return "Amplitude";
  if (nameLower.includes("clarity")) return "Microsoft Clarity";

  return "Other";
}
