// Sticker Quest — Backend Sync Module
const STICKER_QUEST_API = 'https://sticker-quest-production.up.railway.app';

function getAuthToken() {
  return localStorage.getItem('stickerquest_jwt');
}

function setAuthToken(token) {
  localStorage.setItem('stickerquest_jwt', token);
}

function getUserId() {
  return window.STICKER_QUEST_USER_ID || null;
}

async function syncProgress(userId, progressData) {
  const token = getAuthToken();
  if (!token || !userId) {
    // Fallback: save locally only
    localStorage.setItem('stickerquest_progress', JSON.stringify(progressData));
    return progressData;
  }
  try {
    const res = await fetch(`${STICKER_QUEST_API}/api/progress/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(progressData),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const saved = await res.json();
    localStorage.setItem('stickerquest_progress', JSON.stringify(saved));
    return saved;
  } catch (e) {
    console.warn('Sync failed, using local storage:', e.message);
    localStorage.setItem('stickerquest_progress', JSON.stringify(progressData));
    return progressData;
  }
}

async function loadProgress(userId) {
  const token = getAuthToken();
  if (!token || !userId) {
    const local = localStorage.getItem('stickerquest_progress');
    return local ? JSON.parse(local) : null;
  }
  try {
    const res = await fetch(`${STICKER_QUEST_API}/api/progress/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    localStorage.setItem('stickerquest_progress', JSON.stringify(data));
    return data;
  } catch (e) {
    console.warn('Load failed, using local storage:', e.message);
    const local = localStorage.getItem('stickerquest_progress');
    return local ? JSON.parse(local) : null;
  }
}
