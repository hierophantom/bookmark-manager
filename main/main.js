/*
File name & path: main/main.js
Role: The main JS file with both widget and shortcuts modals
*/

/* –––––––––––––––––––––––––––
  IMPORTS
––––––––––––––––––––––––––– */

import { createSpriteSheet } from '../libs/icons.js';
import { SlotSystem } from '../slots-system/slots.js';
import { WidgetFactory, WidgetsModalManager } from '../services/widgets.js';
import { ShortcutsFactory, ShortcutsModalManager } from '../services/shortcuts.js';
import { ModalManager } from '../slots-system/modal.js';

/* –––––––––––––––––––––––––––
  INITIALIZATION
––––––––––––––––––––––––––– */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize sprite sheet
  createSpriteSheet();

  // Initialize generic modal manager (shared by all systems)
  const modalManager = new ModalManager();

  // Initialize widget factory
  const widgetFactory = new WidgetFactory();

  // Initialize widget slot system
  const widgetSlotSystem = new SlotSystem({
    storageKey: 'slotWidgets',
    slotSelector: '.slot',
    containerSelector: '.slot-container',
    controlsSelector: '.slot-controls',
    addButtonSelector: '#add-widget-btn',
    modalSelector: null, // We'll handle this with generic modal
    itemClass: 'widget'
  });

  // Connect the widget factory to the widget slot system
  widgetSlotSystem.setItemFactory(widgetFactory);

  // Initialize widgets modal manager with generic modal
  const widgetsModal = new WidgetsModalManager(widgetSlotSystem, modalManager);

  // Override the default add widget behavior
  const addWidgetBtn = document.getElementById('add-widget-btn');
  if (addWidgetBtn) {
    // Remove default event listeners
    addWidgetBtn.replaceWith(addWidgetBtn.cloneNode(true));
    
    // Add custom event listener
    const newAddWidgetBtn = document.getElementById('add-widget-btn');
    newAddWidgetBtn.addEventListener('click', () => {
      // Check if there are empty slots
      const emptySlot = widgetSlotSystem.findEmptySlot();
      if (emptySlot) {
        widgetsModal.openModal();
      } else {
        // Use generic modal to show error
        modalManager.open({
          title: 'No Empty Slots',
          content: '<p>All widget slots are full. Please remove some widgets first.</p>',
          saveLabel: 'OK',
          showActions: false,
          onSave: () => true // Just close the modal
        });
      }
    });
  }

  // Initialize shortcuts factory
  const shortcutsFactory = new ShortcutsFactory();

  // Initialize shortcuts slot system
  const shortcutsSlotSystem = new SlotSystem({
    storageKey: 'slotShortcuts',
    slotSelector: '.shortcut-slot',
    containerSelector: '.shortcuts-container',
    controlsSelector: '.shortcuts-controls',
    addButtonSelector: '#add-shortcut-btn',
    modalSelector: null, // We'll handle this with generic modal
    itemClass: 'shortcut'
  });

  // Connect the shortcuts factory to the shortcuts slot system
  shortcutsSlotSystem.setItemFactory(shortcutsFactory);

  // Initialize shortcuts modal manager with generic modal
  const shortcutsModal = new ShortcutsModalManager(shortcutsSlotSystem, modalManager);

  // Override the default add shortcut behavior
  const addShortcutBtn = document.getElementById('add-shortcut-btn');
  if (addShortcutBtn) {
    // Remove default event listeners
    addShortcutBtn.replaceWith(addShortcutBtn.cloneNode(true));
    
    // Add custom event listener
    const newAddShortcutBtn = document.getElementById('add-shortcut-btn');
    newAddShortcutBtn.addEventListener('click', () => {
      // Find first empty slot
      const emptySlot = shortcutsSlotSystem.findEmptySlot();
      if (emptySlot) {
        shortcutsModal.openModal(emptySlot);
      } else {
        // Use generic modal to show error
        modalManager.open({
          title: 'No Empty Slots',
          content: '<p>All shortcut slots are full. Please remove some shortcuts first.</p>',
          saveLabel: 'OK',
          showActions: false,
          onSave: () => true // Just close the modal
        });
      }
    });
  }

  // Initialize other managers
  const pageManager = new PageManager();
  const drawerManager = new DrawerManager();
  
  // Initialize theme system
  initializeThemeSystem();
  
  // Initialize main menu
  initializeMainMenu();
});

/* –––––––––––––––––––––––––––
  THEME SYSTEM
––––––––––––––––––––––––––– */

function initializeThemeSystem() {
  // Get current theme from localStorage
  const currentTheme = localStorage.getItem('theme') || 'auto';
  
  // Initialize theme manager
  const themeManager = new ThemeManager();

  // Add click handlers to theme options
  const themeOptions = document.querySelectorAll('.theme-option');
  
  // Set initial active state
  themeOptions.forEach(option => {
    if (option.dataset.theme === currentTheme) {
      option.classList.add('active');
    }
    
    // Add click handler
    option.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all options
      themeOptions.forEach(opt => opt.classList.remove('active'));
      
      // Add active class to clicked option
      option.classList.add('active');
      
      // Set the theme
      const theme = option.dataset.theme;
      localStorage.setItem('theme', theme);
      
      // Update theme
      themeManager.setTheme(theme);
      
      // Close the menu after selection
      const menu = document.querySelector('.action-menu');
      const menuButton = document.querySelector('.action-button');
      if (menu && menuButton) {
        menu.classList.remove('show');
        menuButton.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

/* –––––––––––––––––––––––––––
  THEME SELECTION
––––––––––––––––––––––––––– */
const Theme = {
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: 'auto'
};

class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || Theme.AUTO;
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Initialize theme
    this.applyTheme();
    
    // Listen for system theme changes
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentTheme === Theme.AUTO) {
        this.applyTheme();
      }
    });
  }

  setTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme();
  }

  applyTheme() {
    const isDark = this.currentTheme === Theme.DARK || 
      (this.currentTheme === Theme.AUTO && this.mediaQuery.matches);
    
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.documentElement.classList.toggle('light-theme', !isDark);
  }
}

/* –––––––––––––––––––––––––––
  PAGE MANAGEMENT
––––––––––––––––––––––––––– */
class PageManager {
  constructor() {
    this.pages = ['homepage', 'bookmarks'];
    this.currentPageIndex = 0;

    // Initialize elements
    this.initializeElements();

    // Only proceed if required elements exist
    if (this.pagesContainer) {
      // Initialize page positions
      this.updatePagePositions();
      
      // Bind event listeners
      this.bindEvents();
    } else {
      console.warn('Required page elements not found');
    }
  }

  initializeElements() {
    this.prevBtn = document.getElementById('prev-page');
    this.nextBtn = document.getElementById('next-page');
    this.pagesContainer = document.querySelector('.pages-container');
  }

  bindEvents() {
    // Button navigation
    if (this.prevBtn && this.nextBtn) {
      this.prevBtn.addEventListener('click', () => this.navigatePage('prev'));
      this.nextBtn.addEventListener('click', () => this.navigatePage('next'));
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.navigatePage('prev');
      if (e.key === 'ArrowRight') this.navigatePage('next');
    });

    // Mouse gesture navigation (Magic Mouse)
    document.addEventListener('wheel', (e) => {
      // Check if it's a horizontal scroll (Magic Mouse gesture)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        if (e.deltaX > 50) this.navigatePage('next');
        if (e.deltaX < -50) this.navigatePage('prev');
      }
    }, { passive: true });
  }

  navigatePage(direction) {
    const prevIndex = this.currentPageIndex;
    
    if (direction === 'next' && this.currentPageIndex < this.pages.length - 1) {
      this.currentPageIndex++;
    } else if (direction === 'prev' && this.currentPageIndex > 0) {
      this.currentPageIndex--;
    }

    // Only update if the page actually changed
    if (prevIndex !== this.currentPageIndex) {
      this.updatePagePositions();
      this.updateNavigationButtons();
    }
  }

  updatePagePositions() {
    this.pages.forEach((pageId, index) => {
      const page = document.getElementById(pageId);
      if (page) {
        page.classList.remove('active', 'previous', 'next');
        
        if (index === this.currentPageIndex) {
          page.classList.add('active');
        } else if (index < this.currentPageIndex) {
          page.classList.add('previous');
        } else {
          page.classList.add('next');
        }
      }
    });
  }

  updateNavigationButtons() {
    if (this.prevBtn && this.nextBtn) {
      this.prevBtn.disabled = this.currentPageIndex === 0;
      this.nextBtn.disabled = this.currentPageIndex === this.pages.length - 1;
    }
  }
}

/* –––––––––––––––––––––––––––
  DRAWER MANAGEMENT
––––––––––––––––––––––––––– */

class DrawerManager {
  constructor() {
    // Initialize drawer elements
    this.leftDrawer = document.querySelector('.drawer-left');
    this.rightDrawer = document.querySelector('.drawer-right');
    this.folderTreeBtn = document.querySelector('[data-action="toggle-folder-tree"]');
    this.activeTabsBtn = document.querySelector('[data-action="toggle-active-tabs"]');
    this.setupHoverZones();
    this.setupPinButtons();

    // Watch for page changes
    this.watchPageChanges();
    
    // Bind event listeners
    this.bindEvents();

    // Load saved states after a brief delay to ensure page is ready
    setTimeout(() => this.loadDrawerStates(), 0);
  }

  watchPageChanges() {
  // Create a MutationObserver to watch for page changes
  const observer = new MutationObserver(() => {
    this.handlePageChange();
  });

  // Observe both homepage and bookmarks pages
  const pages = document.querySelectorAll('#homepage, #bookmarks');
  pages.forEach(page => {
    observer.observe(page, {
      attributes: true,
      attributeFilter: ['class']
    });
  });

  // Initial check
  this.handlePageChange();
}

  setupPinButtons() {
    const pinButtons = document.querySelectorAll('.pin-button');
    
    pinButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const drawer = e.target.closest('.drawer');
        
        // Simple toggle: if collapsed, expand it; if expanded, collapse it
        const isCurrentlyCollapsed = drawer.classList.contains('collapsed');
        
        // Remove overlay state in any case
        drawer.classList.remove('overlay-visible');
        
        // Toggle collapsed state
        drawer.classList.toggle('collapsed', !isCurrentlyCollapsed);
        
        // Save the new state
        this.saveDrawerState(drawer, !isCurrentlyCollapsed);
      });
    });
  }

  loadDrawerStates() {
    // Only apply saved states if we're on the bookmarks page
    const isBookmarksPage = document.querySelector('#bookmarks.active');
    if (!isBookmarksPage) return;

    const leftDrawerState = localStorage.getItem('leftDrawerCollapsed');
    const rightDrawerState = localStorage.getItem('rightDrawerCollapsed');
    
    // Only apply if there's a saved state
    if (leftDrawerState !== null && this.leftDrawer) {
      this.leftDrawer.classList.toggle('collapsed', leftDrawerState === 'true');
    }
    
    if (rightDrawerState !== null && this.rightDrawer) {
      this.rightDrawer.classList.toggle('collapsed', rightDrawerState === 'true');
    }
  }

  saveDrawerState(drawer, isCollapsed) {
    if (drawer === this.leftDrawer) {
      localStorage.setItem('leftDrawerCollapsed', isCollapsed);
    } else if (drawer === this.rightDrawer) {
      localStorage.setItem('rightDrawerCollapsed', isCollapsed);
    }
  }

  bindEvents() {
    // Button click handlers
    if (this.folderTreeBtn) {
      this.folderTreeBtn.addEventListener('click', () => {
        const isBookmarksPage = document.querySelector('#bookmarks.active');
        if (isBookmarksPage) {
          this.toggleLeftDrawer();
        }
      });
    }
    
    if (this.activeTabsBtn) {
      this.activeTabsBtn.addEventListener('click', () => {
        const isBookmarksPage = document.querySelector('#bookmarks.active');
        if (isBookmarksPage) {
          this.toggleRightDrawer();
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const isBookmarksPage = document.querySelector('#bookmarks.active');
      if (!isBookmarksPage) return;
      
      // Control + F for left drawer
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this.toggleLeftDrawer();
      }
      // Control + T for right drawer
      if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        this.toggleRightDrawer();
      }
    });
  }

  handlePageChange() {
    const isBookmarksPage = document.querySelector('#bookmarks.active');
    
    if (!isBookmarksPage) {
      // Remove both normal and overlay visibility
      if (this.leftDrawer) {
        this.leftDrawer.classList.add('collapsed');
        this.leftDrawer.classList.remove('overlay-visible');
      }
      if (this.rightDrawer) {
        this.rightDrawer.classList.add('collapsed');
        this.rightDrawer.classList.remove('overlay-visible');
      }
    } else {
      // Restore saved states for normal visibility
      this.loadDrawerStates();
    }
  }

  toggleLeftDrawer() {
    if (this.leftDrawer) {
      const willBeCollapsed = !this.leftDrawer.classList.contains('collapsed');
      this.leftDrawer.classList.toggle('collapsed');
      this.saveDrawerState(this.leftDrawer, willBeCollapsed);
    }
  }

  toggleRightDrawer() {
    if (this.rightDrawer) {
      const willBeCollapsed = !this.rightDrawer.classList.contains('collapsed');
      this.rightDrawer.classList.toggle('collapsed');
      this.saveDrawerState(this.rightDrawer, willBeCollapsed);
    }
  }

  setupHoverZones() {
    // Create hover zones
    const leftZone = document.createElement('div');
    leftZone.className = 'drawer-hover-zone left';
    
    const rightZone = document.createElement('div');
    rightZone.className = 'drawer-hover-zone right';
    
    document.body.appendChild(leftZone);
    document.body.appendChild(rightZone);

    // Add hover listeners
    leftZone.addEventListener('mouseenter', () => {
      const isBookmarksPage = document.querySelector('#bookmarks.active');
      if (isBookmarksPage && this.leftDrawer) {
        this.leftDrawer.classList.add('overlay-visible');
      }
    });

    leftZone.addEventListener('mouseleave', () => {
      if (this.leftDrawer) {
        this.leftDrawer.classList.remove('overlay-visible');
      }
    });

    rightZone.addEventListener('mouseenter', () => {
      const isBookmarksPage = document.querySelector('#bookmarks.active');
      if (isBookmarksPage && this.rightDrawer) {
        this.rightDrawer.classList.add('overlay-visible');
      }
    });

    rightZone.addEventListener('mouseleave', () => {
      if (this.rightDrawer) {
        this.rightDrawer.classList.remove('overlay-visible');
      }
    });

    // Add mouseleave to drawers themselves
    this.leftDrawer?.addEventListener('mouseleave', () => {
      this.leftDrawer.classList.remove('overlay-visible');
    });

    this.rightDrawer?.addEventListener('mouseleave', () => {
      this.rightDrawer.classList.remove('overlay-visible');
    });
  }
}

/* –––––––––––––––––––––––––––
  MAIN MENU INITIALIZATION
––––––––––––––––––––––––––– */

function initializeMainMenu() {
  const menuButton = document.querySelector('.action-button');
  const menu = document.querySelector('.action-menu');
  
  if (!menuButton || !menu) return;
  
  // Toggle menu
  menuButton.addEventListener('click', () => {
    const isExpanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', !isExpanded);
    menu.classList.toggle('show');
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !menuButton.contains(e.target)) {
      menu.classList.remove('show');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });
}