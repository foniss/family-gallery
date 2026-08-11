import { useState, useEffect } from 'react';
import {
  RefreshCw, Database, Folder, Cpu,
  Save, HardDrive, Users, Image,
  GitBranch, Info
} from 'lucide-react';
import ScanProgress from '../components/ScanProgress';
import { API_BASE } from '../services/api';

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: `${color}20` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div>
          <p className="text-lg font-bold text-white">{value}</p>
          <p className="text-[10px] text-textSecondary">{label}</p>
        </div>
      </div>
    </div>
  );
}

function FolderRow({ name, info }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm text-white capitalize">{name}</p>
        <p className="text-[10px] text-textSecondary truncate max-w-[300px]" title={info.path}>
          {info.path}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm text-white">{info.size_display}</p>
        <p className="text-[10px] text-textSecondary">{info.file_count} files</p>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [stats, setStats]       = useState(null);
  const [config, setConfig]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState('');
  const [taskRunning, setTaskRunning] = useState(false);

  const [faceConfidence, setFaceConfidence]     = useState(0.5);
  const [faceMatch, setFaceMatch]               = useState(0.45);
  const [clusterMinSamples, setClusterMinSamples] = useState(3);
  const [minFaceSize, setMinFaceSize]           = useState(80);
  const [thumbnailQuality, setThumbnailQuality] = useState(88);

  const loadData = async () => {
    try {
      const [statsRes, configRes] = await Promise.all([
        fetch(`${API_BASE}/api/settings/stats`).then(r => r.json()),
        fetch(`${API_BASE}/api/settings/config`).then(r => r.json()),
      ]);
      setStats(statsRes);
      setConfig(configRes);
      setFaceConfidence(configRes.face_confidence);
      setFaceMatch(configRes.face_match);
      setClusterMinSamples(configRes.cluster_min_samples);
      setMinFaceSize(configRes.min_face_size);
      setThumbnailQuality(configRes.thumbnail_quality);
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const params = new URLSearchParams({
        face_confidence: faceConfidence,
        face_match: faceMatch,
        cluster_min_samples: clusterMinSamples,
        min_face_size: minFaceSize,
        thumbnail_quality: thumbnailQuality,
      });
      const res = await fetch(
        `${API_BASE}/api/settings/config?${params.toString()}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        showMessage('Settings saved! Changes apply to future scans.');
      } else {
        showMessage('Save failed');
      }
    } catch (e) {
      showMessage('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const runTask = async (endpoint, name) => {
    setTaskRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/${endpoint}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message);
      } else {
        showMessage(data.message || `${name} failed`);
      }
    } catch (e) {
      showMessage(`${name} failed`);
    } finally {
      setTaskRunning(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-bg-primary/90 backdrop-blur-md border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold text-white">Settings</h1>
      </div>

      {message && (
        <div className="mx-6 mt-4 bg-accent/10 border border-accent/30 rounded-lg px-4 py-2.5 text-sm text-accent">
          {message}
        </div>
      )}

      <div className="px-6">
        <ScanProgress onComplete={loadData} />
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">

        <section>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Database size={16} className="text-accent" />
            Database Stats
          </h2>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Photos" value={stats.total_photos} icon={Image} color="#6366f1" />
              <StatCard label="With Faces" value={stats.photos_with_faces} icon={Users} color="#22c55e" />
              <StatCard label="Misc (No Faces)" value={stats.misc_photos} icon={Image} color="#f59e0b" />
              <StatCard label="People" value={stats.total_people} icon={Users} color="#6366f1" />
              <StatCard label="Faces Detected" value={stats.total_faces} icon={Users} color="#22c55e" />
              <StatCard label="Pending Review" value={stats.pending_clusters} icon={GitBranch} color="#ef4444" />
              <StatCard label="Untagged Faces" value={stats.untagged_photos} icon={Users} color="#f59e0b" />
              <StatCard label="No Person Tag" value={stats.notag_photos} icon={Users} color="#ef4444" />
              <StatCard label="Custom Tags" value={stats.custom_tags} icon={Database} color="#6366f1" />
              <StatCard label="Batches" value={stats.batches} icon={Folder} color="#22c55e" />
            </div>
          )}

          {stats?.disk && (
            <div className="mt-3 bg-bg-secondary border border-border rounded-xl p-4">
              <p className="text-xs text-textSecondary mb-2">Disk Space</p>
              <div className="flex gap-6 text-sm">
                <span className="text-textSecondary">Total: <span className="text-white">{stats.disk.total}</span></span>
                <span className="text-textSecondary">Used: <span className="text-white">{stats.disk.used}</span></span>
                <span className="text-textSecondary">Free: <span className="text-white">{stats.disk.free}</span></span>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <RefreshCw size={16} className="text-accent" />
            Processing Tools
          </h2>
          <div className="bg-bg-secondary border border-border rounded-xl divide-y divide-border">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-white">Rebuild Thumbnails</p>
                <p className="text-xs text-textSecondary">Regenerate all preview images with current quality settings</p>
              </div>
              <button onClick={() => runTask('rebuild-thumbnails', 'Rebuild')} disabled={taskRunning}
                      className="text-sm bg-bg-tertiary border border-border text-white px-4 py-2 rounded-lg 
                                 hover:bg-border transition-colors disabled:opacity-40">
                Rebuild
              </button>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-white">Rerun Clustering</p>
                <p className="text-xs text-textSecondary">Regroup all unassigned faces into clusters</p>
              </div>
              <button onClick={() => runTask('rerun-clustering', 'Clustering')} disabled={taskRunning}
                      className="text-sm bg-bg-tertiary border border-border text-white px-4 py-2 rounded-lg 
                                 hover:bg-border transition-colors disabled:opacity-40">
                Rerun
              </button>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-white">Fix Photo Counts</p>
                <p className="text-xs text-textSecondary">Recalculate photo counts for all people</p>
              </div>
              <button onClick={() => runTask('fix-counts', 'Fix counts')} disabled={taskRunning}
                      className="text-sm bg-bg-tertiary border border-border text-white px-4 py-2 rounded-lg 
                                 hover:bg-border transition-colors disabled:opacity-40">
                Fix
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Cpu size={16} className="text-accent" />
            AI Settings
          </h2>
          <div className="bg-bg-secondary border border-border rounded-xl p-5 space-y-5">

            <p className="text-xs text-textSecondary bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
              Changes only affect future scans. To apply to existing photos, rerun detection or clustering.
            </p>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-white">Face Detection Confidence</label>
                <span className="text-sm text-accent font-mono">{faceConfidence.toFixed(2)}</span>
              </div>
              <input type="range" min="10" max="90" value={Math.round(faceConfidence * 100)}
                     onChange={e => setFaceConfidence(parseInt(e.target.value) / 100)}
                     className="w-full accent-indigo-500" />
              <div className="flex justify-between text-[10px] text-textSecondary mt-1">
                <span>More faces (less accurate)</span>
                <span>Fewer faces (more accurate)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-white">Face Match Threshold</label>
                <span className="text-sm text-accent font-mono">{faceMatch.toFixed(2)}</span>
              </div>
              <input type="range" min="20" max="80" value={Math.round(faceMatch * 100)}
                     onChange={e => setFaceMatch(parseInt(e.target.value) / 100)}
                     className="w-full accent-indigo-500" />
              <div className="flex justify-between text-[10px] text-textSecondary mt-1">
                <span>More auto-matches</span>
                <span>Stricter matching</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-white">Min Photos To Form Cluster</label>
                <span className="text-sm text-accent font-mono">{clusterMinSamples}</span>
              </div>
              <input type="range" min="2" max="10" value={clusterMinSamples}
                     onChange={e => setClusterMinSamples(parseInt(e.target.value))}
                     className="w-full accent-indigo-500" />
              <div className="flex justify-between text-[10px] text-textSecondary mt-1">
                <span>2 (more clusters)</span>
                <span>10 (fewer clusters)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-white">Minimum Face Size (pixels)</label>
                <span className="text-sm text-accent font-mono">{minFaceSize}px</span>
              </div>
              <input type="range" min="30" max="200" step="10" value={minFaceSize}
                     onChange={e => setMinFaceSize(parseInt(e.target.value))}
                     className="w-full accent-indigo-500" />
              <div className="flex justify-between text-[10px] text-textSecondary mt-1">
                <span>30px (detect tiny faces)</span>
                <span>200px (only big faces)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-white">Thumbnail Quality</label>
                <span className="text-sm text-accent font-mono">{thumbnailQuality}%</span>
              </div>
              <input type="range" min="50" max="100" value={thumbnailQuality}
                     onChange={e => setThumbnailQuality(parseInt(e.target.value))}
                     className="w-full accent-indigo-500" />
              <div className="flex justify-between text-[10px] text-textSecondary mt-1">
                <span>50% (smaller files)</span>
                <span>100% (best quality)</span>
              </div>
            </div>

            <button onClick={saveConfig} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover 
                               text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <HardDrive size={16} className="text-accent" />
            Storage
          </h2>
          {stats?.folders && (
            <div className="bg-bg-secondary border border-border rounded-xl px-4">
              {Object.entries(stats.folders).map(([name, info]) => (
                <FolderRow key={name} name={name} info={info} />
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center gap-2 text-xs text-textSecondary justify-center pb-6">
          <Info size={12} />
          Family Gallery v2.0 — Local, private, yours
        </div>
      </div>
    </div>
  );
}