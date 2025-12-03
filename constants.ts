
export const COLORS = {
  yellow: '#fef3c7', // amber-100
  blue: '#dbeafe',   // blue-100
  green: '#dcfce7',  // green-100
  red: '#fee2e2',    // red-100
  purple: '#f3e8ff', // purple-100
  white: '#ffffff',
  slate: '#f1f5f9',
  transparent: 'transparent',
  black: '#000000',
};

export const INITIAL_SCALE = 1;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 5;

export const FONTS = [
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Serif', value: '"Playfair Display", serif' },
  { name: 'Mono', value: '"Roboto Mono", monospace' },
  { name: 'System', value: 'system-ui, sans-serif' },
];

export const FONT_WEIGHTS = [
  { name: 'Thin', value: '100' },
  { name: 'Light', value: '300' },
  { name: 'Regular', value: '400' },
  { name: 'Medium', value: '500' },
  { name: 'Bold', value: '700' },
  { name: 'Black', value: '900' },
];

export const FONT_SIZES = [
  12, 14, 16, 20, 24, 32, 40, 48, 64, 96, 128, 160, 200
];

// Initial tutorial nodes
export const INITIAL_NODES = [
  {
    id: '1',
    type: 'text',
    x: 0,
    y: -100,
    width: 400,
    height: 80,
    content: 'Welcome to Mind Canvas',
    color: 'transparent',
    fillColor: '#1e293b',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'Inter, sans-serif',
    textAlign: 'center',
  },
  {
    id: '2',
    type: 'sticky',
    x: -150,
    y: 50,
    width: 200,
    height: 200,
    content: 'Drag the background to pan.\nScroll to zoom.',
    color: COLORS.yellow,
    fontSize: 16,
    textAlign: 'left',
  },
];
