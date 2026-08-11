import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Camera, Images, AlertCircle, Users, Settings,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import AdminGallery from './AdminGallery';
import AdminPeople from './AdminPeople';
import AdminSettings from './AdminSettings';
import ReviewQueue from './ReviewQueue';
import {
  fetchPeople, fetchClusters, fetchStatsData,
  nameCluster as apiNameCluster,
} from '../services/api';

const navItems = [
  { id: 'gallery',  label: 'Gallery',       icon: Images       },
  { id: 'review',   label: 'Review Queue',  icon: AlertCircle  },
  { id: 'people',   label: 'People Manager', icon: Users        },
  { id: 'settings', label: 'Settings',      icon: Settings     },
];

export default function AdminApp() {
  const [currentPage, setCurrentPage]     = useState('gallery');
  const [people, setPeople]               = useState([]);
  const [clusters, setClusters]           = useState([]);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [loading, setLoading]             = useState(true);

  const loadData = async () => {
    try {
      const [peopleData, clusterData] = await Promise.all([
        fetchPeople(),
        fetchClusters(),
      ]);
      setPeople(peopleData);
      setClusters(clusterData);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleNameCluster = async (clusterId, name) => {
    setClusters(prev => prev.filter(c => c.id !== clusterId));
    await apiNameCluster(clusterId, name);
    loadData();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-bg-primary flex flex-col 
                      items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent 
                        rounded-full animate-spin" />
        <p className="text-textSecondary text-sm">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 220 : 64 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="h-screen bg-bg-tertiary border-r border-border 
                   flex flex-col overflow-hidden flex-shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-border h-14">
          <div className="w-8 h-8 bg-accent rounded-xl flex items-center 
                          justify-center flex-shrink-0">
            <Camera size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-white whitespace-nowrap text-sm">
              Admin Panel
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = currentPage === id;
            const showBadge = id === 'review' && clusters.length > 0;

            return (
              <button
                key={id}
                onClick={() => setCurrentPage(id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg
                            transition-all duration-200 relative group
                            ${isActive
                              ? 'bg-accent text-white'
                              : 'text-textSecondary hover:bg-bg-secondary hover:text-white'
                            }`}
              >
                <div className="relative flex-shrink-0">
                  <Icon size={18} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 
                                     bg-red-500 rounded-full text-[9px] flex 
                                     items-center justify-center text-white font-bold">
                      {clusters.length}
                    </span>
                  )}
                </div>

                {sidebarOpen && (
                  <span className="text-sm font-medium whitespace-nowrap">
                    {label}
                  </span>
                )}

                {!sidebarOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-bg-secondary 
                                  border border-border rounded text-xs text-white 
                                  whitespace-nowrap opacity-0 group-hover:opacity-100 
                                  transition-opacity pointer-events-none z-50">
                    {label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="m-2 p-2 rounded-lg border border-border text-textSecondary
                     hover:bg-bg-secondary hover:text-white transition-all 
                     flex items-center justify-center"
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </motion.aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'gallery' && (
          <AdminGallery onRefreshData={loadData} />
        )}
        {currentPage === 'review' && (
          <ReviewQueue
            clusters={clusters}
            people={people}
            onNameCluster={handleNameCluster}
          />
        )}
        {currentPage === 'people' && (
          <AdminPeople onRefreshData={loadData} />
        )}
        {currentPage === 'settings' && (
          <AdminSettings />
        )}
      </main>
    </div>
  );
}