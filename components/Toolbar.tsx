
import React, { useState, useRef, useEffect } from 'react';
import { Tool } from '../types';
import { 
  IconHand, IconMousePointer, IconSquare, IconType, IconPencil, 
  IconArrowUpRight, IconPlus, IconCircle, IconTriangle, IconLine,
  IconImage, IconVideo, IconSparkles
} from './Icons';

interface ToolbarProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  onUploadImage: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onSelectTool, onUploadImage, style, className }) => {
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setActivePopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToolClick = (toolId: Tool | string, hasSubmenu: boolean) => {
    if (hasSubmenu) {
      setActivePopup(activePopup === toolId ? null : toolId);
    } else {
      if (toolId === 'image-upload') {
        onUploadImage();
      } else {
        onSelectTool(toolId as Tool);
      }
      setActivePopup(null);
    }
  };

  const getActiveIconForGroup = (group: string, defaultIcon: React.FC<any>) => {
    if (group === 'shapes') {
      if (activeTool === 'circle') return IconCircle;
      if (activeTool === 'triangle') return IconTriangle;
      return IconSquare;
    }
    if (group === 'connectors') {
      if (activeTool === 'line') return IconLine;
      return IconArrowUpRight;
    }
    return defaultIcon;
  };

  const menuItems = [
    { id: 'select', icon: IconMousePointer, label: 'Selection' },
    { id: 'hand', icon: IconHand, label: 'Hand tool' },
    { 
      id: 'connectors', 
      group: 'connectors',
      icon: IconArrowUpRight, 
      label: 'Connectors',
      submenu: [
        { id: 'arrow', label: 'Arrow', icon: IconArrowUpRight },
        { id: 'line', label: 'Line', icon: IconLine },
      ]
    },
    { 
      id: 'shapes', 
      group: 'shapes',
      icon: IconSquare, 
      label: 'Shapes', 
      submenu: [
        { id: 'rectangle', label: 'Rectangle', icon: IconSquare },
        { id: 'circle', label: 'Circle', icon: IconCircle },
        { id: 'triangle', label: 'Triangle', icon: IconTriangle },
      ]
    },
    { id: 'text', icon: IconType, label: 'Text' },
    { id: 'pencil', icon: IconPencil, label: 'Draw' },
    { id: 'divider' },
    { 
      id: 'insert', 
      icon: IconPlus, 
      label: 'Insert',
      submenu: [
        { id: 'image-upload', label: 'Upload Image', icon: IconImage, meta: 'Ctrl+U' },
        { id: 'video-dummy', label: 'Upload Video (Dev)', icon: IconVideo, disabled: true },
      ]
    },
  ];

  return (
    <div 
      ref={toolbarRef} 
      style={style}
      className={`fixed top-1/2 -translate-y-1/2 flex flex-col gap-1 p-1.5 bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-100 z-50 ${className || 'left-4'}`}
    >
      {menuItems.map((item, index) => {
        if (item.id === 'divider') {
          return <div key={index} className="h-px w-6 bg-gray-200 mx-auto my-1" />;
        }

        const isGroup = !!item.submenu;
        // Check if any tool in this group is active
        const isGroupActive = isGroup && item.submenu?.some(sub => sub.id === activeTool);
        const isActive = activeTool === item.id || isGroupActive;
        
        // Dynamic icon based on selection
        const DisplayIcon = isGroup ? getActiveIconForGroup(item.group || '', item.icon) : item.icon;

        return (
          <div key={item.id} className="relative group/btn">
            <button
              onClick={() => handleToolClick(item.id, isGroup)}
              className={`p-2 rounded-md transition-all duration-200 relative ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <DisplayIcon className="w-5 h-5" />
              
              {/* Tooltip for non-popup items */}
              {!activePopup && (
                 <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    {item.label}
                 </div>
              )}
            </button>

            {/* Submenu Popup */}
            {isGroup && activePopup === item.id && (
              <div className="absolute left-full top-0 ml-3 bg-white rounded-lg shadow-xl border border-gray-100 p-1.5 min-w-[180px] animate-in fade-in slide-in-from-left-2 duration-200">
                {item.submenu!.map((subItem) => (
                  <button
                    key={subItem.id}
                    disabled={subItem.disabled}
                    onClick={() => handleToolClick(subItem.id, false)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      activeTool === subItem.id 
                        ? 'bg-indigo-50 text-indigo-600' 
                        : subItem.disabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <subItem.icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{subItem.label}</span>
                    {subItem.meta && <span className="text-xs text-slate-400 font-medium">{subItem.meta}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Toolbar;
