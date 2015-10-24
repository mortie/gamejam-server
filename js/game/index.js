function randint(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
function random(min, max) {
	return Math.random() * (max - min) + min;
}
function inRange(n, min, max) {
	return n >= min && n <= max;
}

class Vec2 {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	length() {
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	}

	clone() {
		return new Vec2(this.x, this.y);
	}

	set(x, y) {
		if (x instanceof Vec2)
			return this.set(x.x, x.y);

		this.x = x;
		this.y = y;
		return this;
	}

	add(x, y) {
		if (x instanceof Vec2)
			return this.add(x.x, x.y);

		this.x += x;
		this.y += y;
		return this;
	}

	sub(x, y) {
		if (x instanceof Vec2)
			return this.sub(x.x, x.y);

		this.x -= x;
		this.y -= y;
		return this;
	}

	scale(num) {
		this.x *= num;
		this.y *= num;
		return this;
	}

	normalize() {
		var len = this.length();

		if (len === 0) {
			this.x = 1;
			this.y = 0;
		} else {
			this.scale(1 / len);
		}

		return this;
	}

	rotate(rad) {
		let x = this.x;
		let y = this.y;
		this.x = x * Math.cos(rad) - y * Math.sin(rad);
		this.y = y * Math.cos(rad) + x * Math.sin(rad);
		return this;
	}
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

		//console.log("if ("+a.x+", "+a.y+") intersects ("+b.x+", "+b.y+")");

		return (
			(inRange(a.x, b.x, b.x + b.width) || inRange(b.x, a.x, a.x + a.width)) &&
			(inRange(a.y, b.y, b.y + b.height) || inRange(b.y, a.y, a.y + a.height))
		);
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
		if (this.oundingRectCache)
			return this.boundingRectCache;

		this.boundingRectCache = new Rectangle(this.pos.x, this.pos.y, this.width, this.height);
		return this.boundingRectCache;
	}

	intersectsPoint(e) {
		let rect = this.boundingRect;
		let r = new Rectangle(e.pos.x, e.pos.y, 1, 1);

		return rect.intersects(r);
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

	send() {}

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

		setTimeout(() => this.despawn(), 1000);
	}

	send(first) {
		if (!first)
			return;

		this.game.players.forEach((p) => p.sock.send("set", {
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
		super(0, 0, 25, 60, id, game);
		this.sock = sock;
		this.keys = {};
		this.dead = false;
		this.rot = 0;
		this.rotForce = 0;
		this.rotVel = 0;
		this.canShoot = true;
		this.health = 100;

		sock.on("request", (req) => {
			if (req.url == "get_id") {
				req.reply({
					id: this.id
				});
			} else if (req.url == "keydown") {
				this.keys[req.data.key] = true;
			} else if (req.url == "keyup") {
				delete this.keys[req.data.key];
			}
		});

		sock.on("close", () => this.despawn());
	}

	update(dt) {
		let f = new Vec2(0, 0);

		if (this.keys.up)
			f.set(0, -0.4);
		if (this.keys.down)
			f.set(0, 0.4);
		if (this.keys.left)
			this.rotForce -= 0.005;
		if (this.keys.right)
			this.rotForce += 0.005;

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

		//Detect collissions
		this.game.entities.forEach((e) => {
			if (e instanceof Bullet) {
				if (e.ownerId !== this.id && this.intersectsPoint(e)) {
					this.health -= 3;
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

	send(first) {
		let obj = {
			id: this.id,
			pos: this.pos,
			vel: this.vel,
			rot: this.rot,
			rotVel: this.rotVel,
			keys: this.keys,
			health: this.health
		}

		if (first)
			obj.type = "player";

		this.game.players.forEach((p) => p.sock.send("set", obj));
	}
}

export default class Game {
	constructor() {
		this.entities = [];
		this.players = [];

		this.timeout = null;
		this.prevTime = null;

		this.fps = 10;

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
		ent.send(true);
	}

	start() {
		this.prevTime = new Date().getTime();
		this.update();
	}

	stop() {
		clearTimeout(this.timeout);
	}

	update() {
		let dt = new Date().getTime() - this.prevTime;
		this.prevTime = new Date().getTime();

		this.entities.forEach((e) => {
			if (e.dead)
				delete this.entities[e.id];
			else
				e.move(dt);
		});

		this.entities.forEach((e) => e.update());
		this.entities.forEach((e) => e.send(this.players));
		this.timeout = setTimeout(this.update.bind(this), 1000/this.fps);
	}
}
