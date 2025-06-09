/*
File name & path: services/shortcuts.js
Role: Pinned URLs shortcuts system
*/

/* –––––––––––––––––––––––––––
  SHORTCUTS FACTORY
––––––––––––––––––––––––––– */

class ShortcutsFactory {
  constructor() {
    this.activeShortcuts = new Map();
  }
  
  /* –––––––––––––––––––––––––––
    SHORTCUT CREATION
  ––––––––––––––––––––––––––– */
  
  async createItem(id, data, slotId, position = { x: 0, y: 0 }) {
    // Create the shortcut element
    const element = document.createElement('div');
    element.id = id;
    element.className = 'shortcut';
    element.dataset.slotId = slotId;
    
    // Apply position
    if (position) {
      element.style.transform = `translate(${position.x}px, ${position.y}px)`;
      element.setAttribute('data-x', position.x);
      element.setAttribute('data-y', position.y);
    }
    
    // Create shortcut instance
    const shortcut = new PinnedUrlShortcut(element, { id, data, slotId });
    
    // Store shortcut instance for later reference
    this.activeShortcuts.set(id, shortcut);
    
    // Initialize the shortcut
    await shortcut.initialize();
    this.setupItemControls(element, id);

    return element;
  }
  
  /* –––––––––––––––––––––––––––
    SHORTCUT REMOVAL
  ––––––––––––––––––––––––––– */
  
  removeItem(element) {
    const id = element.id;
    const shortcut = this.activeShortcuts.get(id);
    
    if (shortcut && shortcut.cleanup) {
      shortcut.cleanup();
    }
    
    this.activeShortcuts.delete(id);
  }
  
  /* –––––––––––––––––––––––––––
    SHORTCUT ACCESS
  ––––––––––––––––––––––––––– */
  
  getShortcut(id) {
    return this.activeShortcuts.get(id);
  }
  
  getAllShortcuts() {
    return Array.from(this.activeShortcuts.values());
  }
}

/* –––––––––––––––––––––––––––
  BASE SHORTCUT CLASS
––––––––––––––––––––––––––– */

class BaseShortcut {
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
      <div class="shortcut-content">
        ${this.getContent()}
      </div>
    `;
    
    // Bind events
    this.bindEvents();
    
    // Start any async operations
    await this.start();
  }
  
  getContent() {
    return `<div class="shortcut-placeholder">Empty Slot</div>`;
  }
  
  bindEvents() {
    // Override in subclasses
  }
  
  async start() {
    // Override in subclasses for async initialization
  }
  
  cleanup() {
    // Override in subclasses for cleanup
  }
  
  // Utility method to get shortcut content container
  getContentContainer() {
    return this.element.querySelector('.shortcut-content');
  }
}

/* –––––––––––––––––––––––––––
  PINNED URL SHORTCUT
––––––––––––––––––––––––––– */

class PinnedUrlShortcut extends BaseShortcut {
  getContent() {
    if (!this.data || !this.data.url) {
      return `<div class="shortcut-placeholder">Empty Slot</div>`;
    }
    
    const { name, url } = this.data;
    const hostname = this.extractHostname(url);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    
    return `
      <div class="shortcut-link">
        <div class="shortcut-favicon">
          <img src="${faviconUrl}" alt="${name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/><path d=%22M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3%22/><path d=%22M12 17h.01%22/></svg>'">
        </div>
        <div class="shortcut-info">
          <div class="shortcut-name">${name}</div>
          <div class="shortcut-url">${hostname}</div>
        </div>
      </div>
    `;
  }
  
  bindEvents() {
    if (this.data && this.data.url) {
      // Make the shortcut clickable
      this.element.addEventListener('click', (e) => {
        // Don't trigger if clicking on controls
        if (!e.target.closest('.shortcut-controls')) {
          window.open(this.data.url, '_blank');
        }
      });
      
      // Add hover effect
      this.element.style.cursor = 'pointer';
    }
  }
  
  extractHostname(url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      return url;
    }
  }
}

/* –––––––––––––––––––––––––––
  SHORTCUTS MODAL MANAGER
––––––––––––––––––––––––––– */

class ShortcutsModalManager {
  constructor(slotSystem) {
    this.slotSystem = slotSystem;
    this.currentSlot = null;
    this.initModal();
  }
  
  initModal() {
    // Create modal HTML if it doesn't exist
    if (!document.getElementById('shortcuts-modal')) {
      const modalHTML = `
        <div class="modal-overlay" id="shortcuts-modal">
          <div class="modal-content">
            <div class="modal-header">
              <div class="modal-title">Add Pinned URL</div>
              <button class="modal-close" id="shortcuts-modal-close">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label for="shortcut-name">Name:</label>
                <input type="text" id="shortcut-name" placeholder="Enter a name for this shortcut" maxlength="50">
              </div>
              <div class="form-group">
                <label for="shortcut-url">URL:</label>
                <input type="url" id="shortcut-url" placeholder="https://example.com">
                <div class="url-error" id="url-error" style="display: none;">Please enter a valid URL</div>
              </div>
              <div class="modal-actions">
                <button id="shortcuts-save" class="btn-primary">Save</button>
                <button id="shortcuts-cancel" class="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Get modal elements
    this.modal = document.getElementById('shortcuts-modal');
    this.nameInput = document.getElementById('shortcut-name');
    this.urlInput = document.getElementById('shortcut-url');
    this.urlError = document.getElementById('url-error');
    this.saveBtn = document.getElementById('shortcuts-save');
    this.cancelBtn = document.getElementById('shortcuts-cancel');
    this.closeBtn = document.getElementById('shortcuts-modal-close');
    
    // Bind events
    this.bindModalEvents();
  }
  
  bindModalEvents() {
    // Save button
    this.saveBtn.addEventListener('click', () => this.saveShortcut());
    
    // Cancel/Close buttons
    this.cancelBtn.addEventListener('click', () => this.closeModal());
    this.closeBtn.addEventListener('click', () => this.closeModal());
    
    // Enter key in inputs
    [this.nameInput, this.urlInput].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.saveShortcut();
      });
    });
    
    // URL validation on input
    this.urlInput.addEventListener('input', () => this.validateUrl());
    
    // Close modal when clicking outside
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  }
  
  openModal(slotElement) {
    this.currentSlot = slotElement;
    
    // Clear previous values
    this.nameInput.value = '';
    this.urlInput.value = '';
    this.urlError.style.display = 'none';
    
    // Show modal
    this.modal.classList.add('active');
    this.nameInput.focus();
  }
  
  closeModal() {
    this.modal.classList.remove('active');
    this.currentSlot = null;
  }
  
  validateUrl() {
    const url = this.urlInput.value.trim();
    
    if (!url) {
      this.urlError.style.display = 'none';
      return true;
    }
    
    try {
      // Try to create URL object (adds protocol if missing)
      const testUrl = url.startsWith('http') ? url : `https://${url}`;
      new URL(testUrl);
      this.urlError.style.display = 'none';
      return true;
    } catch (e) {
      this.urlError.style.display = 'block';
      return false;
    }
  }
  
  async saveShortcut() {
    const name = this.nameInput.value.trim();
    const url = this.urlInput.value.trim();
    
    // Basic validation
    if (!name) {
      alert('Please enter a name for the shortcut');
      this.nameInput.focus();
      return;
    }
    
    if (!url) {
      alert('Please enter a URL');
      this.urlInput.focus();
      return;
    }
    
    if (!this.validateUrl()) {
      this.urlInput.focus();
      return;
    }
    
    // Ensure URL has protocol
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    
    // Create shortcut data
    const shortcutData = {
      name: name,
      url: finalUrl
    };
    
    // Add to slot system
    await this.slotSystem.addItemWithData(shortcutData, this.currentSlot);
    
    // Close modal
    this.closeModal();
  }
}

/* –––––––––––––––––––––––––––
  EXPORTS
––––––––––––––––––––––––––– */
export { 
  ShortcutsFactory,
  BaseShortcut,
  PinnedUrlShortcut,
  ShortcutsModalManager
};