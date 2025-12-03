
import React, { useState } from 'react';
import { CanvasNode, NodeType } from '../types';
import { 
  IconType, IconSquare, IconCircle, IconTriangle, 
  IconArrowUpRight, IconLine, IconPencil, IconImage, IconStickyNote,
  IconArrowBarLeft, IconStar, IconDiamond, IconPentagon, IconHexagon
} from './Icons';

interface LayersPanelProps {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const getIconForType = (type: NodeType) => {
  switch (type) {
    case 'text': return IconType;
    case 'sticky': return IconStickyNote;
    case 'rectangle': return IconSquare;
    case 'circle': return IconCircle;
    case 'triangle': return IconTriangle;
    case 'star': return IconStar;
    case 'diamond': return IconDiamond;
    case 'pentagon': return IconPentagon;
    case 'hexagon': return IconHexagon;
    case 'arrow': return IconArrowUpRight;
    case 'line': return IconLine;
    case 'draw': return IconPencil;
    case 'image': return IconImage;
    default: return IconSquare;
  }
};

const getNodeName = (node: CanvasNode) => {
  if (node.type === 'image') return 'Image';
  if (node.type === 'draw') return 'Drawing';
  if (node.type === 'line') return 'Line';
  if (node.type === 'arrow') return 'Arrow';
  
  // For text-based nodes, use content or fallback
  const content = node.content?.trim();
  if (content) {
    return content.length > 20 ? content.substring(0, 20) + '...' : content;
  }
  
  // Fallback names
  switch (node.type) {
    case 'sticky': return 'Sticky Note';
    case 'rectangle': return 'Rectangle';
    case 'circle': return 'Circle';
    case 'triangle': return 'Triangle';
    case 'star': return 'Star';
    case 'diamond': return 'Diamond';
    case 'hexagon': return 'Hexagon';
    case 'pentagon': return 'Pentagon';
    case 'text': return 'Text';
    default: return 'Layer';
  }
};

const LayersPanel: React.FC<LayersPanelProps> = ({ nodes, selectedNodeId, onSelectNode, isOpen, onClose }) => {
  // Reverse nodes to show top layer at the top of the list
  const reversedNodes = [...nodes].reverse();

  return (
    <div 
      className={`fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-gray-200 flex flex-col z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100">
        <span className="font-semibold text-slate-800">Layers</span>
        <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-50 rounded-full">{nodes.length}</span>
      </div>
      
      {/* Layers List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
        {nodes.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-xs">
            <p>No layers yet</p>
          </div>
        ) : (
          reversedNodes.map((node) => {
            const Icon = getIconForType(node.type);
            const isSelected = selectedNodeId === node.id;
            
            return (
              <div 
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors select-none ${
                  isSelected 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`p-1.5 rounded-md flex-shrink-0 ${isSelected ? 'bg-indigo-100/50' : 'bg-slate-100 group-hover:bg-white border border-transparent group-hover:border-slate-100'}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="truncate font-medium opacity-90">{getNodeName(node)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Collapse Button */}
      <div className="p-3 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            title="Collapse Panel"
          >
            <IconArrowBarLeft className="w-5 h-5" />
          </button>
      </div>
    </div>
  );
};

export default LayersPanel;