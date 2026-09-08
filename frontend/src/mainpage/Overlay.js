import { Container, Sprite } from 'pixi.js';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './constants.js';
import { makeClickableIcon } from './ClickableSprite.js';

/**
 * Builds a full-screen overlay: a background image stretched to fill the
 * virtual canvas (matching the Pygame
 * `pygame.transform.scale(img, (VIRTUAL_WIDTH, VIRTUAL_HEIGHT))` calls)
 * plus a close ("cancel") button at a given position. Extra interactive
 * pieces (a play button, a watering can, ...) can be added to
 * `.container` by the caller.
 */
export class Overlay {
  constructor({ backgroundTexture, cancelTexture, cancelPosition, onClose }) {
    this.container = new Container();
    this.container.visible = false;

    const background = new Sprite(backgroundTexture);
    background.width = VIRTUAL_WIDTH;
    background.height = VIRTUAL_HEIGHT;
    // Interactive (with no handler) purely to swallow clicks so they don't
    // fall through to the room icons/hotspots sitting underneath — mirrors
    // the Pygame event loop only checking overlay buttons while one is open.
    background.eventMode = 'static';
    this.container.addChild(background);

    const cancelButton = makeClickableIcon(cancelTexture, {
      x: cancelPosition.x,
      y: cancelPosition.y,
      onClick: onClose,
    });
    this.container.addChild(cancelButton);
  }

  show() {
    this.container.visible = true;
  }

  hide() {
    this.container.visible = false;
  }
}