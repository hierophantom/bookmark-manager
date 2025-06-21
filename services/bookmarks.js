// services/bookmarks.js
// Enhanced to show both folders and bookmarks as slot-items

class BookmarksService {
    constructor() {
        this.bookmarksContainer = null;
        this.bookmarkFolders = new Map();
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
        this.bookmarkFolders.clear();
        
        // Create folder for root level items (both bookmarks AND folders)
        const rootItems = bookmarkNode.children; // Include ALL children
        if (rootItems.length > 0) {
            const rootFolder = this.createBookmarkFolder(bookmarkNode.id, 'Quick Bookmarks', []);
            this.bookmarksContainer.appendChild(rootFolder);
            await this.populateFolder(bookmarkNode.id, rootItems);
        }
        
        // Process all subfolders recursively to show their contents as well
        if (bookmarkNode.children) {
            for (const child of bookmarkNode.children) {
                if (child.children) {
                    await this.processFolderHierarchy(child, []);
                }
            }
        }
    }

    async processFolderHierarchy(folder, parentPath) {
        // Create the current folder
        const currentPath = [...parentPath, folder.title];
        const folderElement = this.createBookmarkFolder(folder.id, folder.title, parentPath);
        this.bookmarksContainer.appendChild(folderElement);
        
        // Add ALL items from this folder (both bookmarks and subfolders)
        const allItems = folder.children;
        if (allItems.length > 0) {
            await this.populateFolder(folder.id, allItems);
        }
        
        // Recursively process any subfolders
        const subfolders = folder.children.filter(child => child.children);
        for (const subfolder of subfolders) {
            await this.processFolderHierarchy(subfolder, currentPath);
        }
    }

    createBookmarkFolder(folderId, title, parentPath) {
        const folderDiv = document.createElement('div');
        folderDiv.id = `bookmark-folder-${folderId}`;
        folderDiv.className = 'bookmark-folder';
        
        // Create display title with breadcrumbs if it has parents
        let displayTitle = '';
        if (parentPath.length > 0) {
            const breadcrumbPath = parentPath.map(part => 
                `<span class="subfolder-title">${part}</span>`
            ).join(' > ');
            displayTitle = `${breadcrumbPath} > ${title}`;
        } else {
            displayTitle = title;
        }
        
        folderDiv.innerHTML = `
            <div class="folder-header">
                <h3 class="folder-title">${displayTitle}</h3>
                <div class="folder-actions">
                    <button class="folder-action-btn add-btn" title="Add bookmark to ${title}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="bookmarks" id="bookmarks-${folderId}"></div>
        `;
        
        // Add event listener for add button
        const addBtn = folderDiv.querySelector('.add-btn');
        addBtn.addEventListener('click', () => this.addBookmark(folderId));
        
        return folderDiv;
    }

    async populateFolder(folderId, items) {
        const container = document.getElementById(`bookmarks-${folderId}`);
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';
        
        // Setup drop zone for the container
        this.setupDropZone(container, folderId);

        // Add ALL items as slot items (both bookmarks and folders)
        for (const item of items) {
            const slotItem = await this.createSlotItem(item);
            container.appendChild(slotItem);
        }
    }

    async createSlotItem(item) {
        const slotItem = document.createElement('div');
        slotItem.className = 'slot-item';
        slotItem.dataset.bookmarkId = item.id;
        slotItem.title = item.title || 'Untitled';
        slotItem.draggable = true;
        
        // Determine if this is a folder or bookmark
        const isFolder = !!item.children;
        
        if (isFolder) {
            // It's a folder
            slotItem.dataset.itemType = 'folder';
            slotItem.innerHTML = `
                <div class="slot-icon folder-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>
                <div class="slot-name">${item.title || 'Untitled Folder'}</div>
                <div class="slot-actions">
                    <button class="slot-action edit-btn" title="Edit folder">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="slot-action delete-btn" title="Delete folder">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            
            // Add click handler for folder
            slotItem.addEventListener('click', (e) => {
                if (!e.target.closest('.slot-actions')) {
                    // Navigate to folder or expand/collapse it
                    this.openFolder(item);
                }
            });
        } else {
            // It's a bookmark
            slotItem.dataset.itemType = 'bookmark';
            slotItem.dataset.url = item.url;
            
            const faviconUrl = await this.getFaviconUrl(item.url);
            
            slotItem.innerHTML = `
                <img class="slot-icon" src="${faviconUrl}" alt="${item.title}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23666%22/></svg>'">
                <div class="slot-name">${item.title || 'Untitled'}</div>
                <div class="slot-actions">
                    <button class="slot-action edit-btn" title="Edit bookmark">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="slot-action delete-btn" title="Delete bookmark">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            
            // Add click handler for bookmark
            slotItem.addEventListener('click', (e) => {
                if (!e.target.closest('.slot-actions')) {
                    chrome.tabs.create({ url: item.url });
                }
            });
        }
        
        // Add common drag handle
        const dragHandle = document.createElement('div');
        dragHandle.className = 'slot-drag-handle';
        dragHandle.title = 'Drag to reorder';
        dragHandle.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
                <circle cx="19" cy="5" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="19" cy="19" r="1"></circle>
                <circle cx="5" cy="5" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
                <circle cx="5" cy="19" r="1"></circle>
            </svg>
        `;
        slotItem.appendChild(dragHandle);
        
        // Add action handlers
        const editBtn = slotItem.querySelector('.edit-btn');
        const deleteBtn = slotItem.querySelector('.delete-btn');
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isFolder) {
                this.editFolder(item);
            } else {
                this.editBookmark(item);
            }
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isFolder) {
                this.deleteFolder(item.id, slotItem);
            } else {
                this.deleteBookmark(item.id, slotItem);
            }
        });
        
        // Add drag and drop handlers
        this.setupSlotDragHandlers(slotItem, item);
        
        slotItem.style.cursor = 'pointer';
        return slotItem;
    }

    setupSlotDragHandlers(slotItem, item) {
        slotItem.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('bookmarkId', item.id);
            e.dataTransfer.setData('itemType', item.children ? 'folder' : 'bookmark');
            e.dataTransfer.setData('sourceFolderId', slotItem.closest('.bookmarks').id.replace('bookmarks-', ''));
            slotItem.classList.add('dragging');
            
            this.draggedElement = slotItem;
        });
        
        slotItem.addEventListener('dragend', (e) => {
            slotItem.classList.remove('dragging');
            
            // Remove all drag-over classes
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            document.querySelectorAll('.drag-before').forEach(el => el.classList.remove('drag-before'));
            document.querySelectorAll('.drag-after').forEach(el => el.classList.remove('drag-after'));
            document.querySelectorAll('.drag-swap').forEach(el => el.classList.remove('drag-swap'));
            
            this.draggedElement = null;
        });
        
        // Add dragover handler for reordering
        slotItem.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedElement || this.draggedElement === slotItem) return;
            
            const rect = slotItem.getBoundingClientRect();
            const relativeX = (e.clientX - rect.left) / rect.width;
            
            // Remove previous indicators
            slotItem.classList.remove('drag-before', 'drag-after', 'drag-swap');
            
            // Determine the drop zone
            if (relativeX < 0.2) {
                slotItem.classList.add('drag-before');
                this.dropAction = 'before';
            } else if (relativeX > 0.8) {
                slotItem.classList.add('drag-after');
                this.dropAction = 'after';
            } else {
                slotItem.classList.add('drag-swap');
                this.dropAction = 'swap';
            }
        });
        
        slotItem.addEventListener('dragleave', (e) => {
            slotItem.classList.remove('drag-before', 'drag-after', 'drag-swap');
        });
        
        slotItem.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const bookmarkId = e.dataTransfer.getData('bookmarkId');
            const sourceFolderId = e.dataTransfer.getData('sourceFolderId');
            
            if (!bookmarkId || !this.draggedElement) return;
            
            try {
                const parentId = slotItem.closest('.bookmarks').id.replace('bookmarks-', '');
                
                if (this.dropAction === 'swap') {
                    // Swap the two items
                    const targetBookmarkId = slotItem.dataset.bookmarkId;
                    
                    const [sourceItem] = await chrome.bookmarks.get(bookmarkId);
                    const [targetItem] = await chrome.bookmarks.get(targetBookmarkId);
                    
                    const sourceParent = await chrome.bookmarks.getChildren(sourceItem.parentId);
                    const targetParent = await chrome.bookmarks.getChildren(targetItem.parentId);
                    
                    const sourceIndex = sourceParent.findIndex(b => b.id === bookmarkId);
                    const targetIndex = targetParent.findIndex(b => b.id === targetBookmarkId);
                    
                    if (sourceItem.parentId === targetItem.parentId) {
                        await chrome.bookmarks.move(bookmarkId, { index: targetIndex });
                        await chrome.bookmarks.move(targetBookmarkId, { index: sourceIndex });
                    } else {
                        await chrome.bookmarks.move(bookmarkId, { 
                            parentId: targetItem.parentId, 
                            index: targetIndex 
                        });
                        await chrome.bookmarks.move(targetBookmarkId, { 
                            parentId: sourceItem.parentId, 
                            index: sourceIndex 
                        });
                    }
                } else {
                    // Insert before or after
                    const targetFolder = await chrome.bookmarks.getChildren(parentId);
                    const targetIndex = targetFolder.findIndex(b => b.id === slotItem.dataset.bookmarkId);
                    
                    let newIndex = this.dropAction === 'before' ? targetIndex : targetIndex + 1;
                    
                    if (sourceFolderId === parentId) {
                        const currentIndex = targetFolder.findIndex(b => b.id === bookmarkId);
                        if (currentIndex < targetIndex) {
                            newIndex--;
                        }
                    }
                    
                    await chrome.bookmarks.move(bookmarkId, {
                        parentId: parentId,
                        index: newIndex
                    });
                }
                
            } catch (error) {
                console.error('Failed to reorder item:', error);
            }
            
            slotItem.classList.remove('drag-before', 'drag-after', 'drag-swap');
        });
    }

    setupDropZone(container, folderId) {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const bookmarkId = e.dataTransfer.getData('bookmarkId');
            const sourceFolderId = e.dataTransfer.getData('sourceFolderId');
            
            if (container.children.length === 0 || sourceFolderId !== folderId) {
                container.classList.add('drag-over');
            }
        });
        
        container.addEventListener('dragleave', (e) => {
            if (e.target === container) {
                container.classList.remove('drag-over');
            }
        });
        
        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            
            if (e.target !== container) return;
            
            const bookmarkId = e.dataTransfer.getData('bookmarkId');
            const sourceFolderId = e.dataTransfer.getData('sourceFolderId');
            
            if (bookmarkId && (container.children.length === 0 || sourceFolderId !== folderId)) {
                try {
                    await chrome.bookmarks.move(bookmarkId, { 
                        parentId: folderId,
                        index: container.children.length
                    });
                } catch (error) {
                    console.error('Failed to move item:', error);
                    alert('Failed to move item');
                }
            }
        });
    }

    // Folder-specific methods
    openFolder(folder) {
        // You can implement folder navigation here
        console.log('Opening folder:', folder.title);
        // For now, just scroll to the folder section
        const folderElement = document.getElementById(`bookmark-folder-${folder.id}`);
        if (folderElement) {
            folderElement.scrollIntoView({ behavior: 'smooth' });
        }
    }

    async editFolder(folder) {
        const newTitle = prompt('Edit folder name:', folder.title);
        if (newTitle !== null && newTitle.trim() !== '') {
            try {
                await chrome.bookmarks.update(folder.id, { title: newTitle.trim() });
            } catch (error) {
                console.error('Failed to update folder:', error);
                alert('Failed to update folder');
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

    async getFaviconUrl(url) {
        if (!url) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23666"/></svg>';
        
        try {
            return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
        } catch {
            return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23666"/></svg>';
        }
    }

    setupListeners() {
        chrome.bookmarks.onCreated.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onRemoved.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onChanged.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onMoved.addListener(() => this.loadBookmarks());
        chrome.bookmarks.onChildrenReordered?.addListener(() => this.loadBookmarks());
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
        } catch (error) {
            console.error('Failed to create bookmark:', error);
            alert('Failed to create bookmark');
        }
    }

    // Public methods
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
}

// Initialize the service
const bookmarksService = new BookmarksService();

// Export for use in other modules
export { bookmarksService };