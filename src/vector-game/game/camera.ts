import { sortBy } from "lodash";
import { makeAutoObservable } from "mobx";
import { drawArbitraryQuadImage, FILL_METHOD } from "../arbitrary-quads";
import { Bitmap } from "./bitmap";
import { GridMap } from "./gridMap";
import { Player } from "./player";
import { SpriteMap, SpriteType } from "./spriteMap";

interface CoordItem {
  x: number;
  y: number;
  distance: number;
  hasWall: boolean;
  hasCeilingFloor: boolean;
  visibleSquares: {
    [key: string]: number[];
  };
}
interface Coords {
  [key: string]: // key `${x}-${y}`
  CoordItem;
}

interface Sprite {
  x: number;
  y: number;
  type: SpriteType;
}
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

  translateCoordinateToCamera(
    player: Player,
    point: number[],
    heightMultiplier: number = 1
  ): {
    screenX: number;
    screenYFloor: number;
    screenYCeiling: number;
    distance: number;
    fullHeight: number;
    transformX: number;
    transformY: number;
  } {
    const distX = 0; //player.position.dirX;
    const distY = 0; //player.position.dirY;
    // console.log(`${player.position.dirX} ${player.position.dirY}`);
    // console.log("VALUES");
    // console.log(distX);
    // console.log(distY);

    const playerPositionX = player.position.x - distX;
    const playerPositionY = player.position.y - distY;
    const playerPositionPlaneX = player.position.planeX;
    const playerPositionPlaneY = player.position.planeY;
    const playerPositionDirX = player.position.dirX;
    const playerPositionDirY = player.position.dirY;

    // translate x y position to relative to camera
    let spriteX = point[0] - playerPositionX;
    let spriteY = point[1] - playerPositionY;
    // if (Math.abs(spriteX) < 1) spriteX = 1 * (spriteX / spriteX);
    // if (Math.abs(spriteY) < 1) spriteY = 1 * (spriteY / spriteY);

    // transform sprite with the inverse camera matrix
    // [ planeX   dirX ] -1                                       [ dirY      -dirX ]
    // [               ]       =  1/(planeX*dirY-dirX*planeY) *   [                 ]
    // [ planeY   dirY ]                                          [ -planeY  planeX ]

    let invDet = Math.abs(
      1.0 /
        (playerPositionPlaneX * playerPositionDirY -
          playerPositionDirX * playerPositionPlaneY)
    ); // required for correct matrix multiplication
    let transformX =
      invDet * (playerPositionDirY * spriteX - playerPositionDirX * spriteY);
    let transformY =
      invDet *
      (-playerPositionPlaneY * spriteX + playerPositionPlaneX * spriteY); // this is actually the depth inside the screen, that what Z is in 3D
    if (transformY < 0) {
      // transformY = 0.05;
      transformY = Math.abs(transformY);
    }
    if (transformY < 0.1) {
      transformY = 0.1;
    }

    let screenX = Math.floor((this.width / 2) * (1 + transformX / transformY));
    // if (transformY < 0) {
    //   screenX = this.width - screenX;
    // }
    // if (screenX > 5000) {
    //   screenX = 5000;
    // }
    // to control the pitch / jump
    let vMoveScreen = player.position.pitch + player.position.z;

    // DIVIDE BY FOCAL LENGTH WHICH IS LENGTH OF THE PLANE VECTOR
    let yHeightBeforeAdjustment = Math.abs(
      Math.floor(this.height / player.position.planeYInitial / transformY)
    );
    let yHeight = yHeightBeforeAdjustment * heightMultiplier; // using 'transformY' instead of the real distance prevents fisheye
    let heightDistance = yHeightBeforeAdjustment - yHeight;
    let screenCeilingY = this.height / 2 - yHeight / 2;
    let screenFloorY = this.height / 2 + yHeight / 2;
    let spriteFloorScreenY = screenFloorY + vMoveScreen + heightDistance / 2;
    let spriteCeilingScreenY =
      screenCeilingY + vMoveScreen + heightDistance / 2;
    let fullHeight = spriteCeilingScreenY - spriteFloorScreenY;

    return {
      screenX: screenX,
      screenYFloor: spriteFloorScreenY,
      screenYCeiling: spriteCeilingScreenY,
      distance: transformY,
      fullHeight: fullHeight,
      transformX,
      transformY,
    };
  }

  raycastVisibleCoordinates(
    spriteMap: SpriteMap,
    player: Player,
    map: GridMap
  ): { coords: Coords; sprites: Sprite[] } {
    const coords: Coords = {};
    const sprites: Sprite[] = [];
    let ZBuffer: { [key: number]: number } = {};

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

      let side: number; // was a NS or a EW wall hit? if x then side = 0, if y then side = 1
      // perform DDA
      let range = this.range;
      while (hit == 0 && range >= 0) {
        // // jump to next map square, either in x-direction, or in y-direction
        // if (sideDistX < sideDistY) {
        //   sideDistX += deltaDistX;
        //   mapX += stepX;
        //   side = 0;
        // } else {
        //   sideDistY += deltaDistY;
        //   mapY += stepY;
        //   side = 1;
        // }

        const xCoord = Math.floor(mapX);
        const yCoord = Math.floor(mapY);
        const mapValue = map.get(mapX, mapY);
        // Check if ray has hit a wall
        if (mapValue == 1) hit = 1;
        const hasCeilingFloor = mapValue === 2;
        const coordIdx = `${xCoord}-${yCoord}}`;
        const oldCoordObj = coords[coordIdx];

        // only once so we don't duplicate the sprites
        if (!oldCoordObj) {
          // find sprites
          const spritesForCoord = spriteMap.sprites
            .filter(
              (sp) =>
                Math.floor(sp[0]) === xCoord && Math.floor(sp[1]) === yCoord
            )
            .map((sp) => ({ x: sp[0], y: sp[1], type: sp[2] }));
          sprites.push(...spritesForCoord);
        }

        let coordObj = oldCoordObj || { visibleSquares: {} };
        coords[`${xCoord}-${yCoord}}`] = {
          ...coordObj,
          distance: 0,
          hasWall: !!hit,
          x: xCoord,
          y: yCoord,
          hasCeilingFloor: hasCeilingFloor,
        };
        if (hit) {
          // if (range == this.range) side == 1 ? (side = 0) : (side = 1);
          // bottom two coords of the side of the wall we're looking at
          let x: number, y: number, x1: number, y1: number;
          let wallSide: "n" | "e" | "w" | "s" = null;
          if (stepX === 1 && stepY === 1) {
            if (side === 0) {
              wallSide = "w";
            } else if (side === 1) {
              wallSide = "s";
            }
          } else if (stepX === -1 && stepY === 1) {
            if (side === 0) {
              wallSide = "e";
            } else if (side === 1) {
              wallSide = "s";
            }
          } else if (stepX === 1 && stepY === -1) {
            if (side === 0) {
              wallSide = "w";
            } else if (side === 1) {
              wallSide = "n";
            }
          } else if (stepX === -1 && stepY === -1) {
            if (side === 0) {
              wallSide = "e";
            } else if (side === 1) {
              wallSide = "n";
            }
          }

          switch (wallSide) {
            case "n":
              x = xCoord;
              y = yCoord + 1;
              x1 = xCoord + 1;
              y1 = yCoord + 1;
              break;
            case "s":
              x = xCoord;
              y = yCoord;
              x1 = xCoord + 1;
              y1 = yCoord;
              break;
            case "e":
              x = xCoord + 1;
              y = yCoord;
              x1 = xCoord + 1;
              y1 = yCoord + 1;
              break;
            case "w":
              x = xCoord;
              y = yCoord;
              x1 = xCoord;
              y1 = yCoord + 1;
              break;
          }
          // add the visible square we're seeing
          if (!coords[coordIdx].visibleSquares[wallSide]) {
            // if (range == this.range) {
            //   coords[coordIdx].visibleSquares[wallSide] = [
            //     this.width - x,
            //     y,
            //     this.width - x1,
            //     y1,
            //   ];
            // } else {
            coords[coordIdx].visibleSquares[wallSide] = [x, y, x1, y1];
            // }
          }
        }

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
    }

    return { coords, sprites };
  }

  drawWallNew(coords: Coords, player: Player, map: GridMap) {
    const wallSrcPoints = [
      { x: 0, y: 0 },
      { x: 0, y: map.wallTexture.height },
      { x: map.wallTexture.width, y: map.wallTexture.height },
      { x: map.wallTexture.width, y: 0 },
    ];

    const coordValues = Object.values(coords);
    const squares: {
      avgDistance: number;
      screenX1: number;
      screenYFloor1: number;
      screenYCeiling1: number;
      screenX2: number;
      screenYFloor2: number;
      screenYCeiling2: number;
      screenXHalf: number;
      screenYFloorHalf: number;
      screenYCeilingHalf: number;
      key: string;
      x: number;
      y: number;
      transformX1: number;
      transformX2: number;
      transformY1: number;
      transformY2: number;
    }[] = [];
    // for each coordinate that we see on screen
    for (let coordItem of coordValues) {
      for (let [key, wall] of Object.entries(coordItem.visibleSquares)) {
        const {
          screenX: screenX1,
          screenYFloor: screenYFloor1,
          screenYCeiling: screenYCeiling1,
          distance: x1Distance,
          transformX: transformX1,
          transformY: transformY1,
        } = this.translateCoordinateToCamera(player, [wall[0], wall[1]]);
        // const {
        //   screenX: screenXQuarter1,
        //   screenYFloor: screenYFloorQuarter1,
        //   screenYCeiling: screenYCeilingQuarter1,
        //   distance: xQuarter1Distance,
        //   transformX: transformXQuarter1,
        //   transformY: transformYQuarter1,
        // } = this.translateCoordinateToCamera(player, [
        //   (wall[0] + wall[2]) / 4,
        //   (wall[1] + wall[3]) / 4,
        // ]);
        const {
          screenX: screenXHalf,
          screenYFloor: screenYFloorHalf,
          screenYCeiling: screenYCeilingHalf,
          distance: xHalfDistance,
          transformX: transformXHalf,
          transformY: transformYHalf,
        } = this.translateCoordinateToCamera(player, [
          (wall[0] + wall[2]) / 2,
          (wall[1] + wall[3]) / 2,
        ]);
        const {
          screenX: screenX2,
          screenYFloor: screenYFloor2,
          screenYCeiling: screenYCeiling2,
          distance: x2Distance,
          transformX: transformX2,
          transformY: transformY2,
        } = this.translateCoordinateToCamera(player, [wall[2], wall[3]]);
        const avgDistance = (x1Distance + x2Distance) / 2;

        squares.push({
          x: wall[0],
          y: wall[1],
          avgDistance,
          screenX1,
          screenYFloor1,
          screenYCeiling1,
          screenX2,
          screenYFloor2,
          screenYCeiling2,
          screenXHalf,
          screenYFloorHalf,
          screenYCeilingHalf,
          key,
          transformX1: transformX1,
          transformY1: transformY1,
          transformX2: transformX2,
          transformY2: transformY2,
        });
      }
    }
    const sortedSquares = sortBy(
      squares,
      (sprite) => sprite.avgDistance
    ).reverse();
    let idx = 0;
    for (let square of sortedSquares) {
      idx += 1;
      this.ctx.save();
      // 1st half
      drawArbitraryQuadImage(
        this.ctx,
        this.map.wallTexture.image as CanvasImageSource,
        wallSrcPoints,
        [
          { x: square.screenX2, y: square.screenYCeiling2 },
          { x: square.screenX2, y: square.screenYFloor2 },
          { x: square.screenX1, y: square.screenYFloor1 },
          { x: square.screenX1, y: square.screenYCeiling1 },
        ],
        FILL_METHOD.BILINEAR,
        4
      );
      // // 2nd half
      // drawArbitraryQuadImage(
      //   this.ctx,
      //   this.map.wallTexture.image as CanvasImageSource,
      //   wallSrcPointsHalf,
      //   [
      //     { x: square.screenX2, y: square.screenYCeiling2 },
      //     { x: square.screenX2, y: square.screenYFloor2 },
      //     { x: square.screenXHalf, y: square.screenYFloorHalf },
      //     { x: square.screenXHalf, y: square.screenYCeilingHalf },
      //   ],
      //   FILL_METHOD.BILINEAR,
      //   4
      // );
      this.ctx.restore();

      // handle brightness
      this.ctx.save();

      const alpha = square.avgDistance / this.lightRange - map.light;
      // ensure walls are always at least a little bit visible - alpha 1 is all black
      let brightness = Math.min(Math.max(0, Math.floor(100 - alpha * 100), 20));
      // brightness = 0;
      this.ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness / 100})`;

      // if (square.key == "n") {
      //   this.ctx.fillStyle = `rgba(255, 0, 0, ${square.screenX1 / this.width})`;
      // }
      // if (square.key == "s") {
      //   this.ctx.fillStyle = `rgba(0, 255, 0, ${square.screenX1 / this.width})`;
      // }
      // if (square.key == "e") {
      //   this.ctx.fillStyle = `rgba(0, 0, 255, ${square.screenX1 / this.width})`;
      // }
      // if (square.key == "w") {
      //   this.ctx.fillStyle = `rgba(0, 255, 255, ${
      //     square.screenX1 / this.width
      //   })`;
      // }

      // console.log(parseInt(square.key.split("-")[0]));
      // console.log(square.x);
      // this.ctx.fillStyle = `rgba(${(square.y + square.x) * 20}, ${
      //   255 - (square.y + square.x) * 20
      // }, ${1 == 0 ? (square.screenX1 / this.width) * 255 : 255}, ${1})`;
      this.ctx.beginPath();
      this.ctx.moveTo(square.screenX2 || 0, square.screenYCeiling2 || 0);
      this.ctx.lineTo(square.screenX2 || 0, square.screenYFloor2 || 0);
      this.ctx.lineTo(square.screenX1 || 0, square.screenYFloor1 || 0);
      this.ctx.lineTo(square.screenX1 || 0, square.screenYCeiling1 || 0);
      this.ctx.fill();

      this.ctx.strokeStyle = `rgb(255, 255, 255)`;
      this.ctx.beginPath();
      this.ctx.moveTo(square.screenX2 || 0, square.screenYCeiling2 || 0);
      this.ctx.lineTo(square.screenX2 || 0, square.screenYFloor2 || 0);
      this.ctx.lineTo(square.screenX1 || 0, square.screenYFloor1 || 0);
      this.ctx.lineTo(square.screenX1 || 0, square.screenYCeiling1 || 0);
      this.ctx.stroke();

      this.ctx.fillStyle = "#000000";
      this.ctx.font = "20px serif";
      this.ctx.fillText(
        `${square.screenX1}/${square.screenX2}`,
        (square.screenX1 + square.screenX2) / 2,
        this.height / 2
      );
      this.ctx.fillText(
        `${square.screenX1}/${square.screenX2}`,
        (square.screenX1 + square.screenX2) / 2 +
          (square.screenX2 - square.screenX1) / 4,
        this.height / 2
      );
      this.ctx.fillText(
        `${square.screenX1}/${square.screenX2}`,
        square.screenX1,
        this.height / 2
      );
      this.ctx.fillText(
        `tx1:${square.transformX1.toFixed(3)}`,
        square.screenX1,
        this.height / 2 + 30
      );
      this.ctx.fillText(
        `ty1:${square.transformY1.toFixed(3)}`,
        square.screenX1,
        this.height / 2 + 50
      );
      this.ctx.fillText(
        `tx2: ${square.transformX2.toFixed(3)} `,
        square.screenX1,
        this.height / 2 + 70
      );
      this.ctx.fillText(
        `ty2: ${square.transformY2.toFixed(3)}`,
        square.screenX1,
        this.height / 2 + 90
      );
      this.ctx.fillText(
        `key: ${square.key}`,
        square.screenX1,
        this.height / 2 + 110
      );
      this.ctx.restore();
    }
  }

  // draws columns left to right
  drawCeilingFloor(coords: Coords, player: Player, map: GridMap) {
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
    let dst = 0;
    const coordValues = Object.values(coords);

    // for each coordinate that we see on screen
    for (let coordItem of coordValues) {
      const x = coordItem.x;
      const y = coordItem.y;
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
        const { screenX, screenYCeiling, screenYFloor, distance } =
          this.translateCoordinateToCamera(player, point);

        if (
          distance >= 0 &&
          screenX >= 0 &&
          screenX <= width &&
          distance < 10
        ) {
          dst = Math.abs(distance);
          numOnScreen++;
        }
        floorScreenPoints.push({ x: screenX, y: screenYFloor });
        ceilingScreenPoints.push({
          x: screenX,
          y: screenYCeiling,
        });
      }

      let tesselation = 9 - dst * 2;
      if (tesselation <= 1) tesselation = 1;
      if (tesselation >= 7) tesselation = 7;
      tesselation = 1;
      if (numOnScreen >= 1) {
        const alpha = (dst + 0) / this.lightRange - map.light;
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

        this.ctx.fillStyle = `rgb(255, 0, 0)`;
        this.ctx.beginPath();
        this.ctx.moveTo(floorScreenPoints[0].x, floorScreenPoints[0].y);
        this.ctx.lineTo(floorScreenPoints[1].x, floorScreenPoints[1].y);
        this.ctx.lineTo(floorScreenPoints[2].x, floorScreenPoints[2].y);
        this.ctx.lineTo(floorScreenPoints[3].x, floorScreenPoints[3].y);
        this.ctx.fill();

        this.ctx.fillStyle = `rgb(255, 255, 0)`;
        this.ctx.beginPath();
        this.ctx.moveTo(ceilingScreenPoints[0].x, ceilingScreenPoints[0].y);
        this.ctx.lineTo(ceilingScreenPoints[1].x, ceilingScreenPoints[1].y);
        this.ctx.lineTo(ceilingScreenPoints[2].x, ceilingScreenPoints[2].y);
        this.ctx.lineTo(ceilingScreenPoints[3].x, ceilingScreenPoints[3].y);
        this.ctx.fill();

        this.ctx.restore();
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
      let lineHeight: number =
        this.height / player.position.planeYInitial / perpWallDist;

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
    sprites: Sprite[],
    player: Player,
    map: GridMap,
    ZBuffer: { [key: number]: number }
  ) {
    // SPRITE CASTING
    // sort sprites from far to close
    const sortedSprites = sortBy(
      sprites,
      (sprite) =>
        (player.position.x - sprite.x) * (player.position.x - sprite.x) +
        (player.position.y - sprite.y) * (player.position.y - sprite.y)
    ).reverse();

    // after sorting the sprites, do the projection and draw them
    for (let i = 0; i < sprites.length; i++) {
      // // translate sprite position to relative to camera
      let sprite = sortedSprites[i];

      let texture: Bitmap;
      let spriteTextureHeight = 1;
      switch (sprite.type) {
        case SpriteType.TREE_CONE:
          texture = map.treeTexture;
          spriteTextureHeight = 1.2;
          break;
        case SpriteType.TREE_VASE:
          texture = map.treeTextureVase;
          spriteTextureHeight = 0.3;
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

      const { screenX, screenYCeiling, screenYFloor, distance } =
        this.translateCoordinateToCamera(
          player,
          [sprite.x, sprite.y],
          spriteTextureHeight
        );

      // calculate width of the sprite
      let spriteWidth = Math.abs(
        Math.floor(spriteTextureHeight * (this.height / distance))
      );
      let drawStartX = Math.floor(-spriteWidth / 2 + screenX);
      if (drawStartX < 0) drawStartX = 0;
      let drawEndX = spriteWidth / 2 + screenX;
      if (drawEndX >= this.width) drawEndX = this.width - 1;

      const alpha = distance / this.lightRange - map.light;
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
          distance > 0 &&
          stripe >= 0 &&
          stripe <= this.width &&
          distance < ZBuffer[Math.floor(stripe / this.widthSpacing)]
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
          ((stripeParts[stripeIdx] - (-spriteWidth / 2 + screenX)) *
            texture.width) /
            spriteWidth
        );
        let texX2 = Math.ceil(
          ((stripeParts[stripeIdx + 1] - (-spriteWidth / 2 + screenX)) *
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
          screenYCeiling, // dy
          stripeParts[stripeIdx + 1] - stripeParts[stripeIdx], // dw
          screenYFloor - screenYCeiling // dh
        );
      }
    }
    this.ctx.filter = `brightness(100%)`;
  }

  // draws columns left to right
  drawColumns(player: Player, map: GridMap, spriteMap: SpriteMap) {
    this.ctx.save();

    const { coords, sprites } = this.raycastVisibleCoordinates(
      spriteMap,
      player,
      map
    );
    this.drawCeilingFloor(coords, player, map);
    let ZBuffer = this.drawWalls(player, map);
    this.drawWallNew(coords, player, map);
    this.drawSprites(sprites, player, map, ZBuffer);

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
