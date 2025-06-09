/*
File name & path: services/widgets.js
Role: Generic widget instances and content management
*/

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
  EXPORTS
––––––––––––––––––––––––––– */
export { 
  WidgetFactory, 
  BaseWidget,
  GenericWidget
};