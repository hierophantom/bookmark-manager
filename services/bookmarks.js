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
        
        // Create folder for root level bookmarks (not in any folder)
        const rootBookmarks = bookmarkNode.children.filter(child => !child.children);
        if (rootBookmarks.length > 0) {
            const rootFolder = this.createBookmarkFolder(bookmarkNode.id, 'Quick Bookmarks', []);
            this.bookmarksContainer.appendChild(rootFolder);
            await this.populateFolder(bookmarkNode.id, rootBookmarks);
        }
        
        // Process all folders recursively and add them as individual items
        if (bookmarkNode.children) {
            for (const child of bookmarkNode.children) {
                if (child.children) {
                    // Process this folder and all its subfolders
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
        
        // Add bookmarks from this folder
        const bookmarks = folder.children.filter(child => !child.children);
        if (bookmarks.length > 0) {
            await this.populateFolder(folder.id, bookmarks);
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
        const displayTitle = parentPath.length > 0 ? `${parentPath.join(' > ')} > ${title}` : title;
        
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

    async populateFolder(folderId, bookmarks) {
        const container = document.getElementById(`bookmarks-${folderId}`);
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';
        
        // Setup drop zone for the container
        this.setupDropZone(container, folderId);

        // Add bookmarks as slot items
        for (const bookmark of bookmarks) {
            if (!bookmark.children) { // Only process actual bookmarks, not folders
                const slotItem = await this.createBookmarkSlotItem(bookmark);
                container.appendChild(slotItem);
            }
        }
    }

    setupDropZone(container, folderId) {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            container.classList.add('drag-over');
        });
        
        container.addEventListener('dragleave', (e) => {
            if (e.target === container) {
                container.classList.remove('drag-over');
            }
        });
        
        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            
            const bookmarkId = e.dataTransfer.getData('bookmarkId');
            if (bookmarkId) {
                try {
                    await chrome.bookmarks.move(bookmarkId, { parentId: folderId });
                    // The onMoved listener will trigger a reload
                } catch (error) {
                    console.error('Failed to move bookmark:', error);
                    alert('Failed to move bookmark');
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
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // Add click handler for the main item
        slotItem.addEventListener('click', (e) => {
            // Don't open if clicking on actions
            if (!e.target.closest('.slot-actions')) {
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
        slotItem.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('bookmarkId', bookmark.id);
            slotItem.classList.add('dragging');
        });
        
        slotItem.addEventListener('dragend', (e) => {
            slotItem.classList.remove('dragging');
        });
        
        // Add hover effect
        slotItem.style.cursor = 'pointer';
        
        return slotItem;
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

    // Edit bookmark
    async editBookmark(bookmark) {
        const newTitle = prompt('Edit bookmark name:', bookmark.title);
        if (newTitle !== null && newTitle.trim() !== '') {
            try {
                await chrome.bookmarks.update(bookmark.id, { title: newTitle.trim() });
                // The onChanged listener will trigger a reload
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
                // Add fade out animation
                element.style.transition = 'opacity 0.3s ease';
                element.style.opacity = '0';
                
                await chrome.bookmarks.remove(bookmarkId);
                // The onRemoved listener will trigger a reload
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
            // The onCreated listener will trigger a reload
        } catch (error) {
            console.error('Failed to create bookmark:', error);
            alert('Failed to create bookmark');
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

    // Search bookmarks
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