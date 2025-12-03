
import React, { useRef, useEffect } from 'react';
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
      
      const textStyle: React.CSSProperties = {
          fontFamily: node.fontFamily || 'Inter, sans-serif',
          fontSize: `${node.fontSize || 16}px`,
          fontWeight: node.fontWeight || '400',
          textAlign: node.textAlign || 'left',
          textDecoration: node.textDecoration || 'none',
          lineHeight: '1.2', 
          cursor: 'text',
          WebkitTextStroke: node.strokeWidth && node.strokeWidth > 0 ? `${node.strokeWidth}px ${node.strokeColor}` : '0',
          padding: '8px',
      };

      if (isFancyFill) {
         Object.assign(textStyle, {
            backgroundImage: node.fillColor,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            // Magic combination for image-fill text with visible decorations:
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent', 
            // Keep the standard color opaque so text-decoration line remains visible
            color: '#000000', 
            // Explicitly set decoration color to be safe
            textDecorationColor: '#000000',
         });
      } else {
         textStyle.color = node.fillColor || '#000000';
         textStyle.textDecorationColor = node.fillColor || '#000000';
      }

      return (
        <div
            className={`absolute top-0 left-0 flex flex-col ${isSelected ? 'ring-1 ring-blue-500 z-20' : 'z-10'}`}
            style={{ ...baseStyle }}
            onPointerDown={onMouseDown}
        >
             <textarea
                ref={textareaRef}
                value={node.content}
                onChange={handleInput}
                placeholder="Type text..."
                className="w-full h-full bg-transparent resize-none border-none outline-none overflow-hidden"
                style={textStyle}
            />
            {isSelected && (
                 <>
                    {/* Corner Handles (Scale Font) */}
                    <ResizeHandle cursor="nwse-resize" position="-top-1.5 -left-1.5" handle="nw" />
                    <ResizeHandle cursor="nesw-resize" position="-top-1.5 -right-1.5" handle="ne" />
                    <ResizeHandle cursor="nesw-resize" position="-bottom-1.5 -left-1.5" handle="sw" />
                    <ResizeHandle cursor="nwse-resize" position="-bottom-1.5 -right-1.5" handle="se" />
                    
                    {/* Side Handles (Resize Width) */}
                    <ResizeHandle cursor="ew-resize" position="top-1/2 -right-1.5 -translate-y-1/2" handle="e" />
                    <ResizeHandle cursor="ew-resize" position="top-1/2 -left-1.5 -translate-y-1/2" handle="w" />
                 </>
            )}
        </div>
      );
  }

  // 5. Shapes
  let shapeClass = 'rounded-md';
  if (node.type === 'circle') shapeClass = 'rounded-full';
  
  const isSticky = node.type === 'sticky';
  const bgColor = node.color || '#ffffff';
  
  return (
    <div
      className={`absolute top-0 left-0 flex items-center justify-center ${isSelected ? 'ring-2 ring-blue-500 z-10' : ''} ${isSticky ? 'shadow-md' : ''}`}
      style={{ ...baseStyle }}
      onPointerDown={onMouseDown}
    >
      <div 
        className={`absolute inset-0 w-full h-full ${shapeClass}`} 
        style={{ 
            backgroundColor: node.type !== 'triangle' ? bgColor : 'transparent',
            clipPath: node.type === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
            border: node.type !== 'triangle' ? '1px solid rgba(0,0,0,0.1)' : 'none'
        }}
      >
        {node.type === 'triangle' && (
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon points="50,0 0,100 100,100" fill={bgColor} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
            </svg>
        )}
      </div>

      <textarea
        value={node.content}
        onChange={handleInput}
        className={`relative z-10 w-full h-full bg-transparent resize-none border-none outline-none p-4 text-center flex items-center justify-center ${node.type === 'triangle' ? 'pt-12' : ''}`}
        style={{ 
            fontFamily: node.fontFamily || 'Inter, sans-serif',
            fontSize: `${node.fontSize || 16}px`,
            color: node.fillColor || '#1e293b',
            textAlign: node.textAlign || 'center'
        }}
        placeholder={isSticky ? "Idea..." : ""}
      />
      
      {isSelected && (
        <>
            <ResizeHandle cursor="nwse-resize" position="-bottom-1.5 -right-1.5" handle="se" />
        </>
      )}
    </div>
  );
};

export default Node;
