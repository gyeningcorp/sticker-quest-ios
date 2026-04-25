// Sticker Quest — Local Storage (no external network)
function getAuthToken() { return null; }
function setAuthToken(token) {}
function getUserId() { return window.STICKER_QUEST_USER_ID || null; }

async function syncProgress(userId, progressData) {
  localStorage.setItem('stickerquest_progress', JSON.stringify(progressData));
  return progressData;
}

async function loadProgress(userId) {
  const local = localStorage.getItem('stickerquest_progress');
  return local ? JSON.parse(local) : null;
}

async function loginUser(email, password) {
  return { success: false, error: 'Offline mode' };
}

async function registerUser(email, password, name) {
  return { success: false, error: 'Offline mode' };
}
