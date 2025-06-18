/*
File name & path: main/background.js
Role: The extension event handler (Manifest V3 compatible)
*/

// This will handle the extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('main/main.html')
  });
});

// Optional: This will ensure the new tab page is loaded properly
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.pendingUrl === "chrome://newtab/" || tab.url === "chrome://newtab/") {
    chrome.tabs.update(tab.id, {
      url: chrome.runtime.getURL('main/main.html')
    });
  }
});

/* –––––––––––––––––––––––––––
  BACKGROUND SERVICE WORKER
––––––––––––––––––––––––––– */

// Extension installation and update handling
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Bookmark Visualizer installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // First time installation
    console.log('First time installation - setting up defaults');
    
    // Set default settings if needed
    chrome.storage.local.set({
      'firstRun': true,
      'version': chrome.runtime.getManifest().version
    });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome started - Bookmark Visualizer ready');
});

// Handle bookmark changes for real-time sync
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  // Broadcast to open extension instances
  notifyExtensionPages('bookmarkCreated', { id, bookmark });
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  notifyExtensionPages('bookmarkRemoved', { id, removeInfo });
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  notifyExtensionPages('bookmarkChanged', { id, changeInfo });
});

chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
  notifyExtensionPages('bookmarkMoved', { id, moveInfo });
});

// Handle tab group changes for real-time sync
chrome.tabGroups.onCreated.addListener((group) => {
  notifyExtensionPages('tabGroupCreated', { group });
});

chrome.tabGroups.onRemoved.addListener((group) => {
  notifyExtensionPages('tabGroupRemoved', { group });
});

chrome.tabGroups.onUpdated.addListener((group) => {
  notifyExtensionPages('tabGroupUpdated', { group });
});

// Handle tab changes that affect groups
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.groupId !== -1) {
    notifyExtensionPages('tabAddedToGroup', { tab });
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  notifyExtensionPages('tabRemoved', { tabId, removeInfo });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.groupId !== -1 && (changeInfo.title || changeInfo.url || changeInfo.favIconUrl)) {
    notifyExtensionPages('tabInGroupUpdated', { tabId, changeInfo, tab });
  }
});

/* –––––––––––––––––––––––––––
  UTILITY FUNCTIONS
––––––––––––––––––––––––––– */

// Notify all open extension pages about changes (Manifest V3 compatible)
async function notifyExtensionPages(event, data) {
  try {
    // In Manifest V3, we need to use chrome.runtime.sendMessage to communicate
    // with extension pages since chrome.extension.getViews() is deprecated
    
    // Send message to all extension contexts
    chrome.runtime.sendMessage({
      type: 'backgroundEvent',
      event: event,
      data: data
    }).catch(() => {
      // Ignore errors if no listeners are available
      // This is normal when the extension page isn't open
    });
    
    // Also try to communicate with any open tabs that might be our extension
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('*') });
    
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'backgroundEvent',
          event: event,
          data: data
        });
      } catch (error) {
        // Ignore errors - tab might not have content script or might be loading
      }
    }
  } catch (error) {
    console.error('Error notifying extension pages:', error);
  }
}

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getBookmarks':
      handleGetBookmarks(sendResponse);
      return true; // Keep message channel open for async response
      
    case 'getTabGroups':
      handleGetTabGroups(sendResponse);
      return true;
      
    case 'createBookmark':
      handleCreateBookmark(request.data, sendResponse);
      return true;
      
    case 'updateTabGroup':
      handleUpdateTabGroup(request.data, sendResponse);
      return true;
      
    default:
      // Don't log backgroundEvent messages as they're internal
      if (request.type !== 'backgroundEvent') {
        console.log('Unknown action:', request.action);
        sendResponse({ error: 'Unknown action' });
      }
  }
});

/* –––––––––––––––––––––––––––
  API HANDLERS
––––––––––––––––––––––––––– */

async function handleGetBookmarks(sendResponse) {
  try {
    const tree = await chrome.bookmarks.getTree();
    sendResponse({ success: true, data: tree });
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetTabGroups(sendResponse) {
  try {
    const groups = await chrome.tabGroups.query({});
    sendResponse({ success: true, data: groups });
  } catch (error) {
    console.error('Error getting tab groups:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCreateBookmark(data, sendResponse) {
  try {
    const bookmark = await chrome.bookmarks.create(data);
    sendResponse({ success: true, data: bookmark });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUpdateTabGroup(data, sendResponse) {
  try {
    const { groupId, ...updateData } = data;
    const group = await chrome.tabGroups.update(groupId, updateData);
    sendResponse({ success: true, data: group });
  } catch (error) {
    console.error('Error updating tab group:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/* –––––––––––––––––––––––––––
  AUTO-SAVE TAB GROUPS SYSTEM
––––––––––––––––––––––––––– */

// Enhanced background.js code to add
chrome.tabGroups.onRemoved.addListener(async (group) => {
  console.log('Tab group removed, auto-saving:', group);
  
  try {
    // Get existing saved groups
    const result = await chrome.storage.local.get('savedTabGroups');
    const savedGroups = result.savedTabGroups || [];
    
    // Create saved group object
    const savedGroup = {
      id: `auto-saved-${Date.now()}`,
      originalId: group.id,
      title: group.title || `Untitled Group ${Date.now()}`,
      color: group.color || 'grey',
      dateSaved: new Date().toISOString(),
      wasActive: true,
      isAutoSaved: true,
      tabs: [], // We'll try to get tabs before the group is fully removed
      windowId: group.windowId
    };
    
    // Try to get tabs that were in this group (may not work if tabs were already closed)
    try {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      if (tabs.length > 0) {
        savedGroup.tabs = tabs.map(tab => ({
          title: tab.title || 'Untitled Tab',
          url: tab.url,
          favIconUrl: tab.favIconUrl,
          index: tab.index
        }));
      }
    } catch (error) {
      console.log('Could not get tabs for removed group (they may have been closed)');
      // If we can't get the tabs, we'll save the group anyway with empty tabs
      // You could also skip saving if no tabs are found
    }
    
    // Check if we already have this group saved
    const existingIndex = savedGroups.findIndex(g => 
      g.originalId === group.id || 
      (g.title === group.title && g.color === group.color)
    );
    
    if (existingIndex >= 0) {
      // Update existing
      savedGroups[existingIndex] = { ...savedGroups[existingIndex], ...savedGroup };
    } else {
      // Add new
      savedGroups.push(savedGroup);
    }
    
    // Limit saved groups to prevent storage bloat (keep last 50)
    if (savedGroups.length > 50) {
      savedGroups.splice(0, savedGroups.length - 50);
    }
    
    // Save to storage
    await chrome.storage.local.set({ savedTabGroups: savedGroups });
    
    console.log('Tab group auto-saved:', savedGroup);
    
    // Notify extension pages
    notifyExtensionPages('tabGroupAutoSaved', { group: savedGroup });
    
  } catch (error) {
    console.error('Error auto-saving tab group:', error);
  }
});

// Enhanced TabGroupManager to include better auto-save tracking
class EnhancedTabGroupManager extends TabGroupManager {
  constructor(containerSelector) {
    super(containerSelector);
    this.setupPeriodicSave();
  }
  
  setupPeriodicSave() {
    // Periodically save active tab groups (every 30 seconds)
    setInterval(async () => {
      await this.saveAllActiveGroups();
    }, 30000);
    
    // Save when page unloads
    window.addEventListener('beforeunload', () => {
      this.saveAllActiveGroups();
    });
  }
  
  async saveAllActiveGroups() {
    if (!this.chromeService.isExtensionContext) return;
    
    try {
      const activeGroups = await this.chromeService.getAllTabGroups();
      
      for (const group of activeGroups) {
        const tabs = await this.chromeService.getTabsInGroup(group.id);
        if (tabs.length > 0) {
          await this.chromeService.saveTabGroup(group, tabs);
        }
      }
    } catch (error) {
      console.error('Error in periodic save:', error);
    }
  }
}

/* –––––––––––––––––––––––––––
  ERROR HANDLING
––––––––––––––––––––––––––– */

// Global error handler
self.addEventListener('error', (event) => {
  console.error('Background script error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in background:', event.reason);
});

console.log('Bookmark Visualizer background script loaded');