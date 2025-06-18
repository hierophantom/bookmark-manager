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