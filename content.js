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
      captureSubtitle();
      break;
    case 'a':
      // Go back 2 seconds
      video.currentTime = Math.max(0, video.currentTime - 2);
      showTimeIndicator(video, '⏪ -2s');
      break;
    case 'd':
      // Go forward 5 seconds
      video.currentTime = Math.min(video.duration, video.currentTime + 5);
      showTimeIndicator(video, '⏩ +5s');
      break;
  }
});

function captureSubtitle() {
  // Try to find the subtitle/caption text
  // YouTube uses multiple caption containers, try different selectors
  const captionSelectors = [
    '.ytp-caption-segment',                    // Standard YouTube captions
    '.captions-text .caption-visual-line',     // Alternative caption layout
    '.ytp-caption-window-rollup',              // Rollup captions
    '.ytp-caption-window-bottom',              // Bottom captions
    '.caption-window'                          // Fallback
  ];

  let captionText = '';
  
  for (const selector of captionSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // Get the most recently displayed caption
      const latestCaption = elements[elements.length - 1];
      captionText = latestCaption.textContent.trim();
      if (captionText) break;
    }
  }

  // If no caption found, try to get current subtitle from YouTube's API
  if (!captionText) {
    const captionsContainer = document.querySelector('.ytp-caption-window-container');
    if (captionsContainer) {
      captionText = captionsContainer.textContent.trim();
    }
  }

  if (captionText) {
    // Get video information
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() || 'Unknown Video';
    const videoUrl = window.location.href;
    const timestamp = Math.floor(document.querySelector('video')?.currentTime || 0);
    const timeFormatted = formatTime(timestamp);

    // Create entry
    const entry = {
      text: captionText,
      videoTitle: videoTitle,
      videoUrl: videoUrl,
      timestamp: timestamp,
      timeFormatted: timeFormatted,
      dateAdded: new Date().toISOString(),
      id: Date.now() // Unique identifier
    };

    // Save to Chrome storage
    chrome.storage.local.get({ sentences: [] }, (result) => {
      const sentences = result.sentences;
      sentences.unshift(entry); // Add to beginning (newest first)
      
      // Keep only last 1000 sentences to prevent storage issues
      if (sentences.length > 1000) {
        sentences.pop();
      }
      
      chrome.storage.local.set({ sentences: sentences }, () => {
        showCaptureFeedback(entry);
      });
    });
  } else {
    showCaptureFeedback(null);
  }
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function showCaptureFeedback(entry) {
  // Remove existing feedback if any
  const existingFeedback = document.querySelector('.german-capture-feedback');
  if (existingFeedback) {
    existingFeedback.remove();
  }

  // Create feedback element
  const feedback = document.createElement('div');
  feedback.className = 'german-capture-feedback';
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${entry ? '#4CAF50' : '#f44336'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    animation: slideIn 0.3s ease;
    max-width: 400px;
    word-wrap: break-word;
  `;

  if (entry) {
    feedback.textContent = `✅ Captured: "${entry.text}"`;
  } else {
    feedback.textContent = '❌ No subtitle text found';
  }

  // Add animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(feedback);

  // Remove after 2 seconds
  setTimeout(() => {
    feedback.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => feedback.remove(), 300);
  }, 2000);

  // Add slideOut animation
  const slideOutStyle = document.createElement('style');
  slideOutStyle.textContent = `
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(slideOutStyle);
}

function showTimeIndicator(video, text) {
  const existingIndicator = document.querySelector('.german-time-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }

  const indicator = document.createElement('div');
  indicator.className = 'german-time-indicator';
  indicator.textContent = text;
  indicator.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 24px;
    font-weight: bold;
    z-index: 999999;
    pointer-events: none;
    animation: fadeInOut 1s ease;
  `;

  const indicatorStyle = document.createElement('style');
  indicatorStyle.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    }
  `;
  document.head.appendChild(indicatorStyle);

  // Append to the video container
  const videoContainer = video.closest('.html5-video-container') || video.parentElement;
  videoContainer.appendChild(indicator);

  setTimeout(() => indicator.remove(), 1000);
}