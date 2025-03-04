import { makeAutoObservable } from "mobx";

export enum SpriteType {
  TREE_CONE,
  TREE_VASE,
  TREE_COLUMNAR,
  PILLAR,
}
export class SpriteMap {
  public size: number;
  public sprites: number[][];

  constructor() {
    this.sprites = [
      [-1, 5, SpriteType.TREE_CONE],
      [-1, 4, SpriteType.TREE_VASE],
      [4, 7, SpriteType.PILLAR],
      [0.5, 1.5, SpriteType.TREE_CONE],
      [0.5, 3.5, SpriteType.TREE_COLUMNAR],
      [18.5, 4.5, SpriteType.TREE_CONE],
      [10.0, 4.5, SpriteType.TREE_CONE],
      [10.0, 12.5, SpriteType.TREE_CONE],
      [3.5, 20.5, SpriteType.TREE_CONE],
      [3.5, 14.5, SpriteType.TREE_CONE],
      [14.5, 20.5, SpriteType.TREE_CONE],
      [18.5, 10.5, SpriteType.TREE_CONE],
      [18.5, 11.5, SpriteType.TREE_CONE],
      [18.5, 12.5, SpriteType.TREE_CONE],
      [21.5, 1.5, SpriteType.TREE_CONE],
      [15.5, 1.5, SpriteType.TREE_CONE],
      [16.0, 1.8, SpriteType.TREE_CONE],
      [16.2, 1.2, SpriteType.TREE_CONE],
      [9.5, 15.5, SpriteType.TREE_CONE],
      [10.0, 15.1, SpriteType.TREE_CONE],
      [10.5, 15.8, SpriteType.TREE_CONE],
    ];
    this.size = this.sprites.length;
    makeAutoObservable(this);
  }
}
