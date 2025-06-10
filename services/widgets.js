/*
File name & path: services/widgets.js
Role: Generic widget instances and content management using generic modal
*/

import { ModalContentProvider } from './modal.js';

/* –––––––––––––––––––––––––––
  WIDGET FACTORY
––––––––––––––––––––––––––– */

class WidgetFactory {
  constructor() {
    this.widgetTypes = new Map();
    this.activeWidgets = new Map();
    
    // Register default widget types
    this.registerDefaultWidgets();
  }
  
  /* –––––––––––––––––––––––––––
    WIDGET TYPE REGISTRATION
  ––––––––––––––––––––––––––– */
  
  registerDefaultWidgets() {
    // Register all widget types to use the same generic class
    const widgetTypes = ['clock', 'weather', 'notes', 'calendar', 'todo', 'links'];
    widgetTypes.forEach(type => {
      this.registerWidget(type, GenericWidget);
    });
  }
  
  registerWidget(type, widgetClass) {
    this.widgetTypes.set(type, widgetClass);
  }
  
  /* –––––––––––––––––––––––––––
    WIDGET CREATION
  ––––––––––––––––––––––––––– */
  
  async createItem(id, type, slotId, position = { x: 0, y: 0 }) {
    const WidgetClass = this.widgetTypes.get(type);
    
    if (!WidgetClass) {
      console.error(`Unknown widget type: ${type}`);
      return null;
    }
    
    // Create the widget element
    const element = document.createElement('div');
    element.id = id;
    element.className = 'widget';
    element.dataset.widgetType = type;
    element.dataset.slotId = slotId;
    
    // Apply position
    if (position) {
      element.style.transform = `translate(${position.x}px, ${position.y}px)`;
      element.setAttribute('data-x', position.x);
      element.setAttribute('data-y', position.y);
    }
    
    // Create widget instance
    const widget = new WidgetClass(element, { id, type, slotId });
    
    // Store widget instance for later reference
    this.activeWidgets.set(id, widget);
    
    // Initialize the widget
    await widget.initialize();
    
    return element;
  }
  
  /* –––––––––––––––––––––––––––
    WIDGET REMOVAL
  ––––––––––––––––––––––––––– */
  
  removeItem(element) {
    const id = element.id;
    const widget = this.activeWidgets.get(id);
    
    if (widget && widget.cleanup) {
      widget.cleanup();
    }
    
    this.activeWidgets.delete(id);
  }
  
  /* –––––––––––––––––––––––––––
    WIDGET ACCESS
  ––––––––––––––––––––––––––– */
  
  getWidget(id) {
    return this.activeWidgets.get(id);
  }
  
  getAllWidgets() {
    return Array.from(this.activeWidgets.values());
  }
}

/* –––––––––––––––––––––––––––
  BASE WIDGET CLASS
––––––––––––––––––––––––––– */

class BaseWidget {
  constructor(element, config) {
    this.element = element;
    this.config = config;
    this.id = config.id;
    this.type = config.type;
    this.slotId = config.slotId;
  }
  
  async initialize() {
    // Add basic structure
    this.element.innerHTML = `
      <div class="widget-content">
        ${this.getContent()}
      </div>
    `;
    
    // Bind events
    this.bindEvents();
    
    // Start any async operations
    await this.start();
  }
  
  getContent() {
    return `<div class="widget-placeholder">Widget ${this.type}</div>`;
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
  
  // Utility method to get widget content container
  getContentContainer() {
    return this.element.querySelector('.widget-content');
  }
}

/* –––––––––––––––––––––––––––
  GENERIC WIDGET CLASS
––––––––––––––––––––––––––– */

class GenericWidget extends BaseWidget {
  getContent() {
    // Capitalize first letter of widget type
    const displayName = this.type.charAt(0).toUpperCase() + this.type.slice(1);
    return `<div class="widget-placeholder">${displayName}</div>`;
  }
}

/* –––––––––––––––––––––––––––
  WIDGETS MODAL CONTENT PROVIDER
––––––––––––––––––––––––––– */

class WidgetsContentProvider extends ModalContentProvider {
  constructor(slotSystem) {
    super();
    this.slotSystem = slotSystem;
    this.selectedWidgetType = null;
    this.availableWidgets = [
      { type: 'clock', icon: '🕒', title: 'Clock' },
      { type: 'weather', icon: '🌤️', title: 'Weather' },
      { type: 'notes', icon: '📝', title: 'Notes' },
      { type: 'calendar', icon: '📅', title: 'Calendar' },
      { type: 'todo', icon: '✓', title: 'To-Do List' },
      { type: 'links', icon: '🔗', title: 'Quick Links' }
    ];
  }
  
  getContent() {
    const widgetOptions = this.availableWidgets.map(widget => `
      <div class="widget-template" data-widget-type="${widget.type}">
        <div class="widget-template-icon">${widget.icon}</div>
        <div class="widget-template-title">${widget.title}</div>
      </div>
    `).join('');
    
    return `
      <div class="widget-gallery">
        ${widgetOptions}
      </div>
      <div class="widget-selection-info">
        <p>Select a widget type to add to your dashboard</p>
      </div>
    `;
  }
  
  onModalOpen(bodyElement) {
    // Reset selection
    this.selectedWidgetType = null;
    
    // Get widget templates
    const widgetTemplates = bodyElement.querySelectorAll('.widget-template');
    
    // Add click handlers
    widgetTemplates.forEach(template => {
      template.addEventListener('click', () => {
        // Remove previous selection
        widgetTemplates.forEach(t => t.classList.remove('selected'));
        
        // Select current template
        template.classList.add('selected');
        this.selectedWidgetType = template.dataset.widgetType;
        
        // Update info text
        const infoElement = bodyElement.querySelector('.widget-selection-info p');
        const selectedWidget = this.availableWidgets.find(w => w.type === this.selectedWidgetType);
        if (infoElement && selectedWidget) {
          infoElement.textContent = `Selected: ${selectedWidget.title}`;
        }
      });
    });
  }
  
  async validate() {
    if (!this.selectedWidgetType) {
      // Show error in modal
      const errorMessage = 'Please select a widget type';
      
      // Find or create error element
      let errorElement = document.querySelector('.modal-error');
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'modal-error';
        const modalBody = document.getElementById('sac-modal-body');
        modalBody.insertBefore(errorElement, modalBody.firstChild);
      }
      errorElement.textContent = errorMessage;
      
      return false;
    }
    
    // Remove error if exists
    const errorElement = document.querySelector('.modal-error');
    if (errorElement) {
      errorElement.remove();
    }
    
    return true;
  }
  
  async onSave() {
    try {
      // Add widget to slot system
      await this.slotSystem.addItem(this.selectedWidgetType);
      return true; // Allow modal to close
    } catch (error) {
      console.error('Failed to add widget:', error);
      return false; // Prevent modal from closing
    }
  }
  
  onCancel() {
    // Reset selection
    this.selectedWidgetType = null;
  }
}

/* –––––––––––––––––––––––––––
  WIDGETS MODAL MANAGER
––––––––––––––––––––––––––– */

class WidgetsModalManager {
  constructor(slotSystem, modalManager) {
    this.slotSystem = slotSystem;
    this.modalManager = modalManager;
    this.contentProvider = new WidgetsContentProvider(slotSystem);
  }
  
  openModal() {
    // Open modal with widgets content
    this.modalManager.open({
      title: 'Add Widget',
      content: this.contentProvider.getContent(),
      saveLabel: 'Add Widget',
      cancelLabel: 'Cancel',
      contentProvider: this.contentProvider
    });
  }
}

/* –––––––––––––––––––––––––––
  EXPORTS
––––––––––––––––––––––––––– */
export { 
  WidgetFactory, 
  BaseWidget,
  GenericWidget,
  WidgetsContentProvider,
  WidgetsModalManager
};