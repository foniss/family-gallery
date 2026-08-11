import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Star, Lock, Unlock, Camera, HelpCircle,
  Heart, User, ChevronLeft, ChevronRight, RotateCw, 
  Download, Play, Pause, SkipForward, SkipBack
} from 'lucide-react';
import {
  filterPhotos, fetchAllPersons, fetchPhotos, fetchStatsData,
  toggleFavoriteApi, getOriginalUrl, fetchTags,
  getDownloadUrl, getBulkDownloadUrl
} from '../services/api';

// ══════════════════════════════════════════
// HELP MODAL
// ══════════════════════════════════════════
function HelpModal({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center 
                 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-bg-secondary border border-border rounded-2xl 
                   p-8 max-w-md mx-4 shadow-2xl"
      >
        <h2 className="text-xl font-bold text-white mb-6 text-center">
          Welcome to Family Gallery
        </h2>

        <div className="space-y-5">
          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center 
                            justify-center flex-shrink-0">
              <span className="text-accent text-lg">✓</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm mb-1">Click to show</p>
              <p className="text-textSecondary text-xs leading-relaxed">
                Click a person to show their photos. Green checkmark = included.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center 
                            justify-center flex-shrink-0">
              <X size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm mb-1">Click again to hide</p>
              <p className="text-textSecondary text-xs leading-relaxed">
                Click again to exclude. Red X = hidden. Click once more to reset.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center 
                            justify-center flex-shrink-0">
              <Star size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm mb-1">Favorite & Download</p>
              <p className="text-textSecondary text-xs leading-relaxed">
                Heart to save favorites. Download single photos or all filtered photos as zip.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center 
                            justify-center flex-shrink-0">
              <Play size={16} className="text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm mb-1">Slideshow</p>
              <p className="text-textSecondary text-xs leading-relaxed">
                Open any photo and press the play button to start an automatic slideshow.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-8 bg-accent hover:bg-accent-hover text-white 
                     py-3 rounded-xl font-medium transition-colors text-sm"
        >
          Got it!
        </button>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════
// LIGHTBOX WITH SLIDESHOW + ORIGINALS
// ══════════════════════════════════════════
function ViewerLightbox({ photo, photos, onClose, onFavorite, hasMore, onLoadMore }) {
  const [current, setCurrent]               = useState(photo);
  const [favState, setFavState]             = useState(photo.favorite);
  const [rotation, setRotation]             = useState(0);
  const [zoom, setZoom]                     = useState(1);
  const [position, setPosition]             = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging]         = useState(false);
  const [dragStart, setDragStart]           = useState({ x: 0, y: 0 });
  const [lastTap, setLastTap]               = useState(0);
  const [lastTouchDist, setLastTouchDist]   = useState(null);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowSpeed, setSlideshowSpeed] = useState(3);
  const [showControls, setShowControls]     = useState(true);
  const [originalLoaded, setOriginalLoaded] = useState(false);
  const imgRef = useRef(null);
  const slideshowTimer = useRef(null);
  const controlsTimer = useRef(null);
  const idx = photos.findIndex(p => p.id === current.id);

  // Original image URL
  const originalUrl = getOriginalUrl(current.id);
  const thumbUrl = current.src || current.thumb;

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);

  // Reset on navigate
  useEffect(() => {
    setFavState(current.favorite);
    setRotation(0);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setOriginalLoaded(false);
  }, [current]);

  // Slideshow timer
  useEffect(() => {
    if (slideshowActive) {
      slideshowTimer.current = setInterval(() => {
        setCurrent(prev => {
          const currentIdx = photos.findIndex(p => p.id === prev.id);
          
          if (currentIdx < photos.length - 1) {
            // Load more when approaching the end
            if (currentIdx >= photos.length - 5 && hasMore && onLoadMore) {
              onLoadMore();
            }
            return photos[currentIdx + 1];
          } else if (hasMore && onLoadMore) {
            // At the end but more photos exist — load them
            // Stay on current photo, more will load
            onLoadMore();
            return prev;
          } else {
            // Truly at the end — loop back
            return photos[0];
          }
        });
      }, slideshowSpeed * 1000);
    }

    return () => {
      if (slideshowTimer.current) {
        clearInterval(slideshowTimer.current);
      }
    };
  }, [slideshowActive, slideshowSpeed, photos, hasMore, onLoadMore]);

  // Auto-hide controls during slideshow
  useEffect(() => {
    if (slideshowActive) {
      controlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    } else {
      setShowControls(true);
    }

    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [slideshowActive, current]);

  // Show controls on mouse/touch movement
  const handleInteraction = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (slideshowActive) {
      controlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [slideshowActive]);

  const goNext = () => {
    if (idx < photos.length - 1) {
      setCurrent(photos[idx + 1]);
      // When near the end, load more photos
      if (idx >= photos.length - 5 && hasMore && onLoadMore) {
        onLoadMore();
      }
    }
  };
  const goPrev = () => {
    if (idx > 0) setCurrent(photos[idx - 1]);
  };
  const handleFav = () => {
    setFavState(prev => !prev);
    onFavorite(current.id);
  };
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };
  const resetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = getDownloadUrl(current.id);
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const toggleSlideshow = () => {
    setSlideshowActive(prev => !prev);
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Desktop: mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    if (slideshowActive) return;
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + 0.3, 5));
    } else {
      setZoom(prev => {
        const next = Math.max(prev - 0.3, 1);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Desktop: drag to pan
  const handleMouseDown = (e) => {
    if (zoom <= 1 || slideshowActive) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const handleMouseMove = (e) => {
    handleInteraction();
    if (!isDragging || zoom <= 1) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  // Desktop: double click
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (slideshowActive) return;
    if (zoom > 1) resetZoom();
    else setZoom(2.5);
  };

  // Mobile: tap detection
  const handleImageTap = (e) => {
    e.stopPropagation();
    handleInteraction();
    const now = Date.now();
    const timeSince = now - lastTap;
    setLastTap(now);
    if (timeSince < 300 && timeSince > 0 && !slideshowActive) {
      if (zoom > 1) resetZoom();
      else setZoom(2.5);
    }
  };

  // Mobile: pinch zoom + drag
  const handleTouchStart = (e) => {
    handleInteraction();
    if (slideshowActive) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDist(dist);
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e) => {
    if (slideshowActive) return;
    if (e.touches.length === 2 && lastTouchDist !== null) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / lastTouchDist;
      setZoom(prev => {
        const next = Math.min(Math.max(prev * scale, 1), 5);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
      setLastTouchDist(dist);
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setLastTouchDist(null);
    setIsDragging(false);
  };

  // Keyboard
  useEffect(() => {
    const handleKey = (e) => {
      handleInteraction();
      if (e.key === 'Escape') {
        if (slideshowActive) setSlideshowActive(false);
        else onClose();
      }
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'f') handleFav();
      if (e.key === 'r') handleRotate();
      if (e.key === 'd') handleDownload();
      if (e.key === ' ') { e.preventDefault(); toggleSlideshow(); }
      if (e.key === '+' || e.key === '=') setZoom(prev => Math.min(prev + 0.5, 5));
      if (e.key === '-') {
        setZoom(prev => {
          const next = Math.max(prev - 0.5, 1);
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      }
      if (e.key === '0') resetZoom();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [idx, current.id, slideshowActive]);

  const isRotatedSideways = rotation === 90 || rotation === 270;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
      style={{ touchAction: 'none' }}
      onMouseMove={handleInteraction}
    >
      {/* Background close layer */}
      <div
        className="absolute inset-0"
        onClick={() => {
          if (slideshowActive) {
            handleInteraction();
          } else {
            onClose();
          }
        }}
        style={{ zIndex: 1 }}
      />

      {/* Nav buttons */}
      <AnimatePresence>
        {showControls && zoom <= 1 && idx > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-3 
                       rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            style={{ zIndex: 30 }}
          >
            <ChevronLeft size={22} className="text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && zoom <= 1 && idx < photos.length - 1 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 
                       rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            style={{ zIndex: 30 }}
          >
            <ChevronRight size={22} className="text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Image area */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ zIndex: 10 }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="absolute inset-0" onClick={() => {
          if (slideshowActive) handleInteraction();
          else onClose();
        }} />

        <div
          ref={imgRef}
          onClick={handleImageTap}
          onDoubleClick={handleDoubleClick}
          className="relative"
          style={{
            transform: `
              translate(${position.x}px, ${position.y}px) 
              rotate(${rotation}deg) 
              scale(${zoom})
            `,
            transition: isDragging ? 'none' : 'transform 0.3s ease',
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            zIndex: 15,
          }}
        >
          {/* Show thumbnail first, then load original on top */}
          <img
            src={thumbUrl}
            alt=""
            className="object-contain rounded-lg select-none"
            style={{
              maxHeight: isRotatedSideways ? '90vw' : '85vh',
              maxWidth: isRotatedSideways ? '85vh' : '90vw',
              display: originalLoaded ? 'none' : 'block',
            }}
            draggable={false}
          />
          <img
            src={originalUrl}
            alt=""
            onLoad={() => setOriginalLoaded(true)}
            className="object-contain rounded-lg select-none"
            style={{
              maxHeight: isRotatedSideways ? '90vw' : '85vh',
              maxWidth: isRotatedSideways ? '85vh' : '90vw',
              display: originalLoaded ? 'block' : 'none',
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* Zoom indicator */}
      {zoom > 1 && showControls && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 
                     bg-black/60 backdrop-blur-sm rounded-full 
                     px-3 py-1.5 flex items-center gap-2"
          style={{ zIndex: 30 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setZoom(prev => {
              const next = Math.max(prev - 0.5, 1);
              if (next === 1) setPosition({ x: 0, y: 0 });
              return next;
            })}
            className="text-white/70 hover:text-white text-sm font-bold
                       w-6 h-6 flex items-center justify-center"
          >
            −
          </button>
          <span className="text-white/80 text-xs tabular-nums min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(prev + 0.5, 5))}
            className="text-white/70 hover:text-white text-sm font-bold
                       w-6 h-6 flex items-center justify-center"
          >
            +
          </button>
          <button
            onClick={resetZoom}
            className="text-white/50 hover:text-white text-[10px] ml-1"
          >
            Reset
          </button>
        </div>
      )}

      {/* Slideshow speed control — show when slideshow active and controls visible */}
      <AnimatePresence>
        {slideshowActive && showControls && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm 
                       rounded-full px-3 py-1.5 flex items-center gap-2"
            style={{ zIndex: 30 }}
            onClick={e => e.stopPropagation()}
          >
            <span className="text-white/50 text-[10px]">Speed</span>
            <button
              onClick={() => setSlideshowSpeed(prev => Math.max(prev - 1, 1))}
              className="text-white/70 hover:text-white text-xs font-bold
                         w-5 h-5 flex items-center justify-center"
            >
              −
            </button>
            <span className="text-white/80 text-xs tabular-nums min-w-[24px] text-center">
              {slideshowSpeed}s
            </span>
            <button
              onClick={() => setSlideshowSpeed(prev => Math.min(prev + 1, 10))}
              className="text-white/70 hover:text-white text-xs font-bold
                         w-5 h-5 flex items-center justify-center"
            >
              +
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <AnimatePresence>
        {showControls && zoom <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 
                       bg-gradient-to-t from-black via-black/60 to-transparent
                       pt-20 pb-5 px-5"
            style={{ zIndex: 30 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              {/* People tags */}
              <div className="flex items-center gap-2 flex-wrap">
                {current.people && current.people.map(name => (
                  <span
                    key={name}
                    className="text-xs bg-white/15 backdrop-blur-sm text-white 
                               px-2.5 py-1 rounded-full flex items-center gap-1"
                  >
                    <User size={10} />
                    {name}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Slideshow toggle */}
                <button
                  onClick={toggleSlideshow}
                  className={`p-2.5 rounded-full transition-colors
                              ${slideshowActive 
                                ? 'bg-green-500/30 hover:bg-green-500/40' 
                                : 'bg-white/10 hover:bg-white/20'}`}
                  title={slideshowActive ? "Pause (Space)" : "Slideshow (Space)"}
                >
                  {slideshowActive 
                    ? <Pause size={18} className="text-green-400" />
                    : <Play size={18} className="text-white" />
                  }
                </button>

                {/* Download */}
                <button
                  onClick={handleDownload}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 
                             transition-colors"
                  title="Download (D)"
                >
                  <Download size={18} className="text-white" />
                </button>

                {/* Rotate */}
                <button
                  onClick={handleRotate}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 
                             transition-colors"
                  title="Rotate (R)"
                >
                  <RotateCw size={18} className="text-white" />
                </button>

                {/* Favorite */}
                <button
                  onClick={handleFav}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 
                             transition-colors"
                  title="Favorite (F)"
                >
                  <Heart
                    size={18}
                    className={favState
                      ? 'fill-red-500 text-red-500'
                      : 'text-white'}
                  />
                </button>

                {/* Counter */}
                <span className="text-sm text-white/40 tabular-nums ml-1">
                  {idx + 1} / {photos.length}{hasMore ? '+' : ''}
                </span>
              </div>
            </div>

            {/* Slideshow progress bar */}
            {slideshowActive && (
              <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  key={current.id}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ 
                    duration: slideshowSpeed, 
                    ease: 'linear' 
                  }}
                  className="h-full bg-green-400 rounded-full"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ══════════════════════════════════════════
// PHOTO CARD
// ══════════════════════════════════════════
function ViewerPhotoCard({ photo, onClick, onFavorite }) {
  const [loaded, setLoaded]   = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer bg-bg-secondary"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(photo)}
    >
      {!loaded && <div className="absolute inset-0 bg-bg-tertiary animate-pulse" />}

      <img
        src={photo.thumb || photo.src}
        alt=""
        onLoad={() => setLoaded(true)}
        className={`w-full object-cover transition-all duration-500
                    ${loaded ? 'opacity-100' : 'opacity-0'}
                    ${hovered ? 'scale-105' : 'scale-100'}`}
      />

      <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent 
                        to-transparent transition-opacity duration-200
                        ${hovered ? 'opacity-100' : 'opacity-0'}`} />

      <button
        onClick={e => { e.stopPropagation(); onFavorite(photo.id); }}
        className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/40 
                    backdrop-blur-sm hover:bg-black/60 transition-all
                    ${hovered || photo.favorite ? 'opacity-100' : 'opacity-0'}`}
      >
        <Heart
          size={14}
          className={photo.favorite ? 'fill-red-500 text-red-500' : 'text-white'}
        />
      </button>

      {photo.people && photo.people.length > 0 && (
        <div className={`absolute bottom-2 left-2 right-2 flex gap-1 flex-wrap
                         transition-opacity duration-200
                         ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          {photo.people.slice(0, 3).map(name => (
            <span
              key={name}
              className="text-[10px] bg-black/50 backdrop-blur-sm text-white 
                         px-1.5 py-0.5 rounded-full"
            >
              {name}
            </span>
          ))}
          {photo.people.length > 3 && (
            <span className="text-[10px] bg-black/50 text-white/70 
                             px-1.5 py-0.5 rounded-full">
              +{photo.people.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// MAIN VIEWER — with infinite scroll
// ══════════════════════════════════════════
export default function FamilyViewer() {
  const [allPersons, setAllPersons]     = useState([]);
  const [customTags, setCustomTags]     = useState([]);
  const [personStates, setPersonStates] = useState({});
  const [exclusive, setExclusive]       = useState(false);
  const [selectedTags, setSelectedTags] = useState([]); // Changed to array
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [photos, setPhotos]             = useState([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [filtering, setFiltering]       = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [showHelp, setShowHelp]         = useState(false);
  const [hasMore, setHasMore]           = useState(true);
  const observerRef = useRef(null);
  const loadingRef  = useRef(false);

  const PAGE_SIZE = 50;

  const selectedPeople = Object.entries(personStates)
    .filter(([, s]) => s === 'include').map(([n]) => n);
  const excludedPeople = Object.entries(personStates)
    .filter(([, s]) => s === 'exclude').map(([n]) => n);
  const hasFilter = selectedPeople.length > 0 || excludedPeople.length > 0 ||
                    selectedTags.length > 0 || favoritesOnly;
  const activeFilterCount = [
    selectedPeople.length > 0, excludedPeople.length > 0,
    exclusive, selectedTags.length > 0, favoritesOnly
  ].filter(Boolean).length;

  // Build current filters object
  const getFilters = useCallback(() => {
    const filters = {};
      if (selectedPeople.length > 0) filters.persons = selectedPeople.join(',');
      if (exclusive && selectedPeople.length > 0) filters.exclusive = true;
      if (excludedPeople.length > 0) filters.exclude_person = excludedPeople.join(',');
      if (selectedTags.length > 0) filters.tags = selectedTags.join(',');
      if (favoritesOnly) filters.favorite = true;
      filters.family_only = true;  // Always filter to family members
    return filters;
  }, [selectedPeople, excludedPeople, exclusive, selectedTags, favoritesOnly]);

  // First visit help
  useEffect(() => {
    const visited = localStorage.getItem('family_gallery_visited');
    if (!visited) {
      setShowHelp(true);
      localStorage.setItem('family_gallery_visited', 'true');
    }
  }, []);

  // Load people and tags
useEffect(() => {
    Promise.all([
      fetchAllPersons(),
      fetchTags(),
    ]).then(([persons, tags]) => {
      const familyOnly = persons.filter(p => !p.category || p.category === 'family');
      const sorted = [...familyOnly].sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setAllPersons(sorted);
      setCustomTags(tags);
    }).catch(() => {});
  }, []);

  // Load photos (initial + when filters change)
  const loadPhotos = useCallback(async (reset = true) => {
    if (reset) { setFiltering(true); setPhotos([]); setHasMore(true); }
    try {
      const offset = reset ? 0 : photos.length;
      const filters = {};

      if (selectedPeople.length > 0) filters.persons = selectedPeople.join(',');
      if (exclusive && selectedPeople.length > 0) filters.exclusive = true;
      if (excludedPeople.length > 0) filters.exclude_person = excludedPeople.join(',');
      if (selectedTags.length > 0) filters.tags = selectedTags.join(',');
      if (favoritesOnly) filters.favorite = true;

      // Only apply family_only filter when NO tag is selected
      // When a tag IS selected, show everything in that tag
      // (family deliberately tagged those photos for family to see)
      if (selectedTags.length === 0) {
        filters.family_only = true;
      }

      const data = await filterPhotos(filters, PAGE_SIZE, offset);
      
      if (reset) {
        setPhotos(data.photos);
        setTotal(data.total || 0);
      } else {
        setPhotos(prev => [...prev, ...data.photos]);
      }
      setHasMore(data.photos.length === PAGE_SIZE);

    } catch (e) {
      console.error('Failed to load photos:', e);
    } finally {
      setLoading(false);
      setFiltering(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [selectedPeople, excludedPeople, exclusive, selectedTags, favoritesOnly, photos.length]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadPhotos(true);
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (!loading) loadPhotos(true);
  }, [personStates, exclusive, selectedTags, favoritesOnly]);

  // Load more photos
  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore || loadingMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    loadPhotos(false);
  }, [hasMore, loadingMore, loadPhotos]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !filtering) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, filtering, loadMore]);

  const cyclePerson = (name) => {
    setPersonStates(prev => {
      const current = prev[name] || null;
      const next = current === null ? 'include'
                 : current === 'include' ? 'exclude' : null;
      const updated = { ...prev };
      if (next === null) delete updated[name];
      else updated[name] = next;
      return updated;
    });
  };

  const toggleFavorite = async (photoId) => {
    const update = p => p.id === photoId ? { ...p, favorite: !p.favorite } : p;
    setPhotos(prev => prev.map(update));
    await toggleFavoriteApi(photoId);
  };

  const clearAll = () => {
    setPersonStates({});
    setExclusive(false);
    setSelectedTags([]);
    setFavoritesOnly(false);
  };

const handleBulkDownload = () => {
    const params = new URLSearchParams();
    if (selectedPeople.length > 0) params.append('persons', selectedPeople.join(','));
    if (exclusive && selectedPeople.length > 0) params.append('exclusive', 'true');
    if (excludedPeople.length > 0) params.append('exclude_person', excludedPeople.join(','));
    if (selectedTags.length > 0) params.append('tags', selectedTags.join(','));
    if (favoritesOnly) params.append('favorite', 'true');
    
    if (selectedTags.length === 0) {
      params.append('family_only', 'true');
    }

    const l = document.createElement('a');
    l.href = getBulkDownloadUrl(params);
    l.download = '';
    document.body.appendChild(l);
    l.click();
    document.body.removeChild(l);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-bg-primary flex flex-col 
                      items-center justify-center space-y-4">
        <Camera size={40} className="text-accent" />
        <div className="w-8 h-8 border-[3px] border-accent border-t-transparent 
                        rounded-full animate-spin" />
        <p className="text-textSecondary text-sm">Loading your gallery...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ═══ HEADER ═══ */}
      <div className="relative top-0 z-10 bg-bg-primary/90 backdrop-blur-md 
                      border-b border-border px-3 sm:px-6 pt-4 pb-4">

        <div className="flex items-center justify-between h-8 mb-4">
          <div className="flex items-center gap-2.5">
            <Camera size={20} className="text-accent flex-shrink-0" />
            <h1 className="text-lg font-semibold text-white">Family Gallery</h1>
            <span className="text-sm text-textSecondary">
              {total > 0 && <>{total} photos</>}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              className={`flex items-center gap-1.5 text-xs text-textSecondary
                         hover:text-white bg-bg-secondary border border-border 
                         rounded-lg px-3 py-1.5 transition-opacity
                         ${activeFilterCount > 0 
                           ? 'opacity-100' 
                           : 'opacity-0 pointer-events-none'}`}
            >
              <X size={11} />
              Clear
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="p-1.5 rounded-lg text-textSecondary hover:text-white 
                         hover:bg-bg-secondary transition-colors"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        </div>

        {allPersons.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-textSecondary uppercase tracking-wider font-medium">
                People
              </p>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-[7px] h-[7px] rounded-full bg-accent inline-block" />
                  <span className="text-[10px] text-textSecondary">Show</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-[7px] h-[7px] rounded-full bg-red-500 inline-block" />
                  <span className="text-[10px] text-textSecondary">Hide</span>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar touch-pan-x">
              <div className="flex gap-5 py-2 px-3">
                {allPersons.map(person => {
                  const state = personStates[person.name] || null;
                  const isIncluded = state === 'include';
                  const isExcluded = state === 'exclude';

                  return (
                    <button
                      key={person.id}
                      onClick={() => cyclePerson(person.name)}
                      className="flex flex-col items-center gap-1 flex-shrink-0 
                                 bg-transparent border-none cursor-pointer p-0
                                 active:scale-95 transition-transform"
                    >
                      <div
                        className="relative w-12 h-12 rounded-full overflow-hidden"
                        style={{
                          boxShadow: isIncluded
                            ? '0 0 0 2px #6366f1, 0 0 0 4px #0a0a0a, 0 0 0 6px #6366f1'
                            : isExcluded
                              ? '0 0 0 2px #ef4444, 0 0 0 4px #0a0a0a, 0 0 0 6px #ef4444'
                              : '0 0 0 2px #3f3f46',
                          transition: 'box-shadow 0.15s ease',
                        }}
                      >
                        {person.avatar_url ? (
                          <img src={person.avatar_url} alt={person.name}
                               className="w-full h-full object-cover"
                               style={{
                                 opacity: isExcluded ? 0.3 : 1,
                                 filter: isExcluded ? 'grayscale(1)' : 'none',
                               }} />
                        ) : (
                          <div className="w-full h-full bg-bg-tertiary flex items-center justify-center"
                               style={{ opacity: isExcluded ? 0.3 : 1 }}>
                            <span className="text-base font-bold text-textSecondary">
                              {person.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {isIncluded && (
                          <div className="absolute inset-0 bg-accent/25 flex items-center justify-center">
                            <div className="w-5 h-5 bg-accent rounded-full flex items-center 
                                            justify-center shadow-md">
                              <span className="text-white text-[10px] font-bold">✓</span>
                            </div>
                          </div>
                        )}
                        {isExcluded && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center 
                                            justify-center shadow-md">
                              <X size={10} className="text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] leading-tight max-w-[52px] truncate"
                            style={{
                              color: isIncluded ? '#6366f1' : isExcluded ? '#ef4444' : '#a3a3a3',
                              fontWeight: isIncluded ? 600 : 400,
                              textDecoration: isExcluded ? 'line-through' : 'none',
                            }}>
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
          <div className="flex bg-bg-secondary rounded-lg border border-border 
                          overflow-hidden h-8 flex-shrink-0">
            <button onClick={() => setExclusive(false)}
                    className={`flex items-center gap-1 px-2.5 text-[11px] font-medium 
                                transition-colors whitespace-nowrap
                                ${!exclusive ? 'bg-accent text-white' : 'text-textSecondary hover:text-white'}`}>
              <Unlock size={10} /> With Others
            </button>
            <button onClick={() => setExclusive(true)}
                    className={`flex items-center gap-1 px-2.5 text-[11px] font-medium 
                                transition-colors whitespace-nowrap
                                ${exclusive ? 'bg-accent text-white' : 'text-textSecondary hover:text-white'}`}>
              <Lock size={10} /> Only Selected
            </button>
          </div>

          <div className="w-px h-5 bg-border flex-shrink-0" />

          <button onClick={() => setFavoritesOnly(!favoritesOnly)}
                  className={`flex items-center gap-1 px-2.5 h-8 rounded-lg text-[11px] 
                              border whitespace-nowrap flex-shrink-0 transition-colors
                              ${favoritesOnly
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                : 'border-border text-textSecondary hover:text-white bg-bg-secondary'}`}>
            <Star size={11} className={favoritesOnly ? 'fill-amber-400' : ''} /> Favorites
          </button>

          {customTags.length > 0 && (
            <>
              <div className="w-px h-5 bg-border flex-shrink-0" />
              
              {/* Display selected tags as removable chips */}
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

              {/* Tag selector dropdown */}
              {customTags.filter(t => !selectedTags.includes(t.tag)).length > 0 && (
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
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 6px center',
                  }}
                >
                  <option value="">+ Add Tag</option>
                  {customTags
                    .filter(t => !selectedTags.includes(t.tag))
                    .map(({ tag, photo_count }) => (
                      <option key={tag} value={tag}>{tag} ({photo_count})</option>
                    ))}
                </select>
              )}
            </>
          )}

          {photos.length > 0 && (
            <>
              <div className="w-px h-5 bg-border flex-shrink-0" />
              <button onClick={handleBulkDownload}
                      className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-[11px] 
                                 border whitespace-nowrap flex-shrink-0 transition-colors 
                                 border-border text-textSecondary hover:text-white bg-bg-secondary">
                <Download size={11} /> Download{total > 1 ? ` (${total})` : ''}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══ PHOTOS ═══ */}
      <div className="px-3 sm:px-6 py-4 sm:py-6">
        {filtering && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-[3px] border-accent 
                            border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!filtering && photos.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-textSecondary">
            <Camera size={52} className="mb-4 opacity-15" />
            <p className="text-base mb-2 text-white/70">No photos found</p>
            {activeFilterCount > 0 && (
              <button onClick={clearAll}
                      className="text-accent hover:text-accent-hover text-sm 
                                 underline underline-offset-2 mt-2">
                Clear filters
              </button>
            )}
          </div>
        )}

        {!filtering && photos.length > 0 && (
          <>
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6"
                 style={{ columnGap: '8px' }}>
              {photos.map(photo => (
                <div key={photo.id}
                     style={{ breakInside: 'avoid', marginBottom: '8px',
                              display: 'inline-block', width: '100%' }}>
                  <ViewerPhotoCard photo={photo} onClick={setLightboxPhoto} onFavorite={toggleFavorite} />
                </div>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={observerRef} className="py-8 flex items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent 
                                  rounded-full animate-spin" />
                  <span className="text-textSecondary text-sm">Loading more...</span>
                </div>
              )}
              {!hasMore && photos.length > 0 && (
                <span className="text-textSecondary/50 text-xs">
                  All {total} photos loaded
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {lightboxPhoto && (
          <ViewerLightbox 
            photo={lightboxPhoto} 
            photos={photos}
            onClose={() => setLightboxPhoto(null)} 
            onFavorite={toggleFavorite}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </AnimatePresence>
    </div>
  );
}