import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js'

const WIDTH = 1280
const HEIGHT = 720
const WALKABLE_FLOOR = [
  { x: 205, y: 382 },
  { x: 515, y: 220 },
  { x: 1135, y: 382 },
  { x: 1135, y: 515 },
  { x: 640, y: 685 },
  { x: 195, y: 490 },
]
const ROOM_BACKGROUND = '/moodify/social-backgrounds/large-cozy-room.png'
const CHARACTER_ROWS = 4
const CHARACTER_SHEETS = {
  idle: { source: '/moodify/characters/moodify-mascots-idle-v4.png', columns: 4 },
  left: { source: '/moodify/characters/moodify-mascots-walk-left-v3.png', columns: 3 },
  right: { source: '/moodify/characters/moodify-mascots-walk-right-v3.png', columns: 3 },
}

function polygon(graphics, points, color, stroke) {
  graphics.poly(points).fill(color)
  if (stroke) graphics.stroke(stroke)
  return graphics
}

async function addRoomBackground(world) {
  const texture = await Assets.load(ROOM_BACKGROUND)
  texture.source.scaleMode = 'nearest'
  const background = new Sprite(texture)
  const coverScale = Math.max(WIDTH / texture.width, HEIGHT / texture.height)
  background.anchor.set(0.5)
  background.position.set(WIDTH / 2, HEIGHT / 2)
  background.scale.set(coverScale)
  background.zIndex = 0
  world.addChild(background)

  const warmth = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill({ color: '#402b30', alpha: 0.08 })
  warmth.zIndex = 1
  world.addChild(warmth)
  return ROOM_BACKGROUND
}

async function loadAvatarFrames() {
  const entries = Object.entries(CHARACTER_SHEETS)
  const sheets = await Promise.all(entries.map(async ([name, definition]) => {
    const sheet = await Assets.load(definition.source)
    sheet.source.scaleMode = 'nearest'
    const frameWidth = sheet.width / definition.columns
    const frameHeight = sheet.height / CHARACTER_ROWS
    const rows = Array.from({ length: CHARACTER_ROWS }, (_, row) => (
      Array.from({ length: definition.columns }, (_, column) => new Texture({
        source: sheet.source,
        frame: new Rectangle(column * frameWidth, row * frameHeight, frameWidth, frameHeight),
      }))
    ))
    return [name, rows]
  }))

  const framesByAnimation = Object.fromEntries(sheets)
  return Array.from({ length: CHARACTER_ROWS }, (_, row) => ({
    idle: framesByAnimation.idle[row],
    left: framesByAnimation.left[row],
    right: framesByAnimation.right[row],
  }))
}

// Retained as a code-drawn fallback room if an asset-free mode is needed later.
// eslint-disable-next-line no-unused-vars
function drawRoom(world) {
  const backdrop = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill('#49635c')
  world.addChild(backdrop)

  const shadow = new Graphics()
  polygon(shadow, [640, 82, 1192, 365, 640, 690, 72, 385], '#314a43')
  shadow.alpha = 0.55
  shadow.position.set(12, 13)
  world.addChild(shadow)

  const shell = new Graphics()
  polygon(shell, [640, 54, 1192, 337, 640, 657, 72, 357], '#d7b079', { color: '#3b2c29', width: 8 })
  polygon(shell, [640, 68, 1172, 341, 640, 638, 94, 353], '#b97c4f', { color: '#664236', width: 4 })
  world.addChild(shell)

  // Isometric wooden floorboards.
  const floorLines = new Graphics()
  for (let offset = -460; offset <= 460; offset += 38) {
    floorLines.moveTo(640 + offset, 102 + Math.abs(offset) * 0.5)
    floorLines.lineTo(640 + offset, 615 - Math.abs(offset) * 0.48)
  }
  for (let y = 155; y < 610; y += 42) {
    const half = Math.min(500, (y - 70) * 1.75, (650 - y) * 1.75)
    floorLines.moveTo(640 - half, y).lineTo(640 + half, y)
  }
  floorLines.stroke({ color: '#8f5c42', width: 2, alpha: 0.38 })
  world.addChild(floorLines)

  // Back walls, windows and curtains.
  const walls = new Graphics()
  polygon(walls, [640, 54, 94, 333, 94, 203, 640, 0], '#e9cfaa', { color: '#51352f', width: 6 })
  polygon(walls, [640, 54, 1172, 320, 1172, 188, 640, 0], '#dfbd91', { color: '#51352f', width: 6 })
  polygon(walls, [235, 174, 445, 85, 445, 206, 235, 289], '#9ec5bf', { color: '#674535', width: 7 })
  walls.rect(256, 169, 8, 101).fill('#f9e8c8').rect(350, 126, 8, 105).fill('#f9e8c8')
  walls.rect(225, 160, 26, 127).fill('#bd7655').rect(432, 75, 27, 135).fill('#bd7655')
  polygon(walls, [760, 72, 945, 158, 945, 267, 760, 177], '#a5cbc4', { color: '#674535', width: 7 })
  walls.rect(846, 110, 8, 108).fill('#f9e8c8')
  world.addChild(walls)

  addRug(world)
  addSofa(world)
  addCoffeeTable(world)
  addBookshelf(world)
  addLamp(world)
  addPlants(world)
  addCozyDetails(world)
  addDoor(world)
}

function addRug(world) {
  const rug = new Graphics()
  polygon(rug, [640, 330, 884, 452, 640, 586, 390, 456], '#d9aa86', { color: '#765145', width: 5 })
  polygon(rug, [640, 350, 846, 453, 640, 562, 430, 455], '#f0d5aa', { color: '#9b6d56', width: 3 })
  polygon(rug, [640, 378, 794, 454, 640, 535, 482, 454], '#8aa49a', { color: '#9b6d56', width: 3 })
  rug.zIndex = 320
  world.addChild(rug)
}

function addSofa(world) {
  const sofa = new Graphics()
  sofa.roundRect(-112, -62, 224, 88, 12).fill('#79968a').stroke({ color: '#3e4f49', width: 6 })
  sofa.roundRect(-122, -25, 244, 70, 12).fill('#91aa98').stroke({ color: '#3e4f49', width: 6 })
  sofa.rect(-102, -10, 91, 38).fill('#9db4a3').rect(11, -10, 91, 38).fill('#9db4a3')
  sofa.rect(-104, 43, 15, 24).fill('#5b4539').rect(89, 43, 15, 24).fill('#5b4539')
  sofa.position.set(340, 382)
  sofa.zIndex = 385
  world.addChild(sofa)
}

function addCoffeeTable(world) {
  const table = new Graphics()
  polygon(table, [-92, -18, 0, -60, 96, -14, 0, 34], '#a96f49', { color: '#5e3c31', width: 5 })
  table.rect(-76, 20, 12, 50).fill('#5e3c31').rect(62, 22, 12, 48).fill('#5e3c31')
  table.circle(-22, -18, 13).fill('#f4ddb8').stroke({ color: '#6c4738', width: 3 })
  table.circle(36, -12, 10).fill('#d7875e').stroke({ color: '#6c4738', width: 3 })
  table.position.set(620, 475)
  table.zIndex = 510
  world.addChild(table)
}

function addBookshelf(world) {
  const shelf = new Graphics()
  shelf.rect(-66, -154, 132, 190).fill('#835438').stroke({ color: '#4a3029', width: 6 })
  for (let y = -112; y <= -15; y += 48) shelf.rect(-57, y, 114, 7).fill('#4a3029')
  const colors = ['#b85f4b', '#d9a64c', '#5d8379', '#6d668f', '#d7885f']
  let book = 0
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      shelf.rect(-51 + column * 15, -142 + row * 48, 10, 28 + ((row + column) % 3) * 3).fill(colors[book % colors.length])
      book += 1
    }
  }
  shelf.position.set(982, 295)
  shelf.zIndex = 300
  world.addChild(shelf)
}

function addLamp(world) {
  const lamp = new Graphics()
  lamp.rect(-4, -112, 8, 105).fill('#4c3830').circle(0, 0, 12).fill('#594036')
  polygon(lamp, [-32, -117, 32, -117, 22, -72, -22, -72], '#f6bd68', { color: '#75503e', width: 4 })
  lamp.circle(0, -92, 48).fill({ color: '#ffd98a', alpha: 0.12 })
  lamp.position.set(540, 270)
  lamp.zIndex = 275
  world.addChild(lamp)
}

function plant(x, y, scale = 1) {
  const item = new Graphics()
  item.ellipse(0, 8, 25, 14).fill('#84563e').rect(-18, 7, 36, 35).fill('#a76545')
  const leaves = [[0, -22], [-20, -7], [18, -8], [-13, -30], [14, -34], [0, -48]]
  leaves.forEach(([leafX, leafY], index) => {
    item.ellipse(leafX, leafY, 13, 25).fill(index % 2 ? '#4f7357' : '#668b62')
  })
  item.scale.set(scale)
  item.position.set(x, y)
  item.zIndex = y
  return item
}

function addPlants(world) {
  world.addChild(plant(168, 386, 1.15), plant(1090, 400, 1), plant(730, 245, 0.72))
}

function addCozyDetails(world) {
  const details = new Graphics()

  // Pixel cushions and a folded throw make the sofa feel lived in.
  details.rect(276, 347, 45, 34).fill('#cf795c').stroke({ color: '#67463a', width: 4 })
  details.rect(365, 344, 43, 35).fill('#e7cf9d').stroke({ color: '#67463a', width: 4 })
  details.rect(370, 352, 7, 7).fill('#8aa18e').rect(394, 365, 7, 7).fill('#8aa18e')
  details.rect(232, 391, 70, 12).fill('#d9b58c').rect(232, 403, 70, 8).fill('#668679')
  details.zIndex = 390
  world.addChild(details)

  const chair = new Graphics()
  chair.roundRect(-48, -54, 96, 80, 8).fill('#bd7158').stroke({ color: '#5d4036', width: 6 })
  chair.roundRect(-55, -18, 110, 62, 8).fill('#cf8265').stroke({ color: '#5d4036', width: 6 })
  chair.rect(-38, 42, 12, 24).fill('#5d4036').rect(27, 42, 12, 24).fill('#5d4036')
  chair.rect(-25, -7, 50, 28).fill('#e2b57d').stroke({ color: '#765245', width: 3 })
  chair.position.set(830, 510)
  chair.zIndex = 525
  world.addChild(chair)

  const sideTable = new Graphics()
  sideTable.ellipse(0, -24, 38, 18).fill('#9c6344').stroke({ color: '#58392f', width: 4 })
  sideTable.rect(-6, -8, 12, 47).fill('#58392f').ellipse(0, 38, 25, 8).fill('#58392f')
  sideTable.rect(-14, -50, 28, 25).fill('#f2d48f').stroke({ color: '#765245', width: 3 })
  sideTable.rect(-10, -56, 20, 7).fill('#d8a761')
  sideTable.position.set(494, 392)
  sideTable.zIndex = 410
  world.addChild(sideTable)

  // Flowers, mugs, candlelight and tiny books.
  const tabletop = new Graphics()
  tabletop.rect(600, 435, 17, 20).fill('#f4e0bb').stroke({ color: '#725044', width: 3 })
  tabletop.circle(618, 443, 7).stroke({ color: '#725044', width: 3 })
  tabletop.rect(646, 425, 16, 25).fill('#aa654d').stroke({ color: '#664237', width: 3 })
  tabletop.rect(651, 401, 5, 28).fill('#4f7457')
  tabletop.circle(643, 402, 8).fill('#e4a05f').circle(657, 397, 8).fill('#f1cf78').circle(667, 407, 7).fill('#d87865')
  tabletop.rect(935, 318, 31, 7).fill('#dbb760').rect(930, 311, 36, 7).fill('#66867d')
  tabletop.zIndex = 515
  world.addChild(tabletop)

  // Small framed botanical prints and a string of warm fairy lights.
  const wallDecor = new Graphics()
  wallDecor.rect(500, 76, 54, 64).fill('#f7e5c2').stroke({ color: '#795343', width: 5 })
  wallDecor.rect(518, 92, 8, 33).fill('#62815e').rect(507, 105, 30, 6).fill('#62815e')
  wallDecor.rect(580, 53, 43, 53).fill('#f7e5c2').stroke({ color: '#795343', width: 5 })
  wallDecor.circle(601, 77, 11).fill('#d47a5b')
  for (let index = 0; index < 11; index += 1) {
    const lightX = 470 + index * 48
    const lightY = 64 + Math.abs(index - 5) * 8
    wallDecor.circle(lightX, lightY, 5).fill('#ffd67c')
  }
  wallDecor.moveTo(470, 64).bezierCurveTo(610, 145, 800, 130, 950, 72).stroke({ color: '#6d4b3d', width: 3 })
  wallDecor.zIndex = 80
  world.addChild(wallDecor)
}

function addDoor(world) {
  const door = new Graphics()
  polygon(door, [1042, 156, 1144, 204, 1144, 335, 1042, 285], '#81543d', { color: '#4a302a', width: 6 })
  door.circle(1121, 264, 6).fill('#efc26d')
  door.zIndex = 290
  world.addChild(door)
}

function fitAvatarSprite(sprite) {
  const size = 104
  const aspect = sprite.texture.width / sprite.texture.height
  if (aspect >= 1) {
    sprite.width = size
    sprite.height = size / aspect
  } else {
    sprite.height = size
    sprite.width = size * aspect
  }
}

function createAvatar({ x, y, animations, isLocal }) {
  const avatar = new Container()
  avatar.position.set(x, y)
  avatar.cullable = true

  const shadow = new Graphics().ellipse(0, 6, 30, 10).fill({ color: '#283b35', alpha: 0.28 })
  const sprite = new Sprite(animations.idle[0])
  sprite.anchor.set(0.5, 0.94)
  fitAvatarSprite(sprite)
  sprite.y = 9
  avatar.addChild(shadow, sprite)

  if (isLocal) {
    const marker = new Graphics()
    polygon(marker, [-7, -112, 7, -112, 0, -102], '#fff1a8', { color: '#5b4738', width: 2 })
    avatar.addChild(marker)
  }
  avatar.zIndex = y
  avatar._sprite = sprite
  avatar._animations = animations
  avatar._facing = 'right'
  avatar._movingUntil = 0
  return avatar
}

function updateAvatarFrame(avatar, moving, elapsed) {
  const animation = moving ? avatar._animations[avatar._facing] : avatar._animations.idle
  const speed = moving ? 9 : 2.2
  const frame = Math.floor(elapsed * speed) % animation.length
  if (avatar._sprite.texture !== animation[frame]) {
    avatar._sprite.texture = animation[frame]
    fitAvatarSprite(avatar._sprite)
  }
}

function removeChatBubble(avatar) {
  if (avatar._bubbleTimer) window.clearTimeout(avatar._bubbleTimer)
  avatar._bubbleTimer = null
  if (!avatar._chatBubble) return
  avatar.removeChild(avatar._chatBubble)
  avatar._chatBubble.destroy({ children: true })
  avatar._chatBubble = null
}

function showChatBubble(avatar, message) {
  removeChatBubble(avatar)
  const safeMessage = String(message).trim().slice(0, 120)
  if (!safeMessage) return

  const label = new Text({
    text: safeMessage,
    style: {
      fill: '#3b2d29',
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: 14,
      fontWeight: '600',
      leading: 3,
      wordWrap: true,
      wordWrapWidth: 164,
    },
  })
  const paddingX = 11
  const paddingY = 8
  const bubbleWidth = Math.max(54, Math.min(186, label.width + paddingX * 2))
  const bubbleHeight = label.height + paddingY * 2
  const bubble = new Container()
  const panel = new Graphics()
  panel.roundRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight, 9)
    .fill('#fff4dc')
    .stroke({ color: '#4a3530', width: 3 })
  polygon(panel, [-8, -1, 8, -1, 0, 10], '#fff4dc', { color: '#4a3530', width: 3 })
  panel.rect(-6, -4, 12, 6).fill('#fff4dc')
  label.anchor.set(0.5, 0)
  label.position.set(0, -bubbleHeight + paddingY)
  bubble.position.set(
    Math.max(bubbleWidth / 2 + 12, Math.min(WIDTH - bubbleWidth / 2 - 12, avatar.x)) - avatar.x,
    -116,
  )
  bubble.addChild(panel, label)
  avatar.addChild(bubble)
  avatar._chatBubble = bubble
  avatar._bubbleTimer = window.setTimeout(() => removeChatBubble(avatar), 3000)
}

function insideFloor(x, y) {
  let inside = false
  for (let current = 0, previous = WALKABLE_FLOOR.length - 1; current < WALKABLE_FLOOR.length; previous = current, current += 1) {
    const a = WALKABLE_FLOOR[current]
    const b = WALKABLE_FLOOR[previous]
    const intersects = ((a.y > y) !== (b.y > y))
      && (x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x)
    if (intersects) inside = !inside
  }
  return inside
}

const SPAWN_POINTS = [
  { x: 650, y: 505 },
  { x: 770, y: 485 },
  { x: 700, y: 590 },
  { x: 900, y: 455 },
]

export async function createSocialRoomGame(host, callbacks = {}) {
  const app = new Application()
  await app.init({
    width: WIDTH,
    height: HEIGHT,
    antialias: false,
    background: '#49635c',
    resolution: 1,
    autoDensity: false,
    preference: 'webgl',
  })
  host.replaceChildren(app.canvas)
  app.canvas.setAttribute('role', 'img')
  app.canvas.setAttribute('aria-label', 'A playable cozy room with four anonymous visitors.')

  const world = new Container()
  world.sortableChildren = true
  app.stage.addChild(world)
  const [backgroundSource, avatarFrames] = await Promise.all([
    addRoomBackground(world),
    loadAvatarFrames(),
  ])

  // The local avatar exists only because this visitor entered the room.
  // Every other avatar is created later from a live presence event.
  const localPlayer = createAvatar({ ...SPAWN_POINTS[0], animations: avatarFrames[0], isLocal: true })
  localPlayer.zIndex = 1000 + localPlayer.y
  world.addChild(localPlayer)
  const remotePlayers = new Map()

  const keys = new Set()
  const virtualKeys = new Set()
  let moveBroadcastElapsed = 0
  const onKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    const key = event.key.toLowerCase()
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
      event.preventDefault()
      keys.add(key)
    }
  }
  const onKeyUp = (event) => keys.delete(event.key.toLowerCase())
  window.addEventListener('keydown', onKeyDown, { passive: false })
  window.addEventListener('keyup', onKeyUp)

  let elapsed = 0
  const tick = (ticker) => {
    const seconds = Math.min(ticker.deltaMS / 1000, 0.05)
    elapsed += seconds
    const dx = (keys.has('arrowright') || keys.has('d') || virtualKeys.has('right') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') || virtualKeys.has('left') ? 1 : 0)
    const dy = (keys.has('arrowdown') || keys.has('s') || virtualKeys.has('down') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') || virtualKeys.has('up') ? 1 : 0)
    const length = Math.hypot(dx, dy) || 1
    const nextX = localPlayer.x + (dx / length) * 150 * seconds
    const nextY = localPlayer.y + (dy / length) * 105 * seconds
    if (insideFloor(nextX, localPlayer.y)) localPlayer.x = nextX
    if (insideFloor(localPlayer.x, nextY)) localPlayer.y = nextY
    if (dx !== 0) localPlayer._facing = dx < 0 ? 'left' : 'right'
    updateAvatarFrame(localPlayer, Boolean(dx || dy), elapsed)
    localPlayer.zIndex = 1000 + localPlayer.y

    remotePlayers.forEach((avatar) => {
      updateAvatarFrame(avatar, avatar._movingUntil > elapsed, elapsed)
    })

    if (dx || dy) {
      moveBroadcastElapsed += seconds
      if (moveBroadcastElapsed >= 0.08) {
        moveBroadcastElapsed = 0
        callbacks.onMove?.({ x: localPlayer.x, y: localPlayer.y })
      }
    }
  }
  app.ticker.add(tick)

  return {
    app,
    setDirection(direction, active) {
      if (active) virtualKeys.add(direction)
      else virtualKeys.delete(direction)
    },
    getLocalPosition() {
      return { x: localPlayer.x, y: localPlayer.y }
    },
    getBackgroundSource() {
      return backgroundSource
    },
    showLocalChatBubble(message) {
      showChatBubble(localPlayer, message)
    },
    showChatBubble(id, message) {
      const avatar = remotePlayers.get(id)
      if (avatar) showChatBubble(avatar, message)
    },
    addRemotePlayer(id, styleIndex = 1, position) {
      if (remotePlayers.has(id) || remotePlayers.size >= 3) return
      const slot = remotePlayers.size + 1
      const styleSeed = styleIndex > 0
        ? styleIndex
        : [...id].reduce((total, character) => total + character.charCodeAt(0), 0)
      const styleRow = 1 + (styleSeed % (CHARACTER_ROWS - 1))
      const hasValidPosition = position && insideFloor(position.x, position.y)
      const overlapsLocal = hasValidPosition && Math.hypot(position.x - localPlayer.x, position.y - localPlayer.y) < 72
      const spawn = hasValidPosition && !overlapsLocal ? position : SPAWN_POINTS[slot]
      const avatar = createAvatar({ ...spawn, animations: avatarFrames[styleRow], isLocal: false })
      avatar.zIndex = 1000 + avatar.y
      avatar._networkOffset = hasValidPosition
        ? { x: spawn.x - position.x, y: spawn.y - position.y }
        : { x: 0, y: 0 }
      remotePlayers.set(id, avatar)
      world.addChild(avatar)
    },
    moveRemotePlayer(id, position) {
      const avatar = remotePlayers.get(id)
      if (!avatar || !position || !insideFloor(position.x, position.y)) return
      const nextX = position.x + avatar._networkOffset.x
      const nextY = position.y + avatar._networkOffset.y
      if (nextX !== avatar.x) avatar._facing = nextX < avatar.x ? 'left' : 'right'
      avatar.position.set(nextX, nextY)
      avatar._movingUntil = elapsed + 0.2
      avatar.zIndex = 1000 + avatar.y
    },
    removeRemotePlayer(id) {
      const avatar = remotePlayers.get(id)
      if (!avatar) return
      removeChatBubble(avatar)
      world.removeChild(avatar)
      avatar.destroy({ children: true })
      remotePlayers.delete(id)
    },
    destroy() {
      removeChatBubble(localPlayer)
      remotePlayers.forEach((avatar) => removeChatBubble(avatar))
      app.ticker.remove(tick)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      app.destroy(true, { children: true, texture: false, textureSource: false })
      avatarFrames.forEach((animations) => {
        Object.values(animations).flat().forEach((texture) => texture.destroy(false))
      })
    },
  }
}
