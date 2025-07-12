const subtitleToggle = document.getElementById('settings-subtitle');
const exampleLabel = document.getElementById('settings-example');
const transparencySlider = document.getElementById('settings-transparency');
const boldToggle = document.getElementById('settings-bold');
const italicToggle = document.getElementById('settings-italic');
const fontStyleButtons = document.querySelectorAll('.font-style-button');
const decreaseFontSize = document.getElementById('settings-decrease-font-size');
const increaseFontSize = document.getElementById('settings-increase-font-size');
const examplepxFontSize = document.getElementById('settings-example-px-font-size');
const applySettingsButton = document.getElementById('settings-apply');
const resetSettingsButton = document.getElementById('settings-reset');
// Holds the users current font size / font style selection
let currentFontSize = 16; 
let currentFontStyle = "Arial";
// Subtitle settings will default to these values if no modifications have been made or no settings were loaded.
let defaultSettings = { 
    subtitles: false,
    transparency: 50, 
    bold: true, 
    italic: false,
    font: "Arial",  
    fontSize: '20px' 
};
// "Enable Subtitles" toggle to enable / disable the in-browser subtitles.
function updateSubtitleToggle(toggleValue) {
    // Enable the display of in-browser subtitles.
    if (toggleValue === true) {
        // Notify subtitles.js to show subtitles
        browser.tabs.query({active: true, currentWindow: true}).then((tabs) => { 
            browser.tabs.sendMessage(tabs[0].id, {action: "toggleSubtitles", value: true}).then((response) => {
                console.log(response.status);
            });
        });
    }
    // Disable the display of in-browser subtitles.
    else {
        // Notify subtitles.js to hide subtitles
        browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
            browser.tabs.sendMessage(tabs[0].id, {action: "toggleSubtitles", value: false}).then((response) => {
                console.log(response.status);
            });
        });
    }
    subtitleToggle.checked = toggleValue;
}
subtitleToggle.addEventListener('change', () => updateSubtitleToggle(subtitleToggle.checked));

// "Background Transparency" slider modifies the background transparency of the subtitles.
function updateTransparency(sliderValue) {
    exampleLabel.style.backgroundColor = `rgba(0, 0, 0, ${(sliderValue / 100)})`;
    transparencySlider.value = sliderValue; 
}
transparencySlider.addEventListener('input', () => updateTransparency(transparencySlider.value));

// "Bold" toggle enables / disables bold font style for the subtitles.
function updateBold(toggleValue) {
    exampleLabel.style.fontWeight = toggleValue ? 'bold' : 'normal';
    boldToggle.checked = toggleValue;
}
boldToggle.addEventListener('change', () => updateBold(boldToggle.checked));

// "Italic" toggle enables / disables italic font style for the subtitles.
function updateItalic(toggleValue) {
    exampleLabel.style.fontStyle = toggleValue ? 'italic' : 'normal';
    italicToggle.checked = toggleValue;
}
italicToggle.addEventListener('change', () => updateItalic(italicToggle.checked));

// User selects a font style button to change the font style of the subtitles.
function updateFontStyle(selectedButton) {
    fontStyleButtons.forEach(button => {
        // User selected button
        if (button === selectedButton) { 
            // Adding the 'selected' appearance to the selected button and disabling it
            button.classList.add('selected');
            button.disabled = true;
        }
        // All other buttons
        else { 
            // Removing the 'selected' appearance from the rest of the buttons and enabling them
            button.classList.remove('selected');
            button.disabled = false;
        }
    });
    // Update the subtitles with the newly selected font
    exampleLabel.style.fontFamily = selectedButton.style.fontFamily; 
    currentFontStyle = selectedButton.id; 
}
fontStyleButtons.forEach(button => button.addEventListener('click', () => updateFontStyle(button)));

// "-" and "+" buttons modify the subtitle font size.
function updateFontSize (id) {
    // When the "-" button is clicked, decrease the font size by 2, with a minimum font size of 8
    if (id === 'settings-decrease-font-size' && currentFontSize > 8) {
        currentFontSize -= 2;
    }
    // When the "+" button is clicked, increase the font size by 2, with a maxiumum font size of 24
    else if (id === 'settings-increase-font-size' && currentFontSize < 24) {
        currentFontSize += 2;
    }
    // Used by the resetSettings() to reset the font size to its default value
    else if (id === 'resetFontSize') {
        currentFontSize = parseInt(defaultSettings.fontSize);
    }
    // Update the subtitles with the new font size
    exampleLabel.style.fontSize = `${currentFontSize}px`;
    examplepxFontSize.style.fontSize = `${currentFontSize}px`;
    examplepxFontSize.textContent = `${currentFontSize}px`;
}
increaseFontSize.addEventListener('click', () => updateFontSize(increaseFontSize.id));
decreaseFontSize.addEventListener('click', () => updateFontSize(decreaseFontSize.id));

// "Apply" button will apply the current settings to the default settings and update the subtitles
async function applySettings() {
    defaultSettings.subtitles = subtitleToggle.checked;
    defaultSettings.transparency = transparencySlider.value;
    defaultSettings.bold = boldToggle.checked;
    defaultSettings.italic = italicToggle.checked;
    defaultSettings.font = currentFontStyle;
    defaultSettings.fontSize = currentFontSize;
    // Save and apply the new default settings
    await saveSettings(defaultSettings);
    resetSettings();
    // Notify subtitles.js to update its subtitles
    browser.tabs.query({active: true, currentWindow: true}).then((tabs) => { 
        browser.tabs.sendMessage(tabs[0].id, {action: "applySettings"}).then((response) => {
            console.log(response.status); 
        });
    });

}
applySettingsButton.addEventListener('click', async () => await applySettings());

// "Reset" button will reset the current settings settings to their default values
function resetSettings() {
    updateSubtitleToggle(defaultSettings.subtitles);
    updateTransparency(defaultSettings.transparency);
    updateBold(defaultSettings.bold);
    updateItalic(defaultSettings.italic);
    updateFontStyle(document.getElementById(defaultSettings.font));
    updateFontSize('resetFontSize');
}
resetSettingsButton.addEventListener('click', resetSettings);

// Save the default settings in the local browser storage
async function saveSettings(settings) {
    try {
        await browser.storage.local.set({ defaultSettings: settings });
        console.log("Settings saved");
    }
    catch (error) {
        console.error("Error saving settings: ", error);
    }
}
// Load settings from the local browser storage and apply them
async function loadSettings() {
    // Try loading any previously saved settings and update the default settings with them
    try {
        const result = await browser.storage.local.get("defaultSettings");
        if (result.defaultSettings) {
            defaultSettings = result.defaultSettings;
        }
    }
    // If none have been saved or there was an error, the default settings at the top of this page will be used 
    catch (error) {
        console.error("Error loading settings: ", error);
    }
    resetSettings();
}
// When the subtitle settings extension is opened, try to load and apply any saved settings.
document.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
    // If the user clicks away from the extension's popup before clicking the apply button, reset the settings to their default values
    window.addEventListener("blur", () => resetSettings());
});