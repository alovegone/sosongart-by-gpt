
import React, { useState, useRef, useEffect } from 'react';
import { CanvasNode } from '../types';
import { 
  IconChevronDown, IconDotsHorizontal, IconX, 
  IconAlignLeft, IconAlignCenter, IconAlignRight, IconAlignJustify,
  IconUnderline, IconStrikethrough, IconImage, IconRotateCcw
} from './Icons';
import { FONTS, FONT_WEIGHTS, FONT_SIZES } from '../constants';

interface TextToolbarProps {
  selectedNode: CanvasNode;
  onUpdateNode: (updates: Partial<CanvasNode>) => void;
  position: { x: number; y: number };
}

// --- Robust Color Utils ---
const hexToHsv = (hex: string) => {
  if (!hex || hex.includes('url') || hex.includes('gradient')) return { h: 0, s: 0, v: 0 };
  
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

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
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
};

const hsvToHex = (h: number, s: number, v: number) => {
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
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const TabButton = ({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) => (
  <button 
    onClick={onClick}
    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${active ? 'bg-white shadow-sm text-slate-900 ring-1 ring-gray-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
  >
    {children}
  </button>
);

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#FCA5A5', '#FDBA74', '#FCD34D', '#86EFAC', '#93C5FD', '#A5B4FC', '#D8B4FE', '#F0ABFC',
  '#E5E7EB', '#4B5563', '#EF4444', '#F97316', '#F59E0B', '#22C55E', '#3B82F6', '#6366F1', '#A855F7', '#EC4899',
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
];

const TextToolbar: React.FC<TextToolbarProps> = ({ selectedNode, onUpdateNode, position }) => {
  const [activePopup, setActivePopup] = useState<'font' | 'weight' | 'size' | 'color' | 'advanced' | null>(null);
  const [activeFillTab, setActiveFillTab] = useState<'solid' | 'gradient' | 'image'>('solid');
  
  // Custom Color Picker State
  const [hsv, setHsv] = useState({ h: 0, s: 0, v: 0 });
  const [gradAngle, setGradAngle] = useState(135);
  const [gradType, setGradType] = useState<'linear' | 'radial'>('linear');

  const toolbarRef = useRef<HTMLDivElement>(null);
  const sbRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with selected node whenever it changes
  useEffect(() => {
    if (!selectedNode.fillColor) return;
    
    if (selectedNode.fillColor.includes('gradient')) {
        setActiveFillTab('gradient');
    } else if (selectedNode.fillColor.includes('url')) {
        setActiveFillTab('image');
    } else {
        const newHsv = hexToHsv(selectedNode.fillColor.startsWith('#') ? selectedNode.fillColor : '#000000');
        setHsv(newHsv);
        setActiveFillTab('solid');
    }
  }, [selectedNode.fillColor, selectedNode.id]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      // Check if click is inside the toolbar or any of its children (including popped out dropdowns)
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePopup(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => e.stopPropagation();

  // Updates color based on HSV
  const updateColorFromHsv = (newHsv: typeof hsv) => {
      setHsv(newHsv);
      const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
      onUpdateNode({ fillColor: hex });
  };

  const handlePresetClick = (hex: string) => {
      const newHsv = hexToHsv(hex);
      setHsv(newHsv);
      onUpdateNode({ fillColor: hex });
  };

  const handleSbChange = (e: React.PointerEvent) => {
    if (!sbRef.current) return;
    const rect = sbRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newHsv = { ...hsv, s: Math.round(x * 100), v: Math.round((1 - y) * 100) };
    updateColorFromHsv(newHsv);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const url = evt.target.result as string;
          onUpdateNode({ fillColor: `url(${url})` });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const hexColor = hsvToHex(hsv.h, hsv.s, hsv.v);

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

             {/* COLOR POPUP */}
            {activePopup === 'color' && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-[280px] z-50">
                <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-slate-800">填充 (Fill)</span>
                    <button onClick={() => setActivePopup(null)} className="text-slate-400 hover:text-slate-600"><IconX className="w-4 h-4"/></button>
                </div>
                
                <div className="bg-slate-100 p-1 rounded-lg flex mb-4">
                    <TabButton active={activeFillTab === 'solid'} onClick={() => setActiveFillTab('solid')}>纯色</TabButton>
                    <TabButton active={activeFillTab === 'gradient'} onClick={() => setActiveFillTab('gradient')}>渐变</TabButton>
                    <TabButton active={activeFillTab === 'image'} onClick={() => setActiveFillTab('image')}>图片</TabButton>
                </div>

                {activeFillTab === 'solid' && (
                    <div className="flex flex-col gap-3">
                    {/* HSB Picker */}
                    <div 
                        ref={sbRef}
                        className="w-full h-32 rounded-lg cursor-crosshair relative shadow-inner"
                        style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
                        onPointerDown={handleSbChange}
                        onPointerMove={(e) => e.buttons === 1 && handleSbChange(e)}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                        <div 
                            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: hexColor }}
                        />
                    </div>

                    {/* Hue Slider */}
                    <div className="flex items-center gap-3">
                            <button className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: hexColor }}></button>
                            <input 
                                type="range" min="0" max="360"
                                value={hsv.h}
                                onChange={(e) => updateColorFromHsv({ ...hsv, h: parseInt(e.target.value) })}
                                className="flex-1 h-3 rounded-full cursor-pointer appearance-none"
                                style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
                            />
                    </div>

                    {/* Hex Input */}
                    <div className="flex gap-2 items-center mt-1">
                        <div className="flex-1 flex items-center bg-slate-50 border border-gray-200 rounded px-2 py-1">
                            <span className="text-slate-400 text-xs mr-2">#</span>
                            <input 
                                value={hexColor.replace('#', '')}
                                onChange={(e) => {
                                    const newHex = '#' + e.target.value;
                                    if (/^#[0-9A-F]{6}$/i.test(newHex)) {
                                        handlePresetClick(newHex);
                                    }
                                }}
                                className="w-full bg-transparent text-sm font-medium outline-none text-slate-700 uppercase"
                            />
                        </div>
                        <div className="flex items-center bg-slate-50 border border-gray-200 rounded px-2 py-1 w-20">
                            <input 
                                type="number" min="0" max="100" value={100} readOnly
                                className="w-full bg-transparent text-sm font-medium outline-none text-slate-700 text-right pr-1"
                            />
                            <span className="text-slate-400 text-xs">%</span>
                        </div>
                    </div>

                    <hr className="border-gray-100 my-1"/>

                    {/* Presets */}
                    <div className="grid grid-cols-10 gap-2">
                        {PRESET_COLORS.map(c => (
                            <button 
                                key={c}
                                onClick={() => handlePresetClick(c)}
                                className="w-5 h-5 rounded-full border border-gray-100 hover:scale-110 transition-transform"
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                    </div>
                )}

                {activeFillTab === 'gradient' && (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2 mb-2">
                            <button 
                                onClick={() => setGradType('linear')}
                                className={`flex-1 py-1 text-xs rounded border ${gradType === 'linear' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-slate-600'}`}
                            >
                                Linear
                            </button>
                            <button 
                                onClick={() => setGradType('radial')}
                                className={`flex-1 py-1 text-xs rounded border ${gradType === 'radial' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-slate-600'}`}
                            >
                                Radial
                            </button>
                        </div>
                        
                        {gradType === 'linear' && (
                             <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Angle</span>
                                <input 
                                    type="range" min="0" max="360" value={gradAngle} 
                                    onChange={(e) => setGradAngle(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-xs text-slate-700 w-8 text-right">{gradAngle}°</span>
                            </div>
                        )}

                        <div className="grid grid-cols-4 gap-2 mt-2">
                            {PRESET_GRADIENTS.map((g, i) => (
                                <button
                                    key={i}
                                    className="w-full h-8 rounded-md border border-gray-200 shadow-sm"
                                    style={{ background: g }}
                                    onClick={() => onUpdateNode({ fillColor: g })}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {activeFillTab === 'image' && (
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
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar z-50">
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
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-[140px] max-h-[300px] overflow-y-auto custom-scrollbar z-50">
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
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-[80px] max-h-[300px] overflow-y-auto custom-scrollbar z-50">
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
                <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 p-3 w-[200px] z-50 animate-in fade-in zoom-in-95 duration-100">
                    
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
