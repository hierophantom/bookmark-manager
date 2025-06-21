Bookmarks-manager README file

/* –––––––––––––––––––––––––––
  HOUSE RULES
––––––––––––––––––––––––––– */

read before giving answers:
1. Scan latest RAW files before answering
2. Don't invent stuff that don't exists.
3. provide a minimalistic approach to achieve the goal.
4. Provide changes in code by section. example to a section follows:
/* –––––––––––––––––––––––––––
  THIS IS A SECTION
––––––––––––––––––––––––––– */
End of example.
5. Be good.

/* –––––––––––––––––––––––––––
  ARCHITECTURE NOTES
––––––––––––––––––––––––––– */

1. Slot System: Generic drag/drop system that can work with any item type
2. Factory Pattern: Widgets and shortcuts use factories for creating instances
3. Modal System: Reusable modal system with content providers
4. Service Layer: Specialized services for different content types (widgets, shortcuts, bookmarks)
5. Theme System: CSS custom properties with automatic/manual theme switching
6. Chrome API Integration: Background service worker and content scripts for browser integration


/* –––––––––––––––––––––––––––
  ROOT FOLDER TREE
––––––––––––––––––––––––––– */

root >
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/manifest.json

root > main >
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/main/main.html
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/main/main.js
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/main/main.css
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/main/background.js

root > slots-system >
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/slots-system/slots.js
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/slots-system/slots.css
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/slots-system/modal.css
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/slots-system/modal.js

root > services>
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/services/widgets.js
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/services/widgets.css
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/services/shortcuts.js
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/services/shortcuts.css

https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/services/bookmarks.css
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/services/bookmarks.js

Root > libs>
https://raw.githubusercontent.com/hierophantom/bookmark-manager/refs/heads/main/libs/icons.js