// services/bookmarks.js
import { SlotFactory }from '../slots-system/slots.js';

class BookmarksService {
    constructor() {
        this.bookmarksContainer = null;
        this.slotFactories = new Map();
        this.init();
    }

    async init() {
        await this.waitForDOM();
        this.bookmarksContainer = document.querySelector('.bookmarks-container');
        
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
            
            // Process the root bookmark bar (usually bookmarksTree[0].children[0])
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
        
        // Create folder for root level bookmarks
        const rootFolder = this.createBookmarkFolder(bookmarkNode.id, 'Bookmarks');
        this.bookmarksContainer.appendChild(rootFolder);
        
        // Process children
        if (bookmarkNode.children) {
            for (const child of bookmarkNode.children) {
                if (child.children) {
                    // It's a folder
                    const folderElement = this.createBookmarkFolder(child.id, child.title);
                    this.bookmarksContainer.appendChild(folderElement);
                    
                    // Process folder contents
                    await this.populateFolder(child.id, child.children);
                }
            }
            
            // Add root level bookmarks (not in folders)
            const rootBookmarks = bookmarkNode.children.filter(child => !child.children);
            if (rootBookmarks.length > 0) {
                await this.populateFolder(bookmarkNode.id, rootBookmarks);
            }
        }
    }

    createBookmarkFolder(folderId, title) {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'bookmarks-folder';
        folderDiv.innerHTML = `
            <h3 class="folder-title">${title}</h3>
            <div class="bookmarks" id="bookmarks-${folderId}"></div>
        `;
        return folderDiv;
    }

    async populateFolder(folderId, bookmarks) {
        
        const container = document.getElementById(`bookmarks-${folderId}`);
        if (!container) return;

        // Create or get slot factory for this folder
        let factory = this.slotFactories.get(folderId);
        if (!factory) {
            factory = window.slotFactory(container);
            this.slotFactories.set(folderId, factory);
        }

        // Clear existing slots
        factory.clearSlots();

        // Add bookmarks as slots
        for (const bookmark of bookmarks) {
            if (!bookmark.children) { // Only process actual bookmarks, not folders
                const slotData = await this.createBookmarkSlotData(bookmark);
                factory.addSlot(slotData);
            }
        }
    }

    async createBookmarkSlotData(bookmark) {
        const faviconUrl = await this.getFaviconUrl(bookmark.url);
        
        return {
            id: bookmark.id,
            name: bookmark.title || 'Untitled',
            image: faviconUrl,
            clickAction: () => {
                chrome.tabs.create({ url: bookmark.url });
            }
        };
    }

    async getFaviconUrl(url) {
        if (!url) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23666"/></svg>';
        
        try {
            // Use Google's favicon service as it's more reliable
            return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
        } catch {
            // Fallback for invalid URLs
            return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23666"/></svg>';
        }
    }

    setupListeners() {
        // Listen for bookmark changes
        chrome.bookmarks.onCreated.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onRemoved.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onChanged.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onMoved.addListener(() => this.loadBookmarks());
        
        // Listen for bookmark reordering
        chrome.bookmarks.onChildrenReordered?.addListener(() => this.loadBookmarks());
    }

    // Public method to refresh bookmarks
    refresh() {
        return this.loadBookmarks();
    }
}

// Initialize the service
const bookmarksService = new BookmarksService();

// Export for use in other modules
export { bookmarksService };