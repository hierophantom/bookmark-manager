// services/bookmarks.js

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
        this.bookmarkFolders.clear();
        
        // Create folder for root level items in their natural order
        const allRootItems = bookmarkNode.children; // Preserve original order
        
        if (allRootItems.length > 0) {
            const rootFolder = this.createBookmarkFolder(bookmarkNode.id, 'Quick Bookmarks', []);
            this.bookmarksContainer.appendChild(rootFolder);
            await this.populateFolder(bookmarkNode.id, allRootItems);
        }
        
        // Process all folders recursively and add them as individual sections
        const folders = bookmarkNode.children.filter(child => child.children);
        for (const folder of folders) {
            await this.processFolderHierarchy(folder, []);
        }
    }

    async processFolderHierarchy(folder, parentPath) {
        // Create the current folder
        const currentPath = [...parentPath, folder.title];
        const folderElement = this.createBookmarkFolder(folder.id, folder.title, parentPath);
        this.bookmarksContainer.appendChild(folderElement);
        
        // Get all items in their natural order from Chrome bookmarks
        const allItems = folder.children; // This preserves the original order
        
        // Populate the folder with items in their natural order
        if (allItems.length > 0) {
            await this.populateFolder(folder.id, allItems);
        }
        
        // Recursively process subfolders to create their own sections
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
            // Build breadcrumb with spans only for parent path
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

        // Add items as slot items in their natural order (both bookmarks and folders)
        for (const item of items) {
            if (item.children) {
                // This is a folder - create folder slot item
                const folderSlotItem = await this.createFolderSlotItem(item, folderId);
                container.appendChild(folderSlotItem);
            } else {
                // This is a bookmark - create bookmark slot item
                const slotItem = await this.createBookmarkSlotItem(item);
                container.appendChild(slotItem);
            }
        }
        
        // Add the "add bookmark" button at the end
        const addBookmarkBtn = document.createElement('button');
        addBookmarkBtn.className = 'add-bookmark-btn';
        addBookmarkBtn.title = 'Add new bookmark';
        addBookmarkBtn.innerHTML = '+';
        addBookmarkBtn.addEventListener('click', () => this.addBookmark(folderId));
        container.appendChild(addBookmarkBtn);
    }

    /* –––––––––––––––––––––––––––
      FOLDER SLOT ITEMS
    ––––––––––––––––––––––––––– */

    async createFolderSlotItem(folder, parentFolderId) {
        const folderSlotItem = document.createElement('div');
        folderSlotItem.className = 'folder-slot-item';
        folderSlotItem.dataset.folderId = folder.id;
        folderSlotItem.dataset.parentFolderId = parentFolderId;
        folderSlotItem.title = folder.title || 'Untitled Folder';
        folderSlotItem.draggable = true;
        
        folderSlotItem.innerHTML = `
            <div class="slot-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
            </div>
            <div class="slot-name">${folder.title || 'Untitled Folder'}</div>
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
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // Add click handler to scroll to folder section
        folderSlotItem.addEventListener('click', (e) => {
            if (!e.target.closest('.slot-actions')) {
                this.scrollToFolder(folder.id);
            }
        });
        
        // Add action handlers
        const editBtn = folderSlotItem.querySelector('.edit-btn');
        const deleteBtn = folderSlotItem.querySelector('.delete-btn');
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editFolder(folder);
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteFolder(folder.id, folderSlotItem);
        });
        
        // Add drag and drop handlers
        this.addDragHandlers(folderSlotItem, folder.id, 'folder');
        
        return folderSlotItem;
    }

    scrollToFolder(folderId) {
        const targetFolder = document.getElementById(`bookmark-folder-${folderId}`);
        if (targetFolder) {
            targetFolder.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
            
            // Add a brief highlight effect
            targetFolder.style.background = 'rgba(76, 175, 80, 0.2)';
            setTimeout(() => {
                targetFolder.style.background = '';
            }, 2000);
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

    /* –––––––––––––––––––––––––––
      SHARED DRAG HANDLERS
    ––––––––––––––––––––––––––– */

    addDragHandlers(element, itemId, itemType) {
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('itemId', itemId);
            e.dataTransfer.setData('itemType', itemType);
            e.dataTransfer.setData('sourceFolderId', element.closest('.bookmarks').id.replace('bookmarks-', ''));
            element.classList.add('dragging');
            
            this.draggedElement = element;
        });
        
        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
            
            // Remove all drag-over classes
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            document.querySelectorAll('.drag-before').forEach(el => el.classList.remove('drag-before'));
            document.querySelectorAll('.drag-after').forEach(el => el.classList.remove('drag-after'));
            document.querySelectorAll('.drag-swap').forEach(el => el.classList.remove('drag-swap'));
            
            this.draggedElement = null;
        });
        
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedElement || this.draggedElement === element) return;
            
            const rect = element.getBoundingClientRect();
            const relativeX = (e.clientX - rect.left) / rect.width;
            
            element.classList.remove('drag-before', 'drag-after', 'drag-swap');
            
            if (relativeX < 0.2) {
                element.classList.add('drag-before');
                this.dropAction = 'before';
            } else if (relativeX > 0.8) {
                element.classList.add('drag-after');
                this.dropAction = 'after';
            } else {
                element.classList.add('drag-swap');
                this.dropAction = 'swap';
            }
        });
        
        element.addEventListener('dragleave', (e) => {
            element.classList.remove('drag-before', 'drag-after', 'drag-swap');
        });
        
        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const draggedItemId = e.dataTransfer.getData('itemId');
            const draggedItemType = e.dataTransfer.getData('itemType');
            const sourceFolderId = e.dataTransfer.getData('sourceFolderId');
            
            if (!draggedItemId || !this.draggedElement) return;
            
            try {
                await this.handleDrop(draggedItemId, draggedItemType, element, itemId, itemType);
            } catch (error) {
                console.error('Failed to handle drop:', error);
            }
            
            element.classList.remove('drag-before', 'drag-after', 'drag-swap');
        });
    }

    async handleDrop(draggedItemId, draggedItemType, targetElement, targetItemId, targetItemType) {
        const parentId = targetElement.closest('.bookmarks').id.replace('bookmarks-', '');
        
        if (this.dropAction === 'swap') {
            // Only swap positions if in same container
            await this.swapItems(draggedItemId, targetItemId, parentId);
        } else {
            // Insert before or after
            const targetItems = await chrome.bookmarks.getChildren(parentId);
            const targetIndex = targetItems.findIndex(item => item.id === targetItemId);
            
            let newIndex = this.dropAction === 'before' ? targetIndex : targetIndex + 1;
            
            // Adjust index if moving within same folder
            const [draggedItem] = await chrome.bookmarks.get(draggedItemId);
            if (draggedItem.parentId === parentId) {
                const currentIndex = targetItems.findIndex(item => item.id === draggedItemId);
                if (currentIndex < targetIndex) {
                    newIndex--;
                }
            }
            
            await chrome.bookmarks.move(draggedItemId, {
                parentId: parentId,
                index: newIndex
            });
        }
    }

    async swapItems(itemId1, itemId2, parentId) {
        const [item1] = await chrome.bookmarks.get(itemId1);
        const [item2] = await chrome.bookmarks.get(itemId2);
        
        const parentItems = await chrome.bookmarks.getChildren(parentId);
        const index1 = parentItems.findIndex(item => item.id === itemId1);
        const index2 = parentItems.findIndex(item => item.id === itemId2);
        
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

    setupDropZone(container, folderId) {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const itemId = e.dataTransfer.getData('itemId');
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
            
            const itemId = e.dataTransfer.getData('itemId');
            const sourceFolderId = e.dataTransfer.getData('sourceFolderId');
            
            if (itemId && (container.children.length === 0 || sourceFolderId !== folderId)) {
                try {
                    await chrome.bookmarks.move(itemId, { 
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

    async createBookmarkSlotItem(bookmark) {
        const slotItem = document.createElement('div');
        slotItem.className = 'slot-item';
        slotItem.dataset.bookmarkId = bookmark.id;
        slotItem.dataset.url = bookmark.url;
        slotItem.title = bookmark.title || 'Untitled';
        slotItem.draggable = true;
        
        const faviconUrl = await this.getFaviconUrl(bookmark.url);
        
        slotItem.innerHTML = `
            <img class="slot-icon" src="${faviconUrl}" alt="${bookmark.title}" 
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23666%22/></svg>'">
            <div class="slot-name">${bookmark.title || 'Untitled'}</div>
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
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            <div class="slot-drag-handle" title="Drag to reorder">
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
            </div>
        `;
        
        // Add click handler for the main item
        slotItem.addEventListener('click', (e) => {
            if (!e.target.closest('.slot-actions') && !e.target.closest('.slot-drag-handle')) {
                chrome.tabs.create({ url: bookmark.url });
            }
        });
        
        // Add action handlers
        const editBtn = slotItem.querySelector('.edit-btn');
        const deleteBtn = slotItem.querySelector('.delete-btn');
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editBookmark(bookmark);
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteBookmark(bookmark.id, slotItem);
        });
        
        // Add drag and drop handlers
        this.addDragHandlers(slotItem, bookmark.id, 'bookmark');
        
        return slotItem;
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

const bookmarksService = new BookmarksService();
export { bookmarksService };