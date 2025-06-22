/*
File name & path: root/services/bookmarks.js
Role: Chrome bookmarks API integration and management service
Method: Loads Chrome bookmarks tree, renders folders hierarchically with breadcrumbs, implements drag/drop reordering with visual feedback (before/after/swap), handles bookmark CRUD operations, listens for bookmark changes and auto-refreshes
*/

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
            
            // Validate URL format
            let validUrl;
            try {
                // Add protocol if missing
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    validUrl = 'https://' + url;
                } else {
                    validUrl = url;
                }
                
                // Test if URL is valid
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
        
        // Enter key to submit
        [urlInput, nameInput].forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                }
            });
        });
        
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
            }
        });
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
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
            const name = nameInput.value.trim(); // Don't provide fallback here
            
            try {
                await chrome.bookmarks.create({
                    parentId: parentFolderId,
                    title: name // Use empty string if name is empty
                });
                dialog.remove();
            } catch (error) {
                console.error('Failed to create folder:', error);
                alert('Failed to create folder.');
            }
        });
        
        // Enter key to submit
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });
        
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
            }
        });
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
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
        
        // Always create root folder (even if empty) to ensure empty slot
        const rootFolder = this.createBookmarkFolder(bookmarkNode.id, 'Quick Bookmarks', []);
        this.bookmarksContainer.appendChild(rootFolder);
        await this.populateFolder(bookmarkNode.id, allRootItems);
        
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
        
        // Always populate the folder (even if empty) to ensure empty slot is added
        await this.populateFolder(folder.id, allItems);
        
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
        folderDiv.dataset.folderId = folderId;
        
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
            <div class="bookmark-folder-drag-handle" title="Drag to reorder folder">
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
        
        // Add event listener for add button
        const addBtn = folderDiv.querySelector('.add-btn');
        addBtn.addEventListener('click', () => this.addBookmark(folderId));
        
        // Add drag functionality to folder
        this.setupFolderDragHandlers(folderDiv, folderId);
        
        return folderDiv;
    }

    setupFolderDragHandlers(folderDiv, folderId) {
        const dragHandle = folderDiv.querySelector('.bookmark-folder-drag-handle');
        
        // Make only the drag handle draggable
        dragHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            slotItem.draggable = true;
        });

        slotItem.addEventListener('dragstart', (e) => {
            // Only allow drag if started from handle
            if (!e.target.closest('.slot-drag-handle')) {
                e.preventDefault();
                return false;
            }
            
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('bookmarkId', bookmark.id);
            e.dataTransfer.setData('sourceFolderId', slotItem.closest('.bookmarks').id.replace('bookmarks-', ''));
            e.dataTransfer.setData('type', 'bookmark');
            slotItem.classList.add('dragging');
            this.draggedElement = slotItem;
        });

        slotItem.addEventListener('dragend', (e) => {
            slotItem.draggable = false;
            slotItem.classList.remove('dragging');
            
            // Remove all drag-over classes
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            document.querySelectorAll('.drag-before').forEach(el => el.classList.remove('drag-before'));
            document.querySelectorAll('.drag-after').forEach(el => el.classList.remove('drag-after'));
            document.querySelectorAll('.drag-swap').forEach(el => el.classList.remove('drag-swap'));
            
            this.draggedElement = null;
        });

        
        // Handle folder reordering
        folderDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedElement || this.draggedElement === folderDiv) return;
            
            const rect = folderDiv.getBoundingClientRect();
            const relativeY = (e.clientY - rect.top) / rect.height;
            
            folderDiv.classList.remove('drag-before', 'drag-after');
            
            if (relativeY < 0.5) {
                folderDiv.classList.add('drag-before');
                this.folderDropAction = 'before';
            } else {
                folderDiv.classList.add('drag-after');
                this.folderDropAction = 'after';
            }
        });
        
        folderDiv.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const draggedFolderId = e.dataTransfer.getData('folderId');
            const draggedType = e.dataTransfer.getData('type');
            
            if (draggedType === 'folder' && draggedFolderId && draggedFolderId !== folderId) {
                try {
                    // Get current folder order
                    const allFolders = Array.from(this.bookmarksContainer.children);
                    const targetIndex = allFolders.indexOf(folderDiv);
                    const draggedIndex = allFolders.indexOf(this.draggedElement);
                    
                    let newIndex = this.folderDropAction === 'before' ? targetIndex : targetIndex + 1;
                    
                    if (draggedIndex < targetIndex && this.folderDropAction === 'after') {
                        newIndex--;
                    }
                    
                    // Reorder in DOM
                    if (newIndex <= draggedIndex) {
                        folderDiv.parentNode.insertBefore(this.draggedElement, folderDiv);
                    } else {
                        folderDiv.parentNode.insertBefore(this.draggedElement, folderDiv.nextSibling);
                    }
                    
                } catch (error) {
                    console.error('Failed to reorder folder:', error);
                }
            }
            
            folderDiv.classList.remove('drag-before', 'drag-after');
        });
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
        
        // Always add an empty slot (even for empty folders)
        const emptySlot = this.createEmptySlot(folderId);
        container.appendChild(emptySlot);
    }

    /* –––––––––––––––––––––––––––
      EMPTY SLOT
    ––––––––––––––––––––––––––– */

    createEmptySlot(folderId) {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'slot-item empty-slot';
        emptySlot.style.border = '2px dashed rgba(255, 255, 255, 0.2)';
        emptySlot.style.background = 'transparent';
        emptySlot.title = 'Drop bookmark here or click to add';
        
        emptySlot.innerHTML = `
            <div class="slot-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.3)" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </div>
        `;
        
        // Add click handler to add bookmark
        emptySlot.addEventListener('click', () => this.addBookmark(folderId));
        
        // Add hover effect
        emptySlot.addEventListener('mouseenter', () => {
            emptySlot.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            emptySlot.style.background = 'rgba(255, 255, 255, 0.05)';
        });
        
        emptySlot.addEventListener('mouseleave', () => {
            emptySlot.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            emptySlot.style.background = 'transparent';
        });
        
        // Add drop zone functionality - use same pattern as original system
        emptySlot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            emptySlot.style.borderColor = '#4CAF50';
            emptySlot.style.background = 'rgba(76, 175, 80, 0.1)';
        });
        
        emptySlot.addEventListener('dragleave', (e) => {
            // Only reset if leaving the empty slot itself, not its children
            if (!emptySlot.contains(e.relatedTarget)) {
                emptySlot.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                emptySlot.style.background = 'transparent';
            }
        });
        
        emptySlot.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Empty slot drop triggered', e.dataTransfer.types);
            
            // Get the drag data using the same format as the original system
            const bookmarkId = e.dataTransfer.getData('bookmarkId');
            const sourceFolderId = e.dataTransfer.getData('sourceFolderId');
            
            console.log('Drop data:', { bookmarkId, sourceFolderId, targetFolderId: folderId });
            
            if (bookmarkId) {
                try {
                    // Get current items in target folder to determine correct index
                    const targetItems = await chrome.bookmarks.getChildren(folderId);
                    const newIndex = targetItems.length; // Add at the end (before empty slot)
                    
                    console.log('Moving bookmark', bookmarkId, 'to folder', folderId, 'at index', newIndex);
                    
                    await chrome.bookmarks.move(bookmarkId, {
                        parentId: folderId,
                        index: newIndex
                    });
                    
                    console.log('Move successful');
                } catch (error) {
                    console.error('Failed to move item to empty slot:', error);
                }
            } else {
                console.log('No bookmarkId found in drag data');
            }
            
            // Reset styles
            emptySlot.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            emptySlot.style.background = 'transparent';
        });
        
        return emptySlot;
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
        slotItem.addEventListener('click', (e) => {
            // Don't open if clicking on actions or drag handle
            if (!e.target.closest('.slot-actions') && !e.target.closest('.slot-drag-handle')) {
                chrome.tabs.create({ url: bookmark.url });
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
            
            console.log('Drag start:', { itemId, itemType });
            
            // Use the same data format as original bookmarks for consistency
            e.dataTransfer.setData('bookmarkId', itemId);
            e.dataTransfer.setData('sourceFolderId', element.closest('.bookmarks').id.replace('bookmarks-', ''));
            
            // Keep additional data for debugging
            if (itemType === 'folder') {
                e.dataTransfer.setData('itemType', itemType);
            }
            
            element.classList.add('dragging');
            this.draggedElement = element;
            
            console.log('Drag data set:', {
                bookmarkId: itemId,
                sourceFolderId: element.closest('.bookmarks').id.replace('bookmarks-', ''),
                itemType: itemType
            });
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
            
            // Check if it's over center area (30-70%) for swap, otherwise position
            if (relativeX >= 0.3 && relativeX <= 0.7) {
                element.classList.add('drag-swap');
                this.dropAction = 'swap';
            } else if (relativeX < 0.3) {
                element.classList.add('drag-before');
                this.dropAction = 'before';
            } else {
                element.classList.add('drag-after');
                this.dropAction = 'after';
            }
        });
        
        element.addEventListener('dragleave', (e) => {
            element.classList.remove('drag-before', 'drag-after', 'drag-swap');
        });
        
        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const draggedItemId = e.dataTransfer.getData('bookmarkId'); // Use bookmarkId for consistency
            const draggedItemType = e.dataTransfer.getData('itemType') || 'bookmark';
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

        const dragHandle = slotItem.querySelector('.slot-drag-handle');
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