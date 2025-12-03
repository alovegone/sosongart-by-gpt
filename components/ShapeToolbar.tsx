import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CanvasNode } from '../types';
import { 
  IconX, IconImage, IconPlus, IconMinus, IconPipette, IconStroke, IconLock, IconUnlock
} from './Icons';

interface ShapeToolbarProps {
  selectedNode: CanvasNode;
  onUpdateNode: (updates: Partial<CanvasNode>) => void;
  position: { x: number; y: number };
}

// --- Reuse advanced Color Utils from TextToolbar ---

// Parse Hex (6 or 8 digits) to HSVA
const hexToHsva = (hex: string) => {
  if (!hex || hex.includes('url') || hex.includes('gradient')) return { h: 0, s: 0, v: 0, a: 1 };
  
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length === 4) hex = hex.split('').map(c => c + c).join('');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100), a };
};

// HSVA to Hex (6 or 8 digits)
const hsvaToHex = (h: number, s: number, v: number, a: number) => {
  s /= 100; v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  const alpha = Math.round(a * 255).toString(16);
  const alphaHex = alpha.length === 1 ? '0' + alpha : alpha;

  return (`#${toHex(r)}${toHex(g)}${toHex(b)}` + (a < 1 ? alphaHex : '')).toUpperCase();
};

const TabButton = ({ active, onClick, children }: { active: boolean, onClick: () => void, children?: React.ReactNode }) => (
  <button 
    onClick={onClick}
    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${active ? 'bg-white shadow-sm text-slate-900 ring-1 ring-gray-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
  >
    {children}
  </button>
);

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#EF4444', '#F97316', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7',
  '#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA', '#ADB5BD', '#6C757D', '#495057', '#343A40', '#212529',
  '#FFF5F5', '#FFE3E3', '#FFC9C9', '#FFA8A8', '#FF8787', '#FF6B6B', '#FA5252', '#F03E3E', '#E03131', '#C92A2A',
  '#FFF9DB', '#FFF3BF', '#FFEC99', '#FFD43B', '#FCC419', '#FAB005', '#F59F00', '#F08C00', '#E67700', '#D9480F',
  '#EBFBEE', '#D3F9D8', '#B2F2BB', '#8CE99A', '#69DB7C', '#51CF66', '#40C057', '#37B24D', '#2F9E44', '#2B8A3E',
  '#E3FAFC', '#C5F6FA', '#99E9F2', '#66D9E8', '#3BC9DB', '#22B8CF', '#15AABF', '#1098AD', '#0C8599', '#0B7285',
  '#F3F0FF', '#E5DBFF', '#D0BFFF', '#B197FC', '#9775FA', '#845EF7', '#7950F2', '#7048E8', '#6741D9', '#5F3DC4'
];

const PRESET_GRADIENTS = [
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)',
  'linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%)',
  'linear-gradient(135deg, #feada6 0%, #f5efef 100%)',
];

interface GradientStop {
    id: string;
    offset: number;
    color: string;
}

const RADIAL_POSITIONS = [
    { label: 'TL', value: 'top left' }, { label: 'T', value: 'top' }, { label: 'TR', value: 'top right' },
    { label: 'L', value: 'left' }, { label: 'C', value: 'center' }, { label: 'R', value: 'right' },
    { label: 'BL', value: 'bottom left' }, { label: 'B', value: 'bottom' }, { label: 'BR', value: 'bottom right' },
];

const ShapeToolbar: React.FC<ShapeToolbarProps> = ({ selectedNode, onUpdateNode, position }) => {
  const [activePopup, setActivePopup] = useState<'color' | 'stroke' | null>(null);
  const [activeFillTab, setActiveFillTab] = useState<'solid' | 'gradient' | 'image'>('solid');
  
  // Dimensions state
  const [width, setWidth] = useState(Math.round(selectedNode.width));
  const [height, setHeight] = useState(Math.round(selectedNode.height));

  // Color State
  const [hsva, setHsva] = useState({ h: 0, s: 0, v: 0, a: 1 });
  const [gradType, setGradType] = useState<'linear' | 'radial'>('linear');
  const [gradAngle, setGradAngle] = useState(90);
  const [gradPos, setGradPos] = useState('center');
  const [gradStops, setGradStops] = useState<GradientStop[]>([
      { id: '1', offset: 0, color: '#FFFFFF' }, 
      { id: '2', offset: 100, color: '#000000' }
  ]);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [showAllPresets, setShowAllPresets] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const sbRef = useRef<HTMLDivElement>(null);
  const gradientBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draggingStopRef = useRef<number | null>(null);

  // Sync Dimensions
  useEffect(() => {
      setWidth(Math.round(selectedNode.width));
      setHeight(Math.round(selectedNode.height));
  }, [selectedNode.width, selectedNode.height]);

  // Initialize Color State based on active popup/node property
  useEffect(() => {
    // Stroke Mode
    if (activePopup === 'stroke') {
        const strokeHex = selectedNode.strokeColor || '#000000';
        setHsva(hexToHsva(strokeHex));
        setActiveFillTab('solid');
        return;
    }

    // Fill Mode
    const fill = selectedNode.fillColor || selectedNode.color || '#ffffff';
    if (fill.includes('gradient')) {
        setActiveFillTab('gradient');
        // NOTE: In a real app, parse gradient string here.
    } else if (fill.includes('url')) {
        setActiveFillTab('image');
    } else {
        const parsed = hexToHsva(fill.startsWith('#') ? fill : '#ffffff');
        setHsva(prev => ({ ...parsed, h: parsed.s === 0 ? prev.h : parsed.h }));
        setActiveFillTab('solid');
    }
  }, [selectedNode.fillColor, selectedNode.color, selectedNode.strokeColor, activePopup, selectedNode.id]);

  // Sync Picker to Active Gradient Stop
  useEffect(() => {
      if (activeFillTab === 'gradient' && gradStops[activeStopIndex] && activePopup === 'color') {
          const parsed = hexToHsva(gradStops[activeStopIndex].color);
          setHsva(prev => ({ ...parsed, h: parsed.s === 0 ? prev.h : parsed.h }));
      }
  }, [activeStopIndex, activeFillTab, activePopup]);

  // --- Handlers ---

  const updateFill = (color: string) => onUpdateNode({ fillColor: color });
  
  const buildGradientString = useCallback(() => {
      const stopsStr = [...gradStops]
        .sort((a, b) => a.offset - b.offset)
        .map(s => `${s.color} ${s.offset}%`)
        .join(', ');

      if (gradType === 'linear') {
          return `linear-gradient(${gradAngle}deg, ${stopsStr})`;
      } else {
          return `radial-gradient(circle at ${gradPos}, ${stopsStr})`;
      }
  }, [gradType, gradAngle, gradPos, gradStops]);

  // Apply gradient update whenever state changes
  useEffect(() => {
      if (activeFillTab === 'gradient' && activePopup === 'color') {
          updateFill(buildGradientString());
      }
  }, [gradType, gradAngle, gradPos, gradStops]); 

  const handleColorChange = (newHsva: typeof hsva) => {
      setHsva(newHsva);
      const hex = hsvaToHex(newHsva.h, newHsva.s, newHsva.v, newHsva.a);
      
      if (activePopup === 'stroke') {
          onUpdateNode({ strokeColor: hex });
          if (!selectedNode.strokeWidth) onUpdateNode({ strokeWidth: 1 });
      } else {
          if (activeFillTab === 'solid') updateFill(hex);
          else if (activeFillTab === 'gradient') {
              const newStops = [...gradStops];
              if (newStops[activeStopIndex]) {
                  newStops[activeStopIndex] = { ...newStops[activeStopIndex], color: hex };
                  setGradStops(newStops);
              }
          }
      }
  };

  const handlePresetClick = (hexOrGradient: string) => {
      if (activePopup === 'stroke') {
          if (hexOrGradient.includes('gradient')) return;
          handleColorChange(hexToHsva(hexOrGradient));
          return;
      }

      if (hexOrGradient.includes('gradient')) {
          setActiveFillTab('gradient');
          updateFill(hexOrGradient);
          return;
      }

      handleColorChange(hexToHsva(hexOrGradient));
  };

  const handleSbChange = (e: React.PointerEvent) => {
    if (!sbRef.current) return;
    const rect = sbRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    handleColorChange({ ...hsva, s: Math.round(x * 100), v: Math.round((1 - y) * 100) });
  };

  const handleEyeDropper = async () => {
    if (!('EyeDropper' in window)) return;
    try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        handleColorChange(hexToHsva(result.sRGBHex));
    } catch (e) {
        console.log('EyeDropper cancelled');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                const url = `url('${ev.target.result}')`;
                updateFill(url);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const handleDimensionChange = (dim: 'width' | 'height', val: number) => {
      if (selectedNode.aspectRatioLocked) {
          const ratio = selectedNode.width / selectedNode.height;
          if (dim === 'width') {
              onUpdateNode({ width: val, height: val / ratio });
          } else {
              onUpdateNode({ height: val, width: val * ratio });
          }
      } else {
          onUpdateNode({ [dim]: val });
      }
  };

  // Gradient UI Handlers
  const handleBarClick = (e: React.MouseEvent) => {
      if (!gradientBarRef.current || draggingStopRef.current !== null) return;
      const rect = gradientBarRef.current.getBoundingClientRect();
      const offset = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
      const newStop = { id: Math.random().toString(), offset, color: hsvaToHex(hsva.h, hsva.s, hsva.v, hsva.a) };
      const newStops = [...gradStops, newStop];
      setGradStops(newStops);
      setActiveStopIndex(newStops.length - 1);
  };

  const removeStop = () => {
      if (gradStops.length <= 2) return;
      const newStops = gradStops.filter((_, i) => i !== activeStopIndex);
      setGradStops(newStops);
      setActiveStopIndex(Math.max(0, activeStopIndex - 1));
  };

  // Global event listeners for dragging gradient stops & popup closing
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePopup(null);
      }
    };
    
    const handleGlobalUp = () => {
        draggingStopRef.current = null;
    };

    const handleGlobalMove = (e: MouseEvent) => {
        if (draggingStopRef.current !== null && gradientBarRef.current) {
            const rect = gradientBarRef.current.getBoundingClientRect();
            let newOffset = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            setGradStops(prev => {
                const newStops = [...prev];
                if (newStops[draggingStopRef.current!]) {
                    newStops[draggingStopRef.current!] = { ...newStops[draggingStopRef.current!], offset: Math.round(newOffset) };
                }
                return newStops;
            });
        }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('mouseup', handleGlobalUp);
    document.addEventListener('mousemove', handleGlobalMove);
    return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('mouseup', handleGlobalUp);
        document.removeEventListener('mousemove', handleGlobalMove);
    };
  }, []);

  const hexColor = hsvaToHex(hsva.h, hsva.s, hsva.v, 1);
  const fullHexColor = hsvaToHex(hsva.h, hsva.s, hsva.v, hsva.a);

  return (
    <div 
        ref={toolbarRef}
        onPointerDown={e => e.stopPropagation()}
        className="fixed z-50 flex items-center gap-2 p-1.5 bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-gray-100 select-none"
        style={{ left: position.x, top: position.y - 60 }}
    >
        {/* Fill Color */}
        <button onClick={() => setActivePopup(activePopup === 'color' ? null : 'color')} className="w-8 h-8 rounded hover:bg-slate-100 flex items-center justify-center relative" title="Fill">
            <div className="w-5 h-5 rounded-md border border-gray-200 shadow-sm" style={{ background: selectedNode.fillColor || selectedNode.color || '#fff', backgroundSize: 'cover' }} />
        </button>

        {/* Stroke Color */}
        <button onClick={() => setActivePopup(activePopup === 'stroke' ? null : 'stroke')} className={`w-8 h-8 rounded hover:bg-slate-100 flex items-center justify-center ${activePopup === 'stroke' ? 'bg-slate-100' : ''}`} title="Stroke">
            <div className="w-5 h-5 rounded-md border-2 bg-transparent" style={{ borderColor: selectedNode.strokeColor || '#ccc' }} />
        </button>

        <div className="w-px h-5 bg-gray-200 mx-1"></div>

        {/* Dimensions */}
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-50 border border-gray-200 rounded px-2 py-1 focus-within:ring-1 focus-within:ring-indigo-500">
                <span className="text-[10px] text-slate-400 mr-1">W</span>
                <input 
                    type="number" 
                    value={width} 
                    onChange={(e) => { const v = parseInt(e.target.value); setWidth(v); handleDimensionChange('width', v); }}
                    className="w-10 bg-transparent text-xs outline-none text-slate-700" 
                />
            </div>
            <button 
                onClick={() => onUpdateNode({ aspectRatioLocked: !selectedNode.aspectRatioLocked })}
                className={`p-1 rounded hover:bg-slate-100 ${selectedNode.aspectRatioLocked ? 'text-indigo-600' : 'text-slate-400'}`}
                title={selectedNode.aspectRatioLocked ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
            >
                {selectedNode.aspectRatioLocked ? <IconLock className="w-3 h-3"/> : <IconUnlock className="w-3 h-3"/>}
            </button>
            <div className="flex items-center bg-slate-50 border border-gray-200 rounded px-2 py-1 focus-within:ring-1 focus-within:ring-indigo-500">
                <span className="text-[10px] text-slate-400 mr-1">H</span>
                <input 
                    type="number" 
                    value={height} 
                    onChange={(e) => { const v = parseInt(e.target.value); setHeight(v); handleDimensionChange('height', v); }}
                    className="w-10 bg-transparent text-xs outline-none text-slate-700" 
                />
            </div>
        </div>

        {/* POPUPS */}
        {(activePopup === 'color' || activePopup === 'stroke') && (
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-[320px] z-50">
                <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-slate-800">{activePopup === 'color' ? '填充 (Fill)' : '描边 (Stroke)'}</span>
                    <button onClick={() => setActivePopup(null)} className="text-slate-400 hover:text-slate-600"><IconX className="w-4 h-4"/></button>
                </div>

                {/* Stroke Width Control */}
                {activePopup === 'stroke' && (
                    <div className="mb-4 flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-gray-100">
                        <span className="text-xs text-slate-500 whitespace-nowrap w-16">粗细 (Width)</span>
                        <input 
                            type="range" min="0" max="20" step="0.5" 
                            value={selectedNode.strokeWidth || 0}
                            onChange={(e) => onUpdateNode({ strokeWidth: parseFloat(e.target.value) })}
                            className="flex-1 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="w-14 flex items-center bg-white border border-gray-200 rounded px-1 focus-within:ring-1 focus-within:ring-indigo-500">
                            <input 
                                type="number" 
                                min="0" max="20" step="0.5"
                                value={selectedNode.strokeWidth || 0}
                                onChange={(e) => onUpdateNode({ strokeWidth: parseFloat(e.target.value) || 0 })}
                                onPointerDown={(e) => e.stopPropagation()} 
                                className="w-full bg-transparent text-xs outline-none text-center py-1 text-slate-700 font-medium"
                            />
                            <span className="text-[10px] text-slate-400 mr-1">px</span>
                        </div>
                    </div>
                )}

                {/* Tab Switcher (Fill Mode) */}
                {activePopup === 'color' && (
                    <div className="bg-slate-100 p-1 rounded-lg flex mb-4">
                        <TabButton active={activeFillTab === 'solid'} onClick={() => setActiveFillTab('solid')}>纯色</TabButton>
                        <TabButton active={activeFillTab === 'gradient'} onClick={() => setActiveFillTab('gradient')}>渐变</TabButton>
                        <TabButton active={activeFillTab === 'image'} onClick={() => setActiveFillTab('image')}>图片</TabButton>
                    </div>
                )}

                {/* GRADIENT EDITOR UI */}
                {activePopup === 'color' && activeFillTab === 'gradient' && (
                    <div className="flex flex-col gap-3 mb-4">
                        <div className="flex gap-2">
                            <button onClick={() => setGradType('linear')} className={`flex-1 py-1 text-xs rounded border transition-colors ${gradType === 'linear' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'border-gray-200 text-slate-600 hover:bg-slate-50'}`}>线性 (Linear)</button>
                            <button onClick={() => setGradType('radial')} className={`flex-1 py-1 text-xs rounded border transition-colors ${gradType === 'radial' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'border-gray-200 text-slate-600 hover:bg-slate-50'}`}>径向 (Radial)</button>
                        </div>

                        <div className="h-8 flex items-center gap-2 select-none">
                            <div 
                                ref={gradientBarRef}
                                className="relative flex-1 h-4 rounded-full shadow-inner border border-gray-200 cursor-crosshair" 
                                style={{ background: `linear-gradient(to right, ${[...gradStops].sort((a,b) => a.offset - b.offset).map(s => `${s.color} ${s.offset}%`).join(', ')})` }}
                                onClick={handleBarClick}
                            >
                                {gradStops.map((stop, idx) => (
                                    <div 
                                        key={stop.id}
                                        onMouseDown={(e) => { e.stopPropagation(); setActiveStopIndex(idx); draggingStopRef.current = idx; }}
                                        className={`absolute w-4 h-4 rounded-full border-2 cursor-grab shadow-sm transform -translate-x-1/2 top-0 ${activeStopIndex === idx ? 'border-indigo-600 scale-125 z-10' : 'border-white z-0'}`}
                                        style={{ left: `${stop.offset}%`, backgroundColor: stop.color }}
                                    />
                                ))}
                            </div>
                            <button onClick={removeStop} className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30" disabled={gradStops.length <= 2} title="Remove Stop"><IconMinus className="w-3 h-3"/></button>
                        </div>

                        {gradType === 'linear' && (
                             <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 w-8">旋转</span>
                                <input type="range" min="0" max="360" value={gradAngle} onChange={(e) => setGradAngle(parseInt(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                <span className="text-xs text-slate-500 w-8 text-right font-medium">{gradAngle}°</span>
                            </div>
                        )}

                        {gradType === 'radial' && (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-slate-500">位置 (Position)</span>
                                <div className="grid grid-cols-3 gap-1 w-24 mx-auto">
                                    {RADIAL_POSITIONS.map(pos => (
                                        <button key={pos.value} onClick={() => setGradPos(pos.value)} className={`w-full aspect-square rounded text-[9px] border flex items-center justify-center ${gradPos === pos.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-slate-400 hover:bg-slate-50'}`}>{pos.label}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* COLOR PICKER & PRESETS */}
                {activeFillTab !== 'image' && (
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-500">{activeFillTab === 'gradient' && activePopup === 'color' ? `Color Stop ${activeStopIndex + 1}` : '颜色 (Color)'}</span>
                        </div>

                        <div ref={sbRef} className="w-full h-32 rounded-lg cursor-crosshair relative shadow-inner ring-1 ring-black/5" style={{ backgroundColor: `hsl(${hsva.h}, 100%, 50%)` }} onPointerDown={handleSbChange} onPointerMove={(e) => e.buttons === 1 && handleSbChange(e)}>
                            <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                            <div className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${hsva.s}%`, top: `${100 - hsva.v}%`, backgroundColor: hexColor }} />
                        </div>

                        <div className="flex items-center gap-3">
                            {('EyeDropper' in window) && (<button onClick={handleEyeDropper} className="text-slate-500 hover:text-slate-800"><IconPipette className="w-4 h-4" /></button>)}
                            <div className="flex-1 flex flex-col gap-2">
                                <input type="range" min="0" max="360" step="1" value={hsva.h} onChange={(e) => handleColorChange({ ...hsva, h: parseInt(e.target.value) })} className="w-full h-3 rounded-full cursor-pointer appearance-none" style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }} />
                                <div className="w-full h-3 relative rounded-full ring-1 ring-black/5">
                                    <div className="absolute inset-0 rounded-full overflow-hidden" style={{ backgroundImage: "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhYWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')" }}>
                                        <div className="absolute inset-0" style={{ background: `linear-gradient(to right, transparent, ${hexColor})` }} />
                                    </div>
                                    <input type="range" min="0" max="100" step="1" value={Math.round(hsva.a * 100)} onChange={(e) => handleColorChange({ ...hsva, a: parseInt(e.target.value) / 100 })} className="absolute inset-0 w-full h-full cursor-pointer appearance-none bg-transparent" style={{ zIndex: 10 }} />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 items-center">
                            <div className="flex-1 flex items-center bg-slate-50 border border-gray-200 rounded px-2 py-1.5 focus-within:ring-1 focus-within:ring-indigo-500">
                                <span className="text-slate-400 text-xs mr-2 select-none">#</span>
                                <input value={fullHexColor.replace('#', '')} onChange={(e) => { const newHex = '#' + e.target.value; if (/^#[0-9A-F]{6}([0-9A-F]{2})?$/i.test(newHex)) handlePresetClick(newHex); }} className="w-full bg-transparent text-sm font-medium outline-none text-slate-700 uppercase" />
                            </div>
                            <div className="flex items-center bg-slate-50 border border-gray-200 rounded px-2 py-1.5 w-20">
                                <input type="number" min="0" max="100" value={Math.round(hsva.a * 100)} onChange={(e) => handleColorChange({ ...hsva, a: parseInt(e.target.value) / 100 })} className="w-full bg-transparent text-sm font-medium outline-none text-slate-700 text-right pr-1" />
                                <span className="text-slate-400 text-xs select-none">%</span>
                            </div>
                        </div>

                        <hr className="border-gray-100 my-1"/>

                        <div>
                             <div className="flex justify-between mb-2 items-center">
                                <span className="text-xs text-slate-400">预设 (Presets)</span>
                                {activeFillTab === 'solid' && activePopup !== 'stroke' && (
                                    <button onClick={() => setShowAllPresets(!showAllPresets)} className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">{showAllPresets ? '收起' : '更多'}</button>
                                )}
                             </div>
                             {activeFillTab === 'gradient' && activePopup === 'color' && (
                                <div className="grid grid-cols-6 gap-1.5 mb-3">
                                    {PRESET_GRADIENTS.map((g, i) => <button key={i} onClick={() => handlePresetClick(g)} className="w-full aspect-square rounded border border-gray-100 shadow-sm hover:scale-105 transition-transform ring-1 ring-black/5" style={{ background: g }} title="Gradient Preset" />)}
                                </div>
                             )}
                             {(activeFillTab === 'solid' || activePopup === 'stroke') && (
                                <div className={`grid grid-cols-10 gap-1.5 p-1 transition-all ${showAllPresets && activePopup !== 'stroke' ? 'max-h-[160px] overflow-y-auto custom-scrollbar' : ''}`}>
                                    {(showAllPresets && activePopup !== 'stroke' ? PRESET_COLORS : PRESET_COLORS.slice(0, 8)).map((c, i) => <button key={i} onClick={() => handlePresetClick(c)} className="w-7 h-7 rounded-full border border-gray-100 shadow-sm hover:scale-110 transition-transform hover:shadow-md ring-1 ring-black/5 shrink-0" style={{ background: c }} title={c} />)}
                                </div>
                             )}
                        </div>
                    </div>
                )}

                {/* Image Upload UI */}
                {activeFillTab === 'image' && activePopup === 'color' && (
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-lg bg-slate-50 gap-3">
                        <IconImage className="w-8 h-8 text-slate-300" />
                        <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-gray-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">Upload Image</button>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        <p className="text-xs text-slate-400">Supports PNG, JPG, WEBP</p>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default ShapeToolbar;