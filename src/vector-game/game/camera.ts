import { sortBy } from "lodash";
import { makeAutoObservable } from "mobx";
import { Bitmap } from "./bitmap";
import { GridMap, Point } from "./gridMap";
import { Player } from "./player";
import { SpriteMap } from "./spriteMap";

export class Camera {
  public ctx: CanvasRenderingContext2D;
  public width: number;
  public height: number;
  public resolution: number; // how many columns we draw
  public spacing: number;
  public range: number;
  public lightRange: number;
  public scale: number;

  constructor(canvas: HTMLCanvasElement, resolution?: number) {
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width = window.innerWidth * 0.5;
    this.height = canvas.height = window.innerHeight * 0.5;
    this.resolution = resolution || 320;
    this.spacing = this.width / this.resolution;
    this.range = 54;
    this.lightRange = 8;
    this.scale = (this.width + this.height) / 1200;

    makeAutoObservable(this);
  }

  render(player: Player, map: GridMap, spriteMap: SpriteMap) {
    this.ctx.save();
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
    this.drawSky(
      Math.atan2(player.position.dirX, player.position.dirY) + Math.PI,
      map.skybox,
      map.light
    );
    this.drawColumns(player, map, spriteMap);
    this.drawWeapon(player.weapon, player.paces);
  }

  drawSky(direction: number, sky: Bitmap, ambient: number) {
    let width = sky.width * (this.height / sky.height) * 2;
    let CIRCLE = Math.PI * 2;
    let left = (direction / CIRCLE) * -width;

    this.ctx.save();
    this.ctx.drawImage(sky.image, left, 0, width, this.height);
    if (left < width - this.width) {
      this.ctx.drawImage(sky.image, left + width, 0, width, this.height);
    }
    if (ambient > 0) {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.globalAlpha = ambient * 0.1;
      this.ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);
    }
    this.ctx.restore();
  }

  // draws columns left to right
  drawColumns(
    player: Player,
    map: GridMap,
    spriteMap: SpriteMap
  ): { sprites: Point[] } {
    let ZBuffer: { [key: number]: number } = {};
    let width = Math.ceil(this.spacing);

    // collect all the steps on the way that contained sprites
    let spriteSteps: Point[] = [];

    this.ctx.save();
    for (let column = 0; column < this.resolution; column++) {
      let cameraX = (2 * column) / this.resolution - 1;

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
      // Division through zero is prevented, even though technically that's not
      // needed in C++ with IEEE 754 floating polet values.
      let deltaDistX = rayDirX == 0 ? 1e30 : Math.abs(1 / rayDirX);
      let deltaDistY = rayDirY == 0 ? 1e30 : Math.abs(1 / rayDirY);

      let perpWallDist: number;

      // what direction to step in x or y-direction (either +1 or -1)
      let stepX: number;
      let stepY: number;

      let hit: number = 0; //was there a wall hit?
      let side: number; //was a NS or a EW wall hit?
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
        //Check if ray has hit a wall
        if (map.get(mapX, mapY) == 1) hit = 1;
        range -= 1;
      }
      // Calculate distance projected on camera direction. This is the shortest distance from the polet where the wall is
      // hit to the camera plane. Euclidean to center camera polet would give fisheye effect!
      // This can be computed as (mapX - posX + (1 - stepX) / 2) / rayDirX for side == 0, or same formula with Y
      // for size == 1, but can be simplified to the code below thanks to how sideDist and deltaDist are computed:
      // because they were left scaled to |rayDir|. sideDist is the entire length of the ray above after the multiple
      // steps, but we subtract deltaDist once because one step more into the wall was taken above.
      if (side == 0) perpWallDist = sideDistX - deltaDistX;
      else perpWallDist = sideDistY - deltaDistY;

      // SET THE ZBUFFER FOR THE SPRITE CASTING
      ZBuffer[column] = perpWallDist; //perpendicular distance is used

      // Calculate height of line to draw on screen
      let lineHeight: number = this.height / perpWallDist;

      // calculate lowest and highest pixel to fill in current stripe
      let drawStart = -lineHeight / 2 + this.height / 2;
      let fullDrawStart = drawStart;
      if (drawStart < 0) drawStart = 0;
      let drawEnd = lineHeight / 2 + this.height / 2;
      let fullDrawEnd = drawEnd;
      if (drawEnd >= this.height) drawEnd = this.height - 1;

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
        this.ctx.fillStyle = `#cccccc`;
        this.ctx.drawImage(
          texture.image,
          texX, // sx
          0, // sy
          1, // sw
          texture.height, // sh
          column * this.spacing, // dx
          fullDrawStart, // dy - yes we go into minus here, it'll be ignored anyway
          width, // dw
          fullDrawEnd - fullDrawStart // dh
        );
      }
    }

    let treeTexture = map.treeTexture;

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
      let spriteX = sortedSprites[i][0] - player.position.x;
      let spriteY = sortedSprites[i][1] - player.position.y;

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

      // calculate height of the sprite on screen
      let spriteHeight = Math.abs(Math.floor(this.height / transformY)); //using 'transformY' instead of the real distance prevents fisheye
      // calculate lowest and highest pixel to fill in current stripe
      let fullDrawStartY = -spriteHeight / 2 + this.height / 2;
      let fullDrawEndY = spriteHeight / 2 + this.height / 2;

      // calculate width of the sprite
      let spriteWidth = Math.abs(Math.floor(this.height / transformY));
      let drawStartX = -spriteWidth / 2 + spriteScreenX;
      if (drawStartX < 0) drawStartX = 0;
      let drawEndX = spriteWidth / 2 + spriteScreenX;
      if (drawEndX >= this.width) drawEndX = this.width - 1;

      // loop through every vertical stripe of the sprite on screen
      for (let stripe = drawStartX; stripe < drawEndX; stripe += this.spacing) {
        let texX = Math.floor(
          ((stripe - (-spriteWidth / 2 + spriteScreenX)) * treeTexture.width) /
            spriteWidth
        );

        // the conditions in the if are:
        //1) it's in front of camera plane so you don't see things behind you
        //2) it's on the screen (left)
        //3) it's on the screen (right)
        //4) ZBuffer, with perpendicular distance
        if (
          transformY > 0 &&
          stripe >= 0 &&
          stripe <= this.width &&
          transformY < ZBuffer[Math.floor(stripe / this.spacing)]
        )
          this.ctx.drawImage(
            treeTexture.image,
            texX, // sx
            0, // sy
            1, // sw
            treeTexture.height, // sh
            stripe, // dx
            fullDrawStartY, // dy
            width, // dw
            fullDrawEndY - fullDrawStartY // dh
          );
      }
    }

    this.ctx.restore();
    return { sprites: spriteSteps };
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

  // this draws ONE vertical column of the ray, top to bottom
  drawColumn(
    column: number,
    ray: Point[], // array of intersection points with the grid along the ray's path forward
    angle: number,
    map: GridMap
  ): void {
    let ctx = this.ctx;
    let wallTexture = map.wallTexture;
    let treeTexture = map.treeTexture;
    let treeTexture1 = map.treeTexture1;

    let left = Math.floor(column * this.spacing);
    let width = Math.ceil(this.spacing);

    // find the polet index at which the wall starts
    let hit = -1;
    while (++hit < ray.length && ray[hit].type != "wall");

    // traverse ray top backwards to front
    for (let s = ray.length - 1; s >= 0; s--) {
      let step = ray[s];
      let rainDrops = Math.pow(Math.random(), 3) * s;
      let rain = rainDrops > 0 && this.project(0.1, angle, step.distance);

      // if we want rain, we uncomment this
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.03;
      while (--rainDrops > 0)
        ctx.fillRect(left, Math.random() * rain.top, 1, rain.height);

      // if we're at the start of a wall, we'll draw the wall and its texture
      if (s === hit) {
        let textureX = Math.floor(wallTexture.width * step.offset);
        let wall = this.project(step.height, angle, step.distance);

        ctx.globalAlpha = 1;
        ctx.drawImage(
          wallTexture.image,
          textureX,
          0,
          1,
          wallTexture.height,
          left,
          wall.top,
          width,
          wall.height
        );

        // this is the shading of the texture - a sort of black overlay
        ctx.fillStyle = `#000000`;
        const alpha =
          (step.distance + step.shading) / this.lightRange - map.light;
        // ensure walls are always at least a little bit visible - alpha 1 is all black
        ctx.globalAlpha = Math.min(alpha, 0.85);
        ctx.fillRect(left, wall.top, width, wall.height);
      } else if (
        // if we're at a tree and there's no wall in front of us in FOV, we'll draw it
        step.type === "tree" &&
        s <= hit - 1 // make sure we're in front, not behind a wall
      ) {
        let textureX = Math.floor(treeTexture1.width * step.offset);
        let tree = this.project(step.height, 0, step.distance);
        ctx.globalAlpha = 1;
        ctx.drawImage(
          treeTexture1.image,
          textureX,
          0,
          1,
          treeTexture1.height,
          left,
          tree.top,
          width,
          tree.height
        );
      }
    }
  }

  project(
    height: number, // e.g. 0.8 for tree, 1 for wall, is preconfigured
    angle: number,
    distance: number // from the camera to the polet we're drawing
  ) {
    // We don't use the Euclidean distance to the polet representing player, but instead the distance
    // to the camera plane (or, the distance of the polet projected on the camera direction to the player), to avoid the fisheye effect
    let z = distance * Math.cos(angle); // multiply by the cosine to get rid of the fisheye effect
    let wallHeight = (this.height * height) / z; // proportional full screen height to the distance
    let bottom = (this.height / 2) * (1 + 1 / z);
    return {
      top: bottom - wallHeight,
      height: wallHeight,
    };
  }
}
