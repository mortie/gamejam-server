let Vec2 = require("./vec2");

function round(n) {
	return Math.round(n * 1000) / 1000
}

function randint(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
function random(min, max) {
	return Math.random() * (max - min) + min;
}
function inRange(n, min, max) {
	return n >= min && n <= max;
}

class Rectangle {
	constructor(x, y, width, height) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	intersects(b) {
		let a = this;

		return (
			(inRange(a.x, b.x, b.x + b.width) || inRange(b.x, a.x, a.x + a.width)) &&
			(inRange(a.y, b.y, b.y + b.height) || inRange(b.y, a.y, a.y + a.height))
		);
	}

	clone() {
		return new Rectangle(this.x, this.y, this.width, this.height);
	}
}

class Entity {
	constructor(x, y, width, height, id, game) {
		this.width = width;
		this.height = height;
		this.mass = width * height;
		this.forceScalar = 1/this.mass;
		this.id = id;
		this.game = game;

		this.pos = new Vec2(x, y);
		this.vel = new Vec2(0, 0);
		this.vforce = new Vec2(0, 0);
	}

	get boundingRect() {
		if (this.boundingRectCache)
			return this.boundingRectCache;

		this.boundingRectCache = new Rectangle(this.pos.x, this.pos.y, this.width, this.height);
		return this.boundingRectCache;
	}

	intersectsPoint(e) {
		let rect = this.boundingRect;
		let r = new Rectangle(e.pos.x, e.pos.y, e.vel.x, e.vel.y);
		return rect.intersects(r);
		return (
			e.pos.x > rect.x && e.pos.x < rect.x + rect.width &&
			e.pos.y > rect.y && e.pos.y < rect.y + rect.height
		);
	}

	move(dt) {
		this.vforce.scale(this.forceScalar * dt);
		this.vel.add(this.vforce);
		this.pos.add(this.vel.clone().scale(dt));

		this.vforce.set(0, 0);
	}

	force(x, y) {
		this.vforce.x += x;
		this.vforce.y += y;
	}

	impulse(x, y) {
		this.vel.x += x;
		this.vel.y += y;
	}

	init() {}

	update() {}

	send(first) {}

	despawn() {
		this.game.players.forEach((p) => p.sock.send("despawn", {
			id: this.id
		}));

		delete this.game.entities[this.id];
		delete this.game.players[this.id];
	}
}

class Bullet extends Entity {
	constructor(pos, vel, ownerId, id, game) {
		super(pos.x, pos.y, 5, 5, id, game);
		this.ownerId = ownerId;
		this.vel = vel;

		setTimeout(() => this.despawn(), 2000);

		this.send(true);
	}

	send(first) {
		if (!first)
			return;

		this.game.players.forEach((p) => p.sendSet({
			type: "bullet",
			id: this.id,
			ownerId: this.ownerId,
			pos: this.pos,
			vel: this.vel,
		}));
	}
}

class Player extends Entity {
	constructor(sock, id, game) {
		super(randint(-300, 300), randint(-300, 300), 25, 60, id, game);
		this.sock = sock;
		this.keys = {};
		this.dead = false;
		this.rot = 0;
		this.rotForce = 0;
		this.rotVel = 0;
		this.canShoot = true;
		this.health = 100;
		this.sendSetQueue = [];
		this.name = "";

		sock.on("request", (req) => {
			if (req.url == "get_id") {
				req.reply({
					id: this.id
				});

				this.name = req.data.name;

				setTimeout(() => {
					game.entities.forEach((e) => e.send(true));
				}, 100);
			} else if (req.url == "keydown") {
				this.keys[req.data.key] = true;
			} else if (req.url == "keyup") {
				delete this.keys[req.data.key];
			}
		});

		sock.on("close", () => this.despawn());

		this.healthInterval = setInterval(() => {
			if (this.health < 100)
				this.health += 1;
		}, 200);
	}

	despawn() {
		super.despawn();
		clearInterval(this.healthInterval);
	}

	update(dt) {
		let f = new Vec2(0, 0);

		if (this.keys.up) {
			if (this.keys.sprint)
				f.set(0, -5);
			else
				f.set(0, -2);
		}
		if (this.keys.down)
			f.set(0, 2);

		if (this.keys.left)
			this.rotForce -= 0.03;
		if (this.keys.right)
			this.rotForce += 0.03;

		//Shoot
		if (this.keys.shoot && this.canShoot) {
			let vel = new Vec2(0, -1).rotate(this.rot).add(this.vel);

			let posmod = new Vec2(0, -this.height/2).rotate(this.rot);
			let pos = this.pos.clone().add(posmod);

			let b = new Bullet(pos, vel, this.id, this.game.id, this.game);
			this.game.spawn(b);
			this.canShoot = false;
			setTimeout(() => this.canShoot = true, 50);
		}

		f.rotate(this.rot);
		this.force(f.x, f.y);

		this.vel.scale(0.9);
		this.rotVel *= 0.8;

		//Detect collissions
		this.game.entities.forEach((e) => {
			if (e instanceof Bullet) {
				if (e.ownerId !== this.id && this.intersectsPoint(e)) {
					this.health -= 20;
					e.despawn();
					if (this.health <= 0)
						this.despawn();
				}
			}
		});

		this.boundingRectCache = null;
	}

	get boundingRect() {
		if (this.boundingRectCache)
			return this.boundingRectCache;

		//0   1
		//  * 
		//3   2
		var rotated = [
			new Vec2(-this.width/2, -this.height/2),
				new Vec2(this.width/2, -this.height/2),
				new Vec2(this.width/2, this.height/2),
				new Vec2(-this.width/2, this.height/2)
					].map((p) => p.rotate(this.rot));

		let tl = new Vec2(0, 0);
		let br = new Vec2(0, 0);

		rotated.forEach((p) => {
			if (p.x < tl.x)
			tl.x = p.x;
		if (p.y < tl.y)
			tl.y = p.y;
		if (p.x > br.x)
			br.x = p.x;
		if (p.y > br.y)
			br.y = p.y;
		});

		this.boundingRectCache = new Rectangle(
				this.pos.x + tl.x,
				this.pos.y + tl.y,
				br.x - tl.x,
				br.y - tl.y
				);

		return this.boundingRectCache;
	}

	move(dt) {
		super.move(dt);
		this.rotForce *= this.forceScalar * dt;
		this.rotVel += this.rotForce;
		this.rot = (this.rot + this.rotVel * dt) % (Math.PI * 2);
		this.rotForce = 0;
	}

	sendSet(obj) {
		this.sendSetQueue.push(obj);
	}

	send(first) {
		let obj = {
			id: this.id,
			pos: {x: round(this.pos.x), y: round(this.pos.y)},
			vel: {x: round(this.vel.x), y: round(this.vel.y)},
			rot: round(this.rot),
			rotVel: round(this.rotVel),
			keys: this.keys,
			health: this.health
		}

		if (first) {
			obj.type = "player";
			obj.name = this.name;
		}

		this.game.players.forEach((p) => p.sendSet(obj));
	}
}

export default class Game {
	constructor() {
		this.entities = [];
		this.players = [];

		this.updateTimeout = null;
		this.sendTimeout = null;
		this.prevTime = null;

		this.updateInterval = 1000/30;
		this.sendInterval = 1000/20;
		this.dt = 0;

		this.id = 1;
	}

	newPlayer(sock) {
		let p = new Player(sock, this.id, this);
		this.players[this.id] = p;
		this.spawn(p);
	}

	spawn(ent) {
		this.entities[this.id] = ent;
		this.id += 1;
		if (this.id > 5000)
			this.id = 0;
	}

	start() {
		this.prevTime = new Date().getTime();
		this.update();
		this.send();
	}

	stop() {
		clearTimeout(this.updateTimeout);
		clearTimeout(this.sendTimeout);
	}

	update() {
		this.dt = new Date().getTime() - this.prevTime;
		this.prevTime = new Date().getTime();

		let dimx = 40000;
		let dimy = 40000;
		this.entities.forEach((e) => {
			e.move(this.dt);

			if (e.pos.x > dimx)
				e.pos.x = -dimx;
			else if (e.pos.x < -dimx)
				e.pos.x = dimx;
			if (e.pos.y > dimy)
				e.pos.y = -dimy;
			else if (e.pos.y < -dimy)
				e.pos.y = dimy;
		});
		this.entities.forEach((e) => e.update());
		this.updateTimeout = setTimeout(this.update.bind(this), this.updateInterval);
	}

	send() {
		this.entities.forEach((e) => e.send());
		this.players.forEach((p) => {
			p.sock.send("set", p.sendSetQueue);
			p.sendSetQueue = [];
		});
		this.sendTimeout = setTimeout(this.send.bind(this), this.sendInterval);
	}
}
