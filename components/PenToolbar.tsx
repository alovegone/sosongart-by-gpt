import React from 'react';

interface PenToolbarProps {
  visible: boolean;
  mode: 'corner' | 'smooth';
  onModeChange: (mode: 'corner' | 'smooth') => void;
  onCorner: () => void;
  onSmooth: () => void;
  anchorPosition?: { x: number; y: number } | null;
  hasActiveAnchor: boolean;
}

const PenToolbar: React.FC<PenToolbarProps> = ({ visible, mode, onModeChange, onCorner, onSmooth, anchorPosition, hasActiveAnchor }) => {
  if (!visible) return null;

  const style: React.CSSProperties = anchorPosition
    ? { position: 'fixed', left: anchorPosition.x + 12, top: anchorPosition.y - 12 }
    : { position: 'fixed', left: 16, bottom: 96 };

  return (
    <div
      style={style}
      className="z-50 flex items-center gap-2 bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)] rounded-full px-3 py-2"
    >
      <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
        <button
          className={`px-2 py-1 text-xs rounded-full ${mode === 'corner' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          onClick={() => onModeChange('corner')}
        >
          尖角点
        </button>
        <button
          className={`px-2 py-1 text-xs rounded-full ${mode === 'smooth' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          onClick={() => onModeChange('smooth')}
        >
          平滑点
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          className={`px-2 py-1 text-xs rounded-full ${hasActiveAnchor ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}`}
          disabled={!hasActiveAnchor}
          onClick={onCorner}
        >
          转尖角
        </button>
        <button
          className={`px-2 py-1 text-xs rounded-full ${hasActiveAnchor ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}`}
          disabled={!hasActiveAnchor}
          onClick={onSmooth}
        >
          转平滑
        </button>
      </div>
    </div>
  );
};

export default PenToolbar;
