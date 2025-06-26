/*
File name & path: root/services/tab-groups.js
Role: Simplified Chrome tab groups system
Architecture: 
- TabGroupSectionManager: Handles tab group section creation and management
- TabItemPopulator: Handles creation and population of tab items
- TabGroupsService: Main orchestrator that coordinates all systems
*/

/* –––––––––––––––––––––––––––
  TAB GROUP SECTION MANAGER
––––––––––––––––––––––––––– */

class TabGroupSectionManager {
    constructor(tabGroupsService) {
        this.tabGroupsService = tabGroupsService;
        this.tabGroupSections = new Map();
    }

    createTabGroupSection(groupId, title, color) {
        const groupDiv = document.createElement('div');
        groupDiv.id = `tab-group-section-${groupId}`;
        groupDiv.className = 'tab-group-section active';

        const displayTitle = title || 'Untitled Group';

        groupDiv.innerHTML = `
            <div class="tab-group-header">
                <div class="tab-group-info">
                    <div class="tab-group-badge ${color}"></div>
                    <div>
                        <h3 class="tab-group-title">${displayTitle}</h3>
                    </div>
                </div>
                <div class="tab-group-actions">
                    <span class="tab-group-action-btn add-tab tooltip-top" data-tooltip="Add tab" aria-expanded="false">
                        <svg width="16" height="16">
                            <use href="#add-icon" />
                        </svg>
                    </span>
                    <span class="tab-group-action-btn edit-group tooltip-top" data-tooltip="Edit group" aria-expanded="false">
                        <svg width="16" height="16">
                            <use href="#edit-icon" />
                        </svg>
                    </span>
                    <span class="tab-group-action-btn delete-group tooltip-top" data-tooltip="Delete group" aria-expanded="false">
                        <svg width="16" height="16">
                            <use href="#delete-icon" />
                        </svg>
                    </span>
                </div>
            </div>
            <div class="tabs" id="tabs-${groupId}"></div>
        `;

        this.setupTabGroupActions(groupDiv, groupId);
        this.tabGroupSections.set(groupId, groupDiv);

        return groupDiv;
    }

    setupTabGroupActions(groupDiv, groupId) {
        const addTabBtn = groupDiv.querySelector('.add-tab');
        const editGroupBtn = groupDiv.querySelector('.edit-group');
        const deleteGroupBtn = groupDiv.querySelector('.delete-group');

        if (addTabBtn) {
            addTabBtn.addEventListener('click', () => 
                this.tabGroupsService.showAddTabDialog(groupId)
            );
        }

        if (editGroupBtn) {
            editGroupBtn.addEventListener('click', () => 
                this.tabGroupsService.editTabGroup(groupId)
            );
        }

        if (deleteGroupBtn) {
            deleteGroupBtn.addEventListener('click', () => 
                this.tabGroupsService.deleteTabGroup(groupId)
            );
        }
    }

    clearAllSections() {
        this.tabGroupSections.clear();
    }
}

/* –––––––––––––––––––––––––––
  TAB ITEM POPULATOR
––––––––––––––––––––––––––– */

class TabItemPopulator {
    constructor(tabGroupsService) {
        this.tabGroupsService = tabGroupsService;
    }

    async createTabItem(tab, groupId) {
        const slotItem = document.createElement('div');
        slotItem.className = 'slot-item tab-item';
        slotItem.dataset.tabId = tab.id;
        slotItem.dataset.url = tab.url;
        slotItem.title = tab.title || 'Untitled Tab';
        
        const faviconHtml = this.buildFaviconHtml(tab.url, tab.title, tab.favIconUrl);
        
        slotItem.innerHTML = `
            <div class="slot-icon">${faviconHtml}</div>
            <div class="slot-name">${tab.title || 'Untitled Tab'}</div>
            <div class="slot-actions">
                <span class="slot-action delete-btn" title="Remove from group">
                    <svg width="8">
                        <use href="#close-icon" />
                    </svg>
                </span>
            </div>
        `;
        
        this.setupTabActions(slotItem, tab, groupId);
        return slotItem;
    }

    setupTabActions(slotItem, tab, groupId) {
        // Main click handler - switch to tab or open URL
        slotItem.addEventListener('click', (e) => {
            if (!e.target.closest('.slot-actions')) {
                this.tabGroupsService.switchToTab(tab);
            }
        });
        
        // Action handlers
        const deleteBtn = slotItem.querySelector('.delete-btn');
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.tabGroupsService.removeTabFromGroup(tab.id, groupId, slotItem);
        });
    }

    buildFaviconHtml(url, title, favIconUrl = null) {
        // Strategy 1: Use enhanced favicon system if available
        if (window.FaviconUtils) {
            return window.FaviconUtils.createFaviconHtml(url, title);
        }
        
        // Strategy 2: Use Chrome's provided favicon if available
        if (favIconUrl) {
            const fallbackIcon = `<svg width="40" height="40"><use href="#globe-icon" /></svg>`;
            const uniqueId = `favicon-${Math.random().toString(36).substr(2, 9)}`;
            
            return `<img id="${uniqueId}" src="${favIconUrl}" alt="${title}" data-chrome-favicon="true">
                    <span class="favicon-fallback" style="display:none;">${fallbackIcon}</span>`;
        }
        
        // Strategy 3: Extract hostname and try Google favicon service
        const hostname = this.extractHostname(url);
        if (hostname === 'invalid-url') {
            return `<svg width="40" height="40"><use href="#globe-icon" /></svg>`;
        }
        
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        const fallbackIcon = `<svg width="40" height="40"><use href="#globe-icon" /></svg>`;
        const uniqueId = `favicon-${Math.random().toString(36).substr(2, 9)}`;
        
        return `<img id="${uniqueId}" src="${faviconUrl}" alt="${title}" data-google-favicon="true">
                <span class="favicon-fallback" style="display:none;">${fallbackIcon}</span>`;
    }

    setupTabFaviconHandlers() {
        document.addEventListener('error', function(e) {
            if (e.target.tagName === 'IMG' && (e.target.dataset.chromeFavicon || e.target.dataset.googleFavicon)) {
                e.target.style.display = 'none';
                const fallback = e.target.nextElementSibling;
                if (fallback && fallback.classList.contains('favicon-fallback')) {
                    fallback.style.display = 'inline';
                }
            }
        }, true);
    }

    extractHostname(url) {
        try {
            let testUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
            const urlObj = new URL(testUrl);
            let hostname = urlObj.hostname.toLowerCase();
            
            if (hostname.startsWith('www.')) {
                hostname = hostname.substring(4);
            }
            
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
  MAIN TAB GROUPS SERVICE
––––––––––––––––––––––––––– */

class TabGroupsService {
    constructor() {
        this.tabGroupsContainer = null;
        this.chromeTabGroups = new Map();
        
        this.tabGroupSectionManager = new TabGroupSectionManager(this);
        this.tabItemPopulator = new TabItemPopulator(this);
        
        this.init();
    }

    async init() {
        await this.waitForDOM();
        this.tabGroupsContainer = document.getElementById('tab-groups-container');

        if (!this.tabGroupsContainer) {
            console.error('Tab groups container not found');
            return;
        }

        await this.loadTabGroups();
        this.setupListeners();
    }

    async waitForDOM() {
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
    }

    setupListeners() {
        // Listen for tab group changes
        if (chrome.tabGroups && chrome.tabGroups.onCreated) {
            chrome.tabGroups.onCreated.addListener(() => this.loadTabGroups());
        }
        if (chrome.tabGroups && chrome.tabGroups.onRemoved) {
            chrome.tabGroups.onRemoved.addListener(() => this.loadTabGroups());
        }
        if (chrome.tabGroups && chrome.tabGroups.onUpdated) {
            chrome.tabGroups.onUpdated.addListener(() => this.loadTabGroups());
        }
        
        // Listen for tab changes
        if (chrome.tabs) {
            chrome.tabs.onCreated.addListener(() => this.loadTabGroups());
            chrome.tabs.onRemoved.addListener(() => this.loadTabGroups());
            chrome.tabs.onUpdated.addListener(() => this.loadTabGroups());
        }
    }

    async loadTabGroups() {
        try {
            await this.loadActiveTabGroups();
            await this.renderTabGroups();
        } catch (error) {
            console.error('Failed to load tab groups:', error);
        }
    }

    async loadActiveTabGroups() {
        try {
            if (!chrome.tabGroups) {
                console.warn('Chrome Tab Groups API not available');
                return;
            }

            const tabGroups = await chrome.tabGroups.query({});
            this.chromeTabGroups.clear();
            
            for (const group of tabGroups) {
                const tabs = await chrome.tabs.query({ groupId: group.id });
                
                const groupData = {
                    ...group,
                    tabs: tabs
                };
                
                this.chromeTabGroups.set(group.id, groupData);
            }
        } catch (error) {
            console.error('Failed to load active tab groups:', error);
        }
    }

    async renderTabGroups() {
        this.tabGroupsContainer.innerHTML = '';
        this.tabGroupSectionManager.clearAllSections();

        // Only render active tab groups
        const activeGroups = Array.from(this.chromeTabGroups.values());
            
        for (const group of activeGroups) {
            await this.renderTabGroup(group);
        }
    }

    async renderTabGroup(group) {
        const groupElement = this.tabGroupSectionManager.createTabGroupSection(
            group.id,
            group.title,
            group.color
        );
        this.tabGroupsContainer.appendChild(groupElement);
        
        await this.populateTabGroup(group.id, group.tabs || []);
    }

    async populateTabGroup(groupId, tabs) {
        const container = document.getElementById(`tabs-${groupId}`);
        if (!container) return;

        container.innerHTML = '';

        // Handle empty tabs array
        if (!tabs || tabs.length === 0) {
            container.innerHTML = '<div class="empty-group-message">No tabs in this group</div>';
            return;
        }

        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tabs-grid';
        
        for (const tab of tabs) {
            const tabItem = await this.tabItemPopulator.createTabItem(tab, groupId);
            tabsContainer.appendChild(tabItem);
        }

        container.appendChild(tabsContainer);
    }

    showAddTabDialog(groupId) {
        const dialog = document.createElement('div');
        dialog.className = 'tab-group-dialog';
        dialog.innerHTML = `
            <div class="tab-group-dialog-content">
                <h3>Add Tab to Group</h3>
                <div class="tab-group-dialog-field">
                    <label for="tab-url">URL *</label>
                    <input type="url" id="tab-url" placeholder="https://example.com" required>
                </div>
                <div class="tab-group-dialog-actions">
                    <button class="tab-group-dialog-btn secondary" id="cancel-tab">Cancel</button>
                    <button class="tab-group-dialog-btn primary" id="add-tab-confirm">Add</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const urlInput = dialog.querySelector('#tab-url');
        const confirmBtn = dialog.querySelector('#add-tab-confirm');
        const cancelBtn = dialog.querySelector('#cancel-tab');

        urlInput.focus();

        cancelBtn.addEventListener('click', () => {
            dialog.remove();
        });

        confirmBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();

            if (!url) {
                urlInput.focus();
                return;
            }

            try {
                let validUrl = url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;
                new URL(validUrl);

                await this.addTabToGroup(groupId, validUrl);
                dialog.remove();
            } catch (error) {
                console.error('Failed to add tab to group:', error);
                alert('Failed to add tab. Please check the URL format.');
            }
        });

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        });

        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') dialog.remove();
        });

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });
    }

    async addTabToGroup(groupId, url) {
        try {
            const tab = await chrome.tabs.create({ url: url, active: false });
            await chrome.tabs.group({ groupId: parseInt(groupId), tabIds: [tab.id] });
            await this.loadTabGroups();
        } catch (error) {
            console.error('Failed to add tab to group:', error);
            throw error;
        }
    }

    async removeTabFromGroup(tabId, groupId, element) {
        if (confirm('Remove this tab from the group?')) {
            try {
                element.style.transition = 'opacity 0.3s ease';
                element.style.opacity = '0';

                await chrome.tabs.ungroup([parseInt(tabId)]);
                await this.loadTabGroups();
            } catch (error) {
                console.error('Failed to remove tab from group:', error);
                alert('Failed to remove tab from group');
                element.style.opacity = '1';
            }
        }
    }

    async switchToTab(tab) {
        try {
            await chrome.tabs.update(tab.id, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });
        } catch (error) {
            console.error('Failed to switch to tab:', error);
            if (tab.url) {
                chrome.tabs.create({ url: tab.url });
            }
        }
    }

    async editTabGroup(groupId) {
        try {
            const group = this.chromeTabGroups.get(parseInt(groupId));
            if (!group) return;

            // Create a dialog for editing both title and color
            const dialog = document.createElement('div');
            dialog.className = 'tab-group-dialog';
            dialog.innerHTML = `
                <div class="tab-group-dialog-content">
                    <h3>Edit Tab Group</h3>
                    <div class="tab-group-dialog-field">
                        <label for="group-title">Name</label>
                        <input type="text" id="group-title" value="${group.title || ''}" placeholder="Group name">
                    </div>
                    <div class="tab-group-dialog-field">
                        <label for="group-color">Color</label>
                        <select id="group-color">
                            <option value="grey" ${group.color === 'grey' ? 'selected' : ''}>Grey</option>
                            <option value="blue" ${group.color === 'blue' ? 'selected' : ''}>Blue</option>
                            <option value="red" ${group.color === 'red' ? 'selected' : ''}>Red</option>
                            <option value="yellow" ${group.color === 'yellow' ? 'selected' : ''}>Yellow</option>
                            <option value="green" ${group.color === 'green' ? 'selected' : ''}>Green</option>
                            <option value="pink" ${group.color === 'pink' ? 'selected' : ''}>Pink</option>
                            <option value="purple" ${group.color === 'purple' ? 'selected' : ''}>Purple</option>
                            <option value="cyan" ${group.color === 'cyan' ? 'selected' : ''}>Cyan</option>
                            <option value="orange" ${group.color === 'orange' ? 'selected' : ''}>Orange</option>
                        </select>
                    </div>
                    <div class="tab-group-dialog-actions">
                        <button class="tab-group-dialog-btn secondary" id="cancel-edit">Cancel</button>
                        <button class="tab-group-dialog-btn primary" id="save-edit">Save</button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            const titleInput = dialog.querySelector('#group-title');
            const colorSelect = dialog.querySelector('#group-color');
            const saveBtn = dialog.querySelector('#save-edit');
            const cancelBtn = dialog.querySelector('#cancel-edit');

            titleInput.focus();
            titleInput.select();

            cancelBtn.addEventListener('click', () => {
                dialog.remove();
            });

            saveBtn.addEventListener('click', async () => {
                const newTitle = titleInput.value.trim();
                const newColor = colorSelect.value;

                try {
                    await chrome.tabGroups.update(parseInt(groupId), {
                        title: newTitle,
                        color: newColor
                    });
                    dialog.remove();
                    await this.loadTabGroups();
                } catch (error) {
                    console.error('Failed to update tab group:', error);
                    alert('Failed to update tab group');
                }
            });

            titleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveBtn.click();
            });

            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') dialog.remove();
            });

            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) dialog.remove();
            });

        } catch (error) {
            console.error('Failed to update tab group:', error);
            alert('Failed to update tab group');
        }
    }

    async deleteTabGroup(groupId) {
        if (confirm('Are you sure you want to delete this tab group?')) {
            try {
                const group = this.chromeTabGroups.get(parseInt(groupId));
                
                if (group) {
                    // Ungroup all tabs in the active group
                    const tabs = await chrome.tabs.query({ groupId: parseInt(groupId) });
                    if (tabs.length > 0) {
                        await chrome.tabs.ungroup(tabs.map(tab => tab.id));
                    }
                }
                
                // Reload to update display
                await this.loadTabGroups();
            } catch (error) {
                console.error('Failed to delete tab group:', error);
                alert('Failed to delete tab group');
            }
        }
    }

    refresh() {
        return this.loadTabGroups();
    }
}

const tabGroupsService = new TabGroupsService();

export {
    tabGroupsService,
    TabGroupSectionManager,
    TabItemPopulator
};