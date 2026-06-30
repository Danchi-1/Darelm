import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        await api.verifyEmail(token);
        const user = await api.getCurrentUser();
        login(user);
        setStatus('success');
        setMessage('Email verified successfully');
        setTimeout(() => navigate('/dashboard'), 2000);
      } catch (error) {
        setStatus('error');
        setMessage('Verification failed. The link may have expired.');
      }
    };

    verifyToken();
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="bg-surface border border-border rounded-card p-8">
          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-signal border-t-transparent rounded-full animate-spin" />
              <h1 className="font-mono text-2xl text-ink mb-2">Verifying your email</h1>
              <p className="text-muted">Please wait while we verify your account...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-signal-dim rounded-full flex items-center justify-center">
                <span className="text-signal text-3xl">✓</span>
              </div>
              <h1 className="font-mono text-2xl text-ink mb-2">Success!</h1>
              <p className="text-muted mb-6">{message}</p>
              <p className="text-sm text-muted">Redirecting to dashboard...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-error/10 rounded-full flex items-center justify-center">
                <span className="text-error text-3xl">✕</span>
              </div>
              <h1 className="font-mono text-2xl text-ink mb-2">Verification Failed</h1>
              <p className="text-muted mb-6">{message}</p>
              <Button variant="primary" size="md" onClick={() => navigate('/login')}>
                Go to login
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
