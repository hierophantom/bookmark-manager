/*
Robust favicon.js - Catch-all system with proven services
*/

/**
 * Extract hostname from URL with validation, preserving important subdomains
 * @param {string} url - The URL to extract hostname from
 * @returns {string} - The hostname or 'invalid-url' if invalid
 */
function extractHostname(url) {
    try {
        let testUrl;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            testUrl = url;
        } else {
            testUrl = `https://${url}`;
        }
        
        const urlObj = new URL(testUrl);
        let hostname = urlObj.hostname.toLowerCase();
        
        // Only remove www. prefix, but preserve other important subdomains
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }
        
        // Basic hostname validation (must contain at least one dot and valid characters)
        if (hostname.includes('.') && /^[a-zA-Z0-9.-]+$/.test(hostname)) {
            return hostname;
        } else {
            return 'invalid-url';
        }
    } catch (e) {
        return 'invalid-url';
    }
}

/**
 * Get multiple favicon URL options with proven reliable services
 * @param {string} hostname - The hostname to get favicons for
 * @returns {Array<string>} - Array of favicon URLs to try
 */
function getFaviconUrls(hostname) {
    if (hostname === 'invalid-url') return [];
    
    const urls = [];
    
    // Strategy 1: Proven reliable services with good quality and coverage
    urls.push(`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`);
    urls.push(`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`);
    urls.push(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);
    
    // Strategy 2: Try additional reliable public services
    urls.push(`https://api.faviconkit.com/${hostname}/64`);
    urls.push(`https://api.faviconkit.com/${hostname}/32`);
    
    // Strategy 3: High-quality direct paths that many sites use
    urls.push(`https://${hostname}/apple-touch-icon.png`);
    urls.push(`https://${hostname}/favicon-96x96.png`);
    urls.push(`https://${hostname}/favicon-64x64.png`);
    urls.push(`https://${hostname}/favicon-32x32.png`);
    
    // Strategy 4: For subdomains, try parent domain with all services
    const parts = hostname.split('.');
    if (parts.length > 2) {
        const parentDomain = parts.slice(-2).join('.');
        
        // Services for parent domain
        urls.push(`https://www.google.com/s2/favicons?domain=${parentDomain}&sz=64`);
        urls.push(`https://www.google.com/s2/favicons?domain=${parentDomain}&sz=32`);
        urls.push(`https://icons.duckduckgo.com/ip3/${parentDomain}.ico`);
        urls.push(`https://api.faviconkit.com/${parentDomain}/64`);
        
        // Direct paths for parent domain
        urls.push(`https://${parentDomain}/apple-touch-icon.png`);
        urls.push(`https://${parentDomain}/favicon-32x32.png`);
    }
    
    // Strategy 5: Standard fallback paths
    urls.push(`https://${hostname}/favicon.png`);
    urls.push(`https://${hostname}/favicon.ico`);
    
    return urls;
}

/**
 * Generate favicon HTML with reliable fallback system
 * @param {string} url - The URL to get favicon for
 * @param {string} name - Alt text for the image
 * @returns {string} - HTML string with img and fallback handling
 */
function createFaviconHtml(url, name = '') {
    if (!url) {
        return `<svg width="40" height="40" viewBox="0 0 40 40"><use href="#globe-icon" /></svg>`;
    }
    
    const hostname = extractHostname(url);
    const fallbackSvg = `<svg width="40" height="40" viewBox="0 0 40 40"><use href="#globe-icon" /></svg>`;
    
    if (hostname === 'invalid-url') {
        return fallbackSvg;
    }
    
    const faviconUrls = getFaviconUrls(hostname);
    
    if (faviconUrls.length === 0) {
        return fallbackSvg;
    }
    
    const primaryUrl = faviconUrls[0];
    
    // Create a unique ID for this favicon element
    const uniqueId = `favicon-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store fallback data as data attributes
    const fallbackData = faviconUrls.map(url => encodeURIComponent(url)).join('|');
    
    // REMOVED: onerror="handleFaviconError(this)"
    // ADDED: data-favicon-setup="true" for automatic setup
    return `<img id="${uniqueId}" src="${primaryUrl}" alt="${name}" data-fallback-urls="${fallbackData}" data-favicon-setup="true" style="width: 40px; height: 40px;">`;
}

// Add automatic favicon error handler setup
function setupFaviconHandlers() {
    // Use event delegation to handle all favicon images
    document.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG' && e.target.dataset.faviconSetup === 'true') {
            handleFaviconError(e.target);
        }
    }, true); // Use capture phase
}

// Initialize favicon handlers when DOM is ready
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupFaviconHandlers);
    } else {
        setupFaviconHandlers();
    }
}


/**
 * Handle favicon loading errors with progressive fallback
 * @param {HTMLElement} img - The img element that failed
 */
function handleFaviconError(img) {
    const fallbackData = img.dataset.fallbackUrls;
    if (!fallbackData) {
        showFallbackSvg(img);
        return;
    }
    
    const fallbackUrls = fallbackData.split('|').map(url => decodeURIComponent(url));
    const currentSrc = img.src;
    
    // Find the next URL to try
    const currentIndex = fallbackUrls.indexOf(currentSrc);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < fallbackUrls.length) {
        const nextUrl = fallbackUrls[nextIndex];
        console.log(`Favicon failed: ${currentSrc.substring(0, 50)}... trying next option`);
        
        // Try the next URL directly for faster fallback
        img.src = nextUrl;
    } else {
        // All URLs failed, use SVG fallback
        console.log(`All favicon options exhausted, using SVG fallback`);
        showFallbackSvg(img);
    }
}

/**
 * Show SVG fallback when all favicon URLs fail
 * @param {HTMLElement} img - The img element to replace
 */
function showFallbackSvg(img) {
    img.style.display = 'none';
    const fallbackSvg = `<svg width="40" height="40" viewBox="0 0 40 40"><use href="#globe-icon" /></svg>`;
    img.insertAdjacentHTML('afterend', fallbackSvg);
}

/**
 * Debug function to test all favicon URLs for any hostname
 * @param {string} hostname - The hostname to test
 * @returns {Promise<Array>} - Array of working favicon URLs with details
 */
function debugFaviconUrls(hostname) {
    return new Promise((resolve) => {
        const urls = getFaviconUrls(hostname);
        const results = [];
        let completed = 0;
        
        console.log(`Testing ${urls.length} favicon URLs for ${hostname}:`);
        
        urls.forEach((url, index) => {
            const img = new Image();
            const startTime = Date.now();
            
            img.onload = function() {
                const loadTime = Date.now() - startTime;
                const service = getServiceName(url);
                console.log(`✅ Working (${this.width}x${this.height}, ${loadTime}ms) [${service}]`);
                results.push({ 
                    url, 
                    status: 'working', 
                    index, 
                    width: this.width, 
                    height: this.height,
                    loadTime,
                    service
                });
                completed++;
                if (completed === urls.length) {
                    resolve(results.filter(r => r.status === 'working'));
                }
            };
            
            img.onerror = () => {
                const loadTime = Date.now() - startTime;
                const service = getServiceName(url);
                console.log(`❌ Failed (${loadTime}ms) [${service}]`);
                results.push({ url, status: 'failed', index, loadTime, service });
                completed++;
                if (completed === urls.length) {
                    resolve(results.filter(r => r.status === 'working'));
                }
            };
            
            // Set timeout to avoid hanging
            setTimeout(() => {
                if (!results.find(r => r.index === index)) {
                    const service = getServiceName(url);
                    console.log(`⏰ Timeout [${service}]`);
                    results.push({ url, status: 'timeout', index, service });
                    completed++;
                    if (completed === urls.length) {
                        resolve(results.filter(r => r.status === 'working'));
                    }
                }
            }, 5000);
            
            img.src = url;
        });
    });
}

/**
 * Get service name from URL for debugging (generic)
 * @param {string} url - The favicon URL
 * @returns {string} - Service name
 */
function getServiceName(url) {
    if (url.includes('google.com/s2/favicons')) return 'Google';
    if (url.includes('icons.duckduckgo.com')) return 'DuckDuckGo';
    if (url.includes('api.faviconkit.com')) return 'FaviconKit';
    if (url.includes('apple-touch-icon')) return 'Apple Touch';
    if (url.includes('favicon-')) return 'High-res Direct';
    return 'Direct';
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
    
    const urls = getFaviconUrls(hostname);
    return urls[0] || null;
}

/**
 * Preload favicon to check if it exists before using
 * @param {string} url - The URL to get favicon for
 * @returns {Promise<string>} - Promise that resolves to working favicon URL
 */
function getWorkingFaviconUrl(url) {
    return new Promise((resolve, reject) => {
        if (!url) {
            reject('No URL provided');
            return;
        }
        
        const hostname = extractHostname(url);
        if (hostname === 'invalid-url') {
            reject('Invalid URL');
            return;
        }
        
        const faviconUrls = getFaviconUrls(hostname);
        
        const tryNextUrl = (index) => {
            if (index >= faviconUrls.length) {
                reject('No working favicon found');
                return;
            }
            
            const img = new Image();
            img.onload = () => resolve(faviconUrls[index]);
            img.onerror = () => tryNextUrl(index + 1);
            
            // Set timeout for each attempt
            setTimeout(() => {
                img.onload = img.onerror = null;
                tryNextUrl(index + 1);
            }, 3000);
            
            img.src = faviconUrls[index];
        };
        
        tryNextUrl(0);
    });
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.handleFaviconError = handleFaviconError;
    
    // FaviconUtils for any domain
    window.FaviconUtils = {
        extractHostname,
        createFaviconHtml,
        getFaviconUrl,
        getFaviconUrls,
        getWorkingFaviconUrl,
        handleFaviconError,
        debugFaviconUrls
    };
    
    // Global debug function for testing any URL
    window.testFavicon = function(url) {
        const hostname = extractHostname(url);
        console.log(`Testing favicon for: ${hostname}`);
        return debugFaviconUrls(hostname);
    };
}

// Export for modules
export {
    extractHostname,
    createFaviconHtml,
    getFaviconUrl,
    getFaviconUrls,
    getWorkingFaviconUrl,
    handleFaviconError,
    debugFaviconUrls
};