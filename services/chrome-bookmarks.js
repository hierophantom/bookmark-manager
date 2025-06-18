/*
File name & path: services/chrome-bookmarks.js
Role: Chrome Bookmarks API service layer and bookmark visualization components
*/

/* –––––––––––––––––––––––––––
  CHROME BOOKMARKS API SERVICE
––––––––––––––––––––––––––– */

class ChromeBookmarksService {
  constructor() {
    this.isExtensionContext = this.checkExtensionContext();
    this.listeners = new Map();
  }

  /* –––––––––––––––––––––––––––
    CONTEXT VALIDATION
  ––––––––––––––––––––––––––– */

  checkExtensionContext() {
    try {
      return !!(chrome && chrome.bookmarks);
    } catch (e) {
      console.warn('Chrome extension context not available:', e);
      return false;
    }
  }

  /* –––––––––––––––––––––––––––
    CORE BOOKMARK OPERATIONS
  ––––––––––––––––––––––––––– */

  async getBookmarkTree() {
    if (!this.isExtensionContext) {
      throw new Error('Chrome bookmarks API not available');
    }
    
    try {
      const tree = await chrome.bookmarks.getTree();
      return tree;
    } catch (error) {
      console.error('Error fetching bookmark tree:', error);
      throw error;
    }
  }

  async getBookmarksBar() {
    if (!this.isExtensionContext) {
      throw new Error('Chrome bookmarks API not available');
    }
    
    try {
      // Get the bookmarks bar (usually ID "1")
      const children = await chrome.bookmarks.getChildren("1");
      return children;
    } catch (error) {
      console.error('Error fetching bookmarks bar:', error);
      throw error;
    }
  }

  async getBookmarksByParent(parentId) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome bookmarks API not available');
    }
    
    try {
      const children = await chrome.bookmarks.getChildren(parentId);
      return children;
    } catch (error) {
      console.error('Error fetching bookmarks by parent:', error);
      throw error;
    }
  }

  async createBookmark(parentId, title, url, index = null) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome bookmarks API not available');
    }
    
    try {
      const bookmark = await chrome.bookmarks.create({
        parentId,
        title,
        url,
        ...(index !== null && { index })
      });
      return bookmark;
    } catch (error) {
      console.error('Error creating bookmark:', error);
      throw error;
    }
  }

  async createFolder(parentId, title, index = null) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome bookmarks API not available');
    }
    
    try {
      const folder = await chrome.bookmarks.create({
        parentId,
        title,
        ...(index !== null && { index })
      });
      return folder;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  async updateBookmark(id, changes) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome bookmarks API not available');
    }
    
    try {
      const bookmark = await chrome.bookmarks.update(id, changes);
      return bookmark;
    } catch (error) {
      console.error('Error updating bookmark:', error);
      throw error;
    }
  }

  async removeBookmark(id) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome bookmarks API not available');
    }
    
    try {
      await chrome.bookmarks.remove(id);
      return true;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      throw error;
    }
  }

  async moveBookmark(id, destination) {
    if (!this.isExtensionContext) {
      throw new Error('Chrome bookmarks API not available');
    }
    
    try {
      const bookmark = await chrome.bookmarks.move(id, destination);
      return bookmark;
    } catch (error) {
      console.error('Error moving bookmark:', error);
      throw error;
    }
  }

  /* –––––––––––––––––––––––––––
    EVENT LISTENERS
  ––––––––––––––––––––––––––– */

  startListening() {
    if (!this.isExtensionContext) return;

    // Listen for bookmark events
    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      this.emit('bookmarkCreated', { id, bookmark });
    });

    chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
      this.emit('bookmarkRemoved', { id, removeInfo });
    });

    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      this.emit('bookmarkChanged', { id, changeInfo });
    });

    chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
      this.emit('bookmarkMoved', { id, moveInfo });
    });

    chrome.bookmarks.onChildrenReordered.addListener((id, reorderInfo) => {
      this.emit('bookmarkReordered', { id, reorderInfo });
    });
  }

  stopListening() {
    if (!this.isExtensionContext) return;

    chrome.bookmarks.onCreated.removeListener();
    chrome.bookmarks.onRemoved.removeListener();
    chrome.bookmarks.onChanged.removeListener();
    chrome.bookmarks.onMoved.removeListener();
    chrome.bookmarks.onChildrenReordered.removeListener();
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
          console.error('Error in bookmark event listener:', error);
        }
      });
    }
  }

  /* –––––––––––––––––––––––––––
    UTILITY METHODS
  ––––––––––––––––––––––––––– */

  isFolder(bookmark) {
    return !bookmark.url;
  }

  isBookmark(bookmark) {
    return !!bookmark.url;
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
    const hostname = this.extractHostname(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
  }
}

/* –––––––––––––––––––––––––––
  BOOKMARK FACTORY
––––––––––––––––––––––––––– */

class BookmarkFactory {
  constructor(chromeBookmarksService) {
    this.chromeService = chromeBookmarksService;
    this.activeBookmarks = new Map();
  }

  /* –––––––––––––––––––––––––––
    BOOKMARK CREATION
  ––––––––––––––––––––––––––– */

  async createItem(id, data, slotId, position = { x: 0, y: 0 }) {
    // Create the bookmark element
    const element = document.createElement('div');
    element.id = id;
    element.className = 'bookmark';
    element.dataset.slotId = slotId;
    
    // Apply position
    if (position) {
      element.style.transform = `translate(${position.x}px, ${position.y}px)`;
      element.setAttribute('data-x', position.x);
      element.setAttribute('data-y', position.y);
    }
    
    // Create bookmark instance
    const bookmark = new BookmarkItem(element, { id, data, slotId, chromeService: this.chromeService });
    
    // Store bookmark instance for later reference
    this.activeBookmarks.set(id, bookmark);
    
    // Initialize the bookmark
    await bookmark.initialize();
    
    return element;
  }

  /* –––––––––––––––––––––––––––
    BOOKMARK REMOVAL
  ––––––––––––––––––––––––––– */

  removeItem(element) {
    const id = element.id;
    const bookmark = this.activeBookmarks.get(id);
    
    if (bookmark && bookmark.cleanup) {
      bookmark.cleanup();
    }
    
    this.activeBookmarks.delete(id);
  }

  /* –––––––––––––––––––––––––––
    BOOKMARK ACCESS
  ––––––––––––––––––––––––––– */

  getBookmark(id) {
    return this.activeBookmarks.get(id);
  }

  getAllBookmarks() {
    return Array.from(this.activeBookmarks.values());
  }
}

/* –––––––––––––––––––––––––––
  BASE BOOKMARK CLASS
––––––––––––––––––––––––––– */

class BaseBookmark {
  constructor(element, config) {
    this.element = element;
    this.config = config;
    this.id = config.id;
    this.data = config.data;
    this.slotId = config.slotId;
    this.chromeService = config.chromeService;
  }
  
  async initialize() {
    // Add basic structure
    this.element.innerHTML = `
      <div class="bookmark-content">
        ${this.getContent()}
      </div>
    `;
    
    // Bind events
    this.bindEvents();
    
    // Start any async operations
    await this.start();
  }
  
  getContent() {
    return `<div class="bookmark-placeholder">Empty Bookmark Slot</div>`;
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
  
  // Utility method to get bookmark content container
  getContentContainer() {
    return this.element.querySelector('.bookmark-content');
  }
}

/* –––––––––––––––––––––––––––
  BOOKMARK ITEM CLASS
––––––––––––––––––––––––––– */

class BookmarkItem extends BaseBookmark {
  getContent() {
    if (!this.data || (!this.data.url && !this.data.children)) {
      return `<div class="bookmark-placeholder">Empty Bookmark Slot</div>`;
    }
    
    // Handle folder
    if (this.data.children || !this.data.url) {
      return this.getFolderContent();
    }
    
    // Handle bookmark
    return this.getBookmarkContent();
  }

  getBookmarkContent() {
    const { title, url } = this.data;
    const hostname = this.chromeService?.extractHostname(url) || 'unknown';
    const faviconUrl = this.chromeService?.getFaviconUrl(url) || this.getDefaultFavicon();
    
    return `
      <div class="bookmark-link">
        <div class="bookmark-favicon">
          <img src="${faviconUrl}" alt="${title}" onerror="this.src='${this.getDefaultFavicon()}'">
        </div>
        <div class="bookmark-info">
          <div class="bookmark-name" title="${title}">${title}</div>
          <div class="bookmark-url" title="${url}">${hostname}</div>
        </div>
      </div>
    `;
  }

  getFolderContent() {
    const { title, children = [] } = this.data;
    const childCount = children.length;
    
    return `
      <div class="bookmark-folder">
        <div class="folder-icon">📁</div>
        <div class="folder-info">
          <div class="folder-name" title="${title}">${title}</div>
          <div class="folder-count">${childCount} item${childCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="folder-toggle">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
      </div>
    `;
  }

  getDefaultFavicon() {
    return 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/><path d=%22M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3%22/><path d=%22M12 17h.01%22/></svg>';
  }
  
  bindEvents() {
    const isFolder = this.data.children || !this.data.url;
    
    if (!isFolder && this.data.url) {
      // Make the bookmark clickable
      this.element.addEventListener('click', (e) => {
        // Don't trigger if clicking on controls
        if (!e.target.closest('.bookmark-controls')) {
          window.open(this.data.url, '_blank');
        }
      });
      
      // Add hover effect
      this.element.style.cursor = 'pointer';
    } else if (isFolder) {
      // Handle folder toggle
      const folderToggle = this.element.querySelector('.folder-toggle');
      if (folderToggle) {
        folderToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleFolder();
        });
      }
      
      this.element.style.cursor = 'pointer';
    }
  }

  toggleFolder() {
    // Implement folder expand/collapse logic
    const isExpanded = this.element.classList.contains('folder-expanded');
    this.element.classList.toggle('folder-expanded', !isExpanded);
    
    // Emit event for parent manager to handle
    this.element.dispatchEvent(new CustomEvent('folderToggle', {
      detail: {
        folderId: this.data.id,
        expanded: !isExpanded,
        bookmark: this.data
      },
      bubbles: true
    }));
  }
}

/* –––––––––––––––––––––––––––
  BOOKMARK MANAGER
––––––––––––––––––––––––––– */

class BookmarkManager {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.chromeService = new ChromeBookmarksService();
    this.bookmarkFactory = new BookmarkFactory(this.chromeService);
    this.folderStates = new Map(); // Track expanded/collapsed folders
    this.slotFactories = new Map(); // Track slot factories for different sections
    
    this.init();
  }

  async init() {
    if (!this.container) {
      console.error('Bookmark container not found');
      return;
    }

    // Start listening to bookmark events
    this.chromeService.startListening();
    this.bindChromeEvents();
    
    // Load and render bookmarks
    await this.loadBookmarks();
  }

  bindChromeEvents() {
    this.chromeService.on('bookmarkCreated', () => this.refreshBookmarks());
    this.chromeService.on('bookmarkRemoved', () => this.refreshBookmarks());
    this.chromeService.on('bookmarkChanged', () => this.refreshBookmarks());
    this.chromeService.on('bookmarkMoved', () => this.refreshBookmarks());
    this.chromeService.on('bookmarkReordered', () => this.refreshBookmarks());
  }

  async loadBookmarks() {
    try {
      const bookmarksBar = await this.chromeService.getBookmarksBar();
      await this.renderBookmarks(bookmarksBar);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      this.renderMockBookmarks();
    }
  }

  async renderBookmarks(bookmarks) {
    // Clear existing content
    this.container.innerHTML = '';
    
    // Create bookmarks section
    const bookmarksSection = document.createElement('div');
    bookmarksSection.className = 'bookmarks-section';
    bookmarksSection.innerHTML = '<h3>Bookmarks Bar</h3>';
    
    // Create slot container for bookmarks
    const slotContainer = this.createSlotContainer('bookmarks-bar');
    bookmarksSection.appendChild(slotContainer);
    
    this.container.appendChild(bookmarksSection);
    
    // Render each bookmark
    bookmarks.forEach((bookmark, index) => {
      this.renderBookmarkItem(bookmark, slotContainer, index);
    });
  }

  createSlotContainer(sectionId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'bookmark-slot-wrapper';
    
    const container = document.createElement('div');
    container.className = 'bookmark-slot-container';
    container.dataset.sectionId = sectionId;
    
    wrapper.appendChild(container);
    return wrapper;
  }

  renderBookmarkItem(bookmark, container, index) {
    const slot = document.createElement('div');
    slot.className = 'bookmark-slot';
    slot.dataset.slotId = `bookmark-${bookmark.id || index}`;
    
    // Create bookmark element using factory
    const bookmarkElement = this.bookmarkFactory.createItem(
      `bookmark-item-${bookmark.id || index}`,
      bookmark,
      slot.dataset.slotId
    );
    
    if (bookmarkElement) {
      slot.appendChild(bookmarkElement);
    }
    
    container.appendChild(slot);
  }

  async refreshBookmarks() {
    await this.loadBookmarks();
  }

  renderMockBookmarks() {
    // Fallback for when not in extension context
    const mockBookmarks = [
      { id: '1', title: 'Google', url: 'https://www.google.com' },
      { id: '2', title: 'GitHub', url: 'https://github.com' },
      { id: '3', title: 'Work', children: [] } // Mock folder
    ];
    
    this.renderBookmarks(mockBookmarks);
  }

  cleanup() {
    this.chromeService.stopListening();
    this.slotFactories.clear();
    this.folderStates.clear();
  }
}

/* –––––––––––––––––––––––––––
  EXPORTS
––––––––––––––––––––––––––– */
export { 
  ChromeBookmarksService,
  BookmarkFactory,
  BaseBookmark,
  BookmarkItem,
  BookmarkManager
};