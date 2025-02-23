import { sortBy, uniqBy } from "lodash";
import { makeAutoObservable } from "mobx";
import { Bitmap } from "./bitmap";
import { CIRCLE } from "./constants";
import { GridMap, Point } from "./gridMap";
import { Player } from "./player";
export class Camera {
  public ctx: CanvasRenderingContext2D;
  public width: number;
  public height: number;
  public resolution: number; // how many columns we draw
  public spacing: number;
  public focalLength: number;
  public range: number;
  public lightRange: number;
  public scale: number;

  constructor(
    canvas: HTMLCanvasElement,
    resolution: number,
    focalLength?: number
  ) {
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width = window.innerWidth * 0.5;
    this.height = canvas.height = window.innerHeight * 0.5;
    this.resolution = resolution;
    console.log(this.width);
    this.spacing = this.width / resolution;
    this.focalLength = focalLength || 0.8;
    this.range = 14;
    this.lightRange = 8;
    this.scale = (this.width + this.height) / 1200;

    makeAutoObservable(this);
  }

  render(player: Player, map: GridMap) {
    this.drawSky(player.position.direction, map.skybox, map.light);
    const { sprites } = this.drawColumns(player, map);
    this.drawSprites(player, map, sprites);
    this.drawWeapon(player.weapon, player.paces);
  }

  drawSky(direction: number, sky: Bitmap, ambient: number) {
    let width = sky.width * (this.height / sky.height) * 2;
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
  drawColumns(player: Player, map: GridMap): { sprites: Point[] } {
    // collect all the steps on the way that contained sprites
    let spriteSteps: Point[] = [];

    this.ctx.save();
    for (let column = 0; column < this.resolution; column++) {
      let x = column / this.resolution - 0.5; // scale it so 0 is in the middle
      // angle in radians between straight line from camera forward and the line going to the object;
      // if the object is on the left of our view, angle is negative, if it's on the right, angle is positive;
      // should be about -40 deg to +40deg for current focal length
      let angle = Math.atan2(x, this.focalLength);
      let ray = map.cast(
        player.position,
        player.position.direction + angle,
        this.range
      );
      this.drawColumn(column, ray, angle, map);
      // add in all the steps that contained sprites
      spriteSteps.push(...ray.filter((item) => item.type === "tree"));
      spriteSteps = uniqBy(
        spriteSteps,
        (step) => `${step.flooredX}:${step.flooredY}`
      );
    }

    this.ctx.restore();
    return { sprites: spriteSteps };
  }

  projectToCamera(currSprite, player) {
    // Object position
    const Ox = currSprite.x;
    const Oy = currSprite.y;

    // Camera position and direction
    const Cx = player.position.x;
    const Cy = player.position.y;
    const theta = player.position.dir; // Angle in radians

    // Translate object relative to camera
    const dx = Ox - Cx;
    const dy = Oy - Cy;

    // Rotate into camera space
    const Xp = dx * Math.cos(-theta) - dy * Math.sin(-theta);
    const Yp = dx * Math.sin(-theta) + dy * Math.cos(-theta);

    // Avoid division by zero (object is behind the camera)
    if (Xp <= 0) return null;

    // Projected horizontal position (normalized)
    const Px = Yp / Xp;

    // Projection length (distance in camera space)
    const projectionLength = Xp;

    return { Px, projectionLength };
  }

  drawSprites(player: Player, map: GridMap, sprites: Point[]): void {
    // sort sprites by distance, largest first
    const sortedSprites = sortBy(sprites, ["distance"]).reverse();
    let texture = map.treeTexture;

    this.ctx.save();

    for (let i = 0; i < sortedSprites.length; i++) {
      let currSprite = sortedSprites[i];
      // translate sprite position to relative to camera
      let spriteX = currSprite.x - player.position.x;
      let spriteY = currSprite.y - player.position.y;
      player.position.x;
      //transform sprite with the inverse camera matrix
      // [ planeX   dirX ] -1                                       [ dirY      -dirX ]
      // [               ]       =  1/(planeX*dirY-dirX*planeY) *   [                 ]
      // [ planeY   dirY ]                                          [ -planeY  planeX ]

      // get direction vector
      let dirX = Math.cos(player.position.direction);
      let dirY = Math.sin(player.position.direction);

      // get plane x, y -> perpendicular vector of same size
      let planeX = -dirY;
      let planeY = dirX;

      let invDet = 1.0 / (planeX * dirY - dirX * planeY); // required for correct matrix multiplication

      let transformX = invDet * (dirY * spriteX - dirX * spriteY);
      let transformY = invDet * (-planeY * spriteX + planeX * spriteY); // this is actually the depth inside the screen, that what Z is in 3D

      // x coord in pixels
      let spriteScreenX = Math.floor(
        (this.width / 2) * (1 + transformX / transformY)
      );

      //   console.log(spriteScreenX);

      //calculate height of the sprite on screen
      let spriteHeight = Math.abs(Math.floor(this.height / transformY)); // using 'transformY' instead of the real distance prevents fisheye

      //calculate lowest and highest pixel to fill in current stripe
      let drawStartY = -spriteHeight / 2 + this.height / 2;
      if (drawStartY < 0) drawStartY = 0;
      let drawEndY = spriteHeight / 2 + this.height / 2;
      if (drawEndY >= this.height) drawEndY = this.height - 1;

      const currSprite1 = { x: currSprite.x, y: currSprite.y }; // Object position
      const player1 = {
        position: {
          x: player.position.x,
          y: player.position.y,
          dir: player.position.direction,
        }, // Player position and direction
      };

      const result = this.projectToCamera(currSprite1, player1);
      this.ctx.fillStyle = `pink`;
      this.ctx.fillRect(result.Px, 0, 5, 5);
      this.ctx.fillStyle = `#ffffff`;
      this.ctx.fillRect(spriteScreenX, drawEndY, 5, 5);

      // calculate width of the sprite
      let spriteWidth = Math.abs(Math.floor(this.height / transformY));
      let drawStartX = -spriteWidth / 2 + spriteScreenX;
      if (drawStartX < 0) drawStartX = 0;
      let drawEndX = spriteWidth / 2 + spriteScreenX;
      if (drawEndX >= this.width) drawEndX = this.width - 1;

      let tree = this.project(currSprite.height, 0, currSprite.distance);
      //   let left = Math.floor(column * this.spacing);
      //   let width = Math.ceil(this.spacing);
      //   this.ctx.drawImage(
      //     texture.image,
      //     drawStartX,
      //     // drawStartY,
      //     tree.top,
      //     drawEndX - drawStartX,
      //     // drawEndY - drawStartY
      //     tree.height
      //   );
      //   this.ctx.drawImage(
      //     texture.image,
      //     textureX,
      //     0,
      //     1,
      //     texture.height,
      //     currSprite.flooredX,
      //     tree.top,
      //     drawEndY - drawStartY,
      //     tree.height
      //   );

      //   //loop through every vertical stripe of the sprite on screen
      //   for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
      //     let texX =
      //       Math.floor(
      //         (256 *
      //           (stripe - (-spriteWidth / 2 + spriteScreenX)) *
      //           texture.width) /
      //           spriteWidth
      //       ) / 256;
      //     //the conditions in the if are:
      //     //1) it's in front of camera plane so you don't see things behind you
      //     //2) it's on the screen (left)
      //     //3) it's on the screen (right)
      //     //4) ZBuffer, with perpendicular distance
      //     if (transformY > 0 && stripe > 0 && stripe < this.width)
      //       // for every pixel of the current stripe
      //       for (let y = drawStartY; y < drawEndY; y++) {
      //         let d = y * 256 - this.height * 128 + spriteHeight * 128; // 256 and 128 factors to avoid floats
      //         let texY = (d * texture.height) / spriteHeight / 256;
      //         // let color =
      //         //   texture[sprite[spriteOrder[i]].texture][
      //         //     texture.width * texY + texX
      //         //   ]; //get current color from the texture
      //         // if ((color & 0x00ffffff) != 0) buffer[y][stripe] = color; //paint pixel if it isn't black, black is the invisible color

      //         this.ctx.drawImage(
      //           texture.image,
      //           0,
      //           y,
      //           texture.width * this.scale,
      //           texture.height * this.scale
      //         );
      //       }
      //   }
    }

    // for (let column = 0; column < this.resolution; column++) {
    //   let x = column / this.resolution - 0.5; // scale it so 0 is in the middle
    //   // angle in radians between straight line from camera forward and the line going to the object;
    //   // if the object is on the left of our view, angle is negative, if it's on the right, angle is positive;
    //   // should be about -40 deg to +40deg for current focal length
    //   let angle = Math.atan2(x, this.focalLength);
    //   let ray = map.cast(
    //     player.position,
    //     player.position.direction + angle,
    //     this.range
    //   );
    //   this.drawColumn(column, ray, angle, map);
    // }

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

    // find the point index at which the wall starts
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
    distance: number // from the camera to the point we're drawing
  ) {
    // We don't use the Euclidean distance to the point representing player, but instead the distance
    // to the camera plane (or, the distance of the point projected on the camera direction to the player), to avoid the fisheye effect
    let z = distance * Math.cos(angle); // multiply by the cosine to get rid of the fisheye effect
    let wallHeight = (this.height * height) / z; // proportional full screen height to the distance
    let bottom = (this.height / 2) * (1 + 1 / z);
    return {
      top: bottom - wallHeight,
      height: wallHeight,
    };
  }
}
