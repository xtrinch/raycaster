import { sortBy } from "lodash";
import { makeAutoObservable } from "mobx";
import { drawArbitraryQuadImage, FILL_METHOD } from "../arbitrary-quads";
import { Bitmap } from "./bitmap";
import { GridMap } from "./gridMap";
import { Player } from "./player";
import { SpriteMap, SpriteType } from "./spriteMap";

export class Camera {
  public ctx: CanvasRenderingContext2D;
  public width: number;
  public height: number;
  public widthResolution: number; // how many columns we draw
  public heightResolution: number; // how many scanlines we draw
  public ceilingWidthResolution: number; // how many columns we draw
  public ceilingHeightResolution: number; // how many scanlines we draw
  public widthSpacing: number;
  public heightSpacing: number;
  public ceilingWidthSpacing: number;
  public ceilingHeightSpacing: number;
  public range: number;
  public lightRange: number;
  public scale: number;
  public skipCounter: number;
  public initialSkipCounter: number;
  public context: CanvasRenderingContext2D;
  public canvas: HTMLCanvasElement;
  public map: GridMap;
  public floorData: Uint8ClampedArray<ArrayBufferLike>;
  public ceilingData: Uint8ClampedArray<ArrayBufferLike>;
  public originalCanvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, map: GridMap) {
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width = window.innerWidth;
    this.height = canvas.height = window.innerHeight;
    this.widthResolution = 620;
    this.heightResolution = 420;
    this.ceilingHeightResolution = 250;
    this.ceilingWidthResolution = 350;
    this.widthSpacing = this.width / this.widthResolution;
    this.heightSpacing = this.height / this.heightResolution;
    this.ceilingWidthSpacing = this.width / this.ceilingWidthResolution;
    this.ceilingHeightSpacing = this.height / this.ceilingHeightResolution;
    this.range = 54;
    this.lightRange = 15;
    this.scale = (this.width + this.height) / 1200;
    this.initialSkipCounter = 1;
    this.skipCounter = this.initialSkipCounter;
    this.map = map;
    this.originalCanvas = canvas;
    makeAutoObservable(this);
  }

  render(player: Player, map: GridMap, spriteMap: SpriteMap) {
    this.ctx.save();
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
    this.drawSky(player, map.skybox, map.light);
    this.drawColumns(player, map, spriteMap);
    this.drawWeapon(player.weapon, player.paces);
  }

  drawSky(player: Player, sky: Bitmap, ambient: number) {
    const direction =
      Math.atan2(player.position.dirX, player.position.dirY) + Math.PI;
    const y = player.position.pitch + player.position.z;

    let width = sky.width * (this.height / sky.height) * 2;
    let CIRCLE = Math.PI * 2;
    let left = (direction / CIRCLE) * -width;

    this.ctx.save();
    this.ctx.drawImage(sky.image, left, y, width, this.height);
    if (left < width - this.width) {
      this.ctx.drawImage(sky.image, left + width, y, width, this.height);
    }
    if (ambient > 0) {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.globalAlpha = ambient * 0.1;
      this.ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);
    }
    this.ctx.restore();
  }

  // draws columns left to right
  drawCeilingFloor(player: Player, map: GridMap) {
    const ceilingSrcPoints = [
      { x: 0, y: 0 },
      { x: 0, y: map.ceilingTexture.height },
      { x: map.ceilingTexture.width, y: map.ceilingTexture.height },
      { x: map.ceilingTexture.width, y: 0 },
    ];
    const floorSrcPoints = [
      { x: 0, y: 0 },
      { x: 0, y: map.floorTexture.height },
      { x: map.floorTexture.width, y: map.floorTexture.height },
      { x: map.floorTexture.width, y: 0 },
    ];
    // get top left, top right, bottom right, bottom left x y coord
    // find which x and ys are on the screen

    const width = this.width;
    const height = this.height;
    let distance = 0;
    // for now, do them all
    for (let y = 0; y < map.size; y++) {
      for (let x = 0; x < map.size; x++) {
        let points = [
          [x, y],
          [x + 1.01, y],
          [x + 1.01, y + 1.01],
          [x, y + 1.01],
        ];
        let floorScreenPoints: { x: number; y: number }[] = [];
        let ceilingScreenPoints: { x: number; y: number }[] = [];
        let numOnScreen = 0;
        if (map.get(x, y) !== 2) {
          continue;
        }
        for (let point of points) {
          // translate x y position to relative to camera
          let spriteX = point[0] - player.position.x;
          let spriteY = point[1] - player.position.y;

          // transform sprite with the inverse camera matrix
          // [ planeX   dirX ] -1                                       [ dirY      -dirX ]
          // [               ]       =  1/(planeX*dirY-dirX*planeY) *   [                 ]
          // [ planeY   dirY ]                                          [ -planeY  planeX ]

          let invDet =
            1.0 /
            (player.position.planeX * player.position.dirY -
              player.position.dirX * player.position.planeY); //required for correct matrix multiplication

          let transformX =
            invDet *
            (player.position.dirY * spriteX - player.position.dirX * spriteY);
          let transformY =
            invDet *
            (-player.position.planeY * spriteX +
              player.position.planeX * spriteY); //this is actually the depth inside the screen, that what Z is in 3D
          let spriteScreenX = Math.floor(
            (width / 2) * (1 + transformX / transformY)
          );

          const vMove = 0;
          // to control the pitch / jump
          let vMoveScreen =
            Math.floor(vMove / transformY) +
            player.position.pitch +
            player.position.z;

          let spriteHeight = Math.abs(Math.floor(height / transformY)); //using 'transformY' instead of the real distance prevents fisheye
          let screenCeilingY = height / 2 - spriteHeight / 2;
          let screenFloorY = height / 2 + spriteHeight / 2;
          let spriteFloorScreenY = screenFloorY + vMoveScreen;
          let spriteCeilingScreenY = screenCeilingY + vMoveScreen;

          if (
            transformY > 0 &&
            spriteScreenX >= 0 &&
            spriteScreenX <= width &&
            transformY < 10
          ) {
            distance = Math.abs(transformY);
            numOnScreen++;
          }
          floorScreenPoints.push({ x: spriteScreenX, y: spriteFloorScreenY });
          ceilingScreenPoints.push({
            x: spriteScreenX,
            y: spriteCeilingScreenY,
          });
        }

        let tesselation = 9 - distance * 2;
        if (tesselation <= 1) tesselation = 1;
        if (tesselation >= 7) tesselation = 7;
        if (numOnScreen >= 1) {
          const alpha = (distance + 0) / this.lightRange - map.light;
          // ensure walls are always at least a little bit visible - alpha 1 is all black
          const brightness = Math.min(
            Math.max(0, Math.floor(100 - alpha * 100), 20)
          );
          this.ctx.save();
          drawArbitraryQuadImage(
            this.ctx,
            this.map.floorTexture.image as CanvasImageSource,
            floorSrcPoints,
            floorScreenPoints,
            FILL_METHOD.BILINEAR,
            tesselation
          );
          drawArbitraryQuadImage(
            this.ctx,
            this.map.ceilingTexture.image as CanvasImageSource,
            ceilingSrcPoints,
            ceilingScreenPoints,
            FILL_METHOD.BILINEAR,
            tesselation
          );
          this.ctx.restore();

          // handle brightness
          this.ctx.save();
          this.ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness / 100})`;

          this.ctx.beginPath();
          this.ctx.moveTo(ceilingScreenPoints[0].x, ceilingScreenPoints[0].y);
          this.ctx.lineTo(ceilingScreenPoints[1].x, ceilingScreenPoints[1].y);
          this.ctx.lineTo(ceilingScreenPoints[2].x, ceilingScreenPoints[2].y);
          this.ctx.lineTo(ceilingScreenPoints[3].x, ceilingScreenPoints[3].y);
          this.ctx.fill();

          this.ctx.beginPath();
          this.ctx.moveTo(floorScreenPoints[0].x, floorScreenPoints[0].y);
          this.ctx.lineTo(floorScreenPoints[1].x, floorScreenPoints[1].y);
          this.ctx.lineTo(floorScreenPoints[2].x, floorScreenPoints[2].y);
          this.ctx.lineTo(floorScreenPoints[3].x, floorScreenPoints[3].y);
          this.ctx.fill();

          this.ctx.restore();
        }
      }
    }
  }

  // draws columns left to right
  drawWalls(player: Player, map: GridMap): { [key: number]: number } {
    let ZBuffer: { [key: number]: number } = {};
    let width = Math.ceil(this.widthSpacing);

    // wall casting
    for (let column = 0; column < this.widthResolution; column++) {
      // x-coordinate in camera space scaled from -1 to 1
      let cameraX = (2 * column) / this.widthResolution - 1;

      // get the ray direction vector
      let rayDirX = player.position.dirX + player.position.planeX * cameraX;
      let rayDirY = player.position.dirY + player.position.planeY * cameraX;

      // which box of the map we're in
      let mapX = Math.floor(player.position.x);
      let mapY = Math.floor(player.position.y);

      // length of ray from current position to next x or y-side
      let sideDistX: number;
      let sideDistY: number;

      //length of ray from one x or y-side to next x or y-side
      //these are derived as:
      //deltaDistX = sqrt(1 + (rayDirY * rayDirY) / (rayDirX * rayDirX))
      //deltaDistY = sqrt(1 + (rayDirX * rayDirX) / (rayDirY * rayDirY))
      //which can be simplified to abs(|rayDir| / rayDirX) and abs(|rayDir| / rayDirY)
      //where |rayDir| is the length of the vector (rayDirX, rayDirY). Its length,
      //unlike (dirX, dirY) is not 1, however this does not matter, only the
      //ratio between deltaDistX and deltaDistY matters, due to the way the DDA
      //stepping further below works. So the values can be computed as below.
      // Division through zero is prevented
      let deltaDistX = Math.abs(1 / rayDirX);
      let deltaDistY = Math.abs(1 / rayDirY);
      // let deltaDistX =
      //   rayDirX === 0 ? 1e30 : Math.sqrt(1 + rayDirY ** 2 / rayDirX ** 2);
      // let deltaDistY =
      //   rayDirY === 0 ? 1e30 : Math.sqrt(1 + rayDirX ** 2 / rayDirY ** 2);

      // perpendicular wall distance
      let perpWallDist: number;

      // what direction to step in x or y-direction (either +1 or -1)
      let stepX: number;
      let stepY: number;

      let hit: number = 0; // was there a wall hit?
      let side: number; // was a NS or a EW wall hit? if x then side = 0, if y then side = 1

      // calculate step and initial sideDist
      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (player.position.x - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - player.position.x) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (player.position.y - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - player.position.y) * deltaDistY;
      }

      // perform DDA
      let range = this.range;
      while (hit == 0 && range >= 0) {
        // jump to next map square, either in x-direction, or in y-direction
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        // Check if ray has hit a wall
        if (map.get(mapX, mapY) == 1) hit = 1;
        range -= 1;
      }
      // Calculate distance projected on camera direction. This is the shortest distance from the point where the wall is
      // hit to the camera plane. Euclidean to center camera plane would give fisheye effect!
      // This can be computed as (mapX - posX + (1 - stepX) / 2) / rayDirX for side == 0, or same formula with Y
      // for size == 1, but can be simplified to the code below thanks to how sideDist and deltaDist are computed:
      // because they were left scaled to |rayDir|. sideDist is the entire length of the ray above after the multiple
      // steps, but we subtract deltaDist once because one step more into the wall was taken above.
      if (side == 0) perpWallDist = sideDistX - deltaDistX;
      else perpWallDist = sideDistY - deltaDistY;
      // if (side === 0)
      //   perpWallDist = (mapX - player.position.x + (1 - stepX) / 2) / rayDirX;
      // else
      //   perpWallDist = (mapY - player.position.y + (1 - stepY) / 2) / rayDirY;

      // SET THE ZBUFFER FOR THE SPRITE CASTING
      ZBuffer[column] = perpWallDist; //perpendicular distance is used

      // Calculate height of line to draw on screen
      let lineHeight: number = this.height / perpWallDist;

      // calculate lowest and highest pixel to fill in current stripe
      let drawStartY =
        -lineHeight / 2 +
        this.height / 2 +
        player.position.pitch +
        player.position.z;
      let drawEndY =
        lineHeight / 2 +
        this.height / 2 +
        player.position.pitch +
        player.position.z;

      let texture = map.wallTexture;

      // calculate value of wallX
      let wallX: number; // where exactly the wall was hit
      if (side == 0) wallX = player.position.y + perpWallDist * rayDirY;
      else wallX = player.position.x + perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);

      // x coordinate on the texture
      let texX = Math.floor(wallX * texture.width);
      if (side == 0 && rayDirX > 0) texX = texture.width - texX - 1;
      if (side == 1 && rayDirY < 0) texX = texture.width - texX - 1;

      this.ctx.globalAlpha = 1;
      if (hit) {
        let left = Math.floor(column * this.widthSpacing);
        let wallHeight = drawEndY - drawStartY;

        this.ctx.drawImage(
          texture.image,
          texX, // sx
          0, // sy
          1, // sw
          texture.height, // sh
          left, // dx
          drawStartY, // dy - yes we go into minus here, it'll be ignored anyway
          width, // dw
          wallHeight // dh
        );

        // this is the shading of the texture - a sort of black overlay
        this.ctx.fillStyle = `#000000`;
        let alpha =
          (perpWallDist +
            // step.shading
            0) /
            this.lightRange -
          map.light;
        alpha = Math.min(alpha, 0.8);
        if (side == 1) {
          // give x and y sides different brightness
          alpha = alpha * 2;
        }
        alpha = Math.min(alpha, 0.85);
        // ensure walls are always at least a little bit visible - alpha 1 is all black
        this.ctx.globalAlpha = alpha;
        this.ctx.fillRect(left, drawStartY, width, wallHeight);
        this.ctx.globalAlpha = 1;
      }
    }

    return ZBuffer;
  }

  // draws columns left to right
  async drawSprites(
    player: Player,
    map: GridMap,
    spriteMap: SpriteMap,
    ZBuffer: { [key: number]: number }
  ) {
    // SPRITE CASTING
    // sort sprites from far to close
    const sortedSprites = sortBy(
      spriteMap.sprites,
      (sprite) =>
        (player.position.x - sprite[0]) * (player.position.x - sprite[0]) +
        (player.position.y - sprite[1]) * (player.position.y - sprite[1])
    ).reverse();

    // after sorting the sprites, do the projection and draw them
    for (let i = 0; i < spriteMap.size; i++) {
      // translate sprite position to relative to camera
      let sprite = sortedSprites[i];
      let spriteX = sprite[0] - player.position.x;
      let spriteY = sprite[1] - player.position.y;

      // transform sprite with the inverse camera matrix
      // [ planeX   dirX ] -1                                       [ dirY      -dirX ]
      // [               ]       =  1/(planeX*dirY-dirX*planeY) *   [                 ]
      // [ planeY   dirY ]                                          [ -planeY  planeX ]

      let invDet =
        1.0 /
        (player.position.planeX * player.position.dirY -
          player.position.dirX * player.position.planeY); //required for correct matrix multiplication

      let transformX =
        invDet *
        (player.position.dirY * spriteX - player.position.dirX * spriteY);
      let transformY =
        invDet *
        (-player.position.planeY * spriteX + player.position.planeX * spriteY); //this is actually the depth inside the screen, that what Z is in 3D

      let spriteScreenX = Math.floor(
        (this.width / 2) * (1 + transformX / transformY)
      );

      const vMove = 0;
      // to control the pitch / jump
      let vMoveScreen =
        Math.floor(vMove / transformY) +
        player.position.pitch +
        player.position.z;

      let texture: Bitmap;
      let spriteTextureHeight = 1;
      switch (sprite[2]) {
        case SpriteType.TREE_CONE:
          texture = map.treeTexture;
          spriteTextureHeight = 1.2;
          break;
        case SpriteType.TREE_VASE:
          texture = map.treeTextureVase;
          break;
        case SpriteType.TREE_COLUMNAR:
          texture = map.treeTextureColumnar;
          spriteTextureHeight = 1.3;
          break;
        case SpriteType.PILLAR:
          texture = map.pillarTexture;
          spriteTextureHeight = 0.8;
          break;
      }

      // calculate height of the sprite on screen
      let spriteFullHeight = Math.abs(Math.floor(this.height / transformY)); //using 'transformY' instead of the real distance prevents fisheye
      let spriteHeight = Math.abs(
        Math.floor(spriteTextureHeight * (this.height / transformY))
      ); //using 'transformY' instead of the real distance prevents fisheye
      // calculate lowest and highest pixel to fill in current stripe
      let fullDrawStartY =
        -spriteHeight / 2 +
        this.height / 2 +
        vMoveScreen +
        (spriteFullHeight - spriteHeight) / 2;
      let fullDrawEndY =
        spriteHeight / 2 +
        this.height / 2 +
        vMoveScreen +
        (spriteFullHeight - spriteHeight) / 2;

      // calculate width of the sprite
      let spriteWidth = Math.abs(
        Math.floor(spriteTextureHeight * (this.height / transformY))
      );
      let drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX);
      if (drawStartX < 0) drawStartX = 0;
      let drawEndX = spriteWidth / 2 + spriteScreenX;
      if (drawEndX >= this.width) drawEndX = this.width - 1;

      const alpha = (transformY + 0) / this.lightRange - map.light;
      // ensure walls are always at least a little bit visible - alpha 1 is all black
      this.ctx.filter = `brightness(${Math.min(
        Math.max(0, Math.floor(100 - alpha * 100), 20)
      )}%)`; // min 20% brightness

      // push parts of stripe that are visible into array and draw in discrete steps (since brightness is very inefficient we cannot draw vertical stripe by vertical stripe)
      let stripeParts: number[] = [];
      for (
        let stripe = drawStartX;
        stripe < drawEndX;
        stripe += this.widthSpacing
      ) {
        // the conditions in the if are:
        //1) it's in front of camera plane so you don't see things behind you
        //2) it's on the screen (left)
        //3) it's on the screen (right)
        //4) ZBuffer, with perpendicular distance
        if (
          transformY > 0 &&
          stripe >= 0 &&
          stripe <= this.width &&
          transformY < ZBuffer[Math.floor(stripe / this.widthSpacing)]
        ) {
          // no x yet
          if (stripeParts.length % 2 === 0) {
            let dx = Math.floor(stripe);
            stripeParts.push(dx);
          }
          // handle last frame
          if (
            stripe + this.widthSpacing >= drawEndX &&
            stripeParts.length % 2 === 1
          ) {
            stripeParts.push(stripe);
          }
        } else if (stripeParts.length % 2 === 1) {
          // no y yet
          stripeParts.push(stripe);
        }
      }

      for (let stripeIdx = 0; stripeIdx < stripeParts.length; stripeIdx += 2) {
        let texX1 = Math.floor(
          ((stripeParts[stripeIdx] - (-spriteWidth / 2 + spriteScreenX)) *
            texture.width) /
            spriteWidth
        );
        let texX2 = Math.ceil(
          ((stripeParts[stripeIdx + 1] - (-spriteWidth / 2 + spriteScreenX)) *
            texture.width) /
            spriteWidth
        );

        this.ctx.drawImage(
          texture.image,
          texX1, // sx
          0, // sy
          texX2 - texX1, // sw
          texture.height, // sh
          stripeParts[stripeIdx], // dx
          fullDrawStartY, // dy
          stripeParts[stripeIdx + 1] - stripeParts[stripeIdx], // dw
          fullDrawEndY - fullDrawStartY // dh
        );
      }
    }
    this.ctx.filter = `brightness(100%)`;
  }

  // draws columns left to right
  drawColumns(player: Player, map: GridMap, spriteMap: SpriteMap) {
    this.ctx.save();

    this.drawCeilingFloor(player, map);
    let ZBuffer = this.drawWalls(player, map);
    this.drawSprites(player, map, spriteMap, ZBuffer);

    this.ctx.restore();
  }

  drawWeapon(weapon: Bitmap, paces: number): void {
    let bobX = Math.cos(paces * 2) * this.scale * 6;
    let bobY = Math.sin(paces * 4) * this.scale * 6;
    let left = this.width * 0.66 + bobX;
    let top = this.height * 0.6 + bobY;
    this.ctx.drawImage(
      weapon.image,
      left,
      top,
      weapon.width * this.scale,
      weapon.height * this.scale
    );
  }
}
