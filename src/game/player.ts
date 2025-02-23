import { makeAutoObservable } from "mobx";
import knifeHand from "../assets/knife_hand.png";
import { Bitmap } from "./bitmap";
import { CIRCLE } from "./constants";
import { ControlStates } from "./controls";
import { GridMap } from "./gridMap";

export interface Position {
  x: number;
  y: number;
  direction: number;
}

export class Player {
  public weapon: Bitmap;
  public paces: number;
  public position: Position;

  constructor(x: number, y: number, direction: number) {
    this.position = { x, y, direction };
    this.weapon = new Bitmap(knifeHand, 319, 320);
    this.paces = 0;

    makeAutoObservable(this);
  }

  public rotate = (angle: number) => {
    this.position.direction =
      (this.position.direction + angle + CIRCLE) % CIRCLE;
  };

  public walk = (distance: number, map: GridMap) => {
    let dx = Math.cos(this.position.direction) * distance;
    let dy = Math.sin(this.position.direction) * distance;
    if (map.get(this.position.x + dx, this.position.y) != 1)
      this.position.x += dx;
    if (map.get(this.position.x, this.position.y + dy) != 1)
      this.position.y += dy;
    this.paces += distance;
  };

  public update = (controls: ControlStates, map: GridMap, seconds: number) => {
    if (controls.left) this.rotate(-Math.PI * seconds);
    if (controls.right) this.rotate(Math.PI * seconds);
    if (controls.forward) this.walk(3 * seconds, map);
    if (controls.backward) this.walk(-3 * seconds, map);
  };
}
