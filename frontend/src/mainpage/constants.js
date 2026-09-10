export const VIRTUAL_WIDTH = 1280
export const VIRTUAL_HEIGHT = 720

export const FEMALE_WIDTH = 367
export const FEMALE_HEIGHT = 550
export const FEMALE_Y = VIRTUAL_HEIGHT - FEMALE_HEIGHT + 25
export const FEMALE_SPEED = 300

export const DOG_WIDTH = 234
export const DOG_HEIGHT = 215
export const DOG_Y = 495
export const DOG_SPEED = 180
export const DOG_IDLE_SECONDS = 5

export const RAIN_COUNT = 100

export const ICONS = [
  { id: 'hourglass', src: '/moodify/hourglass.png', x: 130, y: 355, label: 'Breathing timer', layer: 'behind' },
  { id: 'diary', src: '/moodify/diary.png', x: 920, y: 455, label: 'Diary', layer: 'behind' },
  { id: 'mood', src: '/moodify/mood-tracker.png', x: 350, y: 70, label: 'Mood tracker', layer: 'behind' },
  { id: 'calendar', src: '/moodify/calendar.png', x: 370, y: 140, label: 'Calendar', layer: 'behind' },
  { id: 'graph', src: '/moodify/bar-graph.png', x: 500, y: 154, label: 'Progress graph', layer: 'front' },
  { id: 'phone', src: '/moodify/pixel-chat.svg', x: 1185, y: 260, label: 'Open chat rooms', layer: 'front' },
  { id: 'instructions', src: '/moodify/pixel-help.svg', x: 1189, y: 170, label: 'How to play', layer: 'front' },
]

export const HOTSPOTS = [
  { id: 'picture', x: 90, y: 55, width: 250, height: 180 },
  { id: 'teddy', x: 1150, y: 420, width: 80, height: 120 },
  { id: 'cockroach', x: 54, y: 550, width: 40, height: 50 },
  { id: 'sofa', x: 220, y: 470, width: 530, height: 180 },
]
