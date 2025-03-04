import { makeAutoObservable } from "mobx";
import pillarTexture from "../../assets/barrel1.png";
import ceilingTexture from "../../assets/ceiling-scaled2.jpeg";
import panorama from "../../assets/deathvalley_panorama.jpg";
import floorTexture3 from "../../assets/floor5-scaled.jpeg";
import treeTextureColumnar from "../../assets/trees/columnnar.png";
import treeTexture1 from "../../assets/trees/open.png";
import treeTexture from "../../assets/trees/pyramid.png";
import treeTextureVase from "../../assets/trees/vase.png";
import wallTexture from "../../assets/wall_texture.jpg";
import { Bitmap } from "./bitmap";
import { perlinNoise } from "./constants";

export interface Point {
  x: number; // x coordinate on the grid
  y: number; // y coordinate on the grid
  flooredX?: number; // to know exactly which coordinate in the grid we checked in
  flooredY?: number; // to know exactly which coordinate in the grid we checked in
  height?: number;
  distance?: number;
  shading?: number;
  offset?: number;
  length2?: number;
  type?: "wall" | "tree"; // whether there is a wall or a tree at a certain point on the grid
}

export class GridMap {
  public size: number;
  public wallGrid: Uint8Array;
  public skybox: Bitmap;
  public wallTexture: Bitmap;
  public treeTexture: Bitmap;
  public treeTexture1: Bitmap;
  public floorTexture: Bitmap;
  public ceilingTexture: Bitmap;
  public treeTextureVase: Bitmap;
  public treeTextureColumnar: Bitmap;
  public pillarTexture: Bitmap;
  public light: number;

  constructor(size: number) {
    this.size = size;
    this.wallGrid = new Uint8Array(size * size);
    this.skybox = new Bitmap(panorama, 2000, 750);
    this.wallTexture = new Bitmap(wallTexture, 1024, 1024);
    this.treeTexture = new Bitmap(treeTexture, 452, 679);
    this.treeTexture1 = new Bitmap(treeTexture1, 452, 679);
    this.treeTextureVase = new Bitmap(treeTextureVase, 500, 522);
    this.floorTexture = new Bitmap(floorTexture3, 187, 187);
    // this.floorTexture = new Bitmap(floorTexture4, 176, 176);
    this.ceilingTexture = new Bitmap(ceilingTexture, 145, 145);
    this.treeTextureColumnar = new Bitmap(treeTextureColumnar, 229, 645);
    this.pillarTexture = new Bitmap(pillarTexture, 256, 640);
    this.pillarTexture = new Bitmap(pillarTexture, 355, 438);

    this.light = 0;
    // prettier-ignore
    this.wallGrid = new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0,
      0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
      0, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0,
      0, 1, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 1, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0,
      0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
      0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0,
      0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
  ]);
    makeAutoObservable(this);
  }

  // returns 1 or 0, depending on whether there is a wall at that point
  public get = (x: number, y: number): number => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
    return this.wallGrid[y * this.size + x];
  };

  // old function which randomizes the world
  public randomize = (): void => {
    for (let i = 0; i < this.size * this.size; i++) {
      this.wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
    }
  };

  hash(x: number, y: number) {
    return ((x * 73856093) ^ (y * 19349663)) % 100;
  }
  generateWorld(): void {
    // Step 1: Generate walls using noise
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        // let elevation = noise2D(x * 0.1, y * 0.1);
        let elevation = perlinNoise.perlin2(x * 0.1, y * 0.1);
        elevation = (elevation * 5) << 2;
        this.wallGrid[y * this.size + x] =
          elevation > 1 && elevation < 9 ? 1 : 0; // 1 = wall, 0 = empty space
      }
    }

    return;
    // Step 2: Identify enclosed structures and remove inner walls
    let newGrid = new Uint8Array(this.wallGrid); // Ensure proper type
    for (let y = 1; y < this.size - 1; y++) {
      for (let x = 1; x < this.size - 1; x++) {
        if (this.wallGrid[y * this.size + x] === 1) {
          const neighbors = [
            this.wallGrid[(y - 1) * this.size + x],
            this.wallGrid[(y + 1) * this.size + x],
            this.wallGrid[y * this.size + (x - 1)],
            this.wallGrid[y * this.size + (x + 1)],
          ];
          if (neighbors.every((n) => n === 1)) {
            newGrid[y * this.size + x] = 0; // Remove inner walls
          }
        }
      }
    }
    this.wallGrid = newGrid;

    // Step 3: Add doors to horizontal and vertical lines
    // Add doors for horizontal lines
    for (let y = 0; y < this.size; y++) {
      let count = 0;
      for (let x = 0; x < this.size; x++) {
        if (this.wallGrid[y * this.size + x] === 1) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = 1; i < count; i += 2) {
              this.wallGrid[y * this.size + (x - i)] = 0; // Add a door
            }
          }
          count = 0; // Reset count for the next segment
        }
      }
      // Check at the end of the line
      if (count >= 3) {
        for (let i = 1; i < count; i += 2) {
          this.wallGrid[y * this.size + (this.size - 1 - i)] = 0; // Add a door at the end
        }
      }
    }

    // Add doors for vertical lines
    for (let x = 0; x < this.size; x++) {
      let count = 0;
      for (let y = 0; y < this.size; y++) {
        if (this.wallGrid[y * this.size + x] === 1) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = 1; i < count; i += 3) {
              this.wallGrid[(y - i) * this.size + x] = 0; // Add a door
            }
          }
          count = 0; // Reset count for the next segment
        }
      }
      // Check at the end of the column
      if (count >= 3) {
        for (let i = 1; i < count; i += 2) {
          this.wallGrid[(this.size - 1 - i) * this.size + x] = 0; // Add a door at the end
        }
      }
    }
  }

  // Helper function to check if a neighboring cell has a tree, so we don't cluster them
  private hasTreeNeighbor(x: number, y: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue; // Skip self
        let nx = x + dx;
        let ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < this.size && ny < this.size) {
          if (this.wallGrid[ny * this.size + nx] === 2) {
            return true; // Found a tree nearby
          }
        }
      }
    }
    return false;
  }

  public stepTriangle = (
    rise: number,
    run: number,
    x: number,
    y: number,
    inverted?: boolean
  ): Point => {
    if (run === 0) return { length2: Infinity, x: undefined, y: undefined };
    let dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
    let dy = dx * (rise / run);
    let newX = inverted ? y + dy : x + dx;
    let newY = inverted ? x + dx : y + dy;
    return {
      x: newX,
      y: newY,
      flooredX: Math.floor(x),
      flooredY: Math.floor(y),
      length2: dx * dx + dy * dy, // for the pythagorean theorem, so we can get the distance we made (which is the hypothenuse)
    };
  };

  public inspectForWall = (
    sin: number,
    cos: number,
    nextStep: Point,
    shiftX: number,
    shiftY: number,
    distance: number,
    offset: number,
    hitWall: boolean
  ): Point => {
    let dx = cos < 0 ? shiftX : 0;
    let dy = sin < 0 ? shiftY : 0;
    nextStep.height = 0;

    // skip checking if we're already hit a wall
    if (!hitWall) {
      // height=1 if there is a wall
      const gridItem = this.get(nextStep.x - dx, nextStep.y - dy);
      if (gridItem === 2) {
        nextStep.height = 0.75;
        nextStep.type = "tree";
      } else if (gridItem === 1) {
        nextStep.height = 1;
        nextStep.type = "wall";
      }
    }
    nextStep.distance = distance + Math.sqrt(nextStep.length2);

    if (shiftX) nextStep.shading = cos < 0 ? 2 : 0;
    else nextStep.shading = sin < 0 ? 2 : 1;

    nextStep.offset = offset - Math.floor(offset);
    // console.log(nextStep.offset);
    // nextStep.offset = 0;
    return nextStep;
  };

  // trace one ray along intersection lines of the ray with the grid to find walls;
  // return one point for each intersection line all the way up to max range, so we can draw rain
  // in front of and behind the wall; which mean length is dependent upon intersection points up to max range;
  // if we were not drawing rain, we could return just one point at which the wall height is above 0
  public cast = (point: Point, angle: number, maxRange: number): Point[] => {
    let sin = Math.sin(angle);
    let cos = Math.cos(angle);

    let origin: Point = { x: point.x, y: point.y, height: 0, distance: 0 };
    let arr = [origin];
    let hitWall: boolean = false;

    while (true) {
      // closest grid line in x direction
      let stepX = this.stepTriangle(sin, cos, origin.x, origin.y);
      // closest grid line in y direction
      let stepY = this.stepTriangle(cos, sin, origin.y, origin.x, true);

      // use the shorter distance to check for wall
      let nextStep =
        stepX.length2 < stepY.length2
          ? this.inspectForWall(
              sin,
              cos,
              stepX,
              1,
              0,
              origin.distance,
              stepX.y,
              hitWall
            )
          : this.inspectForWall(
              sin,
              cos,
              stepY,
              0,
              1,
              origin.distance,
              stepY.x,
              hitWall
            );

      if (nextStep.type == "wall") {
        hitWall = true;
      }

      if (nextStep.distance > maxRange) break;
      origin = nextStep;
      arr = arr.concat(nextStep);
    }
    return arr;
  };

  public update = (seconds: number) => {
    if (this.light > 0) this.light = Math.max(this.light - 10 * seconds, 0);
    // else if (Math.random() * 5 < seconds) this.light = 2;
  };
}
