/*
File name & path: root/services/background-manager.js
Role: Simplified background management system
*/

class BackgroundManager {
    constructor(modalManager) {
        this.modalManager = modalManager;
        this.backgrounds = [
            { name: 'Default Dark', value: '#0f172a', type: 'color' },
            { name: 'Ocean Gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', type: 'gradient' },
            { name: 'Forest Gradient', value: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)', type: 'gradient' },
            { name: 'Sunset Gradient', value: 'linear-gradient(135deg, #f97316 0%, #ef4444 50%, #dc2626 100%)', type: 'gradient' }
        ];
        
        this.currentIndex = this.loadBackgroundIndex();
        this.selectedIndex = this.currentIndex;
        
        // Apply initial background after a small delay to ensure DOM is ready
        setTimeout(() => this.applyBackground(), 100);
    }
    
    openModal() {
        console.log('Opening simplified background modal...');
        
        // Reset selected index to current when opening modal
        this.selectedIndex = this.currentIndex;
        
        const content = `
            <div style="padding: 20px;">
                <label for="background-select" style="display: block; margin-bottom: 10px; font-weight: 600;">
                    Choose Background:
                </label>
                <select id="background-select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 16px;">
                    ${this.backgrounds.map((bg, index) => `
                        <option value="${index}" ${index === this.currentIndex ? 'selected' : ''}>
                            ${bg.name}
                        </option>
                    `).join('')}
                </select>
                <div style="margin-top: 20px; padding: 20px; border-radius: 8px; height: 100px; transition: all 0.3s ease;" id="preview-box"></div>
            </div>
        `;
        
        this.modalManager.open({
            title: 'Background Settings',
            content: content,
            saveLabel: 'Apply',
            showActions: true,
            onSave: () => this.handleSave(),
            onOpen: () => {
                // Set up change listener
                const select = document.getElementById('background-select');
                const previewBox = document.getElementById('preview-box');
                
                if (select && previewBox) {
                    // Show initial preview
                    this.updatePreview(previewBox, this.currentIndex);
                    
                    select.addEventListener('change', (e) => {
                        this.selectedIndex = parseInt(e.target.value);
                        console.log('Selected background index:', this.selectedIndex);
                        this.updatePreview(previewBox, this.selectedIndex);
                    });
                }
            }
        });
    }
    
    updatePreview(previewElement, index) {
        const background = this.backgrounds[index];
        if (background.type === 'color') {
            previewElement.style.background = '';
            previewElement.style.backgroundColor = background.value;
        } else {
            previewElement.style.backgroundColor = '';
            previewElement.style.background = background.value;
        }
    }
    
    handleSave() {
        console.log('Saving background selection...');
        console.log('Current index:', this.currentIndex);
        console.log('Selected index:', this.selectedIndex);
        
        // Update current index
        this.currentIndex = this.selectedIndex;
        
        // Save to localStorage
        localStorage.setItem('backgroundIndex', this.currentIndex.toString());
        
        // Apply the background
        this.applyBackground();
        
        console.log('Background saved and applied');
        return true; // Close modal
    }
    
    applyBackground() {
        // Wait for next frame to ensure DOM is ready
        requestAnimationFrame(() => {
            const targetElement = document.querySelector('main');
            if (!targetElement) {
                console.error('Main element not found! Retrying...');
                // Retry after a delay
                setTimeout(() => this.applyBackground(), 500);
                return;
            }
            
            const background = this.backgrounds[this.currentIndex];
            console.log('Applying background to main element:', background);
            
            // Clear ALL existing background styles
            targetElement.style.cssText = targetElement.style.cssText.replace(/background[^;]+;/g, '');
            
            // Apply new background
            if (background.type === 'color') {
                targetElement.style.backgroundColor = background.value;
            } else {
                targetElement.style.background = background.value;
            }
            
            // Force browser to repaint
            targetElement.offsetHeight;
            
            console.log('Background applied successfully');
            console.log('Main element background:', window.getComputedStyle(targetElement).background);
        });
    }
    
    loadBackgroundIndex() {
        const saved = localStorage.getItem('backgroundIndex');
        const index = saved ? parseInt(saved) : 0;
        console.log('Loaded background index from storage:', index);
        return index;
    }
}

export { BackgroundManager };