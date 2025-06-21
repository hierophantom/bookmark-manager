/*
File name & path: root/main/background.js
Role: Chrome extension service worker handling extension lifecycle, bookmark/tab sync, and API message routing
Method: Listens for bookmark/tab changes and broadcasts to extension pages, handles API requests for bookmarks/tab groups, manages extension installation and updates
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
