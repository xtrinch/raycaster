import { makeAutoObservable } from "mobx";
import panorama from "../assets/deathvalley_panorama.jpg";
import wallTexture from "../assets/wall_texture.jpg";
import { Bitmap } from "./bitmap";
import { noise2D } from "./constants";

export interface Point {
  x: number;
  y: number;
  height?: number;
  distance?: number;
  shading?: number;
  offset?: number;
  length2?: number;
}

export class GridMap {
  public size: number;
  public wallGrid: Uint8Array;
  public skybox: Bitmap;
  public wallTexture: Bitmap;
  public light: number;

  constructor(size: number) {
    this.size = size;
    this.wallGrid = new Uint8Array(size * size);
    this.skybox = new Bitmap(panorama, 2000, 750);
    this.wallTexture = new Bitmap(wallTexture, 1024, 1024);
    this.light = 0;

    makeAutoObservable(this);
  }

  public get = (x: number, y: number) => {
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

  public generateWorld = (): void => {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let elevation = noise2D(x * 0.1, y * 0.1);
        this.wallGrid[y * this.size + x] = elevation > 0.2 ? 1 : 0;
      }
    }
  };

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
    return {
      x: inverted ? y + dy : x + dx,
      y: inverted ? x + dx : y + dy,
      length2: dx * dx + dy * dy,
    };
  };

  public inspectForWall = (
    sin: number,
    cos: number,
    nextStep: Point,
    shiftX: number,
    shiftY: number,
    distance: number,
    offset: number
  ): Point => {
    let dx = cos < 0 ? shiftX : 0;
    let dy = sin < 0 ? shiftY : 0;
    nextStep.height = this.get(nextStep.x - dx, nextStep.y - dy);
    nextStep.distance = distance + Math.sqrt(nextStep.length2);
    if (shiftX) nextStep.shading = cos < 0 ? 2 : 0;
    else nextStep.shading = sin < 0 ? 2 : 1;
    nextStep.offset = offset - Math.floor(offset);
    return nextStep;
  };

  public cast = (point: Point, angle: number, maxRange: number) => {
    let sin = Math.sin(angle);
    let cos = Math.cos(angle);

    let origin: Point = { x: point.x, y: point.y, height: 0, distance: 0 };
    let arr = [origin];
    while (true) {
      // closest grid line in x direction
      let stepX = this.stepTriangle(sin, cos, origin.x, origin.y);
      // closest grid line in y direction
      let stepY = this.stepTriangle(cos, sin, origin.y, origin.x, true);

      let nextStep =
        stepX.length2 < stepY.length2
          ? this.inspectForWall(sin, cos, stepX, 1, 0, origin.distance, stepX.y)
          : this.inspectForWall(
              sin,
              cos,
              stepY,
              0,
              1,
              origin.distance,
              stepY.x
            );

      if (nextStep.distance > maxRange) break;
      origin = nextStep;
      arr = arr.concat(nextStep);
    }
    return arr;
  };

  public update = (seconds: number) => {
    if (this.light > 0) this.light = Math.max(this.light - 10 * seconds, 0);
    else if (Math.random() * 5 < seconds) this.light = 2;
  };
}
