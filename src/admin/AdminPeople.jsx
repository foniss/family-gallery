import { useState, useEffect } from 'react';
import { Pencil, Trash2, Check, X, Image, GitMerge, Upload } from 'lucide-react';
import { fetchAllPersons, API_BASE } from '../services/api';

export default function AdminPeople({ onRefreshData }) {
  const [persons, setPersons]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [editingId, setEditingId]       = useState(null);
  const [editName, setEditName]         = useState('');
  const [mergeFrom, setMergeFrom]       = useState('');
  const [mergeTo, setMergeTo]           = useState('');
  const [mergeLoading, setMergeLoading] = useState(false);
  const [avatarPerson, setAvatarPerson] = useState(null);
  const [avatarFaces, setAvatarFaces]   = useState([]);
  const [message, setMessage]           = useState('');
  const [categories, setCategories]     = useState([]);

  const load = async () => {
    setLoading(true);
    const data = await fetchAllPersons();
    const sorted = [...data].sort((a, b) => 
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    setPersons(sorted);
    
    try {
      const res = await fetch(`${API_BASE}/api/categories`);
      const catData = await res.json();
      setCategories(catData.categories || []);
    } catch (e) {}
    
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleRename = async (personId) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/persons/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId, new_name: editName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message);
        setEditingId(null);
        await load();
        onRefreshData && onRefreshData();
      } else {
        showMessage(data.detail || 'Rename failed');
      }
    } catch (e) {
      showMessage('Rename failed');
    }
  };

  const handleDelete = async (personId, name) => {
    if (!window.confirm(`Delete "${name}"?\n\nAll face tags for this person will be removed.\nThe photos themselves will NOT be deleted.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/persons/delete?person_id=${personId}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message);
        await load();
        onRefreshData && onRefreshData();
      } else {
        showMessage(data.detail || 'Delete failed');
      }
    } catch (e) {
      showMessage('Delete failed');
    }
  };

  const handleMerge = async () => {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return;

    const keepPerson = persons.find(p => p.name === mergeTo);
    const removePerson = persons.find(p => p.name === mergeFrom);
    if (!keepPerson || !removePerson) {
      showMessage('Select two different people');
      return;
    }

    if (!window.confirm(
      `Merge "${mergeFrom}" into "${mergeTo}"?\n\n` +
      `All of ${mergeFrom}'s photos will be reassigned to ${mergeTo}.\n` +
      `${mergeFrom} will be deleted.\n\n` +
      `This cannot be undone.`
    )) return;

    setMergeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/persons/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep_id: keepPerson.id, remove_id: removePerson.id })
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message);
        setMergeFrom('');
        setMergeTo('');
        await load();
        onRefreshData && onRefreshData();
      } else {
        showMessage(data.detail || 'Merge failed');
      }
    } catch (e) {
      showMessage('Merge failed');
    } finally {
      setMergeLoading(false);
    }
  };

  const openAvatarPicker = async (person) => {
    setAvatarPerson(person);
    try {
      const res = await fetch(`${API_BASE}/api/persons/${person.id}/faces`);
      const data = await res.json();
      // Prepend API_BASE to face crop URLs
      const facesWithFullUrls = (data.faces || []).map(face => ({
        ...face,
        crop_url: face.crop_url && !face.crop_url.startsWith('http')
          ? `${API_BASE}${face.crop_url}`
          : face.crop_url
      }));
      setAvatarFaces(facesWithFullUrls);
    } catch (e) {
      setAvatarFaces([]);
    }
  };

  const setAvatar = async (faceId) => {
    try {
      const res = await fetch(`${API_BASE}/api/persons/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: avatarPerson.id, face_id: faceId })
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Avatar updated for ${avatarPerson.name}`);
        setAvatarPerson(null);
        setAvatarFaces([]);
        await load();
        onRefreshData && onRefreshData();
      } else {
        showMessage('Avatar update failed');
      }
    } catch (e) {
      showMessage('Avatar update failed');
    }
  };

  const handleCategoryChange = async (personId, personName, newCategory) => {
    try {
      await fetch(`${API_BASE}/api/persons/category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          person_id: personId, 
          category: newCategory 
        })
      });
      showMessage(`${personName} → ${newCategory}`);
      await load();
      onRefreshData && onRefreshData();
    } catch (err) {
      showMessage('Failed to update category');
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(
        `${API_BASE}/api/persons/${avatarPerson.id}/upload-avatar`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (data.success) {
        showMessage(`Avatar uploaded for ${avatarPerson.name}`);
        setAvatarPerson(null);
        setAvatarFaces([]);
        await load();
        onRefreshData && onRefreshData();
      } else {
        showMessage('Upload failed');
      }
    } catch (err) {
      showMessage('Upload failed');
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
        <h1 className="text-xl font-semibold text-white">People Manager</h1>
        <p className="text-sm text-textSecondary">{persons.length} people</p>
      </div>

      {message && (
        <div className="mx-6 mt-4 bg-accent/10 border border-accent/30 rounded-lg px-4 py-2.5
                        text-sm text-accent">
          {message}
        </div>
      )}

      <div className="p-6 space-y-8">

        <div className="bg-bg-secondary border border-border rounded-xl p-5">
          <p className="text-sm font-medium text-white mb-1 flex items-center gap-2">
            <GitMerge size={16} className="text-accent" />
            Merge Two People
          </p>
          <p className="text-xs text-textSecondary mb-4">
            All photos from the first person will be moved to the second person. 
            The first person will be deleted.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-[10px] text-textSecondary uppercase tracking-wider mb-1 block">
                Move photos from
              </label>
              <select value={mergeFrom} onChange={e => setMergeFrom(e.target.value)}
                      className="h-10 bg-bg-tertiary border border-border rounded-lg px-3 
                                 text-sm text-white min-w-[160px] focus:outline-none focus:border-accent">
                <option value="">Select person...</option>
                {persons.filter(p => p.name !== mergeTo).map(p => (
                  <option key={p.id} value={p.name}>{p.name} ({p.photo_count} photos)</option>
                ))}
              </select>
            </div>

            <span className="text-textSecondary text-lg mt-5">→</span>

            <div>
              <label className="text-[10px] text-textSecondary uppercase tracking-wider mb-1 block">
                Into this person
              </label>
              <select value={mergeTo} onChange={e => setMergeTo(e.target.value)}
                      className="h-10 bg-bg-tertiary border border-border rounded-lg px-3 
                                 text-sm text-white min-w-[160px] focus:outline-none focus:border-accent">
                <option value="">Select person...</option>
                {persons.filter(p => p.name !== mergeFrom).map(p => (
                  <option key={p.id} value={p.name}>{p.name} ({p.photo_count} photos)</option>
                ))}
              </select>
            </div>

            <button onClick={handleMerge}
                    disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo || mergeLoading}
                    className="h-10 px-6 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg 
                               font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-5">
              {mergeLoading ? 'Merging...' : 'Merge'}
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-white mb-4">All People</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {persons.map(person => (
              <div key={person.id}
                   className="bg-bg-secondary border border-border rounded-xl p-4 
                              hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 
                                  cursor-pointer hover:ring-2 hover:ring-accent transition-all
                                  bg-bg-tertiary"
                       onClick={() => openAvatarPicker(person)}
                       title="Click to change avatar">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt={person.name}
                           className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xl font-bold text-textSecondary">
                          {person.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingId === person.id ? (
                      <div className="flex items-center gap-1">
                        <input value={editName}
                               onChange={e => setEditName(e.target.value)}
                               onKeyDown={e => {
                                 if (e.key === 'Enter') handleRename(person.id);
                                 if (e.key === 'Escape') setEditingId(null);
                               }}
                               autoFocus
                               className="bg-bg-tertiary border border-accent rounded-lg 
                                          px-2 py-1.5 text-sm text-white w-full outline-none" />
                        <button onClick={() => handleRename(person.id)}
                                className="text-green-400 p-1 hover:text-green-300">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)}
                                className="text-textSecondary p-1 hover:text-white">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-white text-sm truncate">{person.name}</p>
                        <p className="text-xs text-textSecondary">{person.photo_count} photos</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <select
                    value={person.category || 'family'}
                    onChange={async (e) => {
                      const newCategory = e.target.value === '__new__' 
                        ? window.prompt('Enter new category name:')?.trim().toLowerCase()
                        : e.target.value;
                      if (!newCategory) return;
                      await handleCategoryChange(person.id, person.name, newCategory);
                    }}
                    className="w-full h-8 bg-bg-tertiary border border-border rounded-lg 
                               px-2 text-xs text-white focus:outline-none focus:border-accent
                               appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 6px center',
                    }}
                  >
                    <option value="family">👨‍👩‍👧 Family</option>
                    <option value="friends">👥 Friends</option>
                    {categories
                      .filter(c => !['family', 'friends'].includes(c.category))
                      .map(c => (
                        <option key={c.category} value={c.category}>
                          📁 {c.category} ({c.person_count})
                        </option>
                      ))
                    }
                    <option value="__new__">+ New Category...</option>
                  </select>
                </div>

                <div className="flex gap-1.5">
                  <button onClick={() => { setEditingId(person.id); setEditName(person.name); }}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg 
                                     text-[11px] bg-bg-tertiary text-textSecondary hover:text-white 
                                     transition-colors">
                    <Pencil size={11} /> Rename
                  </button>
                  <button onClick={() => openAvatarPicker(person)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg 
                                     text-[11px] bg-bg-tertiary text-textSecondary hover:text-white 
                                     transition-colors">
                    <Image size={11} /> Avatar
                  </button>
                  <button onClick={() => handleDelete(person.id, person.name)}
                          className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg 
                                     text-[11px] bg-bg-tertiary text-red-400/60 hover:text-red-400 
                                     hover:bg-red-500/10 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {persons.length === 0 && (
          <div className="text-center py-20 text-textSecondary">
            <p className="text-base mb-2 text-white/70">No people yet</p>
            <p className="text-sm">Process some photos and name the face clusters first.</p>
          </div>
        )}
      </div>

      {avatarPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
             onClick={() => { setAvatarPerson(null); setAvatarFaces([]); }}>
          <div className="bg-bg-secondary border border-border rounded-2xl p-6 max-w-lg mx-4 
                          max-h-[80vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Choose avatar for {avatarPerson.name}
              </h3>
              <button onClick={() => { setAvatarPerson(null); setAvatarFaces([]); }}
                      className="p-1.5 rounded-lg hover:bg-bg-tertiary text-textSecondary hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-textSecondary mb-4">
              Upload your own image or pick from detected faces.
            </p>

            <div className="mb-5 pb-5 border-b border-border">
              <p className="text-xs text-textSecondary mb-2 uppercase tracking-wider font-medium">
                Upload Custom Image
              </p>
              <label className="flex items-center justify-center gap-2 w-full py-3 
                                bg-bg-tertiary border-2 border-dashed border-border rounded-xl 
                                cursor-pointer hover:border-accent hover:text-accent 
                                text-textSecondary transition-colors text-sm">
                <Upload size={16} />
                Choose Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarUpload(e.target.files[0])}
                />
              </label>
              <p className="text-[10px] text-textSecondary mt-1.5">
                Any image. Auto-cropped to square and resized.
              </p>
            </div>

            <div>
              <p className="text-xs text-textSecondary mb-2 uppercase tracking-wider font-medium">
                Select From Detected Faces
              </p>
              {avatarFaces.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {avatarFaces.map(face => (
                    <button key={face.id}
                            onClick={() => setAvatar(face.id)}
                            className="aspect-square rounded-xl overflow-hidden 
                                       hover:ring-2 hover:ring-accent transition-all
                                       bg-bg-tertiary">
                      <img src={face.crop_url} alt=""
                           className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-textSecondary">
                  <p className="text-sm">No face crops available.</p>
                </div>
              )}
            </div>

            <button onClick={() => { setAvatarPerson(null); setAvatarFaces([]); }}
                    className="w-full mt-5 py-2 rounded-lg bg-bg-tertiary text-textSecondary 
                               hover:text-white text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}