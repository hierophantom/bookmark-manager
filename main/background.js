/*
File name & path: main/background.js
Role: The extension rvent handler
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
