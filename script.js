let svg, cvs, ctx;
let width, height, minDimension;
let canvasData, pixels;
let points = [];
let scale = 2;
let lambda;
let color = true;
let iterations = 20000;
let clear = 0;
let orbitX, orbitY;

const packRGBA = (() => {
	const buf = new ArrayBuffer(4);
	const u32 = new Uint32Array(buf);
	const u8 = new Uint8Array(buf);
	u8[0] = 1;
	u8[1] = 2;
	u8[2] = 3;
	u8[3] = 4;
	const little = u32[0] === 0x04030201;
	return little
		? (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
		: (r, g, b) => ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
})();

const hToRGB = h => {
	const f = n => {
		const k = (n + h / 30) % 12;
		const channel = 0.8 - 0.16 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * channel);
	};
	return [0, 8, 4].map(f);
};

const formatZ = ([x, y]) => {
	const X = x >= 0 ? ` ${x.toFixed(2)}` : x.toFixed(2);
	const Y = y >= 0 ? `+ i${y.toFixed(2)}` : `- i${Math.abs(y).toFixed(2)}`
	return X.padStart(5, '0') + ' ' + Y.padStart(7, '0');
}

const toScreen = ([x, y]) => ([
	x * minDimension / scale + width / 2,
	-1 * y * minDimension / scale + height / 2,
]);

const toComplex = ([w, h]) => ([
	(w - width / 2) * scale / minDimension,
	-1 * (h - height / 2) * scale / minDimension,
]);

const randomInUnitDisc = () => {
	const theta = Math.random() * 2 * Math.PI;
	const r = Math.sqrt(Math.random());
	return [r * Math.cos(theta), r * Math.sin(theta)];
};

[orbitX, orbitY] = randomInUnitDisc();

class Point {
	constructor(x, y, hue) {
		this.x = x;
		this.y = y;
		this.id = (Math.random() * 1000000000).toFixed(0);
		this.dragged = false;
		this.hue = hue * 360;
		this.updatePacked();
		svg.appendChild(this.getHtml());
	}

	getCords() {
		return [this.x, this.y]
	}

	getHtml() {
		const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		const [x, y] = toScreen([this.x, this.y]);
		point.setAttribute('cx', `${x}`);
		point.setAttribute('cy', `${y}`);
		point.setAttribute('class', `point`);
		point.setAttribute('id', this.id);
		point.setAttribute('fill', `hsl(${this.hue}, 50%, 50%)`);
		point.addEventListener('mousedown', e => this.dragStart(e, this));
		point.addEventListener('touchstart', e => this.dragStart(e, this));
		point.addEventListener('touchend', e => this.dragEnd(e, this));
		return point
	}

	refresh() {
		const point = svg.getElementById(this.id);
		const [x, y] = toScreen([this.x, this.y]);
		point.setAttribute('cx', `${x}`);
		point.setAttribute('cy', `${y}`);
		this.label();
	}

	label() {
		const point = svg.getElementById(this.id);
		point.setAttribute('fill', color ? `hsl(${this.hue}, 50%, 50%)` : '#DDD');
		this.updatePacked();
	}

	updatePacked() {
		if (color) {
			const c = hToRGB(this.hue);
			this.packed = packRGBA(c[0], c[1], c[2]);
		} else {
			this.packed = packRGBA(20, 20, 20);
		}
	}

	dragStart(e, point) {
		e.preventDefault();
		point.dragged = true;
	}

	drag(e, point) {
		if (point.dragged) {
			e.preventDefault();

			if (e.touches) {
				e = e.touches[0];
			}

			const CTM = svg.getScreenCTM();
			const [mX, mY] = toComplex([e.clientX - CTM.e, e.clientY - CTM.f]);

			point.x = mX;
			point.y = mY;

			point.refresh();
		}
	}

	dragEnd(e, point) {
		e.preventDefault();
		point.dragged = false;
		point.refresh();
	}

	stringify (i) {
		return `x${i}=${this.x.toFixed(2)}&y${i}=${this.y.toFixed(2)}`
	}
}

class Parameter extends Point {
	constructor(x, y) {
		super(x, y, 0);
		this.label();
	}

	getHtml() {
		const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		const [x, y] = toScreen([this.x, this.y]);
		point.setAttribute('cx', `${x}`);
		point.setAttribute('cy', `${y}`);
		point.setAttribute('class', `point`);
		point.setAttribute('id', this.id);
		point.setAttribute('fill', '#333');
		point.addEventListener('mousedown', e => this.dragStart(e, this));
		point.addEventListener('touchstart', e => this.dragStart(e, this));
		point.addEventListener('touchend', e => this.dragEnd(e, this));
		return point
	}

	label() {
		const lambdaElement = document.getElementById('lambda');
		lambdaElement.innerHTML = 'λ: ' + formatZ(this.getCords());
		if (this.x * this.x + this.y * this.y > 1) {
			lambdaElement.style.color = '#D11';
		} else {
			lambdaElement.style.color = 'black';
		}
	}

	stringify (i) {
		return `lx=${this.x.toFixed(2)}&ly=${this.y.toFixed(2)}`
	}
}

const refreshPoints = () => {
	lambda?.refresh();
	points.forEach(p => p.refresh());
}

const draw = () => {
	if (clear === 1) {
		pixels.fill(0);
		[orbitX, orbitY] = randomInUnitDisc();
		clear = 0;
	}

	const n = points.length;
	if (n > 0) {
		if (!Number.isFinite(orbitX) || !Number.isFinite(orbitY)) {
			[orbitX, orbitY] = randomInUnitDisc();
		}

		const lx = lambda.x;
		const ly = lambda.y;
		const k = minDimension / scale;
		const ox = width / 2;
		const oy = height / 2;
		let zx = orbitX;
		let zy = orbitY;

		for (let i = 0; i < iterations; i++) {
			const p = points[(Math.random() * n) | 0];
			const ax = p.x + zx;
			const ay = p.y + zy;
			zx = lx * ax - ly * ay;
			zy = lx * ay + ly * ax;

			const w = zx * k + ox;
			const h = -zy * k + oy;
			if (w < 0 || h < 0 || w >= width || h >= height) {
				continue;
			}
			pixels[(w | 0) + ((h | 0) * width)] = p.packed;
		}

		orbitX = zx;
		orbitY = zy;
	}

	ctx.putImageData(canvasData, 0, 0);
	requestAnimationFrame(draw);
}

const setCanvasDimensions = () => {
	cvs.width = cvs.getBoundingClientRect().width;
	cvs.height = cvs.getBoundingClientRect().height;

	width = cvs.width;
	height = cvs.height;
	minDimension = Math.min(width, height);

	canvasData = ctx.createImageData(width, height);
	pixels = new Uint32Array(canvasData.data.buffer);
}

const setPoints = n => {
	points = [];
	svg.innerHTML = '';
	svg.appendChild(lambda.getHtml());
	for (let i = 0; i < n; i++) {
		const p = new Point(Math.cos((i * 2 * Math.PI) / n), Math.sin((i * 2 * Math.PI) / n), i / n);
		points.push(p);
	}
}

const setupCanvas = () => {
	cvs = document.getElementById('canvas');
	ctx = cvs.getContext('2d');
	svg = document.getElementById('svg');

	if (!ctx || !svg) {
		return alert('Error initializing application');
	}

	setCanvasDimensions();
	window.onresize = () => {
		setCanvasDimensions();
		refreshPoints();
	}

	window.addEventListener('keydown', e => e.key === 'Escape' ? closeBackdrop() : 1)

	parseURLAndInitPoints();

	const mouseCoordElement = document.getElementById('mouse');
	svg.addEventListener('mousemove', e => {
		const z = toComplex([e.clientX, e.clientY]);
		mouseCoordElement.innerText = formatZ(z);
	});

	const drag = e => {
		if (lambda.dragged) {
			lambda.drag(e, lambda);
			clear = 1;
		} else {
			points.filter(p => p.dragged).map(p => {
				p.drag(e, p);
				clear = 1;
			})
		}
	}

	const dragEnd = () => {
		lambda.dragged = false;
		points.forEach(p => p.dragged = false);
		clear = 0;
	}

	svg.addEventListener('touchmove', drag);
	svg.addEventListener('touchend', dragEnd);
	svg.addEventListener('touchleave', dragEnd);
	svg.addEventListener('touchcancel', dragEnd);
	svg.addEventListener('mousemove', drag);
	svg.addEventListener('mouseup', dragEnd);
	svg.addEventListener('mouseleave', dragEnd);
	svg.addEventListener('wheel', e => {
		const delta = [e.deltaX, e.deltaY, e.deltaZ, 1000].filter(s => !!s);
		scale *= Math.exp(delta[0] / 1000);
		if (Math.abs(scale - 2) < 0.1) scale = 2;
		refreshPoints();
		clear = 1;
	})

	const numberInput = document.getElementById('number');
	numberInput.value = points.length;
	numberInput.addEventListener('change', e => {
		const n = Math.floor(e.target.value);

		if (n < 1) {
			e.target.value = 3;
		}

		setPoints(e.target.value);
		refreshPoints();
		clear = 1;
	})

	const colorCheckbox = document.getElementById('color');
	colorCheckbox.checked = color;
	colorCheckbox.addEventListener('change', e => {
		color = e.target.checked;
		refreshPoints();
		clear = 1;
	})

	draw();
}

const parseURLAndInitPoints = () => {
	const sp = new URLSearchParams(window.location.search);
	const values = [];
	let lx = 0.5, ly = 0;
	let error = false

	for (let i = 1; i < 20; i++) {
		if(sp.has(`x${i}`) && sp.has(`y${i}`)) {
			const x = Number(sp.get(`x${i}`));
			const y = Number(sp.get(`y${i}`));
			if (isNaN(x) || isNaN(y)) {
				error = true;
			} else {
				values.push([x, y]);
			}
		} else {
			break
		}
	}

	if(sp.has(`lx`) && sp.has(`ly`)) {
		const x = Number(sp.get(`lx`));
		const y = Number(sp.get(`ly`));
		if (isNaN(x) || isNaN(y)) {
			error = true;
		} else {
			lx = x;
			ly = y;
		}
	}

	if (values.length > 0 && error === false) {
		points = values.map(([x, y], i) => new Point(x, y, i/values.length));
		lambda = new Parameter(lx, ly);
		closeBackdrop();

		history.pushState({}, null, baseURL());
	} else {
		lambda = new Parameter(0.5, 0);
		setPoints(3);
	}
}

const baseURL = () => {
	const urlObj = new URL(window.location.href);
	urlObj.search = '';
	return urlObj.toString();
}

const closeHelp = () => {
	document.getElementById('help').style.display = 'none';
}

const showHelp = () => {
	closeShare();
	document.getElementById('help').style.display = 'block';
	document.getElementById('backdrop').style.display = 'block';
}

const closeShare = () => {
	document.getElementById('share').style.display = 'none';
}

const showShare = () => {
	closeHelp();
	const shareDiv = document.getElementById('share');

	const params = [lambda, ...points].map((p, i) => p.stringify(i)).join('&');
	const url = baseURL() + '?' + params;

	shareDiv.getElementsByTagName('a')[0].setAttribute('href', url);
	shareDiv.getElementsByTagName('a')[0].textContent = url;

	shareDiv.style.display = 'block';
	document.getElementById('backdrop').style.display = 'block';
}

const closeBackdrop = () => {
	closeHelp();
	closeShare();
	document.getElementById('backdrop').style.display = 'none';
}

const downloadImage = () => {
	const dummy = document.getElementById('dummy');
	dummy.setAttribute('download', 'chaosGame.png');
	dummy.setAttribute('href', cvs.toDataURL("image/png").replace("image/png", "image/octet-stream"));
	dummy.click();
}

if (document.readyState === 'complete') {
	setupCanvas();
} else {
	window.addEventListener('load', setupCanvas);
}
