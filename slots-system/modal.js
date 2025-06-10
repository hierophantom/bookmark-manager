/*
File name & path: slots-system/modal.js
Role: Generic modal system for all SAC (Slots And Cubes) interactions
*/

/* –––––––––––––––––––––––––––
  GENERIC MODAL MANAGER
––––––––––––––––––––––––––– */

class ModalManager {
  constructor() {
    this.currentModal = null;
    this.contentProvider = null;
    this.onSave = null;
    this.onCancel = null;
    
    this.createModal();
    this.bindEvents();
  }
  
  /* –––––––––––––––––––––––––––
    MODAL CREATION
  ––––––––––––––––––––––––––– */
  
  createModal() {
    // Check if modal already exists
    if (document.getElementById(this.modalId)) {
      this.modal = document.getElementById(this.modalId);
      return;
    }
    
    // Create modal HTML
    const modalHTML = `
      <div class="modal-overlay" id="${this.modalId}">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title" id="${this.modalId}-title">Modal</div>
            <button class="modal-close" id="${this.modalId}-close">&times;</button>
          </div>
          <div class="modal-body" id="${this.modalId}-body">
            <!-- Content will be inserted here -->
          </div>
          <div class="modal-actions" id="${this.modalId}-actions">
            <button id="${this.modalId}-save" class="btn-primary">Save</button>
            <button id="${this.modalId}-cancel" class="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    // Insert modal into document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Get modal elements
    this.modal = document.getElementById(this.modalId);
    this.title = document.getElementById(`${this.modalId}-title`);
    this.body = document.getElementById(`${this.modalId}-body`);
    this.actions = document.getElementById(`${this.modalId}-actions`);
    this.saveBtn = document.getElementById(`${this.modalId}-save`);
    this.cancelBtn = document.getElementById(`${this.modalId}-cancel`);
    this.closeBtn = document.getElementById(`${this.modalId}-close`);
    
    // Bind events
    this.bindEvents();
  }
  

  
  /* –––––––––––––––––––––––––––
    EVENT BINDING
  ––––––––––––––––––––––––––– */
  
  bindEvents() {
    // Save button
    this.saveBtn.addEventListener('click', () => this.handleSave());
    
    // Cancel/Close buttons
    this.cancelBtn.addEventListener('click', () => this.handleCancel());
    this.closeBtn.addEventListener('click', () => this.handleCancel());
    
    // Close modal when clicking outside
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.handleCancel();
      }
    });
    
    // Handle keyboard events
    document.addEventListener('keydown', (e) => {
      if (this.modal.classList.contains('active')) {
        if (e.key === 'Escape') {
          this.handleCancel();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          this.handleSave();
        }
      }
    });
  }
  
  /* –––––––––––––––––––––––––––
    MODAL OPERATIONS
  ––––––––––––––––––––––––––– */
  
  open(config) {
    const {
      title = 'Modal',
      content = '<p>No content provided</p>',
      saveLabel = 'Save',
      cancelLabel = 'Cancel',
      onSave = null,
      onCancel = null,
      contentProvider = null,
      showActions = true
    } = config;
    
    // Store callbacks and provider
    this.onSave = onSave;
    this.onCancel = onCancel;
    this.contentProvider = contentProvider;
    
    // Set modal content
    this.modalTitle.textContent = title;
    this.modalBody.innerHTML = content;
    this.saveBtn.textContent = saveLabel;
    this.cancelBtn.textContent = cancelLabel;
    
    // Show/hide actions
    this.modalActions.style.display = showActions ? 'flex' : 'none';
    
    // Show modal
    this.modal.classList.add('active');
    
    // Focus first input if available
    const firstInput = this.modalBody.querySelector('input, textarea, select');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
    
    // If content provider exists, let it initialize
    if (this.contentProvider && this.contentProvider.onModalOpen) {
      this.contentProvider.onModalOpen(this.modalBody);
    }
  }
  
  close() {
    this.modal.classList.remove('active');
    this.contentProvider = null;
    this.onSave = null;
    this.onCancel = null;
  }
  
  /* –––––––––––––––––––––––––––
    EVENT HANDLERS
  ––––––––––––––––––––––––––– */
  
  async handleSave() {
    let canClose = true;
    
    // If content provider has validation
    if (this.contentProvider && this.contentProvider.validate) {
      canClose = await this.contentProvider.validate();
    }
    
    // If content provider has save handler
    if (canClose && this.contentProvider && this.contentProvider.onSave) {
      canClose = await this.contentProvider.onSave();
    }
    
    // If external save handler
    if (canClose && this.onSave) {
      canClose = await this.onSave();
    }
    
    // Close modal if everything succeeded
    if (canClose !== false) {
      this.close();
    }
  }
  
  handleCancel() {
    // If content provider has cancel handler
    if (this.contentProvider && this.contentProvider.onCancel) {
      this.contentProvider.onCancel();
    }
    
    // If external cancel handler
    if (this.onCancel) {
      this.onCancel();
    }
    
    this.close();
  }
  
  /* –––––––––––––––––––––––––––
    UTILITY METHODS
  ––––––––––––––––––––––––––– */
  
  isOpen() {
    return this.modal.classList.contains('active');
  }
  
  setLoading(isLoading) {
    this.saveBtn.disabled = isLoading;
    this.saveBtn.textContent = isLoading ? 'Saving...' : this.saveBtn.textContent;
  }
  
  showError(message) {
    // Remove existing error if any
    const existingError = this.modalBody.querySelector('.modal-error');
    if (existingError) {
      existingError.remove();
    }
    
    // Add new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'modal-error';
    errorDiv.textContent = message;
    this.modalBody.insertBefore(errorDiv, this.modalBody.firstChild);
  }
  
  hideError() {
    const errorDiv = this.modalBody.querySelector('.modal-error');
    if (errorDiv) {
      errorDiv.remove();
    }
  }
}

/* –––––––––––––––––––––––––––
  CONTENT PROVIDER INTERFACE
––––––––––––––––––––––––––– */

class ModalContentProvider {
  constructor() {
    // Override these methods in subclasses
  }
  
  // Return the HTML content to inject into modal
  getContent() {
    return '<p>Override getContent() method</p>';
  }
  
  // Called when modal is opened (optional)
  onModalOpen(bodyElement) {
    // Override to set up event listeners, focus, etc.
  }
  
  // Called when save is clicked - return false to prevent closing (optional)
  async onSave() {
    return true; // Return false to prevent modal from closing
  }
  
  // Called when cancel is clicked (optional)
  onCancel() {
    // Override for cleanup
  }
  
  // Called before save - return false to prevent save (optional)
  async validate() {
    return true; // Return false to prevent save
  }
}

/* –––––––––––––––––––––––––––
  EXPORTS
––––––––––––––––––––––––––– */
export { ModalManager, ModalContentProvider };