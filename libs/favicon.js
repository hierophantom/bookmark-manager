/*
File name & path: root/libs/favicon.js
Role: General favicon utility based on your working PinnedUrlShortcut solution
*/

/**
 * Extract hostname from URL with validation
 * @param {string} url - The URL to extract hostname from
 * @returns {string} - The hostname or 'invalid-url' if invalid
 */
function extractHostname(url) {
  try {
    // First, try to create a proper URL
    let testUrl;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      testUrl = url;
    } else {
      testUrl = `https://${url}`;
    }
    
    const urlObj = new URL(testUrl);
    
    // Additional validation - check if hostname is valid
    const hostname = urlObj.hostname.replace('www.', '');
    
    // Basic hostname validation (must contain at least one dot and valid characters)
    if (hostname.includes('.') && /^[a-zA-Z0-9.-]+$/.test(hostname)) {
      return hostname;
    } else {
      return 'invalid-url'; // This will show a default icon
    }
  } catch (e) {
    return 'invalid-url'; // This will show a default icon
  }
}

/**
 * Generate favicon HTML with SVG fallback
 * @param {string} url - The URL to get favicon for
 * @param {string} name - Alt text for the image
 * @param {Object} options - Configuration options
 * @param {number} options.size - Size for the fallback SVG (default: 24)
 * @param {string} options.fallbackIcon - Icon ID for fallback (default: 'globe-icon')
 * @returns {string} - HTML string with img and fallback SVG
 */
function createFaviconHtml(url, name = '', options = {}) {
  const { size = 24, fallbackIcon = 'globe-icon' } = options;
  
  if (!url) {
    return `<svg viewBox="0 0 40 40><use href="#${fallbackIcon}" /></svg>`;
  }
  
  const hostname = extractHostname(url);
  
  let faviconUrl;
  let fallbackSvg = `<svg width="${size}" height="${size}" viewBox="0 0 40 40"><use href="#${fallbackIcon}" /></svg>`;
  
  if (hostname === 'invalid-url') {
    return fallbackSvg;
  } else {
    faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    
    return `<img src="${faviconUrl}" alt="${name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
            <span style="display:none;">${fallbackSvg}</span>`;
  }
}

/**
 * Get just the favicon URL (for cases where you only need the URL)
 * @param {string} url - The URL to get favicon for
 * @returns {string|null} - Favicon URL or null for invalid URLs
 */
function getFaviconUrl(url) {
  if (!url) return null;
  
  const hostname = extractHostname(url);
  
  if (hostname === 'invalid-url') {
    return null;
  }
  
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.FaviconUtils = {
    extractHostname,
    createFaviconHtml,
    getFaviconUrl
  };
}

// Export for modules
export {
  extractHostname,
  createFaviconHtml,
  getFaviconUrl
};