export default class Vec2 {
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
