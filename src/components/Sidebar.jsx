import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, AlertCircle,
  Search, Settings, ChevronLeft,
  ChevronRight, Camera, Star, Tag, ImageOff
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Gallery',      icon: LayoutDashboard },
  { id: 'people',    label: 'People',        icon: Users           },
  { id: 'tags',      label: 'Tags',          icon: Tag             },
  { id: 'untagged',  label: 'Untagged',      icon: ImageOff        },
  { id: 'review',    label: 'Review Queue',  icon: AlertCircle     },
  { id: 'search',    label: 'Search',        icon: Search          },
  { id: 'settings',  label: 'Settings',      icon: Settings        },
];

export default function Sidebar({
  currentPage, setCurrentPage, people,
  clusterCount, untaggedCount, sidebarOpen, setSidebarOpen,
  setSelectedPerson
}) {
  return (
    <>
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 240 : 68 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="h-screen bg-bg-tertiary border-r border-border 
                   flex flex-col overflow-hidden flex-shrink-0 z-20"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-border h-16">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center 
                          justify-center flex-shrink-0">
            <Camera size={18} className="text-white" />
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-semibold text-white whitespace-nowrap"
              >
                Family Gallery
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = currentPage === id;
            const showBadge = id === 'review' && clusterCount > 0;

            return (
              <button
                key={id}
                onClick={() => setCurrentPage(id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200 relative group
                  ${isActive
                    ? 'bg-accent text-white'
                    : 'text-textSecondary hover:bg-bg-secondary hover:text-white'
                  }
                `}
              >
                <div className="relative flex-shrink-0">
                  <Icon size={18} />
                  {/* Review queue badge */}
                  {id === 'review' && clusterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 
                                     bg-red-500 rounded-full text-xs flex 
                                     items-center justify-center text-white font-bold">
                      {clusterCount}
                    </span>
                  )}
                  {/* Untagged badge */}
                  {id === 'untagged' && untaggedCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 
                                     bg-amber-500 rounded-full text-xs flex 
                                     items-center justify-center text-white font-bold">
                      {untaggedCount > 99 ? '99+' : untaggedCount}
                    </span>
                  )}
                </div>

                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium whitespace-nowrap flex-1 text-left"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Tooltip when collapsed */}
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

          {/* People Quick Access */}
          {sidebarOpen && people.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-4"
            >
              <p className="text-xs text-textSecondary uppercase tracking-wider 
                            px-3 mb-2 font-medium">
                People
              </p>
              {people.map(person => (
                <button
                  key={person.id}
                  onClick={() => {
                    setSelectedPerson(person.name);
                    setCurrentPage('people');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                             text-textSecondary hover:bg-bg-secondary hover:text-white
                             transition-all duration-200"
                >
                  <img
                    src={person.avatar}
                    alt={person.name}
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                  <span className="text-sm truncate">{person.name}</span>
                  <span className="text-xs text-textSecondary ml-auto">
                    {person.photoCount}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </nav>

        {/* Collapse Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="m-3 p-2 rounded-lg border border-border text-textSecondary
                     hover:bg-bg-secondary hover:text-white transition-all 
                     flex items-center justify-center"
        >
          {sidebarOpen
            ? <ChevronLeft size={16} />
            : <ChevronRight size={16} />
          }
        </button>
      </motion.aside>
    </>
  );
}