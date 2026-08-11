import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Heart, ChevronLeft, ChevronRight,
  Calendar, User, Tag, Download, RotateCw,
  Plus, Check, Pencil
} from 'lucide-react';
import {
  addPersonToPhoto, removePersonFromPhoto,
  fixPersonOnPhoto, addTagToPhoto,
  removeTagFromPhoto, fetchAllPersons
} from '../services/api';

// ── Person Tag Component ──────────────────────
function PersonTag({ person, photoId, onUpdate }) {
  const [editing, setEditing]   = useState(false);
  const [newName, setNewName]   = useState('');
  const [allPersons, setAllPersons] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const inputRef = useRef(null);

  const startEdit = async () => {
    setEditing(true);
    setNewName(person.name);
    const persons = await fetchAllPersons();
    setAllPersons(persons);
    setFiltered(persons);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleInput = (val) => {
    setNewName(val);
    setFiltered(
      allPersons.filter(p =>
        p.name.toLowerCase().includes(val.toLowerCase())
      )
    );
  };

  const handleFix = async (nameToUse) => {
    if (!nameToUse.trim() || nameToUse === person.name) {
      setEditing(false);
      return;
    }
    await fixPersonOnPhoto(photoId, person.id, nameToUse.trim());
    setEditing(false);
    onUpdate();
  };

  const handleRemove = async () => {
    await removePersonFromPhoto(photoId, person.id);
    onUpdate();
  };

  if (editing) {
    return (
      <div className="relative">
        <div className="flex items-center gap-1 bg-accent/30 
                        border border-accent rounded-full px-2 py-1">
          <input
            ref={inputRef}
            value={newName}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleFix(newName);
              if (e.key === 'Escape') setEditing(false);
            }}
            className="bg-transparent text-white text-xs 
                       outline-none w-24"
            placeholder="Type name..."
          />
          <button
            onClick={() => handleFix(newName)}
            className="text-green-400 hover:text-green-300"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-textSecondary hover:text-white"
          >
            <X size={12} />
          </button>
        </div>

        {filtered.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-40
                          bg-bg-secondary border border-border
                          rounded-lg overflow-hidden z-50 shadow-xl">
            {filtered.slice(0, 5).map(p => (
              <button
                key={p.id}
                onClick={() => handleFix(p.name)}
                className="w-full text-left px-3 py-2 text-xs
                           text-white hover:bg-accent/20 transition-colors"
              >
                {p.name}
                <span className="text-textSecondary ml-1">
                  {p.photo_count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-accent/20 
                    border border-accent/30 rounded-full 
                    pl-2 pr-1 py-0.5 group">
      <User size={10} className="text-accent flex-shrink-0" />
      <span className="text-xs text-accent">{person.name}</span>

      <button
        onClick={startEdit}
        className="opacity-0 group-hover:opacity-100 transition-opacity
                   p-0.5 hover:text-white text-textSecondary"
        title="Fix wrong name"
      >
        <Pencil size={10} />
      </button>

      <button
        onClick={handleRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity
                   p-0.5 hover:text-red-400 text-textSecondary"
        title="Remove from photo"
      >
        <X size={10} />
      </button>
    </div>
  );
}

// ── Add Person Component ──────────────────────
function AddPersonButton({ photoId, onUpdate }) {
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState('');
  const [allPersons, setAllPersons] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const inputRef = useRef(null);

  const handleOpen = async () => {
    setOpen(true);
    setName('');
    const persons = await fetchAllPersons();
    setAllPersons(persons);
    setFiltered(persons);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleInput = (val) => {
    setName(val);
    setFiltered(
      allPersons.filter(p =>
        p.name.toLowerCase().includes(val.toLowerCase())
      )
    );
  };

  const handleAdd = async (nameToUse) => {
    if (!nameToUse.trim()) return;
    await addPersonToPhoto(photoId, nameToUse.trim());
    setOpen(false);
    setName('');
    onUpdate();
  };

  if (open) {
    return (
      <div className="relative">
        <div className="flex items-center gap-1 bg-bg-tertiary
                        border border-border rounded-full px-2 py-1">
          <input
            ref={inputRef}
            value={name}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd(name);
              if (e.key === 'Escape') setOpen(false);
            }}
            className="bg-transparent text-white text-xs 
                       outline-none w-24"
            placeholder="Person name..."
          />
          <button
            onClick={() => handleAdd(name)}
            className="text-green-400 hover:text-green-300"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-textSecondary hover:text-white"
          >
            <X size={12} />
          </button>
        </div>

        {filtered.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-40
                          bg-bg-secondary border border-border
                          rounded-lg overflow-hidden z-50 shadow-xl">
            {filtered.slice(0, 5).map(p => (
              <button
                key={p.id}
                onClick={() => handleAdd(p.name)}
                className="w-full text-left px-3 py-2 text-xs
                           text-white hover:bg-accent/20 transition-colors"
              >
                {p.name}
                <span className="text-textSecondary ml-1">
                  {p.photo_count}
                </span>
              </button>
            ))}

            {name && !allPersons.find(p =>
              p.name.toLowerCase() === name.toLowerCase()
            ) && (
              <button
                onClick={() => handleAdd(name)}
                className="w-full text-left px-3 py-2 text-xs
                           text-accent hover:bg-accent/20 transition-colors
                           border-t border-border"
              >
                + Add "{name}" as new person
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleOpen}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full
                 border border-dashed border-border text-textSecondary
                 hover:border-accent hover:text-accent transition-all text-xs"
    >
      <Plus size={10} />
      Add person
    </button>
  );
}

// ── Tag Component ─────────────────────────────
function TagBadge({ tag, photoId, onUpdate }) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    await removeTagFromPhoto(photoId, tag);
    onUpdate();
  };

  return (
    <div className="flex items-center gap-1 bg-bg-secondary
                    border border-border rounded-full px-2 py-0.5 group">
      <span className="text-xs text-textSecondary">#{tag}</span>
      <button
        onClick={handleRemove}
        disabled={removing}
        className="opacity-0 group-hover:opacity-100 transition-opacity
                   p-0.5 hover:text-red-400 text-textSecondary"
      >
        <X size={10} />
      </button>
    </div>
  );
}

// ── Add Tag Component ─────────────────────────
function AddTagButton({ photoId, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [tag, setTag]   = useState('');
  const inputRef        = useRef(null);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleAdd = async () => {
    if (!tag.trim()) return;
    await addTagToPhoto(photoId, tag.trim());
    setOpen(false);
    setTag('');
    onUpdate();
  };

  if (open) {
    return (
      <div className="flex items-center gap-1 bg-bg-tertiary
                      border border-border rounded-full px-2 py-1">
        <input
          ref={inputRef}
          value={tag}
          onChange={e => setTag(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') setOpen(false);
          }}
          className="bg-transparent text-white text-xs 
                     outline-none w-20"
          placeholder="Tag name..."
        />
        <button
          onClick={handleAdd}
          className="text-green-400 hover:text-green-300"
        >
          <Check size={12} />
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-textSecondary hover:text-white"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleOpen}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full
                 border border-dashed border-border text-textSecondary
                 hover:border-accent hover:text-accent transition-all text-xs"
    >
      <Plus size={10} />
      Add tag
    </button>
  );
}

// ── Main Lightbox ─────────────────────────────
export default function Lightbox({ photo, photos, onClose, onFavorite, onNavigate }) {
  const [currentPhoto, setCurrentPhoto] = useState(photo);
  const [photoDetail, setPhotoDetail]   = useState(null);
  const [rotating, setRotating]         = useState(false);

  const currentIndex = photos.findIndex(p => p.id === currentPhoto.id);

  const fetchDetail = async () => {
    try {
      const res  = await fetch(`http://localhost:8000/api/photos/${currentPhoto.id}`);
      const data = await res.json();

      // Cache buster to force reload image if it was rotated
      const cacheBuster = `?t=${new Date().getTime()}`;
      if (data.thumb_medium_url) data.thumb_medium_url += cacheBuster;
      if (data.thumb_small_url) data.thumb_small_url += cacheBuster;

      const formatted = {
        ...data,
        src:      data.thumb_medium_url || data.thumb_small_url || '',
        thumb:    data.thumb_small_url  || data.thumb_medium_url || '',
        date:     data.date_taken || 'Unknown Date',
        favorite: data.favorite === true || data.favorite === 1,
        people:   data.people || [],
        tags:     data.tags   || [],
      };
      setPhotoDetail(formatted);
    } catch (e) {
      setPhotoDetail(currentPhoto);
    }
  };

  useEffect(() => {
    setPhotoDetail(null);
    fetchDetail();
  }, [currentPhoto.id]);

  const handleRotate = async () => {
    setRotating(true);
    try {
      await fetch(`http://localhost:8000/api/photos/${currentPhoto.id}/rotate`, { 
        method: 'POST' 
      });
      fetchDetail(); // Refetch details to show new rotation
    } catch (e) {
      console.error('Rotate failed:', e);
    } finally {
      setRotating(false);
    }
  };

  const goNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentPhoto(photos[currentIndex + 1]);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentPhoto(photos[currentIndex - 1]);
    }
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'f')          onFavorite(currentPhoto.id);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex]);

  const display = photoDetail || currentPhoto;

  const [allPersons, setAllPersons] = useState([]);
  useEffect(() => {
    fetchAllPersons().then(setAllPersons);
  }, []);

  const getPeopleObjects = () => {
    if (!display.people || display.people.length === 0) return [];
    return display.people.map(name => {
      const found = allPersons.find(
        p => p.name.toLowerCase() === name.toLowerCase()
      );
      return found || { id: null, name };
    }).filter(p => p.id !== null);
  };

  const formattedDate = display.date && display.date !== 'Unknown Date'
    ? new Date(display.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    : 'Unknown Date';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex"
        style={{ background: 'rgba(0,0,0,0.95)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full 
                     bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X size={20} className="text-white" />
        </button>

        {/* Prev */}
        {currentIndex > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 
                       rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
        )}

        {/* Next */}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-80 top-1/2 -translate-y-1/2 z-10 p-3 
                       rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronRight size={24} className="text-white" />
          </button>
        )}

        {/* Main Image */}
        <div className="flex-1 flex items-center justify-center p-16">
          <motion.img
            key={display.src || display.thumb} // Forces remount when src changes
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            src={display.src || display.thumb}
            alt=""
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        </div>

        {/* Right Panel */}
        <div className="w-72 bg-bg-tertiary border-l border-border 
                        flex flex-col overflow-y-auto">
          {/* Thumbnail */}
          <div className="aspect-square flex-shrink-0">
            <img
              key={display.thumb} // Forces remount
              src={display.thumb}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-4 space-y-5">
            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => onFavorite(currentPhoto.id)}
                className={`flex-1 flex items-center justify-center gap-2 
                            py-2 rounded-lg text-sm font-medium transition-all
                            ${display.favorite
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-bg-secondary text-textSecondary hover:text-white border border-border'
                            }`}
              >
                <Heart size={14} className={display.favorite ? 'fill-red-400' : ''} />
                {display.favorite ? 'Liked' : 'Like'}
              </button>

              {/* ROTATE BUTTON */}
              <button
                onClick={handleRotate}
                disabled={rotating}
                className="flex items-center justify-center gap-2
                           py-2 rounded-lg text-sm font-medium bg-bg-secondary
                           text-textSecondary hover:text-white border border-border
                           transition-all px-3"
                title="Rotate 90° clockwise"
              >
                <RotateCw
                  size={14}
                  className={rotating ? 'animate-spin' : ''}
                />
              </button>

              <button
                className="flex-1 flex items-center justify-center gap-2
                           py-2 rounded-lg text-sm font-medium bg-bg-secondary
                           text-textSecondary hover:text-white border border-border
                           transition-all"
              >
                <Download size={14} />
                Save
              </button>
            </div>

            {/* Date */}
            <div className="flex items-start gap-3">
              <Calendar size={16} className="text-textSecondary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-textSecondary mb-0.5">Date Taken</p>
                <p className="text-sm text-white">{formattedDate}</p>
              </div>
            </div>

            {/* People Section */}
            <div className="flex items-start gap-3">
              <User size={16} className="text-textSecondary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-textSecondary mb-2">People</p>
                <div className="flex flex-wrap gap-1.5">
                  {getPeopleObjects().map(person => (
                    <PersonTag
                      key={person.id}
                      person={person}
                      photoId={currentPhoto.id}
                      onUpdate={fetchDetail}
                    />
                  ))}
                  <AddPersonButton
                    photoId={currentPhoto.id}
                    onUpdate={fetchDetail}
                  />
                </div>
              </div>
            </div>

            {/* Tags Section */}
            <div className="flex items-start gap-3">
              <Tag size={16} className="text-textSecondary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-textSecondary mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {(display.tags || []).map(tag => (
                    <TagBadge
                      key={tag}
                      tag={tag}
                      photoId={currentPhoto.id}
                      onUpdate={fetchDetail}
                    />
                  ))}
                  <AddTagButton
                    photoId={currentPhoto.id}
                    onUpdate={fetchDetail}
                  />
                </div>
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-textSecondary">
                ← → Navigate · F Favorite · Esc Close
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}