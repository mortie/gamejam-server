function randint(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
function random(min, max) {
	return Math.random() * (max - min) + min;
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
		this.x = x;
		this.y = y;
		return this;
	}

	add(x, y) {
		this.x += x;
		this.y += y;
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
		return new Rectangle(this.pos.x, this.pos.y, this.width, this.height);
	}

	move(dt) {
		this.vforce.scale(this.forceScalar * dt);
		this.vel.add(this.vforce.x, this.vforce.y);
		this.pos.add(this.vel.x * dt, this.vel.y * dt);

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
		delete this.game.entities[this.id];
		delete this.game.players[this.id];

		this.game.players.forEach((p) => p.sock.send("despawn", {
			id: this.id
		}));
	}
}

class Bullet extends Entity {
	constructor(pos, vel, ownerId, id, game) {
		super(pos.x, pos.y, 5, 5, id, game);
		this.ownerId = ownerId;
		this.vel = vel;

		setTimeout(() => this.despawn(), 4000);
	}

	send() {
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

		sock.on("request", (req) => {
			if (req.url == "get_id") {
				req.reply({
					id: this.id
				});
			} else if (req.url == "keydown") {
				this.keys[req.data.key] = true;
			} else if (req.url == "keyup") {
				this.keys[req.data.key] = false;
			}
		});

		sock.on("close", () => this.despawn());
	}

	update(dt) {
		let f = new Vec2(0, 0);

		if (this.keys.up)
			f.set(0, -0.1);
		if (this.keys.down)
			f.set(0, 0.1);
		if (this.keys.left)
			this.rotForce -= 0.005;
		if (this.keys.right)
			this.rotForce += 0.005;

		if (this.keys.shoot && this.canShoot) {
			let vel = new Vec2(0, -1).rotate(this.rot);
			let b = new Bullet(this.pos, vel, this.id, this.game.id, this.game);
			this.game.spawn(b);
			this.canShoot = false;
			setTimeout(() => this.canShoot = true, 100);
		}

		f.rotate(this.rot);
		this.force(f.x, f.y);
	}

	move(dt) {
		super.move(dt);
		this.rotForce *= this.forceScalar * dt;
		this.rotVel += this.rotForce;
		this.rot += this.rotVel * dt;
		this.rotForce = 0;
	}

	send() {
		this.game.players.forEach((p) => p.sock.send("set", {
			type: "player",
			id: this.id,
			pos: this.pos,
			vel: this.vel,
			rot: this.rot,
			rotVel: this.rotVel
		}));
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
