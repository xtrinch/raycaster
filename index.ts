let CIRCLE = Math.PI * 2;

class Camera {
  public ctx: CanvasRenderingContext2D;
  public width: number;
  public height: number;
  public resolution: number;
  public spacing: number;
  public focalLength: number;
  public range: number;
  public lightRange: number;
  public scale: number;

  constructor(canvas: HTMLCanvasElement, resolution: number, focalLength: number) {
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width = window.innerWidth * 0.5;
    this.height = canvas.height = window.innerHeight * 0.5;
    this.resolution = resolution;
    this.spacing = this.width / resolution;
    this.focalLength = focalLength || 0.8;
    this.range = 14;
    this.lightRange = 5;
    this.scale = (this.width + this.height) / 1200;
  }

  public render = function (player: Player, map: GridMap) {
    this.drawSky(player.direction, map.skybox, map.light);
    this.drawColumns(player, map);
    this.drawWeapon(player.weapon, player.paces);
  };

  public drawSky = function (direction: number, sky: Bitmap, ambient: number) {
    let width = sky.width * (this.height / sky.height) * 2;
    let left = (direction / CIRCLE) * -width;

    this.ctx.save();
    this.ctx.drawImage(sky.image, left, 0, width, this.height);
    if (left < width - this.width) {
      this.ctx.drawImage(sky.image, left + width, 0, width, this.height);
    }
    if (ambient > 0) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.globalAlpha = ambient * 0.1;
      this.ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);
    }
    this.ctx.restore();
  };

  public drawColumns = function (player: Player, map: GridMap) {
    this.ctx.save();
    for (let column = 0; column < this.resolution; column++) {
      let x = column / this.resolution - 0.5;
      let angle = Math.atan2(x, this.focalLength);
      let ray = map.cast(player, player.direction + angle, this.range);
      this.drawColumn(column, ray, angle, map);
    }
    this.ctx.restore();
  };

  public drawWeapon = function (weapon: Bitmap, paces: number) {
    let bobX = Math.cos(paces * 2) * this.scale * 6;
    let bobY = Math.sin(paces * 4) * this.scale * 6;
    let left = this.width * 0.66 + bobX;
    let top = this.height * 0.6 + bobY;
    this.ctx.drawImage(weapon.image, left, top, weapon.width * this.scale, weapon.height * this.scale);
  };

  public drawColumn = function (column: number, ray: Point[], angle: number, map: GridMap) {
    let ctx = this.ctx;
    let texture = map.wallTexture;
    let left = Math.floor(column * this.spacing);
    let width = Math.ceil(this.spacing);
    let hit = -1;

    while (++hit < ray.length && ray[hit].height <= 0);

    for (let s = ray.length - 1; s >= 0; s--) {
      let step = ray[s];
      let rainDrops = Math.pow(Math.random(), 3) * s;
      let rain = rainDrops > 0 && this.project(0.1, angle, step.distance);

      if (s === hit) {
        let textureX = Math.floor(texture.width * step.offset);
        let wall = this.project(step.height, angle, step.distance);

        ctx.globalAlpha = 1;
        ctx.drawImage(texture.image, textureX, 0, 1, texture.height, left, wall.top, width, wall.height);

        ctx.fillStyle = '#000000';
        ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0);
        ctx.fillRect(left, wall.top, width, wall.height);
      }

      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.15;
      while (--rainDrops > 0) ctx.fillRect(left, Math.random() * rain.top, 1, rain.height);
    }
  };

  public project = (height: number, angle: number, distance: number) => {
    let z = distance * Math.cos(angle);
    let wallHeight = (this.height * height) / z;
    let bottom = (this.height / 2) * (1 + 1 / z);
    return {
      top: bottom - wallHeight,
      height: wallHeight,
    };
  };
}

interface Point {
  x: number;
  y: number;
  height?: number;
  distance?: number;
  shading?: number;
  offset?: number;
  length2?: number;
}

class GridMap {
  public size: number;
  public wallGrid: Uint8Array;
  public skybox: Bitmap;
  public wallTexture: Bitmap;
  public light: number;

  constructor(size: number) {
    this.size = size;
    this.wallGrid = new Uint8Array(size * size);
    this.skybox = new Bitmap('assets/deathvalley_panorama.jpg', 2000, 750);
    this.wallTexture = new Bitmap('assets/wall_texture.jpg', 1024, 1024);
    this.light = 0;
  }

  public get = (x: number, y: number) => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
    return this.wallGrid[y * this.size + x];
  };

  public randomize = (): void => {
    for (let i = 0; i < this.size * this.size; i++) {
      this.wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
    }
  };

  public stepTriangle = (rise: number, run: number, x: number, y: number, inverted?: boolean): Point => {
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
    offset: number,
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
          : this.inspectForWall(sin, cos, stepY, 0, 1, origin.distance, stepY.x);

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

class Bitmap {
  public image: HTMLImageElement;
  public width: number;
  public height: number;

  constructor(src: string, width: number, height: number) {
    this.image = new Image();
    this.image.src = src;
    this.width = width;
    this.height = height;
  }
}

class Player {
  public x: number;
  public y: number;
  public direction: number;
  public weapon: Bitmap;
  public paces: number;

  constructor(x: number, y: number, direction: number) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.weapon = new Bitmap('assets/knife_hand.png', 319, 320);
    this.paces = 0;
  }

  public rotate = (angle) => {
    this.direction = (this.direction + angle + CIRCLE) % CIRCLE;
  };

  public walk = (distance: number, map: GridMap) => {
    let dx = Math.cos(this.direction) * distance;
    let dy = Math.sin(this.direction) * distance;
    if (map.get(this.x + dx, this.y) <= 0) this.x += dx;
    if (map.get(this.x, this.y + dy) <= 0) this.y += dy;
    this.paces += distance;
  };

  public update = (controls: ControlStates, map: GridMap, seconds: number) => {
    if (controls.left) this.rotate(-Math.PI * seconds);
    if (controls.right) this.rotate(Math.PI * seconds);
    if (controls.forward) this.walk(3 * seconds, map);
    if (controls.backward) this.walk(-3 * seconds, map);
  };
}

interface ControlStates {
  left: boolean;
  right: boolean;
  backward: boolean;
  forward: boolean;
}

class Controls {
  public codes = { 37: 'left', 39: 'right', 38: 'forward', 40: 'backward' };
  public states: ControlStates = {
    left: false,
    right: false,
    forward: false,
    backward: false,
  };

  constructor() {
    document.addEventListener('keydown', this.onKey, false);
    document.addEventListener('keyup', this.onKey, false);
  }

  public onKey = (e) => {
    let state = this.codes[e.keyCode];
    if (typeof state === 'undefined') return;
    this.states[state] = e.type === 'keyup' ? false : true;
    e.preventDefault && e.preventDefault();
    e.stopPropagation && e.stopPropagation();
  };
}

class GameLoop {
  public lastTime = 0;
  public display;
  public player: Player;
  public map: GridMap;
  public controls: Controls;
  public camera: Camera;

  constructor() {
    this.display = document.getElementById('display');
    this.player = new Player(15.3, -1.2, Math.PI * 0.3);
    this.map = new GridMap(32);
    this.map.randomize();
    this.controls = new Controls();
    this.camera = new Camera(this.display, 320, 0.8);
  }

  public frame = (time) => {
    let seconds = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (seconds < 0.2) this.loop(seconds);
    requestAnimationFrame(this.frame);
  };

  public start = () => {
    requestAnimationFrame(this.frame);
  };

  public loop = (seconds) => {
    this.map.update(seconds);
    this.player.update(this.controls.states, this.map, seconds);
    this.camera.render(this.player, this.map);
  };
}

let loop = new GameLoop();
loop.start();
