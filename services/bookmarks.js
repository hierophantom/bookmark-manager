// services/bookmarks.js
// Using SlotSystem architecture for bookmarks

import { SlotSystem } from '../slots-system/slots.js';

/* –––––––––––––––––––––––––––
  BOOKMARKS FACTORY
––––––––––––––––––––––––––– */

class BookmarksFactory {
    constructor() {
        this.activeBookmarks = new Map();
    }
    
    async createItem(id, bookmarkData, slotId, position = { x: 0, y: 0 }) {
        // Create the bookmark element
        const element = document.createElement('div');
        element.id = id;
        element.className = 'bookmark-item';
        element.dataset.slotId = slotId;
        
        // Apply position
        if (position) {
            element.style.transform = `translate(${position.x}px, ${position.y}px)`;
            element.setAttribute('data-x', position.x);
            element.setAttribute('data-y', position.y);
        }
        
        // Create bookmark instance
        const bookmark = new BookmarkItem(element, { id, data: bookmarkData, slotId });
        
        // Store bookmark instance for later reference
        this.activeBookmarks.set(id, bookmark);
        
        // Initialize the bookmark
        await bookmark.initialize();
        
        return element;
    }
    
    removeItem(element) {
        const id = element.id;
        const bookmark = this.activeBookmarks.get(id);
        
        if (bookmark && bookmark.cleanup) {
            bookmark.cleanup();
        }
        
        this.activeBookmarks.delete(id);
    }
    
    getBookmark(id) {
        return this.activeBookmarks.get(id);
    }
    
    getAllBookmarks() {
        return Array.from(this.activeBookmarks.values());
    }
}

/* –––––––––––––––––––––––––––
  BOOKMARK ITEM CLASS
––––––––––––––––––––––––––– */

class BookmarkItem {
    constructor(element, config) {
        this.element = element;
        this.config = config;
        this.id = config.id;
        this.data = config.data;
        this.slotId = config.slotId;
    }
    
    async initialize() {
        // Add basic structure
        this.element.innerHTML = `
            <div class="bookmark-item-content">
                ${this.getContent()}
            </div>
        `;
        
        // Bind events
        this.bindEvents();
        
        // Start any async operations
        await this.start();
    }
    
    getContent() {
        if (!this.data || !this.data.url) {
            return `
                <div class="bookmark-placeholder">
                    <svg class="bookmark-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"></path>
                    </svg>
                    <div>Empty Slot</div>
                </div>
            `;
        }
        
        const { title, url } = this.data;
        const faviconUrl = this.getFaviconUrl(url);
        
        return `
            <div class="bookmark-icon">
                <img src="${faviconUrl}" alt="${title}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/><path d=%22M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3%22/><path d=%22M12 17h.01%22/></svg>'">
            </div>
            <div class="bookmark-name">${title || 'Untitled'}</div>
        `;
    }
    
    bindEvents() {
        if (this.data && this.data.url) {
            // Make the bookmark clickable
            this.element.addEventListener('click', (e) => {
                // Don't trigger if clicking on controls
                if (!e.target.closest('.bookmark-item-controls')) {
                    chrome.tabs.create({ url: this.data.url });
                }
            });
        }
    }
    
    async start() {
        // Any async initialization
    }
    
    cleanup() {
        // Cleanup when bookmark is removed
    }
    
    getFaviconUrl(url) {
        if (!url) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%23666"/></svg>';
        
        try {
            return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
        } catch {
            return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%23666"/></svg>';
        }
    }
}

/* –––––––––––––––––––––––––––
  BOOKMARKS SERVICE
––––––––––––––––––––––––––– */

class BookmarksService {
    constructor() {
        this.bookmarksContainer = null;
        this.folderSlotSystems = new Map(); // Map folder ID to SlotSystem instance
        this.bookmarksFactory = new BookmarksFactory();
        this.slotsPerFolder = 8; // Number of slots per folder
        this.currentFolderId = null;
        this.currentTargetSlot = null;
        this.init();
    }

    async init() {
        await this.waitForDOM();
        this.bookmarksContainer = document.getElementById('bookmarks-container');
        
        if (!this.bookmarksContainer) {
            console.error('Bookmarks container not found');
            return;
        }

        await this.loadBookmarks();
        this.setupListeners();
    }

    async waitForDOM() {
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
    }

    async loadBookmarks() {
        try {
            // Get the bookmarks tree from Chrome API
            const bookmarksTree = await chrome.bookmarks.getTree();
            
            // Process the root bookmark bar
            const bookmarkBar = bookmarksTree[0].children.find(child => child.title === 'Bookmarks Bar');
            
            if (bookmarkBar) {
                await this.renderBookmarks(bookmarkBar);
            }
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
        }
    }

    async renderBookmarks(bookmarkNode) {
        // Clear existing content
        this.bookmarksContainer.innerHTML = '';
        this.folderSlotSystems.clear();
        
        // Create folder for root level bookmarks
        const rootBookmarks = bookmarkNode.children.filter(child => !child.children);
        await this.createBookmarkFolder(bookmarkNode.id, 'Quick Bookmarks', [], rootBookmarks);
        
        // Process all folders recursively
        if (bookmarkNode.children) {
            for (const child of bookmarkNode.children) {
                if (child.children) {
                    await this.processFolderHierarchy(child, []);
                }
            }
        }
    }

    async processFolderHierarchy(folder, parentPath) {
        const currentPath = [...parentPath, folder.title];
        
        // Get bookmarks from this folder
        const bookmarks = folder.children.filter(child => !child.children);
        
        // Create the folder
        await this.createBookmarkFolder(folder.id, folder.title, parentPath, bookmarks);
        
        // Recursively process any subfolders
        const subfolders = folder.children.filter(child => child.children);
        for (const subfolder of subfolders) {
            await this.processFolderHierarchy(subfolder, currentPath);
        }
    }

    async createBookmarkFolder(folderId, title, parentPath, bookmarks = []) {
        const folderDiv = document.createElement('div');
        folderDiv.id = `bookmark-folder-${folderId}`;
        folderDiv.className = 'bookmark-folder';
        
        // Create display title with breadcrumbs
        let displayTitle = '';
        if (parentPath.length > 0) {
            const breadcrumbPath = parentPath.map(part => 
                `<span class="subfolder-title">${part}</span>`
            ).join(' > ');
            displayTitle = `${breadcrumbPath} > ${title}`;
        } else {
            displayTitle = title;
        }
        
        // Create slots HTML
        const slotsHTML = Array.from({ length: this.slotsPerFolder }, (_, index) => 
            `<div class="bookmark-slot" data-slot-id="slot-${folderId}-${index}"></div>`
        ).join('');
        
        folderDiv.innerHTML = `
            <div class="folder-header">
                <h3 class="folder-title">${displayTitle}</h3>
                <div class="folder-actions">
                    <button class="add-bookmark-btn" title="Add bookmark to ${title}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="bookmark-slots-container" id="bookmark-slots-${folderId}">
                ${slotsHTML}
                <div class="bookmark-controls">
                    <button class="bookmark-btn" title="Add bookmark">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        this.bookmarksContainer.appendChild(folderDiv);
        
        // Initialize slot system for this folder
        await this.initializeFolderSlotSystem(folderId, bookmarks);
        
        // Add event listeners
        const addBtn = folderDiv.querySelector('.add-bookmark-btn');
        const addControlBtn = folderDiv.querySelector('.bookmark-btn');
        
        addBtn.addEventListener('click', () => this.showAddBookmarkModal(folderId));
        addControlBtn.addEventListener('click', () => this.showAddBookmarkModal(folderId));
    }

    async initializeFolderSlotSystem(folderId, bookmarks) {
        const slotSystem = new SlotSystem({
            storageKey: `bookmarks-${folderId}`,
            slotSelector: `#bookmark-slots-${folderId} .bookmark-slot`,
            containerSelector: `#bookmark-slots-${folderId}`,
            controlsSelector: `#bookmark-slots-${folderId} .bookmark-controls`,
            itemClass: 'bookmark-item'
        });
        
        // Set the bookmarks factory
        slotSystem.setItemFactory(this.bookmarksFactory);
        
        // Store the slot system
        this.folderSlotSystems.set(folderId, slotSystem);
        
        // Populate with existing bookmarks
        for (let i = 0; i < bookmarks.length && i < this.slotsPerFolder; i++) {
            const bookmark = bookmarks[i];
            const slotId = `slot-${folderId}-${i}`;
            
            await slotSystem.addItemWithData({
                id: bookmark.id,
                title: bookmark.title,
                url: bookmark.url
            }, document.querySelector(`[data-slot-id="${slotId}"]`));
        }
    }

    showAddBookmarkModal(folderId) {
        // Find first empty slot
        const slotSystem = this.folderSlotSystems.get(folderId);
        if (!slotSystem) return;
        
        const emptySlot = slotSystem.findEmptySlot();
        if (!emptySlot) {
            alert('No empty slots available in this folder. Remove some bookmarks first.');
            return;
        }
        
        // Show modal for adding bookmark
        this.openBookmarkModal(folderId, emptySlot);
    }

    openBookmarkModal(folderId, targetSlot) {
        // Create modal if it doesn't exist
        if (!document.getElementById('bookmark-modal')) {
            const modalHTML = `
                <div class="modal-overlay" id="bookmark-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-title">Add Bookmark</div>
                            <button class="modal-close" id="bookmark-modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="bookmark-title">Title:</label>
                                <input type="text" id="bookmark-title" placeholder="Enter bookmark title" maxlength="50">
                            </div>
                            <div class="form-group">
                                <label for="bookmark-url">URL:</label>
                                <input type="url" id="bookmark-url" placeholder="https://example.com">
                                <div class="url-error" id="bookmark-url-error" style="display: none;">Please enter a valid URL</div>
                            </div>
                            <div class="modal-actions">
                                <button id="bookmark-save" class="btn-primary">Save</button>
                                <button id="bookmark-cancel" class="btn-secondary">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.setupModalEvents();
        }
        
        // Store current context
        this.currentFolderId = folderId;
        this.currentTargetSlot = targetSlot;
        
        // Clear and show modal
        document.getElementById('bookmark-title').value = '';
        document.getElementById('bookmark-url').value = '';
        document.getElementById('bookmark-modal').classList.add('active');
        document.getElementById('bookmark-title').focus();
    }

    setupModalEvents() {
        const modal = document.getElementById('bookmark-modal');
        const titleInput = document.getElementById('bookmark-title');
        const urlInput = document.getElementById('bookmark-url');
        const urlError = document.getElementById('bookmark-url-error');
        const saveBtn = document.getElementById('bookmark-save');
        const cancelBtn = document.getElementById('bookmark-cancel');
        const closeBtn = document.getElementById('bookmark-modal-close');
        
        const closeModal = () => {
            modal.classList.remove('active');
            this.currentFolderId = null;
            this.currentTargetSlot = null;
        };
        
        const validateUrl = () => {
            const url = urlInput.value.trim();
            if (!url) {
                urlError.style.display = 'none';
                return true;
            }
            
            try {
                const testUrl = url.startsWith('http') ? url : `https://${url}`;
                new URL(testUrl);
                urlError.style.display = 'none';
                return true;
            } catch (e) {
                urlError.style.display = 'block';
                return false;
            }
        };
        
        const saveBookmark = async () => {
            const title = titleInput.value.trim();
            const url = urlInput.value.trim();
            
            if (!title) {
                alert('Please enter a title for the bookmark');
                titleInput.focus();
                return;
            }
            
            if (!url) {
                alert('Please enter a URL');
                urlInput.focus();
                return;
            }
            
            if (!validateUrl()) {
                urlInput.focus();
                return;
            }
            
            // Ensure URL has protocol
            const finalUrl = url.startsWith('http') ? url : `https://${url}`;
            
            try {
                // Create bookmark in Chrome
                const chromeBookmark = await chrome.bookmarks.create({
                    parentId: this.currentFolderId,
                    title: title,
                    url: finalUrl
                });
                
                // Add to slot system
                const slotSystem = this.folderSlotSystems.get(this.currentFolderId);
                if (slotSystem) {
                    await slotSystem.addItemWithData({
                        id: chromeBookmark.id,
                        title: title,
                        url: finalUrl
                    }, this.currentTargetSlot);
                }
                
                closeModal();
            } catch (error) {
                console.error('Failed to create bookmark:', error);
                alert('Failed to create bookmark');
            }
        };
        
        // Event listeners
        saveBtn.addEventListener('click', saveBookmark);
        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        
        [titleInput, urlInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveBookmark();
            });
        });
        
        urlInput.addEventListener('input', validateUrl);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    setupListeners() {
        // Listen for bookmark changes from Chrome
        chrome.bookmarks.onCreated.addListener((id, bookmark) => {
            // Only reload if it's not created by our modal (to avoid double creation)
            if (!this.currentFolderId) {
                this.loadBookmarks();
            }
        });
        
        chrome.bookmarks.onRemoved.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onChanged.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
            // Handle bookmark moves between Chrome folders
            this.handleBookmarkMove(id, moveInfo);
        });
        
        chrome.bookmarks.onChildrenReordered?.addListener(() => this.loadBookmarks());
    }

    async handleBookmarkMove(bookmarkId, moveInfo) {
        // Remove from old slot system if it exists
        for (const [folderId, slotSystem] of this.folderSlotSystems) {
            const items = slotSystem.getItems();
            const item = items.find(item => item.data && item.data.id === bookmarkId);
            
            if (item) {
                slotSystem.removeItemProgrammatically(item.id);
                break;
            }
        }
        
        // Add to new folder if we have a slot system for it
        const newFolderId = moveInfo.parentId;
        const newSlotSystem = this.folderSlotSystems.get(newFolderId);
        
        if (newSlotSystem) {
            try {
                const [bookmark] = await chrome.bookmarks.get(bookmarkId);
                const emptySlot = newSlotSystem.findEmptySlot();
                
                if (emptySlot && bookmark) {
                    await newSlotSystem.addItemWithData({
                        id: bookmark.id,
                        title: bookmark.title,
                        url: bookmark.url
                    }, emptySlot);
                }
            } catch (error) {
                console.error('Failed to handle bookmark move:', error);
            }
        }
    }

    // Public method to refresh bookmarks
    refresh() {
        return this.loadBookmarks();
    }

    // Get bookmark by ID across all folders
    async getBookmark(bookmarkId) {
        try {
            const bookmarks = await chrome.bookmarks.get(bookmarkId);
            return bookmarks[0];
        } catch (error) {
            console.error('Failed to get bookmark:', error);
            return null;
        }
    }

    // Search bookmarks across all folders
    async searchBookmarks(query) {
        try {
            const results = await chrome.bookmarks.search(query);
            return results;
        } catch (error) {
            console.error('Failed to search bookmarks:', error);
            return [];
        }
    }

    // Get slot system for a specific folder
    getFolderSlotSystem(folderId) {
        return this.folderSlotSystems.get(folderId);
    }

    // Add bookmark programmatically to specific folder and slot
    async addBookmarkToSlot(folderId, slotIndex, bookmarkData) {
        const slotSystem = this.folderSlotSystems.get(folderId);
        if (!slotSystem) {
            console.error(`No slot system found for folder ${folderId}`);
            return false;
        }

        const slotId = `slot-${folderId}-${slotIndex}`;
        const targetSlot = document.querySelector(`[data-slot-id="${slotId}"]`);
        
        if (!targetSlot) {
            console.error(`Slot ${slotId} not found`);
            return false;
        }

        // Check if slot is empty
        if (targetSlot.querySelector('.bookmark-item')) {
            console.error(`Slot ${slotId} is already occupied`);
            return false;
        }

        try {
            // Create bookmark in Chrome first
            const chromeBookmark = await chrome.bookmarks.create({
                parentId: folderId,
                title: bookmarkData.title,
                url: bookmarkData.url
            });

            // Add to slot system
            await slotSystem.addItemWithData({
                id: chromeBookmark.id,
                title: bookmarkData.title,
                url: bookmarkData.url
            }, targetSlot);

            return true;
        } catch (error) {
            console.error('Failed to add bookmark to slot:', error);
            return false;
        }
    }

    // Remove bookmark from slot
    async removeBookmarkFromSlot(folderId, slotIndex) {
        const slotSystem = this.folderSlotSystems.get(folderId);
        if (!slotSystem) return false;

        const slotId = `slot-${folderId}-${slotIndex}`;
        const targetSlot = document.querySelector(`[data-slot-id="${slotId}"]`);
        
        if (!targetSlot) return false;

        const bookmarkElement = targetSlot.querySelector('.bookmark-item');
        if (!bookmarkElement) return false;

        const items = slotSystem.getItems();
        const item = items.find(item => item.id === bookmarkElement.id);
        
        if (item && item.data && item.data.id) {
            try {
                // Remove from Chrome bookmarks
                await chrome.bookmarks.remove(item.data.id);
                
                // Remove from slot system
                slotSystem.removeItemProgrammatically(item.id);
                
                return true;
            } catch (error) {
                console.error('Failed to remove bookmark:', error);
                return false;
            }
        }

        return false;
    }
}

/* –––––––––––––––––––––––––––
  ENHANCED BOOKMARK ITEM WITH CHROME API INTEGRATION
––––––––––––––––––––––––––– */

// Override the bookmark factory to handle Chrome bookmark deletion
class EnhancedBookmarksFactory extends BookmarksFactory {
    async createItem(id, bookmarkData, slotId, position = { x: 0, y: 0 }) {
        const element = await super.createItem(id, bookmarkData, slotId, position);
        
        // Add enhanced remove functionality that also removes from Chrome
        const bookmark = this.activeBookmarks.get(id);
        if (bookmark) {
            bookmark.originalCleanup = bookmark.cleanup;
            bookmark.cleanup = async () => {
                // Remove from Chrome bookmarks if it has a Chrome ID
                if (bookmark.data && bookmark.data.id) {
                    try {
                        await chrome.bookmarks.remove(bookmark.data.id);
                    } catch (error) {
                        console.error('Failed to remove bookmark from Chrome:', error);
                    }
                }
                
                // Call original cleanup
                if (bookmark.originalCleanup) {
                    bookmark.originalCleanup();
                }
            };
        }
        
        return element;
    }
}

/* –––––––––––––––––––––––––––
  INITIALIZATION
––––––––––––––––––––––––––– */

// Create enhanced bookmarks service
const bookmarksService = new BookmarksService();

// Override the factory with enhanced version
bookmarksService.bookmarksFactory = new EnhancedBookmarksFactory();

// Update all slot systems to use enhanced factory
setTimeout(() => {
    for (const [folderId, slotSystem] of bookmarksService.folderSlotSystems) {
        slotSystem.setItemFactory(bookmarksService.bookmarksFactory);
    }
}, 1000);

// Export for use in other modules
export { 
    bookmarksService, 
    BookmarksService, 
    BookmarksFactory, 
    BookmarkItem,
    EnhancedBookmarksFactory 
};