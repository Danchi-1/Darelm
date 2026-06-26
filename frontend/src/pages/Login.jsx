import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import Button from '../components/ui/Button';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await api.login({ email, password });
      const token = response.access_token;
      localStorage.setItem('token', token);
      const user = await api.getCurrentUser();
      login(user, token);
      navigate('/dashboard');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError(null);
    try {
      const response = await api.googleAuth(credentialResponse.credential);
      const token = response.access_token;
      localStorage.setItem('token', token);
      
      // Decode Google credential to get user info
      const decoded = jwtDecode(credentialResponse.credential);
      const user = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      };
      
      login(user, token);
      navigate('/dashboard');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleGoogleError = () => {
    setError('Google login failed');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - coordinate grid */}
      <div className="hidden md:flex w-1/2 coordinate-grid relative">
        <div className="absolute inset-0 bg-void/90 flex items-center justify-center">
          <div className="text-center">
            <Link to="/" className="font-mono text-4xl text-ink mb-4 block hover:text-signal transition-colors cursor-pointer">
              Darelm
            </Link>
            <p className="text-muted text-sm">
              Qwen-powered data intelligence platform
            </p>
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="font-mono text-2xl text-ink mb-2">Welcome back</h1>
          <p className="text-muted text-sm mb-8">Sign in to your account</p>

          {error && (
            <div className="bg-error/10 border border-error/30 rounded-card p-4 mb-6">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-muted hover:text-ink transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" variant="primary" size="md" className="w-full">
              Sign in
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

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              text="signin_with"
              width="100%"
            />
          </div>

          <p className="text-center text-sm text-muted mt-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-signal hover:opacity-80 transition-opacity">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
