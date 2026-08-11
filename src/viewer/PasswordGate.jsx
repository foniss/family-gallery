import { useState } from 'react';
import { Lock, Camera } from 'lucide-react';

const FAMILY_PASSWORD = 'chechimechi';  // Change this!

export default function PasswordGate({ children }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [unlocked, setUnlocked] = useState(
    localStorage.getItem('family_unlocked') === 'true'
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === FAMILY_PASSWORD) {
      localStorage.setItem('family_unlocked', 'true');
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  if (unlocked) return children;

  return (
    <div className="h-screen w-screen bg-bg-primary flex items-center justify-center">
      <div className="bg-bg-secondary border border-border rounded-2xl p-8 
                      max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center 
                          justify-center mb-4">
            <Camera size={32} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-white">Family Gallery</h1>
          <p className="text-textSecondary text-sm mt-1">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 
                                         text-textSecondary" />
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(false); }}
                placeholder="Password"
                autoFocus
                className={`w-full bg-bg-tertiary border rounded-xl pl-10 pr-4 py-3 
                            text-white placeholder-textSecondary outline-none
                            transition-colors
                            ${error 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'border-border focus:border-accent'}`}
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs mt-1.5 ml-1">
                Incorrect password. Try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-hover text-white 
                       py-3 rounded-xl font-medium transition-colors"
          >
            Enter Gallery
          </button>
        </form>

        <p className="text-[10px] text-textSecondary text-center mt-6">
          Ask the family admin for the password
        </p>
      </div>
    </div>
  );
}