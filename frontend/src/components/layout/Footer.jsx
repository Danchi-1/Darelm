import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="px-6 py-12 border-t border-border">
      <div className="max-w-6xl mx-auto flex justify-between">
        <div>
          <h2 className="font-mono text-xl text-ink mb-2">Darelm</h2>
          <p className="text-sm text-muted">
            Qwen-powered data intelligence platform
          </p>
        </div>
        <div className="flex gap-8">
          <Link to="/docs" className="text-sm text-muted hover:text-ink transition-colors">
            Documentation
          </Link>
          <Link to="/privacy" className="text-sm text-muted hover:text-ink transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="text-sm text-muted hover:text-ink transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
