function normalizeUrl(url) {
    try {
      const parsed = new URL(url);
  
      parsed.hash = "";
  
      // Remove common tracking parameters
      const trackingParams = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "ref",
      ];
  
      trackingParams.forEach((param) => {
        parsed.searchParams.delete(param);
      });
  
      return parsed.toString().replace(/\/$/, "");
    } catch {
      return url;
    }
  }
  
  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
  
  function classifySourceQuality(url) {
    const domain = getDomain(url);
  
    const highQualityDomains = [
      "gov",
      "edu",
      "mit.edu",
      "stanford.edu",
      "harvard.edu",
      "nature.com",
      "science.org",
      "arxiv.org",
      "who.int",
      "nasa.gov",
      "cloud.google.com",
      "aws.amazon.com",
      "microsoft.com",
      "ibm.com",
    ];
  
    const lowQualityDomains = [
      "scribd.com",
      "medium.com",
      "quora.com",
      "pinterest.com",
    ];
  
    if (
      highQualityDomains.some(
        (item) => domain === item || domain.endsWith(`.${item}`)
      )
    ) {
      return "high";
    }
  
    if (lowQualityDomains.some((item) => domain === item || domain.endsWith(`.${item}`))) {
      return "low";
    }
  
    return "medium";
  }
  
  export function processSources(sources = []) {
    const seenUrls = new Set();
  
    return sources
      .map((source) => {
        const normalizedUrl = normalizeUrl(source.url);
  
        return {
          ...source,
          url: normalizedUrl,
          domain: getDomain(normalizedUrl),
          sourceQuality: classifySourceQuality(normalizedUrl),
        };
      })
      .filter((source) => {
        if (!source.url || seenUrls.has(source.url)) {
          return false;
        }
  
        seenUrls.add(source.url);
        return true;
      });
  }