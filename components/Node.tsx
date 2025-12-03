import React, { useRef, useEffect, useState } from 'react';
import { CanvasNode } from '../types';

interface NodeProps {
  node: CanvasNode;
  isSelected: boolean;
  scale: number;
  onMouseDown: (e: React.PointerEvent) => void;
  onChange: (id: string, newContent: string) => void;
  onResize: (id: string, width: number, height: number) => void;
  onResizeStart?: (e: React.PointerEvent, handle: string) => void;
}

const Node: React.FC<NodeProps> = ({ node, isSelected, onMouseDown, onChange, onResize, onResizeStart }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Sync editing state: Exit edit mode when deselected
  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
      // Explicitly clear selection when node is deselected
      if (textareaRef.current) {
          textareaRef.current.setSelectionRange(0, 0);
          textareaRef.current.blur();
      }
      // Clear global selection to be safe
      const selection = window.getSelection();
      if (selection) {
          selection.removeAllRanges();
      }
    } else if (node.type === 'text' && !node.content && isSelected) {
        // Auto-enter edit mode for newly created empty text nodes
        setIsEditing(true);
    }
  }, [isSelected, node.type, node.content]);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Auto-resize logic for text nodes
  useEffect(() => {
    if (node.type === 'text' && textareaRef.current && onResize) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = '100%';

      if (Math.abs(scrollHeight - node.height) > 2) {
         // Prevent collapse below a reasonable minimum
         const newHeight = Math.max(scrollHeight, node.fontSize ? node.fontSize * 1.2 : 24);
         onResize(node.id, node.width, newHeight);
      }
    }
  }, [node.content, node.fontSize, node.fontFamily, node.width, node.type, onResize, node.height]);

  const baseStyle = {
    transform: `translate(${node.x}px, ${node.y}px)`,
    width: node.width,
    height: node.height,
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(node.id, e.target.value);
  };

  // Resize Handle Component
  const ResizeHandle = ({ cursor, position, handle }: { cursor: string, position: string, handle: string }) => (
    <div
      className={`absolute w-3 h-3 bg-white border border-blue-500 rounded-full z-30 ${position}`}
      style={{ cursor }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (onResizeStart) onResizeStart(e, handle);
      }}
    />
  );

  // --- Render Different Node Types ---

  // 1. Drawing
  if (node.type === 'draw' && node.points) {
    const pathData = node.points.length > 1 
      ? `M ${node.points[0].x} ${node.points[0].y} ` + node.points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
      : '';

    return (
      <div 
        className={`absolute top-0 left-0 pointer-events-auto ${isSelected ? 'ring-1 ring-blue-500' : ''}`}
        style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
        onPointerDown={onMouseDown}
      >
        <svg 
            width={node.width} 
            height={node.height} 
            style={{ overflow: 'visible' }}
            className="drop-shadow-sm"
        >
           <path d={pathData} stroke={node.color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  // 2. Lines & Arrows
  if ((node.type === 'line' || node.type === 'arrow') && node.points && node.points.length === 2) {
      const end = node.points[1];
      return (
        <div 
            className={`absolute top-0 left-0 pointer-events-auto ${isSelected ? 'opacity-80' : ''}`}
            style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
            onPointerDown={onMouseDown}
        >
             <svg style={{ overflow: 'visible' }}>
                 <defs>
                    <marker id={`arrow-${node.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill={node.color} />
                    </marker>
                 </defs>
                 <line x1={0} y1={0} x2={end.x} y2={end.y} stroke={node.color} strokeWidth="2" markerEnd={node.type === 'arrow' ? `url(#arrow-${node.id})` : undefined} />
                 <line x1={0} y1={0} x2={end.x} y2={end.y} stroke="transparent" strokeWidth="10" cursor="pointer" />
             </svg>
             {isSelected && (
                <>
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: 0, top: 0 }} />
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: end.x, top: end.y }} />
                </>
             )}
        </div>
      )
  }

  // 3. Images
  if (node.type === 'image') {
      return (
        <div
            className={`absolute top-0 left-0 group ${isSelected ? 'ring-2 ring-blue-500 shadow-xl' : 'shadow-md hover:shadow-lg'}`}
            style={{ ...baseStyle, backgroundColor: 'white' }}
            onPointerDown={onMouseDown}
        >
            {node.src ? (
                <img src={node.src} alt="Upload" className="w-full h-full object-cover pointer-events-none select-none" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">Loading...</div>
            )}
             {isSelected && (
                <>
                    <ResizeHandle cursor="nwse-resize" position="-bottom-1 -right-1" handle="se" />
                </>
            )}
        </div>
      );
  }

  // 4. Text Node
  if (node.type === 'text') {
      const isFancyFill = node.fillColor?.includes('gradient') || node.fillColor?.includes('url(');
      
      // Base styles shared between the ghost div (stroke) and textarea (fill)
      const commonTextStyle: React.CSSProperties = {
          fontFamily: node.fontFamily || 'Inter, sans-serif',
          fontSize: `${node.fontSize || 16}px`,
          fontWeight: node.fontWeight || '400',
          textAlign: node.textAlign || 'left',
          textDecoration: node.textDecoration || 'none',
          lineHeight: '1.2', 
          padding: '8px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxSizing: 'border-box',
      };

      // 1. Stroke Layer Style (The "Ghost" Div)
      const strokeStyle: React.CSSProperties = {
          ...commonTextStyle,
          color: 'transparent',
          WebkitTextStroke: node.strokeWidth && node.strokeWidth > 0 ? `${node.strokeWidth}px ${node.strokeColor || '#000'}` : '0',
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'none', 
          zIndex: 0,
      };

      // 2. Fill Layer Style (The Textarea)
      const fillStyle: React.CSSProperties = {
          ...commonTextStyle,
          backgroundColor: 'transparent',
          resize: 'none',
          border: 'none',
          outline: 'none',
          overflow: 'hidden',
          WebkitTextStroke: '0', 
          zIndex: 1, 
          position: 'relative',
      };

      if (isFancyFill) {
         Object.assign(fillStyle, {
            backgroundImage: node.fillColor,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent', 
            color: 'transparent', 
            textDecorationColor: node.strokeColor || '#000000', 
         });
      } else {
         fillStyle.color = node.fillColor || '#000000';
         fillStyle.textDecorationColor = node.fillColor || '#000000';
      }

      return (
        <div
            className={`absolute top-0 left-0 flex flex-col ${isSelected ? 'ring-1 ring-blue-500 z-20' : 'z-10'}`}
            style={{ 
                ...baseStyle,
                cursor: isEditing ? 'text' : 'grab' // Indicate draggable state vs edit state
            }}
            onPointerDown={onMouseDown}
            onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
             {/* Ghost Div for Stroke */}
             <div style={strokeStyle} aria-hidden="true">
                {node.content}
                {node.content.endsWith('\n') && <br />} 
             </div>

             {/* Editable Textarea for Fill */}
             <textarea
                ref={textareaRef}
                value={node.content}
                onChange={handleInput}
                placeholder={isEditing ? "Type text..." : ""}
                className={`w-full h-full ${isEditing ? 'select-text cursor-text' : 'select-none cursor-grab'}`}
                style={{
                    ...fillStyle,
                    pointerEvents: isEditing ? 'auto' : 'none' // Disable pointer events when not editing to allow drag
                }}
                readOnly={!isEditing}
                onPointerDown={(e) => {
                    // Only stop propagation if editing (to allow selection)
                    // If not editing, let it bubble to container for drag
                    if (isEditing) e.stopPropagation();
                }}
                onPointerMove={(e) => {
                    if (isEditing) e.stopPropagation();
                }}
                onBlur={() => setIsEditing(false)}
            />
            {isSelected && (
                 <>
                    {/* Handles only show when selected */}
                    <ResizeHandle cursor="nwse-resize" position="-top-1.5 -left-1.5" handle="nw" />
                    <ResizeHandle cursor="nesw-resize" position="-top-1.5 -right-1.5" handle="ne" />
                    <ResizeHandle cursor="nesw-resize" position="-bottom-1.5 -left-1.5" handle="sw" />
                    <ResizeHandle cursor="nwse-resize" position="-bottom-1.5 -right-1.5" handle="se" />
                    
                    <ResizeHandle cursor="ew-resize" position="top-1/2 -right-1.5 -translate-y-1/2" handle="e" />
                    <ResizeHandle cursor="ew-resize" position="top-1/2 -left-1.5 -translate-y-1/2" handle="w" />
                 </>
            )}
        </div>
      );
  }

  // 5. Shapes (Rectangle, Circle, Triangle)
  let shapeClass = 'rounded-md';
  if (node.type === 'circle') shapeClass = 'rounded-full';
  
  // Use fillColor for shape background, defaulting to node.color for legacy support
  const fill = node.fillColor || node.color || '#ffffff';
  const stroke = node.strokeColor || 'transparent';
  const strokeW = node.strokeWidth || 0;
  const align = node.strokeAlign || 'center';
  
  const commonShapeStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
  };

  // SVG Path Definitions
  let svgPath = '';
  if (node.type === 'rectangle' || node.type === 'sticky') svgPath = `M0,0 h${node.width} v${node.height} h-${node.width} z`;
  if (node.type === 'circle') svgPath = `M${node.width/2},0 A${node.width/2},${node.height/2} 0 1,1 ${node.width/2},${node.height} A${node.width/2},${node.height/2} 0 1,1 ${node.width/2},0`;
  if (node.type === 'triangle') svgPath = `M${node.width/2},0 L0,${node.height} L${node.width},${node.height} z`;

  return (
    <div
      className={`absolute top-0 left-0 flex items-center justify-center ${isSelected ? 'ring-1 ring-blue-500 z-10' : ''}`}
      style={{ ...baseStyle }}
      onPointerDown={onMouseDown}
    >
      {/* 
        Layer 1: Stroke (Only if Outside)
        Rendered BEHIND fill.
      */}
      {strokeW > 0 && align === 'outside' && (
          <svg width="100%" height="100%" style={{ position: 'absolute', overflow: 'visible', zIndex: 0 }}>
              <path d={svgPath} fill="none" stroke={stroke} strokeWidth={strokeW * 2} vectorEffect="non-scaling-stroke" />
          </svg>
      )}

      {/* 
        Layer 2: Fill 
        Use Div with ClipPath for perfect gradient/image support.
      */}
      <div 
        style={{
            ...commonShapeStyle,
            background: fill,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 1,
            clipPath: node.type === 'circle' ? 'circle(50% at 50% 50%)' 
                    : node.type === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' 
                    : undefined // Rectangle default
        }}
      />

      {/* 
        Layer 3: Stroke (Center or Inside)
        Rendered ON TOP of fill.
      */}
      {strokeW > 0 && align !== 'outside' && (
          <svg width="100%" height="100%" style={{ position: 'absolute', overflow: 'visible', zIndex: 2, pointerEvents: 'none' }}>
              {align === 'inside' ? (
                  // Inside: Clip stroke to shape path
                  <>
                    <defs>
                        <clipPath id={`clip-${node.id}`}>
                            <path d={svgPath} />
                        </clipPath>
                    </defs>
                    {/* Double width + clip = inside stroke */}
                    <path d={svgPath} fill="none" stroke={stroke} strokeWidth={strokeW * 2} clipPath={`url(#clip-${node.id})`} vectorEffect="non-scaling-stroke" />
                  </>
              ) : (
                  // Center: Standard SVG stroke
                  <path d={svgPath} fill="none" stroke={stroke} strokeWidth={strokeW} vectorEffect="non-scaling-stroke" />
              )}
          </svg>
      )}

      {/* Text Content */}
      {(node.type === 'sticky' || node.type === 'rectangle' || node.type === 'circle' || node.type === 'triangle') && (
        <textarea
            value={node.content}
            onChange={handleInput}
            className={`relative z-10 w-full h-full bg-transparent resize-none border-none outline-none p-4 text-center flex items-center justify-center ${node.type === 'triangle' ? 'pt-12' : ''}`}
            style={{ 
                fontFamily: node.fontFamily || 'Inter, sans-serif',
                fontSize: `${node.fontSize || 16}px`,
                color: (node.strokeColor || '#000'), // Fallback text color
                textAlign: node.textAlign || 'center'
            }}
            placeholder=""
        />
      )}
      
      {isSelected && (
        <>
            <ResizeHandle cursor="nwse-resize" position="-top-1.5 -left-1.5" handle="nw" />
            <ResizeHandle cursor="nesw-resize" position="-top-1.5 -right-1.5" handle="ne" />
            <ResizeHandle cursor="nesw-resize" position="-bottom-1.5 -left-1.5" handle="sw" />
            <ResizeHandle cursor="nwse-resize" position="-bottom-1.5 -right-1.5" handle="se" />
            
            <ResizeHandle cursor="ew-resize" position="top-1/2 -right-1.5 -translate-y-1/2" handle="e" />
            <ResizeHandle cursor="ew-resize" position="top-1/2 -left-1.5 -translate-y-1/2" handle="w" />
            <ResizeHandle cursor="ns-resize" position="bottom-0 left-1/2 -translate-x-1/2 translate-y-1.5" handle="s" />
            <ResizeHandle cursor="ns-resize" position="top-0 left-1/2 -translate-x-1/2 -translate-y-1.5" handle="n" />
        </>
      )}
    </div>
  );
};

export default Node;