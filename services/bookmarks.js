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
        const rootFolder = this.createFolderSection(bookmarkNode.id, 'Bookmarks bar', []);
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
        const folderElement = this.createFolderSection(folder.id, folder.title, parentPath);
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


    createFolderSection(folderId, title, parentPath) {
        const folderDiv = document.createElement('div');
        folderDiv.id = `folder-section-${folderId}`;
        folderDiv.className = 'folder-section';

        // Create display title with breadcrumbs if it has parents
        let displayTitle = '';
        if (parentPath.length > 0) {
            // Build breadcrumb with spans, show "Untitled Folder" for empty names in breadcrumbs
            const breadcrumbPath = parentPath.map(part => {
                const displayPart = (!part || part.trim() === '') ? 'Untitled Folder' : part;
                return `<span class="subfolder-title">${displayPart}</span>`;
            }).join(' > ');

            // For the current folder title, show "Untitled Folder" if empty, otherwise show title
            const currentTitle = (!title || title.trim() === '') ? 'Untitled Folder' : title;
            displayTitle = `${breadcrumbPath} > ${currentTitle}`;
        } else {
            // For root level folders, show "Untitled Folder" if empty
            displayTitle = (!title || title.trim() === '') ? 'Untitled Folder' : title;
        }

        folderDiv.innerHTML = `
            <div class="folder-header">
                <h3 class="folder-title">${displayTitle}</h3>
                <div class="folder-actions">
                    <span class="folder-action-btn add-folder tooltip-top" id="add-folder" data-tooltip="Add folder" aria-expanded="false" >
                        <svg width="16" height="16">
                            <use href="#new-folder-icon" />
                        </svg>
                    </span>
                    <span class="folder-action-btn add-bookmark tooltip-top" id="add-bookmark" data-tooltip="Add bookmark" aria-expanded="false">
                        <svg width="16" height="16">
                            <use href="#add-icon" />
                        </svg>
                    </span>
                </div>
            </div>
            <div class="bookmarks" id="bookmarks-${folderId}"></div>
        `;

        const addBookmarkBtn = folderDiv.querySelector('#add-bookmark');
        const addFolderBtn = folderDiv.querySelector('#add-folder');

        addBookmarkBtn.addEventListener('click', () => this.showAddBookmarkDialog(folderId));
        addFolderBtn.addEventListener('click', () => this.showAddFolderDialog(folderId));

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
        emptySlot.title = 'Drop bookmark here or click to add';

        emptySlot.innerHTML = `
            <div class="slot-icon">
                <svg width="24" height="24">
                    <use href="#add-icon" />
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

            console.log('Drop data:', {
                bookmarkId,
                sourceFolderId,
                targetFolderId: folderId
            });

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
                <svg width="24" height="24">
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
        const targetFolder = document.getElementById(`folder-section-${folderId}`);
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
                await chrome.bookmarks.update(folder.id, {
                    title: newTitle.trim()
                });
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

            console.log('Drag start:', {
                itemId,
                itemType
            });

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
            await chrome.bookmarks.move(itemId1, {
                index: index2
            });
            await chrome.bookmarks.move(itemId2, {
                index: index1
            });
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
        
        // Use the same logic as PinnedUrlShortcut
        const hostname = this.extractHostname(bookmark.url);
        
        let faviconUrl;
        let fallbackIcon;
        
        if (hostname === 'invalid-url') {
            faviconUrl = null;
            fallbackIcon = `<svg width="40" height="40"><use href="#globe-icon" /></svg>`;
        } else {
            faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
            fallbackIcon = `<svg width="40" height="40"><use href="#globe-icon" /></svg>`;
        }
        
        const faviconHtml = faviconUrl ? 
            `<img src="${faviconUrl}" alt="${bookmark.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
             <span style="display:none;">${fallbackIcon}</span>` :
            fallbackIcon;
        
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
        
        // Add click handler for the main item
        slotItem.addEventListener('click', (e) => {
            if (!e.target.closest('.slot-actions') && !e.target.closest('.slot-drag-handle')) {
                chrome.tabs.create({
                    url: bookmark.url
                });
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

// Add the extractHostname method to your BookmarksService class
extractHostname(url) {
    try {
        // First, try to create a proper URL
        let testUrl;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            testUrl = url;
        } else {
            testUrl = `https://${url}`;
        }
        
        const urlObj = new URL(testUrl);
        
        // Additional validation - check if hostname is valid
        const hostname = urlObj.hostname.replace('www.', '');
        
        // Basic hostname validation (must contain at least one dot and valid characters)
        if (hostname.includes('.') && /^[a-zA-Z0-9.-]+$/.test(hostname)) {
            return hostname;
        } else {
            return 'invalid-url'; // This will show a default icon
        }
    } catch (e) {
        return 'invalid-url'; // This will show a default icon
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
                await chrome.bookmarks.update(bookmark.id, {
                    title: newTitle.trim()
                });
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
export {
    bookmarksService
};