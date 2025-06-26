/*
File name & path: root/services/shortcuts.js
Role: Pinned URLs shortcuts system for creating and managing URL shortcuts
Method: Factory pattern similar to widgets but specialized for URL shortcuts, includes favicon fetching, URL validation, custom modal for URL input, handles click-to-open functionality
*/

import { ModalContentProvider } from '../slots-system/modal.js';

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
    element.id = 'shortcut';
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
    
    // Use the enhanced favicon system
    const faviconHtml = window.FaviconUtils ? 
      window.FaviconUtils.createFaviconHtml(url, name) :
      this.getFallbackFaviconHtml(name);
    
    return `
      <div class="shortcut-link">
        <div class="shortcut-favicon">
          ${faviconHtml}
        </div>
        <div class="shortcut-name">${name}</div>
      </div>
    `;
  }

  /**
   * Fallback favicon HTML if enhanced system is not available
   * @param {string} name - Alt text for the image
   * @returns {string} - Fallback HTML
   */
  getFallbackFaviconHtml(name) {
    return `<svg width="24" height="24"><use href="#globe-icon" /></svg>`;
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

  }


/* –––––––––––––––––––––––––––
  SHORTCUTS MODAL CONTENT PROVIDER
––––––––––––––––––––––––––– */

class ShortcutsContentProvider extends ModalContentProvider {
  constructor(slotSystem) {
    super();
    this.slotSystem = slotSystem;
    this.currentSlot = null;
    this.nameInput = null;
    this.urlInput = null;
  }
  
  getContent() {
    return `
      <div class="form-group">
        <label for="shortcut-name">Name:</label>
        <input 
          type="text" 
          id="shortcut-name" 
          placeholder="Enter a name for this shortcut" 
          maxlength="50">
      </div>
      <div class="form-group">
        <label for="shortcut-url">URL:</label>
        <input 
          type="url" 
          id="shortcut-url" 
          placeholder="https://example.com or google.com">
        <span class="field-error" id="url-error" style="display: none;">
          Please enter a valid URL
        </span>
      </div>
    `;
  }
  
  onModalOpen(bodyElement) {
    // Get form elements
    this.nameInput = bodyElement.querySelector('#shortcut-name');
    this.urlInput = bodyElement.querySelector('#shortcut-url');
    this.urlError = bodyElement.querySelector('#url-error');
    
    // Clear previous values
    this.nameInput.value = '';
    this.urlInput.value = '';
    this.hideUrlError();
    
    // Set up real-time URL validation
    this.urlInput.addEventListener('input', () => this.validateUrl());
    
    // Handle enter key in inputs
    [this.nameInput, this.urlInput].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          // Trigger save button click
          const saveBtn = document.getElementById('sac-modal-save');
          if (saveBtn) saveBtn.click();
        }
      });
    });
    
    // Focus name input
    setTimeout(() => this.nameInput.focus(), 100);
  }
  
  async validate() {
    const name = this.nameInput.value.trim();
    const url = this.urlInput.value.trim();
    
    // Clear previous errors
    this.hideUrlError();
    this.nameInput.parentNode.classList.remove('has-error');
    this.urlInput.parentNode.classList.remove('has-error');
    
    let isValid = true;
    
    // Validate name
    if (!name) {
      this.nameInput.parentNode.classList.add('has-error');
      this.nameInput.focus();
      isValid = false;
    }
    
    // Validate URL
    if (!url) {
      this.urlInput.parentNode.classList.add('has-error');
      if (isValid) this.urlInput.focus(); // Only focus if name was valid
      isValid = false;
    } else if (!this.validateUrl()) {
      isValid = false;
    }
    
    return isValid;
  }
  
  async onSave() {
    const name = this.nameInput.value.trim();
    const url = this.urlInput.value.trim();
    
    // Ensure URL has protocol
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    
    // Create shortcut data
    const shortcutData = {
      name: name,
      url: finalUrl
    };
    
    try {
      // Add to slot system
      await this.slotSystem.addItemWithData(shortcutData, this.currentSlot);
      return true; // Allow modal to close
    } catch (error) {
      console.error('Failed to save shortcut:', error);
      return false; // Prevent modal from closing
    }
  }
  
  onCancel() {
    // Clear current slot reference
    this.currentSlot = null;
  }
  
  validateUrl() {
    const url = this.urlInput.value.trim();
    
    if (!url) {
      this.hideUrlError();
      return true;
    }
    
    try {
      // Try to create URL object (adds protocol if missing)
      const testUrl = url.startsWith('http') ? url : `https://${url}`;
      new URL(testUrl);
      this.hideUrlError();
      return true;
    } catch (e) {
      this.showUrlError();
      return false;
    }
  }
  
  showUrlError() {
    this.urlError.style.display = 'block';
    this.urlInput.parentNode.classList.add('has-error');
  }
  
  hideUrlError() {
    this.urlError.style.display = 'none';
    this.urlInput.parentNode.classList.remove('has-error');
  }
  
  // Set the target slot for adding shortcut
  setTargetSlot(slot) {
    this.currentSlot = slot;
  }
}

/* –––––––––––––––––––––––––––
  SHORTCUTS MODAL MANAGER
––––––––––––––––––––––––––– */

class ShortcutsModalManager {
  constructor(slotSystem, modalManager) {
    this.slotSystem = slotSystem;
    this.modalManager = modalManager;
    this.contentProvider = new ShortcutsContentProvider(slotSystem);
  }
  
  openModal(slotElement) {
    // Set target slot
    this.contentProvider.setTargetSlot(slotElement);
    
    // Open modal with shortcuts content
    this.modalManager.open({
      title: 'Add Pinned URL',
      content: this.contentProvider.getContent(),
      saveLabel: 'Save Shortcut',
      cancelLabel: 'Cancel',
      contentProvider: this.contentProvider
    });
  }
}

/* –––––––––––––––––––––––––––
  EXPORTS
––––––––––––––––––––––––––– */
export { 
  ShortcutsFactory,
  BaseShortcut,
  PinnedUrlShortcut,
  ShortcutsContentProvider,
  ShortcutsModalManager
};
