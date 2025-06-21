// services/bookmarks.js
// Clean slot-based system that only shows actual Chrome bookmarks + 1 empty slot

import { SlotSystem } from '../slots-system/slots.js';

/* –––––––––––––––––––––––––––
  BOOKMARKS FACTORY
––––––––––––––––––––––––––– */

class BookmarksFactory {
    constructor() {
        this.activeBookmarks = new Map();
    }
    
    async createItem(id, bookmarkData, slotId, position = { x: 0, y: 0 }) {
        const element = document.createElement('div');
        element.id = id;
        element.className = 'bookmark-item';
        element.dataset.slotId = slotId;
        
        if (position) {
            element.style.transform = `translate(${position.x}px, ${position.y}px)`;
            element.setAttribute('data-x', position.x);
            element.setAttribute('data-y', position.y);
        }
        
        const bookmark = new BookmarkItem(element, { id, data: bookmarkData, slotId });
        this.activeBookmarks.set(id, bookmark);
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
        this.element.innerHTML = `
            <div class="bookmark-item-content">
                ${this.getContent()}
            </div>
        `;
        this.bindEvents();
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
            this.element.addEventListener('click', (e) => {
                if (!e.target.closest('.bookmark-item-controls')) {
                    chrome.tabs.create({ url: this.data.url });
                }
            });
        }

        // ADD DRAG AND DROP HANDLERS
        this.element.draggable = true;
        
        this.element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('bookmarkId', this.data.id);
            e.dataTransfer.setData('sourceFolderId', this.element.closest('.bookmark-slots-container').id.replace('bookmark-slots-', ''));
            this.element.classList.add('dragging');
            
            // Store reference for later use
            window.draggedBookmarkElement = this.element;
        });
        
        this.element.addEventListener('dragend', (e) => {
            this.element.classList.remove('dragging');
            
            // Remove all drag indicators
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            document.querySelectorAll('.drag-before').forEach(el => el.classList.remove('drag-before'));
            document.querySelectorAll('.drag-after').forEach(el => el.classList.remove('drag-after'));
            document.querySelectorAll('.drag-swap').forEach(el => el.classList.remove('drag-swap'));
            
            window.draggedBookmarkElement = null;
        });
        
        // Drag over for reordering within slots
        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!window.draggedBookmarkElement || window.draggedBookmarkElement === this.element) return;
            
            const rect = this.element.getBoundingClientRect();
            const relativeX = (e.clientX - rect.left) / rect.width;
            
            // Remove previous indicators
            this.element.classList.remove('drag-before', 'drag-after', 'drag-swap');
            
            // Determine drop zone: before (0-25%), swap (25-75%), after (75-100%)
            if (relativeX < 0.25) {
                this.element.classList.add('drag-before');
                window.dropAction = 'before';
            } else if (relativeX > 0.75) {
                this.element.classList.add('drag-after');
                window.dropAction = 'after';
            } else {
                this.element.classList.add('drag-swap');
                window.dropAction = 'swap';
            }
        });
        
        this.element.addEventListener('dragleave', (e) => {
            this.element.classList.remove('drag-before', 'drag-after', 'drag-swap');
        });
        
        this.element.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const bookmarkId = e.dataTransfer.getData('bookmarkId');
            const sourceFolderId = e.dataTransfer.getData('sourceFolderId');
            
            if (!bookmarkId || !window.draggedBookmarkElement || !this.data) return;
            
            try {
                const parentId = this.element.closest('.bookmark-slots-container').id.replace('bookmark-slots-', '');
                
                if (window.dropAction === 'swap') {
                    // Swap the two bookmarks
                    const targetBookmarkId = this.data.id;
                    
                    // Get both bookmarks
                    const [sourceBookmark] = await chrome.bookmarks.get(bookmarkId);
                    const [targetBookmark] = await chrome.bookmarks.get(targetBookmarkId);
                    
                    // Get their parent folders
                    const sourceParent = await chrome.bookmarks.getChildren(sourceBookmark.parentId);
                    const targetParent = await chrome.bookmarks.getChildren(targetBookmark.parentId);
                    
                    // Find their indices
                    const sourceIndex = sourceParent.findIndex(b => b.id === bookmarkId);
                    const targetIndex = targetParent.findIndex(b => b.id === targetBookmarkId);
                    
                    // Perform the swap
                    if (sourceBookmark.parentId === targetBookmark.parentId) {
                        // Same folder swap
                        await chrome.bookmarks.move(bookmarkId, { index: targetIndex });
                        await chrome.bookmarks.move(targetBookmarkId, { index: sourceIndex });
                    } else {
                        // Different folder swap
                        await chrome.bookmarks.move(bookmarkId, { 
                            parentId: targetBookmark.parentId, 
                            index: targetIndex 
                        });
                        await chrome.bookmarks.move(targetBookmarkId, { 
                            parentId: sourceBookmark.parentId, 
                            index: sourceIndex 
                        });
                    }
                } else {
                    // Insert before or after
                    const targetFolder = await chrome.bookmarks.getChildren(parentId);
                    const targetIndex = targetFolder.findIndex(b => b.id === this.data.id);
                    
                    let newIndex = window.dropAction === 'before' ? targetIndex : targetIndex + 1;
                    
                    // If moving within the same folder and moving down, adjust index
                    if (sourceFolderId === parentId) {
                        const currentIndex = targetFolder.findIndex(b => b.id === bookmarkId);
                        if (currentIndex < targetIndex) {
                            newIndex--;
                        }
                    }
                    
                    // Move the bookmark
                    await chrome.bookmarks.move(bookmarkId, {
                        parentId: parentId,
                        index: newIndex
                    });
                }
                
            } catch (error) {
                console.error('Failed to reorder bookmark:', error);
            }
            
            // Clean up
            this.element.classList.remove('drag-before', 'drag-after', 'drag-swap');
        });
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
        this.folderSlotSystems = new Map();
        this.bookmarksFactory = new BookmarksFactory();
        this.isLoading = false;
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
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const bookmarksTree = await chrome.bookmarks.getTree();
            const bookmarkBar = bookmarksTree[0].children.find(child => child.title === 'Bookmarks Bar');
            
            if (bookmarkBar) {
                await this.renderBookmarks(bookmarkBar);
            }
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
        } finally {
            this.isLoading = false;
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
        const bookmarks = folder.children.filter(child => !child.children);
        await this.createBookmarkFolder(folder.id, folder.title, parentPath, bookmarks);
        
        // Recursively process any subfolders
        const subfolders = folder.children.filter(child => child.children);
        for (const subfolder of subfolders) {
            await this.processFolderHierarchy(subfolder, [...parentPath, folder.title]);
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
        
        // Calculate slots: actual bookmarks + 1 empty slot (minimum 1)
        const slotsCount = Math.max(1, bookmarks.length + 1);
        
        // Create slots HTML
        const slotsHTML = Array.from({ length: slotsCount }, (_, index) => 
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
            </div>
        `;
        
        this.bookmarksContainer.appendChild(folderDiv);
        
        // Initialize slot system WITHOUT localStorage to prevent duplicates
        await this.initializeFolderSlotSystem(folderId, bookmarks);
        
        // Add event listeners
        const addBtn = folderDiv.querySelector('.add-bookmark-btn');
        addBtn.addEventListener('click', () => this.addBookmark(folderId));
    }

    async initializeFolderSlotSystem(folderId, bookmarks) {
        // Create SlotSystem but DISABLE localStorage completely
        const slotSystem = new SlotSystem({
            storageKey: `temp-${folderId}-${Date.now()}`, // Unique key that won't persist
            slotSelector: `#bookmark-slots-${folderId} .bookmark-slot`,
            containerSelector: `#bookmark-slots-${folderId}`,
            itemClass: 'bookmark-item'
        });
        
        // Override the loadItems method to prevent loading from localStorage
        slotSystem.loadItems = async () => {
            // Do nothing - we'll populate manually
        };
        
        // Override the saveItems method to prevent saving to localStorage
        slotSystem.saveItems = () => {
            // Do nothing - we don't want to save
        };
        
        slotSystem.setItemFactory(this.bookmarksFactory);
        this.folderSlotSystems.set(folderId, slotSystem);
        
        // Manually populate ONLY the actual Chrome bookmarks
        for (let i = 0; i < bookmarks.length; i++) {
            const bookmark = bookmarks[i];
            const slotId = `slot-${folderId}-${i}`;
            const targetSlot = document.querySelector(`[data-slot-id="${slotId}"]`);
            
            if (targetSlot) {
                // Create bookmark element directly
                const bookmarkElement = await this.bookmarksFactory.createItem(
                    `bookmark-${bookmark.id}`, 
                    {
                        id: bookmark.id,
                        title: bookmark.title,
                        url: bookmark.url
                    }, 
                    slotId
                );
                
                if (bookmarkElement) {
                    targetSlot.appendChild(bookmarkElement);
                    
                    // Add to slot system's items array manually
                    slotSystem.items.push({
                        id: `bookmark-${bookmark.id}`,
                        data: {
                            id: bookmark.id,
                            title: bookmark.title,
                            url: bookmark.url
                        },
                        slotId: slotId,
                        position: { x: 0, y: 0 }
                    });
                }
            }
        }
        
        // The last slot (index = bookmarks.length) remains empty for new bookmarks
        
        // Setup drop zones for empty slots
        this.setupEmptySlotDropZones(folderId);
    }
        
    setupEmptySlotDropZones(folderId) {
        // Find ALL slots in this folder
        const allSlots = document.querySelectorAll(`#bookmark-slots-${folderId} .bookmark-slot`);
        
        allSlots.forEach(slot => {
            // Setup drop zone for empty slots only
            if (!slot.querySelector('.bookmark-item')) {
                this.setupSingleEmptySlotDropZone(slot, folderId);
            }
        });
    }
    
    setupSingleEmptySlotDropZone(slot, folderId) {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Add visual feedback for empty slot
            slot.classList.add('drag-over');
            slot.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
            slot.style.border = '2px dashed #4CAF50';
        });
        
        slot.addEventListener('dragleave', (e) => {
            // Only remove if we're truly leaving the slot
            if (!slot.contains(e.relatedTarget)) {
                slot.classList.remove('drag-over');
                slot.style.backgroundColor = '';
                slot.style.border = '';
            }
        });
        
        slot.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Remove visual feedback
            slot.classList.remove('drag-over');
            slot.style.backgroundColor = '';
            slot.style.border = '';
            
            const bookmarkId = e.dataTransfer.getData('bookmarkId');
            const sourceFolderId = e.dataTransfer.getData('sourceFolderId');
            
            if (!bookmarkId) return;
            
            try {
                // Get current bookmarks in the target folder to calculate correct index
                const currentBookmarks = await chrome.bookmarks.getChildren(folderId);
                const actualBookmarks = currentBookmarks.filter(b => !b.children); // Only actual bookmarks, not folders
                
                // Calculate the target index based on slot position
                const slotId = slot.dataset.slotId;
                const slotIndex = parseInt(slotId.split('-').pop());
                
                // The correct index should be the number of actual bookmarks if dropping in the "extra" empty slot
                // OR the slotIndex if it's a gap between existing bookmarks
                let targetIndex;
                
                if (slotIndex >= actualBookmarks.length) {
                    // Dropping in the "extra" empty slot - should go at the end
                    targetIndex = actualBookmarks.length;
                } else {
                    // Dropping in a gap between existing bookmarks
                    targetIndex = slotIndex;
                }
                
                // If moving within the same folder, adjust index to account for the item being removed first
                if (sourceFolderId === folderId) {
                    const draggedBookmarkCurrentIndex = actualBookmarks.findIndex(b => b.id === bookmarkId);
                    if (draggedBookmarkCurrentIndex !== -1 && draggedBookmarkCurrentIndex < targetIndex) {
                        targetIndex--; // Adjust because the dragged item will be removed first
                    }
                }
                
                // Move bookmark to the calculated position
                await chrome.bookmarks.move(bookmarkId, { 
                    parentId: folderId,
                    index: targetIndex
                });
                
                console.log(`Moved bookmark ${bookmarkId} to folder ${folderId} at index ${targetIndex} (slot ${slotIndex})`);
                
            } catch (error) {
                console.error('Failed to move bookmark to empty slot:', error);
                alert('Failed to move bookmark');
            }
        });
    }
    // Also add this method to refresh empty slot drop zones after bookmark changes:
    
    refreshEmptySlotDropZones(folderId) {
        // Remove old event listeners by cloning and replacing slots
        const container = document.getElementById(`bookmark-slots-${folderId}`);
        if (!container) return;
        
        // Re-setup drop zones for all empty slots
        this.setupEmptySlotDropZones(folderId);
    }
    
    // Call this method at the end of initializeFolderSlotSystem:
    // this.setupEmptySlotDropZones(folderId);
    setupListeners() {
        // Simple debounced reload
        let timeout;
        const debouncedReload = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => this.loadBookmarks(), 300);
        };
        
        chrome.bookmarks.onCreated.addListener(debouncedReload);
        chrome.bookmarks.onRemoved.addListener(debouncedReload);
        chrome.bookmarks.onChanged.addListener(debouncedReload);
        chrome.bookmarks.onMoved.addListener(debouncedReload);
        chrome.bookmarks.onChildrenReordered?.addListener(debouncedReload);
    }

    // Add new bookmark to a folder
    async addBookmark(folderId) {
        const url = prompt('Enter URL:');
        if (!url) return;
        
        const title = prompt('Enter bookmark name:');
        if (!title) return;
        
        try {
            await chrome.bookmarks.create({
                parentId: folderId,
                title: title.trim(),
                url: url.trim()
            });
            // The onCreated listener will trigger a reload
        } catch (error) {
            console.error('Failed to create bookmark:', error);
            alert('Failed to create bookmark');
        }
    }

    // Edit bookmark
    async editBookmark(bookmark) {
        const newTitle = prompt('Edit bookmark name:', bookmark.title);
        if (newTitle !== null && newTitle.trim() !== '') {
            try {
                await chrome.bookmarks.update(bookmark.id, { title: newTitle.trim() });
            } catch (error) {
                console.error('Failed to update bookmark:', error);
                alert('Failed to update bookmark');
            }
        }
    }

    // Delete bookmark
    async deleteBookmark(bookmarkId, element) {
        if (confirm('Are you sure you want to delete this bookmark?')) {
            try {
                element.style.transition = 'opacity 0.3s ease';
                element.style.opacity = '0';
                
                await chrome.bookmarks.remove(bookmarkId);
            } catch (error) {
                console.error('Failed to delete bookmark:', error);
                alert('Failed to delete bookmark');
                element.style.opacity = '1';
            }
        }
    }

    // Public method to refresh bookmarks
    refresh() {
        return this.loadBookmarks();
    }

    // Get bookmark by ID
    async getBookmark(bookmarkId) {
        try {
            const bookmarks = await chrome.bookmarks.get(bookmarkId);
            return bookmarks[0];
        } catch (error) {
            console.error('Failed to get bookmark:', error);
            return null;
        }
    }
}

// Initialize the service
const bookmarksService = new BookmarksService();

// Export for use in other modules
export { bookmarksService };