import { makeAutoObservable } from "mobx";
import { Camera } from "./camera";
import { Controls } from "./controls";
import { GridMap } from "./gridMap";
import { Player } from "./player";
import { SpriteMap } from "./spriteMap";

export class GameLoop {
  public lastTime = 0;
  public display: HTMLCanvasElement;
  public player: Player;
  public map: GridMap;
  public controls: Controls;
  public camera: Camera;
  public spriteMap: SpriteMap;
  public fps: number;
  constructor() {
    this.map = new GridMap(32);
    this.spriteMap = new SpriteMap();
    // this.player = new Player(15.3, -1.2, Math.PI * 0.3);
    // this.map.randomize();
    this.display = document.getElementById("display") as HTMLCanvasElement;
    // this.map.generateWorld();
    this.controls = new Controls();
    this.camera = new Camera(this.display, this.map);
    this.player = this.findSpawnPoint();
    this.fps = 0;
    makeAutoObservable(this);
  }

  frame(time: number) {
    let seconds = (time - this.lastTime) / 1000;
    this.fps = Math.floor(1.0 / seconds);
    if (seconds > 0.01) {
      this.lastTime = time;
      this.loop(seconds);
    }
    requestAnimationFrame(this.frame.bind(this));
  }

  start() {
    requestAnimationFrame(this.frame.bind(this));
  }

  loop(seconds: number) {
    this.map.update(seconds);
    this.player.update(this.controls.states, this.map, seconds);
    this.camera.render(this.player, this.map, this.spriteMap);
  }

  findSpawnPoint() {
    for (let y = 4; y < this.map.size; y++) {
      for (let x = 4; x < this.map.size; x++) {
        if (this.map.get(x, y) === 0) {
          // return new Player(x + 0.5, y + 0.5, -1, 0, 0, 0.66); // original
          return new Player(x + 0.5, y + 0.5, -1.5, 0, 0, 0.6);
        }
      }
    }
  }
}
