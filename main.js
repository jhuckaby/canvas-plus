// canvas-plus - Image Transformation Engine
// Built using node-canvas and image-q
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require('pixl-class');
var Perf = require('pixl-perf');

var ChainBreaker = {
	// returned on error, silently breaks call chains
	// will be augmented with noop functions for all class methods
	isError: true
};

// Polyfill for Math.clamp
if (!Math.clamp) Math.clamp = function(val, min, max) {
	return Math.max(min, Math.min(max, val));
};

var CanvasPlus = module.exports = Class.create({
	
	__name: 'CanvasPlus',
	
	__mixins: [ 
		require('./lib/node/create.js'),
		require('./lib/node/font.js'),
		require('./lib/node/load.js'),
		require('./lib/node/write.js'),
		
		/*
		require('./lib/filter/draw.js'),
		*/
		
		require('./lib/filter/adjust.js'),
		require('./lib/filter/border.js'),
		require('./lib/filter/composite.js'),
		require('./lib/filter/convolve.js'),
		require('./lib/filter/crop.js'),
		require('./lib/filter/curves.js'),
		require('./lib/filter/expand.js'),
		require('./lib/filter/flatten.js'),
		require('./lib/filter/hash.js'),
		require('./lib/filter/histogram.js'),
		require('./lib/filter/opacity.js'),
		require('./lib/filter/quantize.js'),
		require('./lib/filter/resize.js'),
		require('./lib/filter/text.js'),
		require('./lib/filter/transform.js'),
		require('./lib/filter/trim.js'),
		
		require('./lib/format/gif.js'),
		require('./lib/format/jpeg.js'),
		require('./lib/format/png.js')
	],
	
	// version: require( __dirname + '/package.json' ).version,
	
	image: null,
	canvas: null,
	context: null,
	pixels: null,
	palette: null,
	perf: null,
	settings: null,
	exif: null,
	lastError: null,
	logger: null,
	
	defaultSettings: {
		debug: false,
		throw: false,
		mode: '', // image, rgba, indexed
		format: '', // jpeg, png, gif
		background: '', // css color spec
		width: 0,
		height: 0,
		maxArea: 0,
		opacity: 1,
		autoOrient: true,
		alpha: true, // for png, gif
		quality: 75, // for jpeg only
		progressive: false, // for jpeg only
		chromaSubsampling: true, // for jpeg only
		
		// Resize settings:
		resizeMode: 'fit',
		resizeDirection: 'both',
		gravity: 'center',
		
		// Text settings:
		font: '',
		fontStyle: 'normal', // browser only
		fontWeight: 'normal', // browser only
		textSize: 12,
		textColor: 'black',
		kerning: 0,
		lineSpacing: 0,
		outlineThickness: 2,
		outlineStyle: 'round',
		
		// Quantization settings:
		colors: 256,
		dither: false,
		ditherType: 'FloydSteinberg', // Stucki, Atkinson, Jarvis, Burkes, Sierra
		quantizer: 'RGBQuant', // NeuQuant, NeuQuantFloat, WuQuant
		
		// PNG compression settings:
		compressionLevel: 6,
		pngFilter: 'PNG_ALL_FILTERS', // PNG_FILTER_NONE, _SUB, _UP, _AVG, _PAETH
		
		// Canvas specific settings:
		globalCompositeOperation: 'source-over',
		imageSmoothingEnabled: true,
		imageSmoothingQuality: 'high',
		globalAlpha: 1.0
	},
	
	canvasSettingsKeys: {
		globalCompositeOperation: 1,
		imageSmoothingEnabled: 1,
		imageSmoothingQuality: 1,
		globalAlpha: 1
	},
	
	__construct: function() {
		// class constructor
		this.perf = new Perf();
		this.reset();
		
		if (arguments.length == 1) {
			// buffer or filename
			this.load( arguments[0] );
		}
		else if (arguments.length >= 2) {
			// new canvas, width x height (+ color)
			this.create({
				width: arguments[0],
				height: arguments[1],
				background: arguments[2] || '' 
			});
		}
	},
	
	set: function() {
		// change canvas option(s)
		var key;
		if (arguments.length == 1) {
			var obj = arguments[0];
			for (key in obj) this.set(key, obj[key]);
		}
		else {
			key = arguments[0];
			var value = arguments[1];
			this.settings[key] = value;
			this.logDebug(9, "Setting property: " + key + ": " + value);
			
			// pass along to active canvas if we have one
			if (this.canvasSettingsKeys[key] && this.context) {
				this.context[key] = value;
			}
		}
		
		return this;
	},
	
	get: function(key) {
		// get named settings key
		return this.settings[key];
	},
	
	getLastError: function() { 
		// return last error
		return this.lastError; 
	},
	
	clearLastError: function() { 
		// clear last error
		this.lastError = null;
	},
	
	getPerf: function() {
		// get raw pixl-perf object
		return this.perf;
	},
	
	getMetrics: function() {
		// get perf metrics
		return this.perf.metrics();
	},
	
	getDimensions: function() {
		// get width/height in object
		return {
			width: this.get('width'),
			height: this.get('height')
		};
	},
	
	getBounds: function() {
		// get rectangle containing full canvas
		return {
			x: 0, 
			y: 0, 
			width: this.get('width'), 
			height: this.get('height') 
		};
	},
	
	getEXIF: function() {
		// get EXIF data, if available
		return this.exif;
	},
	
	getCanvas: function() {
		// get reference to canvas object
		if (!this.requireRGBA()) return null;
		return this.canvas;
	},
	
	getContext: function() {
		// get reference to canvas 2d context
		if (!this.requireRGBA()) return null;
		return this.context;
	},
	
	getPixels: function() {
		// get typed array to raw pixels, in rgba or indexed modes
		if (this.get('mode') == 'image') {
			if (!this.render()) return null;
		}
		
		var pixels = null;
		switch (this.get('mode')) {
			case 'rgba':
				var imgData = this.context.getImageData(0, 0, this.get('width'), this.get('height'));
				pixels = imgData.data;
			break;
			
			case 'indexed':
				pixels = this.pixels;
			break;
		}
		
		return pixels;
	},
	
	getPalette: function() {
		// get reference to color palette, only applicable in indexed mode
		return this.palette;
	},
	
	width: function() { return this.settings.width; },
	height: function() { return this.settings.height; },
	
	isValidRect: function(rect) {
		// validate rectangle
		if (!("x" in rect) || !("y" in rect) || !("width" in rect) || !("height" in rect)) return false;
		if ((typeof(rect.x) != 'number') || (typeof(rect.y) != 'number')) return false;
		if ((typeof(rect.width) != 'number') || (typeof(rect.width) != 'number')) return false;
		if ((rect.x != Math.floor(rect.x)) || (rect.y != Math.floor(rect.y))) return false;
		if ((rect.width != Math.floor(rect.width)) || (rect.height != Math.floor(rect.height))) return false;
		if ((rect.x < 0) || (rect.x >= this.width())) return false;
		if ((rect.y < 0) || (rect.y >= this.height())) return false;
		if ((rect.width < 1) || (rect.height < 1)) return false;
		if ((rect.width > this.width()) || (rect.height > this.height())) return false;
		return true;
	},
	
	parseColor: function(str) {
		// parse rgb(), rgba() or #hex
		str = ('' + str).toLowerCase();
		var color = null;
		
		if (str.match(/^\#?([0-9a-f]{8})$/)) {
			var hex = RegExp.$1;
			color = {
				r: parseInt(hex.substring(0, 2), 16),
				g: parseInt(hex.substring(2, 4), 16),
				b: parseInt(hex.substring(4, 6), 16),
				a: parseInt(hex.substring(6, 8), 16),
			};
		}
		else if (str.match(/^\#?([0-9a-f]{6})$/)) {
			var hex = RegExp.$1;
			color = {
				r: parseInt(hex.substring(0, 2), 16),
				g: parseInt(hex.substring(2, 4), 16),
				b: parseInt(hex.substring(4, 6), 16),
				a: 255
			};
		}
		else if (str.match(/^\#?([0-9a-f]{3})$/)) {
			var hex = RegExp.$1;
			color = {
				r: parseInt(hex.substring(0, 1) + hex.substring(0, 1), 16),
				g: parseInt(hex.substring(1, 2) + hex.substring(1, 2), 16),
				b: parseInt(hex.substring(2, 3) + hex.substring(2, 3), 16),
				a: 255
			};
		}
		else if (str.match(/^rgba\(([\d\,\.\s]+)\)$/)) {
			var csv = RegExp.$1;
			var parts = csv.split(/\,\s*/);
			color = {
				r: Math.min(255, parseInt( parts[0] || 0 )),
				g: Math.min(255, parseInt( parts[1] || 0 )),
				b: Math.min(255, parseInt( parts[2] || 0 )),
				a: Math.min(255, Math.floor( parseFloat( parts[3] || 0 ) * 255 ))
			};
		}
		else if (str.match(/^rgb\(([\d\,\.\s]+)\)$/)) {
			var csv = RegExp.$1;
			var parts = csv.split(/\,\s*/);
			color = {
				r: Math.min(255, parseInt( parts[0] || 0 )),
				g: Math.min(255, parseInt( parts[1] || 0 )),
				b: Math.min(255, parseInt( parts[2] || 0 )),
				a: 255
			};
		}
		else {
			return null;
		}
		
		return color;
	},
	
	attachLogAgent: function(logger) {
		// add pixl-logger instance
		this.logger = logger;
	},
	
	importImage: function(img) {
		// import image object (must be already loaded)
		if (img && img.width && img.height) {
			this.image = img;
			
			this.set('mode', 'image');
			this.set('width', img.width);
			this.set('height', img.height);
			
			this.canvas = null;
			this.context = null;
			this.pixels = null;
			this.palette = null;
			this.exif = null;
		}
		else {
			this.doError('import', "Cannot import image: It is not loaded");
		}
	},
	
	importCanvas: function(canvas) {
		// import existing canvas
		this.canvas = canvas;
		this.context = canvas.getContext('2d');
		
		this.set('mode', 'rgba');
		this.set('width', canvas.width);
		this.set('height', canvas.height);
		
		// apply settings
		for (var key in this.canvasSettingsKeys) {
			this.context[key] = this.settings[key];
		}
		
		if (!this.get('origWidth')) {
			this.set('origWidth', this.get('width'));
			this.set('origHeight', this.get('height'));
		}
		
		this.image = null;
		this.pixels = null;
		this.palette = null;
		this.exif = null;
	},
	
	applySettings: function(opts) {
		// merge settings in with opts
		if (!opts) opts = {};
		for (var key in this.settings) {
			if (!(key in opts)) opts[key] = this.settings[key];
		}
		return opts;
	},
	
	copyHash: function(hash, deep) {
		// copy hash to new one, with optional deep mode (uses JSON)
		if (deep) {
			// deep copy
			return JSON.parse( JSON.stringify(hash) );
		}
		else {
			// shallow copy
			var output = {};
			for (var key in hash) {
				output[key] = hash[key];
			}
			return output;
		}
	},
	
	applyAntialias: function(antialias) {
		// apply antialias setting to Context2D, and map HTML5 image smoothing as well
		var ctx = this.context;
		antialias = antialias.toLowerCase();
		
		ctx.quality = antialias;
		ctx.patternQuality = antialias;
		
		switch (antialias) {
			case 'fast':
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'low';
				ctx.antialias = 'subpixel';
			break;
			
			case 'good':
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'medium';
				ctx.antialias = 'subpixel';
			break;
			
			case 'best':
			case 'bilinear':
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'high';
				ctx.antialias = 'subpixel';
			break;
			
			case 'nearest':
				ctx.imageSmoothingEnabled = false;
				ctx.antialias = 'none';
			break;
		}
	},
	
	reset: function() {
		// free up memory, start over
		this.settings = Object.assign({}, this.defaultSettings);
		
		this.lastError = null;
		this.image = null;
		this.canvas = null;
		this.context = null;
		this.pixels = null;
		this.palette = null;
		this.exif = null;
		this.mode = '';
		this.format = '';
		
		this.perf.reset();
		this.perf.begin();
	},
	
	render: function() {
		// render image onto canvas
		if (!this.image && !this.pixels) return this.doError('render', "No image to render");
		
		// optionally auto-orient image via EXIF
		var auto_orient = false;
		if (this.get('autoOrient') && this.image && !this.canvas && this.exif && this.exif.Orientation && (this.exif.Orientation > 1)) {
			auto_orient = true;
			if (this.exif.Orientation >= 5) {
				// image is 90 or 270 degrees, need to swap width/height
				this.logDebug(5, "Swapping width/height for auto-orientation rotate");
				var temp = this.get('width');
				this.set('width', this.get('height'));
				this.set('height', temp);
			}
		}
		
		// create canvas if needed
		if (!this.canvas) {
			var result = this.create();
			if (result.isError) return result;
		}
		
		this.perf.begin('render');
		
		if (this.image) {
			// convert image to RGBA
			var img = this.image;
			var ctx = this.context;
			
			this.logDebug(5, "Rendering image onto canvas", { width: img.width, height: img.height });
			ctx.save();
			
			if (auto_orient) {
				this.logDebug(5, "Automatically orienting image from EXIF mode: " + this.exif.Orientation, this.getDimensions());
				switch (this.exif.Orientation) {
					case 2: ctx.transform(-1, 0, 0, 1, img.width, 0); break;
					case 3: ctx.transform(-1, 0, 0, -1, img.width, img.height); break;
					case 4: ctx.transform(1, 0, 0, -1, 0, img.height); break;
					case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
					case 6: ctx.transform(0, 1, -1, 0, img.height , 0); break;
					case 7: ctx.transform(0, -1, -1, 0, img.height, img.width); break;
					case 8: ctx.transform(0, -1, 1, 0, 0, img.width); break;
				}
			} // auto_orient
			
			ctx.drawImage( img, 0, 0 );
			ctx.restore();
			img = this.image = null;
		}
		else {
			// render indexed image back to RGBA
			this.logDebug(5, "Converting indexed pixels back to RGBA", this.getDimensions());
			var iq_pixels = this.pixels;
			var iq_colors = this.palette;
			var imgData = this.context.createImageData( this.get('width'), this.get('height') );
			var offset = 0;
			
			for (var idx = 0, len = iq_pixels.length; idx < len; idx++) {
				var iq_color = iq_colors[ iq_pixels[idx] ];
				imgData.data[ offset + 0 ] = iq_color.r;
				imgData.data[ offset + 1 ] = iq_color.g;
				imgData.data[ offset + 2 ] = iq_color.b;
				imgData.data[ offset + 3 ] = iq_color.a;
				offset += 4;
			}
			
			this.context.putImageData( imgData, 0, 0 );
			this.pixels = null;
			this.palette = null;
		}
		
		this.set('mode', 'rgba');
		this.perf.end('render');
		
		this.logDebug(6, "Rendering complete");
		
		// for chaining
		return this;
	},
	
	requireRGBA: function() {
		// convert image into RGBA canvas if needed, either from Image source object, or from indexed back to RGBA
		if (this.get('mode') != 'rgba') return this.render();
		else return this;
	},
	
	clone: function() {
		// produce clone of ourself
		this.clearLastError();
		this.logDebug(5, "Creating clone of self");
		
		var clone = new CanvasPlus();
		clone.set( this.settings );
		
		switch (this.get('mode')) {
			case 'image': 
				clone.image = this.image; 
			break;
			
			case 'indexed':
				clone.pixels = new Uint8Array(this.pixels);
				clone.palette = JSON.parse( JSON.stringify(this.palette) );
			break;
			
			case 'rgba':
				var imgData = this.context.getImageData(0, 0, this.get('width'), this.get('height'));
				clone.create();
				clone.context.putImageData( imgData, 0, 0 );
			break;
		}
		
		return clone;
	},
	
	doError: function(code, msg, callback) {
		// generate error
		var err = new Error( this.__name + ": " + msg );
		err.code = code;
		err.component = this.__name;
		
		// this.emit('error', err);
		this.lastError = err;
		
		if (this.logger) {
			// log to pixl-logger compatible agent
			if (this.logger.set) this.logger.set('component', this.__name);
			this.logger.error( err.code, err.message );
		}
		else if (this.get('debug')) {
			// log to console
			console.error( '[ERROR][' + err.code + '] ' + err.message );
		}
		
		if (callback) callback(err);
		else if (this.get('throw')) throw err;
		
		return ChainBreaker;
	},
	
	logDebug: function(level, msg, data) {
		// proxy to logger
		if (this.logger) {
			// log to pixl-logger compatible agent
			if (this.logger.set) this.logger.set('component', this.__name);
			this.logger.debug(level, msg, data);
		}
		else if (this.get('debug')) {
			// log to console
			console.log( '[DEBUG] ' + msg, data ? JSON.stringify(data) : '' );
		}
	}
	
});

// populate ChainBreaker object
for (var key in CanvasPlus.prototype) {
	if (typeof(CanvasPlus.prototype[key]) == 'function') {
		ChainBreaker[key] = function() { return this; };
	}
}
