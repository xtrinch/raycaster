import { makeAutoObservable } from "mobx";

export class SpriteMap {
  public size: number;
  public sprites: number[][];

  constructor() {
    this.sprites = [
      [-1, 5],
      [-1, 4],
      [20.5, 11.5], //green light in front of playerstart
      //green lights in every room
      [18.5, 4.5],
      [10.0, 4.5],
      [10.0, 12.5],
      [3.5, 6.5],
      [3.5, 20.5],
      [3.5, 14.5],
      [14.5, 20.5],

      //row of pillars in front of wall: fisheye test
      [18.5, 10.5, 9],
      [18.5, 11.5, 9],
      [18.5, 12.5, 9],

      //some barrels around the map
      [21.5, 1.5, 8],
      [15.5, 1.5, 8],
      [16.0, 1.8, 8],
      [16.2, 1.2, 8],
      [3.5, 2.5, 8],
      [9.5, 15.5, 8],
      [10.0, 15.1, 8],
      [10.5, 15.8, 8],
    ];
    this.size = this.sprites.length;
    makeAutoObservable(this);
  }
}
