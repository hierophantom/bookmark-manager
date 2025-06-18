/*
File name & path: services/chrome-tabgroups.js
Role: Chrome Tab Groups API service layer and tab group visualization components
*/

/* –––––––––––––––––––––––––––
  CHROME TAB GROUPS API SERVICE
––––––––––––––––––––––––––– */

class ChromeTabGroupsService {
  constructor() {
    this.isExtensionContext = this.checkExtensionContext();
    this.listeners = new Map();
  }

  /* –––––––––––––––––––––––––––
    CONTEXT VALIDATION
  ––––––––––––––––––––––––––– */

  checkExtensionContext() {
    try {
      return !!(chrome && chrome.tabGroups && chrome.tabs);
    } catch (e) {
      console.warn('Chrome extension context not available:', e);
      return false;
    }
  }

  /* –––––––––––––––––––––––––––
    CORE TAB GROUP OPERATIONS
  ––––––––––––––––––––––––––– */

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

  async getTabGroup(groupId) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome tab groups API not available');
    }
    
    try {
      const group = await chrome.tabGroups.get(groupId);
      return group;
    } catch (error) {
      console.error('Error fetching tab group:', error);
      throw error;
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

  async getAllActiveTabs() {
    if (!this.isExtensionContext) {
      throw new Error('Chrome tabs API not available');
    }
    
    try {
      const tabs = await chrome.tabs.query({});
      return tabs;
    } catch (error) {
      console.error('Error fetching active tabs:', error);
      throw error;
    }
  }

  async createTabGroup(tabIds, options = {}) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome tabs API not available');
    }
    
    try {
      // First group the tabs
      const groupId = await chrome.tabs.group({ tabIds });
      
      // Then update the group properties if provided
      if (options.title || options.color || options.collapsed !== undefined) {
        await chrome.tabGroups.update(groupId, options);
      }
      
      return groupId;
    } catch (error) {
      console.error('Error creating tab group:', error);
      throw error;
    }
  }

  async updateTabGroup(groupId, options) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome tab groups API not available');
    }
    
    try {
      const group = await chrome.tabGroups.update(groupId, options);
      return group;
    } catch (error) {
      console.error('Error updating tab group:', error);
      throw error;
    }
  }

  async ungroupTabs(tabIds) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome tabs API not available');
    }
    
    try {
      await chrome.tabs.ungroup(tabIds);
      return true;
    } catch (error) {
      console.error('Error ungrouping tabs:', error);
      throw error;
    }
  }

  async moveTabsToGroup(tabIds, groupId) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome tabs API not available');
    }
    
    try {
      await chrome.tabs.group({ tabIds, groupId });
      return true;
    } catch (error) {
      console.error('Error moving tabs to group:', error);
      throw error;
    }
  }

  /* –––––––––––––––––––––––––––
    EVENT LISTENERS
  ––––––––––––––––––––––––––– */

  startListening() {
    if (!this.isExtensionContext) return;

    // Listen for tab group events
    chrome.tabGroups.onCreated.addListener((group) => {
      this.emit('tabGroupCreated', { group });
    });

    chrome.tabGroups.onRemoved.addListener((group) => {
      this.emit('tabGroupRemoved', { group });
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
      if (tab.groupId !== -1) {
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

  /* –––––––––––––––––––––––––––
    EVENT EMITTER METHODS
  ––––––––––––––––––––––––––– */

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

  /* –––––––––––––––––––––––––––
    UTILITY METHODS
  ––––––––––––––––––––––––––– */

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

  /* –––––––––––––––––––––––––––
    TAB GROUP CREATION
  ––––––––––––––––––––––––––– */

  async createItem(id, data, slotId, position = { x: 0, y: 0 }) {
    // Create the tab group element
    const element = document.createElement('div');
    element.id = id;
    element.className = 'tab-group';
    element.dataset.slotId = slotId;
    
    // Apply position
    if (position) {
      element.style.transform = `translate(${position.x}px, ${position.y}px)`;
      element.setAttribute('data-x', position.x);
      element.setAttribute('data-y', position.y);
    }
    
    // Create tab group instance
    const tabGroup = new TabGroupItem(element, { id, data, slotId, chromeService: this.chromeService });
    
    // Store tab group instance for later reference
    this.activeTabGroups.set(id, tabGroup);
    
    // Initialize the tab group
    await tabGroup.initialize();
    
    return element;
  }

  /* –––––––––––––––––––––––––––
    TAB GROUP REMOVAL
  ––––––––––––––––––––––––––– */

  removeItem(element) {
    const id = element.id;
    const tabGroup = this.activeTabGroups.get(id);
    
    if (tabGroup && tabGroup.cleanup) {
      tabGroup.cleanup();
    }
    
    this.activeTabGroups.delete(id);
  }

  /* –––––––––––––––––––––––––––
    TAB GROUP ACCESS
  ––––––––––––––––––––––––––– */

  getTabGroup(id) {
    return this.activeTabGroups.get(id);
  }

  getAllTabGroups() {
    return Array.from(this.activeTabGroups.values());
  }
}

/* –––––––––––––––––––––––––––
  BASE TAB GROUP CLASS
––––––––––––––––––––––––––– */

class BaseTabGroup {
  constructor(element, config) {
    this.element = element;
    this.config = config;
    this.id = config.id;
    this.data = config.data;
    this.slotId = config.slotId;
    this.chromeService = config.chromeService;
    this.isExpanded = false;
  }
  
  async initialize() {
    // Add basic structure
    this.element.innerHTML = `
      <div class="tab-group-content">
        ${this.getContent()}
      </div>
    `;
    
    // Bind events
    this.bindEvents();
    
    // Start any async operations
    await this.start();
  }
  
  getContent() {
    return `<div class="tab-group-placeholder">Empty Tab Group Slot</div>`;
  }
  
  bindEvents() {
    // Override in subclasses
  }
  
  async start() {
    // Override in subclasses for async initialization
  }
  
  cleanup() {
    // Override in subclasses for cleanup
  }
  
  // Utility method to get tab group content container
  getContentContainer() {
    return this.element.querySelector('.tab-group-content');
  }
}

/* –––––––––––––––––––––––––––
  TAB GROUP ITEM CLASS
––––––––––––––––––––––––––– */

class TabGroupItem extends BaseTabGroup {
  async getContent() {
    if (!this.data || !this.data.id) {
      return `<div class="tab-group-placeholder">Empty Tab Group Slot</div>`;
    }
    
    // Get tabs in this group
    let tabs = [];
    try {
      if (this.chromeService.isExtensionContext) {
        tabs = await this.chromeService.getTabsInGroup(this.data.id);
      }
    } catch (error) {
      console.error('Error fetching tabs for group:', error);
    }
    
    return this.getTabGroupContent(tabs);
  }

  getTabGroupContent(tabs = []) {
    const { title = 'Untitled Group', color = 'grey', collapsed = false } = this.data;
    const colorHex = this.chromeService?.getColorHex(color) || '#9E9E9E';
    const tabCount = tabs.length;
    
    return `
      <div class="tab-group-header" style="border-left-color: ${colorHex}">
        <div class="tab-group-color-indicator" style="background-color: ${colorHex}"></div>
        <div class="tab-group-info">
          <div class="tab-group-title" title="${title}">${title || 'Untitled Group'}</div>
          <div class="tab-group-count">${tabCount} tab${tabCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="tab-group-toggle ${collapsed ? 'collapsed' : ''}">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
      </div>
      <div class="tab-group-tabs ${collapsed ? 'collapsed' : ''}">
        ${tabs.map(tab => this.getTabContent(tab)).join('')}
      </div>
    `;
  }

  getTabContent(tab) {
    const { title, url, favIconUrl, active } = tab;
    const hostname = this.chromeService?.extractHostname(url) || 'unknown';
    const favicon = favIconUrl || this.chromeService?.getFaviconUrl(url) || this.chromeService?.getDefaultFavicon();
    
    return `
      <div class="tab-item ${active ? 'active' : ''}" data-tab-id="${tab.id}">
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

  async initialize() {
    // Get content with tabs
    const content = await this.getContent();
    
    // Add basic structure
    this.element.innerHTML = `
      <div class="tab-group-content">
        ${content}
      </div>
    `;
    
    // Bind events
    this.bindEvents();
    
    // Start any async operations
    await this.start();
  }
  
  bindEvents() {
    // Handle tab group toggle
    const toggle = this.element.querySelector('.tab-group-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleExpanded();
      });
    }

    // Handle tab clicks
    const tabItems = this.element.querySelectorAll('.tab-item');
    tabItems.forEach(tabItem => {
      tabItem.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = parseInt(tabItem.dataset.tabId);
        this.activateTab(tabId);
      });
    });

    // Handle tab group header click (expand/collapse)
    const header = this.element.querySelector('.tab-group-header');
    if (header) {
      header.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-group-toggle')) {
          this.toggleExpanded();
        }
      });
    }
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    
    const toggle = this.element.querySelector('.tab-group-toggle');
    const tabs = this.element.querySelector('.tab-group-tabs');
    
    if (toggle && tabs) {
      toggle.classList.toggle('collapsed', !this.isExpanded);
      tabs.classList.toggle('collapsed', !this.isExpanded);
      
      // Update Chrome tab group collapsed state
      if (this.chromeService.isExtensionContext && this.data.id) {
        this.chromeService.updateTabGroup(this.data.id, { collapsed: !this.isExpanded });
      }
    }

    // Emit event for external handling
    this.element.dispatchEvent(new CustomEvent('tabGroupToggle', {
      detail: {
        groupId: this.data.id,
        expanded: this.isExpanded,
        group: this.data
      },
      bubbles: true
    }));
  }

  async activateTab(tabId) {
    if (!this.chromeService.isExtensionContext) {
      console.warn('Cannot activate tab: Chrome extension context not available');
      return;
    }

    try {
      // Switch to the tab
      await chrome.tabs.update(tabId, { active: true });
      
      // Focus the window containing the tab
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
      
    } catch (error) {
      console.error('Error activating tab:', error);
    }
  }
}

/* –––––––––––––––––––––––––––
  TAB GROUP MANAGER
––––––––––––––––––––––––––– */

class TabGroupManager {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.chromeService = new ChromeTabGroupsService();
    this.tabGroupFactory = new TabGroupFactory(this.chromeService);
    this.groupStates = new Map(); // Track expanded/collapsed groups
    
    this.init();
  }

  async init() {
    if (!this.container) {
      console.error('Tab group container not found');
      return;
    }

    // Start listening to tab group events
    this.chromeService.startListening();
    this.bindChromeEvents();
    
    // Load and render tab groups
    await this.loadTabGroups();
  }

  bindChromeEvents() {
    this.chromeService.on('tabGroupCreated', () => this.refreshTabGroups());
    this.chromeService.on('tabGroupRemoved', () => this.refreshTabGroups());
    this.chromeService.on('tabGroupUpdated', () => this.refreshTabGroups());
    this.chromeService.on('tabGroupMoved', () => this.refreshTabGroups());
    this.chromeService.on('tabAddedToGroup', () => this.refreshTabGroups());
    this.chromeService.on('tabRemoved', () => this.refreshTabGroups());
    this.chromeService.on('tabInGroupUpdated', () => this.refreshTabGroups());
  }

  async loadTabGroups() {
    try {
      const tabGroups = await this.chromeService.getAllTabGroups();
      await this.renderTabGroups(tabGroups);
    } catch (error) {
      console.error('Error loading tab groups:', error);
      this.renderMockTabGroups();
    }
  }

  async renderTabGroups(tabGroups) {
    // Clear existing content
    this.container.innerHTML = '';
    
    if (tabGroups.length === 0) {
      this.container.innerHTML = '<div class="no-tab-groups">No active tab groups</div>';
      return;
    }
    
    // Create tab groups section
    const tabGroupsSection = document.createElement('div');
    tabGroupsSection.className = 'tab-groups-section';
    tabGroupsSection.innerHTML = '<h3>Active Tab Groups</h3>';
    
    // Create slot container for tab groups
    const slotContainer = this.createSlotContainer('tab-groups');
    tabGroupsSection.appendChild(slotContainer);
    
    this.container.appendChild(tabGroupsSection);
    
    // Render each tab group
    for (let i = 0; i < tabGroups.length; i++) {
      await this.renderTabGroupItem(tabGroups[i], slotContainer, i);
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
    
    // Create tab group element using factory
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
    // Fallback for when not in extension context
    const mockTabGroups = [
      { 
        id: 1, 
        title: 'Work', 
        color: 'blue', 
        collapsed: false,
        windowId: 1 
      },
      { 
        id: 2, 
        title: 'Research', 
        color: 'green', 
        collapsed: true,
        windowId: 1 
      }
    ];
    
    this.renderTabGroups(mockTabGroups);
  }

  cleanup() {
    this.chromeService.stopListening();
    this.groupStates.clear();
  }
}

/* –––––––––––––––––––––––––––
  EXPORTS
––––––––––––––––––––––––––– */
export { 
  ChromeTabGroupsService,
  TabGroupFactory,
  BaseTabGroup,
  TabGroupItem,
  TabGroupManager
};