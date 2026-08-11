const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

// Put your API tunnel URL here (NO /api at the end)
const API_ORIGIN = isLocal
  ? 'http://localhost:8000'
  : 'CHANGE_THIS_TO_YOUR_TUNNEL_URL';

const BASE_URL = `${API_ORIGIN}/api`;
export const API_BASE = API_ORIGIN;
function prependUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url}`;
}

function formatPhoto(p) {
  return {
    ...p,
    src: prependUrl(p.thumb_medium_url) || prependUrl(p.thumb_small_url) || '',
    thumb: prependUrl(p.thumb_small_url) || prependUrl(p.thumb_medium_url) || '',
    date: p.date_taken || 'Unknown Date',
    favorite: p.favorite === true || p.favorite === 1,
    people: p.people || [],
    tags: p.tags || []
  };
}

export async function fetchStats() {
  const res = await fetch(`${BASE_URL}/stats`);
  return res.json();
}

export async function fetchStatsData() {
  const res = await fetch(`${BASE_URL}/stats`);
  return res.json();
}

export async function fetchPhotos(limit = 50, offset = 0) {
  const res = await fetch(`${BASE_URL}/photos?limit=${limit}&offset=${offset}`);
  const data = await res.json();
  return (data.photos || []).map(formatPhoto);
}

export async function fetchPeople() {
  const res = await fetch(`${BASE_URL}/people`);
  const data = await res.json();
  return (data.people || []).map(p => ({
    ...p,
    photoCount: p.photo_count,
    avatar: prependUrl(p.avatar_url) || 'https://via.placeholder.com/150/1e1e1e/808080?text=?',
    recentPhotos: (p.recent_photos || []).map(prependUrl)
  }));
}
export async function fetchClusters() {
  const res = await fetch(`${BASE_URL}/clusters`);
  const data = await res.json();
  return (data.clusters || []).map(c => ({
    ...c,
    faces: (c.faces || []).map(f => ({
      cropUrl: prependUrl(f.crop_url),
      photoId: f.photo_id,
      photoThumb: prependUrl(f.photo_thumb)
    })),
    photoCount: c.photo_count || c.face_count
  }));
}

export async function nameCluster(clusterId, personName) {
  const res = await fetch(`${BASE_URL}/clusters/name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cluster_id: clusterId, person_name: personName })
  });
  return res.json();
}

export async function toggleFavoriteApi(photoId) {
  const res = await fetch(`${BASE_URL}/photos/${photoId}/favorite`, {
    method: 'POST'
  });
  return res.json();
}

export async function triggerScanApi() {
  const res = await fetch(`${BASE_URL}/scan`, { method: 'POST' });
  return res.json();
}

export async function filterPhotos(filters, limit = 50, offset = 0) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, value);
    }
  });

  params.append('limit', limit);
  params.append('offset', offset);

  const res = await fetch(`${BASE_URL}/photos/filter?${params.toString()}`);
  const data = await res.json();

  return {
    photos: (data.photos || []).map(formatPhoto),
    total: data.total || 0,
    count: data.count || 0,
  };
}

export async function fetchAllPersons() {
  const res = await fetch(`${BASE_URL}/persons/all`);
  const data = await res.json();
  return (data.persons || []).map(p => ({
    ...p,
    avatar_url: prependUrl(p.avatar_url) || null
  }));
}

export async function fetchBatches() {
  const res = await fetch(`${BASE_URL}/batches`);
  const data = await res.json();
  return data.batches || [];
}

export async function addPersonToPhoto(photoId, personName) {
  const res = await fetch(`${BASE_URL}/photos/add-person`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId, person_name: personName })
  });
  return res.json();
}

export async function removePersonFromPhoto(photoId, personId) {
  const res = await fetch(`${BASE_URL}/photos/remove-person`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId, person_id: personId })
  });
  return res.json();
}

export async function fixPersonOnPhoto(photoId, oldPersonId, newPersonName) {
  const res = await fetch(`${BASE_URL}/photos/fix-person`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photo_id: photoId,
      old_person_id: oldPersonId,
      new_person_name: newPersonName
    })
  });
  return res.json();
}

export async function addTagToPhoto(photoId, tag) {
  const res = await fetch(`${BASE_URL}/photos/add-tag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId, tag })
  });
  return res.json();
}

export async function removeTagFromPhoto(photoId, tag) {
  const res = await fetch(`${BASE_URL}/photos/remove-tag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId, tag })
  });
  return res.json();
}

export async function fetchUntaggedPhotos() {
  const res = await fetch(`${BASE_URL}/photos/untagged?limit=200`);
  const data = await res.json();
  return {
    photos: (data.photos || []).map(formatPhoto),
    total: data.total || 0
  };
}

export function getOriginalUrl(photoId) {
  return `${API_ORIGIN}/api/photos/${photoId}/original`;
}

export async function fetchCoAppearances(personName) {
  const res = await fetch(`${BASE_URL}/persons/${encodeURIComponent(personName)}/co-appearances`);
  const data = await res.json();
  return data.co_appearances || [];
}

export async function fetchTags() {
  const res = await fetch(`${BASE_URL}/tags`);
  const data = await res.json();
  return data.tags || [];
}

export function getApiOrigin() {
  return API_ORIGIN;
}

export function getDownloadUrl(photoId) {
  return `${API_ORIGIN}/api/photos/${photoId}/download`;
}

export function getBulkDownloadUrl(params) {
  return `${API_ORIGIN}/api/photos/download-zip?${params.toString()}`;
}