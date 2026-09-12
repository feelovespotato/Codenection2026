import {
  AnimatedSprite,
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  Rectangle,
} from 'pixi.js'
import {
  DOG_HEIGHT,
  DOG_IDLE_SECONDS,
  DOG_SPEED,
  DOG_WIDTH,
  DOG_Y,
  FEMALE_HEIGHT,
  FEMALE_SPEED,
  FEMALE_WIDTH,
  FEMALE_Y,
  HOTSPOTS,
  ICONS,
  RAIN_COUNT,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from './constants.js'

const assetSources = {
  room: '/moodify/room.png',
  day: '/moodify/day.png',
  night: '/moodify/night.png',
  rain: '/moodify/raindrop.png',
  settings: '/moodify/pixel-settings.svg',
  tv: '/moodify/tv-interface.png',

  plant: '/moodify/plant-interface.png',
  cancel: '/moodify/cancel.png',
  waterButton: '/moodify/water-button.png',
  wateringPot: '/moodify/watering-pot.png',
  waterDrops: '/moodify/water-drops.png',
  dogIdle0: '/moodify/dog-idle-0.png', dogIdle1: '/moodify/dog-idle-1.png', dogIdle2: '/moodify/dog-idle-2.png', dogIdle3: '/moodify/dog-idle-3.png',
  dogWalk0: '/moodify/dog-walk-0.png', dogWalk1: '/moodify/dog-walk-1.png', dogWalk2: '/moodify/dog-walk-2.png', dogWalk3: '/moodify/dog-walk-3.png',
  girlIdle0: '/moodify/girl-idle-0.png', girlIdle1: '/moodify/girl-idle-1.png', girlIdle2: '/moodify/girl-idle-2.png', girlIdle3: '/moodify/girl-idle-3.png',
  girlWalk0: '/moodify/girl-walk-0.png', girlWalk1: '/moodify/girl-walk-1.png', girlWalk2: '/moodify/girl-walk-2.png', girlWalk3: '/moodify/girl-walk-3.png',
}

function clickable(sprite, onPress, label) {
  sprite.eventMode = 'static'
  sprite.cursor = 'pointer'
  sprite.label = label

  sprite.on('pointerover', () => {
    sprite.y -= 4 // Float effect
  })

  sprite.on('pointerout', () => {
    sprite.y += 4
  })

  sprite.on('pointertap', onPress)
  return sprite
}

function playAnimation(sprite, textures, animationSpeed) {
  sprite.textures = textures
  sprite.animationSpeed = animationSpeed
  sprite.loop = true
  sprite.gotoAndPlay(0)
}

// Feature icons only bobbed on hover, which is easy to miss. This draws a
// golden highlight ring plus a name tag above whatever's hovered, shared by
// icons, the settings gear, the walkable companion, and the room hotspots
// (TV / radio / plant) so every clickable thing in the room says so clearly.
function createHoverDecor(scene, tooltipLayer, { x, y, width, height, label, haloPadding = 8, insertBelow }) {
  const halo = new Graphics()
    .roundRect(-haloPadding, -haloPadding, width + haloPadding * 2, height + haloPadding * 2, 10)
    .fill({ color: 0xf3d17a, alpha: 0.55 })
    .stroke({ width: 3, color: 0x392c32, alpha: 0.9 })
  halo.position.set(x, y)
  halo.visible = false
  if (insertBelow) scene.addChildAt(halo, scene.getChildIndex(insertBelow))
  else scene.addChild(halo)

  const text = new Text({
    text: label,
    style: { fontFamily: "'Pixelify Sans', 'Courier New', monospace", fontSize: 20, fill: 0x392c32 },
  })
  const padX = 10
  const padY = 6
  const tagWidth = text.width + padX * 2
  const tagHeight = text.height + padY * 2
  const tag = new Graphics()
    .roundRect(0, 0, tagWidth, tagHeight, 6)
    .fill({ color: 0xfff4dc })
    .stroke({ width: 3, color: 0x392c32 })
  text.position.set(padX, padY)
  const tooltip = new Container()
  tooltip.addChild(tag, text)
  tooltip.position.set(x + width / 2 - tagWidth / 2, y - tagHeight - 14)
  tooltip.visible = false
  tooltipLayer.addChild(tooltip)

  return {
    setVisible(visible) {
      halo.visible = visible
      tooltip.visible = visible
    },
    reposition(nextX, nextY) {
      halo.position.set(nextX, nextY)
      tooltip.position.set(nextX + width / 2 - tagWidth / 2, nextY - tagHeight - 14)
    },
  }
}

function addInteractiveSprite(scene, tooltipLayer, texture, { x, y, width, height, label, onPress, haloPadding = 8 }) {
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  if (width) sprite.width = width
  if (height) sprite.height = height

  const decor = createHoverDecor(scene, tooltipLayer, { x, y, width: sprite.width, height: sprite.height, label, haloPadding })

  clickable(sprite, onPress, label)
  sprite.on('pointerover', () => decor.setVisible(true))
  sprite.on('pointerout', () => decor.setVisible(false))

  scene.addChild(sprite)
  return sprite
}

export async function createMoodifyGame(canvasHost, callbacks = {}) {
  const app = new Application()
  await app.init({
    width: VIRTUAL_WIDTH,
    height: VIRTUAL_HEIGHT,
    background: '#0d0b12',
    antialias: false,
    resolution: 1,
    autoDensity: false,
    preference: 'webgl',
  })
  canvasHost.replaceChildren(app.canvas)
  app.canvas.setAttribute('aria-label', 'Moodify pixel-art room. Use the left and right arrow keys to walk.')
  app.canvas.setAttribute('role', 'img')

  const loadedEntries = await Promise.all(
    Object.entries(assetSources).map(async ([key, src]) => [key, await Assets.load(src)]),
  )
  const textures = Object.fromEntries(loadedEntries)
  const iconEntries = await Promise.all(
    ICONS.map(async (icon) => [icon.id, await Assets.load(icon.src)]),
  )
  const iconTextures = Object.fromEntries(iconEntries)
  Object.values(textures).forEach((texture) => { texture.source.scaleMode = 'nearest' })
  Object.values(iconTextures).forEach((texture) => { texture.source.scaleMode = 'nearest' })

  const scene = new Container()
  app.stage.addChild(scene)

  const hour = new Date().getHours()
  const sky = new Sprite(hour >= 7 && hour < 18 ? textures.day : textures.night)
  sky.position.set(hour >= 7 && hour < 18 ? 420 : 460, 40)
  scene.addChild(sky)

  const rainLayer = new Container()
  const rain = Array.from({ length: RAIN_COUNT }, () => {
    const drop = new Sprite(textures.rain)
    drop.x = Math.random() * VIRTUAL_WIDTH
    drop.y = -Math.random() * VIRTUAL_HEIGHT
    drop.alpha = 0.68 + Math.random() * 0.3
    drop._fallSpeed = 600 + Math.random() * 600
    rainLayer.addChild(drop)
    return drop
  })
  scene.addChild(rainLayer)

  const room = new Sprite(textures.room)
  room.width = VIRTUAL_WIDTH
  room.height = VIRTUAL_HEIGHT
  scene.addChild(room)

  // Rendered last (see bottom of setup) so tooltips float above every sprite.
  const tooltipLayer = new Container()

  const addIcon = (icon) => {
    addInteractiveSprite(scene, tooltipLayer, iconTextures[icon.id], {
      x: icon.x,
      y: icon.y,
      label: icon.label,
      onPress: () => callbacks.onActivity?.(icon.id, icon),
    })
  }
  ICONS.filter((icon) => icon.layer === 'behind').forEach(addIcon)

  HOTSPOTS.forEach((spot) => {
    const target = new Graphics().rect(spot.x, spot.y, spot.width, spot.height).fill({ color: 0xffffff, alpha: 0.001 })
    target.eventMode = 'static'
    target.cursor = 'pointer'
    target.on('pointertap', () => callbacks.onHotspot?.(spot.id, spot))
    scene.addChild(target)
  })

  const dogIdle = [textures.dogIdle0, textures.dogIdle1, textures.dogIdle2, textures.dogIdle3]
  const dogWalk = [textures.dogWalk0, textures.dogWalk1, textures.dogWalk2, textures.dogWalk3]
  const dog = new AnimatedSprite(dogIdle)
  dog.anchor.set(0.5, 0)
  dog.position.set(DOG_WIDTH / 2 + Math.random() * (VIRTUAL_WIDTH - DOG_WIDTH), DOG_Y)
  dog.width = DOG_WIDTH
  dog.height = DOG_HEIGHT
  dog.animationSpeed = 0.095
  dog.loop = true
  dog.play()
  const dogSound = new Audio('/audio/dog-bark.mp3')
  dogSound.volume = 0.5
  clickable(dog, () => {
    dogSound.currentTime = 0
    dogSound.play().catch(() => {})
  }, 'Dog')
  scene.addChild(dog)
  let dogState = 'idle'
  let dogIdleElapsed = 0
  let dogTarget = dog.x
  let dogDirection = -1

  const girlIdle = [textures.girlIdle0, textures.girlIdle1, textures.girlIdle2, textures.girlIdle3]
  const girlWalk = [textures.girlWalk0, textures.girlWalk1, textures.girlWalk2, textures.girlWalk3]
  const girl = new AnimatedSprite(girlIdle)
  girl.anchor.set(0.5, 0)
  girl.position.set(FEMALE_WIDTH / 2 - 1, FEMALE_Y)
  girl.width = FEMALE_WIDTH
  girl.height = FEMALE_HEIGHT
  girl.animationSpeed = 0.11
  girl.loop = true
  girl.play()
  clickable(girl, () => callbacks.onCompanion?.(), 'Chat with your Moodify companion')
  scene.addChild(girl)
  let girlAnimation = 'idle'

  // The companion's sprite bounding box has a lot of empty transparent
  // padding around her actual body, so the halo/tooltip use a smaller
  // "hitbox" sized and centered relative to her sprite rather than her
  // full width/height. She also walks, so her highlight/tooltip must be
  // repositioned every frame to track girl.x (see ticker below) — not just
  // set once here.
  const GIRL_HALO_WIDTH = girl.width * 0.55
  const GIRL_HALO_HEIGHT = girl.height * 0.95
  const girlHaloX = () => girl.x - GIRL_HALO_WIDTH / 2
  const girlHaloY = () => FEMALE_Y + (girl.height - GIRL_HALO_HEIGHT)
  const girlHover = createHoverDecor(scene, tooltipLayer, {
    x: girlHaloX(),
    y: girlHaloY(),
    width: GIRL_HALO_WIDTH,
    height: GIRL_HALO_HEIGHT,
    label: 'Chat with Moodify',
    haloPadding: 6,
  })
  girl.on('pointerover', () => girlHover.setVisible(true))
  girl.on('pointerout', () => girlHover.setVisible(false))

  ICONS.filter((icon) => icon.layer === 'front').forEach(addIcon)

  addInteractiveSprite(scene, tooltipLayer, textures.settings, {
    x: VIRTUAL_WIDTH - 100,
    y: 80,
    width: 80,
    height: 80,
    label: 'Settings',
    onPress: () => callbacks.onSettings?.(),
  })

  // Added last so hover tooltips render above every other sprite in the room.
  scene.addChild(tooltipLayer)

  let activeOverlay = null
  let wateringAnimation = null
  const overlay = new Container()
  overlay.visible = false
  scene.addChild(overlay)

  const stopWatering = (completed = false) => {
    if (!wateringAnimation) return
    const { pot, drops } = wateringAnimation
    pot.parent?.removeChild(pot)
    drops.parent?.removeChild(drops)
    wateringAnimation = null
    if (completed) callbacks.onFeature?.('plant-water-complete')
  }

  const closeOverlay = () => {
    stopWatering()
    overlay.visible = false
    overlay.removeChildren()
    activeOverlay = null
  }
  const openOverlay = (type) => {
    stopWatering()
    overlay.removeChildren()

    const background = new Sprite(textures[type])
    background.width = VIRTUAL_WIDTH
    background.height = VIRTUAL_HEIGHT
    background.eventMode = 'static'
    overlay.addChild(background)

    // TV and Plant only
    if (type === 'tv' || type === 'plant') {
      const cancel = new Sprite(textures.cancel)

      cancel.position.set(
        type === 'tv' ? 1045 : 1100,
        type === 'tv' ? 80 : 40
      )

      clickable(cancel, closeOverlay, 'Close')
      overlay.addChild(cancel)
    }

    // Plant only
    if (type === 'plant') {
      const water = new Sprite(textures.waterButton)

      water.position.set(60, 50)

      clickable(water, () => {
        callbacks.onFeature?.('plant-water')

        stopWatering()

        const pot = new Sprite(textures.wateringPot)
        pot.position.set(710, 150)

        const drops = new Sprite(textures.waterDrops)
        drops.position.set(630, 350)

        overlay.addChild(pot, drops)

        wateringAnimation = {
          pot,
          drops,
          elapsed: 0,
        }
      }, 'Water plant')

      overlay.addChild(water)
    }

    activeOverlay = type
    overlay.visible = true
  }

  const zones = [
    { type: 'tv', x: 251, y: 275, width: 230, height: 150, label: 'TV' },
    { type: 'radio', x: 800, y: 480, width: 130, height: 80, label: 'Radio' },
    { type: 'plant', x: 500, y: 290, width: 100, height: 140, label: 'Plant' },
  ]

  zones.forEach((zone) => {
    const target = new Graphics()
      .rect(zone.x, zone.y, zone.width, zone.height)
      .fill({ color: 0xffffff, alpha: 0.001 })

    target.eventMode = 'static'
    target.cursor = 'pointer'

    const decor = createHoverDecor(scene, tooltipLayer, {
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      label: zone.label,
      haloPadding: 6,
      insertBelow: overlay,
    })
    target.on('pointerover', () => decor.setVisible(true))
    target.on('pointerout', () => decor.setVisible(false))

    target.on('pointertap', () => {
      callbacks.onFeature?.(zone.type, zone)

      if (zone.type === 'radio') {
        // Radio remains clickable, but has no interface.
        return
      }

      openOverlay(zone.type)
    })

    scene.addChild(target)
  })

  const keys = new Set()
  const keyDown = (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      keys.add(event.key)
    }
    if (event.key === 'Escape') closeOverlay()
  }
  const keyUp = (event) => keys.delete(event.key)
  window.addEventListener('keydown', keyDown, { passive: false })
  window.addEventListener('keyup', keyUp)

  app.ticker.add((ticker) => {
    const seconds = Math.min(ticker.deltaMS / 1000, 0.05)
    rain.forEach((drop) => {
      drop.x += 120 * seconds
      drop.y += drop._fallSpeed * seconds
      if (drop.y > VIRTUAL_HEIGHT) {
        drop.x = Math.random() * VIRTUAL_WIDTH
        drop.y = -VIRTUAL_HEIGHT * Math.random() - 5
        drop._fallSpeed = 600 + Math.random() * 600
      }
    })

    if (wateringAnimation && activeOverlay === 'plant') {
      wateringAnimation.elapsed += seconds
      wateringAnimation.drops.y += 180 * seconds
      if (wateringAnimation.drops.y > 420) {
        wateringAnimation.drops.y = 350 + (wateringAnimation.drops.y - 420)
      }
      if (wateringAnimation.elapsed >= 3) stopWatering(true)
    }

    const direction = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)
    if (direction !== 0 && !activeOverlay) {
      if (girlAnimation !== 'walking') {
        playAnimation(girl, girlWalk, 0.083)
        girlAnimation = 'walking'
      }
      girl.x += direction * FEMALE_SPEED * seconds
      girl.scale.x = direction
      if (girl.x + FEMALE_WIDTH / 2 < 0) girl.x = VIRTUAL_WIDTH + FEMALE_WIDTH / 2
      if (girl.x - FEMALE_WIDTH / 2 > VIRTUAL_WIDTH) girl.x = -FEMALE_WIDTH / 2
    } else if (girlAnimation !== 'idle') {
      playAnimation(girl, girlIdle, 0.11)
      girlAnimation = 'idle'
    }

    // Keep the halo/tooltip glued to the companion every frame — this runs
    // regardless of walking/idle/wrap-around so it never drifts out of sync.
    girlHover.reposition(girlHaloX(), girlHaloY())

    if (dogState === 'idle') {
      dogIdleElapsed += seconds
      if (dogIdleElapsed >= DOG_IDLE_SECONDS) {
        dogTarget = DOG_WIDTH / 2 + Math.random() * (VIRTUAL_WIDTH - DOG_WIDTH)
        dogDirection = dogTarget < dog.x ? -1 : 1
        dog.scale.x = dogDirection === -1 ? 1 : -1
        playAnimation(dog, dogWalk, 0.1)
        dogState = 'walking'
      }
    } else {
      const distance = dogTarget - dog.x
      const step = dogDirection * DOG_SPEED * seconds
      if (Math.abs(distance) <= Math.abs(step)) {
        dog.x = dogTarget
        playAnimation(dog, dogIdle, 0.095)
        dogState = 'idle'
        dogIdleElapsed = 0
      } else {
        dog.x += step
      }
    }
  })

  return {
    app,
    destroy() {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      app.destroy(true, { children: true, texture: false, textureSource: false })
    },
  }
}