import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Star, Lock, Unlock, ScanLine, Download,
  Heart, User, ChevronLeft, ChevronRight, RotateCw,
  Calendar, Tag, Plus, Check, Pencil, Trash2, Archive
} from 'lucide-react';
import {
  filterPhotos, fetchAllPersons, fetchPhotos, fetchStatsData,
  toggleFavoriteApi, getOriginalUrl, addPersonToPhoto,
  removePersonFromPhoto, fixPersonOnPhoto, addTagToPhoto,
  removeTagFromPhoto, API_BASE
} from '../services/api';
import ScanProgress from '../components/ScanProgress';

// ══════════════════════════════════════════
// ADMIN LIGHTBOX
// ══════════════════════════════════════════
function AdminLightbox({ photo, photos, onClose, onFavorite, onDelete, onArchive, onRefresh, hasMore, onLoadMore }) {
  const [current, setCurrent]           = useState(photo);
  const [detail, setDetail]             = useState(null);
  const [rotating, setRotating]         = useState(false);
  const [allPersons, setAllPersons]     = useState([]);
  const [customTags, setCustomTags]     = useState([]);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [addingTag, setAddingTag]       = useState(false);
  const [newTag, setNewTag]             = useState('');
  const [imgKey, setImgKey]             = useState(Date.now());
  const idx = photos.findIndex(p => p.id === current.id);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const fetchDetail = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/photos/${current.id}`);
      const data = await res.json();
      
      // Prepend API_BASE to relative URLs
      if (data.thumb_small_url && !data.thumb_small_url.startsWith('http')) {
        data.thumb_small_url = `${API_BASE}${data.thumb_small_url}`;
      }
      if (data.thumb_medium_url && !data.thumb_medium_url.startsWith('http')) {
        data.thumb_medium_url = `${API_BASE}${data.thumb_medium_url}`;
      }
      
      setDetail({
        ...data,
        favorite: data.favorite === true || data.favorite === 1,
        people: data.people || [],
        tags: data.tags || [],
      });
    } catch (e) {
      setDetail(current);
    }
  };

  useEffect(() => {
    setDetail(null);
    setImgKey(Date.now());
    setAddingPerson(false);
    setAddingTag(false);
    setNewPersonName('');
    setNewTag('');
    fetchDetail();
  }, [current.id]);

  useEffect(() => {
    fetchAllPersons().then(data => setAllPersons(data.sort((a, b) => a.name.localeCompare(b.name))));
    fetch(`${API_BASE}/api/tags`)
      .then(r => r.json())
      .then(data => setCustomTags(data.tags || []))
      .catch(() => {});
  }, []);

  const goNext = () => { 
    if (idx < photos.length - 1) {
      setCurrent(photos[idx + 1]);
      if (idx >= photos.length - 5 && hasMore && onLoadMore) {
        onLoadMore();
      }
    }
  };
  const goPrev = () => { if (idx > 0) setCurrent(photos[idx - 1]); };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/photos/${current.id}/rotate`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        setImgKey(Date.now());
        await fetchDetail();
      }
    } catch (e) {
      console.error('Rotate failed:', e);
    } finally {
      setRotating(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `${API_BASE}/api/photos/${current.id}/download`;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!window.confirm('Move this photo to removed folder?')) return;
    await fetch(`${API_BASE}/api/photos/${current.id}/delete`, { method: 'POST' });
    onDelete && onDelete(current.id);
    if (idx < photos.length - 1) setCurrent(photos[idx + 1]);
    else if (idx > 0) setCurrent(photos[idx - 1]);
    else onClose();
  };

  const handleArchive = async () => {
    if (!window.confirm('Move this photo to archive? It will be hidden from the main gallery.')) return;
    try {
      await fetch(`${API_BASE}/api/photos/${current.id}/archive`, { method: 'POST' });
      onArchive && onArchive(current.id);
      if (idx < photos.length - 1) setCurrent(photos[idx + 1]);
      else if (idx > 0) setCurrent(photos[idx - 1]);
      else onClose();
    } catch (e) {
      console.error('Archive failed:', e);
    }
  };

  const handleAddPerson = async (name) => {
    await addPersonToPhoto(current.id, name);
    setAddingPerson(false);
    setNewPersonName('');
    fetchDetail();
    fetch(`${API_BASE}/api/tags`)
      .then(r => r.json())
      .then(data => setCustomTags(data.tags || []));
  };

  const handleRemovePerson = async (personId) => {
    await removePersonFromPhoto(current.id, personId);
    fetchDetail();
  };

  const handleAddTag = async (tag) => {
    await addTagToPhoto(current.id, tag);
    setAddingTag(false);
    setNewTag('');
    fetchDetail();
    fetch(`${API_BASE}/api/tags`)
      .then(r => r.json())
      .then(data => setCustomTags(data.tags || []));
  };

  const handleRemoveTag = async (tag) => {
    await removeTagFromPhoto(current.id, tag);
    fetchDetail();
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'f') onFavorite(current.id);
      if (e.key === 'r') handleRotate();
      if (e.key === 'd') handleDownload();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [idx, current.id]);

  const display = detail || current;

  const getPeopleObjects = () => {
    if (!display.people || !display.people.length) return [];
    return display.people.map(name => {
      const found = allPersons.find(p => p.name.toLowerCase() === name.toLowerCase());
      return found || { id: null, name };
    }).filter(p => p.id !== null);
  };

  const originalUrl = `${API_BASE}/api/photos/${current.id}/original?t=${imgKey}`;
  
  const rawThumb = display.thumb_small_url || display.thumb || '';
  const thumbUrl = rawThumb
    ? (rawThumb.startsWith('http') 
        ? rawThumb.split('?')[0] + `?t=${imgKey}`
        : `${API_BASE}${rawThumb.split('?')[0]}?t=${imgKey}`)
    : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
      style={{ background: 'rgba(0,0,0,0.95)' }}
    >
      <button onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20">
        <X size={20} className="text-white" />
      </button>

      {idx > 0 && (
        <button onClick={goPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20">
          <ChevronLeft size={24} className="text-white" />
        </button>
      )}
      {idx < photos.length - 1 && (
        <button onClick={goNext}
                className="absolute right-80 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20">
          <ChevronRight size={24} className="text-white" />
        </button>
      )}

      <div className="flex-1 flex items-center justify-center p-16">
        <img
          key={`main-${current.id}-${imgKey}`}
          src={originalUrl}
          alt=""
          className="max-h-full max-w-full object-contain rounded-lg"
        />
      </div>

      <div className="w-72 bg-bg-tertiary border-l border-border flex flex-col overflow-y-auto">
        <div className="aspect-square flex-shrink-0">
          <img
            key={`thumb-${current.id}-${imgKey}`}
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-4 space-y-4">

          <div className="grid grid-cols-5 gap-1.5">
            <button onClick={() => onFavorite(current.id)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] transition-all
                    ${display.favorite
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-bg-secondary text-textSecondary hover:text-white'}`}>
              <Heart size={14} className={display.favorite ? 'fill-red-400' : ''} />
              {display.favorite ? 'Liked' : 'Like'}
            </button>

            <button onClick={handleRotate} disabled={rotating}
                    className="flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] 
                               bg-bg-secondary text-textSecondary hover:text-white transition-all">
              <RotateCw size={14} className={rotating ? 'animate-spin' : ''} />
              Rotate
            </button>

            <button onClick={handleDownload}
                    className="flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] 
                               bg-bg-secondary text-textSecondary hover:text-white transition-all">
              <Download size={14} />
              Save
            </button>

            <button onClick={handleArchive}
                    className="flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] 
                               bg-bg-secondary text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
              <Archive size={14} />
              Archive
            </button>

            <button onClick={handleDelete}
                    className="flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] 
                               bg-bg-secondary text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <Trash2 size={14} />
              Delete
            </button>
          </div>

          <div>
            <p className="text-[10px] text-textSecondary uppercase tracking-wider mb-2 font-medium">
              People
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {getPeopleObjects().map(person => (
                <div key={person.id}
                     className="flex items-center gap-1 bg-accent/20 border border-accent/30 
                                rounded-full pl-2 pr-1 py-0.5 group">
                  <span className="text-xs text-accent">{person.name}</span>
                  <button onClick={() => handleRemovePerson(person.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 
                                     text-textSecondary transition-opacity">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>

            {addingPerson ? (
              <div className="space-y-1.5">
                <select
                  onChange={e => { if (e.target.value) handleAddPerson(e.target.value); }}
                  defaultValue=""
                  className="w-full h-8 bg-bg-secondary border border-border rounded-lg 
                             px-2 text-xs text-white focus:outline-none focus:border-accent
                             appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 6px center',
                  }}>
                  <option value="">Select existing person...</option>
                  {allPersons
                    .filter(p => !display.people || !display.people.includes(p.name))
                    .map(p => (
                      <option key={p.id} value={p.name}>{p.name} ({p.photo_count})</option>
                    ))}
                </select>

                <div className="flex items-center gap-1">
                  <input value={newPersonName}
                         onChange={e => setNewPersonName(e.target.value)}
                         onKeyDown={e => {
                           if (e.key === 'Enter' && newPersonName.trim()) handleAddPerson(newPersonName.trim());
                           if (e.key === 'Escape') { setAddingPerson(false); setNewPersonName(''); }
                         }}
                         autoFocus
                         placeholder="Or type new name..."
                         className="flex-1 h-8 bg-bg-secondary border border-border rounded-lg 
                                    px-2 text-xs text-white outline-none focus:border-accent" />
                  <button onClick={() => { if (newPersonName.trim()) handleAddPerson(newPersonName.trim()); }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-accent text-white">
                    <Check size={12} />
                  </button>
                  <button onClick={() => { setAddingPerson(false); setNewPersonName(''); }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-bg-secondary 
                                     text-textSecondary hover:text-white">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingPerson(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full border border-dashed 
                                 border-border text-textSecondary hover:text-accent hover:border-accent 
                                 text-xs transition-colors">
                <Plus size={10} /> Add Person
              </button>
            )}
          </div>

          <div>
            <p className="text-[10px] text-textSecondary uppercase tracking-wider mb-2 font-medium">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(display.tags || []).map(tag => (
                <div key={tag}
                     className="flex items-center gap-1 bg-bg-secondary border border-border 
                                rounded-full px-2 py-0.5 group">
                  <span className="text-xs text-textSecondary">#{tag}</span>
                  <button onClick={() => handleRemoveTag(tag)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 
                                     text-textSecondary transition-opacity">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>

            {addingTag ? (
              <div className="space-y-1.5">
                {customTags.length > 0 && (
                  <select
                    onChange={e => { if (e.target.value) handleAddTag(e.target.value); }}
                    defaultValue=""
                    className="w-full h-8 bg-bg-secondary border border-border rounded-lg 
                               px-2 text-xs text-white focus:outline-none focus:border-accent
                               appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 6px center',
                    }}>
                    <option value="">Select existing tag...</option>
                    {customTags
                      .filter(t => !display.tags || !display.tags.includes(t.tag))
                      .map(t => (
                        <option key={t.tag} value={t.tag}>{t.tag} ({t.photo_count})</option>
                      ))}
                  </select>
                )}

                <div className="flex items-center gap-1">
                  <input value={newTag}
                         onChange={e => setNewTag(e.target.value)}
                         onKeyDown={e => {
                           if (e.key === 'Enter' && newTag.trim()) handleAddTag(newTag.trim());
                           if (e.key === 'Escape') { setAddingTag(false); setNewTag(''); }
                         }}
                         autoFocus
                         placeholder="Or type new tag..."
                         className="flex-1 h-8 bg-bg-secondary border border-border rounded-lg 
                                    px-2 text-xs text-white outline-none focus:border-accent" />
                  <button onClick={() => { if (newTag.trim()) handleAddTag(newTag.trim()); }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-accent text-white">
                    <Check size={12} />
                  </button>
                  <button onClick={() => { setAddingTag(false); setNewTag(''); }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-bg-secondary 
                                     text-textSecondary hover:text-white">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingTag(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full border border-dashed 
                                 border-border text-textSecondary hover:text-accent hover:border-accent 
                                 text-xs transition-colors">
                <Plus size={10} /> Add Tag
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-border space-y-1.5">
            <p className="text-[10px] text-textSecondary uppercase tracking-wider font-medium mb-1">
              Info
            </p>
            <div className="text-xs text-textSecondary space-y-1">
              <p className="flex justify-between">
                <span>Filename</span>
                <span className="text-white truncate ml-2 max-w-[140px]" title={display.file_name}>
                  {display.file_name || 'Unknown'}
                </span>
              </p>
              <p className="flex justify-between">
                <span>ID</span>
                <span className="text-white">{current.id}</span>
              </p>
              {display.date_taken && display.date_taken !== 'Unknown Date' && (
                <p className="flex justify-between">
                  <span>Date</span>
                  <span className="text-white">{display.date_taken}</span>
                </p>
              )}
              <p className="flex justify-between">
                <span>Faces</span>
                <span className="text-white">{display.face_count || 0}</span>
              </p>
              {display.width && display.height && (
                <p className="flex justify-between">
                  <span>Size</span>
                  <span className="text-white">{display.width}×{display.height}</span>
                </p>
              )}
              <p className="flex justify-between">
                <span>Type</span>
                <span className="text-white">{display.folder_type || 'photos'}</span>
              </p>
              {display.batch_name && (
                <p className="flex justify-between">
                  <span>Batch</span>
                  <span className="text-white">{display.batch_name}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════
// ADMIN GALLERY
// ══════════════════════════════════════════
export default function AdminGallery({ onRefreshData }) {
  const [allPersons, setAllPersons]         = useState([]);
  const [customTags, setCustomTags]         = useState([]);
  const [personStates, setPersonStates]     = useState({});
  const [exclusive, setExclusive]           = useState(false);
  const [selectedTags, setSelectedTags]     = useState([]);
  const [favoritesOnly, setFavoritesOnly]   = useState(false);
  const [photoType, setPhotoType]           = useState('all');
  const [photos, setPhotos]                 = useState([]);
  const [total, setTotal]                   = useState(0);
  const [loading, setLoading]               = useState(true);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [filtering, setFiltering]           = useState(false);
  const [scanning, setScanning]             = useState(false);
  const [lightboxPhoto, setLightboxPhoto]   = useState(null);
  const [hasMore, setHasMore]               = useState(true);
  const [batches, setBatches]               = useState([]);
  const [selectedBatch, setSelectedBatch]   = useState('');
  const [selectedCategory, setSelectedCategory] = useState('family');
  const [categories, setCategories]         = useState([]);
  const observerRef = useRef(null);
  const loadingRef  = useRef(false);
  const PAGE_SIZE   = 50;

  const selectedPeople = Object.entries(personStates)
    .filter(([, s]) => s === 'include').map(([n]) => n);
  const excludedPeople = Object.entries(personStates)
    .filter(([, s]) => s === 'exclude').map(([n]) => n);

  const activeFilterCount = [
    selectedPeople.length > 0, excludedPeople.length > 0,
    exclusive, selectedTags.length > 0, selectedBatch,
    favoritesOnly, photoType !== 'all'
  ].filter(Boolean).length;

  useEffect(() => {
    fetchAllPersons().then(data => {
      const sorted = [...data].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setAllPersons(sorted);
    });
    fetch(`${API_BASE}/api/tags`).then(r => r.json())
      .then(data => setCustomTags(data.tags || [])).catch(() => {});
    fetch(`${API_BASE}/api/batches`).then(r => r.json())
      .then(data => setBatches(data.batches || [])).catch(() => {});
    fetch(`${API_BASE}/api/categories`).then(r => r.json())
      .then(data => setCategories(data.categories || [])).catch(() => {});
  }, []);

  const loadPhotos = useCallback(async (reset = true) => {
    if (reset) { setFiltering(true); setPhotos([]); setHasMore(true); }
    try {
      const offset = reset ? 0 : photos.length;
      const filters = {};

      if (selectedPeople.length > 0) filters.persons = selectedPeople.join(',');
      if (exclusive && selectedPeople.length > 0) filters.exclusive = true;
      if (excludedPeople.length > 0) filters.exclude_person = excludedPeople.join(',');
      if (selectedTags.length > 0) filters.tags = selectedTags.join(',');
      if (selectedBatch) filters.batch = selectedBatch;
      if (favoritesOnly) filters.favorite = true;
      if (photoType === 'faces') filters.has_faces = true;
      if (photoType === 'misc') filters.has_faces = false;
      if (photoType === 'untagged') filters.untagged = true;
      if (photoType === 'notag') filters.notag = true;

      const hasAnyFilter = Object.keys(filters).length > 0;

      if (hasAnyFilter) {
        const data = await filterPhotos(filters, PAGE_SIZE, offset);
        if (reset) setPhotos(data.photos);
        else setPhotos(prev => [...prev, ...data.photos]);
        setTotal(data.total || 0);
        setHasMore(data.photos.length === PAGE_SIZE);
      } else {
        const rawPhotos = await fetchPhotos(PAGE_SIZE, offset);
        if (reset) {
          const stats = await fetchStatsData();
          setPhotos(rawPhotos);
          setTotal(stats.total_photos || rawPhotos.length);
        } else {
          setPhotos(prev => [...prev, ...rawPhotos]);
        }
        setHasMore(rawPhotos.length === PAGE_SIZE);
      }
    } catch (e) { console.error('Load failed:', e); }
    finally { setLoading(false); setFiltering(false); setLoadingMore(false); loadingRef.current = false; }
  }, [selectedPeople, excludedPeople, exclusive, selectedTags, selectedBatch, favoritesOnly, photoType, photos.length]);

  useEffect(() => { setLoading(true); loadPhotos(true); }, []);
  useEffect(() => { loadPhotos(true); }, [personStates, exclusive, selectedTags, selectedBatch, favoritesOnly, photoType]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore || loadingMore) return;
    loadingRef.current = true; setLoadingMore(true); loadPhotos(false);
  }, [hasMore, loadingMore, loadPhotos]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loading && !filtering) loadMore(); },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, filtering, loadMore]);

  const cyclePerson = (name) => {
    setPersonStates(prev => {
      const current = prev[name] || null;
      const next = current === null ? 'include' : current === 'include' ? 'exclude' : null;
      const updated = { ...prev };
      if (next === null) delete updated[name]; else updated[name] = next;
      return updated;
    });
  };

  const toggleFavorite = async (photoId) => {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, favorite: !p.favorite } : p));
    await toggleFavoriteApi(photoId);
  };

  const handleDelete = (photoId) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    setTotal(prev => prev - 1);
  };

  const handleArchive = (photoId) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    setTotal(prev => prev - 1);
  };

  const clearAll = () => {
    setPersonStates({}); setExclusive(false);
    setSelectedTags([]); setSelectedBatch('');
    setFavoritesOnly(false); setPhotoType('all');
  };

  const handleScan = async () => {
    const tag = window.prompt(
      'Add a custom tag to this batch?\n\n' +
      'This tag becomes the folder name.\n' +
      'Examples: party_2024, christmas, moms_phone\n\n' +
      'Leave empty for auto-generated batch name (batch_XXX):'
    );
    if (tag === null) return;
    setScanning(true);
    try {
      const url = tag.trim()
        ? `${API_BASE}/api/scan?tag=${encodeURIComponent(tag.trim())}`
        : `${API_BASE}/api/scan`;
      await fetch(url, { method: 'POST' });
    } catch (e) {
      alert("Failed to start scan. Is the API running?");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-bg-primary/90 backdrop-blur-md border-b border-border px-6 pt-4 pb-4">

        <div className="flex items-center justify-between h-8 mb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold text-white">Gallery</h1>
            <span className="text-sm text-textSecondary">{total} photos</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={clearAll}
                    className={`flex items-center gap-1.5 text-xs text-textSecondary hover:text-white 
                               bg-bg-secondary border border-border rounded-lg px-3 py-1.5 transition-opacity
                               ${activeFilterCount > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <X size={11} /> Clear ({activeFilterCount})
            </button>
            <button onClick={handleScan} disabled={scanning}
                    className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <ScanLine size={14} className={scanning ? 'animate-spin' : ''} />
              {scanning ? 'Scanning...' : 'Scan New'}
            </button>
          </div>
        </div>

        <ScanProgress onComplete={() => { loadPhotos(true); onRefreshData && onRefreshData(); }} />

        {allPersons.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar touch-pan-x">
              <button onClick={() => setSelectedCategory('all')}
                      className={`px-2.5 h-7 rounded-lg text-[11px] font-medium transition-colors flex-shrink-0
                                  ${selectedCategory === 'all' ? 'bg-accent text-white' : 'bg-bg-secondary text-textSecondary hover:text-white border border-border'}`}>
                All
              </button>
              {categories.map(cat => {
                const emoji = cat.category === 'family' ? '👨‍👩‍👧' : cat.category === 'friends' ? '👥' : '📁';
                return (
                  <button key={cat.category} onClick={() => setSelectedCategory(cat.category)}
                          className={`px-2.5 h-7 rounded-lg text-[11px] font-medium transition-colors flex-shrink-0 capitalize
                                      ${selectedCategory === cat.category ? 'bg-accent text-white' : 'bg-bg-secondary text-textSecondary hover:text-white border border-border'}`}>
                    {emoji} {cat.category} ({cat.person_count})
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto no-scrollbar touch-pan-x">
              <div className="flex gap-5 py-2 px-3">
                {allPersons
                  .filter(person => selectedCategory === 'all' || (person.category || 'family') === selectedCategory)
                  .map(person => {
                    const state = personStates[person.name] || null;
                    const isIncluded = state === 'include';
                    const isExcluded = state === 'exclude';
                    return (
                      <button key={person.id} onClick={() => cyclePerson(person.name)}
                              className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-95 transition-transform">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden"
                             style={{
                               boxShadow: isIncluded ? '0 0 0 2px #6366f1, 0 0 0 4px #0a0a0a, 0 0 0 6px #6366f1'
                                        : isExcluded ? '0 0 0 2px #ef4444, 0 0 0 4px #0a0a0a, 0 0 0 6px #ef4444'
                                        : '0 0 0 2px #3f3f46',
                               transition: 'box-shadow 0.15s ease',
                             }}>
                          {person.avatar_url
                            ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" style={{ opacity: isExcluded ? 0.3 : 1, filter: isExcluded ? 'grayscale(1)' : 'none' }} />
                            : <div className="w-full h-full bg-bg-tertiary flex items-center justify-center" style={{ opacity: isExcluded ? 0.3 : 1 }}>
                                <span className="text-base font-bold text-textSecondary">{person.name.charAt(0).toUpperCase()}</span>
                              </div>
                          }
                          {isIncluded && (
                            <div className="absolute inset-0 bg-accent/25 flex items-center justify-center">
                              <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-md">
                                <span className="text-white text-[10px] font-bold">✓</span>
                              </div>
                            </div>
                          )}
                          {isExcluded && (
                            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                                <X size={10} className="text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] max-w-[52px] truncate"
                              style={{ color: isIncluded ? '#6366f1' : isExcluded ? '#ef4444' : '#a3a3a3',
                                       fontWeight: isIncluded ? 600 : 400,
                                       textDecoration: isExcluded ? 'line-through' : 'none' }}>
                          {person.name}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x">
          <div className="flex bg-bg-secondary rounded-lg border border-border overflow-hidden h-8 flex-shrink-0">
            <button onClick={() => setExclusive(false)}
                    className={`flex items-center gap-1 px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${!exclusive ? 'bg-accent text-white' : 'text-textSecondary hover:text-white'}`}>
              <Unlock size={10} /> With Others
            </button>
            <button onClick={() => setExclusive(true)}
                    className={`flex items-center gap-1 px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${exclusive ? 'bg-accent text-white' : 'text-textSecondary hover:text-white'}`}>
              <Lock size={10} /> Only Selected
            </button>
          </div>

          <div className="w-px h-5 bg-border flex-shrink-0" />

          <button onClick={() => setFavoritesOnly(!favoritesOnly)}
                  className={`flex items-center gap-1 px-2.5 h-8 rounded-lg text-[11px] border whitespace-nowrap flex-shrink-0 transition-colors
                              ${favoritesOnly ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'border-border text-textSecondary hover:text-white bg-bg-secondary'}`}>
            <Star size={11} className={favoritesOnly ? 'fill-amber-400' : ''} /> Favorites
          </button>

          <div className="w-px h-5 bg-border flex-shrink-0" />

          <select value={photoType} onChange={e => setPhotoType(e.target.value)}
                  className="h-8 bg-bg-secondary border border-border rounded-lg px-2 pr-6 text-[11px] text-white flex-shrink-0 focus:outline-none focus:border-accent appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}>
            <option value="all">All Photos</option>
            <option value="faces">With Faces</option>
            <option value="untagged">Partially Tagged</option>
            <option value="notag">No Person Tag</option>
            <option value="misc">Misc (No Faces)</option>
          </select>

          {batches.length > 0 && (
            <>
              <div className="w-px h-5 bg-border flex-shrink-0" />
              <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
                      className="h-8 bg-bg-secondary border border-border rounded-lg px-2 pr-6 text-[11px] text-white min-w-[100px] flex-shrink-0 focus:outline-none focus:border-accent appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}>
                <option value="">All Batches</option>
                {batches.map(b => (
                  <option key={b.batch_name} value={b.batch_name}>{b.batch_name} ({b.photo_count})</option>
                ))}
              </select>
            </>
          )}

          {selectedTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
              className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-[11px] 
                         border border-accent/50 bg-accent/20 text-accent 
                         whitespace-nowrap flex-shrink-0 transition-colors hover:bg-accent/30"
            >
              {tag} <X size={10} />
            </button>
          ))}

          {customTags.filter(t => !selectedTags.includes(t.tag)).length > 0 && (
            <>
              <div className="w-px h-5 bg-border flex-shrink-0" />
              <select
                value=""
                onChange={e => {
                  const val = e.target.value;
                  if (val && !selectedTags.includes(val)) {
                    setSelectedTags(prev => [...prev, val]);
                  }
                }}
                className="h-8 bg-bg-secondary border border-border rounded-lg px-2 pr-6 
                           text-[11px] text-textSecondary hover:text-white min-w-[90px] 
                           flex-shrink-0 focus:outline-none focus:border-accent 
                           appearance-none cursor-pointer transition-colors"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
              >
                <option value="">+ Add Tag</option>
                {customTags
                  .filter(t => !selectedTags.includes(t.tag))
                  .map(({ tag, photo_count }) => (
                    <option key={tag} value={tag}>{tag} ({photo_count})</option>
                  ))}
              </select>
            </>
          )}
        </div>
      </div>

      <div className="px-6 py-6">
        {filtering && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!filtering && photos.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-textSecondary">
            <p className="text-base mb-2 text-white/70">No photos found</p>
            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="text-accent text-sm underline underline-offset-2 mt-2">Clear filters</button>
            )}
          </div>
        )}

        {!filtering && photos.length > 0 && (
          <>
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6" style={{ columnGap: '8px' }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ breakInside: 'avoid', marginBottom: '8px', display: 'inline-block', width: '100%' }}>
                  <div className="relative rounded-xl overflow-hidden cursor-pointer bg-bg-secondary group"
                       onClick={() => setLightboxPhoto(photo)}>
                    <img src={photo.thumb || photo.src} alt="" className="w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <button onClick={e => { e.stopPropagation(); toggleFavorite(photo.id); }}
                            className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all ${photo.favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <Heart size={14} className={photo.favorite ? 'fill-red-500 text-red-500' : 'text-white'} />
                    </button>
                    {photo.people && photo.people.length > 0 && (
                      <div className="absolute bottom-2 left-2 right-2 flex gap-1 flex-wrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {photo.people.slice(0, 3).map(name => (
                          <span key={name} className="text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-full">{name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div ref={observerRef} className="py-8 flex items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-textSecondary text-sm">Loading more...</span>
                </div>
              )}
              {!hasMore && <span className="text-textSecondary/50 text-xs">All {total} photos loaded</span>}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {lightboxPhoto && (
          <AdminLightbox photo={lightboxPhoto} photos={photos}
                         onClose={() => setLightboxPhoto(null)}
                         onFavorite={toggleFavorite}
                         onDelete={handleDelete}
                         onArchive={handleArchive}
                         onRefresh={() => loadPhotos(true)}
                         hasMore={hasMore}
                         onLoadMore={loadMore} />
        )}
      </AnimatePresence>
    </div>
  );
}