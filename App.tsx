
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Node from './components/Node';
import Toolbar from './components/Toolbar';
import TextToolbar from './components/TextToolbar';
import ShapeToolbar from './components/ShapeToolbar';
import LayersPanel from './components/LayersPanel';
import { IconMinus, IconPlus, IconGrid, IconLayers } from './components/Icons';
import { CanvasNode, NodeType, Point, Tool, ViewState } from './types';
import { INITIAL_NODES, COLORS, INITIAL_SCALE, MIN_SCALE, MAX_SCALE } from './constants';

const generateId = () => Math.random().toString(36).substr(2, 9);
const SIDEBAR_WIDTH = 240;

interface ResizeState {
    isResizing: boolean;
    nodeId: string;
    handle: string;
    startPoint: Point;
    startDims: { width: number; height: number; x: number; y: number; fontSize: number };
}

// Selection Box Component
const SelectionBox = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
  <div
    className="absolute border border-indigo-500 bg-indigo-500/10 pointer-events-none z-50"
    style={{
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height
    }}
  />
);

function App() {
  const [nodes, setNodes] = useState<CanvasNode[]>(INITIAL_NODES as any[]);
  const [view, setView] = useState<ViewState>({ scale: INITIAL_SCALE, offsetX: window.innerWidth / 2, offsetY: window.innerHeight / 2 });
  const [activeTool, setActiveTool] = useState<Tool>('select');
  
  // Multi-selection State
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  
  // Box Selection State
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStart, setBoxStart] = useState<Point>({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [drawingStart, setDrawingStart] = useState<Point>({ x: 0, y: 0 });

  // Pen Tool State
  const [penPoints, setPenPoints] = useState<Point[]>([]);
  const [currentPointerPos, setCurrentPointerPos] = useState<Point | null>(null);
  const [isPenDragging, setIsPenDragging] = useState(false);
  const [activePenPointIndex, setActivePenPointIndex] = useState<number | null>(null);

  const [boardName, setBoardName] = useState("Untitled Board");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Skip if typing in an input field
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedNodeIds.length > 0) {
          setNodes(prev => prev.filter(node => !selectedNodeIds.includes(node.id)));
          setSelectedNodeIds([]);
        }
      }
      
      // Cancel Pen Drawing
      if (e.key === 'Escape') {
          if (activeTool === 'pen') {
              setPenPoints([]);
              setActivePenPointIndex(null);
          }
      }
      
      // Enter to finish path
      if (e.key === 'Enter' && activeTool === 'pen' && penPoints.length > 1) {
          finishPenPath();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, activeTool, penPoints]);

  const screenToWorld = useCallback((screenX: number, screenY: number): Point => {
    return {
      x: (screenX - view.offsetX) / view.scale,
      y: (screenY - view.offsetY) / view.scale,
    };
  }, [view]);

  const worldToScreen = useCallback((worldX: number, worldY: number): Point => {
    return {
        x: worldX * view.scale + view.offsetX,
        y: worldY * view.scale + view.offsetY
    };
  }, [view]);

  const finishPenPath = () => {
        if (penPoints.length < 2) {
            setPenPoints([]);
            return;
        }
        
        const xs = penPoints.map(p => p.x);
        const ys = penPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        // Ensure non-zero width/height
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        const id = generateId();
        const newNode: CanvasNode = {
            id,
            type: 'path',
            x: minX,
            y: minY,
            width,
            height,
            content: '',
            color: '#ffffff',
            fillColor: '#dbeafe',
            strokeColor: '#3b82f6',
            strokeWidth: 2,
            // Normalize points AND their handles to 0-1 range relative to bounding box
            points: penPoints.map(p => ({
                x: (p.x - minX) / width,
                y: (p.y - minY) / height,
                lcx: p.lcx ? p.lcx / width : undefined,
                lcy: p.lcy ? p.lcy / height : undefined,
                rcx: p.rcx ? p.rcx / width : undefined,
                rcy: p.rcy ? p.rcy / height : undefined,
            }))
        };
        
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds([id]);
        setPenPoints([]);
        setActivePenPointIndex(null);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target === canvasRef.current && isLayersOpen) {
        setIsLayersOpen(false);
    }

    const worldPos = screenToWorld(e.clientX, e.clientY);

    // 1. Panning (Middle Mouse OR Hand Tool)
    if (activeTool === 'hand' || e.button === 1) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 2. Pen Tool (Advanced)
    if (activeTool === 'pen') {
        e.stopPropagation();
        
        // A. Check if clicking start point to close
        if (penPoints.length > 2) {
            const start = penPoints[0];
            const dist = Math.sqrt(Math.pow(worldPos.x - start.x, 2) + Math.pow(worldPos.y - start.y, 2));
            const threshold = 10 / view.scale;

            if (dist < threshold) {
                finishPenPath();
                return;
            }
        }
        
        // B. Add new point
        const newPoint = { x: worldPos.x, y: worldPos.y };
        setPenPoints(prev => [...prev, newPoint]);
        setActivePenPointIndex(penPoints.length); // Index of the point we just added
        setIsPenDragging(true); // Start drag mode immediately to allow handle creation
        return;
    }

    // 3. Box Selection (Select Tool + Click on Canvas)
    if (activeTool === 'select' && e.target === canvasRef.current) {
        if (!e.shiftKey) {
            setSelectedNodeIds([]); // Clear selection if not adding
        }
        setIsBoxSelecting(true);
        setBoxStart(worldPos);
        setSelectionBox({ x: worldPos.x, y: worldPos.y, width: 0, height: 0 });
        return;
    }

    // 4. Creating New Nodes (Shapes, Text, etc.)
    if (['rectangle', 'circle', 'triangle', 'star', 'diamond', 'hexagon', 'pentagon', 'arrow', 'line', 'pencil', 'text'].includes(activeTool)) {
        setIsDrawing(true);
        setDrawingStart(worldPos);
        const id = generateId();
        
        let newNode: CanvasNode;
        if (activeTool === 'text') {
             newNode = {
                id,
                type: 'text',
                x: worldPos.x,
                y: worldPos.y - 30,
                width: 200, height: 60,
                content: '',
                color: 'transparent',
                fillColor: '#000000',
                fontSize: 24,
                fontFamily: 'Inter, sans-serif'
             };
             setNodes(prev => [...prev, newNode]);
             setSelectedNodeIds([id]);
             setActiveTool('select');
             setIsDrawing(false);
             return;
        } else if (activeTool === 'pencil') {
             newNode = {
                id, type: 'draw', x: worldPos.x, y: worldPos.y, width: 0, height: 0, content: '', color: '#1e293b', points: [{ x: 0, y: 0 }]
             };
        } else if (activeTool === 'line' || activeTool === 'arrow') {
             newNode = {
                id, type: activeTool, x: worldPos.x, y: worldPos.y, width: 0, height: 0, content: '', color: '#64748b', points: [{ x: 0, y: 0 }, { x: 0, y: 0 }]
             };
        } else {
            // Shapes default styling
            newNode = {
                id, 
                type: activeTool as NodeType, 
                x: worldPos.x, 
                y: worldPos.y, 
                width: 0, 
                height: 0, 
                content: '', 
                color: '#ffffff', // Default white background
                fillColor: '#dbeafe', // Default visible color (blue-100)
                strokeColor: '#94a3b8',
                strokeWidth: 1,
                aspectRatioLocked: false
            };
        }

        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds([id]);
    }
  };

  const handleResizeStart = (e: React.PointerEvent, handle: string, nodeId: string) => {
      e.stopPropagation();
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
          setResizeState({
              isResizing: true,
              nodeId: node.id,
              handle,
              startPoint: screenToWorld(e.clientX, e.clientY),
              startDims: { 
                  width: node.width, 
                  height: node.height, 
                  x: node.x, 
                  y: node.y,
                  fontSize: node.fontSize || 16
              }
          });
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    
    // Pen Tool Logic: Dragging creates handles
    if (activeTool === 'pen') {
        setCurrentPointerPos(worldPos);
        
        if (isPenDragging && activePenPointIndex !== null && penPoints[activePenPointIndex]) {
            // Dragging to create bezier handles
            // Current mouse pos is the Out handle (rc)
            const anchor = penPoints[activePenPointIndex];
            const dx = worldPos.x - anchor.x;
            const dy = worldPos.y - anchor.y;

            setPenPoints(prev => {
                const copy = [...prev];
                copy[activePenPointIndex] = {
                    ...anchor,
                    rcx: dx,
                    rcy: dy,
                    lcx: -dx, // Mirror for smooth join
                    lcy: -dy
                };
                return copy;
            });
            return;
        }
    }

    // 1. Resizing
    if (resizeState) {
        const dx = worldPos.x - resizeState.startPoint.x;
        const dy = worldPos.y - resizeState.startPoint.y;
        const { startDims, handle } = resizeState;
        
        setNodes(prev => prev.map(node => {
            if (node.id !== resizeState.nodeId) return node;

            let newWidth = startDims.width;
            let newHeight = startDims.height;
            let newX = startDims.x;
            let newY = startDims.y;
            let newFontSize = startDims.fontSize;

            // Determine dimensions based on handle
            if (handle.includes('e')) newWidth = startDims.width + dx;
            if (handle.includes('w')) { newWidth = startDims.width - dx; newX = startDims.x + dx; }
            if (handle.includes('s')) newHeight = startDims.height + dy;
            if (handle.includes('n')) { newHeight = startDims.height - dy; newY = startDims.y + dy; }

            // Apply Aspect Ratio Lock for Shapes/Images
            if (node.aspectRatioLocked || node.type === 'image') {
                const ratio = startDims.width / startDims.height;
                if (handle.includes('e') || handle.includes('w')) {
                    newHeight = newWidth / ratio;
                    if (handle.includes('n')) newY = startDims.y + (startDims.height - newHeight);
                } else {
                    newWidth = newHeight * ratio;
                    if (handle.includes('w')) newX = startDims.x + (startDims.width - newWidth);
                }
            }

            // Special logic for Text Scaling
            if (node.type === 'text') {
                if (handle.length === 2) {
                    const ratio = newWidth / startDims.width;
                    newFontSize = Math.max(8, startDims.fontSize * ratio);
                    newHeight = startDims.height * ratio; 
                } else {
                    newFontSize = startDims.fontSize; 
                }
            }

            return {
                ...node,
                x: newX, y: newY,
                width: Math.max(10, newWidth),
                height: Math.max(10, newHeight),
                fontSize: Math.round(newFontSize)
            };
        }));
        return;
    }

    // 2. Panning
    if (isPanning) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setView(prev => ({ ...prev, offsetX: prev.offsetX + dx, offsetY: prev.offsetY + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } 
    // 3. Drawing
    else if (isDrawing && selectedNodeIds.length === 1) {
        const activeId = selectedNodeIds[0];
        setNodes(prev => prev.map(node => {
            if (node.id !== activeId) return node;
            if (node.type === 'draw') {
                const newPoint = { x: worldPos.x - node.x, y: worldPos.y - node.y };
                return { ...node, width: Math.max(node.width, newPoint.x), height: Math.max(node.height, newPoint.y), points: [...(node.points || []), newPoint] };
            }
            if (node.type === 'line' || node.type === 'arrow') {
                return { ...node, points: [{ x: 0, y: 0 }, { x: worldPos.x - node.x, y: worldPos.y - node.y }] };
            }
            const dx = worldPos.x - drawingStart.x;
            const dy = worldPos.y - drawingStart.y;
            return {
                ...node,
                x: dx < 0 ? worldPos.x : drawingStart.x,
                y: dy < 0 ? worldPos.y : drawingStart.y,
                width: Math.abs(dx),
                height: Math.abs(dy)
            };
        }));
    }
    // 4. Box Selection Updating
    else if (isBoxSelecting) {
        const x = Math.min(boxStart.x, worldPos.x);
        const y = Math.min(boxStart.y, worldPos.y);
        const width = Math.abs(worldPos.x - boxStart.x);
        const height = Math.abs(worldPos.y - boxStart.y);
        setSelectionBox({ x, y, width, height });
    }
    // 5. Dragging Node(s)
    else if (isDragging && selectedNodeIds.length > 0) {
      const dx = worldPos.x - dragStart.x;
      const dy = worldPos.y - dragStart.y;
      
      setNodes(prev => prev.map(node => {
        if (selectedNodeIds.includes(node.id)) {
          return { ...node, x: node.x + dx, y: node.y + dy };
        }
        return node;
      }));
      setDragStart(worldPos);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeTool === 'pen') {
        setIsPenDragging(false);
        // Do not reset activePenPointIndex here, user might just click again to continue path
    }

    if (isBoxSelecting && selectionBox) {
        // Find intersecting nodes
        const selected = nodes.filter(node => 
            node.x < selectionBox.x + selectionBox.width &&
            node.x + node.width > selectionBox.x &&
            node.y < selectionBox.y + selectionBox.height &&
            node.y + node.height > selectionBox.y
        ).map(n => n.id);

        setSelectedNodeIds(prev => {
            if (e.shiftKey) {
                // Add to selection (Union)
                return Array.from(new Set([...prev, ...selected]));
            }
            return selected;
        });
        
        setSelectionBox(null);
        setIsBoxSelecting(false);
    }

    setResizeState(null);
    setIsPanning(false);
    setIsDragging(false);
    setIsDrawing(false);
    if (isDrawing && activeTool !== 'pencil') setActiveTool('select');
  };

  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    
    // Multi-select Logic
    if (e.shiftKey) {
        if (selectedNodeIds.includes(nodeId)) {
            setSelectedNodeIds(prev => prev.filter(id => id !== nodeId));
            setIsDragging(false); // Don't drag if we just deselected
            return;
        } else {
            setSelectedNodeIds(prev => [...prev, nodeId]);
        }
    } else {
        if (!selectedNodeIds.includes(nodeId)) {
            setSelectedNodeIds([nodeId]);
        }
    }

    setIsDragging(true);
    // Set start point in World Coordinates for drag calculations
    setDragStart(screenToWorld(e.clientX, e.clientY));
  };

  const updateNodeContent = (id: string, content: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
  };

  const updateNodeStyle = (updates: Partial<CanvasNode>) => {
      if (selectedNodeIds.length > 0) {
          setNodes(prev => prev.map(n => selectedNodeIds.includes(n.id) ? { ...n, ...updates } : n));
      }
  };
  
  const updateNodePoints = (id: string, updates: Partial<CanvasNode>) => {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const handleResizeNode = (id: string, width: number, height: number) => {
    if (!resizeState) { 
        setNodes(prev => prev.map(n => n.id === id ? { ...n, width, height } : n));
    }
  };

  const handleUploadImage = () => fileInputRef.current?.click();

  const handleLayerSelect = (id: string, multi: boolean) => {
      if (multi) {
          if (selectedNodeIds.includes(id)) {
              setSelectedNodeIds(prev => prev.filter(nid => nid !== id));
          } else {
              setSelectedNodeIds(prev => [...prev, id]);
          }
      } else {
          setSelectedNodeIds([id]);
      }
  };

  // Logic for toolbars: Use the LAST selected node as the "Primary" for reading values
  const primarySelectedNode = selectedNodeIds.length > 0 ? nodes.find(n => n.id === selectedNodeIds[selectedNodeIds.length - 1]) : null;
  const primaryNodeScreenPos = primarySelectedNode ? worldToScreen(primarySelectedNode.x, primarySelectedNode.y) : null;
  
  const layoutShiftStyle = { left: isLayersOpen ? `${SIDEBAR_WIDTH + 16}px` : '16px', transition: 'left 0.3s ease-in-out' };

  // Calculate Pen Snap State
  const isSnapToStart = activeTool === 'pen' && penPoints.length > 2 && currentPointerPos && Math.sqrt(Math.pow(currentPointerPos.x - penPoints[0].x, 2) + Math.pow(currentPointerPos.y - penPoints[0].y, 2)) < (10 / view.scale);

  // Generate SVG Path String for Preview
  const getPenPreviewPath = () => {
      if (penPoints.length === 0) return '';
      let d = `M ${penPoints[0].x} ${penPoints[0].y} `;
      for (let i = 1; i < penPoints.length; i++) {
          const prev = penPoints[i-1];
          const curr = penPoints[i];
          if (prev.rcx !== undefined && curr.lcx !== undefined) {
             d += `C ${prev.x + prev.rcx} ${prev.y + prev.rcy}, ${curr.x + curr.lcx} ${curr.y + curr.lcy}, ${curr.x} ${curr.y} `;
          } else {
             d += `L ${curr.x} ${curr.y} `;
          }
      }
      // Rubber band line to mouse
      if (currentPointerPos && !isPenDragging) {
         d += `L ${currentPointerPos.x} ${currentPointerPos.y}`;
      }
      return d;
  };

  return (
    <div 
      className="w-full h-screen bg-white relative overflow-hidden select-none font-sans"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <input type="file" ref={fileInputRef} onChange={() => {}} accept="image/*" className="hidden" />

      <LayersPanel 
        nodes={nodes} selectedNodeIds={selectedNodeIds} onSelectNode={handleLayerSelect}
        isOpen={isLayersOpen} onClose={() => setIsLayersOpen(false)}
      />

      <div className="fixed top-4 z-50 flex items-center bg-white rounded-full p-1 pl-1 pr-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100 transition-all duration-300" style={layoutShiftStyle}>
        <div className="bg-slate-900 text-white p-2 rounded-full mr-3"><IconGrid className="w-4 h-4" /></div>
        <input value={boardName} onChange={(e) => setBoardName(e.target.value)} className="font-semibold text-slate-700 outline-none bg-transparent placeholder-slate-400 min-w-[100px]" />
      </div>

      <div 
        ref={canvasRef}
        className={`w-full h-full absolute inset-0 ${isPanning ? 'cursor-grab active:cursor-grabbing' : activeTool === 'pen' ? 'cursor-crosshair' : ''}`}
        onPointerDown={handlePointerDown}
        onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              const zoomSensitivity = 0.001;
              const delta = -e.deltaY * zoomSensitivity;
              const newScale = Math.min(Math.max(view.scale * (1 + delta), MIN_SCALE), MAX_SCALE);
              const cursorWorld = screenToWorld(e.clientX, e.clientY);
              setView({ scale: newScale, offsetX: e.clientX - cursorWorld.x * newScale, offsetY: e.clientY - cursorWorld.y * newScale });
            } else {
              setView(prev => ({ ...prev, offsetX: prev.offsetX - e.deltaX, offsetY: prev.offsetY - e.deltaY }));
            }
        }}
        style={{ backgroundColor: '#ffffff' }}
      >
        <div style={{ transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})`, transformOrigin: '0 0', position: 'absolute' }}>
          {selectionBox && (
              <SelectionBox rect={selectionBox} />
          )}
          
          {nodes.map(node => (
            <Node
              key={node.id}
              node={node}
              isSelected={selectedNodeIds.includes(node.id)}
              scale={view.scale}
              onMouseDown={(e) => handleNodePointerDown(e, node.id)}
              onChange={updateNodeContent}
              onResize={handleResizeNode}
              onResizeStart={(e, handle) => handleResizeStart(e, handle, node.id)}
              onUpdateNode={updateNodePoints}
            />
          ))}

          {/* Render Active Pen Path */}
          {activeTool === 'pen' && penPoints.length > 0 && (
              <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" style={{ zIndex: 100 }}>
                <path 
                    d={getPenPreviewPath()}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                />
                {penPoints.map((p, i) => (
                    <g key={i}>
                        {/* Anchor */}
                        <circle cx={p.x} cy={p.y} r={3/view.scale} fill="#fff" stroke="#3b82f6" strokeWidth={1/view.scale} />
                        {/* Handles (Visual feedback while drawing) */}
                        {p.rcx && (
                            <>
                                <line x1={p.x} y1={p.y} x2={p.x+p.rcx} y2={p.y+p.rcy} stroke="#3b82f6" strokeWidth={1/view.scale} opacity="0.5" />
                                <circle cx={p.x+p.rcx} cy={p.y+p.rcy} r={2/view.scale} fill="#3b82f6" />
                            </>
                        )}
                        {p.lcx && (
                            <>
                                <line x1={p.x} y1={p.y} x2={p.x+p.lcx} y2={p.y+p.lcy} stroke="#3b82f6" strokeWidth={1/view.scale} opacity="0.5" />
                                <circle cx={p.x+p.lcx} cy={p.y+p.lcy} r={2/view.scale} fill="#3b82f6" />
                            </>
                        )}
                    </g>
                ))}
                {isSnapToStart && (
                    <circle cx={penPoints[0].x} cy={penPoints[0].y} r={8/view.scale} fill="rgba(59, 130, 246, 0.5)" />
                )}
              </svg>
          )}

        </div>
      </div>

      {primarySelectedNode && !isDragging && !resizeState && primaryNodeScreenPos && (
          <>
            {primarySelectedNode.type === 'text' && (
                <TextToolbar selectedNode={primarySelectedNode} onUpdateNode={updateNodeStyle} position={primaryNodeScreenPos} />
            )}
            {['rectangle', 'circle', 'triangle', 'star', 'diamond', 'hexagon', 'pentagon', 'path'].includes(primarySelectedNode.type) && (
                <ShapeToolbar selectedNode={primarySelectedNode} onUpdateNode={updateNodeStyle} position={primaryNodeScreenPos} />
            )}
          </>
      )}

      <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} onUploadImage={handleUploadImage} style={layoutShiftStyle} />

      <div className="fixed bottom-4 z-50 flex items-center bg-white rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-1 transition-all duration-300" style={layoutShiftStyle}>
        <button className={`p-2 rounded-full transition-colors ${isLayersOpen ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 text-slate-500'}`} onClick={() => setIsLayersOpen(!isLayersOpen)}><IconLayers className="w-4 h-4" /></button>
        <div className="w-px h-4 bg-gray-200 mx-1"></div>
        <button className="p-2 hover:bg-slate-50 rounded-full text-slate-600" onClick={() => setView(v => ({ ...v, scale: Math.max(v.scale * 0.8, MIN_SCALE) }))}><IconMinus className="w-3 h-3" /></button>
        <span className="text-xs font-medium text-slate-600 w-10 text-center">{Math.round(view.scale * 100)}%</span>
        <button className="p-2 hover:bg-slate-50 rounded-full text-slate-600" onClick={() => setView(v => ({ ...v, scale: Math.min(v.scale * 1.2, MAX_SCALE) }))}><IconPlus className="w-3 h-3" /></button>
      </div>
    </div>
  );
}

export default App;
