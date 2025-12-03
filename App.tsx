
import React, { useState, useRef, useCallback } from 'react';
import Node from './components/Node';
import Toolbar from './components/Toolbar';
import TextToolbar from './components/TextToolbar';
import AIControls from './components/AIControls';
import LayersPanel from './components/LayersPanel';
import { IconMinus, IconPlus, IconGrid, IconLayers } from './components/Icons';
import { CanvasNode, NodeType, Point, Tool, ViewState } from './types';
import { INITIAL_NODES, COLORS, INITIAL_SCALE, MIN_SCALE, MAX_SCALE } from './constants';
import { generateBrainstormIdeas } from './services/geminiService';

const generateId = () => Math.random().toString(36).substr(2, 9);
const SIDEBAR_WIDTH = 240;

interface ResizeState {
    isResizing: boolean;
    nodeId: string;
    handle: string;
    startPoint: Point;
    startDims: { width: number; height: number; x: number; y: number; fontSize: number };
}

function App() {
  const [nodes, setNodes] = useState<CanvasNode[]>(INITIAL_NODES as any[]);
  const [view, setView] = useState<ViewState>({ scale: INITIAL_SCALE, offsetX: window.innerWidth / 2, offsetY: window.innerHeight / 2 });
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [drawingStart, setDrawingStart] = useState<Point>({ x: 0, y: 0 });

  const [isGenerating, setIsGenerating] = useState(false);
  const [boardName, setBoardName] = useState("Untitled Board");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target === canvasRef.current && isLayersOpen) {
        setIsLayersOpen(false);
    }

    const worldPos = screenToWorld(e.clientX, e.clientY);

    // 1. Panning
    if (activeTool === 'hand' || e.button === 1 || (activeTool === 'select' && e.target === canvasRef.current)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      if (activeTool !== 'hand') setSelectedNodeId(null);
      return;
    }

    // 2. Creating
    if (['rectangle', 'circle', 'triangle', 'arrow', 'line', 'pencil', 'text'].includes(activeTool)) {
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
             setSelectedNodeId(id);
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
            newNode = {
                id, type: activeTool as NodeType, x: worldPos.x, y: worldPos.y, width: 0, height: 0, content: '', color: activeTool === 'rectangle' ? COLORS.blue : COLORS.green
            };
        }

        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(id);
    }
  };

  const handleResizeStart = (e: React.PointerEvent, handle: string) => {
      e.stopPropagation();
      const node = nodes.find(n => n.id === selectedNodeId);
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

            // Simple scaling for non-text
            if (handle.includes('e')) newWidth = startDims.width + dx;
            if (handle.includes('s')) newHeight = startDims.height + dy;
            if (handle.includes('w')) {
                newWidth = startDims.width - dx;
                newX = startDims.x + dx;
            }
            if (handle.includes('n')) {
                newHeight = startDims.height - dy;
                newY = startDims.y + dy;
            }

            // Special logic for Text Scaling
            if (node.type === 'text') {
                if (handle.length === 2) {
                    // Corner drag: Scale Font Size
                    // Ratio based on width change
                    const ratio = newWidth / startDims.width;
                    newFontSize = Math.max(8, startDims.fontSize * ratio);
                    // Height is auto-calculated by Node component usually, but we can scale it too
                    newHeight = startDims.height * ratio; 
                } else {
                    // Side drag: Only change width (Text wraps)
                    newFontSize = startDims.fontSize; // Keep font size
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
    else if (isDrawing && selectedNodeId) {
        setNodes(prev => prev.map(node => {
            if (node.id !== selectedNodeId) return node;
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
    // 4. Dragging Node
    else if (isDragging && selectedNodeId) {
      setNodes(prev => prev.map(node => {
        if (node.id === selectedNodeId) {
          return { ...node, x: worldPos.x - dragStart.x, y: worldPos.y - dragStart.y };
        }
        return node;
      }));
    }
  };

  const handlePointerUp = () => {
    setResizeState(null);
    setIsPanning(false);
    setIsDragging(false);
    setIsDrawing(false);
    if (isDrawing && activeTool !== 'pencil') setActiveTool('select');
  };

  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    setSelectedNodeId(nodeId);
    setIsDragging(true);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setDragStart({ x: worldPos.x - node.x, y: worldPos.y - node.y });
    }
  };

  const updateNodeContent = (id: string, content: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
  };

  const updateNodeStyle = (updates: Partial<CanvasNode>) => {
      if (selectedNodeId) {
          setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, ...updates } : n));
      }
  };

  const handleResizeNode = (id: string, width: number, height: number) => {
    if (!resizeState) { 
        setNodes(prev => prev.map(n => n.id === id ? { ...n, width, height } : n));
    }
  };

  const handleUploadImage = () => fileInputRef.current?.click();
  const handleDeleteNode = () => {
    if (selectedNodeId) {
      setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
      setSelectedNodeId(null);
    }
  };

  const handleAIGenerate = async () => {
      if (!selectedNodeId) return;
      const node = nodes.find(n => n.id === selectedNodeId);
      if (!node) return;
      
      setIsGenerating(true);
      try {
        const ideas = await generateBrainstormIdeas(node);
        // Distribute ideas in a semi-circle around the node
        const radius = 250;
        const angleStep = Math.PI / (ideas.length + 1);
        
        const newNodes = ideas.map((idea, index) => {
            const angle = Math.PI + (index + 1) * angleStep; // Bottom half
            const dx = Math.cos(angle) * radius;
            const dy = Math.sin(angle) * radius * 0.8; // flatten slightly
            
            return {
                id: generateId(),
                type: idea.type,
                x: node.x + dx + (node.width - 200)/2,
                y: node.y + dy + node.height + 50,
                width: 200,
                height: 200,
                content: idea.content,
                color: COLORS[idea.colorKey as keyof typeof COLORS] || COLORS.yellow,
                textAlign: 'left',
                fontSize: 16
            } as CanvasNode;
        });
        
        setNodes(prev => [...prev, ...newNodes]);
      } catch (err) {
        console.error("AI Error", err);
      } finally {
        setIsGenerating(false);
      }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedNodeScreenPos = selectedNode ? worldToScreen(selectedNode.x, selectedNode.y) : null;
  const layoutShiftStyle = { left: isLayersOpen ? `${SIDEBAR_WIDTH + 16}px` : '16px', transition: 'left 0.3s ease-in-out' };

  return (
    <div 
      className="w-full h-screen bg-white relative overflow-hidden select-none font-sans"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <input type="file" ref={fileInputRef} onChange={() => {}} accept="image/*" className="hidden" />

      <LayersPanel 
        nodes={nodes} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId}
        isOpen={isLayersOpen} onClose={() => setIsLayersOpen(false)}
      />

      <div className="fixed top-4 z-50 flex items-center bg-white rounded-full p-1 pl-1 pr-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100 transition-all duration-300" style={layoutShiftStyle}>
        <div className="bg-slate-900 text-white p-2 rounded-full mr-3"><IconGrid className="w-4 h-4" /></div>
        <input value={boardName} onChange={(e) => setBoardName(e.target.value)} className="font-semibold text-slate-700 outline-none bg-transparent placeholder-slate-400 min-w-[100px]" />
      </div>

      <div 
        ref={canvasRef}
        className={`w-full h-full absolute inset-0 ${isPanning ? 'cursor-grab active:cursor-grabbing' : ''}`}
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
          {nodes.map(node => (
            <Node
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              scale={view.scale}
              onMouseDown={(e) => handleNodePointerDown(e, node.id)}
              onChange={updateNodeContent}
              onResize={handleResizeNode}
              onResizeStart={handleResizeStart}
            />
          ))}
          {selectedNodeId && selectedNode && !isDragging && !resizeState && selectedNode.type !== 'text' && (
              <AIControls onGenerate={handleAIGenerate} onDelete={handleDeleteNode} isGenerating={isGenerating} position={selectedNode} />
          )}
        </div>
      </div>

      {selectedNodeId && selectedNode && !isDragging && !resizeState && selectedNode.type === 'text' && selectedNodeScreenPos && (
          <TextToolbar selectedNode={selectedNode} onUpdateNode={updateNodeStyle} position={selectedNodeScreenPos} />
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
