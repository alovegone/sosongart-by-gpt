import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CanvasNode } from '../types';
import { 
  IconChevronDown, IconDotsHorizontal, IconX, 
  IconAlignLeft, IconAlignCenter, IconAlignRight, IconAlignJustify,
  IconUnderline, IconStrikethrough, IconImage, IconPlus, IconMinus, IconPipette,
  IconStroke
} from './Icons';
import { FONTS, FONT_WEIGHTS, FONT_SIZES } from '../constants';

interface TextToolbarProps {
  selectedNode: CanvasNode;
  onUpdateNode: (updates: Partial<CanvasNode>) => void;
  position: { x: number; y: number };
}

// --- Enhanced Color Utils with Alpha Support ---

// Parse Hex (6 or 8 digits) to HSVA
const hexToHsva = (hex: string) => {
  if (!hex || hex.includes('url') || hex.includes('gradient')) return { h: 0, s: 0, v: 0, a: 1 };
  
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length === 4) hex = hex.split('').map(c => c + c).join(''); // short alpha like #F008
  
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
  s /= 100;
  v /= 100;
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

  // Use 8 digit hex if alpha < 1
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
  // Top 8 Popular (Default View)
  '#000000', '#FFFFFF', '#EF4444', '#F97316', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7',
  
  // Extended Palette
  // Grayscale
  '#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA', '#ADB5BD', '#6C757D', '#495057', '#343A40', '#212529',
  // Reds/Pinks
  '#FFF5F5', '#FFE3E3', '#FFC9C9', '#FFA8A8', '#FF8787', '#FF6B6B', '#FA5252', '#F03E3E', '#E03131', '#C92A2A',
  // Oranges/Yellows
  '#FFF9DB', '#FFF3BF', '#FFEC99', '#FFD43B', '#FCC419', '#FAB005', '#F59F00', '#F08C00', '#E67700', '#D9480F',
  // Greens
  '#EBFBEE', '#D3F9D8', '#B2F2BB', '#8CE99A', '#69DB7C', '#51CF66', '#40C057', '#37B24D', '#2F9E44', '#2B8A3E',
  // Cyans/Blues
  '#E3FAFC', '#C5F6FA', '#99E9F2', '#66D9E8', '#3BC9DB', '#22B8CF', '#15AABF', '#1098AD', '#0C8599', '#0B7285',
  // Indigos/Violets
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
    offset: number; // 0 to 100
    color: string;
}

const RADIAL_POSITIONS = [
    { label: 'TL', value: 'top left' }, { label: 'T', value: 'top' }, { label: 'TR', value: 'top right' },
    { label: 'L', value: 'left' }, { label: 'C', value: 'center' }, { label: 'R', value: 'right' },
    { label: 'BL', value: 'bottom left' }, { label: 'B', value: 'bottom' }, { label: 'BR', value: 'bottom right' },
];

const TextToolbar: React.FC<TextToolbarProps> = ({ selectedNode, onUpdateNode, position }) => {
  const [activePopup, setActivePopup] = useState<'font' | 'weight' | 'size' | 'color' | 'stroke' | 'advanced' | null>(null);
  const [activeFillTab, setActiveFillTab] = useState<'solid' | 'gradient' | 'image'>('solid');
  
  // Custom Color Picker State (HSVA)
  const [hsva, setHsva] = useState({ h: 0, s: 0, v: 0, a: 1 });
  
  // Gradient State
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

  // Initialize state based on active popup/node property
  useEffect(() => {
    // If Stroke Popup is active, initialize with stroke color
    if (activePopup === 'stroke') {
        const strokeHex = selectedNode.strokeColor || '#000000';
        setHsva(hexToHsva(strokeHex));
        setActiveFillTab('solid'); // Strokes are solid by default/convention here
        return;
    }

    // Default: Initialize from Fill Color
    if (!selectedNode.fillColor) return;
    
    if (selectedNode.fillColor.includes('gradient')) {
        setActiveFillTab('gradient');
    } else if (selectedNode.fillColor.includes('url')) {
        setActiveFillTab('image');
    } else {
        const parsedHsva = hexToHsva(selectedNode.fillColor.startsWith('#') ? selectedNode.fillColor : '#000000');
        // FIX: Preserve existing Hue if the new color is grayscale (S=0).
        setHsva(prev => ({
            ...parsedHsva,
            h: parsedHsva.s === 0 ? prev.h : parsedHsva.h
        }));
        setActiveFillTab('solid');
    }
  }, [selectedNode.fillColor, selectedNode.strokeColor, selectedNode.id, activePopup]);

  // Sync Color Picker to Active Gradient Stop
  useEffect(() => {
      if (activeFillTab === 'gradient' && gradStops[activeStopIndex] && activePopup === 'color') {
          const parsedHsva = hexToHsva(gradStops[activeStopIndex].color);
          setHsva(prev => ({
              ...parsedHsva,
              h: parsedHsva.s === 0 ? prev.h : parsedHsva.h
          }));
      }
  }, [activeStopIndex, activeFillTab, activePopup]); 

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
            let newOffset = ((e.clientX - rect.left) / rect.width) * 100;
            newOffset = Math.max(0, Math.min(100, newOffset));
            
            setGradStops(prev => {
                const newStops = [...prev];
                if (newStops[draggingStopRef.current!] ) {
                    newStops[draggingStopRef.current!] = { 
                        ...newStops[draggingStopRef.current!], 
                        offset: Math.round(newOffset) 
                    };
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

  const handlePointerDown = (e: React.PointerEvent) => e.stopPropagation();

  // --- Logic ---

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

  const updateNodeColor = (colorStr: string) => {
      onUpdateNode({ fillColor: colorStr });
  };

  const handleColorChange = (newHsva: typeof hsva) => {
      setHsva(newHsva);
      const hex = hsvaToHex(newHsva.h, newHsva.s, newHsva.v, newHsva.a);
      
      if (activePopup === 'stroke') {
          onUpdateNode({ strokeColor: hex });
          if (!selectedNode.strokeWidth) onUpdateNode({ strokeWidth: 1 }); // Ensure stroke is visible
      } else {
          // Fill Mode
          if (activeFillTab === 'solid') {
              updateNodeColor(hex);
          } else if (activeFillTab === 'gradient') {
              const newStops = [...gradStops];
              if (newStops[activeStopIndex]) {
                  newStops[activeStopIndex] = { ...newStops[activeStopIndex], color: hex };
                  setGradStops(newStops);
              }
          }
      }
  };

  const handlePresetClick = (hexOrGradient: string) => {
      // Stroke Mode: Simple solid color only
      if (activePopup === 'stroke') {
          if (hexOrGradient.includes('gradient')) return; // Ignore gradients for stroke
          const newHsva = hexToHsva(hexOrGradient);
          handleColorChange(newHsva);
          return;
      }

      // Fill Mode
      if (hexOrGradient.includes('gradient')) {
          setActiveFillTab('gradient');
          updateNodeColor(hexOrGradient);
          return;
      }

      // Hex Color
      const newHsva = hexToHsva(hexOrGradient);
      handleColorChange(newHsva);
  };

  const handleSbChange = (e: React.PointerEvent) => {
    if (!sbRef.current) return;
    const rect = sbRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newHsva = { ...hsva, s: Math.round(x * 100), v: Math.round((1 - y) * 100) };
    handleColorChange(newHsva);
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
                updateNodeColor(url);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  // Gradient Handlers
  const handleBarClick = (e: React.MouseEvent) => {
      if (!gradientBarRef.current) return;
      if (draggingStopRef.current !== null) return;
      
      const rect = gradientBarRef.current.getBoundingClientRect();
      const offset = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      const safeOffset = Math.max(0, Math.min(100, offset));
      
      const newStop = { id: Math.random().toString(), offset: safeOffset, color: hsvaToHex(hsva.h, hsva.s, hsva.v, hsva.a) };
      
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

  // Apply gradient update whenever state changes
  useEffect(() => {
      if (activeFillTab === 'gradient' && activePopup === 'color') {
          updateNodeColor(buildGradientString());
      }
  }, [gradType, gradAngle, gradPos, gradStops]); // eslint-disable-line

  const hexColor = hsvaToHex(hsva.h, hsva.s, hsva.v, 1); // No alpha for preview
  const fullHexColor = hsvaToHex(hsva.h, hsva.s, hsva.v, hsva.a);

  return (
    <div 
      ref={toolbarRef}
      onPointerDown={handlePointerDown}
      className="fixed z-50 flex flex-col items-start gap-2"
      style={{ left: position.x, top: position.y - 60 }}
    >
      {/* TOOLBAR BUTTONS */}
      <div className="flex items-center gap-1 p-1 bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-gray-100 select-none relative">
        
        {/* Fill */}
        <div className="relative">
            <button 
            onClick={() => setActivePopup(activePopup === 'color' ? null : 'color')}
            className="w-8 h-8 rounded hover:bg-slate-100 flex items-center justify-center"
            title="Fill Color"
            >
                <div 
                    className="w-5 h-5 rounded-full border border-gray-200 shadow-sm" 
                    style={{ 
                        background: selectedNode.fillColor || '#000', 
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }} 
                />
            </button>
        </div>

        {/* Stroke */}
        <div className="relative">
            <button 
                onClick={() => setActivePopup(activePopup === 'stroke' ? null : 'stroke')}
                className={`w-8 h-8 rounded hover:bg-slate-100 flex items-center justify-center ${activePopup === 'stroke' ? 'bg-slate-100' : ''}`}
                title="Stroke Color & Width"
            >
                <div 
                    className="w-5 h-5 rounded-full border-2 bg-transparent" 
                    style={{ borderColor: selectedNode.strokeColor || '#ccc' }} 
                />
            </button>

             {/* POPUP FOR COLOR & STROKE */}
            {(activePopup === 'color' || activePopup === 'stroke') && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-[320px] z-50">
                <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-slate-800">
                        {activePopup === 'color' ? '填充 (Fill)' : '描边 (Stroke)'}
                    </span>
                    <button onClick={() => setActivePopup(null)} className="text-slate-400 hover:text-slate-600"><IconX className="w-4 h-4"/></button>
                </div>
                
                {/* Stroke Width Control (Only visible in Stroke Mode) */}
                {activePopup === 'stroke' && (
                    <div className="mb-4 flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-gray-100">
                        <span className="text-xs text-slate-500 whitespace-nowrap">粗细 (Width)</span>
                        <input 
                            type="range" min="0" max="10" step="0.5" 
                            value={selectedNode.strokeWidth || 0}
                            onChange={(e) => onUpdateNode({ strokeWidth: parseFloat(e.target.value) })}
                            className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="w-12 flex items-center bg-white border border-gray-200 rounded px-1">
                            <input 
                                type="number" 
                                value={selectedNode.strokeWidth || 0}
                                onChange={(e) => onUpdateNode({ strokeWidth: parseFloat(e.target.value) })}
                                className="w-full bg-transparent text-xs outline-none text-right py-1"
                            />
                            <span className="text-[10px] text-slate-400 ml-0.5">px</span>
                        </div>
                    </div>
                )}

                {/* Tab Switcher (Only visible in Fill Mode, Strokes are solid only for now) */}
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
                        {/* Type Toggle */}
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setGradType('linear')}
                                className={`flex-1 py-1 text-xs rounded border transition-colors ${gradType === 'linear' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'border-gray-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                线性 (Linear)
                            </button>
                            <button 
                                onClick={() => setGradType('radial')}
                                className={`flex-1 py-1 text-xs rounded border transition-colors ${gradType === 'radial' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'border-gray-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                径向 (Radial)
                            </button>
                        </div>

                        {/* Gradient Slider Bar */}
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

                        {/* Linear Controls: Angle */}
                        {gradType === 'linear' && (
                             <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 w-8">旋转</span>
                                <input 
                                    type="range" min="0" max="360" value={gradAngle} 
                                    onChange={(e) => setGradAngle(parseInt(e.target.value))}
                                    className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="text-xs text-slate-500 w-8 text-right font-medium">{gradAngle}°</span>
                            </div>
                        )}

                        {/* Radial Controls: Position */}
                        {gradType === 'radial' && (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-slate-500">位置 (Position)</span>
                                <div className="grid grid-cols-3 gap-1 w-24 mx-auto">
                                    {RADIAL_POSITIONS.map(pos => (
                                        <button 
                                            key={pos.value}
                                            onClick={() => setGradPos(pos.value)}
                                            className={`w-full aspect-square rounded text-[9px] border flex items-center justify-center ${gradPos === pos.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-slate-400 hover:bg-slate-50'}`}
                                        >
                                            {pos.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* COLOR PICKER (SHARED for Solid, Gradient & Stroke) */}
                {activeFillTab !== 'image' && (
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-500">
                                {activeFillTab === 'gradient' && activePopup === 'color' ? `Color Stop ${activeStopIndex + 1}` : '颜色 (Color)'}
                            </span>
                        </div>

                        {/* HSB Picker */}
                        <div 
                            ref={sbRef}
                            className="w-full h-32 rounded-lg cursor-crosshair relative shadow-inner ring-1 ring-black/5"
                            style={{ backgroundColor: `hsl(${hsva.h}, 100%, 50%)` }}
                            onPointerDown={handleSbChange}
                            onPointerMove={(e) => e.buttons === 1 && handleSbChange(e)}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                            <div 
                                className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ left: `${hsva.s}%`, top: `${100 - hsva.v}%`, backgroundColor: hexColor }}
                            />
                        </div>

                        {/* Sliders */}
                        <div className="flex items-center gap-3">
                                {('EyeDropper' in window) && (
                                    <button onClick={handleEyeDropper} className="text-slate-500 hover:text-slate-800" title="Pick Color from Screen">
                                        <IconPipette className="w-4 h-4" />
                                    </button>
                                )}
                                <div className="flex-1 flex flex-col gap-2">
                                    {/* Hue */}
                                    <input 
                                        type="range" min="0" max="360" step="1"
                                        value={hsva.h}
                                        onChange={(e) => handleColorChange({ ...hsva, h: parseInt(e.target.value) })}
                                        className="w-full h-3 rounded-full cursor-pointer appearance-none"
                                        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
                                    />
                                    {/* Opacity */}
                                    <div className="w-full h-3 relative rounded-full ring-1 ring-black/5">
                                        <div 
                                            className="absolute inset-0 rounded-full overflow-hidden" 
                                            style={{ 
                                                backgroundImage: "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhYWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')"
                                            }}
                                        >
                                            <div 
                                                className="absolute inset-0"
                                                style={{ background: `linear-gradient(to right, transparent, ${hexColor})` }}
                                            />
                                        </div>
                                        <input 
                                            type="range" min="0" max="100" step="1"
                                            value={Math.round(hsva.a * 100)}
                                            onChange={(e) => handleColorChange({ ...hsva, a: parseInt(e.target.value) / 100 })}
                                            className="absolute inset-0 w-full h-full cursor-pointer appearance-none bg-transparent" 
                                            style={{ zIndex: 10 }}
                                        />
                                    </div>
                                </div>
                        </div>

                        {/* Hex Input */}
                        <div className="flex gap-2 items-center">
                            <div className="flex-1 flex items-center bg-slate-50 border border-gray-200 rounded px-2 py-1.5 focus-within:ring-1 focus-within:ring-indigo-500">
                                <span className="text-slate-400 text-xs mr-2 select-none">#</span>
                                <input 
                                    value={fullHexColor.replace('#', '')}
                                    onChange={(e) => {
                                        const newHex = '#' + e.target.value;
                                        // Match 6 or 8 digit hex
                                        if (/^#[0-9A-F]{6}([0-9A-F]{2})?$/i.test(newHex)) handlePresetClick(newHex);
                                    }}
                                    className="w-full bg-transparent text-sm font-medium outline-none text-slate-700 uppercase"
                                />
                            </div>
                            <div className="flex items-center bg-slate-50 border border-gray-200 rounded px-2 py-1.5 w-20">
                                <input 
                                    type="number" min="0" max="100" 
                                    value={Math.round(hsva.a * 100)}
                                    onChange={(e) => handleColorChange({ ...hsva, a: parseInt(e.target.value) / 100 })}
                                    className="w-full bg-transparent text-sm font-medium outline-none text-slate-700 text-right pr-1"
                                />
                                <span className="text-slate-400 text-xs select-none">%</span>
                            </div>
                        </div>

                        <hr className="border-gray-100 my-1"/>

                        {/* Presets */}
                        <div>
                             <div className="flex justify-between mb-2 items-center">
                                <span className="text-xs text-slate-400">预设 (Presets)</span>
                                {activeFillTab === 'solid' && activePopup !== 'stroke' && (
                                    <button 
                                        onClick={() => setShowAllPresets(!showAllPresets)}
                                        className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {showAllPresets ? '收起' : '更多'}
                                    </button>
                                )}
                             </div>
                             
                             {/* Gradient Presets Section */}
                             {activeFillTab === 'gradient' && activePopup === 'color' && (
                                <div className="grid grid-cols-6 gap-1.5 mb-3">
                                    {PRESET_GRADIENTS.map((g, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => handlePresetClick(g)}
                                            className="w-full aspect-square rounded border border-gray-100 shadow-sm hover:scale-105 transition-transform ring-1 ring-black/5"
                                            style={{ background: g }}
                                            title="Gradient Preset"
                                        />
                                    ))}
                                </div>
                             )}

                             {/* Solid Colors */}
                             {(activeFillTab === 'solid' || activePopup === 'stroke') && (
                                <div className={`grid grid-cols-10 gap-1.5 p-1 transition-all ${showAllPresets && activePopup !== 'stroke' ? 'max-h-[160px] overflow-y-auto custom-scrollbar' : ''}`}>
                                    {(showAllPresets && activePopup !== 'stroke' ? PRESET_COLORS : PRESET_COLORS.slice(0, 8)).map((c, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => handlePresetClick(c)}
                                            className="w-7 h-7 rounded-full border border-gray-100 shadow-sm hover:scale-110 transition-transform hover:shadow-md ring-1 ring-black/5 shrink-0"
                                            style={{ background: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                             )}
                        </div>
                    </div>
                )}

                {activeFillTab === 'image' && activePopup === 'color' && (
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-lg bg-slate-50 gap-3">
                        <IconImage className="w-8 h-8 text-slate-300" />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white border border-gray-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                        >
                            Upload Image
                        </button>
                        <input 
                            ref={fileInputRef} 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload}
                        />
                        <p className="text-xs text-slate-400">Supports PNG, JPG, WEBP</p>
                    </div>
                )}
                </div>
            )}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-1"></div>

        {/* Font Family */}
        <div className="relative">
            <button 
            onClick={() => setActivePopup(activePopup === 'font' ? null : 'font')}
            className="px-2 py-1.5 hover:bg-slate-100 rounded text-sm font-medium text-slate-700 flex items-center gap-2"
            >
            <span className="truncate max-w-[80px]">{FONTS.find(f => f.value === selectedNode.fontFamily)?.name || 'Inter'}</span>
            <IconChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {activePopup === 'font' && (
                <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar z-50">
                    {FONTS.map(f => (
                        <button 
                            key={f.name} onClick={() => { onUpdateNode({ fontFamily: f.value }); setActivePopup(null); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700 flex justify-between group" style={{ fontFamily: f.value }}
                        >
                            {f.name}
                            {selectedNode.fontFamily === f.value && <span className="text-indigo-600">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Font Weight */}
        <div className="relative">
            <button 
            onClick={() => setActivePopup(activePopup === 'weight' ? null : 'weight')}
            className="px-2 py-1.5 hover:bg-slate-100 rounded text-sm font-medium text-slate-700 flex items-center gap-2"
            >
            <span className="truncate max-w-[80px]">{FONT_WEIGHTS.find(w => w.value === selectedNode.fontWeight)?.name || 'Regular'}</span>
            <IconChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {activePopup === 'weight' && (
                <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-[140px] max-h-[300px] overflow-y-auto custom-scrollbar z-50">
                    {FONT_WEIGHTS.map(w => (
                        <button 
                            key={w.name} onClick={() => { onUpdateNode({ fontWeight: w.value }); setActivePopup(null); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700 flex justify-between"
                        >
                            <span style={{ fontWeight: w.value }}>{w.name}</span>
                            {selectedNode.fontWeight === w.value && <span className="text-indigo-600">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Font Size */}
        <div className="relative flex items-center hover:bg-slate-50 rounded group">
            <input 
                value={selectedNode.fontSize || 16}
                onChange={(e) => onUpdateNode({ fontSize: parseInt(e.target.value) || 16 })}
                className="w-10 text-center text-sm font-medium text-slate-700 bg-transparent outline-none py-1.5"
            />
            <button onClick={() => setActivePopup(activePopup === 'size' ? null : 'size')} className="pr-2 text-slate-400 group-hover:text-slate-600">
                 <IconChevronDown className="w-3 h-3" />
            </button>
            {activePopup === 'size' && (
                <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-[80px] max-h-[300px] overflow-y-auto custom-scrollbar z-50">
                    {FONT_SIZES.map(s => (
                        <button 
                            key={s} onClick={() => { onUpdateNode({ fontSize: s }); setActivePopup(null); }}
                            className="w-full text-center px-2 py-1.5 text-sm hover:bg-slate-50 text-slate-700"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-1"></div>

        {/* Advanced Menu */}
        <div className="relative">
            <button 
                onClick={() => setActivePopup(activePopup === 'advanced' ? null : 'advanced')} 
                className={`w-8 h-8 rounded hover:bg-slate-100 flex items-center justify-center ${activePopup === 'advanced' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
            >
                 <IconDotsHorizontal className="w-5 h-5" />
            </button>
            
            {activePopup === 'advanced' && (
                <div className="absolute bottom-full right-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-100 p-3 w-[200px] z-50 animate-in fade-in zoom-in-95 duration-100">
                    
                    <div className="mb-3">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Alignment</span>
                        <div className="flex bg-slate-100 rounded p-1 gap-1">
                            <button onClick={() => onUpdateNode({ textAlign: 'left' })} className={`flex-1 p-1 rounded hover:bg-white hover:shadow-sm ${selectedNode.textAlign === 'left' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><IconAlignLeft className="w-4 h-4 mx-auto"/></button>
                            <button onClick={() => onUpdateNode({ textAlign: 'center' })} className={`flex-1 p-1 rounded hover:bg-white hover:shadow-sm ${selectedNode.textAlign === 'center' || !selectedNode.textAlign ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><IconAlignCenter className="w-4 h-4 mx-auto"/></button>
                            <button onClick={() => onUpdateNode({ textAlign: 'right' })} className={`flex-1 p-1 rounded hover:bg-white hover:shadow-sm ${selectedNode.textAlign === 'right' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><IconAlignRight className="w-4 h-4 mx-auto"/></button>
                            <button onClick={() => onUpdateNode({ textAlign: 'justify' })} className={`flex-1 p-1 rounded hover:bg-white hover:shadow-sm ${selectedNode.textAlign === 'justify' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><IconAlignJustify className="w-4 h-4 mx-auto"/></button>
                        </div>
                    </div>

                    <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Decoration</span>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => onUpdateNode({ textDecoration: selectedNode.textDecoration === 'underline' ? 'none' : 'underline' })}
                                className={`flex-1 flex items-center justify-center p-2 rounded border transition-colors ${selectedNode.textDecoration === 'underline' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 hover:bg-slate-50 text-slate-600'}`}
                             >
                                 <IconUnderline className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => onUpdateNode({ textDecoration: selectedNode.textDecoration === 'line-through' ? 'none' : 'line-through' })}
                                className={`flex-1 flex items-center justify-center p-2 rounded border transition-colors ${selectedNode.textDecoration === 'line-through' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 hover:bg-slate-50 text-slate-600'}`}
                             >
                                 <IconStrikethrough className="w-4 h-4" />
                             </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default TextToolbar;