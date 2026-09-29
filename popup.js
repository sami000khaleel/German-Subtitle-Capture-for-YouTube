// Global variables to track subtitle state
let currentSubtitleStartTime = null;
let currentSubtitleEndTime = null;
let currentSubtitleText = '';
let allCues = [];
let activeTrack = null;

// Initialize subtitle tracking
function initializeSubtitleTracking() {
  const video = document.querySelector('video');
  if (!video) return;

  // Monitor text tracks for changes
  if (video.textTracks) {
    const checkTracks = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (track.mode === 'showing' && track.cues && track.cues.length > 0) {
          activeTrack = track;
          allCues = Array.from(track.cues);
          
          // Add cue change listener
          track.addEventListener('cuechange', updateCurrentSubtitle);
          updateCurrentSubtitle();
          break;
        }
      }
    };

    // Check initially and when tracks might change
    checkTracks();
    video.addEventListener('loadedmetadata', checkTracks);
    
    // Monitor for track mode changes
    const observer = new MutationObserver(checkTracks);
    observer.observe(video, { attributes: true, attributeFilter: ['src'] });
  }
}

function updateCurrentSubtitle() {
  if (!activeTrack || !activeTrack.activeCues || activeTrack.activeCues.length === 0) {
    // No active cue, clear current subtitle
    currentSubtitleStartTime = null;
    currentSubtitleEndTime = null;
    currentSubtitleText = '';
    return;
  }

  // Get the active cue
  const activeCue = activeTrack.activeCues[0];
  currentSubtitleStartTime = activeCue.startTime;
  currentSubtitleEndTime = activeCue.endTime;
  currentSubtitleText = activeCue.text.trim();
}

function getCurrentSubtitleInfo() {
  const video = document.querySelector('video');
  if (!video) return null;

  // First try the tracked subtitle
  if (currentSubtitleText && currentSubtitleStartTime !== null) {
    return {
      text: currentSubtitleText,
      startTime: currentSubtitleStartTime,
      endTime: currentSubtitleEndTime
    };
  }

  // Fallback: Try to find active cues directly
  if (video.textTracks) {
    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];
      if (track.mode === 'showing' && track.activeCues && track.activeCues.length > 0) {
        const cue = track.activeCues[0];
        return {
          text: cue.text.trim(),
          startTime: cue.startTime,
          endTime: cue.endTime
        };
      }
    }
  }

  return null;
}

function findAdjacentCue(direction) {
  if (!allCues || allCues.length === 0 || currentSubtitleStartTime === null) {
    return null;
  }

  const video = document.querySelector('video');
  if (!video) return null;

  const currentTime = video.currentTime;

  if (direction === 'previous') {
    // Find the cue that ended just before the current time
    let previousCue = null;
    for (let i = allCues.length - 1; i >= 0; i--) {
      if (allCues[i].endTime <= currentTime - 0.1) {
        previousCue = allCues[i];
        break;
      }
    }
    return previousCue;
  } 
  else if (direction === 'next') {
    // Find the cue that starts after the current time
    for (let i = 0; i < allCues.length; i++) {
      if (allCues[i].startTime > currentTime + 0.1) {
        return allCues[i];
      }
    }
  }

  return null;
}

// Listen for keydown events on YouTube
document.addEventListener('keydown', (event) => {
  // Don't capture if user is typing in an input field
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) {
    return;
  }

  const video = document.querySelector('video');
  if (!video) return;

  switch(event.key.toLowerCase()) {
    case 's':
      // Jump to beginning of current subtitle
      jumpToSubtitleStart();
      break;
    case 'd':
      // Jump to next subtitle
      jumpToNextSubtitle();
      break;
    case 'a':
      // Jump to previous subtitle
      jumpToPreviousSubtitle();
      break;
    case 'e':
      // Save current subtitle with exact timestamp
      saveCurrentSubtitle();
      break;
  }
});

function jumpToSubtitleStart() {
  const video = document.querySelector('video');
  if (!video) return;

  const subtitleInfo = getCurrentSubtitleInfo();
  
  if (subtitleInfo) {
    video.currentTime = subtitleInfo.startTime;
    showNavigationIndicator(video, '⏮️', `Jumped to subtitle start: ${formatTime(subtitleInfo.startTime)}`);
  } else {
    // Fallback: go back 2 seconds if no subtitle is detected
    video.currentTime = Math.max(0, video.currentTime - 2);
    showNavigationIndicator(video, '⏪', 'No subtitle found - went back 2s');
  }
}

function jumpToNextSubtitle() {
  const video = document.querySelector('video');
  if (!video) return;

  const nextCue = findAdjacentCue('next');
  
  if (nextCue) {
    video.currentTime = nextCue.startTime;
    showNavigationIndicator(video, '⏭️', `Next subtitle at: ${formatTime(nextCue.startTime)}`);
  } else {
    // Fallback: go forward 5 seconds if no next subtitle found
    video.currentTime = Math.min(video.duration, video.currentTime + 5);
    showNavigationIndicator(video, '⏩', 'No next subtitle - went forward 5s');
  }
}

function jumpToPreviousSubtitle() {
  const video = document.querySelector('video');
  if (!video) return;

  const prevCue = findAdjacentCue('previous');
  
  if (prevCue) {
    video.currentTime = prevCue.startTime;
    showNavigationIndicator(video, '⏮️', `Previous subtitle at: ${formatTime(prevCue.startTime)}`);
  } else {
    // Fallback: go back 5 seconds if no previous subtitle found
    video.currentTime = Math.max(0, video.currentTime - 5);
    showNavigationIndicator(video, '⏪', 'No previous subtitle - went back 5s');
  }
}

function saveCurrentSubtitle() {
  const video = document.querySelector('video');
  if (!video) return;

  const subtitleInfo = getCurrentSubtitleInfo();
  
  if (!subtitleInfo || !subtitleInfo.text) {
    // Fallback: try to get text from visible captions
    const fallbackText = getVisibleCaptionText();
    if (fallbackText) {
      saveSubtitleEntry(fallbackText, video.currentTime, video.currentTime);
      showSaveFeedback(true, fallbackText);
    } else {
      showSaveFeedback(false);
    }
    return;
  }

  // Save with exact subtitle start time
  saveSubtitleEntry(subtitleInfo.text, subtitleInfo.startTime, subtitleInfo.endTime);
  showSaveFeedback(true, subtitleInfo.text, subtitleInfo.startTime);
}

function getVisibleCaptionText() {
  const captionSelectors = [
    '.ytp-caption-segment',
    '.captions-text .caption-visual-line',
    '.caption-window span',
    '.ytp-caption-window-container'
  ];

  for (const selector of captionSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const texts = Array.from(elements)
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0);
      
      if (texts.length > 0) {
        return texts.join('\n');
      }
    }
  }
  return '';
}

function saveSubtitleEntry(text, startTime, endTime) {
  const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() || 
                    document.querySelector('title')?.textContent?.replace(' - YouTube', '').trim() || 
                    'Unknown Video';
  const videoUrl = window.location.href;
  const timeFormatted = formatTime(startTime);
  const duration = endTime - startTime;

  const entry = {
    text: text,
    videoTitle: videoTitle,
    videoUrl: videoUrl,
    timestamp: Math.floor(startTime),
    exactStartTime: startTime,
    exactEndTime: endTime,
    timeFormatted: timeFormatted,
    duration: duration,
    dateAdded: new Date().toISOString(),
    id: Date.now()
  };

  chrome.storage.local.get({ sentences: [] }, (result) => {
    const sentences = result.sentences;
    sentences.unshift(entry);
    
    if (sentences.length > 1000) {
      sentences.pop();
    }
    
    chrome.storage.local.set({ sentences: sentences });
  });
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  let timeStr = '';
  if (hrs > 0) {
    timeStr = `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
  }
  
  // Add milliseconds if available
  if (ms > 0) {
    timeStr += `.${String(ms).padStart(3, '0')}`;
  }
  
  return timeStr;
}

function showNavigationIndicator(video, emoji, text) {
  const existingIndicator = document.querySelector('.german-nav-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }

  const indicator = document.createElement('div');
  indicator.className = 'german-nav-indicator';
  indicator.innerHTML = `<span style="font-size: 32px;">${emoji}</span><br>${text}`;
  indicator.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    text-align: center;
    z-index: 999999;
    pointer-events: none;
    animation: fadeInOut 1.5s ease;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    line-height: 1.4;
    min-width: 200px;
  `;

  const videoContainer = video.closest('.html5-video-container') || video.parentElement;
  videoContainer.appendChild(indicator);

  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.remove();
    }
  }, 1500);
}

function showSaveFeedback(success, text = '', exactTime = null) {
  const existingFeedback = document.querySelector('.german-save-feedback');
  if (existingFeedback) {
    existingFeedback.remove();
  }

  const feedback = document.createElement('div');
  feedback.className = 'german-save-feedback';
  
  if (success) {
    const displayText = text.length > 100 ? text.substring(0, 97) + '...' : text;
    let timeInfo = '';
    if (exactTime !== null) {
      timeInfo = `<br><span style="font-size: 11px; opacity: 0.8;">📍 Exact time: ${formatTime(exactTime)}</span>`;
    }
    feedback.innerHTML = `✅ <strong>Saved!</strong>${timeInfo}<br><span style="font-size: 12px; margin-top: 4px; display: block;">"${escapeHtml(displayText)}"</span>`;
  } else {
    feedback.innerHTML = '❌ <strong>No subtitle found</strong><br><span style="font-size: 12px; margin-top: 4px; display: block;">Make sure captions are enabled</span>';
  }
  
  feedback.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 20px;
    background: ${success ? 'rgba(76, 175, 80, 0.95)' : 'rgba(244, 67, 54, 0.95)'};
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    backdrop-filter: blur(10px);
    max-width: 400px;
    word-wrap: break-word;
    animation: slideInLeft 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    line-height: 1.4;
  `;

  document.body.appendChild(feedback);

  const displayTime = success && text.length > 50 ? 3500 : 2500;
  setTimeout(() => {
    feedback.style.animation = 'slideOutLeft 0.3s ease forwards';
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
    }, 300);
  }, displayTime);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add CSS animations
function addAnimations() {
  if (document.getElementById('german-extension-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'german-extension-styles';
  style.textContent = `
    @keyframes slideInLeft {
      from {
        transform: translateX(-120%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutLeft {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(-120%);
        opacity: 0;
      }
    }
    
    @keyframes fadeInOut {
      0% { 
        opacity: 0; 
        transform: translate(-50%, -50%) scale(0.7); 
      }
      15% { 
        opacity: 1; 
        transform: translate(-50%, -50%) scale(1.1); 
      }
      25% { 
        opacity: 1; 
        transform: translate(-50%, -50%) scale(1); 
      }
      75% { 
        opacity: 1; 
        transform: translate(-50%, -50%) scale(1); 
      }
      100% { 
        opacity: 0; 
        transform: translate(-50%, -50%) scale(0.7); 
      }
    }
  `;
  document.head.appendChild(style);
}

// Initialize when page loads
function initialize() {
  addAnimations();
  
  // Try to initialize subtitle tracking immediately
  initializeSubtitleTracking();
  
  // Also try after a delay (YouTube sometimes loads captions late)
  setTimeout(initializeSubtitleTracking, 2000);
  setTimeout(initializeSubtitleTracking, 5000);
  
  // Re-initialize when navigating between videos (YouTube SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(initializeSubtitleTracking, 1000);
      setTimeout(initializeSubtitleTracking, 3000);
    }
  }).observe(document, { subtree: true, childList: true });
}

// Start the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}