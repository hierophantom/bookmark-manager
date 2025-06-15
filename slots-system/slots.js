/*
File name & path: slots-system/slots.js
Role: Core slot system handling drag/drop, swap, add/remove mechanics
*/

/* –––––––––––––––––––––––––––
  CORE SLOT SYSTEM
––––––––––––––––––––––––––– */

class SlotSystem {
  constructor(options = {}) {
    // Configuration
    this.config = {
      storageKey: options.storageKey || 'slotItems',
      slotSelector: '.widget-slot',
      containerSelector: options.containerSelector || '.slot-container',
      controlsSelector: options.controlsSelector || '.slot-controls',
      addButtonSelector: options.addButtonSelector || '#add-widget-btn',
      modalSelector: options.modalSelector || '#add-widget-modal',
      itemClass: options.itemClass || 'widget',
      ...options
    };
    
    // Core state
    this.items = [];
    this.nextItemId = 1;
    this.draggedItem = null;
    this.itemFactory = null; // Will be set by widget system
    
    // Initialize elements
    this.initElements();

    // Bind core events
    this.bindEvents();
    
    refreshSlots() {
    this.slots = document.querySelectorAll(this.config.slotSelector);}
    
    // Load saved items
    this.loadItems();
  }
  
  /* –––––––––––––––––––––––––––
    INITIALIZATION
  ––––––––––––––––––––––––––– */
  
  initElements() {
    this.slotContainer = document.querySelector(this.config.containerSelector);
    this.slots = document.querySelectorAll(this.config.slotSelector);
    this.addButton = document.querySelector(this.config.addButtonSelector);
    this.modal = document.querySelector(this.config.modalSelector);
    this.slotControls = document.querySelector(this.config.controlsSelector);
    
    if (this.modal) {
      this.modalClose = this.modal.querySelector('.modal-close');
      this.itemTemplates = this.modal.querySelectorAll('.widget-template');
    }
    
    // Set up hover behavior for controls
    this.setupControlsVisibility();
  }

  setupControlsVisibility() {
    if (!this.slotContainer || !this.slotControls) return;
    
    // Show controls when hovering over the slot container
    this.slotContainer.addEventListener('mouseenter', () => {
      this.slotControls.classList.add('controls-visible');
    });
    
    this.slotContainer.addEventListener('mouseleave', (e) => {
      // Don't hide if the mouse is over the controls
      if (!this.slotControls.contains(e.relatedTarget)) {
        this.slotControls.classList.remove('controls-visible');
      }
    });
    
    // Keep controls visible when hovering over them
    this.slotControls.addEventListener('mouseenter', () => {
      this.slotControls.classList.add('controls-visible');
    });
    
    this.slotControls.addEventListener('mouseleave', () => {
      this.slotControls.classList.remove('controls-visible');
    });
  }
  
  
/* –––––––––––––––––––––––––––
  SLOT FACTORY
––––––––––––––––––––––––––– */

class SlotFactory {
  static createSlots(config) {
    const {
      name,
      count,
      cssClass,
      containerSelector,
      idPrefix = name,
      dataAttributes = {}
    } = config;
    
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.error(`Container not found: ${containerSelector}`);
      return;
    }
    
    // Clear existing slots if any
    container.querySelectorAll(`.${cssClass}`).forEach(slot => slot.remove());
    
    // Create slots
    for (let i = 1; i <= count; i++) {
      const slot = document.createElement('div');
      slot.className = cssClass;
      slot.dataset.slotId = `${idPrefix}${i}`;
      
      // Add any additional data attributes
      Object.keys(dataAttributes).forEach(key => {
        slot.dataset[key] = dataAttributes[key];
      });
      
      container.appendChild(slot);
    }
    
    console.log(`Created ${count} ${name} slots`);
  }
}

  /* –––––––––––––––––––––––––––
    EVENT BINDING
  ––––––––––––––––––––––––––– */
  
  bindEvents() {
    // Add item button
    if (this.addButton) {
      this.addButton.addEventListener('click', () => {
        this.openModal();
      });
    }
    
    // Modal events
    if (this.modal) {
      if (this.modalClose) {
        this.modalClose.addEventListener('click', () => {
          this.closeModal();
        });
      }
      
      // Item templates
      this.itemTemplates.forEach(template => {
        template.addEventListener('click', () => {
          const itemType = template.dataset.widgetType;
          this.addItem(itemType);
          this.closeModal();
        });
      });
      
      // Close modal when clicking outside
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeModal();
        }
      });
    }
    
    // Initialize interact.js for drag and drop
    this.initInteract();
  }
  
  /* –––––––––––––––––––––––––––
    MODAL MANAGEMENT
  ––––––––––––––––––––––––––– */
  
  openModal() {
    if (this.modal) {
      this.modal.classList.add('active');
    }
  }
  
  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('active');
    }
  }
  
  /* –––––––––––––––––––––––––––
    ITEM MANAGEMENT
  ––––––––––––––––––––––––––– */
  
  async addItem(itemType) {
    const emptySlot = this.findEmptySlot();
    
    if (!emptySlot) {
      alert('No empty slots available. Remove some items first.');
      return;
    }
    
    if (!this.itemFactory) {
      console.error('No item factory registered. Please set itemFactory before adding items.');
      return;
    }
    
    const itemId = `${this.config.itemClass}-${this.nextItemId++}`;
    const item = await this.itemFactory.createItem(itemId, itemType, emptySlot.dataset.slotId);
    
    if (!item) {
      console.error('Failed to create item');
      return;
    }
    
    // Add core slot system attributes and classes
    item.id = itemId;
    item.className = this.config.itemClass;
    item.dataset.itemType = itemType;
    item.dataset.slotId = emptySlot.dataset.slotId;
    
    // Add remove button functionality
    this.setupItemControls(item, itemId);
    
    emptySlot.appendChild(item);
    
    // Add to items array
    this.items.push({
      id: itemId,
      type: itemType,
      slotId: emptySlot.dataset.slotId,
      position: { x: 0, y: 0 }
    });
    
    // Save items to localStorage
    this.saveItems();
    
    // Add animation class for entrance
    item.classList.add('widget-enter');
    setTimeout(() => {
      item.classList.remove('widget-enter');
    }, 500);
    
    return item;
  }
  
  async addItemWithData(data, targetSlot) {
    if (!targetSlot) {
      const emptySlot = this.findEmptySlot();
      if (!emptySlot) {
        alert('No empty slots available. Remove some items first.');
        return;
      }
      targetSlot = emptySlot;
    }
    
    if (!this.itemFactory) {
      console.error('No item factory registered. Please set itemFactory before adding items.');
      return;
    }
    
    const itemId = `${this.config.itemClass}-${this.nextItemId++}`;
    const item = await this.itemFactory.createItem(itemId, data, targetSlot.dataset.slotId);
    
    if (!item) {
      console.error('Failed to create item');
      return;
    }
    
    // Add core slot system attributes and classes
    item.id = itemId;
    item.className = this.config.itemClass;
    item.dataset.slotId = targetSlot.dataset.slotId;
    
    // Add remove button functionality
    this.setupItemControls(item, itemId);
    
    targetSlot.appendChild(item);
    
    // Add to items array
    this.items.push({
      id: itemId,
      data: data, // Store the data instead of type
      slotId: targetSlot.dataset.slotId,
      position: { x: 0, y: 0 }
    });
    
    // Save items to localStorage
    this.saveItems();
    
    // Add animation class for entrance
    item.classList.add('widget-enter');
    setTimeout(() => {
      item.classList.remove('widget-enter');
    }, 500);
    
    return item;
  }

  
 setupItemControls(item, itemId) {
  const itemClass = this.config.itemClass; // Gets 'widget' or 'shortcut'
  
  // Add drag handle if it doesn't exist
  if (!item.querySelector(`.${itemClass}-drag-handle`)) {
    const dragHandle = document.createElement('div');
    dragHandle.className = `${itemClass}-drag-handle`;
    dragHandle.innerHTML = '<svg width="16" height="16"><use href="#drag-icon" /></svg>';
    item.appendChild(dragHandle);
  }
  
  // Add controls if they don't exist
  if (!item.querySelector(`.${itemClass}-controls`)) {
    const controls = document.createElement('div');
    controls.className = `${itemClass}-controls`;
    controls.innerHTML = `
      <button class="${itemClass}-close-btn ${itemClass}-remove" data-${itemClass}-id="${itemId}">
        <svg width="16" height="16"><use href="#close-icon" /></svg>
      </button>
    `;
    item.appendChild(controls);
  }
  
  // Add remove button event (use setTimeout to ensure DOM is ready)
  setTimeout(() => {
    const removeBtn = item.querySelector(`.${itemClass}-remove`);
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeItem(itemId);
      });
    }
  }, 0);
}
  
  removeItem(itemId) {
    const item = document.getElementById(itemId);
    if (item) {
      // Add exit animation
      item.classList.add('widget-exit');
      
      // Wait for animation to complete before removing
      setTimeout(() => {
        // Notify item factory of removal for cleanup
        if (this.itemFactory && this.itemFactory.removeItem) {
          this.itemFactory.removeItem(item);
        }
        
        // Remove the item element
        item.remove();
        
        // Remove from items array
        this.items = this.items.filter(w => w.id !== itemId);
        
        // Save items to localStorage
        this.saveItems();
      }, 300);
    }
  }
  
  findEmptySlot() {
    for (const slot of this.slots) {
      if (!slot.querySelector(`.${this.config.itemClass}`)) {
        return slot;
      }
    }
    return null;
  }
  
  /* –––––––––––––––––––––––––––
    PERSISTENCE
  ––––––––––––––––––––––––––– */
  
  saveItems() {
    // Save item data including positions
    const itemsToSave = this.items.map(item => {
      const itemElement = document.getElementById(item.id);
      let position = { x: 0, y: 0 };
      
      if (itemElement) {
        position = {
          x: parseFloat(itemElement.getAttribute('data-x') || 0),
          y: parseFloat(itemElement.getAttribute('data-y') || 0)
        };
      }
      
      return {
        ...item,
        position
      };
    });
    
    localStorage.setItem(this.config.storageKey, JSON.stringify(itemsToSave));
  }
  
  async loadItems() {
  const savedItems = localStorage.getItem(this.config.storageKey);
  if (savedItems && this.itemFactory) {
    try {
      const items = JSON.parse(savedItems);
      
      // Find the highest item ID to continue from
      let maxId = 0;
      items.forEach(item => {
        const idNum = parseInt(item.id.replace(`${this.config.itemClass}-`, ''));
        if (idNum > maxId) maxId = idNum;
      });
      this.nextItemId = maxId + 1;
      
      // Create each item
      for (const item of items) {
        const slot = document.querySelector(`${this.config.slotSelector}[data-slot-id="${item.slotId}"]`);
        if (slot) {
          // Use data if available, otherwise fall back to type for backward compatibility
          const itemData = item.data || item.type;
          
          const itemElement = await this.itemFactory.createItem(
            item.id, 
            itemData, 
            item.slotId, 
            item.position || { x: 0, y: 0 }
          );
          
          if (itemElement) {
            // Add core slot system attributes
            itemElement.id = item.id;
            itemElement.className = this.config.itemClass;
            itemElement.dataset.slotId = item.slotId;
            
            // Apply saved position
            if (item.position) {
              itemElement.style.transform = `translate(${item.position.x}px, ${item.position.y}px)`;
              itemElement.setAttribute('data-x', item.position.x);
              itemElement.setAttribute('data-y', item.position.y);
            }
            
            // Setup controls
            this.setupItemControls(itemElement, item.id);
            
            slot.appendChild(itemElement);
            
            // Add to items array
            this.items.push({
              id: item.id,
              data: itemData,
              slotId: item.slotId,
              position: item.position || { x: 0, y: 0 }
            });
          }
        }
      }
    } catch (e) {
      console.error('Error loading items:', e);
    }
  }
}
  
  /* –––––––––––––––––––––––––––
    DRAG AND DROP
  ––––––––––––––––––––––––––– */
  
  initInteract() {
    // Store reference to this for use in interact callbacks
    const self = this;
    
    // Make sure interact is available
    if (typeof interact === 'undefined') {
      console.error('interact.js is not loaded!');
      return;
    }
    
    // Make items draggable only from the handle
    interact(`.${this.config.itemClass}`)
      .draggable({
        // Only allow dragging from the handle
        allowFrom: `.${this.config.itemClass}-drag-handle`,
        
        // Enable inertial throwing
        inertia: false,
        
        // Keep the element within its parent
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true
          })
        ],
        
        // Enable autoScroll
        autoScroll: true,
        
        // Call this function on every dragmove event
        listeners: {
          move: dragMoveListener,
          end: dragEndListener
        }
      });

    function dragMoveListener(event) {
      const target = event.target;
      
      // Get the current position
      const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
      const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
      
      // Translate the element
      target.style.transform = `translate(${x}px, ${y}px)`;
      
      // Update the position attributes
      target.setAttribute('data-x', x);
      target.setAttribute('data-y', y);
      
      // Add dragging class
      target.classList.add('dragging');
      
      // Store the dragged item reference
      self.draggedItem = target;
    }
    
    function dragEndListener(event) {
      const target = event.target;
      target.classList.remove('dragging');
      self.draggedItem = null;
      
      // Save item positions
      self.saveItems();
    }
    
    // Set up dropzones
    interact(this.config.slotSelector)
      .dropzone({
        // Only accept elements matching this CSS selector
        accept: `.${this.config.itemClass}`,
        
        // Require a 50% element overlap for a drop to be possible
        overlap: 0.5,
        
        // Listen for drop related events
        listeners: {
          activate: function(event) {
            event.target.classList.add('drop-active');
          },
          
          dragenter: function(event) {
            const dropzone = event.target;
            dropzone.classList.add('drop-target');
            
            // Check if the slot already has an item
            const existingItem = Array.from(dropzone.children).find(
              child => child !== event.relatedTarget && child.classList.contains(self.config.itemClass)
            );
            
            // If there's an existing item, highlight it for swap
            if (existingItem) {
              existingItem.classList.add('swap-target');
            }
          },
          
          dragleave: function(event) {
            const dropzone = event.target;
            dropzone.classList.remove('drop-target');
            
            // Remove swap highlight from any items
            dropzone.querySelectorAll('.swap-target').forEach(el => {
              el.classList.remove('swap-target');
            });
          },
          
          drop: function(event) {
            const dropzone = event.target;
            const draggable = event.relatedTarget;
            
            // Check if the slot already has an item
            const existingItem = Array.from(dropzone.children).find(
              child => child !== draggable && child.classList.contains(self.config.itemClass)
            );
            
            if (existingItem) {
              // Perform a swap
              self.swapItems(draggable, existingItem, dropzone);
            } else {
              // Move to empty slot
              self.moveItemToSlot(draggable, dropzone);
            }
          },
          
          deactivate: function(event) {
            const dropzone = event.target;
            dropzone.classList.remove('drop-active');
            dropzone.classList.remove('drop-target');
            
            // Remove swap highlight from any items
            dropzone.querySelectorAll('.swap-target').forEach(el => {
              el.classList.remove('swap-target');
            });
          }
        }
      });
  }
  
  swapItems(draggedItem, existingItem, dropzone) {
    const originalSlot = draggedItem.parentNode;
    const draggedItemId = draggedItem.id;
    const existingItemId = existingItem.id;
    
    // Swap the items
    originalSlot.appendChild(existingItem);
    dropzone.appendChild(draggedItem);
    
    // Reset positions for both items with animation
    [draggedItem, existingItem].forEach(item => {
      item.style.transition = 'transform 0.3s ease';
      item.style.transform = 'translate(0, 0)';
      item.setAttribute('data-x', 0);
      item.setAttribute('data-y', 0);
      item.classList.remove('swap-target');
      
      setTimeout(() => {
        item.style.transition = '';
      }, 300);
    });
    
    // Update item data in the items array
    const draggedItemData = this.items.find(w => w.id === draggedItemId);
    const existingItemData = this.items.find(w => w.id === existingItemId);
    
    if (draggedItemData && existingItemData) {
      // Swap slot IDs
      const tempSlotId = draggedItemData.slotId;
      draggedItemData.slotId = existingItemData.slotId;
      existingItemData.slotId = tempSlotId;
      
      // Update dataset attributes
      draggedItem.dataset.slotId = draggedItemData.slotId;
      existingItem.dataset.slotId = existingItemData.slotId;
      
      // Reset positions
      draggedItemData.position = { x: 0, y: 0 };
      existingItemData.position = { x: 0, y: 0 };
      
      // Save items to localStorage
      this.saveItems();
    }
  }
  
  moveItemToSlot(draggable, dropzone) {
    const originalSlot = draggable.parentNode;
    
    // Move the draggable element to the drop target
    if (originalSlot) {
      originalSlot.removeChild(draggable);
    }
    
    dropzone.appendChild(draggable);
    
    // Reset the transform and position with animation
    draggable.style.transition = 'transform 0.3s ease';
    draggable.style.transform = 'translate(0, 0)';
    draggable.setAttribute('data-x', 0);
    draggable.setAttribute('data-y', 0);
    
    setTimeout(() => {
      draggable.style.transition = '';
    }, 300);
    
    // Update item data
    const itemId = draggable.id;
    const slotId = dropzone.dataset.slotId;
    
    // Update in items array
    const item = this.items.find(w => w.id === itemId);
    if (item) {
      item.slotId = slotId;
      item.position = { x: 0, y: 0 };
      draggable.dataset.slotId = slotId;
      
      // Save items to localStorage
      this.saveItems();
    }
  }
  
  /* –––––––––––––––––––––––––––
    PUBLIC API
  ––––––––––––––––––––––––––– */
  
  // Register an item factory that handles item creation and content
  setItemFactory(factory) {
    this.itemFactory = factory;
    
    // If items were already loaded before factory was set, try loading again
    if (this.items.length === 0) {
      this.loadItems();
    }
  }
  
  // Get all current items
  getItems() {
    return [...this.items];
  }
  
  // Get item by ID
  getItem(itemId) {
    return this.items.find(item => item.id === itemId);
  }
  
  // Programmatically add an item
  async addItemProgrammatically(itemType, slotId = null) {
    if (slotId) {
      const targetSlot = document.querySelector(`${this.config.slotSelector}[data-slot-id="${slotId}"]`);
      if (targetSlot && !targetSlot.querySelector(`.${this.config.itemClass}`)) {
        // Temporarily override findEmptySlot to return specific slot
        const originalFindEmptySlot = this.findEmptySlot;
        this.findEmptySlot = () => targetSlot;
        const result = await this.addItem(itemType);
        this.findEmptySlot = originalFindEmptySlot;
        return result;
      }
    }
    return await this.addItem(itemType);
  }
  
  // Programmatically remove an item
  removeItemProgrammatically(itemId) {
    this.removeItem(itemId);
  }
}

/* –––––––––––––––––––––––––––
  EXPORTS
––––––––––––––––––––––––––– */
export { SlotSystem, SlotFactory };

