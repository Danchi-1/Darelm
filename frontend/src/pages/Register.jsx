import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import Button from '../components/ui/Button';
import Toast from '../components/ui/Toast';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const showToastNotification = (message, type = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToastNotification('Passwords do not match', 'error');
      return;
    }
    try {
      const response = await api.register({ name, email, password });
      showToastNotification('Please check your email to verify your account', 'info');
      // Don't auto-login, wait for email verification
    } catch (error) {
      console.error('Registration failed:', error);
      showToastNotification('Registration failed', 'error');
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const response = await api.googleAuth(tokenResponse.credential);
        login(response.user, response.token);
        navigate('/dashboard');
      } catch (error) {
        console.error('Google login failed:', error);
      }
    },
    onError: () => {
      console.error('Google login failed');
    },
  });

  return (
    <div className="min-h-screen flex">
      {showToast && (
        <Toast message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
      )}
      
      {/* Left side - coordinate grid */}
      <div className="hidden md:flex w-1/2 coordinate-grid relative">
        <div className="absolute inset-0 bg-void/90 flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-mono text-4xl text-ink mb-4">Darelm</h1>
            <p className="text-muted text-sm">
              Qwen-powered data intelligence platform
            </p>
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="font-mono text-2xl text-ink mb-2">Create account</h1>
          <p className="text-muted text-sm mb-8">Start analyzing your data today</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm text-muted mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors"
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" variant="primary" size="md" className="w-full">
              Create account
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-void text-muted">or</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="md"
            className="w-full"
            onClick={() => googleLogin()}
          >
            Continue with Google
          </Button>

          <p className="text-center text-sm text-muted mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-signal hover:opacity-80 transition-opacity">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
