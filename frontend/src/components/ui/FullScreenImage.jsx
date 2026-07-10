export default function FullScreenImage({ src, onClose }) {
  if (!src) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 bg-void/95 flex items-center justify-center p-4 cursor-zoom-out" 
      onClick={onClose}
    >
      <img src={src} className="max-w-full max-h-full object-contain rounded" alt="Fullscreen Chart" />
      <button 
        className="absolute top-6 right-6 text-muted hover:text-white bg-surface w-10 h-10 flex items-center justify-center rounded-full border border-border"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}
