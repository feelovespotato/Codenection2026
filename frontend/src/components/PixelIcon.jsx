// Original 16 × 16 UI sprites. Integer coordinates keep every edge on the pixel grid.
const sprites = {
  book: [['ink', 'M1 2h6l1 1 1-1h6v12H9l-1 1-1-1H1z'], ['paper', 'M2 3h4v1h1v8H2zm8 0h4v9H9V4h1z'], ['peach', 'M2 4h3v1H2zm0 3h3v1H2zm8-3h3v1h-3zm0 3h3v1h-3z']],
  calendar: [['ink', 'M2 2h2V1h2v1h4V1h2v1h2v13H2z'], ['red', 'M3 3h10v3H3z'], ['paper', 'M3 7h10v7H3z'], ['teal', 'M4 8h2v2H4zm3 0h2v2H7zm3 0h2v2h-2zm-6 3h2v2H4zm3 0h2v2H7z']],
  face: [['ink', 'M4 1h8v1h2v2h1v8h-1v2h-2v1H4v-1H2v-2H1V4h1V2h2z'], ['gold', 'M4 2h8v1h1v2h1v6h-1v2h-2v1H5v-1H3v-2H2V5h1V3h1z'], ['ink', 'M4 5h2v2H4zm6 0h2v2h-2zM4 9h2v2h4V9h2v3H4z']],
  hourglass: [['ink', 'M3 1h10v2h-1v3l-3 2 3 2v3h1v2H3v-2h1v-3l3-2-3-2V3H3z'], ['paper', 'M5 3h6v2L8 7 5 5zm3 6 3 2v2H5v-2z'], ['gold', 'M5 4h6v1L8 7 5 5zm3 6 3 2v1H5v-1z']],
  phone: [['ink', 'M4 1h8v1h1v12h-1v1H4v-1H3V2h1z'], ['teal', 'M4 3h8v9H4z'], ['paper', 'M6 2h4v1H6zm1 11h2v1H7z'], ['gold', 'M5 5h2v2H5zm3 3h3v2H8z']],
  speaker: [['ink', 'M1 6h3l4-4h2v12H8l-4-4H1zm11-2h2v2h1v4h-1v2h-2v-2h1V6h-1z'], ['teal', 'M2 7h3l3-3v8l-3-3H2z']],
  help: [['ink', 'M3 1h10v1h1v12h-1v1H3v-1H2V2h1z'], ['gold', 'M3 2h10v12H3z'], ['ink', 'M5 4h6v4H9v2H7V7h2V6H7v1H5zm2 7h2v2H7z']],
  graph: [['ink', 'M1 2h1v12h13v1H1z'], ['teal', 'M3 9h3v4H3z'], ['gold', 'M7 6h3v7H7z'], ['red', 'M11 3h3v10h-3z']],
  leaf: [['ink', 'M9 1h5v5h-1v2h-2v2H8v2H6v3H4v-4H2V9H1V5h4v1h2V4h1V2h1z'], ['teal', 'M9 3h3v3h-1v2H8V6h1zM3 7h2v1h2v2H5V9H3z'], ['gold', 'M5 11h1v3H5z']],
  save: [['ink', 'M2 1h10l3 3v11H1V1z'], ['teal', 'M2 2h10l2 2v10H2z'], ['paper', 'M4 2h7v4H4zm0 7h8v5H4z'], ['ink', 'M9 2h1v3H9zm-4 8h6v1H5zm0 2h6v1H5z']],
  shuffle: [['ink', 'M2 3h4l5 7h2V8l3 3-3 3v-2h-3L5 5H2zm8 0h3V1l3 3-3 3V5h-2L9 8 8 6zM2 10h3l1-2 2 2-2 2H2z']],
  sparkle: [['gold', 'M7 0h2v5h2v2h5v2h-5v2H9v5H7v-5H5V9H0V7h5V5h2z'], ['paper', 'M7 6h2v1h1v2H9v1H7V9H6V7h1z']],
  cloud: [['ink', 'M5 2h5v1h2v2h2v2h1v5H1V7h1V5h3z'], ['paper', 'M6 3h3v1h2v2h2v2h1v3H2V8h1V6h3z'], ['teal', 'M3 10h10v1H3z']],
  rain: [['ink', 'M5 1h5v1h2v2h2v2h1v4H1V6h1V4h3z'], ['paper', 'M6 2h3v1h2v2h2v2h1v2H2V7h1V5h3z'], ['teal', 'M4 11h2v3H4zm4 1h2v3H8zm4-1h2v3h-2z']],
  tree: [['ink', 'M7 1h2v2h2v2h2v3h2v4h-5v3H6v-3H1V8h2V5h2V3h2z'], ['teal', 'M7 3h2v2h2v3h2v3H3V8h2V5h2z'], ['peach', 'M7 12h2v3H7z']],
  piano: [['ink', 'M1 3h14v11H1z'], ['paper', 'M2 4h12v9H2z'], ['ink', 'M4 4h1v9H4zm3 0h1v9H7zm3 0h1v9h-1zM3 4h2v5H3zm3 0h2v5H6zm5 0h2v5h-2z']],
  bird: [['ink', 'M8 2h4v2h2v2h2v2h-4v3h-2v2H4v-1H2V9H1V5h2l4 4V4h1z'], ['red', 'M9 3h2v4h1v3h-2v2H4v-1H3V9H2V7l5 4h2z'], ['gold', 'M12 5h2v2h-2z'], ['paper', 'M10 4h1v1h-1z']],
  water: [['ink', 'M7 1h2v2h1v2h2v2h1v2h1v4h-2v2H4v-2H2V9h1V7h1V5h2V3h1z'], ['teal', 'M7 3h2v2h1v2h2v3h1v2h-2v2H5v-2H3v-2h1V7h2V5h1z'], ['paper', 'M5 8h1v3H5z']],
  screen: [['ink', 'M1 2h14v10H9v1h3v2H4v-2h3v-1H1z'], ['teal', 'M2 3h12v8H2z'], ['paper', 'M3 4h6v1H3zm0 2h4v1H3z']],
  headphones: [['ink', 'M5 1h6v1h2v2h1v2h1v7h-4V7h2V5h-1V3h-2V2H6v1H4v2H3v2h2v6H1V6h1V4h1V2h2z'], ['peach', 'M2 8h2v4H2zm10 0h2v4h-2z']],
  heart: [['ink', 'M2 2h4l2 2 2-2h4v1h1v6l-7 6-7-6V3h1z'], ['red', 'M3 3h2l3 3 3-3h2v1h1v4l-6 5-6-5V4h1z'], ['paper', 'M3 4h2v1H3z']],
  close: [['ink', 'M3 2h2l3 4 3-4h2v2l-3 4 3 4v2h-2l-3-4-3 4H3v-2l3-4-3-4z']],
}
const aliases = {
  '📖': 'book', '📚': 'book', '📅': 'calendar', '😄': 'face', '😊': 'face', '🙂': 'face', '😌': 'face', '😐': 'face', '😣': 'face', '😫': 'face',
  '⏳': 'hourglass', '📱': 'phone', '📻': 'speaker', '🔊': 'speaker', '🔈': 'speaker', '🔇': 'speaker', '❓': 'help', '💡': 'help',
  '📊': 'graph', '🌿': 'leaf', '🪴': 'leaf', '💾': 'save', '🔄': 'shuffle', '✨': 'sparkle', '🌧️': 'rain', '🌲': 'tree',
  '🎹': 'piano', '🐦': 'bird', '🌊': 'water', '💧': 'water', '💻': 'screen', '🎧': 'headphones', '❤️': 'heart', '✕': 'close',
  '🧠': 'graph', '👥': 'face', '🫁': 'leaf', '🧹': 'shuffle', '🎮': 'screen', '📋': 'book', '☁️': 'cloud', '⛅': 'cloud',
  '🤩': 'face', '🥱': 'face', '😢': 'face', '😡': 'face', '😔': 'face', '😰': 'face', '😴': 'face', '😎': 'face',
  '📝': 'book', '💭': 'cloud', '😤': 'face',
}
const palette = { ink: '#392c32', paper: '#fff4d8', peach: '#eaae82', gold: '#eac66a', teal: '#6caaa2', red: '#c56958' }

export default function PixelIcon({ symbol, name, className = '' }) {
  const sprite = sprites[name || aliases[symbol]]
  if (!sprite) return <span className={className}>{symbol}</span>
  const faces = {
    '😌': ['gold', 'M4 6h3v1H4zm5 0h3v1H9zM5 10h1v1h4v-1h1v2H5z'],
    '🙂': ['gold', 'M4 5h2v2H4zm6 0h2v2h-2zM5 10h1v1h4v-1h1v2H5z'],
    '😐': ['gold', 'M4 5h2v2H4zm6 0h2v2h-2zM5 10h6v1H5z'],
    '😣': ['peach', 'M4 4h1v1h2v1H5v1H4zm7 0h1v3h-1V6H9V5h2zM5 10h1V9h4v1h1v2h-1v-1H6v1H5z'],
    '😫': ['red', 'M4 4h3v1H5v1h2v1H4zm5 0h3v3H9V6h1V5H9zM5 10h1V9h4v1h1v3H5z'],
    '😢': ['teal', 'M4 5h2v2H4zm6 0h2v2h-2zM5 11h1v-1h4v1h1v1H5zM3 8h1v2H3z'],
    '😡': ['red', 'M3 4h2v1h2v2H5V6H3zm8 0h2v2h-2v1H9V5h2zM5 11h1v-1h4v1h1v1H5z'],
    '🥱': ['peach', 'M4 6h3v1H4zm5 0h3v1H9zM6 9h4v4H6z'],
    '🤩': ['gold', 'M4 4h1v1h2v1H5v2H4V6H2V5h2zm7 0h1v1h2v1h-2v2h-1V6H9V5h2zM5 10h6v2H5z'],
  }
  const expression = faces[symbol] || faces[{'😔': '😢', '😰': '😣', '😤': '😡', '😴': '🥱'}[symbol]]
  const layers = expression && aliases[symbol] === 'face' ? [sprite[0], [expression[0], sprite[1][1]], ['ink', expression[1]]] : sprite
  return <svg className={`pixel-icon ${className}`} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    {layers.map(([color, d], index) => <path key={index} fill={palette[color]} d={d} />)}
  </svg>
}
