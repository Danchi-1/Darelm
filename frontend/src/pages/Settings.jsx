import AppLayout from '../components/layout/AppLayout';
import { useAuthStore } from '../store/authStore';

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

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
