/*
File name & path: root/slots-system/modal.js
Role: Generic modal system for all SAC (Slots And Cubes) interactions providing reusable modal functionality
Method: Creates dynamic modal HTML, manages modal lifecycle (open/close), handles form validation, supports content providers for custom modal behavior, includes keyboard shortcuts and error handling
*/

/* –––––––––––––––––––––––––––
 MODAL API USAGE INSTRUCTIONS
––––––––––––––––––––––––––– */

/*
MODAL API MODUS OPERANDI:

1. ASSESSMENT RULE:
  - Simple confirm/alert dialogs → Use SIMPLE PATTERN with onSave callback
  - Complex forms with validation → Use COMPLEX PATTERN with ModalContentProvider

2. INITIALIZATION RULE:
  - ModalManager creates DOM elements in constructor
  - ALWAYS instantiate AFTER DOM is ready (in init() or after DOMContentLoaded)
  - NEVER create in constructor if DOM might not be ready

3. SIMPLE PATTERN (for confirm/alert dialogs):
  modalManager.open({
    title: 'Confirm Action',
    content: '<p>Are you sure?</p>',
    saveLabel: 'Yes',
    cancelLabel: 'No',
    onSave: async () => {
      // Do the action here
      return true; // or false to prevent closing
    }
  });

4. COMPLEX PATTERN (for forms with validation):
  class MyModalProvider extends ModalContentProvider {
    getContent() { return '<form>...</form>'; }
    onModalOpen(bodyElement) { /* setup event listeners, focus *//* }
    async validate() { return true/false; }
    async onSave() { return true/false; }
  }
  
  const provider = new MyModalProvider();
  modalManager.open({
    title: 'My Modal',
    content: provider.getContent(),
    contentProvider: provider
  });

5. REPLACEMENT RULE (confirm() → modal):
  // OLD: if (confirm('message')) { doAction(); }
  // NEW:
  modalManager.open({
    title: 'Confirm',
    content: '<p>message</p>',
    saveLabel: 'OK',
    cancelLabel: 'Cancel',
    onSave: async () => {
      // doAction() code here
      return true;
    }
  });

6. ERROR HANDLING RULE:
  - onSave must return true (success/close) or false (error/stay open)
  - Use try/catch in onSave and return false on errors
  - Never throw exceptions from onSave

7. BUTTON CUSTOMIZATION:
  - Destructive actions: saveLabel: 'Delete'
  - Confirmations: saveLabel: 'Yes' or 'OK'
  - Always set appropriate saveLabel and cancelLabel

8. CONTENT INJECTION:
  - Simple text: content: '<p>message</p>'
  - Forms: content: '<div class="form-group">...</div>'
  - Always wrap in proper HTML tags
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
    // Create modal HTML structure
    const modalHTML = `
      <div class="modal-overlay" id="sac-modal">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title" id="sac-modal-title">Modal Title</div>
            <button class="modal-close" id="sac-modal-close">&times;</button>
          </div>
          <div class="modal-body" id="sac-modal-body">
            <!-- Content will be injected here -->
          </div>
          <div class="modal-actions" id="sac-modal-actions">
            <button id="sac-modal-save" class="btn-primary">Save</button>
            <button id="sac-modal-cancel" class="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    // Remove existing modal if it exists
    const existingModal = document.getElementById('sac-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Get modal elements
    this.modal = document.getElementById('sac-modal');
    this.modalTitle = document.getElementById('sac-modal-title');
    this.modalBody = document.getElementById('sac-modal-body');
    this.modalActions = document.getElementById('sac-modal-actions');
    this.saveBtn = document.getElementById('sac-modal-save');
    this.cancelBtn = document.getElementById('sac-modal-cancel');
    this.closeBtn = document.getElementById('sac-modal-close');
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