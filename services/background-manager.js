/**
 * Background Customization Tool
 * 
 * This script provides functionality for customizing the background of a webpage.
 * Features include:
 * - Solid color backgrounds (predefined and custom colors)
 * - Image URL backgrounds
 * - Local image upload with compression
 * - Random Unsplash images with category selection
 * - Auto-refresh for Unsplash images
 * - Brightness/shade adjustment overlay
 * - Settings persistence using localStorage
 */

document.addEventListener('DOMContentLoaded', function() {
    /*------------------
       Constants
    ------------------*/
    // Color constants
    const COLORS = {
        RED: 'red',
        BLUE: 'blue',
        GREEN: 'green',
        YELLOW: 'yellow',
        CUSTOM: 'custom'
    };

    const DEFAULT_COLOR = COLORS.RED;
    const DEFAULT_IMAGE_URL = 'https://picsum.photos/1920/1080';
    const DEFAULT_CUSTOM_COLOR = '#663399';

    // Background type constants
    const BG_TYPES = {
        COLOR: 'color',
        IMAGE_URL: 'image',
        UPLOAD: 'upload',
        UNSPLASH: 'unsplash'
    };

    // Compression settings
    const COMPRESSION = {
        MAX_WIDTH: 1280,
        QUALITY: 0.8 // 80% quality
    };

    // Unsplash API settings
    const UNSPLASH_API = {
        ACCESS_KEY: 'Cl3l2uuRTnCiseduo8ZzhKXbLgtOFP9_h0mTiUEwFK8', // Replace with your actual key
        BASE_URL: 'https://api.unsplash.com/photos/random',
        WIDTH: 1920,
        HEIGHT: 1080
    };

    /*------------------
       DOM Elements
    ------------------*/
    const modal = document.getElementById('colorModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const applyBtn = document.getElementById('applyBtn');
    const colorSelect = document.getElementById('colorSelect');
    const mainElement = document.querySelector('.background-manager');
    const solidColorOption = document.getElementById('solidColorOption');
    const imageUrlOption = document.getElementById('imageUrlOption');
    const uploadImageOption = document.getElementById('uploadImageOption');
    const unsplashOption = document.getElementById('unsplashOption');
    const imageUrlInput = document.getElementById('imageUrlInput');
    const urlError = document.getElementById('urlError');
    const imageUpload = document.getElementById('imageUpload');
    const uploadStatus = document.getElementById('uploadStatus');
    const unsplashCategories = document.getElementById('unsplashCategories');
    const autoRefreshInterval = document.getElementById('autoRefreshInterval');
    const attributionFooter = document.getElementById('attributionFooter');
    const photoTitle = document.getElementById('photoTitle');
    const photographerLink = document.getElementById('photographerLink');
    const unsplashLink = document.getElementById('unsplashLink');
    const brightnessSlider = document.getElementById('brightnessSlider');
    const brightnessValue = document.getElementById('brightnessValue');
    const backgroundOverlay = document.getElementById('backgroundOverlay');

    /*------------------
       Dynamic Elements
    ------------------*/
    // Create custom color picker element
    const customColorPicker = document.createElement('input');
    customColorPicker.type = 'color';
    customColorPicker.id = 'customColorPicker';
    customColorPicker.value = localStorage.getItem('customColor') || DEFAULT_CUSTOM_COLOR;
    customColorPicker.style.display = 'none';
    customColorPicker.style.marginTop = '10px';
    document.getElementById('colorContent').appendChild(customColorPicker);

    /*------------------
       State Variables
    ------------------*/
    // Variables to store upload data
    let uploadedImage = null;
    let isValidUpload = false;
    let originalImageInfo = null;

    // Variables to store unsplash data
    let currentUnsplashImage = {
        url: null,
        photographer: null,
        photographerUrl: null,
        downloadLocation: null,
        title: null,
        photoUrl: null
    };

    // Variables for auto-refresh
    let refreshTimer = null;
    let nextRefreshTimestamp = null;

    /*------------------
       Initialization Functions
    ------------------*/
    // Initialize color select options programmatically
    function initializeColorOptions() {
        // Clear existing options
        colorSelect.innerHTML = '';

        // Add options from COLORS object
        Object.entries(COLORS).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = value;

            // Special handling for CUSTOM option
            if (key === 'CUSTOM') {
                const savedCustomColor = localStorage.getItem('customColor') || DEFAULT_CUSTOM_COLOR;
                option.textContent = `Custom Color (${savedCustomColor})`;
            } else {
                option.textContent = key.charAt(0) + key.slice(1).toLowerCase(); // Convert "RED" to "Red"
            }

            colorSelect.appendChild(option);
        });
    }

    // Initialize brightness slider
    function initializeBrightnessSlider() {
        // Load saved value
        const savedValue = parseInt(localStorage.getItem('brightnessValue') || '0', 10);

        // Set slider to saved value
        brightnessSlider.value = savedValue;

        // Apply the saved brightness
        applyBrightnessOverlay(savedValue);

        // Add event listener for changes
        brightnessSlider.addEventListener('input', function() {
            applyBrightnessOverlay(parseInt(this.value, 10));
        });
    }

    /*------------------
       Image Processing Functions
    ------------------*/

    // Fetch random image from Unsplash
    function fetchUnsplashImage(applyImmediately = false) {
        // Get selected categories
        const categories = getSelectedCategories();

        // Build API URL with query parameters
        const apiUrl = new URL(UNSPLASH_API.BASE_URL);
        apiUrl.searchParams.append('client_id', UNSPLASH_API.ACCESS_KEY);
        apiUrl.searchParams.append('query', categories);
        apiUrl.searchParams.append('orientation', 'landscape');
        apiUrl.searchParams.append('w', UNSPLASH_API.WIDTH);
        apiUrl.searchParams.append('h', UNSPLASH_API.HEIGHT);

        // Add a timestamp to ensure we get a different image
        apiUrl.searchParams.append('timestamp', Date.now().toString());

        // Fetch random image
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Store image data with additional metadata
                currentUnsplashImage = {
                    url: data.urls.regular,
                    photographer: data.user.name,
                    photographerUrl: data.user.links.html,
                    downloadLocation: data.links.download_location,
                    title: data.description || data.alt_description || 'Untitled Photo',
                    photoUrl: data.links.html
                };

                // Trigger download count (Unsplash API requirement)
                triggerUnsplashDownload();

                // Save to localStorage
                localStorage.setItem('unsplashImageUrl', currentUnsplashImage.url);
                localStorage.setItem('unsplashPhotographer', currentUnsplashImage.photographer);
                localStorage.setItem('unsplashPhotographerUrl', currentUnsplashImage.photographerUrl);
                localStorage.setItem('unsplashPhotoTitle', currentUnsplashImage.title);
                localStorage.setItem('unsplashPhotoUrl', currentUnsplashImage.photoUrl);
                localStorage.setItem('unsplashCategories', categories);

                // Only apply the background if explicitly requested or if auto-refresh triggered it
                if (applyImmediately) {
                    const backgroundType = localStorage.getItem('backgroundType');
                    if (backgroundType === BG_TYPES.UNSPLASH) {
                        mainElement.style.backgroundImage = `url(${currentUnsplashImage.url})`;
                        updateAttributionFooter();
                    }
                }

                // Update last refresh time
                localStorage.setItem('lastUnsplashRefresh', Date.now().toString());

                // Setup auto-refresh again
                setupAutoRefresh();
            })
            .catch(error => {
                console.error('Error fetching Unsplash image:', error);
            });
    }

    // Process and compress uploaded image
    function processUploadedImage(file) {
        // Check if file is an image
        if (!file.type.match('image.*')) {
            uploadStatus.textContent = 'Please select an image file (JPEG or PNG)';
            uploadStatus.className = 'error';
            isValidUpload = false;
            return;
        }

        // Create FileReader to read the file
        const reader = new FileReader();

        reader.onload = function(e) {
            // Create an image element to get dimensions
            const img = new Image();
            img.onload = function() {
                // Store original image info
                originalImageInfo = {
                    width: img.width,
                    height: img.height,
                    size: file.size
                };

                // Check if image meets minimum dimensions
                if (img.width < 1280 || img.height < 720) {
                    uploadStatus.textContent = 'Image too small. Minimum size: 1280×720px';
                    uploadStatus.className = 'error';
                    isValidUpload = false;
                    return;
                }

                // Compress the image
                compressImage(img);
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

    // Compress image to reduce file size
    function compressImage(img) {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate new dimensions while maintaining aspect ratio
        let newWidth = img.width;
        let newHeight = img.height;

        if (newWidth > COMPRESSION.MAX_WIDTH) {
            const ratio = COMPRESSION.MAX_WIDTH / newWidth;
            newWidth = COMPRESSION.MAX_WIDTH;
            newHeight = Math.floor(newHeight * ratio);
        }

        // Set canvas dimensions
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Draw image on canvas (resized)
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Get compressed image data
        const compressedImage = canvas.toDataURL('image/jpeg', COMPRESSION.QUALITY);

        // Clear any previous status messages
        uploadStatus.textContent = '';
        uploadStatus.className = '';

        // Store compressed image
        uploadedImage = compressedImage;
        isValidUpload = true;
    }

    /*------------------
       Utility Functions
    ------------------*/
    // Get selected categories as a comma-separated string
    function getSelectedCategories() {
        const selected = [];
        for (let i = 0; i < unsplashCategories.options.length; i++) {
            if (unsplashCategories.options[i].selected) {
                selected.push(unsplashCategories.options[i].value);
            }
        }

        // If nothing selected, default to nature
        if (selected.length === 0) {
            selected.push('nature');
            // Select the nature option
            for (let i = 0; i < unsplashCategories.options.length; i++) {
                if (unsplashCategories.options[i].value === 'nature') {
                    unsplashCategories.options[i].selected = true;
                    break;
                }
            }
        }

        return selected.join(',');
    }

    // Trigger Unsplash download count (required by API terms)
    function triggerUnsplashDownload() {
        if (currentUnsplashImage.downloadLocation) {
            fetch(`${currentUnsplashImage.downloadLocation}?client_id=${UNSPLASH_API.ACCESS_KEY}`)
                .catch(error => console.error('Error triggering download count:', error));
        }
    }

    // Apply brightness/shade overlay
    function applyBrightnessOverlay(value) {
        // Convert slider value to overlay properties
        let color, opacity;

        if (value < 0) {
            // Darker (black overlay)
            color = '#000000';
            opacity = Math.abs(value) / 125; // -100 becomes 0.8 opacity
        } else if (value > 0) {
            // Brighter (white overlay)
            color = '#ffffff';
            opacity = value / 125; // 100 becomes 0.8 opacity
        } else {
            // Neutral (no overlay)
            color = 'transparent';
            opacity = 0;
        }

        // Apply overlay
        backgroundOverlay.style.backgroundColor = color;
        backgroundOverlay.style.opacity = opacity;

        // Update display value
        brightnessValue.textContent = `Current: ${value}`;

        // Save to localStorage
        localStorage.setItem('brightnessValue', value.toString());
    }

    // Update attribution footer for Unsplash images
    function updateAttributionFooter() {
        if (localStorage.getItem('backgroundType') === BG_TYPES.UNSPLASH) {
            // Show attribution footer
            attributionFooter.style.display = 'block';

            // Update attribution text
            photoTitle.textContent = currentUnsplashImage.title || 'Untitled Photo';
            photographerLink.textContent = currentUnsplashImage.photographer || 'Unknown';
            photographerLink.href = currentUnsplashImage.photographerUrl || '#';
            unsplashLink.href = currentUnsplashImage.photoUrl || 'https://unsplash.com';
        } else {
            // Hide attribution footer for non-Unsplash backgrounds
            attributionFooter.style.display = 'none';
        }
    }

    /*------------------
       UI Management Functions
    ------------------*/
    // Toggle visibility of options based on radio selection
    function updateVisibleOptions() {
        document.getElementById('colorContent').style.display = 'none';
        document.getElementById('urlContent').style.display = 'none';
        document.getElementById('uploadContent').style.display = 'none';
        document.getElementById('unsplashContent').style.display = 'none';

        // Clear any error messages
        urlError.style.display = 'none';
        urlError.textContent = '';

        if (solidColorOption.checked) {
            document.getElementById('colorContent').style.display = 'block';
        } else if (imageUrlOption.checked) {
            document.getElementById('urlContent').style.display = 'block';
        } else if (uploadImageOption.checked) {
            document.getElementById('uploadContent').style.display = 'block';
        } else if (unsplashOption.checked) {
            document.getElementById('unsplashContent').style.display = 'block';

            // If no Unsplash image data exists yet, fetch one but don't apply it
            if (!currentUnsplashImage.url && !localStorage.getItem('unsplashImageUrl')) {
                fetchUnsplashImage(false);
            }
        }
    }

    // Apply background based on selected type
    function applyBackground(type, color, url, customColor, uploadedImageData, unsplashImageUrl) {
        // Reset background properties
        mainElement.style.backgroundColor = '';
        mainElement.style.backgroundImage = '';
        mainElement.style.backgroundSize = 'cover';
        mainElement.style.backgroundPosition = 'center';
        mainElement.style.backgroundRepeat = 'no-repeat';

        // Apply background based on type
        switch (type) {
            case BG_TYPES.COLOR:
                if (color === COLORS.CUSTOM) {
                    mainElement.style.backgroundColor = customColor;
                } else {
                    mainElement.style.backgroundColor = color;
                }
                // Hide attribution footer for solid colors
                attributionFooter.style.display = 'none';
                break;

            case BG_TYPES.IMAGE_URL:
                mainElement.style.backgroundImage = `url(${url})`;
                // Hide attribution footer for custom URLs
                attributionFooter.style.display = 'none';
                break;

            case BG_TYPES.UPLOAD:
                if (uploadedImageData) {
                    mainElement.style.backgroundImage = `url(${uploadedImageData})`;
                }
                // Hide attribution footer for uploaded images
                attributionFooter.style.display = 'none';
                break;

            case BG_TYPES.UNSPLASH:
                if (unsplashImageUrl) {
                    mainElement.style.backgroundImage = `url(${unsplashImageUrl})`;
                    // Show attribution footer for Unsplash images
                    updateAttributionFooter();
                } else {
                    // Fallback to default if no Unsplash image available
                    mainElement.style.backgroundImage = `url(${DEFAULT_IMAGE_URL})`;
                    attributionFooter.style.display = 'none';
                }
                break;
        }
    }

    /*------------------
       Auto-Refresh Functions
    ------------------*/
    // Setup auto-refresh functionality
    function setupAutoRefresh() {
        // Clear any existing timer
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }

        // Get interval in seconds
        const interval = parseInt(autoRefreshInterval.value, 10);

        // If interval is 0, auto-refresh is disabled
        if (interval === 0) {
            localStorage.removeItem('autoRefreshInterval');
            localStorage.removeItem('nextRefreshTimestamp');
            return;
        }

        // Save interval to localStorage
        localStorage.setItem('autoRefreshInterval', interval.toString());

        // Calculate next refresh time
        const now = Date.now();
        const lastRefresh = parseInt(localStorage.getItem('lastUnsplashRefresh') || now.toString(), 10);
        const timeSinceLastRefresh = now - lastRefresh;

        // If it's been longer than the interval since last refresh, refresh now
        if (timeSinceLastRefresh >= interval * 1000) {
            nextRefreshTimestamp = now + 1000; // Refresh in 1 second
        } else {
            // Otherwise, refresh after the remaining time
            nextRefreshTimestamp = lastRefresh + (interval * 1000);
        }

        // Save next refresh timestamp
        localStorage.setItem('nextRefreshTimestamp', nextRefreshTimestamp.toString());

        // Set timer
        const timeUntilRefresh = nextRefreshTimestamp - now;
        refreshTimer = setTimeout(function() {
            // Only refresh if Unsplash is the current background type
            if (localStorage.getItem('backgroundType') === BG_TYPES.UNSPLASH) {
                // For auto-refresh, we DO want to apply immediately
                fetchUnsplashImage(true);
            } else {
                // Just update the timestamp for next time
                localStorage.setItem('lastUnsplashRefresh', Date.now().toString());
                setupAutoRefresh();
            }
        }, timeUntilRefresh);
    }

    /*------------------
       Settings Management
    ------------------*/
    // Load saved settings from localStorage
    function loadSavedSettings() {
        const backgroundType = localStorage.getItem('backgroundType') || BG_TYPES.COLOR;
        const backgroundColor = localStorage.getItem('backgroundColor') || DEFAULT_COLOR;
        const backgroundUrl = localStorage.getItem('backgroundUrl') || DEFAULT_IMAGE_URL;
        const customColor = localStorage.getItem('customColor') || DEFAULT_CUSTOM_COLOR;
        const savedUploadedImage = localStorage.getItem('uploadedImage');
        const savedUnsplashCategories = localStorage.getItem('unsplashCategories');
        const savedUnsplashImageUrl = localStorage.getItem('unsplashImageUrl');
        const savedUnsplashPhotographer = localStorage.getItem('unsplashPhotographer');
        const savedUnsplashPhotographerUrl = localStorage.getItem('unsplashPhotographerUrl');
        const savedAutoRefreshInterval = localStorage.getItem('autoRefreshInterval');

        // Initialize brightness slider
        initializeBrightnessSlider();

        // Set form values
        switch (backgroundType) {
            case BG_TYPES.COLOR:
                solidColorOption.checked = true;
                colorSelect.value = backgroundColor;
                customColorPicker.value = customColor;

                // Show/hide color picker based on selection
                if (backgroundColor === COLORS.CUSTOM) {
                    customColorPicker.style.display = 'block';
                } else {
                    customColorPicker.style.display = 'none';
                }
                break;

            case BG_TYPES.IMAGE_URL:
                imageUrlOption.checked = true;
                imageUrlInput.value = backgroundUrl;
                break;

            case BG_TYPES.UPLOAD:
                uploadImageOption.checked = true;
                if (savedUploadedImage) {
                    uploadedImage = savedUploadedImage;
                    isValidUpload = true;
                    uploadStatus.className = '';
                }

                break;

            case BG_TYPES.UNSPLASH:
                unsplashOption.checked = true;

                // Set saved categories if available
                if (savedUnsplashCategories) {
                    const categories = savedUnsplashCategories.split(',');

                    // Deselect all options first
                    for (let i = 0; i < unsplashCategories.options.length; i++) {
                        unsplashCategories.options[i].selected = false;
                    }

                    // Select saved categories
                    for (let i = 0; i < unsplashCategories.options.length; i++) {
                        if (categories.includes(unsplashCategories.options[i].value)) {
                            unsplashCategories.options[i].selected = true;
                        }
                    }
                }

                // Set saved Unsplash image if available
                if (savedUnsplashImageUrl) {
                    currentUnsplashImage.url = savedUnsplashImageUrl;
                    currentUnsplashImage.photographer = savedUnsplashPhotographer || 'Unknown';
                    currentUnsplashImage.photographerUrl = savedUnsplashPhotographerUrl || '#';
                    currentUnsplashImage.title = localStorage.getItem('unsplashPhotoTitle') || 'Untitled Photo';
                    currentUnsplashImage.photoUrl = localStorage.getItem('unsplashPhotoUrl') || 'https://unsplash.com';
                }
                break;
        }

        // Set auto-refresh interval if available
        if (savedAutoRefreshInterval) {
            autoRefreshInterval.value = savedAutoRefreshInterval;
        }

        // Apply background
        applyBackground(
            backgroundType,
            backgroundColor,
            backgroundUrl,
            customColor,
            savedUploadedImage,
            savedUnsplashImageUrl
        );

        // Setup auto-refresh
        setupAutoRefresh();
    }

    /*------------------
       Event Listeners
    ------------------*/
    // Open modal
    openModalBtn.addEventListener('click', function() {
        modal.style.display = 'block';
    });

    // Close modal when clicking cancel
    cancelBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Toggle custom color picker visibility
    colorSelect.addEventListener('change', function() {
        if (this.value === COLORS.CUSTOM) {
            customColorPicker.style.display = 'block';
        } else {
            customColorPicker.style.display = 'none';
        }
    });

    // Update visible options when radio buttons change
    solidColorOption.addEventListener('change', updateVisibleOptions);
    imageUrlOption.addEventListener('change', updateVisibleOptions);
    uploadImageOption.addEventListener('change', updateVisibleOptions);
    unsplashOption.addEventListener('change', updateVisibleOptions);

    // Handle image upload
    imageUpload.addEventListener('change', function(e) {
        if (e.target.files && e.target.files[0]) {
            processUploadedImage(e.target.files[0]);
        }
    });

    // Handle auto-refresh interval changes
    autoRefreshInterval.addEventListener('change', function() {
        setupAutoRefresh();
    });

    // Apply settings and close modal
    applyBtn.addEventListener('click', function() {
        let backgroundType;
        if (solidColorOption.checked) {
            backgroundType = BG_TYPES.COLOR;
        } else if (imageUrlOption.checked) {
            backgroundType = BG_TYPES.IMAGE_URL;
        } else if (uploadImageOption.checked) {
            backgroundType = BG_TYPES.UPLOAD;
        } else if (unsplashOption.checked) {
            backgroundType = BG_TYPES.UNSPLASH;
        }

        const backgroundColor = colorSelect.value;
        const customColor = customColorPicker.value;
        let backgroundUrl = imageUrlInput.value.trim();

        // Clear any previous error messages
        urlError.style.display = 'none';
        urlError.textContent = '';

        // Validate inputs based on selected type
        if (backgroundType === BG_TYPES.IMAGE_URL) {
            if (!backgroundUrl) {
                urlError.textContent = 'Please enter a valid image URL';
                urlError.style.display = 'block';
                return;
            }
        } else if (backgroundType === BG_TYPES.UPLOAD) {
            if (!isValidUpload && !localStorage.getItem('uploadedImage')) {
                alert('Please upload a valid image (JPEG or PNG, minimum 1920×1080)');
                return;
            }
        } else if (backgroundType === BG_TYPES.UNSPLASH) {
            // For Unsplash, fetch a new image if categories have changed since last fetch
            const currentCategories = getSelectedCategories();
            const lastFetchedCategories = localStorage.getItem('unsplashCategories');

            if (currentCategories !== lastFetchedCategories) {
                // Fetch a new image with the current categories and apply it immediately
                fetchUnsplashImage(true);
            } else if (!currentUnsplashImage.url && !localStorage.getItem('unsplashImageUrl')) {
                alert('Please wait for Unsplash image to load');
                return;
            }
        }

        // Check localStorage capacity before saving
        try {
            // Save to localStorage
            localStorage.setItem('backgroundType', backgroundType);
            localStorage.setItem('backgroundColor', backgroundColor);
            localStorage.setItem('backgroundUrl', backgroundUrl);
            localStorage.setItem('customColor', customColor);

            // Save uploaded image if valid
            if (backgroundType === BG_TYPES.UPLOAD && isValidUpload) {
                localStorage.setItem('uploadedImage', uploadedImage);
            }

            // Save Unsplash categories
            if (backgroundType === BG_TYPES.UNSPLASH) {
                localStorage.setItem('unsplashCategories', getSelectedCategories());
            }
        } catch (e) {
            // Handle storage errors (e.g., quota exceeded)
            if (e.name === 'QuotaExceededError') {
                alert('Storage limit exceeded. Try using a smaller image or clearing browser data.');
                return;
            }
            console.error('Storage error:', e);
        }

        // Apply background
        applyBackground(
            backgroundType,
            backgroundColor,
            backgroundUrl,
            customColor,
            uploadedImage || localStorage.getItem('uploadedImage'),
            currentUnsplashImage.url || localStorage.getItem('unsplashImageUrl')
        );

        // Close modal
        modal.style.display = 'none';
    });

    // Initialize the application
    initializeColorOptions();
    updateVisibleOptions();
    loadSavedSettings();

});