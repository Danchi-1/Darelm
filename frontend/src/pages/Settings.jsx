import AppLayout from '../components/layout/AppLayout';
import { useAuthStore } from '../store/authStore';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  
  const [kaggleUsername, setKaggleUsername] = useState('');
  const [kaggleKey, setKaggleKey] = useState('');
  const [hasKaggleConfigured, setHasKaggleConfigured] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.getUserSettings();
        setHasKaggleConfigured(res.has_kaggle_configured);
      } catch (err) {
        console.error("Failed to fetch settings", err);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveKaggle = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateUserSettings({
        kaggle_username: kaggleUsername,
        kaggle_key: kaggleKey
      });
      setHasKaggleConfigured(true);
      setKaggleUsername('');
      setKaggleKey('');
      alert("Kaggle credentials saved securely.");
    } catch (err) {
      console.error(err);
      alert("Failed to save credentials.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-12 pb-20 md:pb-12 max-w-4xl mx-auto w-full">
        <h1 className="font-mono text-2xl text-ink mb-8">Settings</h1>

        <div className="max-w-2xl space-y-6">
          {/* Profile Section */}
          <div className="bg-surface border border-border rounded-card p-6">
            <h2 className="font-mono text-lg text-ink mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-2">Name</label>
                <input
                  type="text"
                  value={user?.name || ''}
                  disabled
                  className="w-full bg-surface-raised border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-surface-raised border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Kaggle API Section */}
          <div className="bg-surface border border-border rounded-card p-6">
            <h2 className="font-mono text-lg text-ink mb-2">Kaggle Integrations</h2>
            <p className="text-sm text-muted mb-4">
              Connect your Kaggle account to import datasets directly from public or private Kaggle links. 
              Your credentials are symmetrically encrypted using military-grade AES encryption before being stored in the database.
            </p>
            <div className="mb-4 text-sm text-muted bg-surface-raised p-4 rounded-md border border-border">
              <strong>How to get your Kaggle API key:</strong>
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Log in to Kaggle and go to your <strong>Account Settings</strong>.</li>
                <li>Scroll down to the <strong>API</strong> section and click <strong>Create New Token</strong>.</li>
                <li>Open the downloaded <code>kaggle.json</code> file.</li>
                <li>Copy the <code>username</code> and <code>key</code> values into the fields below.</li>
              </ol>
            </div>
            
            {hasKaggleConfigured && (
              <div className="mb-4 p-3 bg-surface-raised border border-border rounded-md flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-signal"></div>
                <span className="text-sm text-ink">Kaggle credentials are currently configured and secured.</span>
              </div>
            )}
            
            <form onSubmit={handleSaveKaggle} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-2">Kaggle Username</label>
                <input
                  type="text"
                  value={kaggleUsername}
                  onChange={(e) => setKaggleUsername(e.target.value)}
                  placeholder={hasKaggleConfigured ? "Leave blank to keep existing username" : "e.g. johndoe"}
                  className="w-full bg-surface-raised border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">Kaggle API Key</label>
                <input
                  type="password"
                  value={kaggleKey}
                  onChange={(e) => setKaggleKey(e.target.value)}
                  placeholder={hasKaggleConfigured ? "Leave blank to keep existing API key" : "Paste the key from kaggle.json"}
                  className="w-full bg-surface-raised border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="h-10 px-4 bg-signal text-void text-sm rounded-button hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Credentials"}
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="bg-surface border border-border rounded-card p-6">
            <h2 className="font-mono text-lg text-ink mb-4">Danger Zone</h2>
            <button
              onClick={logout}
              className="text-error text-sm hover:opacity-80 transition-opacity"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
