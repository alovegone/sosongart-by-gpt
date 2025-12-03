
export type NodeType = 'sticky' | 'text' | 'rectangle' | 'circle' | 'triangle' | 'star' | 'diamond' | 'hexagon' | 'pentagon' | 'arrow' | 'line' | 'draw' | 'image';

export interface Point {
  x: number;
  y: number;
}

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  
  // Basic Color (used for Shapes/Sticky background, or Text color if basic)
  color: string;
  
  // Advanced Styling
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  
  // Fill & Stroke
  fillColor?: string; // For Text, this is the text color. For shapes, background.
  strokeColor?: string; // Border color / Text Stroke
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  strokeAlign?: 'center' | 'inside' | 'outside';
  opacity?: number;
  aspectRatioLocked?: boolean;

  points?: Point[]; // For drawing, arrows, lines
  src?: string;     // For images
}

export interface ViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export type Tool = 'select' | 'hand' | 'sticky' | 'text' | 'rectangle' | 'circle' | 'triangle' | 'star' | 'diamond' | 'hexagon' | 'pentagon' | 'pencil' | 'arrow' | 'line' | 'image';