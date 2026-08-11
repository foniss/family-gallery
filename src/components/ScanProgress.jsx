import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CheckCircle,
  ScanLine, Brain, Users, Clock
} from 'lucide-react';
import { API_BASE } from '../services/api';

function formatETA(seconds) {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s remaining`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s remaining`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins  = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m remaining`;
}

function getStageInfo(stage) {
  switch (stage) {
    case 'scanning':
      return { icon: ScanLine, label: 'Scanning Photos', color: '#6366f1' };
    case 'detecting':
      return { icon: Brain,    label: 'Detecting Faces',  color: '#f59e0b' };
    case 'clustering':
      return { icon: Users,    label: 'Grouping Faces',   color: '#22c55e' };
    default:
      return { icon: ScanLine, label: 'Processing',       color: '#6366f1' };
  }
}

export default function ScanProgress({ onComplete }) {
  const [progress, setProgress]     = useState(null);
  const [visible, setVisible]       = useState(false);
  const [dismissed, setDismissed]   = useState(false);
  const hasCalledComplete           = useRef(false);
  const prevDataRef                 = useRef('');
  const isPolling                   = useRef(true);

  const handleComplete = useCallback(() => {
    if (!hasCalledComplete.current) {
      hasCalledComplete.current = true;
      
      fetch(`${API_BASE}/api/progress/reset`, {
        method: 'POST'
      }).catch(() => {});

      isPolling.current = false;

      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 500);
      }
    }
  }, [onComplete]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
    setProgress(null);
    isPolling.current = false;
  }, []);

  useEffect(() => {
    isPolling.current = true;

    const interval = setInterval(() => {
      if (!isPolling.current) return;

      fetch(`${API_BASE}/api/progress`)
        .then(r => r.json())
        .then(data => {
          if (!data.running && !data.complete) {
            return;
          }

          const key = `${data.running}-${data.stage}-${data.current}-${data.percent}-${data.complete}`;
          
          if (key === prevDataRef.current) return;
          prevDataRef.current = key;

          setProgress(data);

          if (data.running) {
            setVisible(true);
            setDismissed(false);
            hasCalledComplete.current = false;
            isPolling.current = true;
          }

          if (data.complete && !data.running) {
            setVisible(true);
            handleComplete();
          }
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [handleComplete]);

  if (!visible || dismissed || !progress) return null;

  const stageInfo = getStageInfo(progress.stage);
  const StageIcon = stageInfo.icon;
  const isComplete = progress.complete && !progress.running;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mx-6 mt-4 bg-bg-secondary border border-border 
                   rounded-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {isComplete ? (
              <div className="w-8 h-8 bg-green-500/20 rounded-lg 
                              flex items-center justify-center">
                <CheckCircle size={16} className="text-green-500" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: `${stageInfo.color}20` }}>
                <StageIcon 
                  size={16} 
                  className="animate-pulse"
                  style={{ color: stageInfo.color }} 
                />
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-white">
                {isComplete ? 'Processing Complete' : stageInfo.label}
              </p>
              <p className="text-xs text-textSecondary">
                {progress.message || 'Working...'}
              </p>
            </div>
          </div>

          {isComplete && (
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg hover:bg-bg-tertiary 
                         text-textSecondary hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {!isComplete && (
          <div className="px-4 pb-3">
            <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${progress.percent || 0}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full"
                style={{ background: stageInfo.color }}
              />
            </div>

            <div className="flex items-center justify-between mt-2 
                            text-xs text-textSecondary">
              <div className="flex items-center gap-4">
                <span>{progress.current} / {progress.total}</span>
                <span>{progress.percent}%</span>

                {progress.faces_found > 0 && (
                  <span>👤 {progress.faces_found} faces</span>
                )}
                {progress.auto_tagged > 0 && (
                  <span>🎯 {progress.auto_tagged} auto-tagged</span>
                )}
                {progress.errors > 0 && (
                  <span className="text-red-400">
                    ⚠️ {progress.errors} errors
                  </span>
                )}
              </div>

              {progress.eta_seconds > 0 && (
                <div className="flex items-center gap-1">
                  <Clock size={10} />
                  <span>{formatETA(progress.eta_seconds)}</span>
                </div>
              )}
            </div>

            {progress.current_file && (
              <p className="text-xs text-textSecondary/60 mt-1 truncate">
                {progress.current_file}
              </p>
            )}
          </div>
        )}

        {isComplete && (
          <div className="px-4 pb-3 flex gap-4 text-xs">
            {progress.faces_found > 0 && (
              <span className="text-textSecondary">
                👤 {progress.faces_found} faces found
              </span>
            )}
            {progress.auto_tagged > 0 && (
              <span className="text-green-400">
                🎯 {progress.auto_tagged} auto-tagged
              </span>
            )}
            {progress.clusters_found > 0 && (
              <span className="text-accent">
                👥 {progress.clusters_found} new groups
              </span>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}