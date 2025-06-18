/*
File name & path: services/chrome-tabgroups.js
Role: Chrome Tab Groups API service with persistent saved groups
*/

/* –––––––––––––––––––––––––––
  CHROME TAB GROUPS API SERVICE
––––––––––––––––––––––––––– */

class ChromeTabGroupsService {
  constructor() {
    this.isExtensionContext = this.checkExtensionContext();
    this.listeners = new Map();
    this.storageKey = 'persistentTabGroups';
    this.setupAutoSave();
  }

  checkExtensionContext() {
    try {
      return !!(chrome && chrome.tabGroups && chrome.tabs);
    } catch (e) {
      console.warn('Chrome extension context not available:', e);
      return false;
    }
  }

  setupAutoSave() {
    if (!this.isExtensionContext) return;

    // Save groups periodically
    setInterval(() => {
      this.saveCurrentActiveGroups();
    }, 15000); // Every 15 seconds

    // Save when page unloads
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.saveCurrentActiveGroups();
      });
    }
  }

  async saveCurrentActiveGroups() {
    try {
      const activeGroups = await this.getAllTabGroups();
      
      for (const group of activeGroups) {
        const tabs = await this.getTabsInGroup(group.id);
        if (tabs.length > 0) {
          await this.updateSavedGroup(group, tabs);
        }
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }

  async updateSavedGroup(group, tabs) {
    try {
      const savedGroups = await this.getSavedTabGroups();
      
      const savedGroup = {
        id: `persistent-${group.id}`,
        originalId: group.id,
        title: group.title || 'Untitled Group',
        color: group.color || 'grey',
        collapsed: group.collapsed || false,
        dateCreated: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        isCurrentlyActive: true,
        tabs: tabs.map(tab => ({
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl,
          index: tab.index,
          active: tab.active
        }))
      };

      // Update or add the group
      const existingIndex = savedGroups.findIndex(g => g.originalId === group.id);
      if (existingIndex >= 0) {
        savedGroups[existingIndex] = savedGroup;
      } else {
        savedGroups.push(savedGroup);
      }

      await chrome.storage.local.set({ [this.storageKey]: savedGroups });
    } catch (error) {
      console.error('Error updating saved group:', error);
    }
  }

  async markGroupAsClosed(groupId) {
    try {
      const savedGroups = await this.getSavedTabGroups();
      const group = savedGroups.find(g => g.originalId === groupId);
      
      if (group) {
        group.isCurrentlyActive = false;
        group.dateClosed = new Date().toISOString();
        await chrome.storage.local.set({ [this.storageKey]: savedGroups });
        console.log('Marked group as closed:', group.title);
      }
    } catch (error) {
      console.error('Error marking group as closed:', error);
    }
  }

  async getAllTabGroups() {
    if (!this.isExtensionContext) {
      throw new Error('Chrome tab groups API not available');
    }
    
    try {
      const groups = await chrome.tabGroups.query({});
      return groups;
    } catch (error) {
      console.error('Error fetching tab groups:', error);
      throw error;
    }
  }

  async getAllTabGroupsWithHistory() {
    try {
      // Get currently active groups
      let activeGroups = [];
      if (this.isExtensionContext) {
        activeGroups = await this.getAllTabGroups();
      }

      // Get saved groups
      const savedGroups = await this.getSavedTabGroups();

      // Mark which saved groups are currently active
      const enhancedSavedGroups = savedGroups.map(savedGroup => {
        const isCurrentlyActive = activeGroups.some(active => 
          active.id === savedGroup.originalId
        );
        
        return {
          ...savedGroup,
          isCurrentlyActive,
          displayType: isCurrentlyActive ? 'active' : 'saved',
          isActive: isCurrentlyActive,
          isSaved: !isCurrentlyActive
        };
      });

      // Add any active groups that aren't in saved groups yet
      activeGroups.forEach(activeGroup => {
        const existsInSaved = savedGroups.some(saved => 
          saved.originalId === activeGroup.id
        );
        
        if (!existsInSaved) {
          enhancedSavedGroups.push({
            ...activeGroup,
            id: `temp-${activeGroup.id}`,
            originalId: activeGroup.id,
            isCurrentlyActive: true,
            displayType: 'active',
            isActive: true,
            isSaved: false,
            tabs: [] // Will be loaded when displayed
          });
        }
      });

      console.log('All tab groups with history:', enhancedSavedGroups);
      return enhancedSavedGroups;
    } catch (error) {
      console.error('Error getting all tab groups with history:', error);
      return [];
    }
  }

  async getSavedTabGroups() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error('Error getting saved groups:', error);
      return [];
    }
  }

  async getTabsInGroup(groupId) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome tabs API not available');
    }
    
    try {
      const tabs = await chrome.tabs.query({ groupId });
      return tabs;
    } catch (error) {
      console.error('Error fetching tabs in group:', error);
      throw error;
    }
  }

  async restoreTabGroup(savedGroup) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome tabs API not available');
    }
    
    try {
      console.log('Restoring tab group:', savedGroup);
      
      if (!savedGroup.tabs || savedGroup.tabs.length === 0) {
        console.warn('No tabs to restore for group:', savedGroup.title);
        return;
      }

      // Create tabs for the saved group
      const createdTabs = [];
      
      for (const savedTab of savedGroup.tabs) {
        const tab = await chrome.tabs.create({
          url: savedTab.url,
          active: false
        });
        createdTabs.push(tab);
      }
      
      if (createdTabs.length > 0) {
        // Group the tabs
        const groupId = await chrome.tabs.group({ 
          tabIds: createdTabs.map(t => t.id) 
        });
        
        // Update group properties
        await chrome.tabGroups.update(groupId, {
          title: savedGroup.title,
          color: savedGroup.color,
          collapsed: false
        });
        
        console.log('Tab group restored:', savedGroup.title);
        this.emit('tabGroupRestored', { group: savedGroup, newGroupId: groupId });
        
        return groupId;
      }
    } catch (error) {
      console.error('Error restoring tab group:', error);
      throw error;
    }
  }

  async deleteSavedTabGroup(savedGroupId) {
    try {
      const savedGroups = await this.getSavedTabGroups();
      const filteredGroups = savedGroups.filter(g => g.id !== savedGroupId);
      
      await chrome.storage.local.set({ [this.storageKey]: filteredGroups });
      
      this.emit('savedTabGroupDeleted', { groupId: savedGroupId });
      console.log('Deleted saved tab group:', savedGroupId);
      return true;
    } catch (error) {
      console.error('Error deleting saved tab group:', error);
      throw error;
    }
  }

  startListening() {
    if (!this.isExtensionContext) return;

    // Listen for tab group events
    chrome.tabGroups.onCreated.addListener((group) => {
      console.log('Tab group created:', group);
      this.emit('tabGroupCreated', { group });
    });

    chrome.tabGroups.onRemoved.addListener(async (group) => {
      console.log('Tab group removed:', group);
      await this.markGroupAsClosed(group.id);
      this.emit('tabGroupRemoved', { group });
      this.emit('tabGroupClosed', { group });
    });

    chrome.tabGroups.onUpdated.addListener((group) => {
      this.emit('tabGroupUpdated', { group });
    });

    chrome.tabGroups.onMoved.addListener((group) => {
      this.emit('tabGroupMoved', { group });
    });

    // Listen for tab events that affect groups
    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.groupId !== -1) {
        this.emit('tabAddedToGroup', { tab });
      }
    });

    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      this.emit('tabRemoved', { tabId, removeInfo });
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (tab.groupId !== -1 && (changeInfo.title || changeInfo.url || changeInfo.favIconUrl)) {
        this.emit('tabInGroupUpdated', { tabId, changeInfo, tab });
      }
    });
  }

  stopListening() {
    if (!this.isExtensionContext) return;

    chrome.tabGroups.onCreated.removeListener();
    chrome.tabGroups.onRemoved.removeListener();
    chrome.tabGroups.onUpdated.removeListener();
    chrome.tabGroups.onMoved.removeListener();
    chrome.tabs.onCreated.removeListener();
    chrome.tabs.onRemoved.removeListener();
    chrome.tabs.onUpdated.removeListener();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in tab group event listener:', error);
        }
      });
    }
  }

  getColorHex(colorName) {
    const colorMap = {
      'grey': '#9E9E9E',
      'blue': '#2196F3',
      'red': '#F44336',
      'yellow': '#FFEB3B',
      'green': '#4CAF50',
      'pink': '#E91E63',
      'purple': '#9C27B0',
      'cyan': '#00BCD4',
      'orange': '#FF9800'
    };
    return colorMap[colorName] || colorMap['grey'];
  }

  extractHostname(url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      return url;
    }
  }

  getFaviconUrl(url, size = 32) {
    if (!url) return this.getDefaultFavicon();
    const hostname = this.extractHostname(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
  }

  getDefaultFavicon() {
    return 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/><path d=%22M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3%22/><path d=%22M12 17h.01%22/></svg>';
  }
}

/* –––––––––––––––––––––––––––
  TAB GROUP FACTORY
––––––––––––––––––––––––––– */

class TabGroupFactory {
  constructor(chromeTabGroupsService) {
    this.chromeService = chromeTabGroupsService;
    this.activeTabGroups = new Map();
  }

  async createItem(id, data, slotId, position = { x: 0, y: 0 }) {
    const element = document.createElement('div');
    element.id = id;
    element.className = 'tab-group';
    element.dataset.slotId = slotId;
    
    // Add saved/active class
    if (data.isSaved && !data.isActive) {
      element.classList.add('saved-group');
    } else if (data.isActive || data.isCurrentlyActive) {
      element.classList.add('active-group');
    }
    
    if (position) {
      element.style.transform = `translate(${position.x}px, ${position.y}px)`;
      element.setAttribute('data-x', position.x);
      element.setAttribute('data-y', position.y);
    }
    
    const tabGroup = new TabGroupItem(element, { id, data, slotId, chromeService: this.chromeService });
    this.activeTabGroups.set(id, tabGroup);
    await tabGroup.initialize();
    
    return element;
  }

  removeItem(element) {
    const id = element.id;
    const tabGroup = this.activeTabGroups.get(id);
    
    if (tabGroup && tabGroup.cleanup) {
      tabGroup.cleanup();
    }
    
    this.activeTabGroups.delete(id);
  }

  getTabGroup(id) {
    return this.activeTabGroups.get(id);
  }

  getAllTabGroups() {
    return Array.from(this.activeTabGroups.values());
  }
}

/* –––––––––––––––––––––––––––
  TAB GROUP ITEM CLASS
––––––––––––––––––––––––––– */

class TabGroupItem {
  constructor(element, config) {
    this.element = element;
    this.config = config;
    this.id = config.id;
    this.data = config.data;
    this.slotId = config.slotId;
    this.chromeService = config.chromeService;
    this.isExpanded = true; // Default to expanded
  }

  async initialize() {
    const content = await this.getContent();
    
    this.element.innerHTML = `
      <div class="tab-group-content">
        ${content}
      </div>
    `;
    
    this.bindEvents();
    await this.start();
  }

  async getContent() {
    if (!this.data) {
      return `<div class="tab-group-placeholder">Empty Tab Group Slot</div>`;
    }
    
    let tabs = [];
    
    if (this.data.isCurrentlyActive && this.data.originalId && this.chromeService.isExtensionContext) {
      // Get live tabs for active groups
      try {
        tabs = await this.chromeService.getTabsInGroup(this.data.originalId);
      } catch (error) {
        console.error('Error fetching tabs for active group:', error);
        tabs = this.data.tabs || [];
      }
    } else if (this.data.tabs) {
      // Use saved tabs for saved groups
      tabs = this.data.tabs;
    }
    
    return this.getTabGroupContent(tabs);
  }

  getTabGroupContent(tabs = []) {
    const { 
      title = 'Untitled Group', 
      color = 'grey', 
      collapsed = false, 
      isCurrentlyActive = false 
    } = this.data;
    
    const colorHex = this.chromeService?.getColorHex(color) || '#9E9E9E';
    const tabCount = tabs.length;
    
    // Status indicator
    let statusIndicator = '';
    if (isCurrentlyActive) {
      statusIndicator = '<span class="group-status active">🟢 Active</span>';
    } else {
      statusIndicator = '<span class="group-status saved">💾 Saved</span>';
    }
    
    return `
      <div class="tab-group-header" style="border-left-color: ${colorHex}">
        <div class="tab-group-color-indicator" style="background-color: ${colorHex}"></div>
        <div class="tab-group-info">
          <div class="tab-group-title" title="${title}">${title || 'Untitled Group'}</div>
          <div class="tab-group-meta">
            <span class="tab-group-count">${tabCount} tab${tabCount !== 1 ? 's' : ''}</span>
            ${statusIndicator}
          </div>
        </div>
        <div class="tab-group-actions">
          ${this.getActionButtons()}
          <div class="tab-group-toggle ${collapsed ? 'collapsed' : ''}">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </div>
        </div>
      </div>
      <div class="tab-group-tabs ${collapsed ? 'collapsed' : ''}">
        ${tabs.map(tab => this.getTabContent(tab)).join('')}
      </div>
    `;
  }

  getActionButtons() {
    const { isCurrentlyActive = false } = this.data;
    
    if (!isCurrentlyActive) {
      // Saved group - show restore and delete buttons
      return `
        <button class="group-action-btn restore-btn" title="Restore tab group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
        </button>
        <button class="group-action-btn delete-btn" title="Delete saved group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;
    } else {
      // Active group - show save button
      return `
        <button class="group-action-btn save-btn" title="Manually save group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        </button>
      `;
    }
  }

  getTabContent(tab) {
    const { title, url, favIconUrl, active = false } = tab;
    const hostname = this.chromeService?.extractHostname(url) || 'unknown';
    const favicon = favIconUrl || this.chromeService?.getFaviconUrl(url) || this.chromeService?.getDefaultFavicon();
    
    return `
      <div class="tab-item ${active ? 'active' : ''}" data-tab-id="${tab.id || 'saved'}" data-tab-url="${url}">
        <div class="tab-favicon">
          <img src="${favicon}" alt="${title}" onerror="this.src='${this.chromeService?.getDefaultFavicon()}'">
        </div>
        <div class="tab-info">
          <div class="tab-title" title="${title}">${title}</div>
          <div class="tab-url" title="${url}">${hostname}</div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Handle action buttons
    const restoreBtn = this.element.querySelector('.restore-btn');
    const deleteBtn = this.element.querySelector('.delete-btn');
    const saveBtn = this.element.querySelector('.save-btn');
    
    if (restoreBtn) {
      restoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.restoreGroup();
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteGroup();
      });
    }
    
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.saveGroup();
      });
    }
    
    // Handle tab clicks
    const tabItems = this.element.querySelectorAll('.tab-item');
    tabItems.forEach(tabItem => {
      tabItem.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = tabItem.dataset.tabId;
        const tabUrl = tabItem.dataset.tabUrl;
        
        if (tabId && tabId !== 'saved') {
          this.activateTab(parseInt(tabId));
        } else if (tabUrl) {
          // For saved tabs, open in new tab
          window.open(tabUrl, '_blank');
        }
      });
    });

    // Handle toggle
    const toggle = this.element.querySelector('.tab-group-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleExpanded();
      });
    }
  }

  async restoreGroup() {
    try {
      console.log('Restoring group:', this.data.title);
      await this.chromeService.restoreTabGroup(this.data);
    } catch (error) {
      console.error('Error restoring group:', error);
      alert('Error restoring tab group. Please try again.');
    }
  }

  async deleteGroup() {
    if (confirm(`Delete saved group "${this.data.title}"?`)) {
      try {
        await this.chromeService.deleteSavedTabGroup(this.data.id);
      } catch (error) {
        console.error('Error deleting group:', error);
        alert('Error deleting tab group. Please try again.');
      }
    }
  }

  async saveGroup() {
    if (this.data.isCurrentlyActive && this.chromeService.isExtensionContext) {
      try {
        const tabs = await this.chromeService.getTabsInGroup(this.data.originalId);
        await this.chromeService.updateSavedGroup(this.data, tabs);
        alert('Tab group saved successfully!');
      } catch (error) {
        console.error('Error saving group:', error);
        alert('Error saving tab group. Please try again.');
      }
    }
  }

  async activateTab(tabId) {
    if (!this.chromeService.isExtensionContext) return;

    try {
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch (error) {
      console.error('Error activating tab:', error);
    }
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    
    const toggle = this.element.querySelector('.tab-group-toggle');
    const tabs = this.element.querySelector('.tab-group-tabs');
    
    if (toggle && tabs) {
      toggle.classList.toggle('collapsed', !this.isExpanded);
      tabs.classList.toggle('collapsed', !this.isExpanded);
    }
  }

  async start() {}
  cleanup() {}
}

/* –––––––––––––––––––––––––––
  TAB GROUP MANAGER
––––––––––––––––––––––––––– */

class TabGroupManager {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.chromeService = new ChromeTabGroupsService();
    this.tabGroupFactory = new TabGroupFactory(this.chromeService);
    
    this.init();
  }

  async init() {
    if (!this.container) {
      console.error('Tab group container not found');
      return;
    }

    this.chromeService.startListening();
    this.bindChromeEvents();
    await this.loadTabGroups();
  }

  bindChromeEvents() {
    this.chromeService.on('tabGroupCreated', () => this.refreshTabGroups());
    this.chromeService.on('tabGroupRemoved', () => this.refreshTabGroups());
    this.chromeService.on('tabGroupUpdated', () => this.refreshTabGroups());
    this.chromeService.on('savedTabGroupDeleted', () => this.refreshTabGroups());
    this.chromeService.on('tabGroupRestored', () => this.refreshTabGroups());
    
    // Add listener for when groups are closed
    this.chromeService.on('tabGroupClosed', () => {
      console.log('Tab group closed, refreshing display...');
      setTimeout(() => this.refreshTabGroups(), 1000); // Delay to ensure saving is complete
    });
  }

  async loadTabGroups() {
    try {
      // Get all groups (active + saved history)
      const allTabGroups = await this.chromeService.getAllTabGroupsWithHistory();
      console.log('Loading tab groups with history:', allTabGroups);
      await this.renderTabGroups(allTabGroups);
    } catch (error) {
      console.error('Error loading tab groups with history:', error);
      this.renderMockTabGroups();
    }
  }

  async renderTabGroups(tabGroups) {
    this.container.innerHTML = '';
    
    if (tabGroups.length === 0) {
      this.container.innerHTML = `
        <div class="no-tab-groups">
          <h3>No tab groups found</h3>
          <p>Create some tab groups in Chrome to see them here!</p>
          <p><small>💡 Right-click on tabs and select "Add to new group"</small></p>
        </div>
      `;
      return;
    }
    
    // Separate groups by type
    const activeGroups = tabGroups.filter(g => g.isCurrentlyActive);
    const savedGroups = tabGroups.filter(g => !g.isCurrentlyActive);
    
    // Show active groups first
    if (activeGroups.length > 0) {
      await this.renderSection('Currently Open Tab Groups', activeGroups, 'active-groups');
    }
    
    // Show saved groups
    if (savedGroups.length > 0) {
      await this.renderSection('Previously Saved Tab Groups', savedGroups, 'saved-groups');
    }

    // Show helpful message if no saved groups yet
    if (savedGroups.length === 0 && activeGroups.length > 0) {
      const helpDiv = document.createElement('div');
      helpDiv.className = 'tab-groups-help';
      helpDiv.innerHTML = `
        <div class="help-message">
          <h4>💡 Tip: Your tab groups will appear here automatically</h4>
          <p>When you close tab groups in Chrome, they'll be saved here so you can restore them later!</p>
        </div>
      `;
      this.container.appendChild(helpDiv);
    }
  }

  async renderSection(title, groups, sectionId) {
    const section = document.createElement('div');
    section.className = 'tab-groups-section';
    section.innerHTML = `<h3>${title}</h3>`;
    
    const slotContainer = this.createSlotContainer(sectionId);
    section.appendChild(slotContainer);
    
    this.container.appendChild(section);
    
    for (let i = 0; i < groups.length; i++) {
      await this.renderTabGroupItem(groups[i], slotContainer, i);
    }
  }

  createSlotContainer(sectionId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tab-group-slot-wrapper';
    
    const container = document.createElement('div');
    container.className = 'tab-group-slot-container';
    container.dataset.sectionId = sectionId;
    
    wrapper.appendChild(container);
    return wrapper;
  }

  async renderTabGroupItem(tabGroup, container, index) {
    const slot = document.createElement('div');
    slot.className = 'tab-group-slot';
    slot.dataset.slotId = `tab-group-${tabGroup.id}`;
    
    const tabGroupElement = await this.tabGroupFactory.createItem(
      `tab-group-item-${tabGroup.id}`,
      tabGroup,
      slot.dataset.slotId
    );
    
    if (tabGroupElement) {
      slot.appendChild(tabGroupElement);
    }
    
    container.appendChild(slot);
  }

  async refreshTabGroups() {
    await this.loadTabGroups();
  }

  renderMockTabGroups() {
    const mockTabGroups = [
      { 
        id: 1, 
        title: 'Work', 
        color: 'blue', 
        collapsed: false,
        isCurrentlyActive: true,
        tabs: [
          { title: 'Gmail', url: 'https://mail.google.com' },
          { title: 'Calendar', url: 'https://calendar.google.com' }
        ]
      },
      { 
        id: 'saved-1', 
        title: 'Research', 
        color: 'green', 
        collapsed: false,
        isCurrentlyActive: false,
        tabs: [
          { title: 'Stack Overflow', url: 'https://stackoverflow.com' },
          { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' }
        ]
      }
    ];
    
    this.renderTabGroups(mockTabGroups);
  }

  cleanup() {
    this.chromeService.stopListening();
  }
}

/* –––––––––––––––––––––––––––
  EXPORTS
––––––––––––––––––––––––––– */
export { 
  ChromeTabGroupsService,
  TabGroupFactory,
  TabGroupItem,
  TabGroupManager
};