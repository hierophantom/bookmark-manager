/*
File name & path: root/services/bookmarks.js
Role: Modular Chrome bookmarks system with separated concerns
Architecture: 
- FolderSectionManager: Handles folder section creation and management
- SlotManager: Manages slot infrastructure and lifecycle
- ItemPopulator: Handles creation and population of bookmark/folder items
- DragDropManager: General-purpose drag/drop system for slot items
- BookmarksService: Main orchestrator that coordinates all systems
*/

/* –––––––––––––––––––––––––––
  FOLDER SECTION MANAGER
––––––––––––––––––––––––––– */

class FolderSectionManager {
    constructor(bookmarksService) {
        this.bookmarksService = bookmarksService;
        this.folderSections = new Map();
    }

    createFolderSection(folderId, title, parentPath = []) {
        const folderDiv = document.createElement('div');
        folderDiv.id = `folder-section-${folderId}`;
        folderDiv.className = 'folder-section';

        const displayTitle = this.buildDisplayTitle(title, parentPath);

        folderDiv.innerHTML = `
            <div class="folder-header">
                <h3 class="folder-title">${displayTitle}</h3>
                <div class="folder-actions">
                    <span class="folder-action-btn add-folder tooltip-top" data-tooltip="Add folder" aria-expanded="false">
                        <svg width="16" height="16">
                            <use href="#new-folder-icon" />
                        </svg>
                    </span>
                    <span class="folder-action-btn add-bookmark tooltip-top" data-tooltip="Add bookmark" aria-expanded="false">
                        <svg width="16" height="16">
                            <use href="#add-icon" />
                        </svg>
                    </span>
                </div>
            </div>
            <div class="bookmarks" id="bookmarks-${folderId}"></div>
        `;

        this.setupFolderActions(folderDiv, folderId);
        this.folderSections.set(folderId, folderDiv);

        return folderDiv;
    }

    buildDisplayTitle(title, parentPath) {
        const sanitizeTitle = (t) => (!t || t.trim() === '') ? 'Untitled Folder' : t;

        if (parentPath.length > 0) {
            const breadcrumbPath = parentPath
                .map(part => `<span class="subfolder-title">${sanitizeTitle(part)}</span>`)
                .join(' > ');
            return `${breadcrumbPath} > ${sanitizeTitle(title)}`;
        }

        return sanitizeTitle(title);
    }

    setupFolderActions(folderDiv, folderId) {
        const addBookmarkBtn = folderDiv.querySelector('.add-bookmark');
        const addFolderBtn = folderDiv.querySelector('.add-folder');

        addBookmarkBtn.addEventListener('click', () => 
            this.bookmarksService.showAddBookmarkDialog(folderId)
        );
        addFolderBtn.addEventListener('click', () => 
            this.bookmarksService.showAddFolderDialog(folderId)
        );
    }

    getFolderSection(folderId) {
        return this.folderSections.get(folderId);
    }

    clearAllSections() {
        this.folderSections.clear();
    }

    scrollToFolder(folderId) {
        const targetFolder = document.getElementById(`folder-section-${folderId}`);
        const bookmarksWrapper = document.querySelector('.bookmarks-wrapper');
        
        if (targetFolder && bookmarksWrapper) {
            const wrapperRect = bookmarksWrapper.getBoundingClientRect();
            const folderRect = targetFolder.getBoundingClientRect();
            const scrollTop = bookmarksWrapper.scrollTop;
            
            const newScrollTop = scrollTop + folderRect.top - wrapperRect.top;
            
            bookmarksWrapper.scrollTo({
                top: newScrollTop,
                behavior: 'smooth'
            });
            
            // Add highlight effect
            targetFolder.style.background = 'rgba(76, 175, 80, 0.2)';
            setTimeout(() => {
                targetFolder.style.background = '';
            }, 2000);
        }
    }
}

/* –––––––––––––––––––––––––––
  SLOT MANAGER
––––––––––––––––––––––––––– */

class SlotManager {
    constructor() {
        this.slots = new Map(); // folderId -> array of slots
    }

    createSlot(folderId, index, isEmptySlot = false) {
        const slot = document.createElement('div');
        slot.className = `bookmark-slot ${isEmptySlot ? 'empty-slot' : ''}`;
        slot.dataset.folderId = folderId;
        slot.dataset.slotIndex = index;
        slot.dataset.isEmpty = isEmptySlot;

        if (isEmptySlot) {
            this.setupEmptySlot(slot, folderId);
        }

        return slot;
    }

    setupEmptySlot(slot, folderId) {
        slot.innerHTML = `
            <div class="slot-placeholder">
                <div class="slot-icon">
                    <svg width="24" height="24">
                        <use href="#add-icon" />
                    </svg>
                </div>
            </div>
        `;
        slot.title = 'Drop bookmark here or click to add';
    }

    initializeFolderSlots(folderId, itemCount) {
        const slots = [];
        
        // Create regular slots for items
        for (let i = 0; i < itemCount; i++) {
            slots.push(this.createSlot(folderId, i, false));
        }
        
        // Add empty slot at the end
        slots.push(this.createSlot(folderId, itemCount, true));
        
        this.slots.set(folderId, slots);
        return slots;
    }

    getFolderSlots(folderId) {
        return this.slots.get(folderId) || [];
    }

    getSlotAtIndex(folderId, index) {
        const folderSlots = this.getFolderSlots(folderId);
        return folderSlots[index] || null;
    }

    getSlotForItem(itemId) {
        for (const [folderId, slots] of this.slots.entries()) {
            for (const slot of slots) {
                const slotItem = slot.querySelector(`[data-bookmark-id="${itemId}"], [data-folder-id="${itemId}"]`);
                if (slotItem) {
                    return {
                        slot,
                        folderId,
                        index: parseInt(slot.dataset.slotIndex)
                    };
                }
            }
        }
        return null;
    }

    updateSlotIndices(folderId) {
        const folderSlots = this.getFolderSlots(folderId);
        folderSlots.forEach((slot, index) => {
            slot.dataset.slotIndex = index;
        });
    }

    clearAllSlots() {
        this.slots.clear();
    }
}

/* –––––––––––––––––––––––––––
  ITEM POPULATOR
––––––––––––––––––––––––––– */


class ItemPopulator {
    constructor(bookmarksService) {
        this.bookmarksService = bookmarksService;
    }

    async createBookmarkItem(bookmark) {
        const slotItem = document.createElement('div');
        slotItem.className = 'slot-item bookmark-item';
        slotItem.dataset.bookmarkId = bookmark.id;
        slotItem.dataset.url = bookmark.url;
        slotItem.dataset.itemType = 'bookmark';
        slotItem.title = bookmark.title || 'Untitled';
        // Remove draggable attribute - using interact.js instead
        
        const hostname = this.extractHostname(bookmark.url);
        const faviconHtml = this.buildFaviconHtml(hostname, bookmark.title);
        
        slotItem.innerHTML = `
            <div class="slot-icon">${faviconHtml}</div>
            <div class="slot-name">${bookmark.title || 'Untitled'}</div>
            <div class="slot-actions">
                <span class="slot-action edit-btn" title="Edit bookmark">
                    <svg viewBox="0 0 24 24" width="12">
                        <use href="#edit-icon" />
                    </svg>
                </span>
                <span class="slot-action delete-btn" title="Delete bookmark">
                    <svg width="8">
                        <use href="#close-icon" />
                    </svg>
                </span>
            </div>
            <div class="slot-drag-handle" title="Drag to reorder">
                <svg width="16" height="16">
                    <use href="#drag-icon" />
                </svg>
            </div>
        `;
        
        this.setupBookmarkActions(slotItem, bookmark);
        return slotItem;
    }

    async createFolderItem(folder, parentFolderId) {
        const folderSlotItem = document.createElement('div');
        folderSlotItem.className = 'slot-item folder-item';
        folderSlotItem.dataset.folderId = folder.id;
        folderSlotItem.dataset.parentFolderId = parentFolderId;
        folderSlotItem.dataset.itemType = 'folder';
        folderSlotItem.title = folder.title || 'Untitled Folder';
        // Remove draggable attribute - using interact.js instead

        folderSlotItem.innerHTML = `
            <div class="slot-icon">
                <svg viewBox="0 0 40 40" >
                    <use href="#folder-icon" />
                </svg>
            </div>
            <div class="slot-name">${folder.title || 'Untitled Folder'}</div>
            <div class="slot-actions">
                <span class="slot-action edit-btn" title="Edit folder">
                    <svg viewBox="0 0 24 24" width="12">
                        <use href="#edit-icon" />
                    </svg>
                </span>
                <span class="slot-action delete-btn" title="Delete folder">
                    <svg width="8">
                        <use href="#delete-icon" />
                    </svg>
                </span>
            </div>
            <div class="slot-drag-handle" title="Drag to reorder">
                <svg width="16" height="16">
                    <use href="#drag-icon" />
                </svg>
            </div>
        `;

        this.setupFolderActions(folderSlotItem, folder);
        return folderSlotItem;
    }

    setupBookmarkActions(slotItem, bookmark) {
        // Main click handler
        slotItem.addEventListener('click', (e) => {
            if (!e.target.closest('.slot-actions') && !e.target.closest('.slot-drag-handle')) {
                chrome.tabs.create({ url: bookmark.url });
            }
        });
        
        // Action handlers
        const editBtn = slotItem.querySelector('.edit-btn');
        const deleteBtn = slotItem.querySelector('.delete-btn');
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bookmarksService.editBookmark(bookmark);
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bookmarksService.deleteBookmark(bookmark.id, slotItem);
        });
    }

    setupFolderActions(folderSlotItem, folder) {
        // Main click handler - scroll to folder section
        folderSlotItem.addEventListener('click', (e) => {
            if (!e.target.closest('.slot-actions') && !e.target.closest('.slot-drag-handle')) {
                this.bookmarksService.folderSectionManager.scrollToFolder(folder.id);
            }
        });

        // Action handlers
        const editBtn = folderSlotItem.querySelector('.edit-btn');
        const deleteBtn = folderSlotItem.querySelector('.delete-btn');

        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bookmarksService.editFolder(folder);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bookmarksService.deleteFolder(folder.id, folderSlotItem);
        });
    }

    buildFaviconHtml(hostname, title) {
        if (hostname === 'invalid-url') {
            return `<svg width="40" height="40"><use href="#globe-icon" /></svg>`;
        }
        
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        const fallbackIcon = `<svg width="40" height="40"><use href="#globe-icon" /></svg>`;
        
        return `<img src="${faviconUrl}" alt="${title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                <span style="display:none;">${fallbackIcon}</span>`;
    }

    extractHostname(url) {
        try {
            let testUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
            const urlObj = new URL(testUrl);
            const hostname = urlObj.hostname.replace('www.', '');
            
            if (hostname.includes('.') && /^[a-zA-Z0-9.-]+$/.test(hostname)) {
                return hostname;
            }
            return 'invalid-url';
        } catch (e) {
            return 'invalid-url';
        }
    }
}

/* –––––––––––––––––––––––––––
  DRAG DROP MANAGER
––––––––––––––––––––––––––– */

class DragDropManager {
    constructor(bookmarksService) {
        this.bookmarksService = bookmarksService;
        this.draggedItem = null;
        this.dropAction = null;
    }

    initializeSlotItem(slotItem) {
        // Remove any existing drag handlers first
        if (slotItem.hasAttribute('draggable')) {
            slotItem.removeAttribute('draggable');
        }
        
        const itemId = slotItem.dataset.bookmarkId || slotItem.dataset.folderId;
        const itemType = slotItem.dataset.itemType || 'bookmark';
        
        this.addInteractDragHandlers(slotItem, itemId, itemType);
    }

    initializeSlot(slot) {
        const folderId = slot.dataset.folderId;
        const slotIndex = parseInt(slot.dataset.slotIndex);
        const isEmptySlot = slot.dataset.isEmpty === 'true';
        
        this.setupSlotDropZone(slot, folderId, slotIndex, isEmptySlot);
    }

    initializeContainer(container, folderId) {
        this.setupContainerDropZone(container, folderId);
    }

    addInteractDragHandlers(element, itemId, itemType) {
        // Store reference to this for use in interact callbacks
        const self = this;
        
        // Make sure interact is available
        if (typeof interact === 'undefined') {
            console.error('interact.js is not loaded!');
            return;
        }
        
        // Make items draggable only from the handle
        interact(element)
            .draggable({
                // Only allow dragging from the handle
                allowFrom: '.slot-drag-handle',
                
                // Enable inertial throwing
                inertia: false,
                
                // Keep the element within its parent
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent',
                        endOnly: true
                    })
                ],
                
                // Enable autoScroll
                autoScroll: true,
                
                // Call this function on every dragmove event
                listeners: {
                    start: function(event) {
                        const target = event.target;
                        target.classList.add('dragging');
                        self.draggedItem = target;
                        
                        // Store drag data
                        target.dataset.dragItemId = itemId;
                        target.dataset.dragSourceFolderId = target.closest('.bookmarks').id.replace('bookmarks-', '');
                        target.dataset.dragItemType = itemType;
                        
                        // Show all empty slots when dragging starts
                        self.showEmptySlots();
                    },
                    move: dragMoveListener,
                    end: function(event) {
                        const target = event.target;
                        target.classList.remove('dragging');
                        self.clearAllDropIndicators();
                        self.draggedItem = null;
                        
                        // Clean up drag data
                        delete target.dataset.dragItemId;
                        delete target.dataset.dragSourceFolderId;
                        delete target.dataset.dragItemType;
                        
                        // Hide all empty slots when dragging ends
                        self.hideEmptySlots();
                    }
                }
            });

        function dragMoveListener(event) {
            const target = event.target;
            
            // Get the current position
            const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
            const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
            
            // Translate the element
            target.style.transform = `translate(${x}px, ${y}px)`;
            
            // Update the position attributes
            target.setAttribute('data-x', x);
            target.setAttribute('data-y', y);
        }
    }

    showEmptySlots() {
        document.querySelectorAll('.empty-slot').forEach(slot => {
            slot.classList.add('visible');
        });
    }

    hideEmptySlots() {
        document.querySelectorAll('.empty-slot').forEach(slot => {
            slot.classList.remove('visible');
        });
    }

    setupSlotDropZone(slot, folderId, slotIndex, isEmptySlot) {
        // Store reference to this for use in interact callbacks
        const self = this;
        
        // Set up dropzones
        interact(slot)
            .dropzone({
                // Only accept elements matching this CSS selector
                accept: '.slot-item',
                
                // Require a 50% element overlap for a drop to be possible
                overlap: 0.5,
                
                // Listen for drop related events
                listeners: {
                    activate: function(event) {
                        event.target.classList.add('drop-active');
                    },
                    
                    dragenter: function(event) {
                        const dropzone = event.target;
                        dropzone.classList.add('drop-target');
                        
                        if (!isEmptySlot) {
                            // Check if the slot already has an item
                            const existingItem = Array.from(dropzone.children).find(
                                child => child !== event.relatedTarget && child.classList.contains('slot-item')
                            );
                            
                            // If there's an existing item, highlight it for swap
                            if (existingItem) {
                                existingItem.classList.add('swap-target');
                            }
                        } 
                    },
                    
                    dragleave: function(event) {
                        const dropzone = event.target;
                        dropzone.classList.remove('drop-target');
                        
                        // Remove swap highlight from any items
                        dropzone.querySelectorAll('.swap-target').forEach(el => {
                            el.classList.remove('swap-target');
                        });
                        
                        if (isEmptySlot) {
                            self.clearSlotDropIndicator(slot);
                        }
                    },
                    
                    drop: async function(event) {
                        const dropzone = event.target;
                        const draggable = event.relatedTarget;
                        
                        const bookmarkId = draggable.dataset.dragItemId;
                        if (bookmarkId) {
                            try {
                                if (isEmptySlot) {
                                    await self.handleEmptySlotDrop(bookmarkId, folderId);
                                } else {
                                    // Check if the slot already has an item
                                    const existingItem = Array.from(dropzone.children).find(
                                        child => child !== draggable && child.classList.contains('slot-item')
                                    );
                                    
                                    if (existingItem) {
                                        // Perform a swap
                                        await self.swapItems(draggable, existingItem, dropzone);
                                    } else {
                                        // Move to empty slot
                                        await self.moveItemToSlot(draggable, dropzone, folderId, slotIndex);
                                    }
                                }
                            } catch (error) {
                                console.error('Failed to move item in slot:', error);
                            }
                        }
                        
                        self.clearSlotDropIndicator(dropzone);
                    },
                    
                    deactivate: function(event) {
                        const dropzone = event.target;
                        dropzone.classList.remove('drop-active');
                        dropzone.classList.remove('drop-target');
                        
                        // Remove swap highlight from any items
                        dropzone.querySelectorAll('.swap-target').forEach(el => {
                            el.classList.remove('swap-target');
                        });
                        
                        if (isEmptySlot) {
                            self.clearSlotDropIndicator(dropzone);
                        }
                    }
                }
            });
    }

    setupContainerDropZone(container, folderId) {
        // Store reference to this for use in interact callbacks
        const self = this;
        
        // Set up container dropzone
        interact(container)
            .dropzone({
                accept: '.slot-item',
                overlap: 0.1,
                
                listeners: {
                    dragenter: function(event) {
                        if (event.target === container) {
                            container.classList.add('drag-over');
                        }
                    },
                    
                    dragleave: function(event) {
                        if (event.target === container && !container.contains(event.relatedTarget)) {
                            container.classList.remove('drag-over');
                        }
                    },
                    
                    drop: async function(event) {
                        if (event.target === container) {
                            container.classList.remove('drag-over');
                            
                            const draggable = event.relatedTarget;
                            const bookmarkId = draggable.dataset.dragItemId;
                            if (bookmarkId) {
                                try {
                                    await self.handleEmptySlotDrop(bookmarkId, folderId);
                                } catch (error) {
                                    console.error('Failed to move item to container:', error);
                                }
                            }
                        }
                    }
                }
            });
    }

    clearSlotDropIndicator(slot) {
        slot.classList.remove('drop-before', 'drop-after', 'drop-swap');
        slot.style.borderColor = '';
        slot.style.background = '';
        delete slot.dropAction;
    }

    clearAllDropIndicators() {
        document.querySelectorAll('.drag-over, .drop-before, .drop-after, .drop-swap').forEach(el => {
            el.classList.remove('drag-over', 'drop-before', 'drop-after', 'drop-swap');
        });
    }

    async handleEmptySlotDrop(bookmarkId, folderId) {
        const targetItems = await chrome.bookmarks.getChildren(folderId);
        await chrome.bookmarks.move(bookmarkId, {
            parentId: folderId,
            index: targetItems.length
        });
    }

    async moveItemToSlot(draggable, dropzone, folderId, targetSlotIndex) {
        const draggedItemId = draggable.dataset.dragItemId;
        const targetItems = await chrome.bookmarks.getChildren(folderId);
        
        // Move the draggable element to the drop target
        const originalSlot = draggable.parentNode;
        if (originalSlot) {
            originalSlot.removeChild(draggable);
        }
        
        dropzone.appendChild(draggable);
        
        // Reset the transform and position with animation
        draggable.style.transition = 'transform 0.3s ease';
        draggable.style.transform = 'translate(0, 0)';
        draggable.setAttribute('data-x', 0);
        draggable.setAttribute('data-y', 0);
        
        setTimeout(() => {
            draggable.style.transition = '';
        }, 300);
        
        // Update bookmark position in Chrome bookmarks
        let newIndex = targetSlotIndex;
        
        // Adjust index if moving within same folder
        const [draggedItem] = await chrome.bookmarks.get(draggedItemId);
        if (draggedItem.parentId === folderId) {
            const currentIndex = targetItems.findIndex(item => item.id === draggedItemId);
            if (currentIndex < targetSlotIndex) {
                newIndex--;
            }
        }
        
        await chrome.bookmarks.move(draggedItemId, {
            parentId: folderId,
            index: newIndex
        });
    }

    async swapItems(draggedItem, existingItem, dropzone) {
        const originalSlot = draggedItem.parentNode;
        const draggedItemId = draggedItem.dataset.dragItemId || draggedItem.dataset.bookmarkId || draggedItem.dataset.folderId;
        const existingItemId = existingItem.dataset.bookmarkId || existingItem.dataset.folderId;
        
        // Swap the items in DOM
        originalSlot.appendChild(existingItem);
        dropzone.appendChild(draggedItem);
        
        // Reset positions for both items with animation
        [draggedItem, existingItem].forEach(item => {
            item.style.transition = 'transform 0.3s ease';
            item.style.transform = 'translate(0, 0)';
            item.setAttribute('data-x', 0);
            item.setAttribute('data-y', 0);
            item.classList.remove('swap-target');
            
            setTimeout(() => {
                item.style.transition = '';
            }, 300);
        });
        
        // Swap items in Chrome bookmarks
        await this.swapBookmarkItems(draggedItemId, existingItemId);
    }

    async swapBookmarkItems(itemId1, itemId2) {
        const [item1] = await chrome.bookmarks.get(itemId1);
        const [item2] = await chrome.bookmarks.get(itemId2);

        const parentItems1 = await chrome.bookmarks.getChildren(item1.parentId);
        const parentItems2 = await chrome.bookmarks.getChildren(item2.parentId);
        
        const index1 = parentItems1.findIndex(item => item.id === itemId1);
        const index2 = parentItems2.findIndex(item => item.id === itemId2);

        if (item1.parentId === item2.parentId) {
            // Same folder swap
            await chrome.bookmarks.move(itemId1, { index: index2 });
            await chrome.bookmarks.move(itemId2, { index: index1 });
        } else {
            // Different folder swap
            await chrome.bookmarks.move(itemId1, {
                parentId: item2.parentId,
                index: index2
            });
            await chrome.bookmarks.move(itemId2, {
                parentId: item1.parentId,
                index: index1
            });
        }
    }
}

/* –––––––––––––––––––––––––––
  MAIN BOOKMARKS SERVICE
––––––––––––––––––––––––––– */

class BookmarksService {
    constructor() {
        this.bookmarksContainer = null;
        
        // Initialize subsystems
        this.folderSectionManager = new FolderSectionManager(this);
        this.slotManager = new SlotManager();
        this.itemPopulator = new ItemPopulator(this);
        this.dragDropManager = new DragDropManager(this);
        
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
            const bookmarksTree = await chrome.bookmarks.getTree();
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
        this.folderSectionManager.clearAllSections();
        this.slotManager.clearAllSlots();

        // Create root folder section
        const rootFolder = this.folderSectionManager.createFolderSection(
            bookmarkNode.id, 
            'Bookmarks bar', 
            []
        );
        this.bookmarksContainer.appendChild(rootFolder);
        await this.populateFolder(bookmarkNode.id, bookmarkNode.children);

        // Process subfolders recursively
        const folders = bookmarkNode.children.filter(child => child.children);
        for (const folder of folders) {
            await this.processFolderHierarchy(folder, []);
        }
    }

    async processFolderHierarchy(folder, parentPath) {
        const currentPath = [...parentPath, folder.title];
        const folderElement = this.folderSectionManager.createFolderSection(
            folder.id, 
            folder.title, 
            parentPath
        );
        this.bookmarksContainer.appendChild(folderElement);

        await this.populateFolder(folder.id, folder.children);

        // Recursively process subfolders
        const subfolders = folder.children.filter(child => child.children);
        for (const subfolder of subfolders) {
            await this.processFolderHierarchy(subfolder, currentPath);
        }
    }

    async populateFolder(folderId, items) {
        const container = document.getElementById(`bookmarks-${folderId}`);
        if (!container) return;

        container.innerHTML = '';

        // Initialize slots for this folder
        const slots = this.slotManager.initializeFolderSlots(folderId, items.length);
        
        // Populate slots with items
        for (let i = 0; i < items.length; i++) {
            const slot = slots[i];
            const item = items[i];
            
            container.appendChild(slot);
            
            let slotItem;
            if (item.children) {
                slotItem = await this.itemPopulator.createFolderItem(item, folderId);
            } else {
                slotItem = await this.itemPopulator.createBookmarkItem(item);
            }
            
            slot.appendChild(slotItem);
            
            // Initialize drag/drop for the slot and its item
            this.dragDropManager.initializeSlot(slot);
            this.dragDropManager.initializeSlotItem(slotItem);
        }

        // Add empty slot at the end
        const emptySlot = slots[items.length];
        container.appendChild(emptySlot);
        this.dragDropManager.initializeSlot(emptySlot);
        
        // Setup empty slot click handler
        emptySlot.addEventListener('click', () => this.showAddBookmarkDialog(folderId));

        // Initialize container-level drop zone
        this.dragDropManager.initializeContainer(container, folderId);
    }

    // Dialog methods remain the same
    showAddBookmarkDialog(folderId) {
        const dialog = document.createElement('div');
        dialog.className = 'bookmark-dialog';
        dialog.innerHTML = `
            <div class="bookmark-dialog-content">
                <h3>Add Bookmark</h3>
                <div class="bookmark-dialog-field">
                    <label for="bookmark-url">URL *</label>
                    <input type="url" id="bookmark-url" placeholder="https://example.com" required>
                </div>
                <div class="bookmark-dialog-field">
                    <label for="bookmark-name">Name</label>
                    <input type="text" id="bookmark-name" placeholder="Bookmark name (optional)">
                </div>
                <div class="bookmark-dialog-actions">
                    <button class="bookmark-dialog-btn secondary" onclick="this.closest('.bookmark-dialog').remove()">Cancel</button>
                    <button class="bookmark-dialog-btn primary" id="add-bookmark-confirm">Add</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const urlInput = dialog.querySelector('#bookmark-url');
        const nameInput = dialog.querySelector('#bookmark-name');
        const confirmBtn = dialog.querySelector('#add-bookmark-confirm');

        urlInput.focus();

        confirmBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            const name = nameInput.value.trim();

            if (!url) {
                urlInput.focus();
                return;
            }

            try {
                let validUrl = url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;
                new URL(validUrl);

                await chrome.bookmarks.create({
                    parentId: folderId,
                    title: name || validUrl,
                    url: validUrl
                });
                dialog.remove();
            } catch (error) {
                console.error('Failed to create bookmark:', error);
                alert('Failed to create bookmark. Please check the URL format.');
            }
        });

        [urlInput, nameInput].forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') confirmBtn.click();
            });
        });

        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') dialog.remove();
        });

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });
    }

    showAddFolderDialog(parentFolderId) {
        const dialog = document.createElement('div');
        dialog.className = 'bookmark-dialog';
        dialog.innerHTML = `
            <div class="bookmark-dialog-content">
                <h3>Add Folder</h3>
                <div class="bookmark-dialog-field">
                    <label for="folder-name">Name</label>
                    <input type="text" id="folder-name" placeholder="Folder name (optional)">
                </div>
                <div class="bookmark-dialog-actions">
                    <button class="bookmark-dialog-btn secondary" onclick="this.closest('.bookmark-dialog').remove()">Cancel</button>
                    <button class="bookmark-dialog-btn primary" id="add-folder-confirm">Add</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const nameInput = dialog.querySelector('#folder-name');
        const confirmBtn = dialog.querySelector('#add-folder-confirm');

        nameInput.focus();

        confirmBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();

            try {
                await chrome.bookmarks.create({
                    parentId: parentFolderId,
                    title: name
                });
                dialog.remove();
            } catch (error) {
                console.error('Failed to create folder:', error);
                alert('Failed to create folder.');
            }
        });

        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        });

        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') dialog.remove();
        });

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });
    }

    async editBookmark(bookmark) {
        const newTitle = prompt('Edit bookmark name:', bookmark.title);
        if (newTitle !== null && newTitle.trim() !== '') {
            try {
                await chrome.bookmarks.update(bookmark.id, {
                    title: newTitle.trim()
                });
            } catch (error) {
                console.error('Failed to update bookmark:', error);
                alert('Failed to update bookmark');
            }
        }
    }

    async editFolder(folder) {
        const newTitle = prompt('Edit folder name:', folder.title);
        if (newTitle !== null && newTitle.trim() !== '') {
            try {
                await chrome.bookmarks.update(folder.id, {
                    title: newTitle.trim()
                });
            } catch (error) {
                console.error('Failed to update folder:', error);
                alert('Failed to update folder');
            }
        }
    }

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

    async deleteFolder(folderId, element) {
        if (confirm('Are you sure you want to delete this folder and all its contents?')) {
            try {
                element.style.transition = 'opacity 0.3s ease';
                element.style.opacity = '0';

                await chrome.bookmarks.removeTree(folderId);
            } catch (error) {
                console.error('Failed to delete folder:', error);
                alert('Failed to delete folder');
                element.style.opacity = '1';
            }
        }
    }

    setupListeners() {
        chrome.bookmarks.onCreated.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onRemoved.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onChanged.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onMoved.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onChildrenReordered?.addListener(() => this.loadBookmarks());
    }

    // Public API methods
    refresh() {
        return this.loadBookmarks();
    }

    async getBookmark(bookmarkId) {
        try {
            const bookmarks = await chrome.bookmarks.get(bookmarkId);
            return bookmarks[0];
        } catch (error) {
            console.error('Failed to get bookmark:', error);
            return null;
        }
    }

    async searchBookmarks(query) {
        try {
            const results = await chrome.bookmarks.search(query);
            return results;
        } catch (error) {
            console.error('Failed to search bookmarks:', error);
            return [];
        }
    }

    // Expose subsystem APIs for external use
    getSlotManager() {
        return this.slotManager;
    }

    getDragDropManager() {
        return this.dragDropManager;
    }

    getFolderSectionManager() {
        return this.folderSectionManager;
    }

    getItemPopulator() {
        return this.itemPopulator;
    }
}

// Initialize and export
const bookmarksService = new BookmarksService();

export {
    bookmarksService,
    FolderSectionManager,
    SlotManager,
    ItemPopulator,
    DragDropManager
};