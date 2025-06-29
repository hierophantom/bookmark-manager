/*
File name & path: root/main/main.js
Role: Main application controller coordinating slot systems, factories, modal managers, theme system, and page navigation
Method: Initializes generic modal manager, widget/shortcut factories, slot systems, connects them together, handles theme switching, page management (homepage/bookmarks), drawer controls with hover zones, and keyboard/mouse navigation
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
  INITIALIZATION WITH TAB GROUPS
––––––––––––––––––––––––––– */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize sprite sheet
  createSpriteSheet();

  // Initialize generic modal manager (shared by all systems)
  const modalManager = new ModalManager();

  // Initialize widget factory
  const widgetFactory = new WidgetFactory();

  // Initialize widget slot system with slot factory config
  const widgetSlotSystem = new SlotSystem({
    storageKey: 'slotWidgets',
    slotSelector: '.widget-slot',
    containerSelector: '#widgets-container',
    controlsSelector: '#widget-controls',
    addButtonSelector: '#add-widget-btn',
    modalSelector: null, // We'll handle this with generic modal
    itemClass: 'widget',
    slotConfig: {
      name: 'widget-slots',
      count: 8, // Variable number of slots
      cssClass: 'widget-slot',
      idPrefix: '', // Will create slot IDs as "1", "2", "3", etc.
      startIndex: 1,
      additionalAttributes: {} // Any additional attributes can be added here
    }
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

  // Initialize shortcuts slot system with slot factory config
  const shortcutsSlotSystem = new SlotSystem({
    storageKey: 'slotShortcuts',
    slotSelector: '.shortcut-slot',
    containerSelector: '#shortcuts-container',
    controlsSelector: '#shortcuts-controls',
    addButtonSelector: '#add-shortcut-btn',
    modalSelector: null, // We'll handle this with generic modal
    itemClass: 'shortcut',
    slotConfig: {
      name: 'shortcut-slots',
      count: 8, // Variable number of slots
      cssClass: 'shortcut-slot',
      idPrefix: 's', // Will create slot IDs as "s1", "s2", "s3", etc.
      startIndex: 1,
      additionalAttributes: {} // Any additional attributes can be added here
    }
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

  // Initialize tab groups controls
  const refreshTabGroupsBtn = document.getElementById('refresh-tab-groups-btn');

  if (refreshTabGroupsBtn) {
    refreshTabGroupsBtn.addEventListener('click', () => {
      // Refresh tab groups
      if (window.tabGroupsService) {
        window.tabGroupsService.refresh();
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

  // Auto-refresh every 5 minutes
  if (!localStorage.getItem('refreshSet')) {
    localStorage.setItem('refreshSet', '1');
    setInterval(() => location.reload(), 3600000);
  }
});

// Make services globally available for debugging and cross-component access
window.addEventListener('load', () => {
  // Wait a bit for all modules to load
  setTimeout(() => {
    if (typeof tabGroupsService !== 'undefined') {
      window.tabGroupsService = tabGroupsService;
    }
    if (typeof bookmarksService !== 'undefined') {
      window.bookmarksService = bookmarksService;
    }
  }, 100);
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
  constructor(pageConfig = null) {
    // Default page configuration - uses existing HTML structure
    this.defaultPages = [
      { id: 'homepage', label: 'Home' },
      { id: 'bookmarks', label: 'Bookmarks' },
      { id: 'journey', label: 'Journey' }
    ];
    
    // Use provided config or default
    this.pageConfig = pageConfig || this.defaultPages;
    this.pages = this.pageConfig.map(page => page.id);
    this.pageLabels = this.pageConfig.map(page => page.label);
    
    // Load last visited page from localStorage, default to homepage (index 0)
    this.currentPageIndex = parseInt(localStorage.getItem('lastVisitedPage')) || 0;
    
    // Ensure the loaded page index is valid
    if (this.currentPageIndex >= this.pages.length) {
      this.currentPageIndex = 0;
    }

    // Mouse gesture tracking
    this.gestureTimeout = null;
    this.gestureThreshold = 50; // pixels
    this.gestureCooldown = 500; // milliseconds

    // Initialize elements
    this.initializeElements();

    // Only proceed if required elements exist
    if (this.pagesContainer) {
      // Validate that all configured pages exist in HTML
      this.validatePages();
      
      // Create page indicator buttons
      this.createPageIndicators();
      
      // Initialize page positions
      this.updatePagePositions();
      
      // Update navigation buttons
      this.updateNavigationButtons();
      
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
    this.footer = document.querySelector('footer');
  }

  validatePages() {
    // Check that all configured pages exist in the HTML
    const missingPages = [];
    this.pages.forEach(pageId => {
      const pageElement = document.getElementById(pageId);
      if (!pageElement) {
        missingPages.push(pageId);
      }
    });
    
    if (missingPages.length > 0) {
      console.warn('Missing page elements:', missingPages);
      // Filter out missing pages from configuration
      this.pageConfig = this.pageConfig.filter(page => !missingPages.includes(page.id));
      this.pages = this.pageConfig.map(page => page.id);
      this.pageLabels = this.pageConfig.map(page => page.label);
      
      // Adjust current page index if necessary
      if (this.currentPageIndex >= this.pages.length) {
        this.currentPageIndex = 0;
      }
    }
  }

  createPageIndicators() {
    if (!this.footer) return;

    // Remove existing indicators if they exist
    const existingIndicators = this.footer.querySelector('.page-indicators');
    if (existingIndicators) {
      existingIndicators.remove();
    }

    // Create container for page indicators
    const indicatorsContainer = document.createElement('div');
    indicatorsContainer.className = 'page-indicators';

    // Create individual page indicator buttons
    this.pages.forEach((pageId, index) => {
      const indicator = document.createElement('button');
      indicator.className = 'page-indicator';
      indicator.textContent = (index + 1).toString();
      indicator.title = this.pageLabels[index];
      indicator.dataset.pageIndex = index;
      
      // Add click handler
      indicator.addEventListener('click', () => {
        this.navigateToPage(index);
      });
      
      indicatorsContainer.appendChild(indicator);
    });

    // Insert before the existing navigation buttons
    this.footer.insertBefore(indicatorsContainer, this.prevBtn);
    
    // Store reference to indicators
    this.pageIndicators = indicatorsContainer.querySelectorAll('.page-indicator');
  }

  bindEvents() {
    // Button navigation
    if (this.prevBtn && this.nextBtn) {
      this.prevBtn.addEventListener('click', () => this.navigatePage('prev'));
      this.nextBtn.addEventListener('click', () => this.navigatePage('next'));
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      // Allow arrow keys for page navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.navigatePage('prev');
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigatePage('next');
      }
      
      // Number keys for direct page navigation
      const num = parseInt(e.key);
      if (num >= 1 && num <= this.pages.length) {
        e.preventDefault();
        this.navigateToPage(num - 1);
      }
    });

    // Enhanced mouse gesture navigation
    this.bindMouseGestures();
  }

  bindMouseGestures() {
    let isGestureActive = false;
    
    document.addEventListener('wheel', (e) => {
      // Prevent gesture handling if we're in cooldown
      if (isGestureActive) return;
      
      // Check if it's a horizontal scroll (Magic Mouse gesture or trackpad)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > this.gestureThreshold) {
        // Prevent default scrolling
        e.preventDefault();
        
        // Set gesture active flag
        isGestureActive = true;
        
        // Clear any existing timeout
        if (this.gestureTimeout) {
          clearTimeout(this.gestureTimeout);
        }
        
        // Simple next/previous navigation - same as arrow keys and buttons
        if (e.deltaX > this.gestureThreshold) {
          // Swipe left on Magic Mouse - go to previous page
          this.navigatePage('next');
        } else if (e.deltaX < -this.gestureThreshold) {
          // Swipe right on Magic Mouse - go to next page
          this.navigatePage('prev');
        }
        
        // Reset gesture flag after cooldown
        this.gestureTimeout = setTimeout(() => {
          isGestureActive = false;
        }, this.gestureCooldown);
      }
    }, { passive: false });
  }

  handleGestureNavigation(direction) {
    const totalPages = this.pages.length;
    
    console.log(`Gesture: ${direction}, Current page: ${this.currentPageIndex}, Total pages: ${totalPages}`);
    
    // For 3 pages: implement skipping behavior ONLY when on first/last pages
    if (totalPages === 3) {
      if (direction === 'next') {
        if (this.currentPageIndex === 0) {
          // From first page: jump to last page (skip middle)
          console.log('From page 0 -> jumping to page 2 (skip middle)');
          this.navigateToPage(2);
        } else if (this.currentPageIndex === 1) {
          // From middle page: normal navigation to next
          console.log('From page 1 -> going to page 2 (normal)');
          this.navigateToPage(2);
        } else {
          // From last page: wrap to first
          console.log('From page 2 -> wrapping to page 0');
          this.navigateToPage(0);
        }
      } else { // direction === 'prev'
        if (this.currentPageIndex === 0) {
          // From first page: wrap to last
          console.log('From page 0 -> wrapping to page 2');
          this.navigateToPage(2);
        } else if (this.currentPageIndex === 1) {
          // From middle page: normal navigation to previous
          console.log('From page 1 -> going to page 0 (normal)');
          this.navigateToPage(0);
        } else {
          // From last page: jump to first page (skip middle)
          console.log('From page 2 -> jumping to page 0 (skip middle)');
          this.navigateToPage(0);
        }
      }
    } else {
      // For other numbers of pages, use normal navigation
      this.navigatePage(direction);
    }
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
      this.saveCurrentPage();
    }
  }

  navigateToPage(pageIndex) {
    if (pageIndex >= 0 && pageIndex < this.pages.length && pageIndex !== this.currentPageIndex) {
      this.currentPageIndex = pageIndex;
      this.updatePagePositions();
      this.updateNavigationButtons();
      this.saveCurrentPage();
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

    // Update page indicators
    if (this.pageIndicators) {
      this.pageIndicators.forEach((indicator, index) => {
        indicator.classList.toggle('active', index === this.currentPageIndex);
      });
    }
  }

  updateNavigationButtons() {
    if (this.prevBtn && this.nextBtn) {
      this.prevBtn.disabled = this.currentPageIndex === 0;
      this.nextBtn.disabled = this.currentPageIndex === this.pages.length - 1;
    }
  }

  saveCurrentPage() {
    localStorage.setItem('lastVisitedPage', this.currentPageIndex.toString());
  }

  // Public API for adding custom pages (creates HTML element)
  addPage(pageConfig) {
    // Create the page element
    const pageElement = document.createElement('div');
    pageElement.id = pageConfig.id;
    pageElement.className = 'page';
    
    // Add content if provided
    if (pageConfig.content) {
      pageElement.innerHTML = pageConfig.content;
    }
    
    // Append to pages container
    this.pagesContainer.appendChild(pageElement);
    
    // Update configuration
    this.pageConfig.push(pageConfig);
    this.pages.push(pageConfig.id);
    this.pageLabels.push(pageConfig.label);
    
    // Recreate indicators and update positions
    this.createPageIndicators();
    this.updatePagePositions();
    this.updateNavigationButtons();
  }

  // Public API for removing pages (removes HTML element)
  removePage(pageId) {
    const index = this.pages.indexOf(pageId);
    if (index === -1) return false;
    
    // Remove the HTML element
    const pageElement = document.getElementById(pageId);
    if (pageElement) {
      pageElement.remove();
    }
    
    // Remove from arrays
    this.pageConfig.splice(index, 1);
    this.pages.splice(index, 1);
    this.pageLabels.splice(index, 1);
    
    // Adjust current page index if necessary
    if (this.currentPageIndex >= index && this.currentPageIndex > 0) {
      this.currentPageIndex--;
    }
    
    // Recreate indicators and update positions
    this.createPageIndicators();
    this.updatePagePositions();
    this.updateNavigationButtons();
    this.saveCurrentPage();
    
    return true;
  }

  // Public API for getting current page info
  getCurrentPage() {
    return {
      index: this.currentPageIndex,
      id: this.pages[this.currentPageIndex],
      label: this.pageLabels[this.currentPageIndex],
      config: this.pageConfig[this.currentPageIndex]
    };
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
  TOOLTIP SYSTEM
––––––––––––––––––––––––––– */

class TooltipManager {
  static addTooltip(element, content, direction = 'n', enabled = true) {
    element.classList.add('tooltip', `tooltip-${direction}`);
    element.setAttribute('data-tooltip', content);
    element.setAttribute('data-tooltip-enabled', enabled);
  }

  static removeTooltip(element) {
    element.classList.remove('tooltip', 'tooltip-n', 'tooltip-s', 'tooltip-e', 'tooltip-w');
    element.removeAttribute('data-tooltip');
    element.removeAttribute('data-tooltip-enabled');
  }

  static updateTooltip(element, content, direction, enabled) {
    if (content !== undefined) element.setAttribute('data-tooltip', content);
    if (direction !== undefined) {
      element.classList.remove('tooltip-n', 'tooltip-s', 'tooltip-e', 'tooltip-w');
      element.classList.add(`tooltip-${direction}`);
    }
    if (enabled !== undefined) element.setAttribute('data-tooltip-enabled', enabled);
  }

  static toggleTooltip(element, enabled) {
    element.setAttribute('data-tooltip-enabled', enabled);
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