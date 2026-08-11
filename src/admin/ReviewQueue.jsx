import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, UserX, ChevronRight, X, ExternalLink, SkipForward } from 'lucide-react';
import { API_BASE, getOriginalUrl } from '../services/api';

export default function ReviewQueue({ clusters, people, onNameCluster }) {
  const [inputName, setInputName]       = useState('');
  const [activeCluster, setActiveCluster] = useState(null);
  const [viewingPhoto, setViewingPhoto]   = useState(null);

  if (clusters.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full 
                          flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">All Done!</h2>
          <p className="text-textSecondary">
            All faces have been reviewed and tagged.
          </p>
        </motion.div>
      </div>
    );
  }

  const handleConfirm = (clusterId) => {
    if (!inputName.trim()) return;
    onNameCluster(clusterId, inputName.trim());
    setInputName('');
    setActiveCluster(null);
  };

  const handleExistingPerson = (clusterId, name) => {
    onNameCluster(clusterId, name);
    setActiveCluster(null);
    setInputName('');
  };

  const handleNotPerson = async (clusterId) => {
    try {
      await fetch(`${API_BASE}/api/clusters/${clusterId}/not-a-person`, {
        method: 'POST'
      });
    } catch (e) {
      console.error('Not a person failed:', e);
    }
  };

  const handleSkipCluster = async (clusterId) => {
    try {
      await fetch(`${API_BASE}/api/clusters/${clusterId}/skip`, {
        method: 'POST'
      });
    } catch (e) {
      console.error('Skip failed:', e);
    }
  };

  const handleSkipAll = async () => {
    if (!window.confirm(`Skip all ${clusters.length} remaining clusters?\n\nYou can always rerun clustering later to see them again.`)) return;
    
    for (const cluster of clusters) {
      try {
        await fetch(`${API_BASE}/api/clusters/${cluster.id}/skip`, {
          method: 'POST'
        });
      } catch (e) {}
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-md
                      border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Review Queue</h1>
            <p className="text-sm text-textSecondary">
              {clusters.length} groups to review
            </p>
          </div>
          <button
            onClick={handleSkipAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
                       bg-bg-secondary border border-border text-textSecondary
                       hover:text-amber-400 hover:border-amber-500/30 transition-all"
          >
            <SkipForward size={13} />
            Skip All
          </button>
        </div>
      </div>

      {/* All clusters as grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clusters.map(cluster => {
            const isActive = activeCluster === cluster.id;
            
            return (
              <div key={cluster.id}
                   className={`bg-bg-secondary border rounded-2xl p-4 transition-all
                               ${isActive 
                                 ? 'border-accent ring-1 ring-accent' 
                                 : 'border-border hover:border-accent/30'}`}>
                
                {/* Face thumbnails */}
                <div className="flex gap-2 flex-wrap justify-center mb-3">
                  {cluster.faces.map((face, i) => {
                    const cropUrl = typeof face === 'string' ? face : face.cropUrl;
                    const photoId = typeof face === 'string' ? null : face.photoId;
                    
                    return (
                      <button
                        key={i}
                        onClick={() => photoId && setViewingPhoto(photoId)}
                        className="relative w-12 h-12 rounded-lg overflow-hidden 
                                   ring-1 ring-border hover:ring-accent transition-all 
                                   cursor-pointer group"
                      >
                        <img src={cropUrl} alt="" className="w-full h-full object-cover" />
                        {photoId && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 
                                          group-hover:opacity-100 transition-opacity
                                          flex items-center justify-center">
                            <ExternalLink size={10} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {cluster.photoCount > cluster.faces.length && (
                    <div className="w-12 h-12 rounded-lg bg-bg-tertiary border border-dashed 
                                    border-border flex items-center justify-center">
                      <span className="text-[10px] text-textSecondary">
                        +{cluster.photoCount - cluster.faces.length}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-textSecondary text-center mb-3">
                  {cluster.photoCount} photos
                </p>

                {/* Active — show naming UI */}
                {isActive ? (
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={inputName}
                        onChange={e => setInputName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConfirm(cluster.id)}
                        placeholder="Name..."
                        autoFocus
                        className="flex-1 bg-bg-tertiary border border-border 
                                   rounded-lg px-3 py-2 text-sm text-white 
                                   placeholder-textSecondary outline-none 
                                   focus:border-accent"
                      />
                      <button
                        onClick={() => handleConfirm(cluster.id)}
                        disabled={!inputName.trim()}
                        className="bg-accent hover:bg-accent-hover disabled:opacity-40
                                   text-white px-3 py-2 rounded-lg text-sm font-medium"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Existing people — scrollable */}
                    {people.length > 0 && (
                      <div className="max-h-[120px] overflow-y-auto">
                        <div className="flex gap-1 flex-wrap">
                          {people.map(person => (
                            <button
                              key={person.id}
                              onClick={() => handleExistingPerson(cluster.id, person.name)}
                              className="flex items-center gap-1 px-2 py-1 
                                         bg-bg-tertiary border border-border rounded-lg
                                         hover:border-accent/50 hover:bg-accent/10
                                         transition-all text-xs text-white"
                            >
                              {person.avatar && (
                                <img src={person.avatar} alt="" 
                                     className="w-4 h-4 rounded-full object-cover" />
                              )}
                              {person.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setActiveCluster(null); setInputName(''); }}
                        className="flex-1 py-1.5 rounded-lg bg-bg-tertiary text-textSecondary 
                                   hover:text-white text-xs transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleNotPerson(cluster.id)}
                        className="flex-1 py-1.5 rounded-lg bg-bg-tertiary text-textSecondary 
                                   hover:text-red-400 text-xs transition-colors"
                      >
                        Not a person
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Not active — show Name button */
                  <button
                    onClick={() => { setActiveCluster(cluster.id); setInputName(''); }}
                    className="w-full py-2 rounded-lg bg-accent/10 border border-accent/30 
                               text-accent hover:bg-accent/20 text-xs font-medium 
                               transition-colors"
                  >
                    Name this person
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Photo Viewer */}
      <AnimatePresence>
        {viewingPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setViewingPhoto(null)}
          >
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute top-4 right-4 p-2 rounded-full 
                         bg-white/10 hover:bg-white/20 transition-colors z-10"
            >
              <X size={20} className="text-white" />
            </button>

            <img
              src={getOriginalUrl(viewingPhoto)}
              alt=""
              className="max-h-full max-w-full object-contain rounded-lg"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}