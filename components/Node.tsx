
import React, { useRef, useEffect, useState } from 'react';
import { CanvasNode, Point, Tool } from '../types';

interface NodeProps {
  node: CanvasNode;
  isSelected: boolean;
  scale: number;
  onMouseDown: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  onChange: (id: string, newContent: string) => void;
  onResize: (id: string, width: number, height: number) => void;
  onResizeStart?: (e: React.PointerEvent, handle: string) => void;
  onUpdateNode?: (id: string, updates: Partial<CanvasNode>) => void;
  activeTool: Tool;
  penPointMode?: 'corner' | 'smooth';
  forcePathEdit?: boolean;
  onSelectAnchor?: (nodeId: string, index: number | null) => void;
}

const Node: React.FC<NodeProps> = ({ node, isSelected, scale, onMouseDown, onDoubleClick, onChange, onResize, onResizeStart, onUpdateNode, activeTool, penPointMode, forcePathEdit, onSelectAnchor }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeControl, setActiveControl] = useState<{ index: number, type: 'anchor' | 'left' | 'right' } | null>(null);
  const pathContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (forcePathEdit && node.type === 'path' && isSelected) {
        setIsEditing(true);
    }
    if (!forcePathEdit && node.type === 'path' && !isSelected) {
        setIsEditing(false);
    }
  }, [forcePathEdit, node.type, isSelected]);

  useEffect(() => {
    if (!isEditing && onSelectAnchor) {
        onSelectAnchor(node.id, null);
    }
  }, [isEditing, node.id, onSelectAnchor]);

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

  // --- Path Editing Logic ---

  const handleControlPointDown = (e: React.PointerEvent, index: number, type: 'anchor' | 'left' | 'right') => {
      e.stopPropagation();
      e.preventDefault();
      if (onSelectAnchor) onSelectAnchor(node.id, index);
      setActiveControl({ index, type });
      // Capture pointer to track movement outside the handle
      (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleControlPointMove = (e: React.PointerEvent) => {
      if (!activeControl || !node.points || !onUpdateNode) return;
      e.stopPropagation();

      const dx = e.movementX / node.width;
      const dy = e.movementY / node.height;
      const { index, type } = activeControl;
      
      const newPoints = [...node.points];
      const point = { ...newPoints[index] };

      if (type === 'anchor') {
          // Move anchor and handles together
          point.x += dx;
          point.y += dy;
      } else if (type === 'left') {
          point.lcx = (point.lcx || 0) + dx;
          point.lcy = (point.lcy || 0) + dy;
          // Mirror right handle if holding Shift or simple mode (optional, omitting for now to allow free editing)
      } else if (type === 'right') {
          point.rcx = (point.rcx || 0) + dx;
          point.rcy = (point.rcy || 0) + dy;
      }

      newPoints[index] = point;
      onUpdateNode(node.id, { points: newPoints });
  };

  const handleControlPointUp = (e: React.PointerEvent) => {
      if (activeControl) {
        e.stopPropagation();
        (e.target as Element).releasePointerCapture(e.pointerId);
        setActiveControl(null);
      }
  };

  const handleAnchorDoubleClick = (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      if (!node.points || !onUpdateNode) return;

      const newPoints = [...node.points];
      const p = newPoints[index];
      
      // Toggle between Smooth (handles) and Sharp (no handles)
      if (p.lcx !== undefined || p.rcx !== undefined) {
          // Remove handles (Sharp)
          delete p.lcx; delete p.lcy;
          delete p.rcx; delete p.rcy;
      } else {
          // Add default handles (Smooth) - simple offset
          p.lcx = -0.1; p.lcy = 0;
          p.rcx = 0.1; p.rcy = 0;
      }
      newPoints[index] = p;
      onUpdateNode(node.id, { points: newPoints });
  };

  const handlePathSegmentDoubleClick = (e: React.MouseEvent) => {
      if (!isEditing || !onUpdateNode || !node.points) return;
      e.stopPropagation();
      
      // Rough logic to add a point where clicked
      // 1. Calculate relative click position (0-1)
      const rect = (e.currentTarget as Element).getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / rect.width;
      const clickY = (e.clientY - rect.top) / rect.height;

      // 2. Find closest segment (simplified: just find closest index to insert after)
      // A proper implementation would project the point onto the bezier curve.
      // For now, we'll find the closest two points and insert between them.
      let closestIdx = 0;
      let minDist = Infinity;
      
      for(let i=0; i<node.points.length; i++) {
          const p = node.points[i];
          const dist = Math.hypot(p.x - clickX, p.y - clickY);
          if (dist < minDist) {
              minDist = dist;
              closestIdx = i;
          }
      }

      // Check if we should insert before or after closestIdx
      const nextIdx = (closestIdx + 1) % node.points.length;
      const prevIdx = (closestIdx - 1 + node.points.length) % node.points.length;
      
      // Heuristic: Insert after closest if click is closer to next than prev
      // This is a very rough "add point" approximation.
      const newPoints = [...node.points];
      newPoints.splice(closestIdx + 1, 0, { x: clickX, y: clickY }); // Insert simple sharp point
      
      onUpdateNode(node.id, { points: newPoints });
      if (onSelectAnchor) onSelectAnchor(node.id, closestIdx + 1);
  };

  const handlePathPointerDown = (e: React.PointerEvent) => {
      if (activeTool === 'pen') {
          onMouseDown(e);
          if (!pathContainerRef.current) return;
          const rect = pathContainerRef.current.getBoundingClientRect();
          const rx = (e.clientX - rect.left) / rect.width;
          const ry = (e.clientY - rect.top) / rect.height;
          insertAnchorAt(rx, ry);
          return;
      }
      onMouseDown(e);
  };

  const pointToSegmentDistance = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const abx = bx - ax;
      const aby = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1)));
      const projX = ax + abx * t;
      const projY = ay + aby * t;
      return Math.hypot(px - projX, py - projY);
  };

  const buildSmoothHandles = (points: Point[], index: number, isClosed: boolean): Partial<Point> => {
      const p = points[index];
      const prev = isClosed ? points[(index - 1 + points.length) % points.length] : points[index - 1];
      const next = isClosed ? points[(index + 1) % points.length] : points[index + 1];

      let dirX = 0;
      let dirY = 0;

      if (prev && next) {
          dirX = next.x - prev.x;
          dirY = next.y - prev.y;
      } else if (next) {
          dirX = next.x - p.x;
          dirY = next.y - p.y;
      } else if (prev) {
          dirX = p.x - prev.x;
          dirY = p.y - prev.y;
      }

      const len = Math.hypot(dirX, dirY) || 1;
      const normX = dirX / len;
      const normY = dirY / len;
      const handleLength = 0.2;

      return { lcx: -normX * handleLength, lcy: -normY * handleLength, rcx: normX * handleLength, rcy: normY * handleLength };
  };

  const insertAnchorAt = (rx: number, ry: number) => {
      if (!node.points || !onUpdateNode) return;
      const points = [...node.points];
      const isClosed = node.closed !== false && points.length > 1;
      const segmentCount = isClosed ? points.length : Math.max(points.length - 1, 0);
      if (segmentCount === 0) return;

      let bestIdx = 0;
      let bestDist = Infinity;

      for (let i = 0; i < segmentCount; i++) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          const dist = pointToSegmentDistance(rx, ry, a.x, a.y, b.x, b.y);
          if (dist < bestDist) {
              bestDist = dist;
              bestIdx = i;
          }
      }

      const newPoint: Point = { x: rx, y: ry };
      if (penPointMode === 'smooth') {
          Object.assign(newPoint, buildSmoothHandles([...points.slice(0, bestIdx + 1), newPoint, ...points.slice(bestIdx + 1)], bestIdx + 1, isClosed));
      }

      points.splice(bestIdx + 1, 0, newPoint);
      onUpdateNode(node.id, { points });
      if (onSelectAnchor) onSelectAnchor(node.id, bestIdx + 1);
      setIsEditing(true);
  };


  // --- Render Different Node Types ---

  // 1. Drawing (Pencil)
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
            className={`absolute top-0 left-0 group ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
            style={{ 
                ...baseStyle, 
                backgroundColor: 'white'
            }}
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

      const strokeStyle: React.CSSProperties = {
          ...commonTextStyle,
          color: 'transparent',
          WebkitTextStroke: node.strokeWidth && node.strokeWidth > 0 ? `${node.strokeWidth}px ${node.strokeColor || '#000'}` : '0',
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'none', 
          zIndex: 0,
      };

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
                cursor: isEditing ? 'text' : 'grab' 
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
                    pointerEvents: isEditing ? 'auto' : 'none'
                }}
                readOnly={!isEditing}
                onPointerDown={(e) => { if (isEditing) e.stopPropagation(); }}
                onPointerMove={(e) => { if (isEditing) e.stopPropagation(); }}
                onBlur={() => setIsEditing(false)}
            />
            {isSelected && (
                 <>
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

  // 5. Shapes (Rectangle, Circle, Triangle, Star, Diamond, Hexagon, Pentagon, Path)
  const isSticky = node.type === 'sticky';
  const isPathClosed = node.type === 'path' ? (node.closed !== false && (node.points?.length || 0) > 1) : true;
  // Use fillColor for shape background, defaulting to node.color for legacy support
  const fill = node.type === 'path' && !isPathClosed ? 'none' : (node.fillColor || node.color || '#ffffff');
  const isFancyFill = typeof fill === 'string' && (fill.includes('gradient') || fill.includes('url('));
  const stroke = node.strokeColor || 'transparent';
  const strokeW = node.strokeWidth || 0;
  const align = node.type === 'path' && !isPathClosed ? 'center' : (node.strokeAlign || 'center');
  
  const commonShapeStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
  };

  // SVG Path Definitions
  let svgPath = '';
  if (node.type === 'rectangle' || node.type === 'sticky') svgPath = `M0,0 h${node.width} v${node.height} h-${node.width} z`;
  else if (node.type === 'circle') svgPath = `M${node.width/2},0 A${node.width/2},${node.height/2} 0 1,1 ${node.width/2},${node.height} A${node.width/2},${node.height/2} 0 1,1 ${node.width/2},0`;
  else if (node.type === 'triangle') svgPath = `M${node.width/2},0 L0,${node.height} L${node.width},${node.height} z`;
  else if (node.type === 'diamond') svgPath = `M${node.width/2},0 L${node.width},${node.height/2} L${node.width/2},${node.height} L0,${node.height/2} z`;
  else if (node.type === 'star') {
      const cx = node.width / 2;
      const cy = node.height / 2;
      const spikes = 5;
      const outerRadius = Math.min(node.width, node.height) / 2;
      const innerRadius = outerRadius / 2.5;
      let path = "";
      for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (Math.PI * i) / spikes - Math.PI / 2;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          path += (i === 0 ? "M" : "L") + x + "," + y;
      }
      svgPath = path + "z";
  }
  else if (node.type === 'pentagon') {
      const w = node.width;
      const h = node.height;
      svgPath = `M${w*0.5},0 L${w},${h*0.38} L${w*0.81},${h} L${w*0.19},${h} L0,${h*0.38} z`;
  }
  else if (node.type === 'hexagon') {
      const w = node.width;
      const h = node.height;
      svgPath = `M${w*0.5},0 L${w},${h*0.25} L${w},${h*0.75} L${w*0.5},${h} L0,${h*0.75} L0,${h*0.25} z`;
  }
  else if (node.type === 'path' && node.points) {
      // Custom Path Generation with Bezier support
      const w = node.width;
      const h = node.height;
      
      const p0 = node.points[0];
      let d = `M ${p0.x * w} ${p0.y * h} `;
      
      for (let i = 1; i < node.points.length; i++) {
          const prev = node.points[i-1];
          const curr = node.points[i];
          
          if (prev.rcx !== undefined && curr.lcx !== undefined) {
              // Cubic Bezier
              // Control points are stored relative to anchor, so add anchor pos
              const cp1x = (prev.x + prev.rcx) * w;
              const cp1y = (prev.y + prev.rcy) * h;
              const cp2x = (curr.x + curr.lcx) * w;
              const cp2y = (curr.y + curr.lcy) * h;
              const x = curr.x * w;
              const y = curr.y * h;
              d += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y} `;
          } else {
              // Line
              d += `L ${curr.x * w} ${curr.y * h} `;
          }
      }
      if (isPathClosed) {
          d += "Z";
      }
      svgPath = d;
  }

  // Calculate clip path based on shape type (non-path shapes only)
  let clipPathValue = undefined;
  if (node.type === 'circle') clipPathValue = 'circle(50% at 50% 50%)';
  else if (node.type === 'triangle') clipPathValue = 'polygon(50% 0%, 0% 100%, 100% 100%)';
  else if (node.type === 'diamond') clipPathValue = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  else if (['star', 'pentagon', 'hexagon'].includes(node.type)) clipPathValue = `path('${svgPath}')`;

  const scaleCorrection = 1/scale; // Make handles constant size regardless of zoom

  return (
    <div
      className={`absolute top-0 left-0 flex items-center justify-center ${isSelected && !isEditing ? 'ring-1 ring-blue-500 z-10' : ''} ${isSticky ? 'shadow-md' : ''}`}
      style={{ ...baseStyle }}
      ref={node.type === 'path' ? pathContainerRef : undefined}
      onPointerDown={node.type === 'path' ? handlePathPointerDown : onMouseDown}
      onDoubleClick={(e) => {
          e.stopPropagation();
          if (onDoubleClick) onDoubleClick();
          if (node.type === 'path') {
              setIsEditing(true);
          }
      }}
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
        For path we render fill via SVG path to avoid CSS clip-path inconsistencies.
      */}
      {node.type === 'path' ? (
        isPathClosed && isFancyFill ? (
          <svg width="100%" height="100%" style={{ position: 'absolute', overflow: 'visible', zIndex: 1, pointerEvents: 'none' }}>
              <defs>
                  <clipPath id={`clip-path-fill-${node.id}`}>
                      <path d={svgPath} />
                  </clipPath>
              </defs>
              <foreignObject width="100%" height="100%" clipPath={`url(#clip-path-fill-${node.id})`}>
                  <div style={{ width: '100%', height: '100%', background: fill, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              </foreignObject>
          </svg>
        ) : (
          <svg width="100%" height="100%" style={{ position: 'absolute', overflow: 'visible', zIndex: 1, pointerEvents: 'none' }}>
              <path d={svgPath} fill={isPathClosed ? fill : 'none'} stroke="none" />
          </svg>
        )
      ) : (
        <div 
          style={{
              ...commonShapeStyle,
              background: fill,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              zIndex: 1,
              clipPath: clipPathValue
          }}
        />
      )}

      {/* 
        Layer 3: Stroke (Center or Inside)
        Rendered ON TOP of fill.
      */}
      {strokeW > 0 && align !== 'outside' && (
          <svg width="100%" height="100%" style={{ position: 'absolute', overflow: 'visible', zIndex: 2, pointerEvents: 'none' }}>
              {align === 'inside' && node.type !== 'path' ? (
                  <>
                    <defs>
                        <clipPath id={`clip-${node.id}`}>
                            <path d={svgPath} />
                        </clipPath>
                    </defs>
                    <path d={svgPath} fill="none" stroke={stroke} strokeWidth={strokeW * 2} clipPath={`url(#clip-${node.id})`} vectorEffect="non-scaling-stroke" />
                  </>
              ) : (
                  <path d={svgPath} fill="none" stroke={stroke} strokeWidth={strokeW} vectorEffect="non-scaling-stroke" />
              )}
          </svg>
      )}

      {/* Text Content: Only for Sticky Notes now. */}
      {node.type === 'sticky' && (
        <textarea
            value={node.content}
            onChange={handleInput}
            className={`relative z-10 w-full h-full bg-transparent resize-none border-none outline-none p-4 text-center flex items-center justify-center`}
            style={{ 
                fontFamily: node.fontFamily || 'Inter, sans-serif',
                fontSize: `${node.fontSize || 16}px`,
                color: '#1e293b',
                textAlign: node.textAlign || 'center'
            }}
            placeholder="Idea..."
        />
      )}
      
      {/* Standard Resize Handles (Not in Edit Mode) */}
      {isSelected && !isEditing && (
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

      {/* Path Edit Mode Overlays */}
      {isEditing && node.type === 'path' && node.points && (
          <svg 
            width="100%" height="100%" 
            style={{ position: 'absolute', overflow: 'visible', zIndex: 50 }}
            onPointerUp={handleControlPointUp}
            onPointerMove={handleControlPointMove}
            onDoubleClick={handlePathSegmentDoubleClick}
          >
              {/* Draw Lines to Control Points */}
              {node.points.map((p, i) => (
                  <g key={`lines-${i}`}>
                      {p.lcx !== undefined && (
                          <line 
                            x1={p.x * node.width} y1={p.y * node.height} 
                            x2={(p.x + p.lcx) * node.width} y2={(p.y + p.lcy) * node.height}
                            stroke="#3b82f6" strokeWidth="1" vectorEffect="non-scaling-stroke"
                          />
                      )}
                      {p.rcx !== undefined && (
                          <line 
                            x1={p.x * node.width} y1={p.y * node.height} 
                            x2={(p.x + p.rcx) * node.width} y2={(p.y + p.rcy) * node.height}
                            stroke="#3b82f6" strokeWidth="1" vectorEffect="non-scaling-stroke"
                          />
                      )}
                  </g>
              ))}

              {/* Draw Anchors & Handles */}
              {node.points.map((p, i) => (
                  <g key={`controls-${i}`}>
                      {/* Left Control Handle */}
                      {p.lcx !== undefined && (
                          <circle 
                            cx={(p.x + p.lcx) * node.width} cy={(p.y + p.lcy) * node.height} r={4 * scaleCorrection}
                            fill="#fff" stroke="#3b82f6" strokeWidth="1"
                            className="cursor-pointer hover:fill-blue-100"
                            onPointerDown={(e) => handleControlPointDown(e, i, 'left')}
                          />
                      )}
                       {/* Right Control Handle */}
                       {p.rcx !== undefined && (
                          <circle 
                            cx={(p.x + p.rcx) * node.width} cy={(p.y + p.rcy) * node.height} r={4 * scaleCorrection}
                            fill="#fff" stroke="#3b82f6" strokeWidth="1"
                            className="cursor-pointer hover:fill-blue-100"
                            onPointerDown={(e) => handleControlPointDown(e, i, 'right')}
                          />
                      )}
                      {/* Anchor Point */}
                      <rect 
                        x={p.x * node.width - (4 * scaleCorrection)} y={p.y * node.height - (4 * scaleCorrection)} 
                        width={8 * scaleCorrection} height={8 * scaleCorrection}
                        fill="#fff" stroke="#3b82f6" strokeWidth="1"
                        className="cursor-pointer hover:fill-blue-100"
                        onPointerDown={(e) => handleControlPointDown(e, i, 'anchor')}
                        onDoubleClick={(e) => handleAnchorDoubleClick(e, i)}
                      />
                  </g>
              ))}
          </svg>
      )}

    </div>
  );
};

export default Node;
