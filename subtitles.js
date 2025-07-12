const textFile = browser.runtime.getURL('model/transcription.txt');
let subtitleWindow, subtitleText, collapsibleButton;
let loadInterval = null;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let isCollapsed = false;

// Requests to display/hide or update the style of the subtitles from settings.js.
browser.runtime.onMessage.addListener((request) => {
    if (request.action === "toggleSubtitles") {
        // Show subtitles
        if (request.value) { 
            displaySubtitle();
        }
        // Hide subtitles
        else { 
            subtitleWindow.style.display = 'none';
        }
    }
    // Update the style of the subtitle text when the user applies new settings
    else if (request.action === "applySettings") {
        loadSettings();
    }
});

function loadStylesheet(){
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = browser.runtime.getURL('subtitles.css');
    link.setAttribute('data-subtitle-style', 'true');
    document.head.appendChild(link);
}
// Draggable HTML element which displays the subtitle text and content for the user to interact with
// (copy text, close the window, and an optional collapsible button to modify the text display size).
function createWindow(){
    const subtitleDiv = document.createElement('div'); 
    subtitleDiv.id = "subtitle-window"; 
    subtitleDiv.className = "subtitle"; 
    subtitleDiv.innerHTML = `
        <div class="subtitle-header">
            <button class="subtitle-button" title="Copy Text" id="subtitle-copy-text">📋</button>
            <button class="subtitle-button" title="Close" id="subtitle-close-window">❌</button>
        </div>
        <div class="subtitle-text" id="subtitle-text"></div>
        <div class="subtitle-footer">
            <button class="subtitle-button" id="subtitle-collapsible-button">⮞</button>
        </div>`;
    // Append the window to the web page
    document.body.appendChild(subtitleDiv);
    subtitleWindow = document.getElementById('subtitle-window');
    subtitleText = document.getElementById('subtitle-text');
    collapsibleButton = document.getElementById('subtitle-collapsible-button');
    // Initialize user functions of the window and its content
    initializeSubtitleBehavior();
}
// Display the subtitle in the web page
function displaySubtitle(){
    // Used to check if the window already exists
    const subtitleWindow = document.getElementById("subtitle-window");
    // Create a new stylesheet and window to inject
    if(!subtitleWindow) {
        loadStylesheet();
        createWindow();
    }
    // Display the subtitle window
    else {
        subtitleWindow.style.display = 'block';
    }
}

// Adds user functions to the window, applies text formatting, and updates the subtitle text.
function initializeSubtitleBehavior() {
    // Copy the contents of the subtitle text to the clipboard 
    document.getElementById('subtitle-copy-text').onclick = () => {
        navigator.clipboard.writeText(subtitleText.textContent);
    };

    // Hides the window
    document.getElementById('subtitle-close-window').addEventListener('click', function() {
        subtitleWindow.style.display = 'none';
    });

    // Collapse or expand the subtitle text size
    collapsibleButton.addEventListener('click', function() {
        resizeSubtitleText();
    });
    
    // Event listeners for the window to move as the user clicks and drags the window
    subtitleWindow.addEventListener('mousedown', function(e) {
        isDragging = true;
        offsetX = e.clientX - subtitleWindow.getBoundingClientRect().left;
        offsetY = e.clientY - subtitleWindow.getBoundingClientRect().top;
    });
    document.addEventListener('mousemove', e => {
        if (isDragging) {
            subtitleWindow.style.left = `${e.clientX - offsetX}px`;
            subtitleWindow.style.top = `${e.clientY - offsetY}px`;
        }
    });
    document.addEventListener('mouseup', () => {
      isDragging = false
    });

    // Initialize the subtitle text size
    resizeSubtitleText();
    // Load and apply subtitle settings from the local browser storage
    loadSettings();
    // Start reading from the transcription file to update the live subtitles
    loadInterval = setInterval(() => {
        loadTextFile();
    }, 1000);
}

// Collapse or expand the subtitle text size based on the current state of the isCollapsed boolean.
function resizeSubtitleText() {
    // Expand the subtitle text and set the collapse-expand-text button to collapse '^'
    if (isCollapsed){ 
        collapsibleButton.classList.remove("subtitle-expand-button");
        collapsibleButton.classList.add("subtitle-collapse-button");
        collapsibleButton.setAttribute('title', "Collapse");
        subtitleText.classList.remove("subtitle-collapse-text");
        subtitleText.classList.add("subtitle-expand-text");
        isCollapsed = false;
    }
    // Collapse the subtitle text and set the collapse-expand-text button to expand 'v'
    else { 
        collapsibleButton.classList.remove("subtitle-collapse-button");
        collapsibleButton.classList.add("subtitle-expand-button");
        collapsibleButton.setAttribute('title', "Expand");
        subtitleText.classList.remove("subtitle-expand-text");
        subtitleText.classList.add("subtitle-collapse-text");
        isCollapsed = true;
    }
}

// Load the default settings from the local browser storage and apply them to the subtitles
function loadSettings () {
    browser.storage.local.get("defaultSettings").then(result => {
        const settings = result.defaultSettings;
        subtitleWindow.style.display = settings.subtitles ? 'block' : 'none';
        subtitleText.style.backgroundColor = `rgba(0, 0, 0, ${(settings.transparency / 100) || 0})`;
        subtitleText.style.fontWeight = settings.bold ? 'bold' : 'normal';
        subtitleText.style.fontStyle = settings.italic ? 'italic' : 'normal';
        subtitleText.style.fontFamily = settings.font;
        document.documentElement.style.setProperty('--subtitle-font-size', `${settings.fontSize}px`); 
    });
}

// Load the transcription text file content and apply it to the subtitles.
function loadTextFile() {
    fetch(textFile)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            else {
                return response.text();
            }
        })
        // Apply the text in transcription.txt to the subtitleText
        .then(data => {
            subtitleText.textContent = data; 
        })
        .catch(error => {
            subtitleText.textContent = 'Error loading text content.';
        });
}