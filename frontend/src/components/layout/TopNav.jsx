import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';

export default function TopNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const scrollToSection = (sectionId) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="flex items-center justify-between px-6 py-4">
      <Link to="/" className="font-mono text-xl text-ink hover:text-signal transition-colors cursor-pointer">
        Darelm
      </Link>
      
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center gap-6">
        <button
          onClick={() => scrollToSection('agents')}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          Agents
        </button>
        <button
          onClick={() => scrollToSection('how-it-works')}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          How it works
        </button>
        <button
          onClick={() => scrollToSection('qwen')}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          Docs
        </button>
        {!isAuthenticated ? (
          <>
            <Link to="/login" className="text-sm text-muted hover:text-ink transition-colors">
              Sign in
            </Link>
            <Link to="/register">
              <Button variant="primary" size="sm">
                Start for free
              </Button>
            </Link>
          </>
        ) : (
          <Link to="/dashboard">
            <Button variant="primary" size="sm">
              Go to Dashboard
            </Button>
          </Link>
        )}
      </div>

      {/* Mobile Menu Button */}
      <button
        className="md:hidden text-ink"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-surface border-b border-border md:hidden">
          <div className="flex flex-col p-6 gap-4">
            <button
              onClick={() => scrollToSection('agents')}
              className="text-sm text-ink hover:text-signal transition-colors text-left"
            >
              Agents
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-sm text-ink hover:text-signal transition-colors text-left"
            >
              How it works
            </button>
            <button
              onClick={() => scrollToSection('qwen')}
              className="text-sm text-ink hover:text-signal transition-colors text-left"
            >
              Docs
            </button>
            {!isAuthenticated ? (
              <>
                <Link
                  to="/login"
                  className="text-sm text-ink hover:text-signal transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign in
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="sm" className="w-full">
                    Start for free
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
