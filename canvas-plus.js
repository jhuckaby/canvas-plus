(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (process){
// canvas-plus - Image Transformation Engine
// (HTML5/Browser Version)
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

// To compile:
//		browserify browser.js > bundle.js

// polyfill for canvas.toBlob
if (!HTMLCanvasElement.prototype.toBlob) {
	Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
		value: function (callback, type, quality) {
			var binStr = atob( this.toDataURL(type, quality).split(',')[1] ),
			len = binStr.length,
			arr = new Uint8Array(len);
			
			for (var i = 0; i < len; i++ ) {
				arr[i] = binStr.charCodeAt(i);
			}
			
			callback( new Blob( [arr], {type: type || 'image/png'} ) );
		}
	});
}

// monkey-patch process.hrtime, as it isn't provided by browserify
// (this is needed by pixl-perf)
process.hrtime = require('browser-process-hrtime');

// expose our node class polyfill
var Class = window.Class = require('pixl-class');

// load our library
var CanvasPlus = window.CanvasPlus = require('./main.js');

// make some browser-specific overrides
CanvasPlus.prototype.browser = true;
CanvasPlus.prototype.userAgent = navigator.userAgent;

// Context2D.measureText() doesn't include height in the browser, so we must hack one in.
var font_height_cache = {};

CanvasPlus.prototype.measureTextHeight = function(font_style) {
	if (font_height_cache[font_style]) return font_height_cache[font_style];
	
	var body = document.getElementsByTagName('body')[0];
	var div = document.createElement('div');
	var sty = div.style;
	
	sty.position = 'absolute';
	sty.left = '0px';
	sty.top = '0px';
	sty.opacity = 0;
	sty.font = font_style;
	sty.lineHeight = 'normal'; // default is roughly 1.2 in most browsers
	div.innerHTML = 'M';
	
	body.appendChild( div );
	var height = font_height_cache[font_style] = div.offsetHeight;
	body.removeChild( div );
	
	return height;
};

}).call(this,require('_process'))
},{"./main.js":26,"_process":63,"browser-process-hrtime":33,"pixl-class":85}],2:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Canvas Create Mixin - Browser Version
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	create: function(opts, callback) {
		// create new canvas, with optional background color
		// opts: { width, height, background }
		this.clearLastError();
		if (!this.get('origWidth')) this.perf.begin('create');
		
		opts = this.copyHash( opts || {} );
		opts = this.applySettings(opts);
		
		var width = opts.width;
		var height = opts.height;
		var background = opts.background;
		
		this.set('width', width);
		this.set('height', height);
		
		this.logDebug(5, "Creating new canvas: " + width + 'x' + height, { background: background || '(transparent)' });
		
		// sanity check
		if (!width || isNaN(parseInt(width)) || !height || isNaN(parseInt(height))) {
			return this.doError('create', "Invalid image dimensions: " + width + 'x' + height, callback);
		}
		
		// check max area
		if (this.get('maxArea')) {
			var area = width * height;
			if (area > this.get('maxArea')) {
				return this.doError('create', "Image dimensions are too large: " + width + 'x' + height, callback);
			}
		}
		
		// create canvas
		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		this.context = this.canvas.getContext('2d');
		
		// apply settings
		for (var key in this.canvasSettingsKeys) {
			this.context[key] = this.settings[key];
		}
		
		// fill background if desired
		if (background) {
			this.context.save();
			this.context.globalCompositeOperation = 'copy';
			this.context.fillStyle = background;
			this.context.fillRect( 0, 0, width, height );
			this.context.restore();
		}
		
		this.set('mode', 'rgba');
		
		if (!this.get('origWidth')) {
			this.perf.end('create');
			this.set('origWidth', this.get('width'));
			this.set('origHeight', this.get('height'));
		}
		
		this.logDebug(5, "Canvas created successfully");
		if (callback) callback();
		
		// for chaining
		return this;
	}
		
});

},{"pixl-class":85}],3:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Canvas Font Mixin - Browser Version
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var fonts_loaded = {};

module.exports = Class.create({
	
	getFontID: function(family) {
		// family is font ID for browser
		return family;
	},
	
	loadFont: function(family, url, callback) {
		// load CSS font family in browser, callback is optional
		var self = this;
		
		if (family in fonts_loaded) {
			if (callback) callback();
			return;
		}
		fonts_loaded[family] = 1;
		
		// sniff format from URL
		if (url.match(/\.(\w+)(\?|$)/)) {
			var fmt = RegExp.$1;
			if (fmt.match(/ttf/i)) fmt = 'truetype';
			else if (fmt.match(/otf/i)) fmt = 'opentype';
			
			var pf = this.perf.begin('font');
			
			var sty = document.createElement('style');
			sty.type = 'text/css';
			sty.innerHTML = "@font-face { font-family:'" + family + "'; src:url('" + url + "') format('" + fmt + "'); }\n";
			(document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(sty);
			
			onFontReady(family, function() {
				pf.end();
				self.logDebug(5, "Font loaded successfully: " + family + ": " + url);
				if (callback) callback();
			}, 
			{
				timeoutAfter: 5000,
				onTimeout: function() {
					pf.end();
					return self.doError( 'font', "Failed to load font after 5 seconds: " + family, callback );
				}
			});
		}
		else {
			self.doError( 'font', "Cannot determine font format from URL: " + url, callback );
		}
	}
	
});

// onFontReady (MIT License)
// https://github.com/dwighthouse/onfontready/blob/master/LICENSE
function onFontReady(e,t,i,n,o){i=i||0,i.timeoutAfter&&setTimeout(function(){n&&(document.body.removeChild(n),n=0,i.onTimeout&&i.onTimeout())},i.timeoutAfter),o=function(){n&&n.firstChild.clientWidth==n.lastChild.clientWidth&&(document.body.removeChild(n),n=0,t())},o(document.body.appendChild(n=document.createElement("div")).innerHTML='<div style="position:fixed;white-space:pre;bottom:999%;right:999%;font:999px '+(i.generic?"":"'")+e+(i.generic?"":"'")+',serif">'+(i.sampleText||" ")+'</div><div style="position:fixed;white-space:pre;bottom:999%;right:999%;font:999px '+(i.generic?"":"'")+e+(i.generic?"":"'")+',monospace">'+(i.sampleText||" ")+"</div>"),n&&(n.firstChild.appendChild(e=document.createElement("iframe")).style.width="999%",e.contentWindow.onresize=o,n.lastChild.appendChild(e=document.createElement("iframe")).style.width="999%",e.contentWindow.onresize=o,e=setTimeout(o))};

},{"pixl-class":85}],4:[function(require,module,exports){
(function (Buffer){
// canvas-plus - Image Transformation Engine
// Canvas Load Mixin - Browser Version
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var EXIF = require('exif-js');
var fileType = require('file-type');

module.exports = Class.create({
	
	load: function(thingy, callback) {
		// load image from ArrayBuffer, Blob, File or URL (local domain or CORS required)
		// Note: This function is ASYNC ONLY -- no return value, no chaining
		var self = this;
		this.clearLastError();
		
		if (typeof(thingy) == 'string') {
			// load from URL
			var url = thingy;
			this.logDebug(4, "Loading image from URL", { url: url } );
			this.perf.begin('download');
			
			var http = new XMLHttpRequest();
			http.onload = function() {
				if (this.status == 200 || this.status === 0) {
					self.perf.end('download');
					self.load( http.response, callback );
				} 
				else {
					self.doError('load', "URL Fetch Failure: " + url + ": HTTP " + this.status + " " + this.statusText, callback);
				}
				http = null;
			};
			http.open("GET", url, true);
			http.responseType = "arraybuffer";
			http.send(null);
			return;
		}
		else if (thingy instanceof Blob || thingy instanceof File) {
			// load from blob or file
			var fileReader = new FileReader();
			fileReader.onload = function(e) {
				self.load( e.target.result, callback );
			};
			fileReader.readAsArrayBuffer(thingy);
			return;
		}
		
		// support Uint8Array or Buffer (which is a Uint8Array in disguise)
		if (thingy instanceof Uint8Array) {
			if ((thingy.byteOffset === 0) && (thingy.byteLength === thingy.buffer.byteLength)) {
				thingy = thingy.buffer;
			}
			else if (typeof thingy.buffer.slice === 'function') {
				thingy = thingy.buffer.slice(thingy.byteOffset, thingy.byteOffset + thingy.byteLength);
			}
		}
		
		// we should have an ArrayBuffer at this point
		if (!(thingy instanceof ArrayBuffer)) {
			return this.doError('load', "Failed to load image: Unknown image resource type: " + typeof(thingy), callback); 
		}
		var arr_buf = thingy;
		
		// detect file format
		this.perf.begin('detect');
		var info = fileType(arr_buf);
		this.perf.end('detect');
		
		if (!info || !info.mime) {
			return this.doError('load', "Failed to load image: Unsupported or unknown file type", callback);
		}
		this.set('format', info.mime.replace(/^image\//, ''));
		
		this.logDebug(4, "Loading image from buffer", { size: arr_buf.byteLength, format: this.get('format') } );
		
		// detect EXIF data if present in image
		if (this.get('readEXIF')) {
			this.perf.begin('exif');
			try { this.exif = EXIF.readFromBinaryFile( arr_buf ); }
			catch (err) {
				this.logDebug(3, "Warning: Failed to read EXIF metadata: " + err);
			}
			this.perf.end('exif');
			if (this.exif) this.logDebug(9, "EXIF Image Data", this.exif);
		}
		
		// load image (actually happens in sync, but uses callbacks, sigh)
		this.perf.begin('read');
		this.image = new Image();
		
		// load image from buffer
		var mime_type = info.mime;
		var url_creator = window.URL || window.webkitURL || window.mozURL || window.msURL;
		var object_url = null;
		
		this.image.onerror = function() {
			// load failed
			self.perf.end('read');
			self.doError('load', "Image load failed", callback);
			
			// free memory
			if (object_url) url_creator.revokeObjectURL(object_url);
		};
		
		this.image.onload = function() {
			// load complete (should be same thread)
			self.perf.end('read');
			self.perf.count('bytes_read', arr_buf.byteLength);
			self.set('mode', 'image');
			
			// sanity checks
			if ((this.width < 1) || (this.height < 1)) {
				return self.doError('load', "Image dimensions are invalid: " + this.width + 'x' + this.height, callback);
			}
			
			// check pixel area vs. max
			if (self.get('maxArea')) {
				var area = this.width * this.height;
				if (area > self.get('maxArea')) {
					self.doError('load', "Image dimensions are too large: " + this.width + 'x' + this.height, callback);
				}
			}
			
			// set some props based on image
			self.set('width', this.width);
			self.set('height', this.height);
			
			self.set('origWidth', self.get('width'));
			self.set('origHeight', self.get('height'));
			self.set('origFormat', self.get('format'));
			
			self.canvas = null;
			self.context = null;
			self.pixels = null;
			self.palette = null;
			
			self.logDebug(5, "Image load complete");
			if (callback) callback(false);
			
			// free memory
			if (object_url) url_creator.revokeObjectURL(object_url);
		};
		
		// trigger load
		if (this.get('useDataURLs')) {
			// load using data url
			var buf = Buffer.from(arr_buf);
			this.image.src = "data:" + mime_type + ";base64," + buf.toString('base64');
		}
		else {
			// load using blob
			var buf_view = new Uint8Array( arr_buf );
			var blob = new Blob( [ buf_view ], { type: mime_type } );
			object_url = url_creator.createObjectURL( blob );
			this.image.src = object_url;
		}
	},
	
	loadRemote: function(url, callback) {
		// load image from remote url (browser only, no EXIF)
		// this is for URLs on 3rd party domains with no CORS headers
		var self = this;
		this.clearLastError();
		this.perf.begin('download');
		
		var fmt = '';
		if (url.match(/\.(\w+)(\?|$)/)) fmt = RegExp.$1.toLowerCase();
		
		this.logDebug(4, "Loading image from URL", { url: url, format: fmt } );
		
		// load image
		this.image = new Image();
		
		this.image.onerror = function() {
			// load failed
			self.doError('load', "Image load failed: " + url, callback);
		};
		
		this.image.onload = function() {
			// load complete (should be same thread)
			self.perf.end('download');
			
			// sanity checks
			if ((this.width < 1) || (this.height < 1)) {
				return self.doError('load', "Image dimensions are invalid: " + this.width + 'x' + this.height, callback);
			}
			
			// check pixel area vs. max
			if (self.get('maxArea')) {
				var area = this.width * this.height;
				if (area > self.get('maxArea')) {
					self.doError('load', "Image dimensions are too large: " + this.width + 'x' + this.height, callback);
				}
			}
			
			// set some props based on image
			self.set('width', this.width);
			self.set('height', this.height);
			self.set('format', fmt);
			
			self.set('origWidth', self.get('width'));
			self.set('origHeight', self.get('height'));
			self.set('origFormat', self.get('format'));
			
			self.canvas = null;
			self.context = null;
			self.pixels = null;
			self.palette = null;
			self.exif = null; // not supported with loadRemote
			
			self.set('mode', 'image');
			self.logDebug(5, "Image load complete");
			if (callback) callback(false);
		};
		
		// trigger load
		this.image.src = url;
	}
	
});

}).call(this,require("buffer").Buffer)
},{"buffer":37,"exif-js":41,"file-type":42,"pixl-class":85}],5:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Canvas Write Mixin - Browser Version
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	write: function(opts, callback) {
		// output and/or compress image using helper mixin
		// Note: This function is ASYNC ONLY -- no return value, no chaining
		var self = this;
		this.clearLastError();
		
		if (!opts) opts = {};
		if (typeof(opts) == 'string') {
			opts = { file: opts };
		}
		
		// import opts into settings
		this.set( opts );
		
		// glean format from file if needed
		if (this.get('file') && this.get('file').match(/\.(\w+)$/)) {
			this.set('format', RegExp.$1);
		}
		if (!this.get('format')) {
			this.doError('write', "No image format was specified", callback);
			return;
		}
		
		this.perf.begin('write');
		this.logDebug(5, "Compressing image to format: " + this.get('format'));
		
		// locate helper
		var nfmt = this.get('format').toString().toLowerCase().replace(/\W+/g, '').replace(/jpg/, 'jpeg');
		var func = 'output_' + nfmt;
		if (!this[func]) {
			this.doError('write', "Unsupported output format: " + this.get('format'), callback);
			return;
		}
		
		// call helper
		this[func]( function(err, buf) {
			if (err) {
				// assume doError has already been called at this point, so just bubble up
				if (callback) callback(err);
				return;
			}
			
			self.logDebug(5, "Image compression complete", { size: buf.length });
			
			// buffer only
			self.perf.end('write');
			self.perf.count('bytes_written', buf.length);
			if (callback) callback(false, buf);
		});
	}
		
});

},{"pixl-class":85}],6:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Adjust Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	adjust: function(opts) {
		// adjust brightness / contrast / hue / saturation
		// opts: { brightness, contrast, hue, saturation, clip }
		// all ranges are -255 to 255, except for hue which is -360 to 360
		var self = this;
		this.clearLastError();
		
		if (!opts || !Object.keys(opts).length) {
			return this.doError('adjust', "No adjust options were provided");
		}
		if (!opts.brightness && !opts.contrast && !opts.hue && !opts.saturation) {
			this.logDebug(9, "No adjustments to be made, skipping", opts);
			return this;
		}
		
		opts = this.copyHash( opts || {} );
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.perf.begin('adjust');
		this.logDebug(6, "Adjusting image", opts);
		
		var clip = opts.clip || this.getBounds();
		if (!this.isValidRect(clip)) return this.doError('adjust', "Invalid clipping rectangle");
		
		var width = clip.width;
		var height = clip.height;
		var imgData = this.context.getImageData(clip.x, clip.y, width, height);
		var offset = 0;
		var bri = Math.max(-255, Math.min(255, opts.brightness || 0));
		var con = Math.max(-255, Math.min(255, opts.contrast || 0));
		var hue = Math.max(-360, Math.min(360, opts.hue || 0));
		var sat = Math.max(-255, Math.min(255, opts.saturation || 0));
		var rgb = {};
		var hsv = {};
		
		if (con) con = Math.pow((con + 255) / 255, 2);
		
		for (var y = 0; y < height; y++) {
			// foreach row
			for (var x = 0; x < width; x++) {
				// for each pixel, skip if totally transparent
				if (imgData.data[ offset + 3 ] > 0) {
					rgb.r = imgData.data[ offset + 0 ];
					rgb.g = imgData.data[ offset + 1 ];
					rgb.b = imgData.data[ offset + 2 ];
					
					if (bri) {
						// apply brightness
						rgb.r = Math.max(0, Math.min(255, rgb.r + bri));
						rgb.g = Math.max(0, Math.min(255, rgb.g + bri));
						rgb.b = Math.max(0, Math.min(255, rgb.b + bri));
					}
					if (hue || sat) {
						// apply hue or saturation
						rgbToHsv( rgb.r, rgb.g, rgb.b, hsv );
						if (hue > 0) hsv.h = (hsv.h + hue) % 360;
						else if (hue < 0) {
							hsv.h += hue;
							if (hsv.h < 0) hsv.h += 360;
						}
						if (sat && hsv.s) {
							if (sat > 0) hsv.s = Math.max(0, Math.min(255, Math.floor(hsv.s + (sat * ((255 - hsv.v) / 255)) )));
							else hsv.s = Math.max(0, Math.min(255, hsv.s + sat));
						}
						hsvToRgb( hsv.h, hsv.s, hsv.v, rgb );
					}
					if (opts.contrast) {
						// apply contrast
						rgb.r = Math.floor( ((rgb.r / 255 - 0.5) * con + 0.5) * 255 );
						rgb.g = Math.floor( ((rgb.g / 255 - 0.5) * con + 0.5) * 255 );
						rgb.b = Math.floor( ((rgb.b / 255 - 0.5) * con + 0.5) * 255 );
					}
					
					imgData.data[ offset + 0 ] = rgb.r;
					imgData.data[ offset + 1 ] = rgb.g;
					imgData.data[ offset + 2 ] = rgb.b;
				}
				offset += 4;
			} // x loop
		} // y loop
		
		this.context.putImageData( imgData, clip.x, clip.y );
		
		this.perf.end('adjust');
		this.logDebug(6, "Image adjustment complete");
		return this;
	},
	
	brightness: function(amount) {
		// shortcut
		return this.adjust({ brightness: amount });
	},
	
	contrast: function(amount) {
		// shortcut
		return this.adjust({ contrast: amount });
	},
	
	hue: function(amount) {
		// shortcut
		return this.adjust({ hue: amount });
	},
	
	saturation: function(amount) {
		// shortcut
		return this.adjust({ saturation: amount });
	},
	
	desaturate: function(opts) {
		// fast version of adjust({saturation:-255}), without conversion to/from HSV
		var self = this;
		this.clearLastError();
		
		opts = this.copyHash( opts || {} );
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.perf.begin('desaturate');
		this.logDebug(6, "Desaturating image (i.e. grayscale)");
		
		var clip = opts.clip || this.getBounds();
		if (!this.isValidRect(clip)) return this.doError('desaturate', "Invalid clipping rectangle");
		
		var width = clip.width;
		var height = clip.height;
		var imgData = this.context.getImageData(clip.x, clip.y, width, height);
		var offset = 0;
		var brightness = 0;
		
		for (var y = 0; y < height; y++) {
			// foreach row
			for (var x = 0; x < width; x++) {
				// for each pixel
				if (imgData.data[ offset + 3 ] > 0) {
					// calculate brightness fast
					brightness = 0.2126 * imgData.data[ offset + 0 ] + 0.7152 * imgData.data[ offset + 1 ] + 0.0722 * imgData.data[ offset + 2 ];
					
					imgData.data[ offset + 0 ] = brightness;
					imgData.data[ offset + 1 ] = brightness;
					imgData.data[ offset + 2 ] = brightness;
				}
				offset += 4;
			} // x loop
		} // y loop
		
		this.context.putImageData( imgData, clip.x, clip.y );
		
		this.perf.end('desaturate');
		this.logDebug(6, "Image desaturation complete");
		return this;
	}
	
}); // class

// Color Utilities From: https://github.com/bgrins/TinyColor
// Copyright (c) 2012, Brian Grinstead, http://briangrinstead.com
// License (MIT): https://github.com/bgrins/TinyColor/blob/master/LICENSE
// Note: These have been updated by jhuckaby for use in CanvasPlus.

// `rgbToHsv`
// Converts an RGB color value to HSV
function rgbToHsv(r, g, b, hsv) {
	r = r / 255;
	g = g / 255;
	b = b / 255;
	
	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, v = max;
	
	var d = max - min;
	s = max === 0 ? 0 : d / max;
	
	if(max == min) {
		h = 0; // achromatic
	}
	else {
		switch(max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h /= 6;
	}
	
	if (!hsv) hsv = {};
	hsv.h = Math.floor( h * 360 );
	hsv.s = Math.floor( s * 255 );
	hsv.v = Math.floor( v * 255 );
	return hsv;
};

// `hsvToRgb`
// Converts an HSV color value to RGB
function hsvToRgb(h, s, v, rgb) {
	h = (h / 360) * 6;
	s = s / 255;
	v = v / 255;
	
	var i = Math.floor(h),
		f = h - i,
		p = v * (1 - s),
		q = v * (1 - f * s),
		t = v * (1 - (1 - f) * s),
		mod = i % 6,
		r = [v, q, p, p, t, v][mod],
		g = [t, v, v, q, p, p][mod],
		b = [p, p, t, v, v, q][mod];
	
	if (!rgb) rgb = {};
	rgb.r = Math.floor( r * 255 );
	rgb.g = Math.floor( g * 255 );
	rgb.b = Math.floor( b * 255 );
	return rgb;
};

},{"pixl-class":85}],7:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Border Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	border: function(opts) {
		// render border around canvas
		// special opts: size, color, mode (inside, center, outside)
		var self = this;
		var result;
		this.clearLastError();
		
		result = this.requireRGBA();
		if (result.isError) return result;
		
		if (!opts) {
			return this.doError('border', "Must specify options object");
		}
		
		opts = this.copyHash( opts || {} );
		
		if (!opts.mode) opts.mode = 'center';
		if (!opts.size || !opts.color) {
			return this.doError('border', "Must specify size and color");
		}
		
		this.perf.begin('border');
		this.logDebug(5, "Rendering border around canvas", opts);
		
		// see if we need to expand the canvas
		if (opts.mode.match(/(center|outside)/i)) {
			var expand_by = opts.size * 2;
			if (opts.mode.match(/(center)/i)) expand_by = Math.floor( expand_by / 2 );
			
			if (expand_by) {
				// yes expand
				result = this.expand({
					width: expand_by,
					height: expand_by,
					gravity: 'center'
				});
				if (result.isError) return result;
			}
		}
		
		// draw border
		var ctx = this.context;
		var width = this.get('width');
		var height = this.get('height');
		var size = opts.size;
		
		ctx.save();
		// ctx.globalCompositeOperation = 'copy';
		ctx.fillStyle = opts.color;
		ctx.fillRect( 0, 0, width, size );
		ctx.fillRect( width - size, 0, width, height );
		ctx.fillRect( 0, height - size, width, height );
		ctx.fillRect( 0, 0, size, height );
		ctx.restore();
		
		this.perf.end('border');
		this.logDebug(6, "Border complete");
		return this;
	}
	
});

},{"pixl-class":85}],8:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Composite Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	composite: function(opts) {
		// superimpose image onto canvas
		// { image, width, height, gravity, marginX, marginY, offsetX, offsetY, opacity, mode, antialias }
		var self = this;
		var result;
		this.clearLastError();
		
		result = this.requireRGBA();
		if (result.isError) return result;
		
		if (!opts) {
			return this.doError('composite', "No options passed to composite");
		}
		if (!opts.image) {
			return this.doError('composite', "Missing image to composite");
		}
		
		opts = this.copyHash( opts || {} );
		
		var image = opts.image;
		delete opts.image;
		
		// allow 'mode' to be passed in, but rename it to 'compositeMode'
		if (opts && opts.mode) {
			opts.compositeMode = opts.mode;
			delete opts.mode;
		}
		
		this.perf.begin('composite');
		this.logDebug(6, "Compositing image", opts);
		
		// import settings into opts
		opts = this.applySettings(opts);
		
		// image can be canvas-plus, Canvas or Image
		if (image.__name == "CanvasPlus") {
			if (image.image) image = image.image;
			else if (image.canvas) image = image.canvas;
			else if (image.pixels) {
				// image is indexed, so clone and convert it to RGBA
				var clone = image.clone();
				result = clone.requireRGBA();
				if (result.isError) {
					return this.doError('composite', "Failed to convert indexed image to RGBA: " + clone.getLastError());
				}
				image = clone.canvas;
			}
			else {
				return this.doError('composite', "Could not determine image type");
			}
		} // canvas-plus
		
		if (!image.width || !image.height) {
			return this.doError('composite', "Image has invalid dimensions");
		}
		
		var iwidth = opts.width || image.width;
		var iheight = opts.height || image.height;
		
		var ctx = this.context;
		var width = this.get('width');
		var height = this.get('height');
		var dx = opts.offsetX || 0;
		var dy = opts.offsetY || 0;
		var mx = opts.marginX || 0;
		var my = opts.marginY || 0;
		var gravity = opts.gravity;
		
		ctx.save();
		
		if (opts.opacity < 1) {
			ctx.globalAlpha = opts.opacity;
		}
		if (opts.compositeMode) {
			ctx.globalCompositeOperation = opts.compositeMode;
		}
		if (opts.antialias) {
			this.applyAntialias( opts.antialias );
		}
		
		var x = 0;
		var y = 0;
		
		if (gravity.match(/(west|left)/i)) x = 0 + mx + dx;
		else if (gravity.match(/(east|right)/i)) x = ((width - mx) - iwidth) - dx;
		else x = ((width / 2) - (iwidth / 2)) + dx;
		
		if (gravity.match(/(north|top)/i)) y = 0 + my + dy;
		else if (gravity.match(/(south|bottom)/i)) y = ((height - my) - iheight) - dy;
		else y = ((height / 2) - (iheight / 2)) + dy;
		
		ctx.drawImage( image, x, y, iwidth, iheight );
		
		ctx.restore();
		this.perf.end('composite');
		this.logDebug(6, "Image compositing complete");
		return this;
	},
	
	mask: function(opts) {
		// shortcut for composite using destination-in
		// (apply image as mask to current image)
		opts = this.copyHash( opts || {} );
		opts.mode = 'destination-in';
		return this.composite(opts);
	}
	
});

},{"pixl-class":85}],9:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Convolve Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	convolve: function(opts) {
		// apply convolution kernel to image
		// opts: { matrix, offset, edges, channels, clip }
		// Adapted from: https://www.html5rocks.com/en/tutorials/canvas/imagefilters/
		var self = this;
		this.clearLastError();
		
		if (!opts || !opts.matrix) {
			return this.doError('convolve', "No convolve options were provided");
		}
		
		opts = this.copyHash( opts || {} );
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.perf.begin('convolve');
		this.logDebug(6, "Applying convolution kernel to image", opts);
		
		var channels = opts.channels || 'rgba';
		var red = !!channels.match(/r/i);
		var green = !!channels.match(/g/i);
		var blue = !!channels.match(/b/i);
		var alpha = !!channels.match(/a/i);
		
		var edges = opts.edges || 'repeat';
		var edge_repeat = edges.match(/repeat/i);
		var edge_wrap = edges.match(/wrap/i);
		var edge_mirror = edges.match(/mirror/i);
		
		var clip = opts.clip || this.getBounds();
		if (!this.isValidRect(clip)) return this.doError('convolve', "Invalid clipping rectangle");
		
		var pixels = this.context.getImageData(clip.x, clip.y, clip.width, clip.height);
		var weights = opts.matrix;
		var offset = opts.offset || 0;
		var m = Math;
		
		var side = m.round(m.sqrt(weights.length));
		var halfSide = m.floor(side / 2);
		var src = pixels.data;
		var sw = pixels.width;
		var sh = pixels.height;

		// pad output by the convolution matrix
		var w = sw;
		var h = sh;
		// var output = this.context.createImageData(w, h);
		var output = this.context.getImageData(clip.x, clip.y, clip.width, clip.height);
		var dst = output.data;
		
		// go through the destination image pixels
		for (var y = 0; y < h; y++) {
			for (var x = 0; x < w; x++) {
				var sy = y;
				var sx = x;
				var dstOff = (y * w + x) * 4;
				// calculate the weighed sum of the source image pixels that
				// fall under the convolution matrix
				var r = 0,
					g = 0,
					b = 0,
					a = 0;
				for (var cy = 0; cy < side; cy++) {
					for (var cx = 0; cx < side; cx++) {
						var scy = sy + cy - halfSide;
						var scx = sx + cx - halfSide;
						
						if (edge_repeat) {
							// repeat edge pixels
							scx = Math.clamp(scx, 0, sw - 1);
							scy = Math.clamp(scy, 0, sh - 1);
						}
						else if (edge_wrap) {
							// wrap edges to opposite side
							if (scx < 0) scx += sw;
							else if (scx >= sw) scx -= sw;
							if (scy < 0) scy += sh;
							else if (scy >= sh) scy -= sh;
						}
						else if (edge_mirror) {
							// mirror edges in both directions
							if (scx < 0) scx = 0 - scx;
							else if (scx >= sw) scx -= ((scx - sw) + 1);
							if (scy < 0) scy = 0 - scy;
							else if (scy >= sh) scy -= ((scy - sh) + 1);
						}
						
						if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
							var srcOff = (scy * sw + scx) * 4;
							var wt = weights[cy * side + cx];
							if (red)   r += src[srcOff] * wt;
							if (green) g += src[srcOff + 1] * wt;
							if (blue)  b += src[srcOff + 2] * wt;
							if (alpha) a += src[srcOff + 3] * wt;
						}
					}
				}
				if (red)   dst[dstOff] = offset + r;
				if (green) dst[dstOff + 1] = offset + g;
				if (blue)  dst[dstOff + 2] = offset + b;
				if (alpha) dst[dstOff + 3] = offset + a;
			}
		}
		
		this.context.putImageData( output, clip.x, clip.y );
		
		this.perf.end('convolve');
		this.logDebug(6, "Image convolution kernel complete");
		return this;
	},
	
	blur: function(opts) {
		// box blur using convolve, configurable amount
		// opts: { amount, edges, channels }
		opts = this.copyHash( opts || {} );
		var level = opts.amount || 2;
		
		var len = level * level;
		var val = 1 / len;
		var matrix = [];
		if (len < 4) {
			//if the length of the matrix is less than 4,
			//it means that the blur radius is less than 2. There's no need to blur.
			return this;
		}
		// Fill up our convolution matrix with values
		while (len--) {
			matrix.push(val);
		}
		return this.convolve({ 
			matrix: matrix, 
			offset: 0, 
			edges: opts.edges || 'repeat',
			channels: opts.channels || 'rgba',
			clip: opts.clip || null
		});
	},
	
	sharpen: function(opts) {
		// sharpen using convolve
		// opts: { edges, channels }
		opts = this.copyHash( opts || {} );
		return this.convolve({ 
			matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0], 
			edges: opts.edges || 'repeat',
			channels: opts.channels || 'rgba',
			clip: opts.clip || null
		});
	},
	
	emboss: function(opts) {
		// emboss filter using convolve
		// opts: { edges, channels }
		opts = this.copyHash( opts || {} );
		return this.desaturate({ clip: opts.clip }).convolve({ 
			matrix: [2, 0, 0, 0, -1, 0, 0, 0, -1], 
			offset: 127, 
			edges: opts.edges || 'repeat',
			channels: opts.channels || 'rgb',
			clip: opts.clip || null
		});
	},
	
	findEdges: function(opts) {
		// find edges using convolve
		// opts: { edges, channels }
		opts = this.copyHash( opts || {} );
		return this.desaturate({ clip: opts.clip }).convolve({ 
			matrix: [-1, -1, -1, -1, 8, -1, -1, -1, -1], 
			offset: 0, 
			edges: opts.edges || 'repeat',
			channels: opts.channels || 'rgb',
			clip: opts.clip || null
		});
	},
	
	gaussianBlur: function(opts) {
		// gaussian blur (slow but better looking than blur())
		// opts: { amount, sigma, edges, channels }
		opts = this.copyHash( opts || {} );
		var dimension = opts.amount || 3;
		if (dimension < 3) dimension = 3;
		if (!(dimension % 2)) dimension++;
		var sigma = opts.sigma || Math.floor(dimension / 3);
		
		var matrix = generateGaussianKernel(dimension, sigma);
		return this.convolve({ 
			matrix: matrix, 
			offset: 0, 
			edges: opts.edges || 'repeat',
			channels: opts.channels || 'rgba',
			clip: opts.clip || null
		});
	}
	
});

// Gaussian Blur Convolution Kernel Generator
// From: https://github.com/mattlockyer/iat455/blob/master/assignment1/assignment/effects/blur-effect-dyn.js
// (c) Matt Lockyer, https://github.com/mattlockyer/iat455, MIT License

function hypotenuse(x1, y1, x2, y2) {
	var xSquare = Math.pow(x1 - x2, 2);
	var ySquare = Math.pow(y1 - y2, 2);
	return Math.sqrt(xSquare + ySquare);
};

/*
 * Generates a kernel used for the gaussian blur effect.
 *
 * @param dimension is an odd integer
 * @param sigma is the standard deviation used for our gaussian function.
 *
 * @returns an array with dimension^2 number of numbers, all less than or equal
 *	 to 1. Represents our gaussian blur kernel.
 */
function generateGaussianKernel(dimension, sigma) {
	if (!(dimension % 2) || Math.floor(dimension) !== dimension || dimension<3) {
		throw new Error(
			'The dimension must be an odd integer greater than or equal to 3'
		);
	}
	var kernel = [];
	
	var twoSigmaSquare = 2 * sigma * sigma;
	var centre = (dimension - 1) / 2;
	
	for (var i = 0; i < dimension; i++) {
		for (var j = 0; j < dimension; j++) {
			var distance = hypotenuse(i, j, centre, centre);
			
			// From: https://en.wikipedia.org/wiki/Gaussian_blur
			var gaussian = (1 / Math.sqrt(
				Math.PI * twoSigmaSquare
			)) * Math.exp((-1) * (Math.pow(distance, 2) / twoSigmaSquare));

			kernel.push(gaussian);
		}
	}
	
	// Returns the unit vector of the kernel array.
	var sum = kernel.reduce(function (c, p) { return c + p; });
	return kernel.map(function (e) { return e / sum; });
};

},{"pixl-class":85}],10:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Crop Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	crop: function(opts) {
		// crop canvas to specified size / offset
		// { x, y, width, height }
		var self = this;
		var result;
		this.clearLastError();
		
		// convert back to RGBA if indexed
		if (this.get('mode') == 'indexed') {
			result = this.render();
			if (result.isError) return result;
		}
		if (!this.canvas && !this.image) {
			return this.doError('crop', "No image to crop");
		}
		
		if (!opts || !opts.width || !opts.height) {
			return this.doError('crop', "Missing width/height size for crop");
		}
		if (!("x" in opts) || !("y" in opts)) {
			return this.doError('crop', "Missing x/y coordinates for crop");
		}
		
		opts = this.copyHash( opts || {} );
		
		this.logDebug(5, "Cropping image", opts);
		this.perf.begin('crop');
		
		if (!this.isValidRect(opts)) return this.doError('crop', "Invalid crop rectangle");
		
		var width = opts.width;
		var height = opts.height;
		var x = opts.x;
		var y = opts.y;
		
		// source can be image or canvas
		var source_image = this.image || this.canvas;
		delete this.image;
		
		// create new canvas to resize onto
		result = this.create({ width: width, height: height });
		if (result.isError) {
			this.perf.end('crop');
			return result;
		}
		
		// perform the actual draw
		this.context.drawImage(source_image, x, y, width, height, 0, 0, width, height);
		
		this.perf.end('crop');
		this.logDebug(6, "Image crop complete");
		return this;
	}
	
});

},{"pixl-class":85}],11:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Curves Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	curves: function(opts) {
		// apply curve to image channels
		// opts: { rgb, red, green, blue, alpha, clip }
		var self = this;
		this.clearLastError();
		
		if (!opts || !Object.keys(opts).length) {
			return this.doError('curves', "No curves options were provided");
		}
		
		opts = this.copyHash( opts || {} );
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.perf.begin('curves');
		this.logDebug(6, "Applying curve to image", opts);
		
		var curve_rgb = opts.rgb ? this.generateCurve(opts.rgb) : null;
		var curve_red = opts.red ? this.generateCurve(opts.red) : null;
		var curve_green = opts.green ? this.generateCurve(opts.green) : null;
		var curve_blue = opts.blue ? this.generateCurve(opts.blue) : null;
		var curve_alpha = opts.alpha ? this.generateCurve(opts.alpha) : null;
		
		if (curve_rgb) {
			curve_red = curve_green = curve_blue = curve_rgb;
		}
		
		var clip = opts.clip || this.getBounds();
		if (!this.isValidRect(clip)) return this.doError('curves', "Invalid clipping rectangle");
		
		var width = clip.width;
		var height = clip.height;
		var imgData = this.context.getImageData(clip.x, clip.y, width, height);
		var offset = 0;
		var rgb = {};
		var gray = 0;
		
		for (var y = 0; y < height; y++) {
			// foreach row
			for (var x = 0; x < width; x++) {
				// for each pixel, skip if totally transparent
				if (curve_alpha || (imgData.data[ offset + 3 ] > 0)) {
					if (curve_red) {
						imgData.data[ offset + 0 ] = curve_red[ imgData.data[ offset + 0 ] ];
					}
					if (curve_green) {
						imgData.data[ offset + 1 ] = curve_green[ imgData.data[ offset + 1 ] ];
					}
					if (curve_blue) {
						imgData.data[ offset + 2 ] = curve_blue[ imgData.data[ offset + 2 ] ];
					}
					if (curve_alpha) {
						imgData.data[ offset + 3 ] = curve_alpha[ imgData.data[ offset + 3 ] ];
					}
				}
				offset += 4;
			} // x loop
		} // y loop
		
		this.context.putImageData( imgData, clip.x, clip.y );
		
		this.perf.end('curves');
		this.logDebug(6, "Curve complete");
		return this;
	},
	
	posterize: function(opts) {
		// apply posterize effect using stair-step curve with N levels
		// opts: { levels, channels, clip }
		opts = this.copyHash( opts || {} );
		var levels = Math.floor( 256 / (opts.levels || 4) );
		var curve = [];
		
		for (var idx = 0; idx < 256; idx++) {
			curve.push( Math.min(255, Math.round( idx / levels ) * levels) );
		}
		
		var channels = opts.channels || 'rgb';
		delete opts.channels;
		delete opts.levels;
		
		if (channels.match(/rgb/i)) opts.rgb = curve;
		else {
			if (channels.match(/r/i)) opts.red = curve;
			if (channels.match(/g/i)) opts.green = curve;
			if (channels.match(/b/i)) opts.blue = curve;
		}
		if (channels.match(/a/i)) opts.alpha = curve;
		
		return this.curves(opts);
	},
	
	solarize: function(opts) {
		// apply solarize effect using 'v' curve
		// opts: { channels, clip }
		opts = this.copyHash( opts || {} );
		var curve = [];
		
		for (var idx = 0; idx < 256; idx++) {
			curve.push( (idx < 128) ? idx : (255 - idx) );
		}
		
		var channels = opts.channels || 'rgb';
		delete opts.channels;
		
		if (channels.match(/rgb/i)) opts.rgb = curve;
		else {
			if (channels.match(/r/i)) opts.red = curve;
			if (channels.match(/g/i)) opts.green = curve;
			if (channels.match(/b/i)) opts.blue = curve;
		}
		if (channels.match(/a/i)) opts.alpha = curve;
		
		return this.curves(opts);
	},
	
	invert: function(opts) {
		// invert channels using curve
		// opts: { channels, clip }
		opts = this.copyHash( opts || {} );
		var curve = [];
		
		for (var idx = 0; idx < 256; idx++) {
			curve.push( 255 - idx );
		}
		
		var channels = opts.channels || 'rgb';
		delete opts.channels;
		
		if (channels.match(/rgb/i)) opts.rgb = curve;
		else {
			if (channels.match(/r/i)) opts.red = curve;
			if (channels.match(/g/i)) opts.green = curve;
			if (channels.match(/b/i)) opts.blue = curve;
		}
		if (channels.match(/a/i)) opts.alpha = curve;
		
		return this.curves(opts);
	},
	
	temperature: function(opts) {
		// apply color temperature adjustment using curve
		// opts: { amount, clip }
		opts = this.copyHash( opts || {} );
		var curve = [];
		var channel = '';
		var amount = 0;
		
		if (opts.amount > 0) { channel = 'red'; amount = Math.floor(opts.amount / 4); }
		else { channel = 'blue'; amount = 0 - Math.floor(opts.amount / 4); }
		
		for (var idx = 0; idx < 256; idx++) {
			curve.push( Math.min(255, idx + amount) );
		}
		
		delete opts.amount;
		opts[channel] = curve;
		
		return this.curves(opts);
	},
	
	gamma: function(opts) {
		// apply gamma adjustment using curve
		// opts: { amount, channels, clip }
		opts = this.copyHash( opts || {} );
		var curve = [];
		var gamma = opts.amount;
		
		for (var idx = 0; idx < 256; idx++) {
			curve.push( Math.floor( Math.clamp(255 * Math.pow((idx / 255), gamma), 0, 255) ) );
		}
		
		var channels = opts.channels || 'rgb';
		delete opts.channels;
		delete opts.amount;
		
		if (channels.match(/rgb/i)) opts.rgb = curve;
		else {
			if (channels.match(/r/i)) opts.red = curve;
			if (channels.match(/g/i)) opts.green = curve;
			if (channels.match(/b/i)) opts.blue = curve;
		}
		if (channels.match(/a/i)) opts.alpha = curve;
		
		return this.curves(opts);
	},
	
	sepia: function(opts) {
		// generate sepia tone using curves
		// opts: { clip }
		opts = this.copyHash( opts || {} );
		
		var result = this.desaturate();
		if (result.isError) return result;
		
		opts.green = [0, 108, 255];
		opts.blue = [0, 64, 255];
		
		return this.curves(opts);
	},
	
	normalize: function(opts) {
		// normalize (stretch) contrast to expand full range
		// opts: { channels, clip }
		opts = this.copyHash( opts || {} );
		
		var histo = this.histogram();
		if (histo.isError) return result;
		
		// find low and high points
		var lows = { red: 0, green: 0, blue: 0, alpha: 0 };
		var highs = { red: 0, green: 0, blue: 0, alpha: 0 };
		
		for (var idx = 0; idx < 256; idx++) {
			if (histo.red[idx] > 0) highs.red = idx;
			if (histo.green[idx] > 0) highs.green = idx;
			if (histo.blue[idx] > 0) highs.blue = idx;
			if (histo.alpha[idx] > 0) highs.alpha = idx;
		}
		for (var idx = 255; idx >= 0; idx--) {
			if (histo.red[idx] > 0) lows.red = idx;
			if (histo.green[idx] > 0) lows.green = idx;
			if (histo.blue[idx] > 0) lows.blue = idx;
			if (histo.alpha[idx] > 0) lows.alpha = idx;
		}
		
		// create curves
		var channels = opts.channels || 'rgb';
		delete opts.channels;
		
		if (channels.match(/r/i)) opts.red = [];
		if (channels.match(/g/i)) opts.green = [];
		if (channels.match(/b/i)) opts.blue = [];
		if (channels.match(/a/i)) opts.alpha = [];
		
		for (var idx = 0; idx < 256; idx++) {
			if (opts.red) {
				if ((highs.red > lows.red) && (idx >= lows.red) && (idx <= highs.red)) {
					opts.red[idx] = Math.floor( ((idx - lows.red) / (highs.red - lows.red)) * 255 );
				}
				else opts.red[idx] = idx;
			} // red
			
			if (opts.green) {
				if ((highs.green > lows.green) && (idx >= lows.green) && (idx <= highs.green)) {
					opts.green[idx] = Math.floor( ((idx - lows.green) / (highs.green - lows.green)) * 255 );
				}
				else opts.green[idx] = idx;
			} // green
			
			if (opts.blue) {
				if ((highs.blue > lows.blue) && (idx >= lows.blue) && (idx <= highs.blue)) {
					opts.blue[idx] = Math.floor( ((idx - lows.blue) / (highs.blue - lows.blue)) * 255 );
				}
				else opts.blue[idx] = idx;
			} // blue
			
			if (opts.alpha) {
				if ((highs.alpha > lows.alpha) && (idx >= lows.alpha) && (idx <= highs.alpha)) {
					opts.alpha[idx] = Math.floor( ((idx - lows.alpha) / (highs.alpha - lows.alpha)) * 255 );
				}
				else opts.alpha[idx] = idx;
			} // alpha
		}
		
		return this.curves(opts);
	},
	
	threshold: function(opts) {
		// apply threshold effect using sheer cliff curve at specified level
		// opts: { level, channels, clip }
		opts = this.copyHash( opts || {} );
		var level = Math.floor( opts.level || 128 );
		var curve = [];
		
		for (var idx = 0; idx < 256; idx++) {
			curve.push( (idx < level) ? 0 : 255 );
		}
		
		var channels = opts.channels || 'rgb';
		delete opts.channels;
		delete opts.level;
		
		if (channels.match(/rgb/i)) opts.rgb = curve;
		else {
			if (channels.match(/r/i)) opts.red = curve;
			if (channels.match(/g/i)) opts.green = curve;
			if (channels.match(/b/i)) opts.blue = curve;
		}
		if (channels.match(/a/i)) opts.alpha = curve;
		
		return this.curves(opts);
	},
	
	generateCurve: function(points) {
		// Generate curve from points using monotone cubic interpolation.
		// This is somewhat like Adobe Photoshop's 'Curves' filter.
		// Result will be a 1-D array of exactly 256 elements (Y values).
		var xs = [];
		var ys = [];
		var x, y;
		
		// points must have at least two elements
		if (points.length < 2) points = [ [0,0], [255,255] ];
		
		// simple 1D array of Y values = spread X values evenly across full range
		if (typeof(points[0]) == 'number') {
			
			// special case: if user has supplied 256 Y values, well, that's the whole curve
			if (points.length == 256) return points;
			
			// create X/Y pairs
			var new_points = [];
			for (var idx = 0, len = points.length; idx < len; idx++) {
				y = points[idx];
				x = Math.floor( (idx / (len - 1) ) * 255 );
				new_points.push( [ x, y ] );
			}
			points = new_points;
		}
		
		// first point must be at X = 0
		points[0][0] = 0;
		
		// last point must be at X = 255
		points[ points.length - 1 ][0] = 255;
		
		// convert to arrays of axis, for createInterpolant()
		points.forEach( function(pt) {
			xs.push( Math.floor( Math.max(0, Math.min(255, pt[0]))) );
			ys.push( Math.floor( Math.max(0, Math.min(255, pt[1]))) );
		} );
		
		// generate monotonal cubic interpolator function
		var func = createInterpolant(xs, ys);
		var curve = [];
		
		// apply curve to 255 points along X axis
		for (x = 0; x < 256; x++) {
			y = func(x);
			curve.push( Math.floor(y) );
		}
		
		// return Y values
		return curve;
	}
	
}); // class

// From: https://en.wikipedia.org/wiki/Monotone_cubic_interpolation
function createInterpolant(xs, ys) {
	var i, length = xs.length;
	
	// Deal with length issues
	if (length != ys.length) { throw 'Need an equal count of xs and ys.'; }
	if (length === 0) { return function(x) { return 0; }; }
	if (length === 1) {
		// Impl: Precomputing the result prevents problems if ys is mutated later and allows garbage collection of ys
		// Impl: Unary plus properly converts values to numbers
		var result = +ys[0];
		return function(x) { return result; };
	}
	
	// Rearrange xs and ys so that xs is sorted
	var indexes = [];
	for (i = 0; i < length; i++) { indexes.push(i); }
	indexes.sort(function(a, b) { return xs[a] < xs[b] ? -1 : 1; });
	var oldXs = xs, oldYs = ys;
	// Impl: Creating new arrays also prevents problems if the input arrays are mutated later
	xs = []; ys = [];
	// Impl: Unary plus properly converts values to numbers
	for (i = 0; i < length; i++) { xs.push(+oldXs[indexes[i]]); ys.push(+oldYs[indexes[i]]); }
	
	// Get consecutive differences and slopes
	var dys = [], dxs = [], ms = [];
	for (i = 0; i < length - 1; i++) {
		var dx = xs[i + 1] - xs[i], dy = ys[i + 1] - ys[i];
		dxs.push(dx); dys.push(dy); ms.push(dy/dx);
	}
	
	// Get degree-1 coefficients
	var c1s = [ms[0]];
	for (i = 0; i < dxs.length - 1; i++) {
		var m = ms[i], mNext = ms[i + 1];
		if (m*mNext <= 0) {
			c1s.push(0);
		} else {
			var dx_ = dxs[i], dxNext = dxs[i + 1], common = dx_ + dxNext;
			c1s.push(3*common/((common + dxNext)/m + (common + dx_)/mNext));
		}
	}
	c1s.push(ms[ms.length - 1]);
	
	// Get degree-2 and degree-3 coefficients
	var c2s = [], c3s = [];
	for (i = 0; i < c1s.length - 1; i++) {
		var c1 = c1s[i], m_ = ms[i], invDx = 1/dxs[i], common_ = c1 + c1s[i + 1] - m_ - m_;
		c2s.push((m_ - c1 - common_)*invDx); c3s.push(common_*invDx*invDx);
	}
	
	// Return interpolant function
	return function(x) {
		// The rightmost point in the dataset should give an exact result
		var i = xs.length - 1;
		if (x == xs[i]) { return ys[i]; }
		
		// Search for the interval x is in, returning the corresponding y if x is one of the original xs
		var low = 0, mid, high = c3s.length - 1;
		while (low <= high) {
			mid = Math.floor(0.5*(low + high));
			var xHere = xs[mid];
			if (xHere < x) { low = mid + 1; }
			else if (xHere > x) { high = mid - 1; }
			else { return ys[mid]; }
		}
		i = Math.max(0, high);
		
		// Interpolate
		var diff = x - xs[i], diffSq = diff*diff;
		return ys[i] + c1s[i]*diff + c2s[i]*diffSq + c3s[i]*diff*diffSq;
	};
};

},{"pixl-class":85}],12:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Draw Filter Mixin
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	draw: function(opts) {
		// run arbitrary draw commands on canvas
		// special opts: params, commands
		// convenience opts: line, rect, fill, stroke
		var self = this;
		var result;
		this.clearLastError();
		
		result = this.requireRGBA();
		if (result.isError) return result;
		
		if (!opts) {
			return this.doError('opts', "Must specify options object");
		}
		opts = this.copyHash( opts || {} );
		
		// allow for shortcut convenience methods
		if (opts.line) {
			if (!opts.commands) opts.commands = [];
			opts.commands.push(
				['beginPath'],
				['moveTo'].concat( opts.line.slice(0, 2) ),
				['lineTo'].concat( opts.line.slice(2) )
			);
			delete opts.line;
		}
		if (opts.rect) {
			if (!opts.commands) opts.commands = [];
			opts.commands.push( ['rect'].concat( opts.rect ) );
			delete opts.rect;
		}
		if (opts.fill) {
			if (!opts.params) opts.params = {};
			opts.params.fillStyle = opts.fill;
			
			if (!opts.commands) opts.commands = [];
			opts.commands.push( ['fill'] );
			
			delete opts.fill;
		}
		if (opts.stroke) {
			if (!opts.params) opts.params = {};
			opts.params.strokeStyle = opts.stroke;
			
			if (!opts.commands) opts.commands = [];
			opts.commands.push( ['stroke'] );
			
			delete opts.stroke;
		}
		
		// we need at least one command to continue
		if (!opts.commands) {
			return this.doError('opts', "Must specify commands array inside options object");
		}
		
		this.perf.begin('draw');
		this.logDebug(5, "Rendering custom draw commands on canvas", opts);
		
		// prep
		var ctx = this.context;
		ctx.save();
		
		// optionally specify properties to set on context
		// (e.g. fillStyle, strokeStyle, globalCompositeOperation)
		if (opts.params) {
			for (var key in opts.params) { ctx[key] = opts.params[key]; }
		}
		
		// apply all commands
		// e.g. [ ['draw', 50, 50, 100, 100], ['fill'] ]
		opts.commands.forEach( function(args) {
			var name = args.shift();
			self.logDebug(9, "Executing Command: " + name, args);
			ctx[name].apply( ctx, args );
		});
		
		this.perf.end('draw');
		this.logDebug(6, "Draw complete");
		return this;
	}
	
});

},{"pixl-class":85}],13:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Expand Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	expand: function(opts) {
		// expand canvas size using background color (or transparent)
		// specify relative width and/or height (i.e. delta)
		// { width, height, gravity, background }
		var self = this;
		this.clearLastError();
		
		if (!opts || (!opts.width && !opts.height)) {
			return this.doError('expand', "Both width and height were not specified");
		}
		if ((opts.width < 0) || (opts.height < 0)) {
			return this.doError('expand', "Both width and height must not be negative");
		}
		
		opts = this.copyHash( opts || {} );
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.logDebug(5, "Expanding canvas (via FitPad/Shrink resize)", opts);
		
		// expand is a shrink fitpad resize
		opts.resizeMode = 'FitPad';
		opts.resizeDirection = 'Shrink';
		opts.delta = true;
		opts.width = opts.width || 0;
		opts.height = opts.height || 0;
		
		return this.resize(opts);
	}
	
});

},{"pixl-class":85}],14:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Flatten Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	flatten: function(opts) {
		// set alpha channel to fully opaque
		// opts: { background, clip }
		var self = this;
		this.clearLastError();
		
		opts = this.copyHash( opts || {} );
		
		if (opts && opts.background) {
			// use resize for flatten with background
			this.logDebug(6, "Flattening image using FitPad resize + background: " + opts.background);
			opts.width = this.get('width');
			opts.height = this.get('height');
			opts.resizeMode = 'FitPad';
			opts.resizeDirection = 'Shrink';
			
			this.set('alpha', false);
			return this.resize(opts);
		}
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.perf.begin('flatten');
		this.logDebug(6, "Flattening image (setting alpha to opaque)");
		
		var clip = opts.clip || this.getBounds();
		if (!this.isValidRect(clip)) return this.doError('flatten', "Invalid clipping rectangle");
		
		var width = clip.width;
		var height = clip.height;
		var imgData = this.context.getImageData(clip.x, clip.y, width, height);
		var data = imgData.data;
		var offset = 0;
		
		for (var y = 0; y < height; y++) {
			// foreach row
			for (var x = 0; x < width; x++) {
				// for each pixel
				data[ offset + 3 ] = 255;
				offset += 4;
			} // x loop
		} // y loop
		
		this.context.putImageData( imgData, clip.x, clip.y );
		this.set('alpha', false);
		
		this.perf.end('flatten');
		this.logDebug(6, "Image flattening complete");
		return this;
	}
	
});

},{"pixl-class":85}],15:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Hash Filter Mixin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	hash: function() {
		// generate image hash
		var self = this;
		this.clearLastError();
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.perf.begin('hash');
		this.logDebug(6, "Generating image hash");
		
		var width = this.get('width');
		var height = this.get('height');
		var imgData = this.context.getImageData(0, 0, width, height);
		
		var hash = bmvbhash(imgData, 8);
		
		this.perf.end('hash');
		this.logDebug(6, "Hash complete: " + hash);
		return hash;
	},
	
	hammingDistance: function(hash1, hash2) {
		/* Calculate the hamming distance for two hashes in hex format */
		var one_bits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
		var d = 0;
		var i;

		if (hash1.length !== hash2.length) {
			throw new Error("Can't compare hashes with different length");
		}
		
		for (i = 0; i < hash1.length; i++) {
			var n1 = parseInt(hash1[i], 16);
			var n2 = parseInt(hash2[i], 16);
			d += one_bits[n1 ^ n2];
		}
		return d;
	}
	
}); // class

// Perceptual image hash calculation tool based on algorithm descibed in
// Block Mean Value Based Image Perceptual Hashing by Bian Yang, Fan Gu and Xiamu Niu
// Copyright 2014 Commons Machinery http://commonsmachinery.se/
// Distributed under an MIT license, please see LICENSE: 
// https://github.com/commonsmachinery/blockhash-js/blob/master/LICENSE

var median = function(data) {
	var mdarr = data.slice(0);
	mdarr.sort(function(a, b) { return a-b; });
	if (mdarr.length % 2 === 0) {
		return (mdarr[mdarr.length/2 - 1] + mdarr[mdarr.length/2]) / 2.0;
	}
	return mdarr[Math.floor(mdarr.length/2)];
};

var translate_blocks_to_bits = function(blocks, pixels_per_block) {
	var half_block_value = pixels_per_block * 256 * 3 / 2;
	var bandsize = blocks.length / 4;

	// Compare medians across four horizontal bands
	for (var i = 0; i < 4; i++) {
		var m = median(blocks.slice(i * bandsize, (i + 1) * bandsize));
		for (var j = i * bandsize; j < (i + 1) * bandsize; j++) {
			var v = blocks[j];

			// Output a 1 if the block is brighter than the median.
			// With images dominated by black or white, the median may
			// end up being 0 or the max value, and thus having a lot
			// of blocks of value equal to the median.  To avoid
			// generating hashes of all zeros or ones, in that case output
			// 0 if the median is in the lower value space, 1 otherwise
			blocks[j] = Number(v > m || (Math.abs(v - m) < 1 && m > half_block_value));
		}
	}
};

var bits_to_hexhash = function(bitsArray) {
	var hex = [];
	for (var i = 0; i < bitsArray.length; i += 4) {
		var nibble = bitsArray.slice(i, i + 4);
		hex.push(parseInt(nibble.join(''), 2).toString(16));
	}

	return hex.join('');
};

var bmvbhash_even = function(data, bits) {
	var blocksize_x = Math.floor(data.width / bits);
	var blocksize_y = Math.floor(data.height / bits);

	var result = [];

	for (var y = 0; y < bits; y++) {
		for (var x = 0; x < bits; x++) {
			var total = 0;

			for (var iy = 0; iy < blocksize_y; iy++) {
				for (var ix = 0; ix < blocksize_x; ix++) {
					var cx = x * blocksize_x + ix;
					var cy = y * blocksize_y + iy;
					var ii = (cy * data.width + cx) * 4;

					var alpha = data.data[ii+3];
					if (alpha === 0) {
						total += 765;
					} else {
						total += data.data[ii] + data.data[ii+1] + data.data[ii+2];
					}
				}
			}

			result.push(total);
		}
	}

	translate_blocks_to_bits(result, blocksize_x * blocksize_y);
	return bits_to_hexhash(result);
};

var bmvbhash = function(data, bits) {
	var result = [];

	var i, j, x, y;
	var block_width, block_height;
	var weight_top, weight_bottom, weight_left, weight_right;
	var block_top, block_bottom, block_left, block_right;
	var y_mod, y_frac, y_int;
	var x_mod, x_frac, x_int;
	var blocks = [];

	var even_x = data.width % bits === 0;
	var even_y = data.height % bits === 0;

	if (even_x && even_y) {
		return bmvbhash_even(data, bits);
	}

	// initialize blocks array with 0s
	for (i = 0; i < bits; i++) {
		blocks.push([]);
		for (j = 0; j < bits; j++) {
			blocks[i].push(0);
		}
	}

	block_width = data.width / bits;
	block_height = data.height / bits;

	for (y = 0; y < data.height; y++) {
		if (even_y) {
			// don't bother dividing y, if the size evenly divides by bits
			block_top = block_bottom = Math.floor(y / block_height);
			weight_top = 1;
			weight_bottom = 0;
		} else {
			y_mod = (y + 1) % block_height;
			y_frac = y_mod - Math.floor(y_mod);
			y_int = y_mod - y_frac;

			weight_top = (1 - y_frac);
			weight_bottom = (y_frac);

			// y_int will be 0 on bottom/right borders and on block boundaries
			if (y_int > 0 || (y + 1) === data.height) {
				block_top = block_bottom = Math.floor(y / block_height);
			} else {
				block_top = Math.floor(y / block_height);
				block_bottom = Math.ceil(y / block_height);
			}
		}

		for (x = 0; x < data.width; x++) {
			var ii = (y * data.width + x) * 4;

			var avgvalue, alpha = data.data[ii+3];
			if (alpha === 0) {
				avgvalue = 765;
			} else {
				avgvalue = data.data[ii] + data.data[ii+1] + data.data[ii+2];
			}

			if (even_x) {
				block_left = block_right = Math.floor(x / block_width);
				weight_left = 1;
				weight_right = 0;
			} else {
				x_mod = (x + 1) % block_width;
				x_frac = x_mod - Math.floor(x_mod);
				x_int = x_mod - x_frac;

				weight_left = (1 - x_frac);
				weight_right = x_frac;

				// x_int will be 0 on bottom/right borders and on block boundaries
				if (x_int > 0 || (x + 1) === data.width) {
					block_left = block_right = Math.floor(x / block_width);
				} else {
					block_left = Math.floor(x / block_width);
					block_right = Math.ceil(x / block_width);
				}
			}

			// add weighted pixel value to relevant blocks
			blocks[block_top][block_left] += avgvalue * weight_top * weight_left;
			blocks[block_top][block_right] += avgvalue * weight_top * weight_right;
			blocks[block_bottom][block_left] += avgvalue * weight_bottom * weight_left;
			blocks[block_bottom][block_right] += avgvalue * weight_bottom * weight_right;
		}
	}

	for (i = 0; i < bits; i++) {
		for (j = 0; j < bits; j++) {
			result.push(blocks[i][j]);
		}
	}

	translate_blocks_to_bits(result, block_width * block_height);
	return bits_to_hexhash(result);
};

},{"pixl-class":85}],16:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Histogram Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	histogram: function() {
		// generate histogram data
		var self = this;
		this.clearLastError();
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.perf.begin('histogram');
		this.logDebug(6, "Generating histogram");
		
		var width = this.get('width');
		var height = this.get('height');
		var imgData = this.context.getImageData(0, 0, width, height);
		var data = imgData.data;
		var offset = 0;
		var histo = { red: [], green: [], blue: [], alpha: [] };
		
		for (var idx = 0; idx < 256; idx++) {
			histo.red.push(0);
			histo.green.push(0);
			histo.blue.push(0);
			histo.alpha.push(0);
		}
		
		for (var y = 0; y < height; y++) {
			// foreach row
			for (var x = 0; x < width; x++) {
				// for each pixel
				if (data[ offset + 3 ]) {
					histo.red[ data[ offset + 0 ] ]++;
					histo.green[ data[ offset + 1 ] ]++;
					histo.blue[ data[ offset + 2 ] ]++;
					histo.alpha[ data[ offset + 3 ] ]++;
				}
				offset += 4;
			} // x loop
		} // y loop
		
		// calc maximums
		histo.redMax = Math.max.apply(null, histo.red);
		histo.greenMax = Math.max.apply(null, histo.green);
		histo.blueMax = Math.max.apply(null, histo.blue);
		histo.alphaMax = Math.max.apply(null, histo.alpha);
		
		this.perf.end('histogram');
		this.logDebug(6, "Histogram complete");
		return histo;
	}
	
});

},{"pixl-class":85}],17:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Opacity Filter Mixin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	opacity: function(opts) {
		// fade canvas out to transparent or background color
		// specify opacity from 0 to 1, and optional background color
		// { opacity, background }
		var self = this;
		this.clearLastError();
		
		if (typeof(opts) == 'number') {
			opts = { opacity: opts };
		}
		if (!opts || !("opacity" in opts)) {
			return this.doError('opacity', "Opacity was not specified");
		}
		
		opts = this.copyHash( opts || {} );
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.logDebug(5, "Fading canvas (via FitPad/Shrink resize)", opts);
		
		// use shrink fitpad resize
		opts.resizeMode = 'FitPad';
		opts.resizeDirection = 'Shrink';
		opts.width = this.width();
		opts.height = this.height();
		
		return this.resize(opts);
	}
	
});

},{"pixl-class":85}],18:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Quantize Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var iq = require("image-q");

module.exports = Class.create({
	
	quantize: function(opts) {
		// quantize RGBA or RGB to 8-bit with palette
		// { colors, dither, ditherType }
		var self = this;
		this.clearLastError();
		
		opts = this.copyHash( opts || {} );
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.perf.begin('quantize');
		
		// import settings into opts
		opts = this.applySettings(opts);
		
		var width = this.get('width');
		var height = this.get('height');
		var num_pixels = width * height;
		
		this.logDebug(6, "Quantizing image", { colors: opts.colors, dither: opts.dither, width: width, height: height, pixels: num_pixels } );
		
		// get rgba pixels from canvas
		var imgData = this.context.getImageData(0, 0, width, height);
		
		// desired colors number
		var targetColors = parseInt( opts.colors || 0 );
		
		if (!targetColors || isNaN(targetColors) || (targetColors < 2) || (targetColors > 256)) {
			return this.doError('quantize', "Invalid palette size: " + targetColors);
		}
		
		// create pointContainer and fill it with image
		var pointContainer = iq.utils.PointContainer.fromImageData( imgData );
		
		// create chosen distance calculator (see classes inherited from `iq.distance.AbstractDistanceCalculator`)
		var distanceCalculator = opts.alpha ? 
			(new iq.distance.EuclideanRgbQuantWithAlpha()) : 
			(new iq.distance.EuclideanRgbQuantWOAlpha());
		
		// create chosen palette quantizer (see classes implementing `iq.palette.IPaletteQuantizer`) 
		var paletteQuantizer = new iq.palette[opts.quantizer](distanceCalculator, targetColors);
		
		// feed out pointContainer filled with image to paletteQuantizer
		paletteQuantizer.sample(pointContainer);

		// generate palette
		var palette = paletteQuantizer.quantize();

		// get color array
		var iq_colors = palette.getPointContainer().getPointArray();
		
		// create image quantizer (see classes implementing `iq.image.IImageDitherer`)
		var imageDitherer = opts.dither ? 
			(new iq.image.ErrorDiffusionArray(distanceCalculator, iq.image.ErrorDiffusionArrayKernel[opts.ditherType])) : 
			(new iq.image.NearestColor(distanceCalculator));
		
		// apply palette to image
		var resultPointContainer = imageDitherer.quantize(pointContainer, palette);

		// get pixel array
		var iq_pixels = resultPointContainer.getPointArray();
		
		// convert pixels to array of palette indexes
		var palette_offset = 0;
		var palette_data = new Uint8Array( iq_colors.length * 3 );
		var color_hash = {};
		var iq_color = null;
		
		// build palette structure and color hash table
		for (var idx = 0, len = iq_colors.length; idx < len; idx++) {
			iq_color = iq_colors[idx];
			color_hash[ iq_color.uint32 ] = idx;
		}
		
		// next, build pixel array
		var pixel_offset = 0;
		var pixel_data = new Uint8Array( width * height );
		
		for (var y = 0, ymax = height; y < ymax; y++) {
			// foreach row
			for (var x = 0, xmax = width; x < xmax; x++) {
				// for each pixel
				var iq_pixel = iq_pixels[ pixel_offset ];
				var color_idx = color_hash[ iq_pixel.uint32 ];
				
				pixel_data[ pixel_offset++ ] = color_idx;
			} // x loop
		} // y loop
		
		// pixels = Uint8Array of raw palette indexes
		// palette = array of objects: { r, g, b, a, uint32 }
		this.pixels = pixel_data;
		this.palette = iq_colors;
		
		this.set('mode', 'indexed');
		this.perf.end('quantize');
		this.logDebug(6, "Image quantization complete", { num_colors: iq_colors.length });
		return this;
	},
	
	quantizeFast: function(opts) {
		// Quantize RGBA or RGB to 8-bit with auto-generated palette as fast as possible.
		// Uses all unique colors, but can crush (reduce) alpha and/or RGB, plus dithering.
		// QuantizeFast algorithm is (c) 2017 - 2018 by Joseph Huckaby, MIT License
		// opts: { crushRGB, crushAlpha, dither, colors }
		var self = this;
		this.clearLastError();
		
		opts = this.copyHash( opts || {} );
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		// import settings into opts
		opts = this.applySettings(opts);
		
		var width = this.get('width');
		var height = this.get('height');
		var num_pixels = width * height;
		var crush_alpha = ('crushAlpha' in opts) ? opts.crushAlpha : 16;
		var crush_rgb = ('crushRGB' in opts) ? opts.crushRGB : 16;
		var dither = opts.dither || false;
		var targetColors = parseInt( opts.colors || 256 );
		
		this.perf.begin('quantizeFast');
		this.logDebug(6, "Quantizing image fast", { width: width, height: height, pixels: num_pixels, crushRGB: crush_rgb, crushAlpha: crush_alpha, dither: dither } );
		
		// opts.crush(Alpha|RGB) = desired number of stair-step levels
		// convert to modulo reduction value (e.g. 32 colors = reduce modulo 8)
		if (crush_alpha) crush_alpha = Math.floor( 256 / crush_alpha );
		if (crush_rgb) crush_rgb = Math.floor( 256 / crush_rgb );
		
		// set up 4x4 pattern dither
		var dither4x4 = [0.0625, 0.5625, 0.1875, 0.6875, 0.8125, 0.3125, 0.9375, 0.4375, 0.25, 0.75, 0.125, 0.625, 1.0, 0.5, 0.875, 0.375];
		
		// get rgba pixels from canvas
		var imgData = this.context.getImageData(0, 0, width, height);
		
		// build palette of all unique colors
		var done = false;
		var source_data = imgData.data;
		var pixel_data = new Uint8Array( width * height );
		var pixel = 0;
		var red, green, blue, alpha;
		var dmod, doffset;
		
		while (!done) {
			var unique_colors = {};
			var palette_offset = 0;
			var palette = [];
			var pixel_offset = 0;
			var idx = 0;
			
			for (var y = 0, ymax = height; y < ymax; y++) {
				for (var x = 0, xmax = width; x < xmax; x++) {
					
					red = source_data[pixel_offset + 0];
					green = source_data[pixel_offset + 1];
					blue = source_data[pixel_offset + 2];
					alpha = source_data[pixel_offset + 3];
					
					if (crush_rgb) {
						if (dither) {
							doffset = ((y % 4) * 4) + (x % 4);
							
							dmod = (red % crush_rgb);
							red -= dmod;
							if (dmod / crush_rgb >= dither4x4[doffset]) red = Math.min(255, red + crush_rgb);
							
							dmod = (green % crush_rgb);
							green -= dmod;
							if (dmod / crush_rgb >= dither4x4[doffset]) green = Math.min(255, green + crush_rgb);
							
							dmod = (blue % crush_rgb);
							blue -= dmod;
							if (dmod / crush_rgb >= dither4x4[doffset]) blue = Math.min(255, blue + crush_rgb);
						}
						else {
							dmod = (red % crush_rgb);
							red -= dmod;
							if (dmod / crush_rgb >= 0.5) red = Math.min(255, red + crush_rgb);
							
							dmod = (green % crush_rgb);
							green -= dmod;
							if (dmod / crush_rgb >= 0.5) green = Math.min(255, green + crush_rgb);
							
							dmod = (blue % crush_rgb);
							blue -= dmod;
							if (dmod / crush_rgb >= 0.5) blue = Math.min(255, blue + crush_rgb);
						}
					}
					if (crush_alpha && (alpha < 255)) {
						alpha = alpha - (alpha % crush_alpha);
					}
					
					pixel = ((red << 8 | green) << 8 | blue) << 8 | alpha;
					
					if (!(pixel in unique_colors)) {
						if (palette_offset < targetColors) {
							unique_colors[pixel] = palette_offset;
							palette[palette_offset++] = {
								r: red, g: green, b: blue, a: alpha, uint32: pixel
							};
						}
						else {
							// this.logDebug(3, "Aborting loop at " + x + ' x ' + y);
							x = xmax;
							y = ymax;
							palette_offset = 99999;
							continue;
						}
					}
					pixel_data[idx] = unique_colors[pixel];
					pixel_offset += 4;
					idx++;
				} // x loop
			} // y loop
			
			if (palette_offset <= targetColors) {
				// we got it!
				done = true;
			}
			else {
				// nope, try again with more crushing power
				crush_rgb = Math.floor( crush_rgb + (crush_rgb * 0.2) );
				crush_alpha = Math.floor( crush_alpha + (crush_alpha * 0.2) );
				this.logDebug(3, "Palette grew beyond target size of " + targetColors + ", trying again with crush " + crush_rgb + '/' + crush_alpha );
				
				if (Math.max(crush_rgb, crush_alpha) > 256) {
					this.perf.end('quantizeFast');
					return this.doError('quantize', "Cannot reach the desired palette size with current settings.");
				}
			}
		} // not done
		
		// pixels = Uint8Array of raw palette indexes
		// palette = array of objects: { r, g, b, a, uint32 }
		this.pixels = pixel_data;
		this.palette = palette;
		
		this.set('mode', 'indexed');
		this.perf.end('quantizeFast');
		this.logDebug(6, "Fast image quantization complete", { num_colors: palette.length });
		return this;
	}
	
});

},{"image-q":45,"pixl-class":85}],19:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Resize Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	resize: function(opts) {
		// resize image
		// { width, height, mode, background, direction, antialias, gravity, offsetX, offsetY, delta }
		var self = this;
		var result;
		this.clearLastError();
		
		// convert back to RGBA if indexed
		if (this.get('mode') == 'indexed') {
			result = this.render();
			if (result.isError) return result;
		}
		
		// if image requires EXIF orientation correction, must do that first
		if (this.get('autoOrient') && this.image && !this.canvas && this.exif && this.exif.Orientation && (this.exif.Orientation > 1)) {
			result = this.render();
			if (result.isError) return result;
		} // auto-orient
		
		if (!this.canvas && !this.image) {
			return this.doError('resize', "No image to resize");
		}
		if (!opts || (!opts.width && !opts.height)) {
			return this.doError('resize', "Both width and height were not specified");
		}
		
		opts = this.copyHash( opts || {} );
		
		this.perf.begin('resize');
		
		// allow 'mode' to be passed in, but rename it to 'resizeMode'
		if (opts && opts.mode) {
			opts.resizeMode = opts.mode;
			delete opts.mode;
		}
		
		// allow 'direction' to be passed in, but rename it to 'resizeDirection'
		if (opts && opts.direction) {
			opts.resizeDirection = opts.direction;
			delete opts.direction;
		}
		
		var orig_width = this.get('width');
		var orig_height = this.get('height');
		
		// if width or height are missing, set to 0 so they aren't overwritten in applySettings
		if (!opts.width) opts.width = 0;
		if (!opts.height) opts.height = 0;
		
		// allow width and/or height to be percentage strings
		if ((typeof(opts.width) == 'string') && opts.width.match(/([\d\.]+)\%/)) {
			var pct = parseFloat( RegExp.$1 );
			opts.width = Math.floor( orig_width * (pct / 100) );
		}
		if ((typeof(opts.height) == 'string') && opts.height.match(/([\d\.]+)\%/)) {
			var pct = parseFloat( RegExp.$1 );
			opts.height = Math.floor( orig_height * (pct / 100) );
		}
		
		// import settings into opts
		opts = this.applySettings(opts);
		
		// support delta
		if (opts.delta) {
			opts.width = (opts.width || 0) + orig_width;
			opts.height = (opts.height || 0) + orig_height;
		}
		
		// extrapolate width or height if missing, maintaining aspect ratio
		var target_width = opts.width || Math.floor( orig_width * (target_height / orig_height) );
		var target_height = opts.height || Math.floor( orig_height * (target_width / orig_width) );
		
		target_width = Math.max(1, Math.floor(target_width));
		target_height = Math.max(1, Math.floor(target_height));
		
		// calculate final destination width/height preserving aspect ratio
		var ratios = [ target_width / orig_width, target_height / orig_height ];
		var mode = opts.resizeMode;
		var rfunc = mode.match(/(fitover|cover)/i) ? Math.max : Math.min;
		var ratio = rfunc.apply( Math, ratios );
		
		var dir = opts.resizeDirection;
		if (dir.match(/shrink/i)) ratio = Math.min( 1.0, ratio );
		else if (dir.match(/enlarge/i)) ratio = Math.max( 1.0, ratio );
		
		var dest_width = Math.max(1, Math.floor( orig_width * ratio ));
		var dest_height = Math.max(1, Math.floor( orig_height * ratio ));
		
		// special scale mode = ignore aspect ratio (distort)
		// direction is ignored in this mode
		if (mode.match(/(scale|exact)/i)) {
			dest_width = target_width;
			dest_height = target_height;
		}
		
		// calculate new canvas size
		var canvas_width = opts.width = mode.match(/(fitpad|letterbox|fitover|cover)/i) ? target_width : dest_width;
		var canvas_height = opts.height = mode.match(/(fitpad|letterbox|fitover|cover)/i) ? target_height : dest_height;
		
		// calculate image draw position based on gravity
		var dx = opts.offsetX || 0;
		var dy = opts.offsetY || 0;
		var gravity = opts.gravity;
		var x = 0;
		var y = 0;
		
		if (gravity.match(/(west|left)/i)) x = 0 + dx;
		else if (gravity.match(/(east|right)/i)) x = (canvas_width - dest_width) - dx;
		else x = Math.floor( (canvas_width / 2) - (dest_width / 2) ) + dx;
		
		if (gravity.match(/(north|top)/i)) y = 0 + dy;
		else if (gravity.match(/(south|bottom)/i)) y = (canvas_height - dest_height) - dy;
		else y = Math.floor( (canvas_height / 2) - (dest_height / 2) ) + dy;
		
		this.logDebug(6, "Resizing image to target size: " + target_width + 'x' + target_height, {
			mode: mode,
			gravity: gravity,
			background: opts.background,
			orig_width: orig_width,
			orig_height: orig_height,
			target_width: target_width,
			target_height: target_height,
			dest_width: dest_width,
			dest_height: dest_height,
			canvas_width: canvas_width,
			canvas_height: canvas_height,
			x: x,
			y: y
		});
		
		// source can be image or canvas
		var source_image = this.image || this.canvas;
		delete this.image;
		
		// create new canvas to resize onto
		result = this.create({ width: opts.width, height: opts.height, background: opts.background });
		if (result.isError) {
			this.perf.end('resize');
			return result;
		}
		
		// save state, so resize can temporarily alter things like patternQuality
		this.context.save();
		
		// copy over all canvas props
		for (var key in this.canvasSettingsKeys) {
			this.context[key] = opts[key];
		}
		
		if (opts.opacity < 1) {
			this.context.globalAlpha = opts.opacity;
		}
		if (opts.compositeMode) {
			this.context.globalCompositeOperation = opts.compositeMode;
		}
		
		// apply antialias if specified
		if (opts.antialias) {
			this.applyAntialias( opts.antialias );
		}
		
		// perform the actual draw
		this.context.drawImage(source_image, x, y, dest_width, dest_height);
		
		// restore original state
		this.context.restore();
		
		this.perf.end('resize');
		this.logDebug(6, "Image resize complete");
		return this;
	}
	
});

},{"pixl-class":85}],20:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Text Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var width_cache = {};

var measureWidthCache = function(ctx, text, kerning) {
	// only call measureText() for unique strings, bake in kerning too
	if (!kerning) kerning = 0;
	if (width_cache[text]) return width_cache[text];
	var info = ctx.measureText(text);
	width_cache[text] = info.width + (kerning * text.length);
	return width_cache[text];
};

module.exports = Class.create({
	
	text: function(opts) {
		// render text onto canvas
		// { text, font, size, color, gravity, overflow, marginX, marginY, offsetX, offsetY, characterSpacing, lineSpacing, shadowColor, shadowOffsetX, shadowOffsetY, shadowBlur, outlineColor, outlineThickness, outlineStyle, opacity, autoCrop, background, maxWidth, maxHeight, shrinkWrapPrecision, fontStyle, fontWeight, mode }
		var self = this;
		this.clearLastError();
		
		// must reset width cache for every call to text()
		width_cache = {};
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		if (!opts) {
			return this.doError('text', "No options passed to text");
		}
		if (!opts.text) {
			return this.doError('text', "Missing text to render");
		}
		if (!opts.font) {
			return this.doError('text', "Missing font to render text");
		}
		if (!opts.size) {
			return this.doError('text', "Missing size to render text");
		}
		if (!opts.color) {
			return this.doError('text', "Missing color to render text");
		}
		if (!opts.text.match(/\S/)) {
			this.logDebug(3, "Text is all whitespace, skipping render");
			return this;
		}
		
		opts = this.copyHash( opts || {} );
		
		if ('margin' in opts) {
			opts.marginX = opts.marginY = opts.margin;
			delete opts.margin;
		}
		if ('characterSpacing' in opts) {
			opts.kerning = opts.characterSpacing;
			delete opts.characterSpacing;
		}
		// allow 'mode' to be passed in, but rename it to 'compositeMode'
		if (opts && opts.mode) {
			opts.compositeMode = opts.mode;
			delete opts.mode;
		}
		
		this.perf.begin('text');
		this.logDebug(6, "Rendering text", opts);
		
		// import settings into opts
		opts = this.applySettings(opts);
		
		if (!opts.font) {
			return this.doError('text', "No font specified");
		}
		
		var ctx = this.context;
		var width = this.get('width');
		var height = this.get('height');
		var font_family = this.getFontID( opts.font );
		var font_spec = opts.fontStyle + ' ' + opts.fontWeight + ' ' + opts.size + 'px "' + font_family + '"';
		
		ctx.save();
		ctx.font = font_spec;
		this.logDebug(9, "Canvas Font Spec: " + font_spec);
		
		ctx.textAlign = 'left';
		ctx.textBaseline = 'hanging';
		
		if (opts.shadowColor) {
			ctx.shadowColor = opts.shadowColor;
			ctx.shadowOffsetX = opts.shadowOffsetX || 0;
			ctx.shadowOffsetY = opts.shadowOffsetY || 0;
			ctx.shadowBlur = opts.shadowBlur || 0;
		}
		if (opts.outlineColor) {
			ctx.strokeStyle = opts.outlineColor;
			ctx.lineWidth = opts.outlineThickness * 2;
			ctx.lineJoin = opts.outlineStyle;
		}
		
		if (opts.opacity < 1) {
			ctx.globalAlpha = opts.opacity;
		}
		if (opts.compositeMode) {
			ctx.globalCompositeOperation = opts.compositeMode;
		}
		
		// measure one character for line height
		var info = ctx.measureText('M');
		if (!info.emHeightDescent && this.measureTextHeight) {
			// hack to measure height (browser-only)
			info.emHeightDescent = this.measureTextHeight(ctx.font);
		}
		if (!info.emHeightDescent) {
			ctx.restore();
			this.perf.end('text');
			return this.doError('text', "Could not measure font height");
		}
		var line_height = info.emHeightDescent + opts.lineSpacing;
		var kerning = opts.kerning;
		var overflow = opts.overflow || '';
		var lines = [];
		
		var dx = opts.offsetX || 0;
		var dy = opts.offsetY || 0;
		var mx = opts.marginX || 0;
		var my = opts.marginY || 0;
		var avail_width = opts.maxWidth || (width - (mx * 2));
		var avail_height = opts.maxHeight || (height - (my * 2));
		
		// sanity check here, avail_width and avail_height must both be > 0
		if ((avail_width < 1) || (avail_height < 1)) {
			ctx.restore();
			this.perf.end('text');
			return this.doError('text', "No available space to render text (check margins)");
		}
		
		// word wrap here
		if (overflow.match(/wrap/i)) {
			lines = this.wordWrapText(opts.text, avail_width, opts);
			if (lines === false) {
				ctx.restore();
				this.perf.end('text');
				return this.doError('text', "No available space to wrap text (check margins)");
			}
			
			if (overflow.match(/shrink/i)) {
				// re-wrap while shrinking to fit entire paragraph into image box
				var temp_avail_width = avail_width;
				var temp_avail_height = avail_height;
				var sw_precision = opts.shrinkWrapPrecision || 4;
				var attempts = 256;
				
				while (lines.length * line_height > temp_avail_height) {
					temp_avail_width += sw_precision;
					temp_avail_height += (sw_precision * (avail_height / avail_width));
					lines = this.wordWrapText(opts.text, temp_avail_width, opts);
					if (lines === false) {
						ctx.restore();
						this.perf.end('text');
						return this.doError('text', "No available space to shrink-wrap text (check margins)");
					}
					
					if (--attempts < 0) {
						// emergency brake, to prevent infinite loop
						ctx.restore();
						this.perf.end('text');
						return this.doError('text', "Insufficient available space to shrink-wrap text (check margins)");
					}
				}
			} // shrink-wrap
		}
		else {
			// standard flow (no wrap)
			lines = opts.text.trim().replace(/\r\n/g, "\n").split(/\n/);
		}
		
		// precalc line widths, adjust for kerning
		var line_widths = [];
		var longest_line_width = 0;
		for (var idx = 0, len = lines.length; idx < len; idx++) {
			var line = lines[idx];
			var line_width = measureWidthCache(ctx, line, kerning);
			line_widths[idx] = line_width;
			if (line_width > longest_line_width) longest_line_width = line_width;
		} // foreach line
		
		var text_width = longest_line_width;
		var text_height = lines.length * line_height;
		var gravity = opts.gravity;
		
		// define inline function for performing the actual rendering
		var renderText = function(ctx, width, height, mx, my, dx, dy) {
			var x = 0;
			var y = 0;
			
			if (gravity.match(/(north|top)/i)) y = 0 + my + dy;
			else if (gravity.match(/(south|bottom)/i)) y = ((height - my) - text_height) - dy;
			else y = ((height / 2) - (text_height / 2)) + dy;
			
			if (opts.background) {
				if (gravity.match(/(west|left)/i)) x = 0 + mx + dx;
				else if (gravity.match(/(east|right)/i)) x = ((width - mx) - text_width) - dx;
				else x = ((width / 2) - (text_width / 2)) + dx;
				
				ctx.fillStyle = opts.background;
				ctx.fillRect( x, y, text_width, text_height );
			}
			ctx.fillStyle = opts.color;
			
			// adjust for safari canvas line height issue (ughhhh)
			if (self.browser && self.userAgent.match(/Safari/) && !self.userAgent.match(/Chrome/)) {
				y -= ((line_height * 1.15) - line_height);
			}
			
			for (var idx = 0, len = lines.length; idx < len; idx++) {
				var line = lines[idx];
				var chars = line.split('');
				var line_width = line_widths[idx];
				
				if (gravity.match(/(west|left)/i)) x = 0 + mx + dx;
				else if (gravity.match(/(east|right)/i)) x = ((width - mx) - line_width) - dx;
				else x = ((width / 2) - (line_width / 2)) + dx;
				
				for (var idy = 0, ley = chars.length; idy < ley; idy++) {
					var ch = chars[idy];
					var ch_width = measureWidthCache(ctx, ch, kerning);
					
					if (ch.match(/\S/)) {
						if (opts.outlineColor) ctx.strokeText(ch, x, y);
						ctx.fillText(ch, x, y);
					}
					x += ch_width;
				} // foreach char
				
				y += line_height;
			} // foreach line
		}; // renderText()
		
		// see if we need to autoscale here
		var rendered = false;
		
		if (overflow.match(/shrink/i)) {
			var scale_factor_x = avail_width / text_width;
			var scale_factor_y = avail_height / text_height;
			var scale_factor = Math.min( scale_factor_x, scale_factor_y );
			
			this.logDebug(9, "Autoscale calculation", {
				avail_width: avail_width,
				avail_height: avail_height,
				text_width: text_width,
				text_height: text_height,
				scale_factor_x: scale_factor_x,
				scale_factor_y: scale_factor_y,
				scale_factor: scale_factor
			});
			
			if (scale_factor < 1.0) {
				// Scale using canvas math (only works accurately in browser, or with pango).
				// Now the standard method with node-canvas 2.0+
				ctx.scale( scale_factor, scale_factor );
				
				renderText(
					ctx, 
					width / scale_factor, 
					height / scale_factor, 
					mx / scale_factor, 
					my / scale_factor, 
					dx / scale_factor, 
					dy / scale_factor 
				);
				
				text_width = text_width * scale_factor;
				text_height = text_height * scale_factor;
				rendered = true;
			} // need shrink
		} // autoshrink
		
		// perform actual rendering
		if (!rendered) renderText( ctx, width, height, mx, my, dx, dy );
		
		ctx.restore();
		this.perf.end('text');
		
		// auto-crop to actual text size
		if (opts.autoCrop) {
			var cx = Math.floor( (width / 2) - (text_width / 2) );
			var cy = Math.floor( (height / 2) - (text_height / 2) );
			var acwidth = width;
			var acheight = height;
			
			if (opts.autoCrop.match(/horiz|both|all/i)) {
				acwidth = Math.floor( text_width + (mx * 2) );
			}
			if (opts.autoCrop.match(/vert|both|all/i)) {
				acheight = Math.floor( text_height + (my * 2) );
			}
			if (gravity.match(/(east|right)/i)) cx = width - acwidth;
			else if (gravity.match(/(south|bottom)/i)) cy = height - acheight;
			
			if ((acwidth < width) || (acheight < height)) {
				this.crop({
					width: acwidth,
					height: acheight,
					x: cx,
					y: cy
				});
			}
		} // auto-crop
		
		this.logDebug(6, "Text rendering complete");
		return this;
	},
	
	wordWrapText: function(text, avail_width, opts) {
		// word wrap text, leaning heavily on Context2D.measureText()
		var lines = text.trim().replace(/\r\n/g, "\n").split(/\n/);
		var ctx = this.context;
		var kerning = opts.kerning;
		
		// foreach line
		for (var idx = 0; idx < lines.length; idx++) {
			var line = lines[idx].replace(/\t/g, opts.tabSpaces || "    ").replace(/\s/g, ' ');
			var full_line_width = measureWidthCache(ctx, line, kerning);
			
			if (full_line_width > avail_width) {
				// line is too long, must break up words
				var words = line.split(/\s/);
				var prefix = '';
				var line_width = 0;
				var line_text = '';
				
				// foreach word
				for (idy = 0, ley = words.length; idy < ley; idy++) {
					var word = words[idy];
					if (word.length) {
						var full_word = prefix + word;
						var word_width = measureWidthCache(ctx, full_word, kerning);
						
						if (line_width + word_width > avail_width) {
							// word does not fit
							if (idy == 0) {
								// first word doesn't fit, we have to chop it up
								var temp_width = 0;
								var temp_text = '';
								
								// foreach character in word
								for (var idz = 0, lez = word.length; idz < lez; idz++) {
									var ch = word[idz];
									var ch_width = measureWidthCache(ctx, ch, kerning);
									if (temp_width + ch_width > avail_width) {
										// sanity check
										if (!idz) return false; // abort -- single character does not fit on line
										
										// chop at this point
										lines[idx] = temp_text;
										
										var append_text = word.substring(idz);
										if (idy < words.length - 1) append_text += ' ' + words.slice(idy + 1).join(' ');
										lines.splice( idx + 1, 0, append_text );
										
										// drop out of inner loop
										idz = lez;
									}
									else {
										// character fits, append and continue
										temp_width += ch_width;
										temp_text += ch;
									}
								} // foreach character
							} // first word on line
							else {
								// reset current line to contain only words up to this point
								lines[idx] = line_text;
								
								// shove remaining words onto next line (may extend array)
								lines.splice( idx + 1, 0, words.slice(idy).join(' ') );
							}
							
							// drop out of inner word loop
							idy = ley;
						} // word doesn't fit
						else {
							// word fits nicely, append and continue
							line_width += word_width;
							line_text += full_word;
							prefix = ' ';
						}
					} // word has length
					else {
						// extra space
						prefix += ' ';
					}
				} // foreach word
			} // line too wide
		} // foreach line
		
		return lines;
	}
	
});

},{"pixl-class":85}],21:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Transform Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	transform: function(opts) {
		// transform image using geometry
		// { rotate, fliph, flipv, matrix, antialias }
		var self = this;
		this.clearLastError();
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		if (!opts) {
			return this.doError('render', "No options passed to transform");
		}
		
		opts = this.copyHash( opts || {} );
		
		this.perf.begin('transform');
		this.logDebug(6, "Transforming image", opts);
		
		var ctx = this.context;
		var width = this.get('width');
		var height = this.get('height');
		
		// clone and clear
		var clone = this.clone();
		
		if (opts.rotate) {
			if (opts.rotate < 0) opts.rotate += 360;
			opts.rotate = opts.rotate % 360;
		}
		
		if (opts.rotate && !opts.fixed) {
			if ((opts.rotate == 90) || (opts.rotate == 180) || (opts.rotate == 270)) {
				// image is 90, 180 or 270 degrees, need to swap width/height
				if ((opts.rotate == 90) || (opts.rotate == 270)) {
					this.logDebug(5, "Swapping width/height for rotate " + opts.rotate);
					var temp = this.get('width');
					this.set('width', this.get('height'));
					this.set('height', temp);
				}
				
				// recreate canvas at new size
				this.create(opts);
				ctx = this.context;
				ctx.save();
				
				switch (opts.rotate) {
					case 90: ctx.transform(0, 1, -1, 0, height , 0); break;
					case 180: ctx.transform(-1, 0, 0, -1, width, height); break;
					case 270: ctx.transform(0, -1, 1, 0, 0, width); break;
				}
			}
			else {
				// tricky non-right-angle resize
				var rads = opts.rotate * Math.PI / 180;
				var c = Math.cos(rads);
				var s = Math.sin(rads);
				if (s < 0) { s = -s; }
				if (c < 0) { c = -c; }
				
				this.set('width', Math.ceil( (height * s) + (width * c) ));
				this.set('height', Math.ceil( (height * c) + (width * s) ));
				
				this.logDebug(5, "Setting new width/height for rotate " + opts.rotate + ": " + this.width() + 'x' + this.height());
				
				// recreate canvas at new size
				this.create(opts);
				ctx = this.context;
				ctx.save();
				
				// set origin point to center
				ctx.translate( this.width() / 2, this.height() / 2 );
				
				// do the needful
				ctx.rotate( rads );
				
				// reverse the translate for drawImage origin
				ctx.translate( -width / 2, -height / 2 );
			}
		} // rotate
		else {
			// other misc transform (no canvas resize)
			ctx.clearRect( 0, 0, width, height );
			
			// fill background if desired
			if (opts.background) {
				ctx.save();
				ctx.fillStyle = opts.background;
				ctx.fillRect( 0, 0, width, height );
				ctx.restore();
			}
			
			// save canvas state
			ctx.save();
			
			// set origin point to center
			ctx.translate( width / 2, height / 2 );
			
			if (opts.rotate) {
				ctx.rotate( opts.rotate * Math.PI / 180 );
			}
			else if (opts.fliph) {
				ctx.scale( -1, 1 );
			}
			else if (opts.flipv) {
				ctx.scale( 1, -1 );
			}
			else if (opts.matrix) {
				// See: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/transform
				ctx.transform.apply( ctx, opts.matrix );
			}
			
			// reverse the translate for drawImage origin
			ctx.translate( -width / 2, -height / 2 );
		}
		
		// apply antialias if specified
		if (opts.antialias) {
			this.applyAntialias( opts.antialias );
		}
		
		// draw clone onto self
		ctx.drawImage(clone.canvas, 0, 0);
		
		// restore original canvas state
		ctx.restore();
		
		this.perf.end('transform');
		this.logDebug(6, "Transform complete");
		return this;
	},
	
	rotate: function(deg) {
		// shortcut
		return this.transform({ rotate: deg });
	},
	
	flipHorizontal: function() {
		// shortcut
		return this.transform({ fliph: true });
	},
	
	flipVertical: function() {
		// shortcut
		return this.transform({ flipv: true });
	}
	
});

},{"pixl-class":85}],22:[function(require,module,exports){
// canvas-plus - Image Transformation Engine
// Trim Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	trim: function(opts) {
		// auto-crop edge pixels, uses color or top-left corner pixel as reference
		var self = this;
		this.clearLastError();
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		opts = this.copyHash( opts || {} );
		
		this.perf.begin('trim');
		this.logDebug(6, "Trimming image (auto-crop edges)", opts);
		
		var width = this.get('width');
		var height = this.get('height');
		var imgData = this.context.getImageData(0, 0, width, height);
		var data = imgData.data;
		var tolerance = opts.tolerance || 0;
		var ref = null;
		
		if (opts.color) {
			// use custom user-supplied color
			var color = this.parseColor( opts.color );
			if (!color) return this.doError('trim', "Failed to parse trim color");
			ref = color;
			this.logDebug(6, "Using custom color for trim: " + opts.color, color);
		}
		else {
			// default to top-left corner pixel
			ref = {
				r: data[0],
				g: data[1],
				b: data[2],
				a: data[3]
			};
			this.logDebug(6, "Using top-left corner pixel for trim", ref);
		}
		
		var offset = 0;
		var left = width - 1;
		var top = height - 1;
		var right = 0;
		var bottom = 0;
		
		for (var y = 0; y < height; y++) {
			// foreach row
			for (var x = 0; x < width; x++) {
				// for each pixel
				dist = Math.max(
					Math.abs( ref.r - data[offset + 0] ),
					Math.abs( ref.g - data[offset + 1] ),
					Math.abs( ref.b - data[offset + 2] ),
					Math.abs( ref.a - data[offset + 3] )
				);
				if (dist > tolerance) {
					if (x < left) left = x;
					if (x > right) right = x;
					if (y < top) top = y;
					if (y > bottom) bottom = y;
				}
				offset += 4;
			} // x
		} // y
		
		var cx = left;
		var cy = top;
		var cwidth = (right - left) + 1;
		var cheight = (bottom - top) + 1;
		
		if ((cwidth > 0) && (cheight > 0)) {
			if ((cwidth < width) || (cheight < height)) {
				this.crop({
					width: cwidth,
					height: cheight,
					x: cx,
					y: cy
				});
				this.logDebug(6, "Image trim complete");
			}
			else {
				this.logDebug(3, "No trim was necessary");
			}
		}
		else {
			this.logDebug(3, "Entire image was trimmed, canceling");
		}
		
		this.perf.end('trim');
		return this;
	}
	
});

},{"pixl-class":85}],23:[function(require,module,exports){
(function (Buffer){
// canvas-plus - Image Transformation Engine
// GIF Output Format Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var OMGGIF = require("omggif");
var toBuffer = require('blob-to-buffer');

module.exports = Class.create({
	
	output_gif: function(callback) {
		// output image in GIF format to buffer
		var self = this;
		var mode = this.get('mode');
		var width = this.get('width');
		var height = this.get('height');
		
		if (mode == 'image') {
			// if we're still in image mode convert to canvas
			if (this.render().isError) return callback( this.getLastError() );
			mode = this.get('mode');
		}
		if (mode == 'rgba') {
			// we have to force a quantize here
			this.logDebug(3, "Must force a quantize for GIF (indexed only)");
			var result = this.quantize();
			if (result.isError) return result;
			mode = this.get('mode');
		}
		
		// we need indexed pixels to continue
		if (!this.pixels) {
			return this.doError('gif', "No indexed pixels to encode", callback);
		}
		
		var iq_colors = this.palette;
		var iq_pixels = this.pixels;
		
		// locate first fully transparent color, if needed
		// also, normalize all transparent pixels to same palette index
		var transparent_index = null;
		var iq_color, idx;
		
		if (this.get('alpha')) {
			for (idx = 0, len = iq_pixels.length; idx < len; idx++) {
				iq_color = iq_colors[ iq_pixels[idx] ];
				if (iq_color.a == 0) {
					if (transparent_index) iq_pixels[idx] = transparent_index;
					else transparent_index = iq_pixels[idx];
				}
			} // foreach pixel
		} // alpha
		
		// next, build GIF palette structure (needs 24-bit RGB ints, discard alpha)
		var palette_data = [];
		var num_colors = 0;
		
		for (idx = 0, len = iq_colors.length; idx < len; idx++) {
			iq_color = iq_colors[idx];
			palette_data.push( ((iq_color.r << 8 | iq_color.g) << 8 | iq_color.b) );
			num_colors++;
		}
		
		// GIF requires palette size be a power of 2, so pad with black
		while ((num_colors & (num_colors - 1)) || (num_colors < 2)) {
			palette_data.push( 0x000000 );
			num_colors++;
		}
		
		this.logDebug(6, "Compressing into GIF", {
			palette_size: num_colors,
			transparent_index: transparent_index
		} );
		
		// construct GIF buffer
		var buf = Buffer.alloc( (width * height) + 1024 );
		var gf = null;
		try {
			gf = new OMGGIF.GifWriter( buf, width, height, { palette: palette_data } );
			gf.addFrame( 0, 0, width, height, iq_pixels, { transparent: transparent_index } );
		}
		catch (err) {
			return this.doError('gif', "GIF compression error: " + err, callback);
		}
		
		// and we're done!
		this.logDebug(6, "GIF compression complete");
		callback( false, buf.slice(0, gf.end()) );
	}
	
});

}).call(this,require("buffer").Buffer)
},{"blob-to-buffer":32,"buffer":37,"omggif":50,"pixl-class":85}],24:[function(require,module,exports){
(function (Buffer){
// canvas-plus - Image Transformation Engine
// JPEG Output Format Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var toBuffer = require('blob-to-buffer');

module.exports = Class.create({
	
	output_jpeg: function(callback) {
		// output image in JPEG format to buffer
		var self = this;
		if (this.requireRGBA().isError) return callback( this.getLastError() );
		
		// look for standard API first
		if (this.get('useDataURLs')) {
			this.logDebug(6, "Compressing into JPEG format (using browser)", { quality: this.get('quality') } );
			
			var buf = Buffer.from( this.canvas.toDataURL('image/jpeg', this.get('quality') / 100).split(',')[1], 'base64' );
			this.logDebug(6, "JPEG compression complete");
			return callback(false, buf);
		}
		else if (this.canvas.toBlob) {
			this.logDebug(6, "Compressing into JPEG format (using browser)", { quality: this.get('quality') } );
			
			this.canvas.toBlob( 
				function(blob) {
					// got Blob, now convert to Buffer
					toBuffer(blob, function (err, buf) {
						if (err) return self.doError('jpeg', "JPEG Encode Error: " + err, callback);
						self.logDebug(6, "JPEG compression complete");
						callback(null, buf);
					});
				},
				'image/jpeg',
				this.get('quality') / 100
			);
		}
		else {
			// use node-canvas proprietary API
			var opts = {
				quality: this.get('quality') / 100,
				progressive: this.get('progressive'),
				chromaSubsampling: this.get('chromaSubsampling')
			};
			
			this.logDebug(6, "Compressing into JPEG format", opts );
			
			var buf = this.canvas.toBuffer('image/jpeg', opts );
			
			this.logDebug(6, "JPEG compression complete");
			return callback(false, buf);
		} // node-canvas
	}
	
});

}).call(this,require("buffer").Buffer)
},{"blob-to-buffer":32,"buffer":37,"pixl-class":85}],25:[function(require,module,exports){
(function (Buffer){
// canvas-plus - Image Transformation Engine
// PNG Output Format Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var zlib = require('zlib');
var Class = require("pixl-class");
var CRC32 = require('crc-32');
var toBuffer = require('blob-to-buffer');

// PNG file format chunk type ids
var chunkTypes = {
	TYPE_IHDR: 0x49484452,
	TYPE_IEND: 0x49454e44,
	TYPE_IDAT: 0x49444154,
	TYPE_PLTE: 0x504c5445,
	TYPE_tRNS: 0x74524e53,
	TYPE_gAMA: 0x67414d41
};

var packChunk = function(type, data) {
	// pack one chunk of PNG data (len, type, data, CRC32 checksum)
	// returns new buffer
	var len = (data ? data.length : 0),
	buf = Buffer.alloc(len + 12);
	
	buf.writeUInt32BE(len, 0);
	buf.writeUInt32BE(type, 4);
	
	if (data) data.copy(buf, 8);
	
	buf.writeInt32BE( CRC32.buf(buf.slice(4, buf.length - 4)), buf.length - 4 );
	
	return buf;
};

module.exports = Class.create({
	
	output_png: function(callback) {
		// output image in PNG format to buffer
		// support both RGBA and indexed
		var self = this;
		var mode = this.get('mode');
		var width = this.get('width');
		var height = this.get('height');
		var buf;
		
		if (mode == 'image') {
			// if we're still in image mode convert to canvas
			if (this.render().isError) return callback( this.getLastError() );
			mode = this.get('mode');
		}
		
		// we need either a canvas or indexed pixels to continue
		if (!this.canvas && !this.pixels) {
			return this.doError('png', "No image to compress", callback);
		}
		
		if (mode == 'rgba') {
			// simple rgba to png, use node-canvas
			if (this.get('useDataURLs')) {
				this.logDebug(6, "Compressing into 32-bit PNG format (using browser)" );
				
				var buf = Buffer.from( this.canvas.toDataURL('image/png').split(',')[1], 'base64' );
				this.logDebug(6, "PNG compression complete");
				return callback(false, buf);
			}
			else if (this.canvas.toBlob) {
				// use standard HTML5 API
				this.logDebug(6, "Compressing into 32-bit PNG (using browser)" );
				
				this.canvas.toBlob( 
					function(blob) {
						// got Blob, now convert to Buffer
						toBuffer(blob, function (err, buf) {
							if (err) return self.doError('png', "PNG Encode Error: " + err, callback);
							self.logDebug(6, "PNG compression complete");
							callback(null, buf);
						});
					},
					'image/png'
				);
			}
			else {
				// use node-canvas API
				var opts = { compressionLevel: this.get('compressionLevel'), filters: this.get('pngFilter') };
				this.logDebug(6, "Compressing into 32-bit PNG", opts );
				
				opts.filters = this.canvas[this.get('pngFilter')];
				buf = this.canvas.toBuffer('image/png', opts );
				
				this.logDebug(6, "PNG compression complete");
				return callback(false, buf);
			}
		}
		else if (mode == 'indexed') {
			// not-so-simple indexed bitmap to PNG, gotta do it ourselves
			var iq_colors = this.palette;
			var iq_pixels = this.pixels;
			
			this.logDebug(6, "Compressing into 8-bit PNG", { compression: this.get('compressionLevel') } );
			
			// first, build PNG palette structure
			var palette_offset = 0;
			var palette_data = new Uint8Array( iq_colors.length * 3 );
			var alpha_data = new Uint8Array( iq_colors.length );
			var iq_color = null;
			
			for (var idx = 0, len = iq_colors.length; idx < len; idx++) {
				iq_color = iq_colors[idx];
				palette_data[ (palette_offset * 3) + 0 ] = iq_color.r;
				palette_data[ (palette_offset * 3) + 1 ] = iq_color.g;
				palette_data[ (palette_offset * 3) + 2 ] = iq_color.b;
				alpha_data[ palette_offset ] = iq_color.a;
				palette_offset++;
			}
			
			// next, build PNG pixel array (different than raw pixel array, has extra byte per row)
			var src_offset = 0;
			var pixel_offset = 0;
			var pixel_data = new Uint8Array( (width * height) + height ); // added extra 'height' for stupid filter bytes on each row
			
			for (var y = 0, ymax = height; y < ymax; y++) {
				// foreach row
				pixel_data[ pixel_offset++ ] = 0; // add filter byte
				
				for (var x = 0, xmax = width; x < xmax; x++) {
					// for each pixel
					pixel_data[ pixel_offset++ ] = iq_pixels[ src_offset++ ];
				} // x loop
			} // y loop
			
			// start building png file structure
			var chunks = [];
			
			// file signature (PNG magic number)
			chunks.push( Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) );
			
			// IHDR header chunk
			buf = Buffer.alloc(13);
			
				buf.writeUInt32BE(width, 0);
				buf.writeUInt32BE(height, 4);
				
				buf[8] = 8; // 8-bit depth
				buf[9] = 3; // indexed colorType
				buf[10] = 0; // gzip compression (yes, 0 = gzip)
				buf[11] = 0; // no filter (useless for indexed palette images)
				buf[12] = 0; // no interlace
			
			chunks.push( packChunk(chunkTypes.TYPE_IHDR, buf) );
			
			// PLTE palette chunk
			chunks.push( packChunk(chunkTypes.TYPE_PLTE, Buffer.from(palette_data.buffer) ) );
			
			// tRNS alpha chunk (only if alpha)
			if (this.get('alpha')) {
				chunks.push( packChunk(chunkTypes.TYPE_tRNS, Buffer.from(alpha_data.buffer) ) );
			}
			
			// IDAT data chunk
			chunks.push( packChunk(chunkTypes.TYPE_IDAT, zlib.deflateSync( Buffer.from(pixel_data.buffer), {
				level: this.get('compressionLevel'),
				memLevel: 9,
				strategy: zlib.constants ? zlib.constants.Z_RLE : zlib.Z_RLE
				// From zlib.net: Z_RLE is designed to be almost as fast as Z_HUFFMAN_ONLY, but give better compression for PNG image data.
			} )) );
			
			// IEND end chunk
			chunks.push( packChunk(chunkTypes.TYPE_IEND, null) );
			
			// concat chunks into single buffer
			var pngBuffer = Buffer.concat(chunks);
			
			// and we're done!
			this.logDebug(6, "PNG compression complete");
			callback( false, pngBuffer );
			
		} // indexed
		else {
			return this.doError('png', "Invalid image mode: " + mode, callback);
		}
	}
	
});

}).call(this,require("buffer").Buffer)
},{"blob-to-buffer":32,"buffer":37,"crc-32":39,"pixl-class":85,"zlib":36}],26:[function(require,module,exports){
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
		
		require('./lib/filter/draw.js'),
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
		readEXIF: true,
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

},{"./lib/filter/adjust.js":6,"./lib/filter/border.js":7,"./lib/filter/composite.js":8,"./lib/filter/convolve.js":9,"./lib/filter/crop.js":10,"./lib/filter/curves.js":11,"./lib/filter/draw.js":12,"./lib/filter/expand.js":13,"./lib/filter/flatten.js":14,"./lib/filter/hash.js":15,"./lib/filter/histogram.js":16,"./lib/filter/opacity.js":17,"./lib/filter/quantize.js":18,"./lib/filter/resize.js":19,"./lib/filter/text.js":20,"./lib/filter/transform.js":21,"./lib/filter/trim.js":22,"./lib/format/gif.js":23,"./lib/format/jpeg.js":24,"./lib/format/png.js":25,"./lib/node/create.js":2,"./lib/node/font.js":3,"./lib/node/load.js":4,"./lib/node/write.js":5,"pixl-class":85,"pixl-perf":86}],27:[function(require,module,exports){
(function (global){
'use strict';

var objectAssign = require('object-assign');

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:
// NB: The URL to the CommonJS spec is kept just for tradition.
//     node-assert has evolved a lot since then, both in API and behavior.

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

// Expose a strict only variant of assert
function strict(value, message) {
  if (!value) fail(value, true, message, '==', strict);
}
assert.strict = objectAssign(strict, assert, {
  equal: assert.strictEqual,
  deepEqual: assert.deepStrictEqual,
  notEqual: assert.notStrictEqual,
  notDeepEqual: assert.notDeepStrictEqual
});
assert.strict.strict = assert.strict;

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"object-assign":49,"util/":30}],28:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],29:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],30:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":29,"_process":63,"inherits":28}],31:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],32:[function(require,module,exports){
(function (Buffer){
/* global Blob, FileReader */

module.exports = function blobToBuffer (blob, cb) {
  if (typeof Blob === 'undefined' || !(blob instanceof Blob)) {
    throw new Error('first argument must be a Blob')
  }
  if (typeof cb !== 'function') {
    throw new Error('second argument must be a function')
  }

  var reader = new FileReader()

  function onLoadEnd (e) {
    reader.removeEventListener('loadend', onLoadEnd, false)
    if (e.error) cb(e.error)
    else cb(null, new Buffer(reader.result))
  }

  reader.addEventListener('loadend', onLoadEnd, false)
  reader.readAsArrayBuffer(blob)
}

}).call(this,require("buffer").Buffer)
},{"buffer":37}],33:[function(require,module,exports){
(function (process,global){
module.exports = process.hrtime || hrtime

// polyfil for window.performance.now
var performance = global.performance || {}
var performanceNow =
  performance.now        ||
  performance.mozNow     ||
  performance.msNow      ||
  performance.oNow       ||
  performance.webkitNow  ||
  function(){ return (new Date()).getTime() }

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
function hrtime(previousTimestamp){
  var clocktime = performanceNow.call(performance)*1e-3
  var seconds = Math.floor(clocktime)
  var nanoseconds = Math.floor((clocktime%1)*1e9)
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0]
    nanoseconds = nanoseconds - previousTimestamp[1]
    if (nanoseconds<0) {
      seconds--
      nanoseconds += 1e9
    }
  }
  return [seconds,nanoseconds]
}
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":63}],34:[function(require,module,exports){

},{}],35:[function(require,module,exports){
(function (process,Buffer){
'use strict';
/* eslint camelcase: "off" */

var assert = require('assert');

var Zstream = require('pako/lib/zlib/zstream');
var zlib_deflate = require('pako/lib/zlib/deflate.js');
var zlib_inflate = require('pako/lib/zlib/inflate.js');
var constants = require('pako/lib/zlib/constants');

for (var key in constants) {
  exports[key] = constants[key];
}

// zlib modes
exports.NONE = 0;
exports.DEFLATE = 1;
exports.INFLATE = 2;
exports.GZIP = 3;
exports.GUNZIP = 4;
exports.DEFLATERAW = 5;
exports.INFLATERAW = 6;
exports.UNZIP = 7;

var GZIP_HEADER_ID1 = 0x1f;
var GZIP_HEADER_ID2 = 0x8b;

/**
 * Emulate Node's zlib C++ layer for use by the JS layer in index.js
 */
function Zlib(mode) {
  if (typeof mode !== 'number' || mode < exports.DEFLATE || mode > exports.UNZIP) {
    throw new TypeError('Bad argument');
  }

  this.dictionary = null;
  this.err = 0;
  this.flush = 0;
  this.init_done = false;
  this.level = 0;
  this.memLevel = 0;
  this.mode = mode;
  this.strategy = 0;
  this.windowBits = 0;
  this.write_in_progress = false;
  this.pending_close = false;
  this.gzip_id_bytes_read = 0;
}

Zlib.prototype.close = function () {
  if (this.write_in_progress) {
    this.pending_close = true;
    return;
  }

  this.pending_close = false;

  assert(this.init_done, 'close before init');
  assert(this.mode <= exports.UNZIP);

  if (this.mode === exports.DEFLATE || this.mode === exports.GZIP || this.mode === exports.DEFLATERAW) {
    zlib_deflate.deflateEnd(this.strm);
  } else if (this.mode === exports.INFLATE || this.mode === exports.GUNZIP || this.mode === exports.INFLATERAW || this.mode === exports.UNZIP) {
    zlib_inflate.inflateEnd(this.strm);
  }

  this.mode = exports.NONE;

  this.dictionary = null;
};

Zlib.prototype.write = function (flush, input, in_off, in_len, out, out_off, out_len) {
  return this._write(true, flush, input, in_off, in_len, out, out_off, out_len);
};

Zlib.prototype.writeSync = function (flush, input, in_off, in_len, out, out_off, out_len) {
  return this._write(false, flush, input, in_off, in_len, out, out_off, out_len);
};

Zlib.prototype._write = function (async, flush, input, in_off, in_len, out, out_off, out_len) {
  assert.equal(arguments.length, 8);

  assert(this.init_done, 'write before init');
  assert(this.mode !== exports.NONE, 'already finalized');
  assert.equal(false, this.write_in_progress, 'write already in progress');
  assert.equal(false, this.pending_close, 'close is pending');

  this.write_in_progress = true;

  assert.equal(false, flush === undefined, 'must provide flush value');

  this.write_in_progress = true;

  if (flush !== exports.Z_NO_FLUSH && flush !== exports.Z_PARTIAL_FLUSH && flush !== exports.Z_SYNC_FLUSH && flush !== exports.Z_FULL_FLUSH && flush !== exports.Z_FINISH && flush !== exports.Z_BLOCK) {
    throw new Error('Invalid flush value');
  }

  if (input == null) {
    input = Buffer.alloc(0);
    in_len = 0;
    in_off = 0;
  }

  this.strm.avail_in = in_len;
  this.strm.input = input;
  this.strm.next_in = in_off;
  this.strm.avail_out = out_len;
  this.strm.output = out;
  this.strm.next_out = out_off;
  this.flush = flush;

  if (!async) {
    // sync version
    this._process();

    if (this._checkError()) {
      return this._afterSync();
    }
    return;
  }

  // async version
  var self = this;
  process.nextTick(function () {
    self._process();
    self._after();
  });

  return this;
};

Zlib.prototype._afterSync = function () {
  var avail_out = this.strm.avail_out;
  var avail_in = this.strm.avail_in;

  this.write_in_progress = false;

  return [avail_in, avail_out];
};

Zlib.prototype._process = function () {
  var next_expected_header_byte = null;

  // If the avail_out is left at 0, then it means that it ran out
  // of room.  If there was avail_out left over, then it means
  // that all of the input was consumed.
  switch (this.mode) {
    case exports.DEFLATE:
    case exports.GZIP:
    case exports.DEFLATERAW:
      this.err = zlib_deflate.deflate(this.strm, this.flush);
      break;
    case exports.UNZIP:
      if (this.strm.avail_in > 0) {
        next_expected_header_byte = this.strm.next_in;
      }

      switch (this.gzip_id_bytes_read) {
        case 0:
          if (next_expected_header_byte === null) {
            break;
          }

          if (this.strm.input[next_expected_header_byte] === GZIP_HEADER_ID1) {
            this.gzip_id_bytes_read = 1;
            next_expected_header_byte++;

            if (this.strm.avail_in === 1) {
              // The only available byte was already read.
              break;
            }
          } else {
            this.mode = exports.INFLATE;
            break;
          }

        // fallthrough
        case 1:
          if (next_expected_header_byte === null) {
            break;
          }

          if (this.strm.input[next_expected_header_byte] === GZIP_HEADER_ID2) {
            this.gzip_id_bytes_read = 2;
            this.mode = exports.GUNZIP;
          } else {
            // There is no actual difference between INFLATE and INFLATERAW
            // (after initialization).
            this.mode = exports.INFLATE;
          }

          break;
        default:
          throw new Error('invalid number of gzip magic number bytes read');
      }

    // fallthrough
    case exports.INFLATE:
    case exports.GUNZIP:
    case exports.INFLATERAW:
      this.err = zlib_inflate.inflate(this.strm, this.flush

      // If data was encoded with dictionary
      );if (this.err === exports.Z_NEED_DICT && this.dictionary) {
        // Load it
        this.err = zlib_inflate.inflateSetDictionary(this.strm, this.dictionary);
        if (this.err === exports.Z_OK) {
          // And try to decode again
          this.err = zlib_inflate.inflate(this.strm, this.flush);
        } else if (this.err === exports.Z_DATA_ERROR) {
          // Both inflateSetDictionary() and inflate() return Z_DATA_ERROR.
          // Make it possible for After() to tell a bad dictionary from bad
          // input.
          this.err = exports.Z_NEED_DICT;
        }
      }
      while (this.strm.avail_in > 0 && this.mode === exports.GUNZIP && this.err === exports.Z_STREAM_END && this.strm.next_in[0] !== 0x00) {
        // Bytes remain in input buffer. Perhaps this is another compressed
        // member in the same archive, or just trailing garbage.
        // Trailing zero bytes are okay, though, since they are frequently
        // used for padding.

        this.reset();
        this.err = zlib_inflate.inflate(this.strm, this.flush);
      }
      break;
    default:
      throw new Error('Unknown mode ' + this.mode);
  }
};

Zlib.prototype._checkError = function () {
  // Acceptable error states depend on the type of zlib stream.
  switch (this.err) {
    case exports.Z_OK:
    case exports.Z_BUF_ERROR:
      if (this.strm.avail_out !== 0 && this.flush === exports.Z_FINISH) {
        this._error('unexpected end of file');
        return false;
      }
      break;
    case exports.Z_STREAM_END:
      // normal statuses, not fatal
      break;
    case exports.Z_NEED_DICT:
      if (this.dictionary == null) {
        this._error('Missing dictionary');
      } else {
        this._error('Bad dictionary');
      }
      return false;
    default:
      // something else.
      this._error('Zlib error');
      return false;
  }

  return true;
};

Zlib.prototype._after = function () {
  if (!this._checkError()) {
    return;
  }

  var avail_out = this.strm.avail_out;
  var avail_in = this.strm.avail_in;

  this.write_in_progress = false;

  // call the write() cb
  this.callback(avail_in, avail_out);

  if (this.pending_close) {
    this.close();
  }
};

Zlib.prototype._error = function (message) {
  if (this.strm.msg) {
    message = this.strm.msg;
  }
  this.onerror(message, this.err

  // no hope of rescue.
  );this.write_in_progress = false;
  if (this.pending_close) {
    this.close();
  }
};

Zlib.prototype.init = function (windowBits, level, memLevel, strategy, dictionary) {
  assert(arguments.length === 4 || arguments.length === 5, 'init(windowBits, level, memLevel, strategy, [dictionary])');

  assert(windowBits >= 8 && windowBits <= 15, 'invalid windowBits');
  assert(level >= -1 && level <= 9, 'invalid compression level');

  assert(memLevel >= 1 && memLevel <= 9, 'invalid memlevel');

  assert(strategy === exports.Z_FILTERED || strategy === exports.Z_HUFFMAN_ONLY || strategy === exports.Z_RLE || strategy === exports.Z_FIXED || strategy === exports.Z_DEFAULT_STRATEGY, 'invalid strategy');

  this._init(level, windowBits, memLevel, strategy, dictionary);
  this._setDictionary();
};

Zlib.prototype.params = function () {
  throw new Error('deflateParams Not supported');
};

Zlib.prototype.reset = function () {
  this._reset();
  this._setDictionary();
};

Zlib.prototype._init = function (level, windowBits, memLevel, strategy, dictionary) {
  this.level = level;
  this.windowBits = windowBits;
  this.memLevel = memLevel;
  this.strategy = strategy;

  this.flush = exports.Z_NO_FLUSH;

  this.err = exports.Z_OK;

  if (this.mode === exports.GZIP || this.mode === exports.GUNZIP) {
    this.windowBits += 16;
  }

  if (this.mode === exports.UNZIP) {
    this.windowBits += 32;
  }

  if (this.mode === exports.DEFLATERAW || this.mode === exports.INFLATERAW) {
    this.windowBits = -1 * this.windowBits;
  }

  this.strm = new Zstream();

  switch (this.mode) {
    case exports.DEFLATE:
    case exports.GZIP:
    case exports.DEFLATERAW:
      this.err = zlib_deflate.deflateInit2(this.strm, this.level, exports.Z_DEFLATED, this.windowBits, this.memLevel, this.strategy);
      break;
    case exports.INFLATE:
    case exports.GUNZIP:
    case exports.INFLATERAW:
    case exports.UNZIP:
      this.err = zlib_inflate.inflateInit2(this.strm, this.windowBits);
      break;
    default:
      throw new Error('Unknown mode ' + this.mode);
  }

  if (this.err !== exports.Z_OK) {
    this._error('Init error');
  }

  this.dictionary = dictionary;

  this.write_in_progress = false;
  this.init_done = true;
};

Zlib.prototype._setDictionary = function () {
  if (this.dictionary == null) {
    return;
  }

  this.err = exports.Z_OK;

  switch (this.mode) {
    case exports.DEFLATE:
    case exports.DEFLATERAW:
      this.err = zlib_deflate.deflateSetDictionary(this.strm, this.dictionary);
      break;
    default:
      break;
  }

  if (this.err !== exports.Z_OK) {
    this._error('Failed to set dictionary');
  }
};

Zlib.prototype._reset = function () {
  this.err = exports.Z_OK;

  switch (this.mode) {
    case exports.DEFLATE:
    case exports.DEFLATERAW:
    case exports.GZIP:
      this.err = zlib_deflate.deflateReset(this.strm);
      break;
    case exports.INFLATE:
    case exports.INFLATERAW:
    case exports.GUNZIP:
      this.err = zlib_inflate.inflateReset(this.strm);
      break;
    default:
      break;
  }

  if (this.err !== exports.Z_OK) {
    this._error('Failed to reset stream');
  }
};

exports.Zlib = Zlib;
}).call(this,require('_process'),require("buffer").Buffer)
},{"_process":63,"assert":27,"buffer":37,"pako/lib/zlib/constants":53,"pako/lib/zlib/deflate.js":55,"pako/lib/zlib/inflate.js":57,"pako/lib/zlib/zstream":61}],36:[function(require,module,exports){
(function (process){
'use strict';

var Buffer = require('buffer').Buffer;
var Transform = require('stream').Transform;
var binding = require('./binding');
var util = require('util');
var assert = require('assert').ok;
var kMaxLength = require('buffer').kMaxLength;
var kRangeErrorMessage = 'Cannot create final Buffer. It would be larger ' + 'than 0x' + kMaxLength.toString(16) + ' bytes';

// zlib doesn't provide these, so kludge them in following the same
// const naming scheme zlib uses.
binding.Z_MIN_WINDOWBITS = 8;
binding.Z_MAX_WINDOWBITS = 15;
binding.Z_DEFAULT_WINDOWBITS = 15;

// fewer than 64 bytes per chunk is stupid.
// technically it could work with as few as 8, but even 64 bytes
// is absurdly low.  Usually a MB or more is best.
binding.Z_MIN_CHUNK = 64;
binding.Z_MAX_CHUNK = Infinity;
binding.Z_DEFAULT_CHUNK = 16 * 1024;

binding.Z_MIN_MEMLEVEL = 1;
binding.Z_MAX_MEMLEVEL = 9;
binding.Z_DEFAULT_MEMLEVEL = 8;

binding.Z_MIN_LEVEL = -1;
binding.Z_MAX_LEVEL = 9;
binding.Z_DEFAULT_LEVEL = binding.Z_DEFAULT_COMPRESSION;

// expose all the zlib constants
var bkeys = Object.keys(binding);
for (var bk = 0; bk < bkeys.length; bk++) {
  var bkey = bkeys[bk];
  if (bkey.match(/^Z/)) {
    Object.defineProperty(exports, bkey, {
      enumerable: true, value: binding[bkey], writable: false
    });
  }
}

// translation table for return codes.
var codes = {
  Z_OK: binding.Z_OK,
  Z_STREAM_END: binding.Z_STREAM_END,
  Z_NEED_DICT: binding.Z_NEED_DICT,
  Z_ERRNO: binding.Z_ERRNO,
  Z_STREAM_ERROR: binding.Z_STREAM_ERROR,
  Z_DATA_ERROR: binding.Z_DATA_ERROR,
  Z_MEM_ERROR: binding.Z_MEM_ERROR,
  Z_BUF_ERROR: binding.Z_BUF_ERROR,
  Z_VERSION_ERROR: binding.Z_VERSION_ERROR
};

var ckeys = Object.keys(codes);
for (var ck = 0; ck < ckeys.length; ck++) {
  var ckey = ckeys[ck];
  codes[codes[ckey]] = ckey;
}

Object.defineProperty(exports, 'codes', {
  enumerable: true, value: Object.freeze(codes), writable: false
});

exports.Deflate = Deflate;
exports.Inflate = Inflate;
exports.Gzip = Gzip;
exports.Gunzip = Gunzip;
exports.DeflateRaw = DeflateRaw;
exports.InflateRaw = InflateRaw;
exports.Unzip = Unzip;

exports.createDeflate = function (o) {
  return new Deflate(o);
};

exports.createInflate = function (o) {
  return new Inflate(o);
};

exports.createDeflateRaw = function (o) {
  return new DeflateRaw(o);
};

exports.createInflateRaw = function (o) {
  return new InflateRaw(o);
};

exports.createGzip = function (o) {
  return new Gzip(o);
};

exports.createGunzip = function (o) {
  return new Gunzip(o);
};

exports.createUnzip = function (o) {
  return new Unzip(o);
};

// Convenience methods.
// compress/decompress a string or buffer in one step.
exports.deflate = function (buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Deflate(opts), buffer, callback);
};

exports.deflateSync = function (buffer, opts) {
  return zlibBufferSync(new Deflate(opts), buffer);
};

exports.gzip = function (buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Gzip(opts), buffer, callback);
};

exports.gzipSync = function (buffer, opts) {
  return zlibBufferSync(new Gzip(opts), buffer);
};

exports.deflateRaw = function (buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new DeflateRaw(opts), buffer, callback);
};

exports.deflateRawSync = function (buffer, opts) {
  return zlibBufferSync(new DeflateRaw(opts), buffer);
};

exports.unzip = function (buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Unzip(opts), buffer, callback);
};

exports.unzipSync = function (buffer, opts) {
  return zlibBufferSync(new Unzip(opts), buffer);
};

exports.inflate = function (buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Inflate(opts), buffer, callback);
};

exports.inflateSync = function (buffer, opts) {
  return zlibBufferSync(new Inflate(opts), buffer);
};

exports.gunzip = function (buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Gunzip(opts), buffer, callback);
};

exports.gunzipSync = function (buffer, opts) {
  return zlibBufferSync(new Gunzip(opts), buffer);
};

exports.inflateRaw = function (buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new InflateRaw(opts), buffer, callback);
};

exports.inflateRawSync = function (buffer, opts) {
  return zlibBufferSync(new InflateRaw(opts), buffer);
};

function zlibBuffer(engine, buffer, callback) {
  var buffers = [];
  var nread = 0;

  engine.on('error', onError);
  engine.on('end', onEnd);

  engine.end(buffer);
  flow();

  function flow() {
    var chunk;
    while (null !== (chunk = engine.read())) {
      buffers.push(chunk);
      nread += chunk.length;
    }
    engine.once('readable', flow);
  }

  function onError(err) {
    engine.removeListener('end', onEnd);
    engine.removeListener('readable', flow);
    callback(err);
  }

  function onEnd() {
    var buf;
    var err = null;

    if (nread >= kMaxLength) {
      err = new RangeError(kRangeErrorMessage);
    } else {
      buf = Buffer.concat(buffers, nread);
    }

    buffers = [];
    engine.close();
    callback(err, buf);
  }
}

function zlibBufferSync(engine, buffer) {
  if (typeof buffer === 'string') buffer = Buffer.from(buffer);

  if (!Buffer.isBuffer(buffer)) throw new TypeError('Not a string or buffer');

  var flushFlag = engine._finishFlushFlag;

  return engine._processChunk(buffer, flushFlag);
}

// generic zlib
// minimal 2-byte header
function Deflate(opts) {
  if (!(this instanceof Deflate)) return new Deflate(opts);
  Zlib.call(this, opts, binding.DEFLATE);
}

function Inflate(opts) {
  if (!(this instanceof Inflate)) return new Inflate(opts);
  Zlib.call(this, opts, binding.INFLATE);
}

// gzip - bigger header, same deflate compression
function Gzip(opts) {
  if (!(this instanceof Gzip)) return new Gzip(opts);
  Zlib.call(this, opts, binding.GZIP);
}

function Gunzip(opts) {
  if (!(this instanceof Gunzip)) return new Gunzip(opts);
  Zlib.call(this, opts, binding.GUNZIP);
}

// raw - no header
function DeflateRaw(opts) {
  if (!(this instanceof DeflateRaw)) return new DeflateRaw(opts);
  Zlib.call(this, opts, binding.DEFLATERAW);
}

function InflateRaw(opts) {
  if (!(this instanceof InflateRaw)) return new InflateRaw(opts);
  Zlib.call(this, opts, binding.INFLATERAW);
}

// auto-detect header.
function Unzip(opts) {
  if (!(this instanceof Unzip)) return new Unzip(opts);
  Zlib.call(this, opts, binding.UNZIP);
}

function isValidFlushFlag(flag) {
  return flag === binding.Z_NO_FLUSH || flag === binding.Z_PARTIAL_FLUSH || flag === binding.Z_SYNC_FLUSH || flag === binding.Z_FULL_FLUSH || flag === binding.Z_FINISH || flag === binding.Z_BLOCK;
}

// the Zlib class they all inherit from
// This thing manages the queue of requests, and returns
// true or false if there is anything in the queue when
// you call the .write() method.

function Zlib(opts, mode) {
  var _this = this;

  this._opts = opts = opts || {};
  this._chunkSize = opts.chunkSize || exports.Z_DEFAULT_CHUNK;

  Transform.call(this, opts);

  if (opts.flush && !isValidFlushFlag(opts.flush)) {
    throw new Error('Invalid flush flag: ' + opts.flush);
  }
  if (opts.finishFlush && !isValidFlushFlag(opts.finishFlush)) {
    throw new Error('Invalid flush flag: ' + opts.finishFlush);
  }

  this._flushFlag = opts.flush || binding.Z_NO_FLUSH;
  this._finishFlushFlag = typeof opts.finishFlush !== 'undefined' ? opts.finishFlush : binding.Z_FINISH;

  if (opts.chunkSize) {
    if (opts.chunkSize < exports.Z_MIN_CHUNK || opts.chunkSize > exports.Z_MAX_CHUNK) {
      throw new Error('Invalid chunk size: ' + opts.chunkSize);
    }
  }

  if (opts.windowBits) {
    if (opts.windowBits < exports.Z_MIN_WINDOWBITS || opts.windowBits > exports.Z_MAX_WINDOWBITS) {
      throw new Error('Invalid windowBits: ' + opts.windowBits);
    }
  }

  if (opts.level) {
    if (opts.level < exports.Z_MIN_LEVEL || opts.level > exports.Z_MAX_LEVEL) {
      throw new Error('Invalid compression level: ' + opts.level);
    }
  }

  if (opts.memLevel) {
    if (opts.memLevel < exports.Z_MIN_MEMLEVEL || opts.memLevel > exports.Z_MAX_MEMLEVEL) {
      throw new Error('Invalid memLevel: ' + opts.memLevel);
    }
  }

  if (opts.strategy) {
    if (opts.strategy != exports.Z_FILTERED && opts.strategy != exports.Z_HUFFMAN_ONLY && opts.strategy != exports.Z_RLE && opts.strategy != exports.Z_FIXED && opts.strategy != exports.Z_DEFAULT_STRATEGY) {
      throw new Error('Invalid strategy: ' + opts.strategy);
    }
  }

  if (opts.dictionary) {
    if (!Buffer.isBuffer(opts.dictionary)) {
      throw new Error('Invalid dictionary: it should be a Buffer instance');
    }
  }

  this._handle = new binding.Zlib(mode);

  var self = this;
  this._hadError = false;
  this._handle.onerror = function (message, errno) {
    // there is no way to cleanly recover.
    // continuing only obscures problems.
    _close(self);
    self._hadError = true;

    var error = new Error(message);
    error.errno = errno;
    error.code = exports.codes[errno];
    self.emit('error', error);
  };

  var level = exports.Z_DEFAULT_COMPRESSION;
  if (typeof opts.level === 'number') level = opts.level;

  var strategy = exports.Z_DEFAULT_STRATEGY;
  if (typeof opts.strategy === 'number') strategy = opts.strategy;

  this._handle.init(opts.windowBits || exports.Z_DEFAULT_WINDOWBITS, level, opts.memLevel || exports.Z_DEFAULT_MEMLEVEL, strategy, opts.dictionary);

  this._buffer = Buffer.allocUnsafe(this._chunkSize);
  this._offset = 0;
  this._level = level;
  this._strategy = strategy;

  this.once('end', this.close);

  Object.defineProperty(this, '_closed', {
    get: function () {
      return !_this._handle;
    },
    configurable: true,
    enumerable: true
  });
}

util.inherits(Zlib, Transform);

Zlib.prototype.params = function (level, strategy, callback) {
  if (level < exports.Z_MIN_LEVEL || level > exports.Z_MAX_LEVEL) {
    throw new RangeError('Invalid compression level: ' + level);
  }
  if (strategy != exports.Z_FILTERED && strategy != exports.Z_HUFFMAN_ONLY && strategy != exports.Z_RLE && strategy != exports.Z_FIXED && strategy != exports.Z_DEFAULT_STRATEGY) {
    throw new TypeError('Invalid strategy: ' + strategy);
  }

  if (this._level !== level || this._strategy !== strategy) {
    var self = this;
    this.flush(binding.Z_SYNC_FLUSH, function () {
      assert(self._handle, 'zlib binding closed');
      self._handle.params(level, strategy);
      if (!self._hadError) {
        self._level = level;
        self._strategy = strategy;
        if (callback) callback();
      }
    });
  } else {
    process.nextTick(callback);
  }
};

Zlib.prototype.reset = function () {
  assert(this._handle, 'zlib binding closed');
  return this._handle.reset();
};

// This is the _flush function called by the transform class,
// internally, when the last chunk has been written.
Zlib.prototype._flush = function (callback) {
  this._transform(Buffer.alloc(0), '', callback);
};

Zlib.prototype.flush = function (kind, callback) {
  var _this2 = this;

  var ws = this._writableState;

  if (typeof kind === 'function' || kind === undefined && !callback) {
    callback = kind;
    kind = binding.Z_FULL_FLUSH;
  }

  if (ws.ended) {
    if (callback) process.nextTick(callback);
  } else if (ws.ending) {
    if (callback) this.once('end', callback);
  } else if (ws.needDrain) {
    if (callback) {
      this.once('drain', function () {
        return _this2.flush(kind, callback);
      });
    }
  } else {
    this._flushFlag = kind;
    this.write(Buffer.alloc(0), '', callback);
  }
};

Zlib.prototype.close = function (callback) {
  _close(this, callback);
  process.nextTick(emitCloseNT, this);
};

function _close(engine, callback) {
  if (callback) process.nextTick(callback);

  // Caller may invoke .close after a zlib error (which will null _handle).
  if (!engine._handle) return;

  engine._handle.close();
  engine._handle = null;
}

function emitCloseNT(self) {
  self.emit('close');
}

Zlib.prototype._transform = function (chunk, encoding, cb) {
  var flushFlag;
  var ws = this._writableState;
  var ending = ws.ending || ws.ended;
  var last = ending && (!chunk || ws.length === chunk.length);

  if (chunk !== null && !Buffer.isBuffer(chunk)) return cb(new Error('invalid input'));

  if (!this._handle) return cb(new Error('zlib binding closed'));

  // If it's the last chunk, or a final flush, we use the Z_FINISH flush flag
  // (or whatever flag was provided using opts.finishFlush).
  // If it's explicitly flushing at some other time, then we use
  // Z_FULL_FLUSH. Otherwise, use Z_NO_FLUSH for maximum compression
  // goodness.
  if (last) flushFlag = this._finishFlushFlag;else {
    flushFlag = this._flushFlag;
    // once we've flushed the last of the queue, stop flushing and
    // go back to the normal behavior.
    if (chunk.length >= ws.length) {
      this._flushFlag = this._opts.flush || binding.Z_NO_FLUSH;
    }
  }

  this._processChunk(chunk, flushFlag, cb);
};

Zlib.prototype._processChunk = function (chunk, flushFlag, cb) {
  var availInBefore = chunk && chunk.length;
  var availOutBefore = this._chunkSize - this._offset;
  var inOff = 0;

  var self = this;

  var async = typeof cb === 'function';

  if (!async) {
    var buffers = [];
    var nread = 0;

    var error;
    this.on('error', function (er) {
      error = er;
    });

    assert(this._handle, 'zlib binding closed');
    do {
      var res = this._handle.writeSync(flushFlag, chunk, // in
      inOff, // in_off
      availInBefore, // in_len
      this._buffer, // out
      this._offset, //out_off
      availOutBefore); // out_len
    } while (!this._hadError && callback(res[0], res[1]));

    if (this._hadError) {
      throw error;
    }

    if (nread >= kMaxLength) {
      _close(this);
      throw new RangeError(kRangeErrorMessage);
    }

    var buf = Buffer.concat(buffers, nread);
    _close(this);

    return buf;
  }

  assert(this._handle, 'zlib binding closed');
  var req = this._handle.write(flushFlag, chunk, // in
  inOff, // in_off
  availInBefore, // in_len
  this._buffer, // out
  this._offset, //out_off
  availOutBefore); // out_len

  req.buffer = chunk;
  req.callback = callback;

  function callback(availInAfter, availOutAfter) {
    // When the callback is used in an async write, the callback's
    // context is the `req` object that was created. The req object
    // is === this._handle, and that's why it's important to null
    // out the values after they are done being used. `this._handle`
    // can stay in memory longer than the callback and buffer are needed.
    if (this) {
      this.buffer = null;
      this.callback = null;
    }

    if (self._hadError) return;

    var have = availOutBefore - availOutAfter;
    assert(have >= 0, 'have should not go down');

    if (have > 0) {
      var out = self._buffer.slice(self._offset, self._offset + have);
      self._offset += have;
      // serve some output to the consumer.
      if (async) {
        self.push(out);
      } else {
        buffers.push(out);
        nread += out.length;
      }
    }

    // exhausted the output buffer, or used all the input create a new one.
    if (availOutAfter === 0 || self._offset >= self._chunkSize) {
      availOutBefore = self._chunkSize;
      self._offset = 0;
      self._buffer = Buffer.allocUnsafe(self._chunkSize);
    }

    if (availOutAfter === 0) {
      // Not actually done.  Need to reprocess.
      // Also, update the availInBefore to the availInAfter value,
      // so that if we have to hit it a third (fourth, etc.) time,
      // it'll have the correct byte counts.
      inOff += availInBefore - availInAfter;
      availInBefore = availInAfter;

      if (!async) return true;

      var newReq = self._handle.write(flushFlag, chunk, inOff, availInBefore, self._buffer, self._offset, self._chunkSize);
      newReq.callback = callback; // this same function
      newReq.buffer = chunk;
      return;
    }

    if (!async) return false;

    // finished with the chunk.
    cb();
  }
};

util.inherits(Deflate, Zlib);
util.inherits(Inflate, Zlib);
util.inherits(Gzip, Zlib);
util.inherits(Gunzip, Zlib);
util.inherits(DeflateRaw, Zlib);
util.inherits(InflateRaw, Zlib);
util.inherits(Unzip, Zlib);
}).call(this,require('_process'))
},{"./binding":35,"_process":63,"assert":27,"buffer":37,"stream":78,"util":84}],37:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this,require("buffer").Buffer)
},{"base64-js":31,"buffer":37,"ieee754":44}],38:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":47}],39:[function(require,module,exports){
/* crc32.js (C) 2014-present SheetJS -- http://sheetjs.com */
/* vim: set ts=2: */
/*exported CRC32 */
var CRC32;
(function (factory) {
	/*jshint ignore:start */
	if(typeof DO_NOT_EXPORT_CRC === 'undefined') {
		if('object' === typeof exports) {
			factory(exports);
		} else if ('function' === typeof define && define.amd) {
			define(function () {
				var module = {};
				factory(module);
				return module;
			});
		} else {
			factory(CRC32 = {});
		}
	} else {
		factory(CRC32 = {});
	}
	/*jshint ignore:end */
}(function(CRC32) {
CRC32.version = '1.0.2';
/* see perf/crc32table.js */
/*global Int32Array */
function signed_crc_table() {
	var c = 0, table = new Array(256);

	for(var n =0; n != 256; ++n){
		c = n;
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		table[n] = c;
	}

	return typeof Int32Array !== 'undefined' ? new Int32Array(table) : table;
}

var T = signed_crc_table();
function crc32_bstr(bstr, seed) {
	var C = seed ^ -1, L = bstr.length - 1;
	for(var i = 0; i < L;) {
		C = (C>>>8) ^ T[(C^bstr.charCodeAt(i++))&0xFF];
		C = (C>>>8) ^ T[(C^bstr.charCodeAt(i++))&0xFF];
	}
	if(i === L) C = (C>>>8) ^ T[(C ^ bstr.charCodeAt(i))&0xFF];
	return C ^ -1;
}

function crc32_buf(buf, seed) {
	if(buf.length > 10000) return crc32_buf_8(buf, seed);
	var C = seed ^ -1, L = buf.length - 3;
	for(var i = 0; i < L;) {
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
	}
	while(i < L+3) C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
	return C ^ -1;
}

function crc32_buf_8(buf, seed) {
	var C = seed ^ -1, L = buf.length - 7;
	for(var i = 0; i < L;) {
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
	}
	while(i < L+7) C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
	return C ^ -1;
}

function crc32_str(str, seed) {
	var C = seed ^ -1;
	for(var i = 0, L=str.length, c, d; i < L;) {
		c = str.charCodeAt(i++);
		if(c < 0x80) {
			C = (C>>>8) ^ T[(C ^ c)&0xFF];
		} else if(c < 0x800) {
			C = (C>>>8) ^ T[(C ^ (192|((c>>6)&31)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|(c&63)))&0xFF];
		} else if(c >= 0xD800 && c < 0xE000) {
			c = (c&1023)+64; d = str.charCodeAt(i++)&1023;
			C = (C>>>8) ^ T[(C ^ (240|((c>>8)&7)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|((c>>2)&63)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|((d>>6)&15)|((c&3)<<4)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|(d&63)))&0xFF];
		} else {
			C = (C>>>8) ^ T[(C ^ (224|((c>>12)&15)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|((c>>6)&63)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|(c&63)))&0xFF];
		}
	}
	return C ^ -1;
}
CRC32.table = T;
CRC32.bstr = crc32_bstr;
CRC32.buf = crc32_buf;
CRC32.str = crc32_str;
}));

},{}],40:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],41:[function(require,module,exports){
(function() {

    var debug = false;

    var root = this;

    var EXIF = function(obj) {
        if (obj instanceof EXIF) return obj;
        if (!(this instanceof EXIF)) return new EXIF(obj);
        this.EXIFwrapped = obj;
    };

    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = EXIF;
        }
        exports.EXIF = EXIF;
    } else {
        root.EXIF = EXIF;
    }

    var ExifTags = EXIF.Tags = {

        // version tags
        0x9000 : "ExifVersion",             // EXIF version
        0xA000 : "FlashpixVersion",         // Flashpix format version

        // colorspace tags
        0xA001 : "ColorSpace",              // Color space information tag

        // image configuration
        0xA002 : "PixelXDimension",         // Valid width of meaningful image
        0xA003 : "PixelYDimension",         // Valid height of meaningful image
        0x9101 : "ComponentsConfiguration", // Information about channels
        0x9102 : "CompressedBitsPerPixel",  // Compressed bits per pixel

        // user information
        0x927C : "MakerNote",               // Any desired information written by the manufacturer
        0x9286 : "UserComment",             // Comments by user

        // related file
        0xA004 : "RelatedSoundFile",        // Name of related sound file

        // date and time
        0x9003 : "DateTimeOriginal",        // Date and time when the original image was generated
        0x9004 : "DateTimeDigitized",       // Date and time when the image was stored digitally
        0x9290 : "SubsecTime",              // Fractions of seconds for DateTime
        0x9291 : "SubsecTimeOriginal",      // Fractions of seconds for DateTimeOriginal
        0x9292 : "SubsecTimeDigitized",     // Fractions of seconds for DateTimeDigitized

        // picture-taking conditions
        0x829A : "ExposureTime",            // Exposure time (in seconds)
        0x829D : "FNumber",                 // F number
        0x8822 : "ExposureProgram",         // Exposure program
        0x8824 : "SpectralSensitivity",     // Spectral sensitivity
        0x8827 : "ISOSpeedRatings",         // ISO speed rating
        0x8828 : "OECF",                    // Optoelectric conversion factor
        0x9201 : "ShutterSpeedValue",       // Shutter speed
        0x9202 : "ApertureValue",           // Lens aperture
        0x9203 : "BrightnessValue",         // Value of brightness
        0x9204 : "ExposureBias",            // Exposure bias
        0x9205 : "MaxApertureValue",        // Smallest F number of lens
        0x9206 : "SubjectDistance",         // Distance to subject in meters
        0x9207 : "MeteringMode",            // Metering mode
        0x9208 : "LightSource",             // Kind of light source
        0x9209 : "Flash",                   // Flash status
        0x9214 : "SubjectArea",             // Location and area of main subject
        0x920A : "FocalLength",             // Focal length of the lens in mm
        0xA20B : "FlashEnergy",             // Strobe energy in BCPS
        0xA20C : "SpatialFrequencyResponse",    //
        0xA20E : "FocalPlaneXResolution",   // Number of pixels in width direction per FocalPlaneResolutionUnit
        0xA20F : "FocalPlaneYResolution",   // Number of pixels in height direction per FocalPlaneResolutionUnit
        0xA210 : "FocalPlaneResolutionUnit",    // Unit for measuring FocalPlaneXResolution and FocalPlaneYResolution
        0xA214 : "SubjectLocation",         // Location of subject in image
        0xA215 : "ExposureIndex",           // Exposure index selected on camera
        0xA217 : "SensingMethod",           // Image sensor type
        0xA300 : "FileSource",              // Image source (3 == DSC)
        0xA301 : "SceneType",               // Scene type (1 == directly photographed)
        0xA302 : "CFAPattern",              // Color filter array geometric pattern
        0xA401 : "CustomRendered",          // Special processing
        0xA402 : "ExposureMode",            // Exposure mode
        0xA403 : "WhiteBalance",            // 1 = auto white balance, 2 = manual
        0xA404 : "DigitalZoomRation",       // Digital zoom ratio
        0xA405 : "FocalLengthIn35mmFilm",   // Equivalent foacl length assuming 35mm film camera (in mm)
        0xA406 : "SceneCaptureType",        // Type of scene
        0xA407 : "GainControl",             // Degree of overall image gain adjustment
        0xA408 : "Contrast",                // Direction of contrast processing applied by camera
        0xA409 : "Saturation",              // Direction of saturation processing applied by camera
        0xA40A : "Sharpness",               // Direction of sharpness processing applied by camera
        0xA40B : "DeviceSettingDescription",    //
        0xA40C : "SubjectDistanceRange",    // Distance to subject

        // other tags
        0xA005 : "InteroperabilityIFDPointer",
        0xA420 : "ImageUniqueID"            // Identifier assigned uniquely to each image
    };

    var TiffTags = EXIF.TiffTags = {
        0x0100 : "ImageWidth",
        0x0101 : "ImageHeight",
        0x8769 : "ExifIFDPointer",
        0x8825 : "GPSInfoIFDPointer",
        0xA005 : "InteroperabilityIFDPointer",
        0x0102 : "BitsPerSample",
        0x0103 : "Compression",
        0x0106 : "PhotometricInterpretation",
        0x0112 : "Orientation",
        0x0115 : "SamplesPerPixel",
        0x011C : "PlanarConfiguration",
        0x0212 : "YCbCrSubSampling",
        0x0213 : "YCbCrPositioning",
        0x011A : "XResolution",
        0x011B : "YResolution",
        0x0128 : "ResolutionUnit",
        0x0111 : "StripOffsets",
        0x0116 : "RowsPerStrip",
        0x0117 : "StripByteCounts",
        0x0201 : "JPEGInterchangeFormat",
        0x0202 : "JPEGInterchangeFormatLength",
        0x012D : "TransferFunction",
        0x013E : "WhitePoint",
        0x013F : "PrimaryChromaticities",
        0x0211 : "YCbCrCoefficients",
        0x0214 : "ReferenceBlackWhite",
        0x0132 : "DateTime",
        0x010E : "ImageDescription",
        0x010F : "Make",
        0x0110 : "Model",
        0x0131 : "Software",
        0x013B : "Artist",
        0x8298 : "Copyright"
    };

    var GPSTags = EXIF.GPSTags = {
        0x0000 : "GPSVersionID",
        0x0001 : "GPSLatitudeRef",
        0x0002 : "GPSLatitude",
        0x0003 : "GPSLongitudeRef",
        0x0004 : "GPSLongitude",
        0x0005 : "GPSAltitudeRef",
        0x0006 : "GPSAltitude",
        0x0007 : "GPSTimeStamp",
        0x0008 : "GPSSatellites",
        0x0009 : "GPSStatus",
        0x000A : "GPSMeasureMode",
        0x000B : "GPSDOP",
        0x000C : "GPSSpeedRef",
        0x000D : "GPSSpeed",
        0x000E : "GPSTrackRef",
        0x000F : "GPSTrack",
        0x0010 : "GPSImgDirectionRef",
        0x0011 : "GPSImgDirection",
        0x0012 : "GPSMapDatum",
        0x0013 : "GPSDestLatitudeRef",
        0x0014 : "GPSDestLatitude",
        0x0015 : "GPSDestLongitudeRef",
        0x0016 : "GPSDestLongitude",
        0x0017 : "GPSDestBearingRef",
        0x0018 : "GPSDestBearing",
        0x0019 : "GPSDestDistanceRef",
        0x001A : "GPSDestDistance",
        0x001B : "GPSProcessingMethod",
        0x001C : "GPSAreaInformation",
        0x001D : "GPSDateStamp",
        0x001E : "GPSDifferential"
    };

     // EXIF 2.3 Spec
    var IFD1Tags = EXIF.IFD1Tags = {
        0x0100: "ImageWidth",
        0x0101: "ImageHeight",
        0x0102: "BitsPerSample",
        0x0103: "Compression",
        0x0106: "PhotometricInterpretation",
        0x0111: "StripOffsets",
        0x0112: "Orientation",
        0x0115: "SamplesPerPixel",
        0x0116: "RowsPerStrip",
        0x0117: "StripByteCounts",
        0x011A: "XResolution",
        0x011B: "YResolution",
        0x011C: "PlanarConfiguration",
        0x0128: "ResolutionUnit",
        0x0201: "JpegIFOffset",    // When image format is JPEG, this value show offset to JPEG data stored.(aka "ThumbnailOffset" or "JPEGInterchangeFormat")
        0x0202: "JpegIFByteCount", // When image format is JPEG, this value shows data size of JPEG image (aka "ThumbnailLength" or "JPEGInterchangeFormatLength")
        0x0211: "YCbCrCoefficients",
        0x0212: "YCbCrSubSampling",
        0x0213: "YCbCrPositioning",
        0x0214: "ReferenceBlackWhite"
    };

    var StringValues = EXIF.StringValues = {
        ExposureProgram : {
            0 : "Not defined",
            1 : "Manual",
            2 : "Normal program",
            3 : "Aperture priority",
            4 : "Shutter priority",
            5 : "Creative program",
            6 : "Action program",
            7 : "Portrait mode",
            8 : "Landscape mode"
        },
        MeteringMode : {
            0 : "Unknown",
            1 : "Average",
            2 : "CenterWeightedAverage",
            3 : "Spot",
            4 : "MultiSpot",
            5 : "Pattern",
            6 : "Partial",
            255 : "Other"
        },
        LightSource : {
            0 : "Unknown",
            1 : "Daylight",
            2 : "Fluorescent",
            3 : "Tungsten (incandescent light)",
            4 : "Flash",
            9 : "Fine weather",
            10 : "Cloudy weather",
            11 : "Shade",
            12 : "Daylight fluorescent (D 5700 - 7100K)",
            13 : "Day white fluorescent (N 4600 - 5400K)",
            14 : "Cool white fluorescent (W 3900 - 4500K)",
            15 : "White fluorescent (WW 3200 - 3700K)",
            17 : "Standard light A",
            18 : "Standard light B",
            19 : "Standard light C",
            20 : "D55",
            21 : "D65",
            22 : "D75",
            23 : "D50",
            24 : "ISO studio tungsten",
            255 : "Other"
        },
        Flash : {
            0x0000 : "Flash did not fire",
            0x0001 : "Flash fired",
            0x0005 : "Strobe return light not detected",
            0x0007 : "Strobe return light detected",
            0x0009 : "Flash fired, compulsory flash mode",
            0x000D : "Flash fired, compulsory flash mode, return light not detected",
            0x000F : "Flash fired, compulsory flash mode, return light detected",
            0x0010 : "Flash did not fire, compulsory flash mode",
            0x0018 : "Flash did not fire, auto mode",
            0x0019 : "Flash fired, auto mode",
            0x001D : "Flash fired, auto mode, return light not detected",
            0x001F : "Flash fired, auto mode, return light detected",
            0x0020 : "No flash function",
            0x0041 : "Flash fired, red-eye reduction mode",
            0x0045 : "Flash fired, red-eye reduction mode, return light not detected",
            0x0047 : "Flash fired, red-eye reduction mode, return light detected",
            0x0049 : "Flash fired, compulsory flash mode, red-eye reduction mode",
            0x004D : "Flash fired, compulsory flash mode, red-eye reduction mode, return light not detected",
            0x004F : "Flash fired, compulsory flash mode, red-eye reduction mode, return light detected",
            0x0059 : "Flash fired, auto mode, red-eye reduction mode",
            0x005D : "Flash fired, auto mode, return light not detected, red-eye reduction mode",
            0x005F : "Flash fired, auto mode, return light detected, red-eye reduction mode"
        },
        SensingMethod : {
            1 : "Not defined",
            2 : "One-chip color area sensor",
            3 : "Two-chip color area sensor",
            4 : "Three-chip color area sensor",
            5 : "Color sequential area sensor",
            7 : "Trilinear sensor",
            8 : "Color sequential linear sensor"
        },
        SceneCaptureType : {
            0 : "Standard",
            1 : "Landscape",
            2 : "Portrait",
            3 : "Night scene"
        },
        SceneType : {
            1 : "Directly photographed"
        },
        CustomRendered : {
            0 : "Normal process",
            1 : "Custom process"
        },
        WhiteBalance : {
            0 : "Auto white balance",
            1 : "Manual white balance"
        },
        GainControl : {
            0 : "None",
            1 : "Low gain up",
            2 : "High gain up",
            3 : "Low gain down",
            4 : "High gain down"
        },
        Contrast : {
            0 : "Normal",
            1 : "Soft",
            2 : "Hard"
        },
        Saturation : {
            0 : "Normal",
            1 : "Low saturation",
            2 : "High saturation"
        },
        Sharpness : {
            0 : "Normal",
            1 : "Soft",
            2 : "Hard"
        },
        SubjectDistanceRange : {
            0 : "Unknown",
            1 : "Macro",
            2 : "Close view",
            3 : "Distant view"
        },
        FileSource : {
            3 : "DSC"
        },

        Components : {
            0 : "",
            1 : "Y",
            2 : "Cb",
            3 : "Cr",
            4 : "R",
            5 : "G",
            6 : "B"
        }
    };

    function addEvent(element, event, handler) {
        if (element.addEventListener) {
            element.addEventListener(event, handler, false);
        } else if (element.attachEvent) {
            element.attachEvent("on" + event, handler);
        }
    }

    function imageHasData(img) {
        return !!(img.exifdata);
    }


    function base64ToArrayBuffer(base64, contentType) {
        contentType = contentType || base64.match(/^data\:([^\;]+)\;base64,/mi)[1] || ''; // e.g. 'data:image/jpeg;base64,...' => 'image/jpeg'
        base64 = base64.replace(/^data\:([^\;]+)\;base64,/gmi, '');
        var binary = atob(base64);
        var len = binary.length;
        var buffer = new ArrayBuffer(len);
        var view = new Uint8Array(buffer);
        for (var i = 0; i < len; i++) {
            view[i] = binary.charCodeAt(i);
        }
        return buffer;
    }

    function objectURLToBlob(url, callback) {
        var http = new XMLHttpRequest();
        http.open("GET", url, true);
        http.responseType = "blob";
        http.onload = function(e) {
            if (this.status == 200 || this.status === 0) {
                callback(this.response);
            }
        };
        http.send();
    }

    function getImageData(img, callback) {
        function handleBinaryFile(binFile) {
            var data = findEXIFinJPEG(binFile);
            var iptcdata = findIPTCinJPEG(binFile);
            var xmpdata= findXMPinJPEG(binFile);
            img.exifdata = data || {};
            img.iptcdata = iptcdata || {};
            img.xmpdata = xmpdata || {};
            if (callback) {
                callback.call(img);
            }
        }

        if (img.src) {
            if (/^data\:/i.test(img.src)) { // Data URI
                var arrayBuffer = base64ToArrayBuffer(img.src);
                handleBinaryFile(arrayBuffer);

            } else if (/^blob\:/i.test(img.src)) { // Object URL
                var fileReader = new FileReader();
                fileReader.onload = function(e) {
                    handleBinaryFile(e.target.result);
                };
                objectURLToBlob(img.src, function (blob) {
                    fileReader.readAsArrayBuffer(blob);
                });
            } else {
                var http = new XMLHttpRequest();
                http.onload = function() {
                    if (this.status == 200 || this.status === 0) {
                        handleBinaryFile(http.response);
                    } else {
                        throw "Could not load image";
                    }
                    http = null;
                };
                http.open("GET", img.src, true);
                http.responseType = "arraybuffer";
                http.send(null);
            }
        } else if (self.FileReader && (img instanceof self.Blob || img instanceof self.File)) {
            var fileReader = new FileReader();
            fileReader.onload = function(e) {
                if (debug) console.log("Got file of length " + e.target.result.byteLength);
                handleBinaryFile(e.target.result);
            };

            fileReader.readAsArrayBuffer(img);
        }
    }

    function findEXIFinJPEG(file) {
        var dataView = new DataView(file);

        if (debug) console.log("Got file of length " + file.byteLength);
        if ((dataView.getUint8(0) != 0xFF) || (dataView.getUint8(1) != 0xD8)) {
            if (debug) console.log("Not a valid JPEG");
            return false; // not a valid jpeg
        }

        var offset = 2,
            length = file.byteLength,
            marker;

        while (offset < length) {
            if (dataView.getUint8(offset) != 0xFF) {
                if (debug) console.log("Not a valid marker at offset " + offset + ", found: " + dataView.getUint8(offset));
                return false; // not a valid marker, something is wrong
            }

            marker = dataView.getUint8(offset + 1);
            if (debug) console.log(marker);

            // we could implement handling for other markers here,
            // but we're only looking for 0xFFE1 for EXIF data

            if (marker == 225) {
                if (debug) console.log("Found 0xFFE1 marker");

                return readEXIFData(dataView, offset + 4, dataView.getUint16(offset + 2) - 2);

                // offset += 2 + file.getShortAt(offset+2, true);

            } else {
                offset += 2 + dataView.getUint16(offset+2);
            }

        }

    }

    function findIPTCinJPEG(file) {
        var dataView = new DataView(file);

        if (debug) console.log("Got file of length " + file.byteLength);
        if ((dataView.getUint8(0) != 0xFF) || (dataView.getUint8(1) != 0xD8)) {
            if (debug) console.log("Not a valid JPEG");
            return false; // not a valid jpeg
        }

        var offset = 2,
            length = file.byteLength;


        var isFieldSegmentStart = function(dataView, offset){
            return (
                dataView.getUint8(offset) === 0x38 &&
                dataView.getUint8(offset+1) === 0x42 &&
                dataView.getUint8(offset+2) === 0x49 &&
                dataView.getUint8(offset+3) === 0x4D &&
                dataView.getUint8(offset+4) === 0x04 &&
                dataView.getUint8(offset+5) === 0x04
            );
        };

        while (offset < length) {

            if ( isFieldSegmentStart(dataView, offset )){

                // Get the length of the name header (which is padded to an even number of bytes)
                var nameHeaderLength = dataView.getUint8(offset+7);
                if(nameHeaderLength % 2 !== 0) nameHeaderLength += 1;
                // Check for pre photoshop 6 format
                if(nameHeaderLength === 0) {
                    // Always 4
                    nameHeaderLength = 4;
                }

                var startOffset = offset + 8 + nameHeaderLength;
                var sectionLength = dataView.getUint16(offset + 6 + nameHeaderLength);

                return readIPTCData(file, startOffset, sectionLength);

                break;

            }


            // Not the marker, continue searching
            offset++;

        }

    }
    var IptcFieldMap = {
        0x78 : 'caption',
        0x6E : 'credit',
        0x19 : 'keywords',
        0x37 : 'dateCreated',
        0x50 : 'byline',
        0x55 : 'bylineTitle',
        0x7A : 'captionWriter',
        0x69 : 'headline',
        0x74 : 'copyright',
        0x0F : 'category'
    };
    function readIPTCData(file, startOffset, sectionLength){
        var dataView = new DataView(file);
        var data = {};
        var fieldValue, fieldName, dataSize, segmentType, segmentSize;
        var segmentStartPos = startOffset;
        while(segmentStartPos < startOffset+sectionLength) {
            if(dataView.getUint8(segmentStartPos) === 0x1C && dataView.getUint8(segmentStartPos+1) === 0x02){
                segmentType = dataView.getUint8(segmentStartPos+2);
                if(segmentType in IptcFieldMap) {
                    dataSize = dataView.getInt16(segmentStartPos+3);
                    segmentSize = dataSize + 5;
                    fieldName = IptcFieldMap[segmentType];
                    fieldValue = getStringFromDB(dataView, segmentStartPos+5, dataSize);
                    // Check if we already stored a value with this name
                    if(data.hasOwnProperty(fieldName)) {
                        // Value already stored with this name, create multivalue field
                        if(data[fieldName] instanceof Array) {
                            data[fieldName].push(fieldValue);
                        }
                        else {
                            data[fieldName] = [data[fieldName], fieldValue];
                        }
                    }
                    else {
                        data[fieldName] = fieldValue;
                    }
                }

            }
            segmentStartPos++;
        }
        return data;
    }



    function readTags(file, tiffStart, dirStart, strings, bigEnd) {
        var entries = file.getUint16(dirStart, !bigEnd),
            tags = {},
            entryOffset, tag,
            i;

        for (i=0;i<entries;i++) {
            entryOffset = dirStart + i*12 + 2;
            tag = strings[file.getUint16(entryOffset, !bigEnd)];
            if (!tag && debug) console.log("Unknown tag: " + file.getUint16(entryOffset, !bigEnd));
            tags[tag] = readTagValue(file, entryOffset, tiffStart, dirStart, bigEnd);
        }
        return tags;
    }


    function readTagValue(file, entryOffset, tiffStart, dirStart, bigEnd) {
        var type = file.getUint16(entryOffset+2, !bigEnd),
            numValues = file.getUint32(entryOffset+4, !bigEnd),
            valueOffset = file.getUint32(entryOffset+8, !bigEnd) + tiffStart,
            offset,
            vals, val, n,
            numerator, denominator;

        switch (type) {
            case 1: // byte, 8-bit unsigned int
            case 7: // undefined, 8-bit byte, value depending on field
                if (numValues == 1) {
                    return file.getUint8(entryOffset + 8, !bigEnd);
                } else {
                    offset = numValues > 4 ? valueOffset : (entryOffset + 8);
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getUint8(offset + n);
                    }
                    return vals;
                }

            case 2: // ascii, 8-bit byte
                offset = numValues > 4 ? valueOffset : (entryOffset + 8);
                return getStringFromDB(file, offset, numValues-1);

            case 3: // short, 16 bit int
                if (numValues == 1) {
                    return file.getUint16(entryOffset + 8, !bigEnd);
                } else {
                    offset = numValues > 2 ? valueOffset : (entryOffset + 8);
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getUint16(offset + 2*n, !bigEnd);
                    }
                    return vals;
                }

            case 4: // long, 32 bit int
                if (numValues == 1) {
                    return file.getUint32(entryOffset + 8, !bigEnd);
                } else {
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getUint32(valueOffset + 4*n, !bigEnd);
                    }
                    return vals;
                }

            case 5:    // rational = two long values, first is numerator, second is denominator
                if (numValues == 1) {
                    numerator = file.getUint32(valueOffset, !bigEnd);
                    denominator = file.getUint32(valueOffset+4, !bigEnd);
                    val = new Number(numerator / denominator);
                    val.numerator = numerator;
                    val.denominator = denominator;
                    return val;
                } else {
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        numerator = file.getUint32(valueOffset + 8*n, !bigEnd);
                        denominator = file.getUint32(valueOffset+4 + 8*n, !bigEnd);
                        vals[n] = new Number(numerator / denominator);
                        vals[n].numerator = numerator;
                        vals[n].denominator = denominator;
                    }
                    return vals;
                }

            case 9: // slong, 32 bit signed int
                if (numValues == 1) {
                    return file.getInt32(entryOffset + 8, !bigEnd);
                } else {
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getInt32(valueOffset + 4*n, !bigEnd);
                    }
                    return vals;
                }

            case 10: // signed rational, two slongs, first is numerator, second is denominator
                if (numValues == 1) {
                    return file.getInt32(valueOffset, !bigEnd) / file.getInt32(valueOffset+4, !bigEnd);
                } else {
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getInt32(valueOffset + 8*n, !bigEnd) / file.getInt32(valueOffset+4 + 8*n, !bigEnd);
                    }
                    return vals;
                }
        }
    }

    /**
    * Given an IFD (Image File Directory) start offset
    * returns an offset to next IFD or 0 if it's the last IFD.
    */
    function getNextIFDOffset(dataView, dirStart, bigEnd){
        //the first 2bytes means the number of directory entries contains in this IFD
        var entries = dataView.getUint16(dirStart, !bigEnd);

        // After last directory entry, there is a 4bytes of data,
        // it means an offset to next IFD.
        // If its value is '0x00000000', it means this is the last IFD and there is no linked IFD.

        return dataView.getUint32(dirStart + 2 + entries * 12, !bigEnd); // each entry is 12 bytes long
    }

    function readThumbnailImage(dataView, tiffStart, firstIFDOffset, bigEnd){
        // get the IFD1 offset
        var IFD1OffsetPointer = getNextIFDOffset(dataView, tiffStart+firstIFDOffset, bigEnd);

        if (!IFD1OffsetPointer) {
            // console.log('******** IFD1Offset is empty, image thumb not found ********');
            return {};
        }
        else if (IFD1OffsetPointer > dataView.byteLength) { // this should not happen
            // console.log('******** IFD1Offset is outside the bounds of the DataView ********');
            return {};
        }
        // console.log('*******  thumbnail IFD offset (IFD1) is: %s', IFD1OffsetPointer);

        var thumbTags = readTags(dataView, tiffStart, tiffStart + IFD1OffsetPointer, IFD1Tags, bigEnd)

        // EXIF 2.3 specification for JPEG format thumbnail

        // If the value of Compression(0x0103) Tag in IFD1 is '6', thumbnail image format is JPEG.
        // Most of Exif image uses JPEG format for thumbnail. In that case, you can get offset of thumbnail
        // by JpegIFOffset(0x0201) Tag in IFD1, size of thumbnail by JpegIFByteCount(0x0202) Tag.
        // Data format is ordinary JPEG format, starts from 0xFFD8 and ends by 0xFFD9. It seems that
        // JPEG format and 160x120pixels of size are recommended thumbnail format for Exif2.1 or later.

        if (thumbTags['Compression']) {
            // console.log('Thumbnail image found!');

            switch (thumbTags['Compression']) {
                case 6:
                    // console.log('Thumbnail image format is JPEG');
                    if (thumbTags.JpegIFOffset && thumbTags.JpegIFByteCount) {
                    // extract the thumbnail
                        var tOffset = tiffStart + thumbTags.JpegIFOffset;
                        var tLength = thumbTags.JpegIFByteCount;
                        thumbTags['blob'] = new Blob([new Uint8Array(dataView.buffer, tOffset, tLength)], {
                            type: 'image/jpeg'
                        });
                    }
                break;

            case 1:
                console.log("Thumbnail image format is TIFF, which is not implemented.");
                break;
            default:
                console.log("Unknown thumbnail image format '%s'", thumbTags['Compression']);
            }
        }
        else if (thumbTags['PhotometricInterpretation'] == 2) {
            console.log("Thumbnail image format is RGB, which is not implemented.");
        }
        return thumbTags;
    }

    function getStringFromDB(buffer, start, length) {
        var outstr = "";
        for (n = start; n < start+length; n++) {
            outstr += String.fromCharCode(buffer.getUint8(n));
        }
        return outstr;
    }

    function readEXIFData(file, start) {
        if (getStringFromDB(file, start, 4) != "Exif") {
            if (debug) console.log("Not valid EXIF data! " + getStringFromDB(file, start, 4));
            return false;
        }

        var bigEnd,
            tags, tag,
            exifData, gpsData,
            tiffOffset = start + 6;

        // test for TIFF validity and endianness
        if (file.getUint16(tiffOffset) == 0x4949) {
            bigEnd = false;
        } else if (file.getUint16(tiffOffset) == 0x4D4D) {
            bigEnd = true;
        } else {
            if (debug) console.log("Not valid TIFF data! (no 0x4949 or 0x4D4D)");
            return false;
        }

        if (file.getUint16(tiffOffset+2, !bigEnd) != 0x002A) {
            if (debug) console.log("Not valid TIFF data! (no 0x002A)");
            return false;
        }

        var firstIFDOffset = file.getUint32(tiffOffset+4, !bigEnd);

        if (firstIFDOffset < 0x00000008) {
            if (debug) console.log("Not valid TIFF data! (First offset less than 8)", file.getUint32(tiffOffset+4, !bigEnd));
            return false;
        }

        tags = readTags(file, tiffOffset, tiffOffset + firstIFDOffset, TiffTags, bigEnd);

        if (tags.ExifIFDPointer) {
            exifData = readTags(file, tiffOffset, tiffOffset + tags.ExifIFDPointer, ExifTags, bigEnd);
            for (tag in exifData) {
                switch (tag) {
                    case "LightSource" :
                    case "Flash" :
                    case "MeteringMode" :
                    case "ExposureProgram" :
                    case "SensingMethod" :
                    case "SceneCaptureType" :
                    case "SceneType" :
                    case "CustomRendered" :
                    case "WhiteBalance" :
                    case "GainControl" :
                    case "Contrast" :
                    case "Saturation" :
                    case "Sharpness" :
                    case "SubjectDistanceRange" :
                    case "FileSource" :
                        exifData[tag] = StringValues[tag][exifData[tag]];
                        break;

                    case "ExifVersion" :
                    case "FlashpixVersion" :
                        exifData[tag] = String.fromCharCode(exifData[tag][0], exifData[tag][1], exifData[tag][2], exifData[tag][3]);
                        break;

                    case "ComponentsConfiguration" :
                        exifData[tag] =
                            StringValues.Components[exifData[tag][0]] +
                            StringValues.Components[exifData[tag][1]] +
                            StringValues.Components[exifData[tag][2]] +
                            StringValues.Components[exifData[tag][3]];
                        break;
                }
                tags[tag] = exifData[tag];
            }
        }

        if (tags.GPSInfoIFDPointer) {
            gpsData = readTags(file, tiffOffset, tiffOffset + tags.GPSInfoIFDPointer, GPSTags, bigEnd);
            for (tag in gpsData) {
                switch (tag) {
                    case "GPSVersionID" :
                        gpsData[tag] = gpsData[tag][0] +
                            "." + gpsData[tag][1] +
                            "." + gpsData[tag][2] +
                            "." + gpsData[tag][3];
                        break;
                }
                tags[tag] = gpsData[tag];
            }
        }

        // extract thumbnail
        tags['thumbnail'] = readThumbnailImage(file, tiffOffset, firstIFDOffset, bigEnd);

        return tags;
    }

   function findXMPinJPEG(file) {

        if (!('DOMParser' in self)) {
            // console.warn('XML parsing not supported without DOMParser');
            return;
        }
        var dataView = new DataView(file);

        if (debug) console.log("Got file of length " + file.byteLength);
        if ((dataView.getUint8(0) != 0xFF) || (dataView.getUint8(1) != 0xD8)) {
           if (debug) console.log("Not a valid JPEG");
           return false; // not a valid jpeg
        }

        var offset = 2,
            length = file.byteLength,
            dom = new DOMParser();

        while (offset < (length-4)) {
            if (getStringFromDB(dataView, offset, 4) == "http") {
                var startOffset = offset - 1;
                var sectionLength = dataView.getUint16(offset - 2) - 1;
                var xmpString = getStringFromDB(dataView, startOffset, sectionLength)
                var xmpEndIndex = xmpString.indexOf('xmpmeta>') + 8;
                xmpString = xmpString.substring( xmpString.indexOf( '<x:xmpmeta' ), xmpEndIndex );

                var indexOfXmp = xmpString.indexOf('x:xmpmeta') + 10
                //Many custom written programs embed xmp/xml without any namespace. Following are some of them.
                //Without these namespaces, XML is thought to be invalid by parsers
                xmpString = xmpString.slice(0, indexOfXmp)
                            + 'xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/" '
                            + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                            + 'xmlns:tiff="http://ns.adobe.com/tiff/1.0/" '
                            + 'xmlns:plus="http://schemas.android.com/apk/lib/com.google.android.gms.plus" '
                            + 'xmlns:ext="http://www.gettyimages.com/xsltExtension/1.0" '
                            + 'xmlns:exif="http://ns.adobe.com/exif/1.0/" '
                            + 'xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#" '
                            + 'xmlns:stRef="http://ns.adobe.com/xap/1.0/sType/ResourceRef#" '
                            + 'xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/" '
                            + 'xmlns:xapGImg="http://ns.adobe.com/xap/1.0/g/img/" '
                            + 'xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" '
                            + xmpString.slice(indexOfXmp)

                var domDocument = dom.parseFromString( xmpString, 'text/xml' );
                return xml2Object(domDocument);
            } else{
             offset++;
            }
        }
    }

    function xml2Object(xml) {
        try {
            var obj = {};
            if (xml.children.length > 0) {
              for (var i = 0; i < xml.children.length; i++) {
                var item = xml.children.item(i);
                var attributes = item.attributes;
                for(var idx in attributes) {
                    var itemAtt = attributes[idx];
                    var dataKey = itemAtt.nodeName;
                    var dataValue = itemAtt.nodeValue;

                    if(dataKey !== undefined) {
                        obj[dataKey] = dataValue;
                    }
                }
                var nodeName = item.nodeName;

                if (typeof (obj[nodeName]) == "undefined") {
                  obj[nodeName] = xml2json(item);
                } else {
                  if (typeof (obj[nodeName].push) == "undefined") {
                    var old = obj[nodeName];

                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                  }
                  obj[nodeName].push(xml2json(item));
                }
              }
            } else {
              obj = xml.textContent;
            }
            return obj;
          } catch (e) {
              console.log(e.message);
          }
    }

    EXIF.getData = function(img, callback) {
        if ((self.Image && img instanceof self.Image)
            || (self.HTMLImageElement && img instanceof self.HTMLImageElement)
            && !img.complete)
            return false;

        if (!imageHasData(img)) {
            getImageData(img, callback);
        } else {
            if (callback) {
                callback.call(img);
            }
        }
        return true;
    }

    EXIF.getTag = function(img, tag) {
        if (!imageHasData(img)) return;
        return img.exifdata[tag];
    }
    
    EXIF.getIptcTag = function(img, tag) {
        if (!imageHasData(img)) return;
        return img.iptcdata[tag];
    }

    EXIF.getAllTags = function(img) {
        if (!imageHasData(img)) return {};
        var a,
            data = img.exifdata,
            tags = {};
        for (a in data) {
            if (data.hasOwnProperty(a)) {
                tags[a] = data[a];
            }
        }
        return tags;
    }
    
    EXIF.getAllIptcTags = function(img) {
        if (!imageHasData(img)) return {};
        var a,
            data = img.iptcdata,
            tags = {};
        for (a in data) {
            if (data.hasOwnProperty(a)) {
                tags[a] = data[a];
            }
        }
        return tags;
    }

    EXIF.pretty = function(img) {
        if (!imageHasData(img)) return "";
        var a,
            data = img.exifdata,
            strPretty = "";
        for (a in data) {
            if (data.hasOwnProperty(a)) {
                if (typeof data[a] == "object") {
                    if (data[a] instanceof Number) {
                        strPretty += a + " : " + data[a] + " [" + data[a].numerator + "/" + data[a].denominator + "]\r\n";
                    } else {
                        strPretty += a + " : [" + data[a].length + " values]\r\n";
                    }
                } else {
                    strPretty += a + " : " + data[a] + "\r\n";
                }
            }
        }
        return strPretty;
    }

    EXIF.readFromBinaryFile = function(file) {
        return findEXIFinJPEG(file);
    }

    if (typeof define === 'function' && define.amd) {
        define('exif-js', [], function() {
            return EXIF;
        });
    }
}.call(this));


},{}],42:[function(require,module,exports){
(function (Buffer){
'use strict';
const {stringToBytes, readUInt64LE, tarHeaderChecksumMatches} = require('./util');

const xpiZipFilename = stringToBytes('META-INF/mozilla.rsa');
const oxmlContentTypes = stringToBytes('[Content_Types].xml');
const oxmlRels = stringToBytes('_rels/.rels');

const fileType = input => {
	if (!(input instanceof Uint8Array || input instanceof ArrayBuffer || Buffer.isBuffer(input))) {
		throw new TypeError(`Expected the \`input\` argument to be of type \`Uint8Array\` or \`Buffer\` or \`ArrayBuffer\`, got \`${typeof input}\``);
	}

	const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);

	if (!(buffer && buffer.length > 1)) {
		return;
	}

	const check = (header, options) => {
		options = Object.assign({
			offset: 0
		}, options);

		for (let i = 0; i < header.length; i++) {
			// If a bitmask is set
			if (options.mask) {
				// If header doesn't equal `buf` with bits masked off
				if (header[i] !== (options.mask[i] & buffer[i + options.offset])) {
					return false;
				}
			} else if (header[i] !== buffer[i + options.offset]) {
				return false;
			}
		}

		return true;
	};

	const checkString = (header, options) => check(stringToBytes(header), options);

	if (check([0xFF, 0xD8, 0xFF])) {
		return {
			ext: 'jpg',
			mime: 'image/jpeg'
		};
	}

	if (check([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
		return {
			ext: 'png',
			mime: 'image/png'
		};
	}

	if (check([0x47, 0x49, 0x46])) {
		return {
			ext: 'gif',
			mime: 'image/gif'
		};
	}

	if (check([0x57, 0x45, 0x42, 0x50], {offset: 8})) {
		return {
			ext: 'webp',
			mime: 'image/webp'
		};
	}

	if (check([0x46, 0x4C, 0x49, 0x46])) {
		return {
			ext: 'flif',
			mime: 'image/flif'
		};
	}

	// Needs to be before `tif` check
	if (
		(check([0x49, 0x49, 0x2A, 0x0]) || check([0x4D, 0x4D, 0x0, 0x2A])) &&
		check([0x43, 0x52], {offset: 8})
	) {
		return {
			ext: 'cr2',
			mime: 'image/x-canon-cr2'
		};
	}

	if (
		check([0x49, 0x49, 0x2A, 0x0]) ||
		check([0x4D, 0x4D, 0x0, 0x2A])
	) {
		return {
			ext: 'tif',
			mime: 'image/tiff'
		};
	}

	if (check([0x42, 0x4D])) {
		return {
			ext: 'bmp',
			mime: 'image/bmp'
		};
	}

	if (check([0x49, 0x49, 0xBC])) {
		return {
			ext: 'jxr',
			mime: 'image/vnd.ms-photo'
		};
	}

	if (check([0x38, 0x42, 0x50, 0x53])) {
		return {
			ext: 'psd',
			mime: 'image/vnd.adobe.photoshop'
		};
	}

	// Zip-based file formats
	// Need to be before the `zip` check
	if (check([0x50, 0x4B, 0x3, 0x4])) {
		if (
			check([0x6D, 0x69, 0x6D, 0x65, 0x74, 0x79, 0x70, 0x65, 0x61, 0x70, 0x70, 0x6C, 0x69, 0x63, 0x61, 0x74, 0x69, 0x6F, 0x6E, 0x2F, 0x65, 0x70, 0x75, 0x62, 0x2B, 0x7A, 0x69, 0x70], {offset: 30})
		) {
			return {
				ext: 'epub',
				mime: 'application/epub+zip'
			};
		}

		// Assumes signed `.xpi` from addons.mozilla.org
		if (check(xpiZipFilename, {offset: 30})) {
			return {
				ext: 'xpi',
				mime: 'application/x-xpinstall'
			};
		}

		if (checkString('mimetypeapplication/vnd.oasis.opendocument.text', {offset: 30})) {
			return {
				ext: 'odt',
				mime: 'application/vnd.oasis.opendocument.text'
			};
		}

		if (checkString('mimetypeapplication/vnd.oasis.opendocument.spreadsheet', {offset: 30})) {
			return {
				ext: 'ods',
				mime: 'application/vnd.oasis.opendocument.spreadsheet'
			};
		}

		if (checkString('mimetypeapplication/vnd.oasis.opendocument.presentation', {offset: 30})) {
			return {
				ext: 'odp',
				mime: 'application/vnd.oasis.opendocument.presentation'
			};
		}

		// The docx, xlsx and pptx file types extend the Office Open XML file format:
		// https://en.wikipedia.org/wiki/Office_Open_XML_file_formats
		// We look for:
		// - one entry named '[Content_Types].xml' or '_rels/.rels',
		// - one entry indicating specific type of file.
		// MS Office, OpenOffice and LibreOffice may put the parts in different order, so the check should not rely on it.
		const findNextZipHeaderIndex = (arr, startAt = 0) => arr.findIndex((el, i, arr) => i >= startAt && arr[i] === 0x50 && arr[i + 1] === 0x4B && arr[i + 2] === 0x3 && arr[i + 3] === 0x4);

		let zipHeaderIndex = 0; // The first zip header was already found at index 0
		let oxmlFound = false;
		let type;

		do {
			const offset = zipHeaderIndex + 30;

			if (!oxmlFound) {
				oxmlFound = (check(oxmlContentTypes, {offset}) || check(oxmlRels, {offset}));
			}

			if (!type) {
				if (checkString('word/', {offset})) {
					type = {
						ext: 'docx',
						mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
					};
				} else if (checkString('ppt/', {offset})) {
					type = {
						ext: 'pptx',
						mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
					};
				} else if (checkString('xl/', {offset})) {
					type = {
						ext: 'xlsx',
						mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
					};
				}
			}

			if (oxmlFound && type) {
				return type;
			}

			zipHeaderIndex = findNextZipHeaderIndex(buffer, offset);
		} while (zipHeaderIndex >= 0);

		// No more zip parts available in the buffer, but maybe we are almost certain about the type?
		if (type) {
			return type;
		}
	}

	if (
		check([0x50, 0x4B]) &&
		(buffer[2] === 0x3 || buffer[2] === 0x5 || buffer[2] === 0x7) &&
		(buffer[3] === 0x4 || buffer[3] === 0x6 || buffer[3] === 0x8)
	) {
		return {
			ext: 'zip',
			mime: 'application/zip'
		};
	}

	if (
		check([0x30, 0x30, 0x30, 0x30, 0x30, 0x30], {offset: 148, mask: [0xF8, 0xF8, 0xF8, 0xF8, 0xF8, 0xF8]}) && // Valid tar checksum
		tarHeaderChecksumMatches(buffer)
	) {
		return {
			ext: 'tar',
			mime: 'application/x-tar'
		};
	}

	if (
		check([0x52, 0x61, 0x72, 0x21, 0x1A, 0x7]) &&
		(buffer[6] === 0x0 || buffer[6] === 0x1)
	) {
		return {
			ext: 'rar',
			mime: 'application/x-rar-compressed'
		};
	}

	if (check([0x1F, 0x8B, 0x8])) {
		return {
			ext: 'gz',
			mime: 'application/gzip'
		};
	}

	if (check([0x42, 0x5A, 0x68])) {
		return {
			ext: 'bz2',
			mime: 'application/x-bzip2'
		};
	}

	if (check([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C])) {
		return {
			ext: '7z',
			mime: 'application/x-7z-compressed'
		};
	}

	if (check([0x78, 0x01])) {
		return {
			ext: 'dmg',
			mime: 'application/x-apple-diskimage'
		};
	}

	// `mov` format variants
	if (
		check([0x66, 0x72, 0x65, 0x65], {offset: 4}) || // `free`
		check([0x6D, 0x64, 0x61, 0x74], {offset: 4}) || // `mdat` MJPEG
		check([0x6D, 0x6F, 0x6F, 0x76], {offset: 4}) || // `moov`
		check([0x77, 0x69, 0x64, 0x65], {offset: 4}) // `wide`
	) {
		return {
			ext: 'mov',
			mime: 'video/quicktime'
		};
	}

	// File Type Box (https://en.wikipedia.org/wiki/ISO_base_media_file_format)
	// It's not required to be first, but it's recommended to be. Almost all ISO base media files start with `ftyp` box.
	// `ftyp` box must contain a brand major identifier, which must consist of ISO 8859-1 printable characters.
	// Here we check for 8859-1 printable characters (for simplicity, it's a mask which also catches one non-printable character).
	if (
		check([0x66, 0x74, 0x79, 0x70], {offset: 4}) && // `ftyp`
		(buffer[8] & 0x60) !== 0x00 && (buffer[9] & 0x60) !== 0x00 && (buffer[10] & 0x60) !== 0x00 && (buffer[11] & 0x60) !== 0x00 // Brand major
	) {
		// They all can have MIME `video/mp4` except `application/mp4` special-case which is hard to detect.
		// For some cases, we're specific, everything else falls to `video/mp4` with `mp4` extension.
		const brandMajor = buffer.toString('utf8', 8, 12);
		switch (brandMajor) {
			case 'mif1':
				return {ext: 'heic', mime: 'image/heif'};
			case 'msf1':
				return {ext: 'heic', mime: 'image/heif-sequence'};
			case 'heic': case 'heix':
				return {ext: 'heic', mime: 'image/heic'};
			case 'hevc': case 'hevx':
				return {ext: 'heic', mime: 'image/heic-sequence'};
			case 'qt  ':
				return {ext: 'mov', mime: 'video/quicktime'};
			case 'M4V ': case 'M4VH': case 'M4VP':
				return {ext: 'm4v', mime: 'video/x-m4v'};
			case 'M4P ':
				return {ext: 'm4p', mime: 'video/mp4'};
			case 'M4B ':
				return {ext: 'm4b', mime: 'audio/mp4'};
			case 'M4A ':
				return {ext: 'm4a', mime: 'audio/x-m4a'};
			case 'F4V ':
				return {ext: 'f4v', mime: 'video/mp4'};
			case 'F4P ':
				return {ext: 'f4p', mime: 'video/mp4'};
			case 'F4A ':
				return {ext: 'f4a', mime: 'audio/mp4'};
			case 'F4B ':
				return {ext: 'f4b', mime: 'audio/mp4'};
			default:
				if (brandMajor.startsWith('3g')) {
					if (brandMajor.startsWith('3g2')) {
						return {ext: '3g2', mime: 'video/3gpp2'};
					}

					return {ext: '3gp', mime: 'video/3gpp'};
				}

				return {ext: 'mp4', mime: 'video/mp4'};
		}
	}

	if (check([0x4D, 0x54, 0x68, 0x64])) {
		return {
			ext: 'mid',
			mime: 'audio/midi'
		};
	}

	// https://github.com/threatstack/libmagic/blob/master/magic/Magdir/matroska
	if (check([0x1A, 0x45, 0xDF, 0xA3])) {
		const sliced = buffer.subarray(4, 4 + 4096);
		const idPos = sliced.findIndex((el, i, arr) => arr[i] === 0x42 && arr[i + 1] === 0x82);

		if (idPos !== -1) {
			const docTypePos = idPos + 3;
			const findDocType = type => [...type].every((c, i) => sliced[docTypePos + i] === c.charCodeAt(0));

			if (findDocType('matroska')) {
				return {
					ext: 'mkv',
					mime: 'video/x-matroska'
				};
			}

			if (findDocType('webm')) {
				return {
					ext: 'webm',
					mime: 'video/webm'
				};
			}
		}
	}

	// RIFF file format which might be AVI, WAV, QCP, etc
	if (check([0x52, 0x49, 0x46, 0x46])) {
		if (check([0x41, 0x56, 0x49], {offset: 8})) {
			return {
				ext: 'avi',
				mime: 'video/vnd.avi'
			};
		}

		if (check([0x57, 0x41, 0x56, 0x45], {offset: 8})) {
			return {
				ext: 'wav',
				mime: 'audio/vnd.wave'
			};
		}

		// QLCM, QCP file
		if (check([0x51, 0x4C, 0x43, 0x4D], {offset: 8})) {
			return {
				ext: 'qcp',
				mime: 'audio/qcelp'
			};
		}
	}

	// ASF_Header_Object first 80 bytes
	if (check([0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11, 0xA6, 0xD9])) {
		// Search for header should be in first 1KB of file.

		let offset = 30;
		do {
			const objectSize = readUInt64LE(buffer, offset + 16);
			if (check([0x91, 0x07, 0xDC, 0xB7, 0xB7, 0xA9, 0xCF, 0x11, 0x8E, 0xE6, 0x00, 0xC0, 0x0C, 0x20, 0x53, 0x65], {offset})) {
				// Sync on Stream-Properties-Object (B7DC0791-A9B7-11CF-8EE6-00C00C205365)
				if (check([0x40, 0x9E, 0x69, 0xF8, 0x4D, 0x5B, 0xCF, 0x11, 0xA8, 0xFD, 0x00, 0x80, 0x5F, 0x5C, 0x44, 0x2B], {offset: offset + 24})) {
					// Found audio:
					return {
						ext: 'wma',
						mime: 'audio/x-ms-wma'
					};
				}

				if (check([0xC0, 0xEF, 0x19, 0xBC, 0x4D, 0x5B, 0xCF, 0x11, 0xA8, 0xFD, 0x00, 0x80, 0x5F, 0x5C, 0x44, 0x2B], {offset: offset + 24})) {
					// Found video:
					return {
						ext: 'wmv',
						mime: 'video/x-ms-asf'
					};
				}

				break;
			}

			offset += objectSize;
		} while (offset + 24 <= buffer.length);

		// Default to ASF generic extension
		return {
			ext: 'asf',
			mime: 'application/vnd.ms-asf'
		};
	}

	if (
		check([0x0, 0x0, 0x1, 0xBA]) ||
		check([0x0, 0x0, 0x1, 0xB3])
	) {
		return {
			ext: 'mpg',
			mime: 'video/mpeg'
		};
	}

	// Check for MPEG header at different starting offsets
	for (let start = 0; start < 2 && start < (buffer.length - 16); start++) {
		if (
			check([0x49, 0x44, 0x33], {offset: start}) || // ID3 header
			check([0xFF, 0xE2], {offset: start, mask: [0xFF, 0xE6]}) // MPEG 1 or 2 Layer 3 header
		) {
			return {
				ext: 'mp3',
				mime: 'audio/mpeg'
			};
		}

		if (
			check([0xFF, 0xE4], {offset: start, mask: [0xFF, 0xE6]}) // MPEG 1 or 2 Layer 2 header
		) {
			return {
				ext: 'mp2',
				mime: 'audio/mpeg'
			};
		}

		if (
			check([0xFF, 0xF8], {offset: start, mask: [0xFF, 0xFC]}) // MPEG 2 layer 0 using ADTS
		) {
			return {
				ext: 'mp2',
				mime: 'audio/mpeg'
			};
		}

		if (
			check([0xFF, 0xF0], {offset: start, mask: [0xFF, 0xFC]}) // MPEG 4 layer 0 using ADTS
		) {
			return {
				ext: 'mp4',
				mime: 'audio/mpeg'
			};
		}
	}

	// Needs to be before `ogg` check
	if (check([0x4F, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], {offset: 28})) {
		return {
			ext: 'opus',
			mime: 'audio/opus'
		};
	}

	// If 'OggS' in first  bytes, then OGG container
	if (check([0x4F, 0x67, 0x67, 0x53])) {
		// This is a OGG container

		// If ' theora' in header.
		if (check([0x80, 0x74, 0x68, 0x65, 0x6F, 0x72, 0x61], {offset: 28})) {
			return {
				ext: 'ogv',
				mime: 'video/ogg'
			};
		}

		// If '\x01video' in header.
		if (check([0x01, 0x76, 0x69, 0x64, 0x65, 0x6F, 0x00], {offset: 28})) {
			return {
				ext: 'ogm',
				mime: 'video/ogg'
			};
		}

		// If ' FLAC' in header  https://xiph.org/flac/faq.html
		if (check([0x7F, 0x46, 0x4C, 0x41, 0x43], {offset: 28})) {
			return {
				ext: 'oga',
				mime: 'audio/ogg'
			};
		}

		// 'Speex  ' in header https://en.wikipedia.org/wiki/Speex
		if (check([0x53, 0x70, 0x65, 0x65, 0x78, 0x20, 0x20], {offset: 28})) {
			return {
				ext: 'spx',
				mime: 'audio/ogg'
			};
		}

		// If '\x01vorbis' in header
		if (check([0x01, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73], {offset: 28})) {
			return {
				ext: 'ogg',
				mime: 'audio/ogg'
			};
		}

		// Default OGG container https://www.iana.org/assignments/media-types/application/ogg
		return {
			ext: 'ogx',
			mime: 'application/ogg'
		};
	}

	if (check([0x66, 0x4C, 0x61, 0x43])) {
		return {
			ext: 'flac',
			mime: 'audio/x-flac'
		};
	}

	if (check([0x4D, 0x41, 0x43, 0x20])) { // 'MAC '
		return {
			ext: 'ape',
			mime: 'audio/ape'
		};
	}

	if (check([0x77, 0x76, 0x70, 0x6B])) { // 'wvpk'
		return {
			ext: 'wv',
			mime: 'audio/wavpack'
		};
	}

	if (check([0x23, 0x21, 0x41, 0x4D, 0x52, 0x0A])) {
		return {
			ext: 'amr',
			mime: 'audio/amr'
		};
	}

	if (check([0x25, 0x50, 0x44, 0x46])) {
		return {
			ext: 'pdf',
			mime: 'application/pdf'
		};
	}

	if (check([0x4D, 0x5A])) {
		return {
			ext: 'exe',
			mime: 'application/x-msdownload'
		};
	}

	if (
		(buffer[0] === 0x43 || buffer[0] === 0x46) &&
		check([0x57, 0x53], {offset: 1})
	) {
		return {
			ext: 'swf',
			mime: 'application/x-shockwave-flash'
		};
	}

	if (check([0x7B, 0x5C, 0x72, 0x74, 0x66])) {
		return {
			ext: 'rtf',
			mime: 'application/rtf'
		};
	}

	if (check([0x00, 0x61, 0x73, 0x6D])) {
		return {
			ext: 'wasm',
			mime: 'application/wasm'
		};
	}

	if (
		check([0x77, 0x4F, 0x46, 0x46]) &&
		(
			check([0x00, 0x01, 0x00, 0x00], {offset: 4}) ||
			check([0x4F, 0x54, 0x54, 0x4F], {offset: 4})
		)
	) {
		return {
			ext: 'woff',
			mime: 'font/woff'
		};
	}

	if (
		check([0x77, 0x4F, 0x46, 0x32]) &&
		(
			check([0x00, 0x01, 0x00, 0x00], {offset: 4}) ||
			check([0x4F, 0x54, 0x54, 0x4F], {offset: 4})
		)
	) {
		return {
			ext: 'woff2',
			mime: 'font/woff2'
		};
	}

	if (
		check([0x4C, 0x50], {offset: 34}) &&
		(
			check([0x00, 0x00, 0x01], {offset: 8}) ||
			check([0x01, 0x00, 0x02], {offset: 8}) ||
			check([0x02, 0x00, 0x02], {offset: 8})
		)
	) {
		return {
			ext: 'eot',
			mime: 'application/vnd.ms-fontobject'
		};
	}

	if (check([0x00, 0x01, 0x00, 0x00, 0x00])) {
		return {
			ext: 'ttf',
			mime: 'font/ttf'
		};
	}

	if (check([0x4F, 0x54, 0x54, 0x4F, 0x00])) {
		return {
			ext: 'otf',
			mime: 'font/otf'
		};
	}

	if (check([0x00, 0x00, 0x01, 0x00])) {
		return {
			ext: 'ico',
			mime: 'image/x-icon'
		};
	}

	if (check([0x00, 0x00, 0x02, 0x00])) {
		return {
			ext: 'cur',
			mime: 'image/x-icon'
		};
	}

	if (check([0x46, 0x4C, 0x56, 0x01])) {
		return {
			ext: 'flv',
			mime: 'video/x-flv'
		};
	}

	if (check([0x25, 0x21])) {
		return {
			ext: 'ps',
			mime: 'application/postscript'
		};
	}

	if (check([0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00])) {
		return {
			ext: 'xz',
			mime: 'application/x-xz'
		};
	}

	if (check([0x53, 0x51, 0x4C, 0x69])) {
		return {
			ext: 'sqlite',
			mime: 'application/x-sqlite3'
		};
	}

	if (check([0x4E, 0x45, 0x53, 0x1A])) {
		return {
			ext: 'nes',
			mime: 'application/x-nintendo-nes-rom'
		};
	}

	if (check([0x43, 0x72, 0x32, 0x34])) {
		return {
			ext: 'crx',
			mime: 'application/x-google-chrome-extension'
		};
	}

	if (
		check([0x4D, 0x53, 0x43, 0x46]) ||
		check([0x49, 0x53, 0x63, 0x28])
	) {
		return {
			ext: 'cab',
			mime: 'application/vnd.ms-cab-compressed'
		};
	}

	// Needs to be before `ar` check
	if (check([0x21, 0x3C, 0x61, 0x72, 0x63, 0x68, 0x3E, 0x0A, 0x64, 0x65, 0x62, 0x69, 0x61, 0x6E, 0x2D, 0x62, 0x69, 0x6E, 0x61, 0x72, 0x79])) {
		return {
			ext: 'deb',
			mime: 'application/x-deb'
		};
	}

	if (check([0x21, 0x3C, 0x61, 0x72, 0x63, 0x68, 0x3E])) {
		return {
			ext: 'ar',
			mime: 'application/x-unix-archive'
		};
	}

	if (check([0xED, 0xAB, 0xEE, 0xDB])) {
		return {
			ext: 'rpm',
			mime: 'application/x-rpm'
		};
	}

	if (
		check([0x1F, 0xA0]) ||
		check([0x1F, 0x9D])
	) {
		return {
			ext: 'Z',
			mime: 'application/x-compress'
		};
	}

	if (check([0x4C, 0x5A, 0x49, 0x50])) {
		return {
			ext: 'lz',
			mime: 'application/x-lzip'
		};
	}

	if (check([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) {
		return {
			ext: 'msi',
			mime: 'application/x-msi'
		};
	}

	if (check([0x06, 0x0E, 0x2B, 0x34, 0x02, 0x05, 0x01, 0x01, 0x0D, 0x01, 0x02, 0x01, 0x01, 0x02])) {
		return {
			ext: 'mxf',
			mime: 'application/mxf'
		};
	}

	if (check([0x47], {offset: 4}) && (check([0x47], {offset: 192}) || check([0x47], {offset: 196}))) {
		return {
			ext: 'mts',
			mime: 'video/mp2t'
		};
	}

	if (check([0x42, 0x4C, 0x45, 0x4E, 0x44, 0x45, 0x52])) {
		return {
			ext: 'blend',
			mime: 'application/x-blender'
		};
	}

	if (check([0x42, 0x50, 0x47, 0xFB])) {
		return {
			ext: 'bpg',
			mime: 'image/bpg'
		};
	}

	if (check([0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20, 0x0D, 0x0A, 0x87, 0x0A])) {
		// JPEG-2000 family

		if (check([0x6A, 0x70, 0x32, 0x20], {offset: 20})) {
			return {
				ext: 'jp2',
				mime: 'image/jp2'
			};
		}

		if (check([0x6A, 0x70, 0x78, 0x20], {offset: 20})) {
			return {
				ext: 'jpx',
				mime: 'image/jpx'
			};
		}

		if (check([0x6A, 0x70, 0x6D, 0x20], {offset: 20})) {
			return {
				ext: 'jpm',
				mime: 'image/jpm'
			};
		}

		if (check([0x6D, 0x6A, 0x70, 0x32], {offset: 20})) {
			return {
				ext: 'mj2',
				mime: 'image/mj2'
			};
		}
	}

	if (check([0x46, 0x4F, 0x52, 0x4D])) {
		return {
			ext: 'aif',
			mime: 'audio/aiff'
		};
	}

	if (checkString('<?xml ')) {
		return {
			ext: 'xml',
			mime: 'application/xml'
		};
	}

	if (check([0x42, 0x4F, 0x4F, 0x4B, 0x4D, 0x4F, 0x42, 0x49], {offset: 60})) {
		return {
			ext: 'mobi',
			mime: 'application/x-mobipocket-ebook'
		};
	}

	if (check([0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A])) {
		return {
			ext: 'ktx',
			mime: 'image/ktx'
		};
	}

	if (check([0x44, 0x49, 0x43, 0x4D], {offset: 128})) {
		return {
			ext: 'dcm',
			mime: 'application/dicom'
		};
	}

	// Musepack, SV7
	if (check([0x4D, 0x50, 0x2B])) {
		return {
			ext: 'mpc',
			mime: 'audio/x-musepack'
		};
	}

	// Musepack, SV8
	if (check([0x4D, 0x50, 0x43, 0x4B])) {
		return {
			ext: 'mpc',
			mime: 'audio/x-musepack'
		};
	}

	if (check([0x42, 0x45, 0x47, 0x49, 0x4E, 0x3A])) {
		return {
			ext: 'ics',
			mime: 'text/calendar'
		};
	}

	if (check([0x67, 0x6C, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00])) {
		return {
			ext: 'glb',
			mime: 'model/gltf-binary'
		};
	}

	if (check([0xD4, 0xC3, 0xB2, 0xA1]) || check([0xA1, 0xB2, 0xC3, 0xD4])) {
		return {
			ext: 'pcap',
			mime: 'application/vnd.tcpdump.pcap'
		};
	}

	// Sony DSD Stream File (DSF)
	if (check([0x44, 0x53, 0x44, 0x20])) {
		return {
			ext: 'dsf',
			mime: 'audio/x-dsf' // Non-standard
		};
	}

	if (check([0x4C, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46])) {
		return {
			ext: 'lnk',
			mime: 'application/x.ms.shortcut' // Invented by us
		};
	}

	if (check([0x62, 0x6F, 0x6F, 0x6B, 0x00, 0x00, 0x00, 0x00, 0x6D, 0x61, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x00])) {
		return {
			ext: 'alias',
			mime: 'application/x.apple.alias' // Invented by us
		};
	}

	if (checkString('Creative Voice File')) {
		return {
			ext: 'voc',
			mime: 'audio/x-voc'
		};
	}

	if (check([0x0B, 0x77])) {
		return {
			ext: 'ac3',
			mime: 'audio/vnd.dolby.dd-raw'
		};
	}
};

module.exports = fileType;

Object.defineProperty(fileType, 'minimumBytes', {value: 4100});

fileType.stream = readableStream => new Promise((resolve, reject) => {
	// Using `eval` to work around issues when bundling with Webpack
	const stream = eval('require')('stream'); // eslint-disable-line no-eval

	readableStream.once('readable', () => {
		const pass = new stream.PassThrough();
		const chunk = readableStream.read(module.exports.minimumBytes) || readableStream.read();
		try {
			pass.fileType = fileType(chunk);
		} catch (error) {
			reject(error);
		}

		readableStream.unshift(chunk);

		if (stream.pipeline) {
			resolve(stream.pipeline(readableStream, pass, () => {}));
		} else {
			resolve(readableStream.pipe(pass));
		}
	});
});

}).call(this,{"isBuffer":require("../is-buffer/index.js")})
},{"../is-buffer/index.js":47,"./util":43}],43:[function(require,module,exports){
'use strict';

exports.stringToBytes = string => [...string].map(character => character.charCodeAt(0));

exports.readUInt64LE = (buffer, offset = 0) => {
	let n = buffer[offset];
	let mul = 1;
	let i = 0;

	while (++i < 8) {
		mul *= 0x100;
		n += buffer[offset + i] * mul;
	}

	return n;
};

exports.tarHeaderChecksumMatches = buffer => { // Does not check if checksum field characters are valid
	if (buffer.length < 512) { // `tar` header size, cannot compute checksum without it
		return false;
	}

	const MASK_8TH_BIT = 0x80;

	let sum = 256; // Intitalize sum, with 256 as sum of 8 spaces in checksum field
	let signedBitSum = 0; // Initialize signed bit sum

	for (let i = 0; i < 148; i++) {
		const byte = buffer[i];
		sum += byte;
		signedBitSum += byte & MASK_8TH_BIT; // Add signed bit to signed bit sum
	}

	// Skip checksum field

	for (let i = 156; i < 512; i++) {
		const byte = buffer[i];
		sum += byte;
		signedBitSum += byte & MASK_8TH_BIT; // Add signed bit to signed bit sum
	}

	const readSum = parseInt(buffer.toString('utf8', 148, 154), 8); // Read sum in header

	// Some implementations compute checksum incorrectly using signed bytes
	return (
		// Checksum in header equals the sum we calculated
		readSum === sum ||

		// Checksum in header equals sum we calculated plus signed-to-unsigned delta
		readSum === (sum - (signedBitSum << 1))
	);
};

},{}],44:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],45:[function(require,module,exports){
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("iq", [], factory);
	else if(typeof exports === 'object')
		exports["iq"] = factory();
	else
		root["iq"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * iq.ts - Image Quantization Library
	 */
	var constants = __webpack_require__(1);
	exports.constants = constants;
	var conversion = __webpack_require__(3);
	exports.conversion = conversion;
	var distance = __webpack_require__(12);
	exports.distance = distance;
	var palette = __webpack_require__(20);
	exports.palette = palette;
	var image = __webpack_require__(30);
	exports.image = image;
	var quality = __webpack_require__(35);
	exports.quality = quality;
	var utils = __webpack_require__(37);
	exports.utils = utils;


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * constants.ts - part of Image Quantization Library
	 */
	var bt709 = __webpack_require__(2);
	exports.bt709 = bt709;


/***/ },
/* 2 */
/***/ function(module, exports) {

	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * constants.ts - part of Image Quantization Library
	 */
	"use strict";
	/**
	 * sRGB (based on ITU-R Recommendation BT.709)
	 * http://en.wikipedia.org/wiki/SRGB
	 */
	var Y;
	(function (Y) {
	    Y[Y["RED"] = 0.2126] = "RED";
	    Y[Y["GREEN"] = 0.7152] = "GREEN";
	    Y[Y["BLUE"] = 0.0722] = "BLUE";
	    Y[Y["WHITE"] = 1] = "WHITE";
	})(Y || (Y = {}));
	exports.Y = Y;
	var x;
	(function (x) {
	    x[x["RED"] = 0.64] = "RED";
	    x[x["GREEN"] = 0.3] = "GREEN";
	    x[x["BLUE"] = 0.15] = "BLUE";
	    x[x["WHITE"] = 0.3127] = "WHITE";
	})(x || (x = {}));
	exports.x = x;
	var y;
	(function (y) {
	    y[y["RED"] = 0.33] = "RED";
	    y[y["GREEN"] = 0.6] = "GREEN";
	    y[y["BLUE"] = 0.06] = "BLUE";
	    y[y["WHITE"] = 0.329] = "WHITE";
	})(y || (y = {}));
	exports.y = y;


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * iq.ts - Image Quantization Library
	 */
	var rgb2xyz_1 = __webpack_require__(4);
	exports.rgb2xyz = rgb2xyz_1.rgb2xyz;
	var rgb2hsl_1 = __webpack_require__(5);
	exports.rgb2hsl = rgb2hsl_1.rgb2hsl;
	var rgb2lab_1 = __webpack_require__(7);
	exports.rgb2lab = rgb2lab_1.rgb2lab;
	var lab2xyz_1 = __webpack_require__(9);
	exports.lab2xyz = lab2xyz_1.lab2xyz;
	var lab2rgb_1 = __webpack_require__(10);
	exports.lab2rgb = lab2rgb_1.lab2rgb;
	var xyz2lab_1 = __webpack_require__(8);
	exports.xyz2lab = xyz2lab_1.xyz2lab;
	var xyz2rgb_1 = __webpack_require__(11);
	exports.xyz2rgb = xyz2rgb_1.xyz2rgb;


/***/ },
/* 4 */
/***/ function(module, exports) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * rgb2xyz.ts - part of Image Quantization Library
	 */
	function correctGamma(n) {
	    return n > 0.04045 ? Math.pow((n + 0.055) / 1.055, 2.4) : n / 12.92;
	}
	function rgb2xyz(r, g, b) {
	    // gamma correction, see https://en.wikipedia.org/wiki/SRGB#The_reverse_transformation
	    r = correctGamma(r / 255);
	    g = correctGamma(g / 255);
	    b = correctGamma(b / 255);
	    // Observer. = 2°, Illuminant = D65
	    return {
	        x: r * 0.4124 + g * 0.3576 + b * 0.1805,
	        y: r * 0.2126 + g * 0.7152 + b * 0.0722,
	        z: r * 0.0193 + g * 0.1192 + b * 0.9505
	    };
	}
	exports.rgb2xyz = rgb2xyz;


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * rgb2hsl.ts - part of Image Quantization Library
	 */
	var arithmetic_1 = __webpack_require__(6);
	/**
	 * Calculate HSL from RGB
	 * Hue is in degrees [0..360]
	 * Lightness: [0..1]
	 * Saturation: [0..1]
	 * http://web.archive.org/web/20060914040436/http://local.wasp.uwa.edu.au/~pbourke/colour/hsl/
	 */
	function rgb2hsl(r, g, b) {
	    var min = arithmetic_1.min3(r, g, b), max = arithmetic_1.max3(r, g, b), delta = max - min, l = (min + max) / 510;
	    var s = 0;
	    if (l > 0 && l < 1)
	        s = delta / (l < 0.5 ? (max + min) : (510 - max - min));
	    var h = 0;
	    if (delta > 0) {
	        if (max === r) {
	            h = (g - b) / delta;
	        }
	        else if (max === g) {
	            h = (2 + (b - r) / delta);
	        }
	        else {
	            h = (4 + (r - g) / delta);
	        }
	        h *= 60;
	        if (h < 0)
	            h += 360;
	    }
	    return { h: h, s: s, l: l };
	}
	exports.rgb2hsl = rgb2hsl;


/***/ },
/* 6 */
/***/ function(module, exports) {

	"use strict";
	function degrees2radians(n) {
	    return n * (Math.PI / 180);
	}
	exports.degrees2radians = degrees2radians;
	function max3(a, b, c) {
	    var m = a;
	    (m < b) && (m = b);
	    (m < c) && (m = c);
	    return m;
	}
	exports.max3 = max3;
	function min3(a, b, c) {
	    var m = a;
	    (m > b) && (m = b);
	    (m > c) && (m = c);
	    return m;
	}
	exports.min3 = min3;
	function intInRange(value, low, high) {
	    if (value > high)
	        value = high;
	    if (value < low)
	        value = low;
	    return value | 0;
	}
	exports.intInRange = intInRange;
	function inRange0to255Rounded(n) {
	    n = Math.round(n);
	    if (n > 255)
	        n = 255;
	    else if (n < 0)
	        n = 0;
	    return n;
	}
	exports.inRange0to255Rounded = inRange0to255Rounded;
	function inRange0to255(n) {
	    if (n > 255)
	        n = 255;
	    else if (n < 0)
	        n = 0;
	    return n;
	}
	exports.inRange0to255 = inRange0to255;
	function stableSort(arrayToSort, callback) {
	    var type = typeof arrayToSort[0];
	    var sorted;
	    if (type === "number" || type === "string") {
	        var ord_1 = Object.create(null);
	        for (var i = 0, l = arrayToSort.length; i < l; i++) {
	            var val = arrayToSort[i];
	            if (ord_1[val] || ord_1[val] === 0)
	                continue;
	            ord_1[val] = i;
	        }
	        sorted = arrayToSort.sort(function (a, b) {
	            return callback(a, b) || ord_1[a] - ord_1[b];
	        });
	    }
	    else {
	        var ord2_1 = arrayToSort.slice(0);
	        sorted = arrayToSort.sort(function (a, b) {
	            return callback(a, b) || ord2_1.indexOf(a) - ord2_1.indexOf(b);
	        });
	    }
	    return sorted;
	}
	exports.stableSort = stableSort;


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * rgb2lab.ts - part of Image Quantization Library
	 */
	var rgb2xyz_1 = __webpack_require__(4);
	var xyz2lab_1 = __webpack_require__(8);
	function rgb2lab(r, g, b) {
	    var xyz = rgb2xyz_1.rgb2xyz(r, g, b);
	    return xyz2lab_1.xyz2lab(xyz.x, xyz.y, xyz.z);
	}
	exports.rgb2lab = rgb2lab;


/***/ },
/* 8 */
/***/ function(module, exports) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * xyz2lab.ts - part of Image Quantization Library
	 */
	var refX = 0.95047, //ref_X =  95.047   Observer= 2°, Illuminant= D65
	refY = 1.00000, //ref_Y = 100.000
	refZ = 1.08883; //ref_Z = 108.883
	function pivot(n) {
	    return n > 0.008856 ? Math.pow(n, 1 / 3) : (7.787 * n + 16 / 116);
	}
	function xyz2lab(x, y, z) {
	    x = pivot(x / refX);
	    y = pivot(y / refY);
	    z = pivot(z / refZ);
	    if ((116 * y) - 16 < 0)
	        throw new Error("xxx");
	    return {
	        L: Math.max(0, (116 * y) - 16),
	        a: 500 * (x - y),
	        b: 200 * (y - z)
	    };
	}
	exports.xyz2lab = xyz2lab;


/***/ },
/* 9 */
/***/ function(module, exports) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * lab2xyz.ts - part of Image Quantization Library
	 */
	var refX = 0.95047, //ref_X =  95.047   Observer= 2°, Illuminant = D65
	refY = 1.00000, //ref_Y = 100.000
	refZ = 1.08883; //ref_Z = 108.883
	function pivot(n) {
	    return n > 0.206893034 ? Math.pow(n, 3) : (n - 16 / 116) / 7.787;
	}
	function lab2xyz(L, a, b) {
	    var y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
	    return {
	        x: refX * pivot(x),
	        y: refY * pivot(y),
	        z: refZ * pivot(z)
	    };
	}
	exports.lab2xyz = lab2xyz;


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * lab2rgb.ts - part of Image Quantization Library
	 */
	var lab2xyz_1 = __webpack_require__(9);
	var xyz2rgb_1 = __webpack_require__(11);
	function lab2rgb(L, a, b) {
	    var xyz = lab2xyz_1.lab2xyz(L, a, b);
	    return xyz2rgb_1.xyz2rgb(xyz.x, xyz.y, xyz.z);
	}
	exports.lab2rgb = lab2rgb;


/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * xyz2rgb.ts - part of Image Quantization Library
	 */
	var arithmetic_1 = __webpack_require__(6);
	// gamma correction, see https://en.wikipedia.org/wiki/SRGB#The_reverse_transformation
	function correctGamma(n) {
	    return n > 0.0031308 ? 1.055 * Math.pow(n, 1 / 2.4) - 0.055 : 12.92 * n;
	}
	function xyz2rgb(x, y, z) {
	    // Observer. = 2°, Illuminant = D65
	    var r = correctGamma(x * 3.2406 + y * -1.5372 + z * -0.4986), g = correctGamma(x * -0.9689 + y * 1.8758 + z * 0.0415), b = correctGamma(x * 0.0557 + y * -0.2040 + z * 1.0570);
	    return {
	        r: arithmetic_1.inRange0to255Rounded(r * 255),
	        g: arithmetic_1.inRange0to255Rounded(g * 255),
	        b: arithmetic_1.inRange0to255Rounded(b * 255)
	    };
	}
	exports.xyz2rgb = xyz2rgb;


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * iq.ts - Image Quantization Library
	 */
	var abstractDistanceCalculator_1 = __webpack_require__(13);
	exports.AbstractDistanceCalculator = abstractDistanceCalculator_1.AbstractDistanceCalculator;
	var cie94_1 = __webpack_require__(14);
	exports.CIE94Textiles = cie94_1.CIE94Textiles;
	exports.CIE94GraphicArts = cie94_1.CIE94GraphicArts;
	var ciede2000_1 = __webpack_require__(15);
	exports.CIEDE2000 = ciede2000_1.CIEDE2000;
	var cmetric_1 = __webpack_require__(16);
	exports.CMETRIC = cmetric_1.CMETRIC;
	var euclidean_1 = __webpack_require__(17);
	exports.AbstractEuclidean = euclidean_1.AbstractEuclidean;
	exports.Euclidean = euclidean_1.Euclidean;
	exports.EuclideanRgbQuantWOAlpha = euclidean_1.EuclideanRgbQuantWOAlpha;
	exports.EuclideanRgbQuantWithAlpha = euclidean_1.EuclideanRgbQuantWithAlpha;
	var manhattan_1 = __webpack_require__(18);
	exports.AbstractManhattan = manhattan_1.AbstractManhattan;
	exports.Manhattan = manhattan_1.Manhattan;
	exports.ManhattanSRGB = manhattan_1.ManhattanSRGB;
	exports.ManhattanNommyde = manhattan_1.ManhattanNommyde;
	var pngQuant_1 = __webpack_require__(19);
	exports.PNGQUANT = pngQuant_1.PNGQUANT;


/***/ },
/* 13 */
/***/ function(module, exports) {

	"use strict";
	var AbstractDistanceCalculator = (function () {
	    function AbstractDistanceCalculator() {
	        this._setDefaults();
	        // set default maximal color component deltas (255 - 0 = 255)
	        this.setWhitePoint(255, 255, 255, 255);
	    }
	    AbstractDistanceCalculator.prototype.setWhitePoint = function (r, g, b, a) {
	        this._whitePoint = {
	            r: (r > 0) ? 255 / r : 0,
	            g: (g > 0) ? 255 / g : 0,
	            b: (b > 0) ? 255 / b : 0,
	            a: (a > 0) ? 255 / a : 0
	        };
	        this._maxDistance = this.calculateRaw(r, g, b, a, 0, 0, 0, 0);
	    };
	    AbstractDistanceCalculator.prototype.calculateNormalized = function (colorA, colorB) {
	        return this.calculateRaw(colorA.r, colorA.g, colorA.b, colorA.a, colorB.r, colorB.g, colorB.b, colorB.a) / this._maxDistance;
	    };
	    AbstractDistanceCalculator.prototype._setDefaults = function () {
	    };
	    return AbstractDistanceCalculator;
	}());
	exports.AbstractDistanceCalculator = AbstractDistanceCalculator;


/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var __extends = (this && this.__extends) || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * cie94.ts - part of Image Quantization Library
	 */
	var abstractDistanceCalculator_1 = __webpack_require__(13);
	var rgb2lab_1 = __webpack_require__(7);
	var arithmetic_1 = __webpack_require__(6);
	/**
	 * CIE94 method of delta-e
	 * http://en.wikipedia.org/wiki/Color_difference#CIE94
	 */
	var AbstractCIE94 = (function (_super) {
	    __extends(AbstractCIE94, _super);
	    function AbstractCIE94() {
	        _super.apply(this, arguments);
	    }
	    AbstractCIE94.prototype.calculateRaw = function (r1, g1, b1, a1, r2, g2, b2, a2) {
	        var lab1 = rgb2lab_1.rgb2lab(arithmetic_1.inRange0to255(r1 * this._whitePoint.r), arithmetic_1.inRange0to255(g1 * this._whitePoint.g), arithmetic_1.inRange0to255(b1 * this._whitePoint.b)), lab2 = rgb2lab_1.rgb2lab(arithmetic_1.inRange0to255(r2 * this._whitePoint.r), arithmetic_1.inRange0to255(g2 * this._whitePoint.g), arithmetic_1.inRange0to255(b2 * this._whitePoint.b));
	        var dL = lab1.L - lab2.L, dA = lab1.a - lab2.a, dB = lab1.b - lab2.b, c1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b), c2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b), dC = c1 - c2;
	        var deltaH = dA * dA + dB * dB - dC * dC;
	        deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
	        var dAlpha = (a2 - a1) * this._whitePoint.a * this._kA;
	        // TODO: add alpha channel support
	        return Math.sqrt(Math.pow(dL / this._Kl, 2) +
	            Math.pow(dC / (1.0 + this._K1 * c1), 2) +
	            Math.pow(deltaH / (1.0 + this._K2 * c1), 2) +
	            Math.pow(dAlpha, 2));
	    };
	    return AbstractCIE94;
	}(abstractDistanceCalculator_1.AbstractDistanceCalculator));
	exports.AbstractCIE94 = AbstractCIE94;
	var CIE94Textiles = (function (_super) {
	    __extends(CIE94Textiles, _super);
	    function CIE94Textiles() {
	        _super.apply(this, arguments);
	    }
	    CIE94Textiles.prototype._setDefaults = function () {
	        this._Kl = 2.0;
	        this._K1 = 0.048;
	        this._K2 = 0.014;
	        this._kA = 0.25 * 50 / 255;
	    };
	    return CIE94Textiles;
	}(AbstractCIE94));
	exports.CIE94Textiles = CIE94Textiles;
	var CIE94GraphicArts = (function (_super) {
	    __extends(CIE94GraphicArts, _super);
	    function CIE94GraphicArts() {
	        _super.apply(this, arguments);
	    }
	    CIE94GraphicArts.prototype._setDefaults = function () {
	        this._Kl = 1.0;
	        this._K1 = 0.045;
	        this._K2 = 0.015;
	        this._kA = 0.25 * 100 / 255;
	    };
	    return CIE94GraphicArts;
	}(AbstractCIE94));
	exports.CIE94GraphicArts = CIE94GraphicArts;


/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var __extends = (this && this.__extends) || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * ciede2000.ts - part of Image Quantization Library
	 */
	var abstractDistanceCalculator_1 = __webpack_require__(13);
	var rgb2lab_1 = __webpack_require__(7);
	var arithmetic_1 = __webpack_require__(6);
	/**
	 * CIEDE2000 algorithm - Adapted from Sharma et al's MATLAB implementation at
	 * http://www.ece.rochester.edu/~gsharma/ciede2000/
	 */
	var CIEDE2000 = (function (_super) {
	    __extends(CIEDE2000, _super);
	    function CIEDE2000() {
	        _super.apply(this, arguments);
	    }
	    CIEDE2000.prototype.calculateRaw = function (r1, g1, b1, a1, r2, g2, b2, a2) {
	        var lab1 = rgb2lab_1.rgb2lab(arithmetic_1.inRange0to255(r1 * this._whitePoint.r), arithmetic_1.inRange0to255(g1 * this._whitePoint.g), arithmetic_1.inRange0to255(b1 * this._whitePoint.b)), lab2 = rgb2lab_1.rgb2lab(arithmetic_1.inRange0to255(r2 * this._whitePoint.r), arithmetic_1.inRange0to255(g2 * this._whitePoint.g), arithmetic_1.inRange0to255(b2 * this._whitePoint.b)), dA = (a2 - a1) * this._whitePoint.a * CIEDE2000._kA, dE2 = this.calculateRawInLab(lab1, lab2);
	        return Math.sqrt(dE2 + dA * dA);
	    };
	    CIEDE2000.prototype.calculateRawInLab = function (Lab1, Lab2) {
	        // Get L,a,b values for color 1
	        var L1 = Lab1.L, a1 = Lab1.a, b1 = Lab1.b;
	        // Get L,a,b values for color 2
	        var L2 = Lab2.L, a2 = Lab2.a, b2 = Lab2.b;
	        // Calculate Cprime1, Cprime2, Cabbar
	        var C1 = Math.sqrt(a1 * a1 + b1 * b1), C2 = Math.sqrt(a2 * a2 + b2 * b2), pow_a_C1_C2_to_7 = Math.pow((C1 + C2) / 2.0, 7.0), G = 0.5 * (1.0 - Math.sqrt(pow_a_C1_C2_to_7 / (pow_a_C1_C2_to_7 + CIEDE2000._pow25to7))), //25^7
	        a1p = (1.0 + G) * a1, a2p = (1.0 + G) * a2, C1p = Math.sqrt(a1p * a1p + b1 * b1), C2p = Math.sqrt(a2p * a2p + b2 * b2), C1pC2p = C1p * C2p, 
	        // Angles in Degree.
	        h1p = CIEDE2000._calculatehp(b1, a1p), h2p = CIEDE2000._calculatehp(b2, a2p), h_bar = Math.abs(h1p - h2p), dLp = L2 - L1, dCp = C2p - C1p, dHp = CIEDE2000._calculate_dHp(C1pC2p, h_bar, h2p, h1p), ahp = CIEDE2000._calculate_ahp(C1pC2p, h_bar, h1p, h2p), T = CIEDE2000._calculateT(ahp), aCp = (C1p + C2p) / 2.0, aLp_minus_50_square = Math.pow((L1 + L2) / 2.0 - 50.0, 2.0), S_L = 1.0 + (.015 * aLp_minus_50_square) / Math.sqrt(20.0 + aLp_minus_50_square), S_C = 1.0 + .045 * aCp, S_H = 1.0 + .015 * T * aCp, R_T = CIEDE2000._calculateRT(ahp, aCp), dLpSL = dLp / S_L, // S_L * kL, where kL is 1.0
	        dCpSC = dCp / S_C, // S_C * kC, where kC is 1.0
	        dHpSH = dHp / S_H; // S_H * kH, where kH is 1.0
	        return Math.pow(dLpSL, 2) + Math.pow(dCpSC, 2) + Math.pow(dHpSH, 2) + R_T * dCpSC * dHpSH;
	    };
	    CIEDE2000._calculatehp = function (b, ap) {
	        var hp = Math.atan2(b, ap);
	        if (hp >= 0)
	            return hp;
	        return hp + CIEDE2000._deg360InRad;
	    };
	    CIEDE2000._calculateRT = function (ahp, aCp) {
	        var aCp_to_7 = Math.pow(aCp, 7.0), R_C = 2.0 * Math.sqrt(aCp_to_7 / (aCp_to_7 + CIEDE2000._pow25to7)), // 25^7
	        delta_theta = CIEDE2000._deg30InRad * Math.exp(-Math.pow((ahp - CIEDE2000._deg275InRad) / CIEDE2000._deg25InRad, 2.0));
	        return -Math.sin(2.0 * delta_theta) * R_C;
	    };
	    CIEDE2000._calculateT = function (ahp) {
	        return 1.0 - .17 * Math.cos(ahp - CIEDE2000._deg30InRad) + .24 * Math.cos(ahp * 2.0) + .32 * Math.cos(ahp * 3.0 + CIEDE2000._deg6InRad) - .2 * Math.cos(ahp * 4.0 - CIEDE2000._deg63InRad);
	    };
	    CIEDE2000._calculate_ahp = function (C1pC2p, h_bar, h1p, h2p) {
	        var hpSum = h1p + h2p;
	        if (C1pC2p == 0)
	            return hpSum;
	        if (h_bar <= CIEDE2000._deg180InRad)
	            return hpSum / 2.0;
	        if (hpSum < CIEDE2000._deg360InRad)
	            return (hpSum + CIEDE2000._deg360InRad) / 2.0;
	        return (hpSum - CIEDE2000._deg360InRad) / 2.0;
	    };
	    CIEDE2000._calculate_dHp = function (C1pC2p, h_bar, h2p, h1p) {
	        var dhp;
	        if (C1pC2p == 0) {
	            dhp = 0;
	        }
	        else if (h_bar <= CIEDE2000._deg180InRad) {
	            dhp = h2p - h1p;
	        }
	        else if (h2p <= h1p) {
	            dhp = h2p - h1p + CIEDE2000._deg360InRad;
	        }
	        else {
	            dhp = h2p - h1p - CIEDE2000._deg360InRad;
	        }
	        return 2.0 * Math.sqrt(C1pC2p) * Math.sin(dhp / 2.0);
	    };
	    /**
	     * Weight in distance: 0.25
	     * Max DeltaE: 100
	     * Max DeltaA: 255
	     */
	    CIEDE2000._kA = 0.25 * 100 / 255;
	    CIEDE2000._pow25to7 = Math.pow(25, 7);
	    CIEDE2000._deg360InRad = arithmetic_1.degrees2radians(360);
	    CIEDE2000._deg180InRad = arithmetic_1.degrees2radians(180);
	    CIEDE2000._deg30InRad = arithmetic_1.degrees2radians(30);
	    CIEDE2000._deg6InRad = arithmetic_1.degrees2radians(6);
	    CIEDE2000._deg63InRad = arithmetic_1.degrees2radians(63);
	    CIEDE2000._deg275InRad = arithmetic_1.degrees2radians(275);
	    CIEDE2000._deg25InRad = arithmetic_1.degrees2radians(25);
	    return CIEDE2000;
	}(abstractDistanceCalculator_1.AbstractDistanceCalculator));
	exports.CIEDE2000 = CIEDE2000;


/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var __extends = (this && this.__extends) || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * cmetric.ts - part of Image Quantization Library
	 */
	var abstractDistanceCalculator_1 = __webpack_require__(13);
	/**
	 * TODO: Name it: http://www.compuphase.com/cmetric.htm
	 */
	var CMETRIC = (function (_super) {
	    __extends(CMETRIC, _super);
	    function CMETRIC() {
	        _super.apply(this, arguments);
	    }
	    CMETRIC.prototype.calculateRaw = function (r1, g1, b1, a1, r2, g2, b2, a2) {
	        var rmean = (r1 + r2) / 2 * this._whitePoint.r, r = (r1 - r2) * this._whitePoint.r, g = (g1 - g2) * this._whitePoint.g, b = (b1 - b2) * this._whitePoint.b, dE = ((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8)), dA = (a2 - a1) * this._whitePoint.a;
	        return Math.sqrt(dE + dA * dA);
	    };
	    return CMETRIC;
	}(abstractDistanceCalculator_1.AbstractDistanceCalculator));
	exports.CMETRIC = CMETRIC;


/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var __extends = (this && this.__extends) || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * euclidean.ts - part of Image Quantization Library
	 */
	var abstractDistanceCalculator_1 = __webpack_require__(13);
	var bt709_1 = __webpack_require__(2);
	/**
	 * Euclidean color distance
	 */
	var AbstractEuclidean = (function (_super) {
	    __extends(AbstractEuclidean, _super);
	    function AbstractEuclidean() {
	        _super.apply(this, arguments);
	    }
	    AbstractEuclidean.prototype.calculateRaw = function (r1, g1, b1, a1, r2, g2, b2, a2) {
	        var dR = r2 - r1, dG = g2 - g1, dB = b2 - b1, dA = a2 - a1;
	        return Math.sqrt(this._kR * dR * dR + this._kG * dG * dG + this._kB * dB * dB + this._kA * dA * dA);
	    };
	    return AbstractEuclidean;
	}(abstractDistanceCalculator_1.AbstractDistanceCalculator));
	exports.AbstractEuclidean = AbstractEuclidean;
	var Euclidean = (function (_super) {
	    __extends(Euclidean, _super);
	    function Euclidean() {
	        _super.apply(this, arguments);
	    }
	    Euclidean.prototype._setDefaults = function () {
	        this._kR = 1;
	        this._kG = 1;
	        this._kB = 1;
	        this._kA = 1;
	    };
	    return Euclidean;
	}(AbstractEuclidean));
	exports.Euclidean = Euclidean;
	/**
	 * Euclidean color distance (RgbQuant modification w Alpha)
	 */
	var EuclideanRgbQuantWithAlpha = (function (_super) {
	    __extends(EuclideanRgbQuantWithAlpha, _super);
	    function EuclideanRgbQuantWithAlpha() {
	        _super.apply(this, arguments);
	    }
	    EuclideanRgbQuantWithAlpha.prototype._setDefaults = function () {
	        this._kR = bt709_1.Y.RED;
	        this._kG = bt709_1.Y.GREEN;
	        this._kB = bt709_1.Y.BLUE;
	        // TODO: what is the best coefficient below?
	        this._kA = 1;
	    };
	    return EuclideanRgbQuantWithAlpha;
	}(AbstractEuclidean));
	exports.EuclideanRgbQuantWithAlpha = EuclideanRgbQuantWithAlpha;
	/**
	 * Euclidean color distance (RgbQuant modification w/o Alpha)
	 */
	var EuclideanRgbQuantWOAlpha = (function (_super) {
	    __extends(EuclideanRgbQuantWOAlpha, _super);
	    function EuclideanRgbQuantWOAlpha() {
	        _super.apply(this, arguments);
	    }
	    EuclideanRgbQuantWOAlpha.prototype._setDefaults = function () {
	        this._kR = bt709_1.Y.RED;
	        this._kG = bt709_1.Y.GREEN;
	        this._kB = bt709_1.Y.BLUE;
	        this._kA = 0;
	    };
	    return EuclideanRgbQuantWOAlpha;
	}(AbstractEuclidean));
	exports.EuclideanRgbQuantWOAlpha = EuclideanRgbQuantWOAlpha;


/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var __extends = (this && this.__extends) || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * manhattanNeuQuant.ts - part of Image Quantization Library
	 */
	var abstractDistanceCalculator_1 = __webpack_require__(13);
	var bt709_1 = __webpack_require__(2);
	/**
	 * Manhattan distance (NeuQuant modification) - w/o sRGB coefficients
	 */
	var AbstractManhattan = (function (_super) {
	    __extends(AbstractManhattan, _super);
	    function AbstractManhattan() {
	        _super.apply(this, arguments);
	    }
	    AbstractManhattan.prototype.calculateRaw = function (r1, g1, b1, a1, r2, g2, b2, a2) {
	        var dR = r2 - r1, dG = g2 - g1, dB = b2 - b1, dA = a2 - a1;
	        if (dR < 0)
	            dR = 0 - dR;
	        if (dG < 0)
	            dG = 0 - dG;
	        if (dB < 0)
	            dB = 0 - dB;
	        if (dA < 0)
	            dA = 0 - dA;
	        return this._kR * dR + this._kG * dG + this._kB * dB + this._kA * dA;
	    };
	    return AbstractManhattan;
	}(abstractDistanceCalculator_1.AbstractDistanceCalculator));
	exports.AbstractManhattan = AbstractManhattan;
	var Manhattan = (function (_super) {
	    __extends(Manhattan, _super);
	    function Manhattan() {
	        _super.apply(this, arguments);
	    }
	    Manhattan.prototype._setDefaults = function () {
	        this._kR = 1;
	        this._kG = 1;
	        this._kB = 1;
	        this._kA = 1;
	    };
	    return Manhattan;
	}(AbstractManhattan));
	exports.Manhattan = Manhattan;
	/**
	 * Manhattan distance (Nommyde modification)
	 * https://github.com/igor-bezkrovny/image-quantization/issues/4#issuecomment-235155320
	 */
	var ManhattanNommyde = (function (_super) {
	    __extends(ManhattanNommyde, _super);
	    function ManhattanNommyde() {
	        _super.apply(this, arguments);
	    }
	    ManhattanNommyde.prototype._setDefaults = function () {
	        this._kR = 0.4984;
	        this._kG = 0.8625;
	        this._kB = 0.2979;
	        // TODO: what is the best coefficient below?
	        this._kA = 1;
	    };
	    return ManhattanNommyde;
	}(AbstractManhattan));
	exports.ManhattanNommyde = ManhattanNommyde;
	/**
	 * Manhattan distance (sRGB coefficients)
	 */
	var ManhattanSRGB = (function (_super) {
	    __extends(ManhattanSRGB, _super);
	    function ManhattanSRGB() {
	        _super.apply(this, arguments);
	    }
	    ManhattanSRGB.prototype._setDefaults = function () {
	        this._kR = bt709_1.Y.RED;
	        this._kG = bt709_1.Y.GREEN;
	        this._kB = bt709_1.Y.BLUE;
	        // TODO: what is the best coefficient below?
	        this._kA = 1;
	    };
	    return ManhattanSRGB;
	}(AbstractManhattan));
	exports.ManhattanSRGB = ManhattanSRGB;


/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var __extends = (this && this.__extends) || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * pngQuant.ts - part of Image Quantization Library
	 */
	var abstractDistanceCalculator_1 = __webpack_require__(13);
	/**
	 * TODO: check quality of this distance equation
	 * TODO: ask author for usage rights
	 * taken from:
	 * {@link http://stackoverflow.com/questions/4754506/color-similarity-distance-in-rgba-color-space/8796867#8796867}
	 * {@link https://github.com/pornel/pngquant/blob/cc39b47799a7ff2ef17b529f9415ff6e6b213b8f/lib/pam.h#L148}
	 */
	var PNGQUANT = (function (_super) {
	    __extends(PNGQUANT, _super);
	    function PNGQUANT() {
	        _super.apply(this, arguments);
	    }
	    /**
	     * Author's comments
	     * px_b.rgb = px.rgb + 0*(1-px.a) // blend px on black
	     * px_b.a   = px.a   + 1*(1-px.a)
	     * px_w.rgb = px.rgb + 1*(1-px.a) // blend px on white
	     * px_w.a   = px.a   + 1*(1-px.a)
	
	     * px_b.rgb = px.rgb              // difference same as in opaque RGB
	     * px_b.a   = 1
	     * px_w.rgb = px.rgb - px.a       // difference simplifies to formula below
	     * px_w.a   = 1
	
	     * (px.rgb - px.a) - (py.rgb - py.a)
	     * (px.rgb - py.rgb) + (py.a - px.a)
	     *
	     */
	    PNGQUANT.prototype.calculateRaw = function (r1, g1, b1, a1, r2, g2, b2, a2) {
	        var alphas = (a2 - a1) * this._whitePoint.a;
	        return this._colordifference_ch(r1 * this._whitePoint.r, r2 * this._whitePoint.r, alphas) +
	            this._colordifference_ch(g1 * this._whitePoint.g, g2 * this._whitePoint.g, alphas) +
	            this._colordifference_ch(b1 * this._whitePoint.b, b2 * this._whitePoint.b, alphas);
	    };
	    PNGQUANT.prototype._colordifference_ch = function (x, y, alphas) {
	        // maximum of channel blended on white, and blended on black
	        // premultiplied alpha and backgrounds 0/1 shorten the formula
	        var black = x - y, white = black + alphas;
	        return black * black + white * white;
	    };
	    return PNGQUANT;
	}(abstractDistanceCalculator_1.AbstractDistanceCalculator));
	exports.PNGQUANT = PNGQUANT;


/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var neuquant_1 = __webpack_require__(21);
	exports.NeuQuant = neuquant_1.NeuQuant;
	var neuquantFloat_1 = __webpack_require__(25);
	exports.NeuQuantFloat = neuquantFloat_1.NeuQuantFloat;
	var rgbquant_1 = __webpack_require__(26);
	exports.RGBQuant = rgbquant_1.RGBQuant;
	var colorHistogram_1 = __webpack_require__(27);
	exports.ColorHistogram = colorHistogram_1.ColorHistogram;
	var wuQuant_1 = __webpack_require__(29);
	exports.WuQuant = wuQuant_1.WuQuant;
	exports.WuColorCube = wuQuant_1.WuColorCube;


/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	/*
	 * NeuQuant Neural-Net Quantization Algorithm
	 * ------------------------------------------
	 *
	 * Copyright (c) 1994 Anthony Dekker
	 *
	 * NEUQUANT Neural-Net quantization algorithm by Anthony Dekker, 1994. See
	 * "Kohonen neural networks for optimal colour quantization" in "Network:
	 * Computation in Neural Systems" Vol. 5 (1994) pp 351-367. for a discussion of
	 * the algorithm.
	 *
	 * Any party obtaining a copy of these files from the author, directly or
	 * indirectly, is granted, free of charge, a full and unrestricted irrevocable,
	 * world-wide, paid up, royalty-free, nonexclusive right and license to deal in
	 * this software and documentation files (the "Software"), including without
	 * limitation the rights to use, copy, modify, merge, publish, distribute,
	 * sublicense, and/or sell copies of the Software, and to permit persons who
	 * receive copies from any such party to do so, with the only requirement being
	 * that this copyright notice remain intact.
	 */
	"use strict";
	/**
	 * @preserve TypeScript port:
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * neuquant.ts - part of Image Quantization Library
	 */
	var palette_1 = __webpack_require__(22);
	var point_1 = __webpack_require__(24);
	// bias for colour values
	var networkBiasShift = 3;
	var Neuron = (function () {
	    function Neuron(defaultValue) {
	        this.r = this.g = this.b = this.a = defaultValue;
	    }
	    /**
	     * There is a fix in original NEUQUANT by Anthony Dekker (http://members.ozemail.com.au/~dekker/NEUQUANT.HTML)
	     * @example
	     * r = Math.min(255, (neuron.r + (1 << (networkBiasShift - 1))) >> networkBiasShift);
	     */
	    Neuron.prototype.toPoint = function () {
	        return point_1.Point.createByRGBA(this.r >> networkBiasShift, this.g >> networkBiasShift, this.b >> networkBiasShift, this.a >> networkBiasShift);
	    };
	    Neuron.prototype.subtract = function (r, g, b, a) {
	        this.r -= r | 0;
	        this.g -= g | 0;
	        this.b -= b | 0;
	        this.a -= a | 0;
	    };
	    return Neuron;
	}());
	var NeuQuant = (function () {
	    function NeuQuant(colorDistanceCalculator, colors) {
	        if (colors === void 0) { colors = 256; }
	        this._distance = colorDistanceCalculator;
	        this._pointArray = [];
	        this._sampleFactor = 1;
	        this._networkSize = colors;
	        this._distance.setWhitePoint(255 << networkBiasShift, 255 << networkBiasShift, 255 << networkBiasShift, 255 << networkBiasShift);
	    }
	    NeuQuant.prototype.sample = function (pointBuffer) {
	        this._pointArray = this._pointArray.concat(pointBuffer.getPointArray());
	    };
	    NeuQuant.prototype.quantize = function () {
	        this._init();
	        this._learn();
	        return this._buildPalette();
	    };
	    NeuQuant.prototype._init = function () {
	        this._freq = [];
	        this._bias = [];
	        this._radPower = [];
	        this._network = [];
	        for (var i = 0; i < this._networkSize; i++) {
	            this._network[i] = new Neuron((i << (networkBiasShift + 8)) / this._networkSize | 0);
	            // 1/this._networkSize
	            this._freq[i] = NeuQuant._initialBias / this._networkSize | 0;
	            this._bias[i] = 0;
	        }
	    };
	    /**
	     * Main Learning Loop
	     */
	    NeuQuant.prototype._learn = function () {
	        var sampleFactor = this._sampleFactor;
	        var pointsNumber = this._pointArray.length;
	        if (pointsNumber < NeuQuant._minpicturebytes)
	            sampleFactor = 1;
	        var alphadec = 30 + (sampleFactor - 1) / 3 | 0, pointsToSample = pointsNumber / sampleFactor | 0;
	        var delta = pointsToSample / NeuQuant._nCycles | 0, alpha = NeuQuant._initAlpha, radius = (this._networkSize >> 3) * NeuQuant._radiusBias;
	        var rad = radius >> NeuQuant._radiusBiasShift;
	        if (rad <= 1)
	            rad = 0;
	        for (var i = 0; i < rad; i++) {
	            this._radPower[i] = alpha * (((rad * rad - i * i) * NeuQuant._radBias) / (rad * rad)) >>> 0;
	        }
	        var step;
	        if (pointsNumber < NeuQuant._minpicturebytes) {
	            step = 1;
	        }
	        else if (pointsNumber % NeuQuant._prime1 != 0) {
	            step = NeuQuant._prime1;
	        }
	        else if ((pointsNumber % NeuQuant._prime2) != 0) {
	            step = NeuQuant._prime2;
	        }
	        else if ((pointsNumber % NeuQuant._prime3) != 0) {
	            step = NeuQuant._prime3;
	        }
	        else {
	            step = NeuQuant._prime4;
	        }
	        for (var i = 0, pointIndex = 0; i < pointsToSample;) {
	            var point = this._pointArray[pointIndex], b = point.b << networkBiasShift, g = point.g << networkBiasShift, r = point.r << networkBiasShift, a = point.a << networkBiasShift, neuronIndex = this._contest(b, g, r, a);
	            this._alterSingle(alpha, neuronIndex, b, g, r, a);
	            if (rad !== 0)
	                this._alterNeighbour(rad, neuronIndex, b, g, r, a);
	            /* alter neighbours */
	            pointIndex += step;
	            if (pointIndex >= pointsNumber)
	                pointIndex -= pointsNumber;
	            i++;
	            if (delta === 0)
	                delta = 1;
	            if (i % delta === 0) {
	                alpha -= (alpha / alphadec) | 0;
	                radius -= (radius / NeuQuant._radiusDecrease) | 0;
	                rad = radius >> NeuQuant._radiusBiasShift;
	                if (rad <= 1)
	                    rad = 0;
	                for (var j = 0; j < rad; j++)
	                    this._radPower[j] = alpha * (((rad * rad - j * j) * NeuQuant._radBias) / (rad * rad)) >>> 0;
	            }
	        }
	    };
	    NeuQuant.prototype._buildPalette = function () {
	        var palette = new palette_1.Palette();
	        this._network.forEach(function (neuron) {
	            palette.add(neuron.toPoint());
	        });
	        palette.sort();
	        return palette;
	    };
	    /**
	     * Move adjacent neurons by precomputed alpha*(1-((i-j)^2/[r]^2)) in radpower[|i-j|]
	     */
	    NeuQuant.prototype._alterNeighbour = function (rad, i, b, g, r, al) {
	        var lo = i - rad;
	        if (lo < -1)
	            lo = -1;
	        var hi = i + rad;
	        if (hi > this._networkSize)
	            hi = this._networkSize;
	        var j = i + 1, k = i - 1, m = 1;
	        while (j < hi || k > lo) {
	            var a = this._radPower[m++] / NeuQuant._alphaRadBias;
	            if (j < hi) {
	                var p = this._network[j++];
	                p.subtract(a * (p.r - r), a * (p.g - g), a * (p.b - b), a * (p.a - al));
	            }
	            if (k > lo) {
	                var p = this._network[k--];
	                p.subtract(a * (p.r - r), a * (p.g - g), a * (p.b - b), a * (p.a - al));
	            }
	        }
	    };
	    /**
	     * Move neuron i towards biased (b,g,r) by factor alpha
	     */
	    NeuQuant.prototype._alterSingle = function (alpha, i, b, g, r, a) {
	        alpha /= NeuQuant._initAlpha;
	        /* alter hit neuron */
	        var n = this._network[i];
	        n.subtract(alpha * (n.r - r), alpha * (n.g - g), alpha * (n.b - b), alpha * (n.a - a));
	    };
	    /**
	     * Search for biased BGR values
	     * description:
	     *    finds closest neuron (min dist) and updates freq
	     *    finds best neuron (min dist-bias) and returns position
	     *    for frequently chosen neurons, freq[i] is high and bias[i] is negative
	     *    bias[i] = _gamma*((1/this._networkSize)-freq[i])
	     *
	     * Original distance equation:
	     *        dist = abs(dR) + abs(dG) + abs(dB)
	     */
	    NeuQuant.prototype._contest = function (b, g, r, a) {
	        var multiplier = (255 * 4) << networkBiasShift;
	        var bestd = ~(1 << 31), bestbiasd = bestd, bestpos = -1, bestbiaspos = bestpos;
	        for (var i = 0; i < this._networkSize; i++) {
	            var n = this._network[i], dist = this._distance.calculateNormalized(n, { r: r, g: g, b: b, a: a }) * multiplier | 0;
	            if (dist < bestd) {
	                bestd = dist;
	                bestpos = i;
	            }
	            var biasdist = dist - ((this._bias[i]) >> (NeuQuant._initialBiasShift - networkBiasShift));
	            if (biasdist < bestbiasd) {
	                bestbiasd = biasdist;
	                bestbiaspos = i;
	            }
	            var betafreq = (this._freq[i] >> NeuQuant._betaShift);
	            this._freq[i] -= betafreq;
	            this._bias[i] += (betafreq << NeuQuant._gammaShift);
	        }
	        this._freq[bestpos] += NeuQuant._beta;
	        this._bias[bestpos] -= NeuQuant._betaGamma;
	        return bestbiaspos;
	    };
	    /*
	     four primes near 500 - assume no image has a length so large
	     that it is divisible by all four primes
	     */
	    NeuQuant._prime1 = 499;
	    NeuQuant._prime2 = 491;
	    NeuQuant._prime3 = 487;
	    NeuQuant._prime4 = 503;
	    NeuQuant._minpicturebytes = NeuQuant._prime4;
	    // no. of learning cycles
	    NeuQuant._nCycles = 100;
	    // defs for freq and bias
	    NeuQuant._initialBiasShift = 16;
	    // bias for fractions
	    NeuQuant._initialBias = (1 << NeuQuant._initialBiasShift);
	    NeuQuant._gammaShift = 10;
	    // gamma = 1024
	    // TODO: why gamma is never used?
	    //private static _gamma : number     = (1 << NeuQuant._gammaShift);
	    NeuQuant._betaShift = 10;
	    NeuQuant._beta = (NeuQuant._initialBias >> NeuQuant._betaShift);
	    // beta = 1/1024
	    NeuQuant._betaGamma = (NeuQuant._initialBias << (NeuQuant._gammaShift - NeuQuant._betaShift));
	    /*
	     * for 256 cols, radius starts
	     */
	    NeuQuant._radiusBiasShift = 6;
	    // at 32.0 biased by 6 bits
	    NeuQuant._radiusBias = 1 << NeuQuant._radiusBiasShift;
	    // and decreases by a factor of 1/30 each cycle
	    NeuQuant._radiusDecrease = 30;
	    /* defs for decreasing alpha factor */
	    // alpha starts at 1.0
	    NeuQuant._alphaBiasShift = 10;
	    // biased by 10 bits
	    NeuQuant._initAlpha = (1 << NeuQuant._alphaBiasShift);
	    /* radBias and alphaRadBias used for radpower calculation */
	    NeuQuant._radBiasShift = 8;
	    NeuQuant._radBias = 1 << NeuQuant._radBiasShift;
	    NeuQuant._alphaRadBiasShift = NeuQuant._alphaBiasShift + NeuQuant._radBiasShift;
	    NeuQuant._alphaRadBias = 1 << NeuQuant._alphaRadBiasShift;
	    return NeuQuant;
	}());
	exports.NeuQuant = NeuQuant;


/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * palette.ts - part of Image Quantization Library
	 */
	"use strict";
	var pointContainer_1 = __webpack_require__(23);
	var rgb2hsl_1 = __webpack_require__(5);
	// TODO: make paletteArray via pointBuffer, so, export will be available via pointBuffer.exportXXX
	var hueGroups = 10;
	function hueGroup(hue, segmentsNumber) {
	    var maxHue = 360, seg = maxHue / segmentsNumber, half = seg / 2;
	    for (var i = 1, mid = seg - half; i < segmentsNumber; i++, mid += seg) {
	        if (hue >= mid && hue < mid + seg)
	            return i;
	    }
	    return 0;
	}
	exports.hueGroup = hueGroup;
	var Palette = (function () {
	    function Palette() {
	        this._pointArray = [];
	        this._i32idx = {};
	        this._pointContainer = new pointContainer_1.PointContainer();
	        this._pointContainer.setHeight(1);
	        this._pointArray = this._pointContainer.getPointArray();
	    }
	    Palette.prototype.add = function (color) {
	        this._pointArray.push(color);
	        this._pointContainer.setWidth(this._pointArray.length);
	    };
	    Palette.prototype.has = function (color) {
	        for (var i = this._pointArray.length - 1; i >= 0; i--) {
	            if (color.uint32 === this._pointArray[i].uint32)
	                return true;
	        }
	        return false;
	    };
	    // TOTRY: use HUSL - http://boronine.com/husl/ http://www.husl-colors.org/ https://github.com/husl-colors/husl
	    Palette.prototype.getNearestColor = function (colorDistanceCalculator, color) {
	        return this._pointArray[this.getNearestIndex(colorDistanceCalculator, color) | 0];
	    };
	    Palette.prototype.getPointContainer = function () {
	        return this._pointContainer;
	    };
	    // TOTRY: use HUSL - http://boronine.com/husl/
	    /*
	     public nearestIndexByUint32(i32) {
	     var idx : number = this._nearestPointFromCache("" + i32);
	     if (idx >= 0) return idx;
	
	     var min = 1000,
	     rgb = [
	     (i32 & 0xff),
	     (i32 >>> 8) & 0xff,
	     (i32 >>> 16) & 0xff,
	     (i32 >>> 24) & 0xff
	     ],
	     len = this._pointArray.length;
	
	     idx = 0;
	     for (var i = 0; i < len; i++) {
	     var dist = Utils.distEuclidean(rgb, this._pointArray[i].rgba);
	
	     if (dist < min) {
	     min = dist;
	     idx = i;
	     }
	     }
	
	     this._i32idx[i32] = idx;
	     return idx;
	     }
	     */
	    Palette.prototype._nearestPointFromCache = function (key) {
	        return typeof this._i32idx[key] === "number" ? this._i32idx[key] : -1;
	    };
	    Palette.prototype.getNearestIndex = function (colorDistanceCalculator, point) {
	        var idx = this._nearestPointFromCache("" + point.uint32);
	        if (idx >= 0)
	            return idx;
	        var minimalDistance = Number.MAX_VALUE;
	        idx = 0;
	        for (var i = 0, l = this._pointArray.length; i < l; i++) {
	            var p = this._pointArray[i], distance = colorDistanceCalculator.calculateRaw(point.r, point.g, point.b, point.a, p.r, p.g, p.b, p.a);
	            if (distance < minimalDistance) {
	                minimalDistance = distance;
	                idx = i;
	            }
	        }
	        this._i32idx[point.uint32] = idx;
	        return idx;
	    };
	    /*
	     public reduce(histogram : ColorHistogram, colors : number) {
	     if (this._pointArray.length > colors) {
	     var idxi32 = histogram.getImportanceSortedColorsIDXI32();
	
	     // quantize histogram to existing palette
	     var keep = [], uniqueColors = 0, idx, pruned = false;
	
	     for (var i = 0, len = idxi32.length; i < len; i++) {
	     // palette length reached, unset all remaining colors (sparse palette)
	     if (uniqueColors >= colors) {
	     this.prunePal(keep);
	     pruned = true;
	     break;
	     } else {
	     idx = this.nearestIndexByUint32(idxi32[i]);
	     if (keep.indexOf(idx) < 0) {
	     keep.push(idx);
	     uniqueColors++;
	     }
	     }
	     }
	
	     if (!pruned) {
	     this.prunePal(keep);
	     }
	     }
	     }
	
	     // TODO: check usage, not tested!
	     public prunePal(keep : number[]) {
	     var colors = this._pointArray.length;
	     for (var colorIndex = colors - 1; colorIndex >= 0; colorIndex--) {
	     if (keep.indexOf(colorIndex) < 0) {
	
	     if(colorIndex + 1 < colors) {
	     this._pointArray[ colorIndex ] = this._pointArray [ colors - 1 ];
	     }
	     --colors;
	     //this._pointArray[colorIndex] = null;
	     }
	     }
	     console.log("colors pruned: " + (this._pointArray.length - colors));
	     this._pointArray.length = colors;
	     this._i32idx = {};
	     }
	     */
	    // TODO: group very low lum and very high lum colors
	    // TODO: pass custom sort order
	    // TODO: sort criteria function should be placed to HueStats class
	    Palette.prototype.sort = function () {
	        this._i32idx = {};
	        this._pointArray.sort(function (a, b) {
	            var hslA = rgb2hsl_1.rgb2hsl(a.r, a.g, a.b), hslB = rgb2hsl_1.rgb2hsl(b.r, b.g, b.b);
	            // sort all grays + whites together
	            var hueA = (a.r === a.g && a.g === a.b) ? 0 : 1 + hueGroup(hslA.h, hueGroups), hueB = (b.r === b.g && b.g === b.b) ? 0 : 1 + hueGroup(hslB.h, hueGroups);
	            /*
	             var hueA = (a.r === a.g && a.g === a.b) ? 0 : 1 + Utils.hueGroup(hslA.h, hueGroups);
	             var hueB = (b.r === b.g && b.g === b.b) ? 0 : 1 + Utils.hueGroup(hslB.h, hueGroups);
	             */
	            var hueDiff = hueB - hueA;
	            if (hueDiff)
	                return -hueDiff;
	            /*
	             var lumDiff = Utils.lumGroup(+hslB.l.toFixed(2)) - Utils.lumGroup(+hslA.l.toFixed(2));
	             if (lumDiff) return -lumDiff;
	             */
	            var lA = a.getLuminosity(true), lB = b.getLuminosity(true);
	            if (lB - lA !== 0)
	                return lB - lA;
	            var satDiff = ((hslB.s * 100) | 0) - ((hslA.s * 100) | 0);
	            if (satDiff)
	                return -satDiff;
	            return 0;
	        });
	    };
	    return Palette;
	}());
	exports.Palette = Palette;


/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * pointContainer.ts - part of Image Quantization Library
	 */
	var point_1 = __webpack_require__(24);
	/**
	 * v8 optimizations done.
	 * fromXXX methods are static to move out polymorphic code from class instance itself.
	 */
	var PointContainer = (function () {
	    function PointContainer() {
	        this._width = 0;
	        this._height = 0;
	        this._pointArray = [];
	    }
	    PointContainer.prototype.getWidth = function () {
	        return this._width;
	    };
	    PointContainer.prototype.getHeight = function () {
	        return this._height;
	    };
	    PointContainer.prototype.setWidth = function (width) {
	        this._width = width;
	    };
	    PointContainer.prototype.setHeight = function (height) {
	        this._height = height;
	    };
	    PointContainer.prototype.getPointArray = function () {
	        return this._pointArray;
	    };
	    PointContainer.prototype.clone = function () {
	        var clone = new PointContainer();
	        clone._width = this._width;
	        clone._height = this._height;
	        for (var i = 0, l = this._pointArray.length; i < l; i++) {
	            clone._pointArray[i] = point_1.Point.createByUint32(this._pointArray[i].uint32 | 0); // "| 0" is added for v8 optimization
	        }
	        return clone;
	    };
	    PointContainer.prototype.toUint32Array = function () {
	        var l = this._pointArray.length, uint32Array = new Uint32Array(l);
	        for (var i = 0; i < l; i++) {
	            uint32Array[i] = this._pointArray[i].uint32;
	        }
	        return uint32Array;
	    };
	    PointContainer.prototype.toUint8Array = function () {
	        return new Uint8Array(this.toUint32Array().buffer);
	    };
	    PointContainer.fromHTMLImageElement = function (img) {
	        var width = img.naturalWidth, height = img.naturalHeight;
	        var canvas = document.createElement("canvas");
	        canvas.width = width;
	        canvas.height = height;
	        var ctx = canvas.getContext("2d");
	        ctx.drawImage(img, 0, 0, width, height, 0, 0, width, height);
	        return PointContainer.fromHTMLCanvasElement(canvas);
	    };
	    PointContainer.fromHTMLCanvasElement = function (canvas) {
	        var width = canvas.width, height = canvas.height;
	        var ctx = canvas.getContext("2d"), imgData = ctx.getImageData(0, 0, width, height);
	        return PointContainer.fromImageData(imgData);
	    };
	    PointContainer.fromNodeCanvas = function (canvas) {
	        return PointContainer.fromHTMLCanvasElement(canvas);
	    };
	    PointContainer.fromImageData = function (imageData) {
	        var width = imageData.width, height = imageData.height;
	        return PointContainer.fromCanvasPixelArray(imageData.data, width, height);
	        /*
	         var buf8;
	         if (Utils.typeOf(imageData.data) == "CanvasPixelArray")
	         buf8 = new Uint8Array(imageData.data);
	         else
	         buf8 = imageData.data;
	
	         this.fromUint32Array(new Uint32Array(buf8.buffer), width, height);
	         */
	    };
	    PointContainer.fromArray = function (byteArray, width, height) {
	        var uint8array = new Uint8Array(byteArray);
	        return PointContainer.fromUint8Array(uint8array, width, height);
	    };
	    PointContainer.fromCanvasPixelArray = function (data, width, height) {
	        return PointContainer.fromArray(data, width, height);
	    };
	    PointContainer.fromUint8Array = function (uint8array, width, height) {
	        return PointContainer.fromUint32Array(new Uint32Array(uint8array.buffer), width, height);
	    };
	    PointContainer.fromUint32Array = function (uint32array, width, height) {
	        var container = new PointContainer();
	        container._width = width;
	        container._height = height;
	        for (var i = 0, l = uint32array.length; i < l; i++) {
	            container._pointArray[i] = point_1.Point.createByUint32(uint32array[i] | 0); // "| 0" is added for v8 optimization
	        }
	        return container;
	    };
	    return PointContainer;
	}());
	exports.PointContainer = PointContainer;


/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * point.ts - part of Image Quantization Library
	 */
	var bt709_1 = __webpack_require__(2);
	/**
	 * v8 optimized class
	 * 1) "constructor" should have initialization with worst types
	 * 2) "set" should have |0 / >>> 0
	 */
	var Point = (function () {
	    function Point() {
	        this.uint32 = -1 >>> 0;
	        this.r = this.g = this.b = this.a = 0;
	        this.rgba = new Array(4);
	        /*[ this.r , this.g , this.b , this.a ]*/
	        this.rgba[0] = 0;
	        this.rgba[1] = 0;
	        this.rgba[2] = 0;
	        this.rgba[3] = 0;
	        /*
	         this.Lab = {
	         L : 0.0,
	         a : 0.0,
	         b : 0.0
	         };
	         */
	    }
	    Point.createByQuadruplet = function (quadruplet) {
	        var point = new Point();
	        point.r = quadruplet[0] | 0;
	        point.g = quadruplet[1] | 0;
	        point.b = quadruplet[2] | 0;
	        point.a = quadruplet[3] | 0;
	        point._loadUINT32();
	        point._loadQuadruplet();
	        //point._loadLab();
	        return point;
	    };
	    Point.createByRGBA = function (red, green, blue, alpha) {
	        var point = new Point();
	        point.r = red | 0;
	        point.g = green | 0;
	        point.b = blue | 0;
	        point.a = alpha | 0;
	        point._loadUINT32();
	        point._loadQuadruplet();
	        //point._loadLab();
	        return point;
	    };
	    Point.createByUint32 = function (uint32) {
	        var point = new Point();
	        point.uint32 = uint32 >>> 0;
	        point._loadRGBA();
	        point._loadQuadruplet();
	        //point._loadLab();
	        return point;
	    };
	    Point.prototype.from = function (point) {
	        this.r = point.r;
	        this.g = point.g;
	        this.b = point.b;
	        this.a = point.a;
	        this.uint32 = point.uint32;
	        this.rgba[0] = point.r;
	        this.rgba[1] = point.g;
	        this.rgba[2] = point.b;
	        this.rgba[3] = point.a;
	        /*
	         this.Lab.L = point.Lab.L;
	         this.Lab.a = point.Lab.a;
	         this.Lab.b = point.Lab.b;
	         */
	    };
	    /*
	     * TODO:
	     Luminance from RGB:
	
	     Luminance (standard for certain colour spaces): (0.2126*R + 0.7152*G + 0.0722*B) [1]
	     Luminance (perceived option 1): (0.299*R + 0.587*G + 0.114*B) [2]
	     Luminance (perceived option 2, slower to calculate):  sqrt( 0.241*R^2 + 0.691*G^2 + 0.068*B^2 ) ? sqrt( 0.299*R^2 + 0.587*G^2 + 0.114*B^2 ) (thanks to @MatthewHerbst) [http://alienryderflex.com/hsp.html]
	     */
	    Point.prototype.getLuminosity = function (useAlphaChannel) {
	        var r = this.r, g = this.g, b = this.b;
	        if (useAlphaChannel) {
	            r = Math.min(255, 255 - this.a + this.a * r / 255);
	            g = Math.min(255, 255 - this.a + this.a * g / 255);
	            b = Math.min(255, 255 - this.a + this.a * b / 255);
	        }
	        //var luma = this.r * Point._RED_COEFFICIENT + this.g * Point._GREEN_COEFFICIENT + this.b * Point._BLUE_COEFFICIENT;
	        /*
	         if(useAlphaChannel) {
	         luma = (luma * (255 - this.a)) / 255;
	         }
	         */
	        return r * bt709_1.Y.RED + g * bt709_1.Y.GREEN + b * bt709_1.Y.BLUE;
	    };
	    Point.prototype._loadUINT32 = function () {
	        this.uint32 = (this.a << 24 | this.b << 16 | this.g << 8 | this.r) >>> 0;
	    };
	    Point.prototype._loadRGBA = function () {
	        this.r = this.uint32 & 0xff;
	        this.g = (this.uint32 >>> 8) & 0xff;
	        this.b = (this.uint32 >>> 16) & 0xff;
	        this.a = (this.uint32 >>> 24) & 0xff;
	    };
	    Point.prototype._loadQuadruplet = function () {
	        this.rgba[0] = this.r;
	        this.rgba[1] = this.g;
	        this.rgba[2] = this.b;
	        this.rgba[3] = this.a;
	        /*
	         var xyz = rgb2xyz(this.r, this.g, this.b);
	         var lab = xyz2lab(xyz.x, xyz.y, xyz.z);
	         this.lab.l = lab.l;
	         this.lab.a = lab.a;
	         this.lab.b = lab.b;
	         */
	    };
	    return Point;
	}());
	exports.Point = Point;


/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/*
	 * NeuQuantFloat Neural-Net Quantization Algorithm
	 * ------------------------------------------
	 *
	 * Copyright (c) 1994 Anthony Dekker
	 *
	 * NEUQUANT Neural-Net quantization algorithm by Anthony Dekker, 1994. See
	 * "Kohonen neural networks for optimal colour quantization" in "Network:
	 * Computation in Neural Systems" Vol. 5 (1994) pp 351-367. for a discussion of
	 * the algorithm.
	 *
	 * Any party obtaining a copy of these files from the author, directly or
	 * indirectly, is granted, free of charge, a full and unrestricted irrevocable,
	 * world-wide, paid up, royalty-free, nonexclusive right and license to deal in
	 * this software and documentation files (the "Software"), including without
	 * limitation the rights to use, copy, modify, merge, publish, distribute,
	 * sublicense, and/or sell copies of the Software, and to permit persons who
	 * receive copies from any such party to do so, with the only requirement being
	 * that this copyright notice remain intact.
	 */
	/**
	 * @preserve TypeScript port:
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * neuquant.ts - part of Image Quantization Library
	 */
	var palette_1 = __webpack_require__(22);
	var point_1 = __webpack_require__(24);
	// bias for colour values
	var networkBiasShift = 3;
	var NeuronFloat = (function () {
	    function NeuronFloat(defaultValue) {
	        this.r = this.g = this.b = this.a = defaultValue;
	    }
	    /**
	     * There is a fix in original NEUQUANT by Anthony Dekker (http://members.ozemail.com.au/~dekker/NEUQUANT.HTML)
	     * @example
	     * r = Math.min(255, (neuron.r + (1 << (networkBiasShift - 1))) >> networkBiasShift);
	     */
	    NeuronFloat.prototype.toPoint = function () {
	        return point_1.Point.createByRGBA(this.r >> networkBiasShift, this.g >> networkBiasShift, this.b >> networkBiasShift, this.a >> networkBiasShift);
	    };
	    NeuronFloat.prototype.subtract = function (r, g, b, a) {
	        this.r -= r;
	        this.g -= g;
	        this.b -= b;
	        this.a -= a;
	    };
	    return NeuronFloat;
	}());
	var NeuQuantFloat = (function () {
	    function NeuQuantFloat(colorDistanceCalculator, colors) {
	        if (colors === void 0) { colors = 256; }
	        this._distance = colorDistanceCalculator;
	        this._pointArray = [];
	        this._sampleFactor = 1;
	        this._networkSize = colors;
	        this._distance.setWhitePoint(255 << networkBiasShift, 255 << networkBiasShift, 255 << networkBiasShift, 255 << networkBiasShift);
	    }
	    NeuQuantFloat.prototype.sample = function (pointBuffer) {
	        this._pointArray = this._pointArray.concat(pointBuffer.getPointArray());
	    };
	    NeuQuantFloat.prototype.quantize = function () {
	        this._init();
	        this._learn();
	        return this._buildPalette();
	    };
	    NeuQuantFloat.prototype._init = function () {
	        this._freq = [];
	        this._bias = [];
	        this._radPower = [];
	        this._network = [];
	        for (var i = 0; i < this._networkSize; i++) {
	            this._network[i] = new NeuronFloat((i << (networkBiasShift + 8)) / this._networkSize);
	            // 1/this._networkSize
	            this._freq[i] = NeuQuantFloat._initialBias / this._networkSize;
	            this._bias[i] = 0;
	        }
	    };
	    /**
	     * Main Learning Loop
	     */
	    NeuQuantFloat.prototype._learn = function () {
	        var sampleFactor = this._sampleFactor;
	        var pointsNumber = this._pointArray.length;
	        if (pointsNumber < NeuQuantFloat._minpicturebytes)
	            sampleFactor = 1;
	        var alphadec = 30 + (sampleFactor - 1) / 3, pointsToSample = pointsNumber / sampleFactor;
	        var delta = pointsToSample / NeuQuantFloat._nCycles | 0, alpha = NeuQuantFloat._initAlpha, radius = (this._networkSize >> 3) * NeuQuantFloat._radiusBias;
	        var rad = radius >> NeuQuantFloat._radiusBiasShift;
	        if (rad <= 1)
	            rad = 0;
	        for (var i = 0; i < rad; i++) {
	            this._radPower[i] = alpha * (((rad * rad - i * i) * NeuQuantFloat._radBias) / (rad * rad));
	        }
	        var step;
	        if (pointsNumber < NeuQuantFloat._minpicturebytes) {
	            step = 1;
	        }
	        else if (pointsNumber % NeuQuantFloat._prime1 != 0) {
	            step = NeuQuantFloat._prime1;
	        }
	        else if ((pointsNumber % NeuQuantFloat._prime2) != 0) {
	            step = NeuQuantFloat._prime2;
	        }
	        else if ((pointsNumber % NeuQuantFloat._prime3) != 0) {
	            step = NeuQuantFloat._prime3;
	        }
	        else {
	            step = NeuQuantFloat._prime4;
	        }
	        for (var i = 0, pointIndex = 0; i < pointsToSample;) {
	            var point = this._pointArray[pointIndex], b = point.b << networkBiasShift, g = point.g << networkBiasShift, r = point.r << networkBiasShift, a = point.a << networkBiasShift, neuronIndex = this._contest(b, g, r, a);
	            this._alterSingle(alpha, neuronIndex, b, g, r, a);
	            if (rad != 0)
	                this._alterNeighbour(rad, neuronIndex, b, g, r, a);
	            /* alter neighbours */
	            pointIndex += step;
	            if (pointIndex >= pointsNumber)
	                pointIndex -= pointsNumber;
	            i++;
	            if (delta == 0)
	                delta = 1;
	            if (i % delta == 0) {
	                alpha -= (alpha / alphadec);
	                radius -= (radius / NeuQuantFloat._radiusDecrease);
	                rad = radius >> NeuQuantFloat._radiusBiasShift;
	                if (rad <= 1)
	                    rad = 0;
	                for (var j = 0; j < rad; j++)
	                    this._radPower[j] = alpha * (((rad * rad - j * j) * NeuQuantFloat._radBias) / (rad * rad));
	            }
	        }
	    };
	    NeuQuantFloat.prototype._buildPalette = function () {
	        var palette = new palette_1.Palette();
	        this._network.forEach(function (neuron) {
	            palette.add(neuron.toPoint());
	        });
	        palette.sort();
	        return palette;
	    };
	    /**
	     * Move adjacent neurons by precomputed alpha*(1-((i-j)^2/[r]^2)) in radpower[|i-j|]
	     */
	    NeuQuantFloat.prototype._alterNeighbour = function (rad, i, b, g, r, al) {
	        var lo = i - rad;
	        if (lo < -1)
	            lo = -1;
	        var hi = i + rad;
	        if (hi > this._networkSize)
	            hi = this._networkSize;
	        var j = i + 1, k = i - 1, m = 1;
	        while (j < hi || k > lo) {
	            var a = this._radPower[m++] / NeuQuantFloat._alphaRadBias;
	            if (j < hi) {
	                var p = this._network[j++];
	                p.subtract(a * (p.r - r), a * (p.g - g), a * (p.b - b), a * (p.a - al));
	            }
	            if (k > lo) {
	                var p = this._network[k--];
	                p.subtract(a * (p.r - r), a * (p.g - g), a * (p.b - b), a * (p.a - al));
	            }
	        }
	    };
	    /**
	     * Move neuron i towards biased (b,g,r) by factor alpha
	     */
	    NeuQuantFloat.prototype._alterSingle = function (alpha, i, b, g, r, a) {
	        alpha /= NeuQuantFloat._initAlpha;
	        /* alter hit neuron */
	        var n = this._network[i];
	        n.subtract(alpha * (n.r - r), alpha * (n.g - g), alpha * (n.b - b), alpha * (n.a - a));
	    };
	    /**
	     * Search for biased BGR values
	     * description:
	     *    finds closest neuron (min dist) and updates freq
	     *    finds best neuron (min dist-bias) and returns position
	     *    for frequently chosen neurons, freq[i] is high and bias[i] is negative
	     *    bias[i] = _gamma*((1/this._networkSize)-freq[i])
	     *
	     * Original distance equation:
	     *        dist = abs(dR) + abs(dG) + abs(dB)
	     */
	    NeuQuantFloat.prototype._contest = function (b, g, r, al) {
	        var multiplier = (255 * 4) << networkBiasShift;
	        var bestd = ~(1 << 31), bestbiasd = bestd, bestpos = -1, bestbiaspos = bestpos;
	        for (var i = 0; i < this._networkSize; i++) {
	            var n = this._network[i], dist = this._distance.calculateNormalized(n, { r: r, g: g, b: b, a: al }) * multiplier;
	            if (dist < bestd) {
	                bestd = dist;
	                bestpos = i;
	            }
	            var biasdist = dist - ((this._bias[i]) >> (NeuQuantFloat._initialBiasShift - networkBiasShift));
	            if (biasdist < bestbiasd) {
	                bestbiasd = biasdist;
	                bestbiaspos = i;
	            }
	            var betafreq = (this._freq[i] >> NeuQuantFloat._betaShift);
	            this._freq[i] -= betafreq;
	            this._bias[i] += (betafreq << NeuQuantFloat._gammaShift);
	        }
	        this._freq[bestpos] += NeuQuantFloat._beta;
	        this._bias[bestpos] -= NeuQuantFloat._betaGamma;
	        return bestbiaspos;
	    };
	    /*
	     four primes near 500 - assume no image has a length so large
	     that it is divisible by all four primes
	     */
	    NeuQuantFloat._prime1 = 499;
	    NeuQuantFloat._prime2 = 491;
	    NeuQuantFloat._prime3 = 487;
	    NeuQuantFloat._prime4 = 503;
	    NeuQuantFloat._minpicturebytes = NeuQuantFloat._prime4;
	    // no. of learning cycles
	    NeuQuantFloat._nCycles = 100;
	    // defs for freq and bias
	    NeuQuantFloat._initialBiasShift = 16;
	    // bias for fractions
	    NeuQuantFloat._initialBias = (1 << NeuQuantFloat._initialBiasShift);
	    NeuQuantFloat._gammaShift = 10;
	    // gamma = 1024
	    // TODO: why gamma is never used?
	    //private static _gamma : number     = (1 << NeuQuantFloat._gammaShift);
	    NeuQuantFloat._betaShift = 10;
	    NeuQuantFloat._beta = (NeuQuantFloat._initialBias >> NeuQuantFloat._betaShift);
	    // beta = 1/1024
	    NeuQuantFloat._betaGamma = (NeuQuantFloat._initialBias << (NeuQuantFloat._gammaShift - NeuQuantFloat._betaShift));
	    /*
	     * for 256 cols, radius starts
	     */
	    NeuQuantFloat._radiusBiasShift = 6;
	    // at 32.0 biased by 6 bits
	    NeuQuantFloat._radiusBias = 1 << NeuQuantFloat._radiusBiasShift;
	    // and decreases by a factor of 1/30 each cycle
	    NeuQuantFloat._radiusDecrease = 30;
	    /* defs for decreasing alpha factor */
	    // alpha starts at 1.0
	    NeuQuantFloat._alphaBiasShift = 10;
	    // biased by 10 bits
	    NeuQuantFloat._initAlpha = (1 << NeuQuantFloat._alphaBiasShift);
	    /* radBias and alphaRadBias used for radpower calculation */
	    NeuQuantFloat._radBiasShift = 8;
	    NeuQuantFloat._radBias = 1 << NeuQuantFloat._radBiasShift;
	    NeuQuantFloat._alphaRadBiasShift = NeuQuantFloat._alphaBiasShift + NeuQuantFloat._radBiasShift;
	    NeuQuantFloat._alphaRadBias = 1 << NeuQuantFloat._alphaRadBiasShift;
	    return NeuQuantFloat;
	}());
	exports.NeuQuantFloat = NeuQuantFloat;


/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	/*
	 * Copyright (c) 2015, Leon Sorokin
	 * All rights reserved. (MIT Licensed)
	 *
	 * RgbQuant.js - an image quantization lib
	 */
	"use strict";
	/**
	 * @preserve TypeScript port:
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * rgbquant.ts - part of Image Quantization Library
	 */
	var palette_1 = __webpack_require__(22);
	var point_1 = __webpack_require__(24);
	var colorHistogram_1 = __webpack_require__(27);
	var arithmetic_1 = __webpack_require__(6);
	var RemovedColor = (function () {
	    function RemovedColor(index, color, distance) {
	        this.index = index;
	        this.color = color;
	        this.distance = distance;
	    }
	    return RemovedColor;
	}());
	// TODO: make input/output image and input/output palettes with instances of class Point only!
	var RGBQuant = (function () {
	    function RGBQuant(colorDistanceCalculator, colors, method) {
	        if (colors === void 0) { colors = 256; }
	        if (method === void 0) { method = 2; }
	        this._distance = colorDistanceCalculator;
	        // desired final palette size
	        this._colors = colors;
	        // histogram to accumulate
	        this._histogram = new colorHistogram_1.ColorHistogram(method, colors);
	        this._initialDistance = 0.01;
	        this._distanceIncrement = 0.005;
	    }
	    // gathers histogram info
	    RGBQuant.prototype.sample = function (image) {
	        /*
	         var pointArray = image.getPointArray(), max = [0, 0, 0, 0], min = [255, 255, 255, 255];
	
	         for (var i = 0, l = pointArray.length; i < l; i++) {
	         var color = pointArray[i];
	         for (var componentIndex = 0; componentIndex < 4; componentIndex++) {
	         if (max[componentIndex] < color.rgba[componentIndex]) max[componentIndex] = color.rgba[componentIndex];
	         if (min[componentIndex] > color.rgba[componentIndex]) min[componentIndex] = color.rgba[componentIndex];
	         }
	         }
	         var rd = max[0] - min[0], gd = max[1] - min[1], bd = max[2] - min[2], ad = max[3] - min[3];
	         this._distance.setWhitePoint(rd, gd, bd, ad);
	
	         this._initialDistance = (Math.sqrt(rd * rd + gd * gd + bd * bd + ad * ad) / Math.sqrt(255 * 255 + 255 * 255 + 255 * 255)) * 0.01;
	         */
	        this._histogram.sample(image);
	    };
	    // reduces histogram to palette, remaps & memoizes reduced colors
	    RGBQuant.prototype.quantize = function () {
	        var idxi32 = this._histogram.getImportanceSortedColorsIDXI32();
	        if (idxi32.length === 0) {
	            throw new Error("No colors in image");
	        }
	        var palette = this._buildPalette(idxi32);
	        palette.sort();
	        return palette;
	    };
	    // reduces similar colors from an importance-sorted Uint32 rgba array
	    RGBQuant.prototype._buildPalette = function (idxi32) {
	        // reduce histogram to create initial palette
	        // build full rgb palette
	        var palette = new palette_1.Palette(), colorArray = palette.getPointContainer().getPointArray(), usageArray = new Array(idxi32.length);
	        for (var i = 0; i < idxi32.length; i++) {
	            colorArray.push(point_1.Point.createByUint32(idxi32[i]));
	            usageArray[i] = 1;
	        }
	        var len = colorArray.length, memDist = [];
	        var palLen = len, thold = this._initialDistance;
	        // palette already at or below desired length
	        while (palLen > this._colors) {
	            memDist.length = 0;
	            // iterate palette
	            for (var i = 0; i < len; i++) {
	                if (usageArray[i] === 0)
	                    continue;
	                var pxi = colorArray[i];
	                //if (!pxi) continue;
	                for (var j = i + 1; j < len; j++) {
	                    if (usageArray[j] === 0)
	                        continue;
	                    var pxj = colorArray[j];
	                    //if (!pxj) continue;
	                    var dist = this._distance.calculateNormalized(pxi, pxj);
	                    if (dist < thold) {
	                        // store index,rgb,dist
	                        memDist.push(new RemovedColor(j, pxj, dist));
	                        usageArray[j] = 0;
	                        palLen--;
	                    }
	                }
	            }
	            // palette reduction pass
	            // console.log("palette length: " + palLen);
	            // if palette is still much larger than target, increment by larger initDist
	            thold += (palLen > this._colors * 3) ? this._initialDistance : this._distanceIncrement;
	        }
	        // if palette is over-reduced, re-add removed colors with largest distances from last round
	        if (palLen < this._colors) {
	            // sort descending
	            arithmetic_1.stableSort(memDist, function (a, b) {
	                return b.distance - a.distance;
	            });
	            var k = 0;
	            while (palLen < this._colors && k < memDist.length) {
	                var removedColor = memDist[k];
	                // re-inject rgb into final palette
	                usageArray[removedColor.index] = 1;
	                palLen++;
	                k++;
	            }
	        }
	        var colors = colorArray.length;
	        for (var colorIndex = colors - 1; colorIndex >= 0; colorIndex--) {
	            if (usageArray[colorIndex] === 0) {
	                if (colorIndex !== colors - 1) {
	                    colorArray[colorIndex] = colorArray[colors - 1];
	                }
	                --colors;
	            }
	        }
	        colorArray.length = colors;
	        return palette;
	    };
	    return RGBQuant;
	}());
	exports.RGBQuant = RGBQuant;


/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	/*
	 * Copyright (c) 2015, Leon Sorokin
	 * All rights reserved. (MIT Licensed)
	 *
	 * ColorHistogram.js - an image quantization lib
	 */
	"use strict";
	/**
	 * @preserve TypeScript port:
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * colorHistogram.ts - part of Image Quantization Library
	 */
	var hueStatistics_1 = __webpack_require__(28);
	var arithmetic_1 = __webpack_require__(6);
	var ColorHistogram = (function () {
	    function ColorHistogram(method, colors) {
	        // 1 = by global population, 2 = subregion population threshold
	        this._method = method;
	        // if > 0, enables hues stats and min-color retention per group
	        this._minHueCols = colors << 2; //opts.minHueCols || 0;
	        // # of highest-frequency colors to start with for palette reduction
	        this._initColors = colors << 2;
	        // HueStatistics instance
	        this._hueStats = new hueStatistics_1.HueStatistics(ColorHistogram._hueGroups, this._minHueCols);
	        this._histogram = Object.create(null);
	    }
	    ColorHistogram.prototype.sample = function (pointBuffer) {
	        switch (this._method) {
	            case 1:
	                this._colorStats1D(pointBuffer);
	                break;
	            case 2:
	                this._colorStats2D(pointBuffer);
	                break;
	        }
	    };
	    ColorHistogram.prototype.getImportanceSortedColorsIDXI32 = function () {
	        var _this = this;
	        // TODO: fix typing issue in stableSort func
	        var sorted = arithmetic_1.stableSort(Object.keys(this._histogram), function (a, b) { return _this._histogram[b] - _this._histogram[a]; });
	        if (sorted.length === 0) {
	            return [];
	        }
	        var idxi32;
	        switch (this._method) {
	            case 1:
	                var initialColorsLimit = Math.min(sorted.length, this._initColors), last = sorted[initialColorsLimit - 1], freq = this._histogram[last];
	                idxi32 = sorted.slice(0, initialColorsLimit);
	                // add any cut off colors with same freq as last
	                var pos = initialColorsLimit, len = sorted.length;
	                while (pos < len && this._histogram[sorted[pos]] == freq)
	                    idxi32.push(sorted[pos++]);
	                // inject min huegroup colors
	                this._hueStats.injectIntoArray(idxi32);
	                break;
	            case 2:
	                idxi32 = sorted;
	                break;
	            default:
	                // TODO: rethink errors
	                throw new Error("Incorrect method");
	        }
	        // int32-ify values
	        return idxi32.map(function (v) {
	            return +v;
	        });
	    };
	    // global top-population
	    ColorHistogram.prototype._colorStats1D = function (pointBuffer) {
	        var histG = this._histogram, pointArray = pointBuffer.getPointArray(), len = pointArray.length;
	        for (var i = 0; i < len; i++) {
	            var col = pointArray[i].uint32;
	            // collect hue stats
	            this._hueStats.check(col);
	            if (col in histG)
	                histG[col]++;
	            else
	                histG[col] = 1;
	        }
	    };
	    // population threshold within subregions
	    // FIXME: this can over-reduce (few/no colors same?), need a way to keep
	    // important colors that dont ever reach local thresholds (gradients?)
	    ColorHistogram.prototype._colorStats2D = function (pointBuffer) {
	        var _this = this;
	        var width = pointBuffer.getWidth(), height = pointBuffer.getHeight(), pointArray = pointBuffer.getPointArray();
	        var boxW = ColorHistogram._boxSize[0], boxH = ColorHistogram._boxSize[1], area = boxW * boxH, boxes = this._makeBoxes(width, height, boxW, boxH), histG = this._histogram;
	        boxes.forEach(function (box) {
	            var effc = Math.round((box.w * box.h) / area) * ColorHistogram._boxPixels;
	            if (effc < 2)
	                effc = 2;
	            var histL = {};
	            _this._iterateBox(box, width, function (i) {
	                var col = pointArray[i].uint32;
	                // collect hue stats
	                _this._hueStats.check(col);
	                if (col in histG)
	                    histG[col]++;
	                else if (col in histL) {
	                    if (++histL[col] >= effc)
	                        histG[col] = histL[col];
	                }
	                else
	                    histL[col] = 1;
	            });
	        });
	        // inject min huegroup colors
	        this._hueStats.injectIntoDictionary(histG);
	    };
	    // iterates @bbox within a parent rect of width @wid; calls @fn, passing index within parent
	    ColorHistogram.prototype._iterateBox = function (bbox, wid, fn) {
	        var b = bbox, i0 = b.y * wid + b.x, i1 = (b.y + b.h - 1) * wid + (b.x + b.w - 1), incr = wid - b.w + 1;
	        var cnt = 0, i = i0;
	        do {
	            fn.call(this, i);
	            i += (++cnt % b.w == 0) ? incr : 1;
	        } while (i <= i1);
	    };
	    /**
	     *    partitions a rectangle of width x height into
	     *    array of boxes stepX x stepY (or less)
	     */
	    ColorHistogram.prototype._makeBoxes = function (width, height, stepX, stepY) {
	        var wrem = width % stepX, hrem = height % stepY, xend = width - wrem, yend = height - hrem, boxesArray = [];
	        for (var y = 0; y < height; y += stepY)
	            for (var x = 0; x < width; x += stepX)
	                boxesArray.push({ x: x, y: y, w: (x == xend ? wrem : stepX), h: (y == yend ? hrem : stepY) });
	        return boxesArray;
	    };
	    ColorHistogram._boxSize = [64, 64];
	    ColorHistogram._boxPixels = 2;
	    ColorHistogram._hueGroups = 10;
	    return ColorHistogram;
	}());
	exports.ColorHistogram = ColorHistogram;


/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * hueStatistics.ts - part of Image Quantization Library
	 */
	var rgb2hsl_1 = __webpack_require__(5);
	var palette_1 = __webpack_require__(22);
	var HueGroup = (function () {
	    function HueGroup() {
	        this.num = 0;
	        this.cols = [];
	    }
	    return HueGroup;
	}());
	var HueStatistics = (function () {
	    function HueStatistics(numGroups, minCols) {
	        this._numGroups = numGroups;
	        this._minCols = minCols;
	        this._stats = [];
	        for (var i = 0; i <= numGroups; i++) {
	            this._stats[i] = new HueGroup();
	        }
	        this._groupsFull = 0;
	    }
	    HueStatistics.prototype.check = function (i32) {
	        if (this._groupsFull == this._numGroups + 1) {
	            this.check = function () {
	            };
	        }
	        var r = (i32 & 0xff), g = (i32 >>> 8) & 0xff, b = (i32 >>> 16) & 0xff, hg = (r == g && g == b) ? 0 : 1 + palette_1.hueGroup(rgb2hsl_1.rgb2hsl(r, g, b).h, this._numGroups), gr = this._stats[hg], min = this._minCols;
	        gr.num++;
	        if (gr.num > min)
	            return;
	        if (gr.num == min)
	            this._groupsFull++;
	        if (gr.num <= min)
	            this._stats[hg].cols.push(i32);
	    };
	    HueStatistics.prototype.injectIntoDictionary = function (histG) {
	        for (var i = 0; i <= this._numGroups; i++) {
	            if (this._stats[i].num <= this._minCols) {
	                this._stats[i].cols.forEach(function (col) {
	                    if (!histG[col])
	                        histG[col] = 1;
	                    else
	                        histG[col]++;
	                });
	            }
	        }
	    };
	    HueStatistics.prototype.injectIntoArray = function (histG) {
	        for (var i = 0; i <= this._numGroups; i++) {
	            if (this._stats[i].num <= this._minCols) {
	                this._stats[i].cols.forEach(function (col) {
	                    if (histG.indexOf(col) == -1)
	                        histG.push(col);
	                });
	            }
	        }
	    };
	    return HueStatistics;
	}());
	exports.HueStatistics = HueStatistics;


/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * wuQuant.ts - part of Image Quantization Library
	 */
	var palette_1 = __webpack_require__(22);
	var point_1 = __webpack_require__(24);
	function createArray1D(dimension1) {
	    var a = [];
	    for (var k = 0; k < dimension1; k++) {
	        a[k] = 0;
	    }
	    return a;
	}
	function createArray4D(dimension1, dimension2, dimension3, dimension4) {
	    var a = new Array(dimension1);
	    for (var i = 0; i < dimension1; i++) {
	        a[i] = new Array(dimension2);
	        for (var j = 0; j < dimension2; j++) {
	            a[i][j] = new Array(dimension3);
	            for (var k = 0; k < dimension3; k++) {
	                a[i][j][k] = new Array(dimension4);
	                for (var l = 0; l < dimension4; l++) {
	                    a[i][j][k][l] = 0;
	                }
	            }
	        }
	    }
	    return a;
	}
	function createArray3D(dimension1, dimension2, dimension3) {
	    var a = new Array(dimension1);
	    for (var i = 0; i < dimension1; i++) {
	        a[i] = new Array(dimension2);
	        for (var j = 0; j < dimension2; j++) {
	            a[i][j] = new Array(dimension3);
	            for (var k = 0; k < dimension3; k++) {
	                a[i][j][k] = 0;
	            }
	        }
	    }
	    return a;
	}
	function fillArray3D(a, dimension1, dimension2, dimension3, value) {
	    for (var i = 0; i < dimension1; i++) {
	        a[i] = [];
	        for (var j = 0; j < dimension2; j++) {
	            a[i][j] = [];
	            for (var k = 0; k < dimension3; k++) {
	                a[i][j][k] = value;
	            }
	        }
	    }
	}
	function fillArray1D(a, dimension1, value) {
	    for (var i = 0; i < dimension1; i++) {
	        a[i] = value;
	    }
	}
	var WuColorCube = (function () {
	    function WuColorCube() {
	    }
	    return WuColorCube;
	}());
	exports.WuColorCube = WuColorCube;
	var WuQuant = (function () {
	    function WuQuant(colorDistanceCalculator, colors, significantBitsPerChannel) {
	        if (colors === void 0) { colors = 256; }
	        if (significantBitsPerChannel === void 0) { significantBitsPerChannel = 5; }
	        this._distance = colorDistanceCalculator;
	        this._setQuality(significantBitsPerChannel);
	        this._initialize(colors);
	    }
	    WuQuant.prototype.sample = function (image) {
	        var pointArray = image.getPointArray();
	        for (var i = 0, l = pointArray.length; i < l; i++) {
	            this._addColor(pointArray[i]);
	        }
	        this._pixels = this._pixels.concat(pointArray);
	    };
	    WuQuant.prototype.quantize = function () {
	        this._preparePalette();
	        var palette = new palette_1.Palette();
	        // generates palette
	        for (var paletteIndex = 0; paletteIndex < this._colors; paletteIndex++) {
	            if (this._sums[paletteIndex] > 0) {
	                var sum = this._sums[paletteIndex], r = this._reds[paletteIndex] / sum, g = this._greens[paletteIndex] / sum, b = this._blues[paletteIndex] / sum, a = this._alphas[paletteIndex] / sum;
	                var color = point_1.Point.createByRGBA(r | 0, g | 0, b | 0, a | 0);
	                palette.add(color);
	            }
	        }
	        palette.sort();
	        return palette;
	    };
	    WuQuant.prototype._preparePalette = function () {
	        // preprocess the colors
	        this._calculateMoments();
	        var next = 0, volumeVariance = createArray1D(this._colors);
	        // processes the cubes
	        for (var cubeIndex = 1; cubeIndex < this._colors; ++cubeIndex) {
	            // if cut is possible; make it
	            if (this._cut(this._cubes[next], this._cubes[cubeIndex])) {
	                volumeVariance[next] = this._cubes[next].volume > 1 ? this._calculateVariance(this._cubes[next]) : 0.0;
	                volumeVariance[cubeIndex] = this._cubes[cubeIndex].volume > 1 ? this._calculateVariance(this._cubes[cubeIndex]) : 0.0;
	            }
	            else {
	                // the cut was not possible, revert the index
	                volumeVariance[next] = 0.0;
	                cubeIndex--;
	            }
	            next = 0;
	            var temp = volumeVariance[0];
	            for (var index = 1; index <= cubeIndex; ++index) {
	                if (volumeVariance[index] > temp) {
	                    temp = volumeVariance[index];
	                    next = index;
	                }
	            }
	            if (temp <= 0.0) {
	                this._colors = cubeIndex + 1;
	                break;
	            }
	        }
	        var lookupRed = [], lookupGreen = [], lookupBlue = [], lookupAlpha = [];
	        // precalculates lookup tables
	        for (var k = 0; k < this._colors; ++k) {
	            var weight = WuQuant._volume(this._cubes[k], this._weights);
	            if (weight > 0) {
	                lookupRed[k] = (WuQuant._volume(this._cubes[k], this._momentsRed) / weight) | 0;
	                lookupGreen[k] = (WuQuant._volume(this._cubes[k], this._momentsGreen) / weight) | 0;
	                lookupBlue[k] = (WuQuant._volume(this._cubes[k], this._momentsBlue) / weight) | 0;
	                lookupAlpha[k] = (WuQuant._volume(this._cubes[k], this._momentsAlpha) / weight) | 0;
	            }
	            else {
	                lookupRed[k] = 0;
	                lookupGreen[k] = 0;
	                lookupBlue[k] = 0;
	                lookupAlpha[k] = 0;
	            }
	        }
	        this._reds = createArray1D(this._colors + 1);
	        this._greens = createArray1D(this._colors + 1);
	        this._blues = createArray1D(this._colors + 1);
	        this._alphas = createArray1D(this._colors + 1);
	        this._sums = createArray1D(this._colors + 1);
	        // scans and adds colors
	        for (var index = 0, l = this._pixels.length; index < l; index++) {
	            var color = this._pixels[index];
	            var match = -1;
	            var bestMatch = match, bestDistance = Number.MAX_VALUE;
	            for (var lookup = 0; lookup < this._colors; lookup++) {
	                var foundRed = lookupRed[lookup], foundGreen = lookupGreen[lookup], foundBlue = lookupBlue[lookup], foundAlpha = lookupAlpha[lookup];
	                var distance = this._distance.calculateRaw(foundRed, foundGreen, foundBlue, foundAlpha, color.r, color.g, color.b, color.a);
	                //var distance = this._distance.calculateRaw(Utils.Point.createByRGBA(foundRed, foundGreen, foundBlue, foundAlpha), color);
	                //deltaRed   = color.r - foundRed,
	                //deltaGreen = color.g - foundGreen,
	                //deltaBlue  = color.b - foundBlue,
	                //deltaAlpha = color.a - foundAlpha,
	                //distance   = deltaRed * deltaRed + deltaGreen * deltaGreen + deltaBlue * deltaBlue + deltaAlpha * deltaAlpha;
	                if (distance < bestDistance) {
	                    bestDistance = distance;
	                    bestMatch = lookup;
	                }
	            }
	            this._reds[bestMatch] += color.r;
	            this._greens[bestMatch] += color.g;
	            this._blues[bestMatch] += color.b;
	            this._alphas[bestMatch] += color.a;
	            this._sums[bestMatch]++;
	        }
	    };
	    WuQuant.prototype._addColor = function (color) {
	        var bitsToRemove = 8 - this._significantBitsPerChannel, indexRed = (color.r >> bitsToRemove) + 1, indexGreen = (color.g >> bitsToRemove) + 1, indexBlue = (color.b >> bitsToRemove) + 1, indexAlpha = (color.a >> bitsToRemove) + 1;
	        //if(color.a > 10) {
	        this._weights[indexAlpha][indexRed][indexGreen][indexBlue]++;
	        this._momentsRed[indexAlpha][indexRed][indexGreen][indexBlue] += color.r;
	        this._momentsGreen[indexAlpha][indexRed][indexGreen][indexBlue] += color.g;
	        this._momentsBlue[indexAlpha][indexRed][indexGreen][indexBlue] += color.b;
	        this._momentsAlpha[indexAlpha][indexRed][indexGreen][indexBlue] += color.a;
	        this._moments[indexAlpha][indexRed][indexGreen][indexBlue] += this._table[color.r] + this._table[color.g] + this._table[color.b] + this._table[color.a];
	        //			}
	    };
	    /**
	     * Converts the histogram to a series of _moments.
	     */
	    WuQuant.prototype._calculateMoments = function () {
	        var area = [], areaRed = [], areaGreen = [], areaBlue = [], areaAlpha = [], area2 = [];
	        var xarea = createArray3D(this._sideSize, this._sideSize, this._sideSize), xareaRed = createArray3D(this._sideSize, this._sideSize, this._sideSize), xareaGreen = createArray3D(this._sideSize, this._sideSize, this._sideSize), xareaBlue = createArray3D(this._sideSize, this._sideSize, this._sideSize), xareaAlpha = createArray3D(this._sideSize, this._sideSize, this._sideSize), xarea2 = createArray3D(this._sideSize, this._sideSize, this._sideSize);
	        for (var alphaIndex = 1; alphaIndex <= this._alphaMaxSideIndex; ++alphaIndex) {
	            fillArray3D(xarea, this._sideSize, this._sideSize, this._sideSize, 0);
	            fillArray3D(xareaRed, this._sideSize, this._sideSize, this._sideSize, 0);
	            fillArray3D(xareaGreen, this._sideSize, this._sideSize, this._sideSize, 0);
	            fillArray3D(xareaBlue, this._sideSize, this._sideSize, this._sideSize, 0);
	            fillArray3D(xareaAlpha, this._sideSize, this._sideSize, this._sideSize, 0);
	            fillArray3D(xarea2, this._sideSize, this._sideSize, this._sideSize, 0);
	            for (var redIndex = 1; redIndex <= this._maxSideIndex; ++redIndex) {
	                fillArray1D(area, this._sideSize, 0);
	                fillArray1D(areaRed, this._sideSize, 0);
	                fillArray1D(areaGreen, this._sideSize, 0);
	                fillArray1D(areaBlue, this._sideSize, 0);
	                fillArray1D(areaAlpha, this._sideSize, 0);
	                fillArray1D(area2, this._sideSize, 0);
	                for (var greenIndex = 1; greenIndex <= this._maxSideIndex; ++greenIndex) {
	                    var line = 0, lineRed = 0, lineGreen = 0, lineBlue = 0, lineAlpha = 0, line2 = 0.0;
	                    for (var blueIndex = 1; blueIndex <= this._maxSideIndex; ++blueIndex) {
	                        line += this._weights[alphaIndex][redIndex][greenIndex][blueIndex];
	                        lineRed += this._momentsRed[alphaIndex][redIndex][greenIndex][blueIndex];
	                        lineGreen += this._momentsGreen[alphaIndex][redIndex][greenIndex][blueIndex];
	                        lineBlue += this._momentsBlue[alphaIndex][redIndex][greenIndex][blueIndex];
	                        lineAlpha += this._momentsAlpha[alphaIndex][redIndex][greenIndex][blueIndex];
	                        line2 += this._moments[alphaIndex][redIndex][greenIndex][blueIndex];
	                        area[blueIndex] += line;
	                        areaRed[blueIndex] += lineRed;
	                        areaGreen[blueIndex] += lineGreen;
	                        areaBlue[blueIndex] += lineBlue;
	                        areaAlpha[blueIndex] += lineAlpha;
	                        area2[blueIndex] += line2;
	                        xarea[redIndex][greenIndex][blueIndex] = xarea[redIndex - 1][greenIndex][blueIndex] + area[blueIndex];
	                        xareaRed[redIndex][greenIndex][blueIndex] = xareaRed[redIndex - 1][greenIndex][blueIndex] + areaRed[blueIndex];
	                        xareaGreen[redIndex][greenIndex][blueIndex] = xareaGreen[redIndex - 1][greenIndex][blueIndex] + areaGreen[blueIndex];
	                        xareaBlue[redIndex][greenIndex][blueIndex] = xareaBlue[redIndex - 1][greenIndex][blueIndex] + areaBlue[blueIndex];
	                        xareaAlpha[redIndex][greenIndex][blueIndex] = xareaAlpha[redIndex - 1][greenIndex][blueIndex] + areaAlpha[blueIndex];
	                        xarea2[redIndex][greenIndex][blueIndex] = xarea2[redIndex - 1][greenIndex][blueIndex] + area2[blueIndex];
	                        this._weights[alphaIndex][redIndex][greenIndex][blueIndex] = this._weights[alphaIndex - 1][redIndex][greenIndex][blueIndex] + xarea[redIndex][greenIndex][blueIndex];
	                        this._momentsRed[alphaIndex][redIndex][greenIndex][blueIndex] = this._momentsRed[alphaIndex - 1][redIndex][greenIndex][blueIndex] + xareaRed[redIndex][greenIndex][blueIndex];
	                        this._momentsGreen[alphaIndex][redIndex][greenIndex][blueIndex] = this._momentsGreen[alphaIndex - 1][redIndex][greenIndex][blueIndex] + xareaGreen[redIndex][greenIndex][blueIndex];
	                        this._momentsBlue[alphaIndex][redIndex][greenIndex][blueIndex] = this._momentsBlue[alphaIndex - 1][redIndex][greenIndex][blueIndex] + xareaBlue[redIndex][greenIndex][blueIndex];
	                        this._momentsAlpha[alphaIndex][redIndex][greenIndex][blueIndex] = this._momentsAlpha[alphaIndex - 1][redIndex][greenIndex][blueIndex] + xareaAlpha[redIndex][greenIndex][blueIndex];
	                        this._moments[alphaIndex][redIndex][greenIndex][blueIndex] = this._moments[alphaIndex - 1][redIndex][greenIndex][blueIndex] + xarea2[redIndex][greenIndex][blueIndex];
	                    }
	                }
	            }
	        }
	    };
	    /**
	     * Computes the volume of the cube in a specific moment.
	     */
	    WuQuant._volumeFloat = function (cube, moment) {
	        return (moment[cube.alphaMaximum][cube.redMaximum][cube.greenMaximum][cube.blueMaximum] -
	            moment[cube.alphaMaximum][cube.redMaximum][cube.greenMinimum][cube.blueMaximum] -
	            moment[cube.alphaMaximum][cube.redMinimum][cube.greenMaximum][cube.blueMaximum] +
	            moment[cube.alphaMaximum][cube.redMinimum][cube.greenMinimum][cube.blueMaximum] -
	            moment[cube.alphaMinimum][cube.redMaximum][cube.greenMaximum][cube.blueMaximum] +
	            moment[cube.alphaMinimum][cube.redMaximum][cube.greenMinimum][cube.blueMaximum] +
	            moment[cube.alphaMinimum][cube.redMinimum][cube.greenMaximum][cube.blueMaximum] -
	            moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][cube.blueMaximum]) -
	            (moment[cube.alphaMaximum][cube.redMaximum][cube.greenMaximum][cube.blueMinimum] -
	                moment[cube.alphaMinimum][cube.redMaximum][cube.greenMaximum][cube.blueMinimum] -
	                moment[cube.alphaMaximum][cube.redMaximum][cube.greenMinimum][cube.blueMinimum] +
	                moment[cube.alphaMinimum][cube.redMaximum][cube.greenMinimum][cube.blueMinimum] -
	                moment[cube.alphaMaximum][cube.redMinimum][cube.greenMaximum][cube.blueMinimum] +
	                moment[cube.alphaMinimum][cube.redMinimum][cube.greenMaximum][cube.blueMinimum] +
	                moment[cube.alphaMaximum][cube.redMinimum][cube.greenMinimum][cube.blueMinimum] -
	                moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][cube.blueMinimum]);
	    };
	    /**
	     * Computes the volume of the cube in a specific moment.
	     */
	    WuQuant._volume = function (cube, moment) {
	        return WuQuant._volumeFloat(cube, moment) | 0;
	    };
	    /**
	     * Splits the cube in given position][and color direction.
	     */
	    WuQuant._top = function (cube, direction, position, moment) {
	        var result;
	        switch (direction) {
	            case WuQuant.alpha:
	                result = (moment[position][cube.redMaximum][cube.greenMaximum][cube.blueMaximum] -
	                    moment[position][cube.redMaximum][cube.greenMinimum][cube.blueMaximum] -
	                    moment[position][cube.redMinimum][cube.greenMaximum][cube.blueMaximum] +
	                    moment[position][cube.redMinimum][cube.greenMinimum][cube.blueMaximum]) -
	                    (moment[position][cube.redMaximum][cube.greenMaximum][cube.blueMinimum] -
	                        moment[position][cube.redMaximum][cube.greenMinimum][cube.blueMinimum] -
	                        moment[position][cube.redMinimum][cube.greenMaximum][cube.blueMinimum] +
	                        moment[position][cube.redMinimum][cube.greenMinimum][cube.blueMinimum]);
	                break;
	            case WuQuant.red:
	                result = (moment[cube.alphaMaximum][position][cube.greenMaximum][cube.blueMaximum] -
	                    moment[cube.alphaMaximum][position][cube.greenMinimum][cube.blueMaximum] -
	                    moment[cube.alphaMinimum][position][cube.greenMaximum][cube.blueMaximum] +
	                    moment[cube.alphaMinimum][position][cube.greenMinimum][cube.blueMaximum]) -
	                    (moment[cube.alphaMaximum][position][cube.greenMaximum][cube.blueMinimum] -
	                        moment[cube.alphaMaximum][position][cube.greenMinimum][cube.blueMinimum] -
	                        moment[cube.alphaMinimum][position][cube.greenMaximum][cube.blueMinimum] +
	                        moment[cube.alphaMinimum][position][cube.greenMinimum][cube.blueMinimum]);
	                break;
	            case WuQuant.green:
	                result = (moment[cube.alphaMaximum][cube.redMaximum][position][cube.blueMaximum] -
	                    moment[cube.alphaMaximum][cube.redMinimum][position][cube.blueMaximum] -
	                    moment[cube.alphaMinimum][cube.redMaximum][position][cube.blueMaximum] +
	                    moment[cube.alphaMinimum][cube.redMinimum][position][cube.blueMaximum]) -
	                    (moment[cube.alphaMaximum][cube.redMaximum][position][cube.blueMinimum] -
	                        moment[cube.alphaMaximum][cube.redMinimum][position][cube.blueMinimum] -
	                        moment[cube.alphaMinimum][cube.redMaximum][position][cube.blueMinimum] +
	                        moment[cube.alphaMinimum][cube.redMinimum][position][cube.blueMinimum]);
	                break;
	            case WuQuant.blue:
	                result = (moment[cube.alphaMaximum][cube.redMaximum][cube.greenMaximum][position] -
	                    moment[cube.alphaMaximum][cube.redMaximum][cube.greenMinimum][position] -
	                    moment[cube.alphaMaximum][cube.redMinimum][cube.greenMaximum][position] +
	                    moment[cube.alphaMaximum][cube.redMinimum][cube.greenMinimum][position]) -
	                    (moment[cube.alphaMinimum][cube.redMaximum][cube.greenMaximum][position] -
	                        moment[cube.alphaMinimum][cube.redMaximum][cube.greenMinimum][position] -
	                        moment[cube.alphaMinimum][cube.redMinimum][cube.greenMaximum][position] +
	                        moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][position]);
	                break;
	            default:
	                throw new Error("impossible");
	        }
	        return result | 0;
	    };
	    /**
	     * Splits the cube in a given color direction at its minimum.
	     */
	    WuQuant._bottom = function (cube, direction, moment) {
	        switch (direction) {
	            case WuQuant.alpha:
	                return (-moment[cube.alphaMinimum][cube.redMaximum][cube.greenMaximum][cube.blueMaximum] +
	                    moment[cube.alphaMinimum][cube.redMaximum][cube.greenMinimum][cube.blueMaximum] +
	                    moment[cube.alphaMinimum][cube.redMinimum][cube.greenMaximum][cube.blueMaximum] -
	                    moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][cube.blueMaximum]) -
	                    (-moment[cube.alphaMinimum][cube.redMaximum][cube.greenMaximum][cube.blueMinimum] +
	                        moment[cube.alphaMinimum][cube.redMaximum][cube.greenMinimum][cube.blueMinimum] +
	                        moment[cube.alphaMinimum][cube.redMinimum][cube.greenMaximum][cube.blueMinimum] -
	                        moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][cube.blueMinimum]);
	            case WuQuant.red:
	                return (-moment[cube.alphaMaximum][cube.redMinimum][cube.greenMaximum][cube.blueMaximum] +
	                    moment[cube.alphaMaximum][cube.redMinimum][cube.greenMinimum][cube.blueMaximum] +
	                    moment[cube.alphaMinimum][cube.redMinimum][cube.greenMaximum][cube.blueMaximum] -
	                    moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][cube.blueMaximum]) -
	                    (-moment[cube.alphaMaximum][cube.redMinimum][cube.greenMaximum][cube.blueMinimum] +
	                        moment[cube.alphaMaximum][cube.redMinimum][cube.greenMinimum][cube.blueMinimum] +
	                        moment[cube.alphaMinimum][cube.redMinimum][cube.greenMaximum][cube.blueMinimum] -
	                        moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][cube.blueMinimum]);
	            case WuQuant.green:
	                return (-moment[cube.alphaMaximum][cube.redMaximum][cube.greenMinimum][cube.blueMaximum] +
	                    moment[cube.alphaMaximum][cube.redMinimum][cube.greenMinimum][cube.blueMaximum] +
	                    moment[cube.alphaMinimum][cube.redMaximum][cube.greenMinimum][cube.blueMaximum] -
	                    moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][cube.blueMaximum]) -
	                    (-moment[cube.alphaMaximum][cube.redMaximum][cube.greenMinimum][cube.blueMinimum] +
	                        moment[cube.alphaMaximum][cube.redMinimum][cube.greenMinimum][cube.blueMinimum] +
	                        moment[cube.alphaMinimum][cube.redMaximum][cube.greenMinimum][cube.blueMinimum] -
	                        moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][cube.blueMinimum]);
	            case WuQuant.blue:
	                return (-moment[cube.alphaMaximum][cube.redMaximum][cube.greenMaximum][cube.blueMinimum] +
	                    moment[cube.alphaMaximum][cube.redMaximum][cube.greenMinimum][cube.blueMinimum] +
	                    moment[cube.alphaMaximum][cube.redMinimum][cube.greenMaximum][cube.blueMinimum] -
	                    moment[cube.alphaMaximum][cube.redMinimum][cube.greenMinimum][cube.blueMinimum]) -
	                    (-moment[cube.alphaMinimum][cube.redMaximum][cube.greenMaximum][cube.blueMinimum] +
	                        moment[cube.alphaMinimum][cube.redMaximum][cube.greenMinimum][cube.blueMinimum] +
	                        moment[cube.alphaMinimum][cube.redMinimum][cube.greenMaximum][cube.blueMinimum] -
	                        moment[cube.alphaMinimum][cube.redMinimum][cube.greenMinimum][cube.blueMinimum]);
	            default:
	                // TODO: why here is return 0, and in this._top there is no default at all (now it is throw error)?
	                return 0;
	        }
	    };
	    /**
	     * Calculates statistical variance for a given cube.
	     */
	    WuQuant.prototype._calculateVariance = function (cube) {
	        var volumeRed = WuQuant._volume(cube, this._momentsRed), volumeGreen = WuQuant._volume(cube, this._momentsGreen), volumeBlue = WuQuant._volume(cube, this._momentsBlue), volumeAlpha = WuQuant._volume(cube, this._momentsAlpha), volumeMoment = WuQuant._volumeFloat(cube, this._moments), volumeWeight = WuQuant._volume(cube, this._weights), distance = volumeRed * volumeRed + volumeGreen * volumeGreen + volumeBlue * volumeBlue + volumeAlpha * volumeAlpha;
	        return volumeMoment - (distance / volumeWeight);
	    };
	    /**
	     * Finds the optimal (maximal) position for the cut.
	     */
	    WuQuant.prototype._maximize = function (cube, direction, first, last, wholeRed, wholeGreen, wholeBlue, wholeAlpha, wholeWeight) {
	        var bottomRed = WuQuant._bottom(cube, direction, this._momentsRed) | 0, bottomGreen = WuQuant._bottom(cube, direction, this._momentsGreen) | 0, bottomBlue = WuQuant._bottom(cube, direction, this._momentsBlue) | 0, bottomAlpha = WuQuant._bottom(cube, direction, this._momentsAlpha) | 0, bottomWeight = WuQuant._bottom(cube, direction, this._weights) | 0;
	        var result = 0.0, cutPosition = -1;
	        for (var position = first; position < last; ++position) {
	            // determines the cube cut at a certain position
	            var halfRed = bottomRed + WuQuant._top(cube, direction, position, this._momentsRed), halfGreen = bottomGreen + WuQuant._top(cube, direction, position, this._momentsGreen), halfBlue = bottomBlue + WuQuant._top(cube, direction, position, this._momentsBlue), halfAlpha = bottomAlpha + WuQuant._top(cube, direction, position, this._momentsAlpha), halfWeight = bottomWeight + WuQuant._top(cube, direction, position, this._weights);
	            // the cube cannot be cut at bottom (this would lead to empty cube)
	            if (halfWeight != 0) {
	                var halfDistance = halfRed * halfRed + halfGreen * halfGreen + halfBlue * halfBlue + halfAlpha * halfAlpha, temp = halfDistance / halfWeight;
	                halfRed = wholeRed - halfRed;
	                halfGreen = wholeGreen - halfGreen;
	                halfBlue = wholeBlue - halfBlue;
	                halfAlpha = wholeAlpha - halfAlpha;
	                halfWeight = wholeWeight - halfWeight;
	                if (halfWeight != 0) {
	                    halfDistance = halfRed * halfRed + halfGreen * halfGreen + halfBlue * halfBlue + halfAlpha * halfAlpha;
	                    temp += halfDistance / halfWeight;
	                    if (temp > result) {
	                        result = temp;
	                        cutPosition = position;
	                    }
	                }
	            }
	        }
	        return { max: result, position: cutPosition };
	    };
	    // Cuts a cube with another one.
	    WuQuant.prototype._cut = function (first, second) {
	        var direction;
	        var wholeRed = WuQuant._volume(first, this._momentsRed), wholeGreen = WuQuant._volume(first, this._momentsGreen), wholeBlue = WuQuant._volume(first, this._momentsBlue), wholeAlpha = WuQuant._volume(first, this._momentsAlpha), wholeWeight = WuQuant._volume(first, this._weights), red = this._maximize(first, WuQuant.red, first.redMinimum + 1, first.redMaximum, wholeRed, wholeGreen, wholeBlue, wholeAlpha, wholeWeight), green = this._maximize(first, WuQuant.green, first.greenMinimum + 1, first.greenMaximum, wholeRed, wholeGreen, wholeBlue, wholeAlpha, wholeWeight), blue = this._maximize(first, WuQuant.blue, first.blueMinimum + 1, first.blueMaximum, wholeRed, wholeGreen, wholeBlue, wholeAlpha, wholeWeight), alpha = this._maximize(first, WuQuant.alpha, first.alphaMinimum + 1, first.alphaMaximum, wholeRed, wholeGreen, wholeBlue, wholeAlpha, wholeWeight);
	        if (alpha.max >= red.max && alpha.max >= green.max && alpha.max >= blue.max) {
	            direction = WuQuant.alpha;
	            // cannot split empty cube
	            if (alpha.position < 0)
	                return false;
	        }
	        else {
	            if (red.max >= alpha.max && red.max >= green.max && red.max >= blue.max) {
	                direction = WuQuant.red;
	            }
	            else if (green.max >= alpha.max && green.max >= red.max && green.max >= blue.max) {
	                direction = WuQuant.green;
	            }
	            else {
	                direction = WuQuant.blue;
	            }
	        }
	        second.redMaximum = first.redMaximum;
	        second.greenMaximum = first.greenMaximum;
	        second.blueMaximum = first.blueMaximum;
	        second.alphaMaximum = first.alphaMaximum;
	        // cuts in a certain direction
	        switch (direction) {
	            case WuQuant.red:
	                second.redMinimum = first.redMaximum = red.position;
	                second.greenMinimum = first.greenMinimum;
	                second.blueMinimum = first.blueMinimum;
	                second.alphaMinimum = first.alphaMinimum;
	                break;
	            case WuQuant.green:
	                second.greenMinimum = first.greenMaximum = green.position;
	                second.redMinimum = first.redMinimum;
	                second.blueMinimum = first.blueMinimum;
	                second.alphaMinimum = first.alphaMinimum;
	                break;
	            case WuQuant.blue:
	                second.blueMinimum = first.blueMaximum = blue.position;
	                second.redMinimum = first.redMinimum;
	                second.greenMinimum = first.greenMinimum;
	                second.alphaMinimum = first.alphaMinimum;
	                break;
	            case WuQuant.alpha:
	                second.alphaMinimum = first.alphaMaximum = alpha.position;
	                second.blueMinimum = first.blueMinimum;
	                second.redMinimum = first.redMinimum;
	                second.greenMinimum = first.greenMinimum;
	                break;
	        }
	        // determines the volumes after cut
	        first.volume = (first.redMaximum - first.redMinimum) * (first.greenMaximum - first.greenMinimum) * (first.blueMaximum - first.blueMinimum) * (first.alphaMaximum - first.alphaMinimum);
	        second.volume = (second.redMaximum - second.redMinimum) * (second.greenMaximum - second.greenMinimum) * (second.blueMaximum - second.blueMinimum) * (second.alphaMaximum - second.alphaMinimum);
	        // the cut was successful
	        return true;
	    };
	    WuQuant.prototype._initialize = function (colors) {
	        this._colors = colors;
	        // creates all the _cubes
	        this._cubes = [];
	        // initializes all the _cubes
	        for (var cubeIndex = 0; cubeIndex < colors; cubeIndex++) {
	            this._cubes[cubeIndex] = new WuColorCube();
	        }
	        // resets the reference minimums
	        this._cubes[0].redMinimum = 0;
	        this._cubes[0].greenMinimum = 0;
	        this._cubes[0].blueMinimum = 0;
	        this._cubes[0].alphaMinimum = 0;
	        // resets the reference maximums
	        this._cubes[0].redMaximum = this._maxSideIndex;
	        this._cubes[0].greenMaximum = this._maxSideIndex;
	        this._cubes[0].blueMaximum = this._maxSideIndex;
	        this._cubes[0].alphaMaximum = this._alphaMaxSideIndex;
	        this._weights = createArray4D(this._alphaSideSize, this._sideSize, this._sideSize, this._sideSize);
	        this._momentsRed = createArray4D(this._alphaSideSize, this._sideSize, this._sideSize, this._sideSize);
	        this._momentsGreen = createArray4D(this._alphaSideSize, this._sideSize, this._sideSize, this._sideSize);
	        this._momentsBlue = createArray4D(this._alphaSideSize, this._sideSize, this._sideSize, this._sideSize);
	        this._momentsAlpha = createArray4D(this._alphaSideSize, this._sideSize, this._sideSize, this._sideSize);
	        this._moments = createArray4D(this._alphaSideSize, this._sideSize, this._sideSize, this._sideSize);
	        this._table = [];
	        for (var tableIndex = 0; tableIndex < 256; ++tableIndex) {
	            this._table[tableIndex] = tableIndex * tableIndex;
	        }
	        this._pixels = [];
	    };
	    WuQuant.prototype._setQuality = function (significantBitsPerChannel) {
	        if (significantBitsPerChannel === void 0) { significantBitsPerChannel = 5; }
	        this._significantBitsPerChannel = significantBitsPerChannel;
	        this._maxSideIndex = 1 << this._significantBitsPerChannel;
	        this._alphaMaxSideIndex = this._maxSideIndex;
	        this._sideSize = this._maxSideIndex + 1;
	        this._alphaSideSize = this._alphaMaxSideIndex + 1;
	    };
	    WuQuant.alpha = 3;
	    WuQuant.red = 2;
	    WuQuant.green = 1;
	    WuQuant.blue = 0;
	    return WuQuant;
	}());
	exports.WuQuant = WuQuant;


/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var nearestColor_1 = __webpack_require__(31);
	exports.NearestColor = nearestColor_1.NearestColor;
	var array_1 = __webpack_require__(32);
	exports.ErrorDiffusionArray = array_1.ErrorDiffusionArray;
	exports.ErrorDiffusionArrayKernel = array_1.ErrorDiffusionArrayKernel;
	var riemersma_1 = __webpack_require__(33);
	exports.ErrorDiffusionRiemersma = riemersma_1.ErrorDiffusionRiemersma;


/***/ },
/* 31 */
/***/ function(module, exports) {

	"use strict";
	var NearestColor = (function () {
	    function NearestColor(colorDistanceCalculator) {
	        this._distance = colorDistanceCalculator;
	    }
	    NearestColor.prototype.quantize = function (pointBuffer, palette) {
	        var pointArray = pointBuffer.getPointArray(), width = pointBuffer.getWidth(), height = pointBuffer.getHeight();
	        for (var y = 0; y < height; y++) {
	            for (var x = 0, idx = y * width; x < width; x++, idx++) {
	                // Image pixel
	                var point = pointArray[idx];
	                // Reduced pixel
	                point.from(palette.getNearestColor(this._distance, point));
	            }
	        }
	        return pointBuffer;
	    };
	    return NearestColor;
	}());
	exports.NearestColor = NearestColor;


/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var point_1 = __webpack_require__(24);
	var arithmetic_1 = __webpack_require__(6);
	// TODO: is it the best name for this enum "kernel"?
	(function (ErrorDiffusionArrayKernel) {
	    ErrorDiffusionArrayKernel[ErrorDiffusionArrayKernel["FloydSteinberg"] = 0] = "FloydSteinberg";
	    ErrorDiffusionArrayKernel[ErrorDiffusionArrayKernel["FalseFloydSteinberg"] = 1] = "FalseFloydSteinberg";
	    ErrorDiffusionArrayKernel[ErrorDiffusionArrayKernel["Stucki"] = 2] = "Stucki";
	    ErrorDiffusionArrayKernel[ErrorDiffusionArrayKernel["Atkinson"] = 3] = "Atkinson";
	    ErrorDiffusionArrayKernel[ErrorDiffusionArrayKernel["Jarvis"] = 4] = "Jarvis";
	    ErrorDiffusionArrayKernel[ErrorDiffusionArrayKernel["Burkes"] = 5] = "Burkes";
	    ErrorDiffusionArrayKernel[ErrorDiffusionArrayKernel["Sierra"] = 6] = "Sierra";
	    ErrorDiffusionArrayKernel[ErrorDiffusionArrayKernel["TwoSierra"] = 7] = "TwoSierra";
	    ErrorDiffusionArrayKernel[ErrorDiffusionArrayKernel["SierraLite"] = 8] = "SierraLite";
	})(exports.ErrorDiffusionArrayKernel || (exports.ErrorDiffusionArrayKernel = {}));
	var ErrorDiffusionArrayKernel = exports.ErrorDiffusionArrayKernel;
	// http://www.tannerhelland.com/4660/dithering-eleven-algorithms-source-code/
	var ErrorDiffusionArray = (function () {
	    function ErrorDiffusionArray(colorDistanceCalculator, kernel, serpentine, minimumColorDistanceToDither, calculateErrorLikeGIMP) {
	        if (serpentine === void 0) { serpentine = true; }
	        if (minimumColorDistanceToDither === void 0) { minimumColorDistanceToDither = 0; }
	        if (calculateErrorLikeGIMP === void 0) { calculateErrorLikeGIMP = false; }
	        this._setKernel(kernel);
	        this._distance = colorDistanceCalculator;
	        this._minColorDistance = minimumColorDistanceToDither;
	        this._serpentine = serpentine;
	        this._calculateErrorLikeGIMP = calculateErrorLikeGIMP;
	    }
	    // adapted from http://jsbin.com/iXofIji/2/edit by PAEz
	    // fixed version. it doesn't use image pixels as error storage, also it doesn't have 0.3 + 0.3 + 0.3 + 0.3 = 0 error
	    ErrorDiffusionArray.prototype.quantize = function (pointBuffer, palette) {
	        var pointArray = pointBuffer.getPointArray(), originalPoint = new point_1.Point(), width = pointBuffer.getWidth(), height = pointBuffer.getHeight(), errorLines = [];
	        var dir = 1, maxErrorLines = 1;
	        // initial error lines (number is taken from dithering kernel)
	        for (var i = 0; i < this._kernel.length; i++) {
	            var kernelErrorLines = this._kernel[i][2] + 1;
	            if (maxErrorLines < kernelErrorLines)
	                maxErrorLines = kernelErrorLines;
	        }
	        for (var i = 0; i < maxErrorLines; i++) {
	            this._fillErrorLine(errorLines[i] = [], width);
	        }
	        for (var y = 0; y < height; y++) {
	            // always serpentine
	            if (this._serpentine)
	                dir = dir * -1;
	            var lni = y * width, xStart = dir == 1 ? 0 : width - 1, xEnd = dir == 1 ? width : -1;
	            // cyclic shift with erasing
	            this._fillErrorLine(errorLines[0], width);
	            // TODO: why it is needed to cast types here?
	            errorLines.push(errorLines.shift());
	            var errorLine = errorLines[0];
	            for (var x = xStart, idx = lni + xStart; x !== xEnd; x += dir, idx += dir) {
	                // Image pixel
	                var point = pointArray[idx], 
	                //originalPoint = new Utils.Point(),
	                error = errorLine[x];
	                originalPoint.from(point);
	                var correctedPoint = point_1.Point.createByRGBA(arithmetic_1.inRange0to255Rounded(point.r + error[0]), arithmetic_1.inRange0to255Rounded(point.g + error[1]), arithmetic_1.inRange0to255Rounded(point.b + error[2]), arithmetic_1.inRange0to255Rounded(point.a + error[3]));
	                // Reduced pixel
	                var palettePoint = palette.getNearestColor(this._distance, correctedPoint);
	                point.from(palettePoint);
	                // dithering strength
	                if (this._minColorDistance) {
	                    var dist = this._distance.calculateNormalized(point, palettePoint);
	                    if (dist < this._minColorDistance)
	                        continue;
	                }
	                // Component distance
	                var er = void 0, eg = void 0, eb = void 0, ea = void 0;
	                if (this._calculateErrorLikeGIMP) {
	                    er = correctedPoint.r - palettePoint.r;
	                    eg = correctedPoint.g - palettePoint.g;
	                    eb = correctedPoint.b - palettePoint.b;
	                    ea = correctedPoint.a - palettePoint.a;
	                }
	                else {
	                    er = originalPoint.r - palettePoint.r;
	                    eg = originalPoint.g - palettePoint.g;
	                    eb = originalPoint.b - palettePoint.b;
	                    ea = originalPoint.a - palettePoint.a;
	                }
	                var dStart = dir == 1 ? 0 : this._kernel.length - 1, dEnd = dir == 1 ? this._kernel.length : -1;
	                for (var i = dStart; i !== dEnd; i += dir) {
	                    var x1 = this._kernel[i][1] * dir, y1 = this._kernel[i][2];
	                    if (x1 + x >= 0 && x1 + x < width && y1 + y >= 0 && y1 + y < height) {
	                        var d = this._kernel[i][0], e = errorLines[y1][x1 + x];
	                        e[0] = e[0] + er * d;
	                        e[1] = e[1] + eg * d;
	                        e[2] = e[2] + eb * d;
	                        e[3] = e[3] + ea * d;
	                    }
	                }
	            }
	        }
	        return pointBuffer;
	    };
	    ErrorDiffusionArray.prototype._fillErrorLine = function (errorLine, width) {
	        // shrink
	        if (errorLine.length > width) {
	            errorLine.length = width;
	        }
	        // reuse existing arrays
	        var l = errorLine.length;
	        for (var i = 0; i < l; i++) {
	            var error = errorLine[i];
	            error[0] = error[1] = error[2] = error[3] = 0;
	        }
	        // create missing arrays
	        for (var i = l; i < width; i++) {
	            errorLine[i] = [0.0, 0.0, 0.0, 0.0];
	        }
	    };
	    ErrorDiffusionArray.prototype._setKernel = function (kernel) {
	        switch (kernel) {
	            case ErrorDiffusionArrayKernel.FloydSteinberg:
	                this._kernel = [
	                    [7 / 16, 1, 0],
	                    [3 / 16, -1, 1],
	                    [5 / 16, 0, 1],
	                    [1 / 16, 1, 1]
	                ];
	                break;
	            case ErrorDiffusionArrayKernel.FalseFloydSteinberg:
	                this._kernel = [
	                    [3 / 8, 1, 0],
	                    [3 / 8, 0, 1],
	                    [2 / 8, 1, 1]
	                ];
	                break;
	            case ErrorDiffusionArrayKernel.Stucki:
	                this._kernel = [
	                    [8 / 42, 1, 0],
	                    [4 / 42, 2, 0],
	                    [2 / 42, -2, 1],
	                    [4 / 42, -1, 1],
	                    [8 / 42, 0, 1],
	                    [4 / 42, 1, 1],
	                    [2 / 42, 2, 1],
	                    [1 / 42, -2, 2],
	                    [2 / 42, -1, 2],
	                    [4 / 42, 0, 2],
	                    [2 / 42, 1, 2],
	                    [1 / 42, 2, 2]
	                ];
	                break;
	            case ErrorDiffusionArrayKernel.Atkinson:
	                this._kernel = [
	                    [1 / 8, 1, 0],
	                    [1 / 8, 2, 0],
	                    [1 / 8, -1, 1],
	                    [1 / 8, 0, 1],
	                    [1 / 8, 1, 1],
	                    [1 / 8, 0, 2]
	                ];
	                break;
	            case ErrorDiffusionArrayKernel.Jarvis:
	                this._kernel = [
	                    [7 / 48, 1, 0],
	                    [5 / 48, 2, 0],
	                    [3 / 48, -2, 1],
	                    [5 / 48, -1, 1],
	                    [7 / 48, 0, 1],
	                    [5 / 48, 1, 1],
	                    [3 / 48, 2, 1],
	                    [1 / 48, -2, 2],
	                    [3 / 48, -1, 2],
	                    [5 / 48, 0, 2],
	                    [3 / 48, 1, 2],
	                    [1 / 48, 2, 2]
	                ];
	                break;
	            case ErrorDiffusionArrayKernel.Burkes:
	                this._kernel = [
	                    [8 / 32, 1, 0],
	                    [4 / 32, 2, 0],
	                    [2 / 32, -2, 1],
	                    [4 / 32, -1, 1],
	                    [8 / 32, 0, 1],
	                    [4 / 32, 1, 1],
	                    [2 / 32, 2, 1],
	                ];
	                break;
	            case ErrorDiffusionArrayKernel.Sierra:
	                this._kernel = [
	                    [5 / 32, 1, 0],
	                    [3 / 32, 2, 0],
	                    [2 / 32, -2, 1],
	                    [4 / 32, -1, 1],
	                    [5 / 32, 0, 1],
	                    [4 / 32, 1, 1],
	                    [2 / 32, 2, 1],
	                    [2 / 32, -1, 2],
	                    [3 / 32, 0, 2],
	                    [2 / 32, 1, 2]
	                ];
	                break;
	            case ErrorDiffusionArrayKernel.TwoSierra:
	                this._kernel = [
	                    [4 / 16, 1, 0],
	                    [3 / 16, 2, 0],
	                    [1 / 16, -2, 1],
	                    [2 / 16, -1, 1],
	                    [3 / 16, 0, 1],
	                    [2 / 16, 1, 1],
	                    [1 / 16, 2, 1]
	                ];
	                break;
	            case ErrorDiffusionArrayKernel.SierraLite:
	                this._kernel = [
	                    [2 / 4, 1, 0],
	                    [1 / 4, -1, 1],
	                    [1 / 4, 0, 1]
	                ];
	                break;
	            default:
	                throw new Error("ErrorDiffusionArray: unknown kernel = " + kernel);
	        }
	    };
	    return ErrorDiffusionArray;
	}());
	exports.ErrorDiffusionArray = ErrorDiffusionArray;


/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var hilbertCurve_1 = __webpack_require__(34);
	var point_1 = __webpack_require__(24);
	var arithmetic_1 = __webpack_require__(6);
	var ErrorDiffusionRiemersma = (function () {
	    function ErrorDiffusionRiemersma(colorDistanceCalculator, errorQueueSize, errorPropagation) {
	        if (errorQueueSize === void 0) { errorQueueSize = 16; }
	        if (errorPropagation === void 0) { errorPropagation = 1; }
	        this._distance = colorDistanceCalculator;
	        this._errorPropagation = errorPropagation;
	        this._errorQueueSize = errorQueueSize;
	        this._max = this._errorQueueSize;
	        this._createWeights();
	    }
	    ErrorDiffusionRiemersma.prototype.quantize = function (pointBuffer, palette) {
	        var _this = this;
	        var curve = new hilbertCurve_1.HilbertCurveBase(), pointArray = pointBuffer.getPointArray(), width = pointBuffer.getWidth(), height = pointBuffer.getHeight(), errorQueue = [];
	        var head = 0;
	        for (var i = 0; i < this._errorQueueSize; i++) {
	            errorQueue[i] = { r: 0, g: 0, b: 0, a: 0 };
	        }
	        curve.walk(width, height, function (x, y) {
	            var p = pointArray[x + y * width];
	            var r = p.r, g = p.g, b = p.b, a = p.a;
	            for (var i = 0; i < _this._errorQueueSize; i++) {
	                var weight = _this._weights[i], e = errorQueue[(i + head) % _this._errorQueueSize];
	                r += e.r * weight;
	                g += e.g * weight;
	                b += e.b * weight;
	                a += e.a * weight;
	            }
	            var correctedPoint = point_1.Point.createByRGBA(arithmetic_1.inRange0to255Rounded(r), arithmetic_1.inRange0to255Rounded(g), arithmetic_1.inRange0to255Rounded(b), arithmetic_1.inRange0to255Rounded(a));
	            var quantizedPoint = palette.getNearestColor(_this._distance, correctedPoint);
	            // update head and calculate tail
	            head = (head + 1) % _this._errorQueueSize;
	            var tail = (head + _this._errorQueueSize - 1) % _this._errorQueueSize;
	            // update error with new value
	            errorQueue[tail].r = p.r - quantizedPoint.r;
	            errorQueue[tail].g = p.g - quantizedPoint.g;
	            errorQueue[tail].b = p.b - quantizedPoint.b;
	            errorQueue[tail].a = p.a - quantizedPoint.a;
	            // update point
	            p.from(quantizedPoint);
	        });
	        return pointBuffer;
	    };
	    ErrorDiffusionRiemersma.prototype._createWeights = function () {
	        this._weights = [];
	        var multiplier = Math.exp(Math.log(this._max) / (this._errorQueueSize - 1));
	        for (var i = 0, next = 1; i < this._errorQueueSize; i++) {
	            this._weights[i] = (((next + 0.5) | 0) / this._max) * this._errorPropagation;
	            next *= multiplier;
	        }
	    };
	    return ErrorDiffusionRiemersma;
	}());
	exports.ErrorDiffusionRiemersma = ErrorDiffusionRiemersma;


/***/ },
/* 34 */
/***/ function(module, exports) {

	"use strict";
	var Direction;
	(function (Direction) {
	    Direction[Direction["NONE"] = 0] = "NONE";
	    Direction[Direction["UP"] = 1] = "UP";
	    Direction[Direction["LEFT"] = 2] = "LEFT";
	    Direction[Direction["RIGHT"] = 3] = "RIGHT";
	    Direction[Direction["DOWN"] = 4] = "DOWN";
	})(Direction || (Direction = {}));
	// Check code against double-entrance into walk (walk=> callback => walk)
	var HilbertCurveBase = (function () {
	    function HilbertCurveBase() {
	    }
	    HilbertCurveBase.prototype.walk = function (width, height, visitorCallback) {
	        this._x = 0;
	        this._y = 0;
	        this._d = 0;
	        this._width = width;
	        this._height = height;
	        this._callback = visitorCallback;
	        var maxBound = Math.max(width, height);
	        this._level = (Math.log(maxBound) / Math.log(2) + 1) | 0;
	        this._walkHilbert(Direction.UP);
	        this._visit(Direction.NONE);
	    };
	    HilbertCurveBase.prototype._walkHilbert = function (direction) {
	        if (this._level < 1)
	            return;
	        this._level--;
	        switch (direction) {
	            case Direction.LEFT:
	                this._walkHilbert(Direction.UP);
	                this._visit(Direction.RIGHT);
	                this._walkHilbert(Direction.LEFT);
	                this._visit(Direction.DOWN);
	                this._walkHilbert(Direction.LEFT);
	                this._visit(Direction.LEFT);
	                this._walkHilbert(Direction.DOWN);
	                break;
	            case Direction.RIGHT:
	                this._walkHilbert(Direction.DOWN);
	                this._visit(Direction.LEFT);
	                this._walkHilbert(Direction.RIGHT);
	                this._visit(Direction.UP);
	                this._walkHilbert(Direction.RIGHT);
	                this._visit(Direction.RIGHT);
	                this._walkHilbert(Direction.UP);
	                break;
	            case Direction.UP:
	                this._walkHilbert(Direction.LEFT);
	                this._visit(Direction.DOWN);
	                this._walkHilbert(Direction.UP);
	                this._visit(Direction.RIGHT);
	                this._walkHilbert(Direction.UP);
	                this._visit(Direction.UP);
	                this._walkHilbert(Direction.RIGHT);
	                break;
	            case Direction.DOWN:
	                this._walkHilbert(Direction.RIGHT);
	                this._visit(Direction.UP);
	                this._walkHilbert(Direction.DOWN);
	                this._visit(Direction.LEFT);
	                this._walkHilbert(Direction.DOWN);
	                this._visit(Direction.DOWN);
	                this._walkHilbert(Direction.LEFT);
	                break;
	            default:
	                break;
	        }
	        this._level++;
	    };
	    HilbertCurveBase.prototype._visit = function (direction) {
	        if (this._x >= 0 && this._x < this._width && this._y >= 0 && this._y < this._height) {
	            this._callback(this._x, this._y, this._d);
	            this._d++;
	        }
	        switch (direction) {
	            case Direction.LEFT:
	                this._x--;
	                break;
	            case Direction.RIGHT:
	                this._x++;
	                break;
	            case Direction.UP:
	                this._y--;
	                break;
	            case Direction.DOWN:
	                this._y++;
	                break;
	        }
	    };
	    return HilbertCurveBase;
	}());
	exports.HilbertCurveBase = HilbertCurveBase;


/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * iq.ts - Image Quantization Library
	 */
	var ssim_1 = __webpack_require__(36);
	exports.SSIM = ssim_1.SSIM;


/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var bt709_1 = __webpack_require__(2);
	// based on https://github.com/rhys-e/structural-similarity
	// http://en.wikipedia.org/wiki/Structural_similarity
	var K1 = 0.01, K2 = 0.03;
	var SSIM = (function () {
	    function SSIM() {
	    }
	    SSIM.prototype.compare = function (image1, image2) {
	        if (image1.getHeight() !== image2.getHeight() || image1.getWidth() !== image2.getWidth()) {
	            throw new Error("Images have different sizes!");
	        }
	        var bitsPerComponent = 8, L = (1 << bitsPerComponent) - 1, c1 = Math.pow((K1 * L), 2), c2 = Math.pow((K2 * L), 2);
	        var numWindows = 0, mssim = 0.0;
	        //calculate ssim for each window
	        this._iterate(image1, image2, function (lumaValues1, lumaValues2, averageLumaValue1, averageLumaValue2) {
	            //calculate variance and covariance
	            var sigxy = 0.0, sigsqx = 0.0, sigsqy = 0.0;
	            for (var i = 0; i < lumaValues1.length; i++) {
	                sigsqx += Math.pow((lumaValues1[i] - averageLumaValue1), 2);
	                sigsqy += Math.pow((lumaValues2[i] - averageLumaValue2), 2);
	                sigxy += (lumaValues1[i] - averageLumaValue1) * (lumaValues2[i] - averageLumaValue2);
	            }
	            var numPixelsInWin = lumaValues1.length - 1;
	            sigsqx /= numPixelsInWin;
	            sigsqy /= numPixelsInWin;
	            sigxy /= numPixelsInWin;
	            //perform ssim calculation on window
	            var numerator = (2 * averageLumaValue1 * averageLumaValue2 + c1) * (2 * sigxy + c2), denominator = (Math.pow(averageLumaValue1, 2) + Math.pow(averageLumaValue2, 2) + c1) * (sigsqx + sigsqy + c2), ssim = numerator / denominator;
	            mssim += ssim;
	            numWindows++;
	        });
	        return mssim / numWindows;
	    };
	    SSIM.prototype._iterate = function (image1, image2, callback) {
	        var windowSize = 8, width = image1.getWidth(), height = image1.getHeight();
	        for (var y = 0; y < height; y += windowSize) {
	            for (var x = 0; x < width; x += windowSize) {
	                // avoid out-of-width/height
	                var windowWidth = Math.min(windowSize, width - x), windowHeight = Math.min(windowSize, height - y);
	                var lumaValues1 = this._calculateLumaValuesForWindow(image1, x, y, windowWidth, windowHeight), lumaValues2 = this._calculateLumaValuesForWindow(image2, x, y, windowWidth, windowHeight), averageLuma1 = this._calculateAverageLuma(lumaValues1), averageLuma2 = this._calculateAverageLuma(lumaValues2);
	                callback(lumaValues1, lumaValues2, averageLuma1, averageLuma2);
	            }
	        }
	    };
	    SSIM.prototype._calculateLumaValuesForWindow = function (image, x, y, width, height) {
	        var pointArray = image.getPointArray(), lumaValues = [];
	        var counter = 0;
	        for (var j = y; j < y + height; j++) {
	            var offset = j * image.getWidth();
	            for (var i = x; i < x + width; i++) {
	                var point = pointArray[offset + i];
	                lumaValues[counter] = point.r * bt709_1.Y.RED + point.g * bt709_1.Y.GREEN + point.b * bt709_1.Y.BLUE;
	                counter++;
	            }
	        }
	        return lumaValues;
	    };
	    SSIM.prototype._calculateAverageLuma = function (lumaValues) {
	        var sumLuma = 0.0;
	        for (var i = 0; i < lumaValues.length; i++) {
	            sumLuma += lumaValues[i];
	        }
	        return sumLuma / lumaValues.length;
	    };
	    return SSIM;
	}());
	exports.SSIM = SSIM;


/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/**
	 * @preserve
	 * Copyright 2015-2016 Igor Bezkrovnyi
	 * All rights reserved. (MIT Licensed)
	 *
	 * iq.ts - Image Quantization Library
	 */
	var arithmetic = __webpack_require__(6);
	exports.arithmetic = arithmetic;
	var hueStatistics_1 = __webpack_require__(28);
	exports.HueStatistics = hueStatistics_1.HueStatistics;
	var palette_1 = __webpack_require__(22);
	exports.Palette = palette_1.Palette;
	var point_1 = __webpack_require__(24);
	exports.Point = point_1.Point;
	var pointContainer_1 = __webpack_require__(23);
	exports.PointContainer = pointContainer_1.PointContainer;


/***/ }
/******/ ])
});
;

},{}],46:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }
}

},{}],47:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],48:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],49:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],50:[function(require,module,exports){
// (c) Dean McNamee <dean@gmail.com>, 2013.
//
// https://github.com/deanm/omggif
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.
//
// omggif is a JavaScript implementation of a GIF 89a encoder and decoder,
// including animation and compression.  It does not rely on any specific
// underlying system, so should run in the browser, Node, or Plask.

function GifWriter(buf, width, height, gopts) {
  var p = 0;

  var gopts = gopts === undefined ? { } : gopts;
  var loop_count = gopts.loop === undefined ? null : gopts.loop;
  var global_palette = gopts.palette === undefined ? null : gopts.palette;

  if (width <= 0 || height <= 0 || width > 65535 || height > 65535)
    throw "Width/Height invalid."

  function check_palette_and_num_colors(palette) {
    var num_colors = palette.length;
    if (num_colors < 2 || num_colors > 256 ||  num_colors & (num_colors-1))
      throw "Invalid code/color length, must be power of 2 and 2 .. 256.";
    return num_colors;
  }

  // - Header.
  buf[p++] = 0x47; buf[p++] = 0x49; buf[p++] = 0x46;  // GIF
  buf[p++] = 0x38; buf[p++] = 0x39; buf[p++] = 0x61;  // 89a

  // Handling of Global Color Table (palette) and background index.
  var gp_num_colors_pow2 = 0;
  var background = 0;
  if (global_palette !== null) {
    var gp_num_colors = check_palette_and_num_colors(global_palette);
    while (gp_num_colors >>= 1) ++gp_num_colors_pow2;
    gp_num_colors = 1 << gp_num_colors_pow2;
    --gp_num_colors_pow2;
    if (gopts.background !== undefined) {
      background = gopts.background;
      if (background >= gp_num_colors) throw "Background index out of range.";
      // The GIF spec states that a background index of 0 should be ignored, so
      // this is probably a mistake and you really want to set it to another
      // slot in the palette.  But actually in the end most browsers, etc end
      // up ignoring this almost completely (including for dispose background).
      if (background === 0)
        throw "Background index explicitly passed as 0.";
    }
  }

  // - Logical Screen Descriptor.
  // NOTE(deanm): w/h apparently ignored by implementations, but set anyway.
  buf[p++] = width & 0xff; buf[p++] = width >> 8 & 0xff;
  buf[p++] = height & 0xff; buf[p++] = height >> 8 & 0xff;
  // NOTE: Indicates 0-bpp original color resolution (unused?).
  buf[p++] = (global_palette !== null ? 0x80 : 0) |  // Global Color Table Flag.
             gp_num_colors_pow2;  // NOTE: No sort flag (unused?).
  buf[p++] = background;  // Background Color Index.
  buf[p++] = 0;  // Pixel aspect ratio (unused?).

  // - Global Color Table
  if (global_palette !== null) {
    for (var i = 0, il = global_palette.length; i < il; ++i) {
      var rgb = global_palette[i];
      buf[p++] = rgb >> 16 & 0xff;
      buf[p++] = rgb >> 8 & 0xff;
      buf[p++] = rgb & 0xff;
    }
  }

  if (loop_count !== null) {  // Netscape block for looping.
    if (loop_count < 0 || loop_count > 65535)
      throw "Loop count invalid."
    // Extension code, label, and length.
    buf[p++] = 0x21; buf[p++] = 0xff; buf[p++] = 0x0b;
    // NETSCAPE2.0
    buf[p++] = 0x4e; buf[p++] = 0x45; buf[p++] = 0x54; buf[p++] = 0x53;
    buf[p++] = 0x43; buf[p++] = 0x41; buf[p++] = 0x50; buf[p++] = 0x45;
    buf[p++] = 0x32; buf[p++] = 0x2e; buf[p++] = 0x30;
    // Sub-block
    buf[p++] = 0x03; buf[p++] = 0x01;
    buf[p++] = loop_count & 0xff; buf[p++] = loop_count >> 8 & 0xff;
    buf[p++] = 0x00;  // Terminator.
  }


  var ended = false;

  this.addFrame = function(x, y, w, h, indexed_pixels, opts) {
    if (ended === true) { --p; ended = false; }  // Un-end.

    opts = opts === undefined ? { } : opts;

    // TODO(deanm): Bounds check x, y.  Do they need to be within the virtual
    // canvas width/height, I imagine?
    if (x < 0 || y < 0 || x > 65535 || y > 65535)
      throw "x/y invalid."

    if (w <= 0 || h <= 0 || w > 65535 || h > 65535)
      throw "Width/Height invalid."

    if (indexed_pixels.length < w * h)
      throw "Not enough pixels for the frame size.";

    var using_local_palette = true;
    var palette = opts.palette;
    if (palette === undefined || palette === null) {
      using_local_palette = false;
      palette = global_palette;
    }

    if (palette === undefined || palette === null)
      throw "Must supply either a local or global palette.";

    var num_colors = check_palette_and_num_colors(palette);

    // Compute the min_code_size (power of 2), destroying num_colors.
    var min_code_size = 0;
    while (num_colors >>= 1) ++min_code_size;
    num_colors = 1 << min_code_size;  // Now we can easily get it back.

    var delay = opts.delay === undefined ? 0 : opts.delay;

    // From the spec:
    //     0 -   No disposal specified. The decoder is
    //           not required to take any action.
    //     1 -   Do not dispose. The graphic is to be left
    //           in place.
    //     2 -   Restore to background color. The area used by the
    //           graphic must be restored to the background color.
    //     3 -   Restore to previous. The decoder is required to
    //           restore the area overwritten by the graphic with
    //           what was there prior to rendering the graphic.
    //  4-7 -    To be defined.
    // NOTE(deanm): Dispose background doesn't really work, apparently most
    // browsers ignore the background palette index and clear to transparency.
    var disposal = opts.disposal === undefined ? 0 : opts.disposal;
    if (disposal < 0 || disposal > 3)  // 4-7 is reserved.
      throw "Disposal out of range.";

    var use_transparency = false;
    var transparent_index = 0;
    if (opts.transparent !== undefined && opts.transparent !== null) {
      use_transparency = true;
      transparent_index = opts.transparent;
      if (transparent_index < 0 || transparent_index >= num_colors)
        throw "Transparent color index.";
    }

    if (disposal !== 0 || use_transparency || delay !== 0) {
      // - Graphics Control Extension
      buf[p++] = 0x21; buf[p++] = 0xf9;  // Extension / Label.
      buf[p++] = 4;  // Byte size.

      buf[p++] = disposal << 2 | (use_transparency === true ? 1 : 0);
      buf[p++] = delay & 0xff; buf[p++] = delay >> 8 & 0xff;
      buf[p++] = transparent_index;  // Transparent color index.
      buf[p++] = 0;  // Block Terminator.
    }

    // - Image Descriptor
    buf[p++] = 0x2c;  // Image Seperator.
    buf[p++] = x & 0xff; buf[p++] = x >> 8 & 0xff;  // Left.
    buf[p++] = y & 0xff; buf[p++] = y >> 8 & 0xff;  // Top.
    buf[p++] = w & 0xff; buf[p++] = w >> 8 & 0xff;
    buf[p++] = h & 0xff; buf[p++] = h >> 8 & 0xff;
    // NOTE: No sort flag (unused?).
    // TODO(deanm): Support interlace.
    buf[p++] = using_local_palette === true ? (0x80 | (min_code_size-1)) : 0;

    // - Local Color Table
    if (using_local_palette === true) {
      for (var i = 0, il = palette.length; i < il; ++i) {
        var rgb = palette[i];
        buf[p++] = rgb >> 16 & 0xff;
        buf[p++] = rgb >> 8 & 0xff;
        buf[p++] = rgb & 0xff;
      }
    }

    p = GifWriterOutputLZWCodeStream(
            buf, p, min_code_size < 2 ? 2 : min_code_size, indexed_pixels);
  };

  this.end = function() {
    if (ended === false) {
      buf[p++] = 0x3b;  // Trailer.
      ended = true;
    }
    return p;
  };
}

// Main compression routine, palette indexes -> LZW code stream.
// |index_stream| must have at least one entry.
function GifWriterOutputLZWCodeStream(buf, p, min_code_size, index_stream) {
  buf[p++] = min_code_size;
  var cur_subblock = p++;  // Pointing at the length field.

  var clear_code = 1 << min_code_size;
  var code_mask = clear_code - 1;
  var eoi_code = clear_code + 1;
  var next_code = eoi_code + 1;

  var cur_code_size = min_code_size + 1;  // Number of bits per code.
  var cur_shift = 0;
  // We have at most 12-bit codes, so we should have to hold a max of 19
  // bits here (and then we would write out).
  var cur = 0;

  function emit_bytes_to_buffer(bit_block_size) {
    while (cur_shift >= bit_block_size) {
      buf[p++] = cur & 0xff;
      cur >>= 8; cur_shift -= 8;
      if (p === cur_subblock + 256) {  // Finished a subblock.
        buf[cur_subblock] = 255;
        cur_subblock = p++;
      }
    }
  }

  function emit_code(c) {
    cur |= c << cur_shift;
    cur_shift += cur_code_size;
    emit_bytes_to_buffer(8);
  }

  // I am not an expert on the topic, and I don't want to write a thesis.
  // However, it is good to outline here the basic algorithm and the few data
  // structures and optimizations here that make this implementation fast.
  // The basic idea behind LZW is to build a table of previously seen runs
  // addressed by a short id (herein called output code).  All data is
  // referenced by a code, which represents one or more values from the
  // original input stream.  All input bytes can be referenced as the same
  // value as an output code.  So if you didn't want any compression, you
  // could more or less just output the original bytes as codes (there are
  // some details to this, but it is the idea).  In order to achieve
  // compression, values greater then the input range (codes can be up to
  // 12-bit while input only 8-bit) represent a sequence of previously seen
  // inputs.  The decompressor is able to build the same mapping while
  // decoding, so there is always a shared common knowledge between the
  // encoding and decoder, which is also important for "timing" aspects like
  // how to handle variable bit width code encoding.
  //
  // One obvious but very important consequence of the table system is there
  // is always a unique id (at most 12-bits) to map the runs.  'A' might be
  // 4, then 'AA' might be 10, 'AAA' 11, 'AAAA' 12, etc.  This relationship
  // can be used for an effecient lookup strategy for the code mapping.  We
  // need to know if a run has been seen before, and be able to map that run
  // to the output code.  Since we start with known unique ids (input bytes),
  // and then from those build more unique ids (table entries), we can
  // continue this chain (almost like a linked list) to always have small
  // integer values that represent the current byte chains in the encoder.
  // This means instead of tracking the input bytes (AAAABCD) to know our
  // current state, we can track the table entry for AAAABC (it is guaranteed
  // to exist by the nature of the algorithm) and the next character D.
  // Therefor the tuple of (table_entry, byte) is guaranteed to also be
  // unique.  This allows us to create a simple lookup key for mapping input
  // sequences to codes (table indices) without having to store or search
  // any of the code sequences.  So if 'AAAA' has a table entry of 12, the
  // tuple of ('AAAA', K) for any input byte K will be unique, and can be our
  // key.  This leads to a integer value at most 20-bits, which can always
  // fit in an SMI value and be used as a fast sparse array / object key.

  // Output code for the current contents of the index buffer.
  var ib_code = index_stream[0] & code_mask;  // Load first input index.
  var code_table = { };  // Key'd on our 20-bit "tuple".

  emit_code(clear_code);  // Spec says first code should be a clear code.

  // First index already loaded, process the rest of the stream.
  for (var i = 1, il = index_stream.length; i < il; ++i) {
    var k = index_stream[i] & code_mask;
    var cur_key = ib_code << 8 | k;  // (prev, k) unique tuple.
    var cur_code = code_table[cur_key];  // buffer + k.

    // Check if we have to create a new code table entry.
    if (cur_code === undefined) {  // We don't have buffer + k.
      // Emit index buffer (without k).
      // This is an inline version of emit_code, because this is the core
      // writing routine of the compressor (and V8 cannot inline emit_code
      // because it is a closure here in a different context).  Additionally
      // we can call emit_byte_to_buffer less often, because we can have
      // 30-bits (from our 31-bit signed SMI), and we know our codes will only
      // be 12-bits, so can safely have 18-bits there without overflow.
      // emit_code(ib_code);
      cur |= ib_code << cur_shift;
      cur_shift += cur_code_size;
      while (cur_shift >= 8) {
        buf[p++] = cur & 0xff;
        cur >>= 8; cur_shift -= 8;
        if (p === cur_subblock + 256) {  // Finished a subblock.
          buf[cur_subblock] = 255;
          cur_subblock = p++;
        }
      }

      if (next_code === 4096) {  // Table full, need a clear.
        emit_code(clear_code);
        next_code = eoi_code + 1;
        cur_code_size = min_code_size + 1;
        code_table = { };
      } else {  // Table not full, insert a new entry.
        // Increase our variable bit code sizes if necessary.  This is a bit
        // tricky as it is based on "timing" between the encoding and
        // decoder.  From the encoders perspective this should happen after
        // we've already emitted the index buffer and are about to create the
        // first table entry that would overflow our current code bit size.
        if (next_code >= (1 << cur_code_size)) ++cur_code_size;
        code_table[cur_key] = next_code++;  // Insert into code table.
      }

      ib_code = k;  // Index buffer to single input k.
    } else {
      ib_code = cur_code;  // Index buffer to sequence in code table.
    }
  }

  emit_code(ib_code);  // There will still be something in the index buffer.
  emit_code(eoi_code);  // End Of Information.

  // Flush / finalize the sub-blocks stream to the buffer.
  emit_bytes_to_buffer(1);

  // Finish the sub-blocks, writing out any unfinished lengths and
  // terminating with a sub-block of length 0.  If we have already started
  // but not yet used a sub-block it can just become the terminator.
  if (cur_subblock + 1 === p) {  // Started but unused.
    buf[cur_subblock] = 0;
  } else {  // Started and used, write length and additional terminator block.
    buf[cur_subblock] = p - cur_subblock - 1;
    buf[p++] = 0;
  }
  return p;
}

function GifReader(buf) {
  var p = 0;

  // - Header (GIF87a or GIF89a).
  if (buf[p++] !== 0x47 ||            buf[p++] !== 0x49 || buf[p++] !== 0x46 ||
      buf[p++] !== 0x38 || (buf[p++]+1 & 0xfd) !== 0x38 || buf[p++] !== 0x61) {
    throw "Invalid GIF 87a/89a header.";
  }

  // - Logical Screen Descriptor.
  var width = buf[p++] | buf[p++] << 8;
  var height = buf[p++] | buf[p++] << 8;
  var pf0 = buf[p++];  // <Packed Fields>.
  var global_palette_flag = pf0 >> 7;
  var num_global_colors_pow2 = pf0 & 0x7;
  var num_global_colors = 1 << (num_global_colors_pow2 + 1);
  var background = buf[p++];
  buf[p++];  // Pixel aspect ratio (unused?).

  var global_palette_offset = null;

  if (global_palette_flag) {
    global_palette_offset = p;
    p += num_global_colors * 3;  // Seek past palette.
  }

  var no_eof = true;

  var frames = [ ];

  var delay = 0;
  var transparent_index = null;
  var disposal = 0;  // 0 - No disposal specified.
  var loop_count = null;

  this.width = width;
  this.height = height;

  while (no_eof && p < buf.length) {
    switch (buf[p++]) {
      case 0x21:  // Graphics Control Extension Block
        switch (buf[p++]) {
          case 0xff:  // Application specific block
            // Try if it's a Netscape block (with animation loop counter).
            if (buf[p   ] !== 0x0b ||  // 21 FF already read, check block size.
                // NETSCAPE2.0
                buf[p+1 ] == 0x4e && buf[p+2 ] == 0x45 && buf[p+3 ] == 0x54 &&
                buf[p+4 ] == 0x53 && buf[p+5 ] == 0x43 && buf[p+6 ] == 0x41 &&
                buf[p+7 ] == 0x50 && buf[p+8 ] == 0x45 && buf[p+9 ] == 0x32 &&
                buf[p+10] == 0x2e && buf[p+11] == 0x30 &&
                // Sub-block
                buf[p+12] == 0x03 && buf[p+13] == 0x01 && buf[p+16] == 0) {
              p += 14;
              loop_count = buf[p++] | buf[p++] << 8;
              p++;  // Skip terminator.
            } else {  // We don't know what it is, just try to get past it.
              p += 12;
              while (true) {  // Seek through subblocks.
                var block_size = buf[p++];
                if (block_size === 0) break;
                p += block_size;
              }
            }
            break;

          case 0xf9:  // Graphics Control Extension
            if (buf[p++] !== 0x4 || buf[p+4] !== 0)
              throw "Invalid graphics extension block.";
            var pf1 = buf[p++];
            delay = buf[p++] | buf[p++] << 8;
            transparent_index = buf[p++];
            if ((pf1 & 1) === 0) transparent_index = null;
            disposal = pf1 >> 2 & 0x7;
            p++;  // Skip terminator.
            break;

          case 0xfe:  // Comment Extension.
            while (true) {  // Seek through subblocks.
              var block_size = buf[p++];
              if (block_size === 0) break;
              // console.log(buf.slice(p, p+block_size).toString('ascii'));
              p += block_size;
            }
            break;

          default:
            throw "Unknown graphic control label: 0x" + buf[p-1].toString(16);
        }
        break;

      case 0x2c:  // Image Descriptor.
        var x = buf[p++] | buf[p++] << 8;
        var y = buf[p++] | buf[p++] << 8;
        var w = buf[p++] | buf[p++] << 8;
        var h = buf[p++] | buf[p++] << 8;
        var pf2 = buf[p++];
        var local_palette_flag = pf2 >> 7;
        var interlace_flag = pf2 >> 6 & 1;
        var num_local_colors_pow2 = pf2 & 0x7;
        var num_local_colors = 1 << (num_local_colors_pow2 + 1);
        var palette_offset = global_palette_offset;
        var has_local_palette = false;
        if (local_palette_flag) {
          var has_local_palette = true;
          palette_offset = p;  // Override with local palette.
          p += num_local_colors * 3;  // Seek past palette.
        }

        var data_offset = p;

        p++;  // codesize
        while (true) {
          var block_size = buf[p++];
          if (block_size === 0) break;
          p += block_size;
        }

        frames.push({x: x, y: y, width: w, height: h,
                     has_local_palette: has_local_palette,
                     palette_offset: palette_offset,
                     data_offset: data_offset,
                     data_length: p - data_offset,
                     transparent_index: transparent_index,
                     interlaced: !!interlace_flag,
                     delay: delay,
                     disposal: disposal});
        break;

      case 0x3b:  // Trailer Marker (end of file).
        no_eof = false;
        break;

      default:
        throw "Unknown gif block: 0x" + buf[p-1].toString(16);
        break;
    }
  }

  this.numFrames = function() {
    return frames.length;
  };

  this.loopCount = function() {
    return loop_count;
  };

  this.frameInfo = function(frame_num) {
    if (frame_num < 0 || frame_num >= frames.length)
      throw "Frame index out of range.";
    return frames[frame_num];
  }

  this.decodeAndBlitFrameBGRA = function(frame_num, pixels) {
    var frame = this.frameInfo(frame_num);
    var num_pixels = frame.width * frame.height;
    var index_stream = new Uint8Array(num_pixels);  // At most 8-bit indices.
    GifReaderLZWOutputIndexStream(
        buf, frame.data_offset, index_stream, num_pixels);
    var palette_offset = frame.palette_offset;

    // NOTE(deanm): It seems to be much faster to compare index to 256 than
    // to === null.  Not sure why, but CompareStub_EQ_STRICT shows up high in
    // the profile, not sure if it's related to using a Uint8Array.
    var trans = frame.transparent_index;
    if (trans === null) trans = 256;

    // We are possibly just blitting to a portion of the entire frame.
    // That is a subrect within the framerect, so the additional pixels
    // must be skipped over after we finished a scanline.
    var framewidth  = frame.width;
    var framestride = width - framewidth;
    var xleft       = framewidth;  // Number of subrect pixels left in scanline.

    // Output indicies of the top left and bottom right corners of the subrect.
    var opbeg = ((frame.y * width) + frame.x) * 4;
    var opend = ((frame.y + frame.height) * width + frame.x) * 4;
    var op    = opbeg;

    var scanstride = framestride * 4;

    // Use scanstride to skip past the rows when interlacing.  This is skipping
    // 7 rows for the first two passes, then 3 then 1.
    if (frame.interlaced === true) {
      scanstride += width * 4 * 7;  // Pass 1.
    }

    var interlaceskip = 8;  // Tracking the row interval in the current pass.

    for (var i = 0, il = index_stream.length; i < il; ++i) {
      var index = index_stream[i];

      if (xleft === 0) {  // Beginning of new scan line
        op += scanstride;
        xleft = framewidth;
        if (op >= opend) { // Catch the wrap to switch passes when interlacing.
          scanstride = framestride * 4 + width * 4 * (interlaceskip-1);
          // interlaceskip / 2 * 4 is interlaceskip << 1.
          op = opbeg + (framewidth + framestride) * (interlaceskip << 1);
          interlaceskip >>= 1;
        }
      }

      if (index === trans) {
        op += 4;
      } else {
        var r = buf[palette_offset + index * 3];
        var g = buf[palette_offset + index * 3 + 1];
        var b = buf[palette_offset + index * 3 + 2];
        pixels[op++] = b;
        pixels[op++] = g;
        pixels[op++] = r;
        pixels[op++] = 255;
      }
      --xleft;
    }
  };

  // I will go to copy and paste hell one day...
  this.decodeAndBlitFrameRGBA = function(frame_num, pixels) {
    var frame = this.frameInfo(frame_num);
    var num_pixels = frame.width * frame.height;
    var index_stream = new Uint8Array(num_pixels);  // At most 8-bit indices.
    GifReaderLZWOutputIndexStream(
        buf, frame.data_offset, index_stream, num_pixels);
    var palette_offset = frame.palette_offset;

    // NOTE(deanm): It seems to be much faster to compare index to 256 than
    // to === null.  Not sure why, but CompareStub_EQ_STRICT shows up high in
    // the profile, not sure if it's related to using a Uint8Array.
    var trans = frame.transparent_index;
    if (trans === null) trans = 256;

    // We are possibly just blitting to a portion of the entire frame.
    // That is a subrect within the framerect, so the additional pixels
    // must be skipped over after we finished a scanline.
    var framewidth  = frame.width;
    var framestride = width - framewidth;
    var xleft       = framewidth;  // Number of subrect pixels left in scanline.

    // Output indicies of the top left and bottom right corners of the subrect.
    var opbeg = ((frame.y * width) + frame.x) * 4;
    var opend = ((frame.y + frame.height) * width + frame.x) * 4;
    var op    = opbeg;

    var scanstride = framestride * 4;

    // Use scanstride to skip past the rows when interlacing.  This is skipping
    // 7 rows for the first two passes, then 3 then 1.
    if (frame.interlaced === true) {
      scanstride += width * 4 * 7;  // Pass 1.
    }

    var interlaceskip = 8;  // Tracking the row interval in the current pass.

    for (var i = 0, il = index_stream.length; i < il; ++i) {
      var index = index_stream[i];

      if (xleft === 0) {  // Beginning of new scan line
        op += scanstride;
        xleft = framewidth;
        if (op >= opend) { // Catch the wrap to switch passes when interlacing.
          scanstride = framestride * 4 + width * 4 * (interlaceskip-1);
          // interlaceskip / 2 * 4 is interlaceskip << 1.
          op = opbeg + (framewidth + framestride) * (interlaceskip << 1);
          interlaceskip >>= 1;
        }
      }

      if (index === trans) {
        op += 4;
      } else {
        var r = buf[palette_offset + index * 3];
        var g = buf[palette_offset + index * 3 + 1];
        var b = buf[palette_offset + index * 3 + 2];
        pixels[op++] = r;
        pixels[op++] = g;
        pixels[op++] = b;
        pixels[op++] = 255;
      }
      --xleft;
    }
  };
}

function GifReaderLZWOutputIndexStream(code_stream, p, output, output_length) {
  var min_code_size = code_stream[p++];

  var clear_code = 1 << min_code_size;
  var eoi_code = clear_code + 1;
  var next_code = eoi_code + 1;

  var cur_code_size = min_code_size + 1;  // Number of bits per code.
  // NOTE: This shares the same name as the encoder, but has a different
  // meaning here.  Here this masks each code coming from the code stream.
  var code_mask = (1 << cur_code_size) - 1;
  var cur_shift = 0;
  var cur = 0;

  var op = 0;  // Output pointer.
  
  var subblock_size = code_stream[p++];

  // TODO(deanm): Would using a TypedArray be any faster?  At least it would
  // solve the fast mode / backing store uncertainty.
  // var code_table = Array(4096);
  var code_table = new Int32Array(4096);  // Can be signed, we only use 20 bits.

  var prev_code = null;  // Track code-1.

  while (true) {
    // Read up to two bytes, making sure we always 12-bits for max sized code.
    while (cur_shift < 16) {
      if (subblock_size === 0) break;  // No more data to be read.

      cur |= code_stream[p++] << cur_shift;
      cur_shift += 8;

      if (subblock_size === 1) {  // Never let it get to 0 to hold logic above.
        subblock_size = code_stream[p++];  // Next subblock.
      } else {
        --subblock_size;
      }
    }

    // TODO(deanm): We should never really get here, we should have received
    // and EOI.
    if (cur_shift < cur_code_size)
      break;

    var code = cur & code_mask;
    cur >>= cur_code_size;
    cur_shift -= cur_code_size;

    // TODO(deanm): Maybe should check that the first code was a clear code,
    // at least this is what you're supposed to do.  But actually our encoder
    // now doesn't emit a clear code first anyway.
    if (code === clear_code) {
      // We don't actually have to clear the table.  This could be a good idea
      // for greater error checking, but we don't really do any anyway.  We
      // will just track it with next_code and overwrite old entries.

      next_code = eoi_code + 1;
      cur_code_size = min_code_size + 1;
      code_mask = (1 << cur_code_size) - 1;

      // Don't update prev_code ?
      prev_code = null;
      continue;
    } else if (code === eoi_code) {
      break;
    }

    // We have a similar situation as the decoder, where we want to store
    // variable length entries (code table entries), but we want to do in a
    // faster manner than an array of arrays.  The code below stores sort of a
    // linked list within the code table, and then "chases" through it to
    // construct the dictionary entries.  When a new entry is created, just the
    // last byte is stored, and the rest (prefix) of the entry is only
    // referenced by its table entry.  Then the code chases through the
    // prefixes until it reaches a single byte code.  We have to chase twice,
    // first to compute the length, and then to actually copy the data to the
    // output (backwards, since we know the length).  The alternative would be
    // storing something in an intermediate stack, but that doesn't make any
    // more sense.  I implemented an approach where it also stored the length
    // in the code table, although it's a bit tricky because you run out of
    // bits (12 + 12 + 8), but I didn't measure much improvements (the table
    // entries are generally not the long).  Even when I created benchmarks for
    // very long table entries the complexity did not seem worth it.
    // The code table stores the prefix entry in 12 bits and then the suffix
    // byte in 8 bits, so each entry is 20 bits.

    var chase_code = code < next_code ? code : prev_code;

    // Chase what we will output, either {CODE} or {CODE-1}.
    var chase_length = 0;
    var chase = chase_code;
    while (chase > clear_code) {
      chase = code_table[chase] >> 8;
      ++chase_length;
    }

    var k = chase;
    
    var op_end = op + chase_length + (chase_code !== code ? 1 : 0);
    if (op_end > output_length) {
      console.log("Warning, gif stream longer than expected.");
      return;
    }

    // Already have the first byte from the chase, might as well write it fast.
    output[op++] = k;

    op += chase_length;
    var b = op;  // Track pointer, writing backwards.

    if (chase_code !== code)  // The case of emitting {CODE-1} + k.
      output[op++] = k;

    chase = chase_code;
    while (chase_length--) {
      chase = code_table[chase];
      output[--b] = chase & 0xff;  // Write backwards.
      chase >>= 8;  // Pull down to the prefix code.
    }

    if (prev_code !== null && next_code < 4096) {
      code_table[next_code++] = prev_code << 8 | k;
      // TODO(deanm): Figure out this clearing vs code growth logic better.  I
      // have an feeling that it should just happen somewhere else, for now it
      // is awkward between when we grow past the max and then hit a clear code.
      // For now just check if we hit the max 12-bits (then a clear code should
      // follow, also of course encoded in 12-bits).
      if (next_code >= code_mask+1 && cur_code_size < 12) {
        ++cur_code_size;
        code_mask = code_mask << 1 | 1;
      }
    }

    prev_code = code;
  }

  if (op !== output_length) {
    console.log("Warning, gif stream shorter than expected.");
  }

  return output;
}

try { exports.GifWriter = GifWriter; exports.GifReader = GifReader } catch(e) { }  // CommonJS.

},{}],51:[function(require,module,exports){
'use strict';


var TYPED_OK =  (typeof Uint8Array !== 'undefined') &&
                (typeof Uint16Array !== 'undefined') &&
                (typeof Int32Array !== 'undefined');

function _has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

exports.assign = function (obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    var source = sources.shift();
    if (!source) { continue; }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be non-object');
    }

    for (var p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }

  return obj;
};


// reduce buffer size, avoiding mem copy
exports.shrinkBuf = function (buf, size) {
  if (buf.length === size) { return buf; }
  if (buf.subarray) { return buf.subarray(0, size); }
  buf.length = size;
  return buf;
};


var fnTyped = {
  arraySet: function (dest, src, src_offs, len, dest_offs) {
    if (src.subarray && dest.subarray) {
      dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
      return;
    }
    // Fallback to ordinary array
    for (var i = 0; i < len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function (chunks) {
    var i, l, len, pos, chunk, result;

    // calculate data length
    len = 0;
    for (i = 0, l = chunks.length; i < l; i++) {
      len += chunks[i].length;
    }

    // join chunks
    result = new Uint8Array(len);
    pos = 0;
    for (i = 0, l = chunks.length; i < l; i++) {
      chunk = chunks[i];
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return result;
  }
};

var fnUntyped = {
  arraySet: function (dest, src, src_offs, len, dest_offs) {
    for (var i = 0; i < len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function (chunks) {
    return [].concat.apply([], chunks);
  }
};


// Enable/Disable typed arrays use, for testing
//
exports.setTyped = function (on) {
  if (on) {
    exports.Buf8  = Uint8Array;
    exports.Buf16 = Uint16Array;
    exports.Buf32 = Int32Array;
    exports.assign(exports, fnTyped);
  } else {
    exports.Buf8  = Array;
    exports.Buf16 = Array;
    exports.Buf32 = Array;
    exports.assign(exports, fnUntyped);
  }
};

exports.setTyped(TYPED_OK);

},{}],52:[function(require,module,exports){
'use strict';

// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It isn't worth it to make additional optimizations as in original.
// Small size is preferable.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function adler32(adler, buf, len, pos) {
  var s1 = (adler & 0xffff) |0,
      s2 = ((adler >>> 16) & 0xffff) |0,
      n = 0;

  while (len !== 0) {
    // Set limit ~ twice less than 5552, to keep
    // s2 in 31-bits, because we force signed ints.
    // in other case %= will fail.
    n = len > 2000 ? 2000 : len;
    len -= n;

    do {
      s1 = (s1 + buf[pos++]) |0;
      s2 = (s2 + s1) |0;
    } while (--n);

    s1 %= 65521;
    s2 %= 65521;
  }

  return (s1 | (s2 << 16)) |0;
}


module.exports = adler32;

},{}],53:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

module.exports = {

  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH:         0,
  Z_PARTIAL_FLUSH:    1,
  Z_SYNC_FLUSH:       2,
  Z_FULL_FLUSH:       3,
  Z_FINISH:           4,
  Z_BLOCK:            5,
  Z_TREES:            6,

  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK:               0,
  Z_STREAM_END:       1,
  Z_NEED_DICT:        2,
  Z_ERRNO:           -1,
  Z_STREAM_ERROR:    -2,
  Z_DATA_ERROR:      -3,
  //Z_MEM_ERROR:     -4,
  Z_BUF_ERROR:       -5,
  //Z_VERSION_ERROR: -6,

  /* compression levels */
  Z_NO_COMPRESSION:         0,
  Z_BEST_SPEED:             1,
  Z_BEST_COMPRESSION:       9,
  Z_DEFAULT_COMPRESSION:   -1,


  Z_FILTERED:               1,
  Z_HUFFMAN_ONLY:           2,
  Z_RLE:                    3,
  Z_FIXED:                  4,
  Z_DEFAULT_STRATEGY:       0,

  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY:                 0,
  Z_TEXT:                   1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN:                2,

  /* The deflate compression method */
  Z_DEFLATED:               8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};

},{}],54:[function(require,module,exports){
'use strict';

// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// Use ordinary array, since untyped makes no boost here
function makeTable() {
  var c, table = [];

  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }

  return table;
}

// Create table on load. Just 255 signed longs. Not a problem.
var crcTable = makeTable();


function crc32(crc, buf, len, pos) {
  var t = crcTable,
      end = pos + len;

  crc ^= -1;

  for (var i = pos; i < end; i++) {
    crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
  }

  return (crc ^ (-1)); // >>> 0;
}


module.exports = crc32;

},{}],55:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils   = require('../utils/common');
var trees   = require('./trees');
var adler32 = require('./adler32');
var crc32   = require('./crc32');
var msg     = require('./messages');

/* Public constants ==========================================================*/
/* ===========================================================================*/


/* Allowed flush values; see deflate() and inflate() below for details */
var Z_NO_FLUSH      = 0;
var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
var Z_FULL_FLUSH    = 3;
var Z_FINISH        = 4;
var Z_BLOCK         = 5;
//var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK            = 0;
var Z_STREAM_END    = 1;
//var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR  = -2;
var Z_DATA_ERROR    = -3;
//var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR     = -5;
//var Z_VERSION_ERROR = -6;


/* compression levels */
//var Z_NO_COMPRESSION      = 0;
//var Z_BEST_SPEED          = 1;
//var Z_BEST_COMPRESSION    = 9;
var Z_DEFAULT_COMPRESSION = -1;


var Z_FILTERED            = 1;
var Z_HUFFMAN_ONLY        = 2;
var Z_RLE                 = 3;
var Z_FIXED               = 4;
var Z_DEFAULT_STRATEGY    = 0;

/* Possible values of the data_type field (though see inflate()) */
//var Z_BINARY              = 0;
//var Z_TEXT                = 1;
//var Z_ASCII               = 1; // = Z_TEXT
var Z_UNKNOWN             = 2;


/* The deflate compression method */
var Z_DEFLATED  = 8;

/*============================================================================*/


var MAX_MEM_LEVEL = 9;
/* Maximum value for memLevel in deflateInit2 */
var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_MEM_LEVEL = 8;


var LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */
var LITERALS      = 256;
/* number of literal bytes 0..255 */
var L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */
var D_CODES       = 30;
/* number of distance codes */
var BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */
var HEAP_SIZE     = 2 * L_CODES + 1;
/* maximum heap size */
var MAX_BITS  = 15;
/* All codes must not exceed MAX_BITS bits */

var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);

var PRESET_DICT = 0x20;

var INIT_STATE = 42;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;

var BS_NEED_MORE      = 1; /* block not completed, need more input or more output */
var BS_BLOCK_DONE     = 2; /* block flush performed */
var BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
var BS_FINISH_DONE    = 4; /* finish done, accept no more input or output */

var OS_CODE = 0x03; // Unix :) . Don't detect, use this default.

function err(strm, errorCode) {
  strm.msg = msg[errorCode];
  return errorCode;
}

function rank(f) {
  return ((f) << 1) - ((f) > 4 ? 9 : 0);
}

function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }


/* =========================================================================
 * Flush as much pending output as possible. All deflate() output goes
 * through this function so some applications may wish to modify it
 * to avoid allocating a large strm->output buffer and copying into it.
 * (See also read_buf()).
 */
function flush_pending(strm) {
  var s = strm.state;

  //_tr_flush_bits(s);
  var len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) { return; }

  utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
}


function flush_block_only(s, last) {
  trees._tr_flush_block(s, (s.block_start >= 0 ? s.block_start : -1), s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
}


function put_byte(s, b) {
  s.pending_buf[s.pending++] = b;
}


/* =========================================================================
 * Put a short in the pending buffer. The 16-bit value is put in MSB order.
 * IN assertion: the stream state is correct and there is enough room in
 * pending_buf.
 */
function putShortMSB(s, b) {
//  put_byte(s, (Byte)(b >> 8));
//  put_byte(s, (Byte)(b & 0xff));
  s.pending_buf[s.pending++] = (b >>> 8) & 0xff;
  s.pending_buf[s.pending++] = b & 0xff;
}


/* ===========================================================================
 * Read a new buffer from the current input stream, update the adler32
 * and total number of bytes read.  All deflate() input goes through
 * this function so some applications may wish to modify it to avoid
 * allocating a large strm->input buffer and copying from it.
 * (See also flush_pending()).
 */
function read_buf(strm, buf, start, size) {
  var len = strm.avail_in;

  if (len > size) { len = size; }
  if (len === 0) { return 0; }

  strm.avail_in -= len;

  // zmemcpy(buf, strm->next_in, len);
  utils.arraySet(buf, strm.input, strm.next_in, len, start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32(strm.adler, buf, len, start);
  }

  else if (strm.state.wrap === 2) {
    strm.adler = crc32(strm.adler, buf, len, start);
  }

  strm.next_in += len;
  strm.total_in += len;

  return len;
}


/* ===========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 * OUT assertion: the match length is not greater than s->lookahead.
 */
function longest_match(s, cur_match) {
  var chain_length = s.max_chain_length;      /* max hash chain length */
  var scan = s.strstart; /* current string */
  var match;                       /* matched string */
  var len;                           /* length of current match */
  var best_len = s.prev_length;              /* best match length so far */
  var nice_match = s.nice_match;             /* stop if match long enough */
  var limit = (s.strstart > (s.w_size - MIN_LOOKAHEAD)) ?
      s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0/*NIL*/;

  var _win = s.window; // shortcut

  var wmask = s.w_mask;
  var prev  = s.prev;

  /* Stop when cur_match becomes <= limit. To simplify the code,
   * we prevent matches with the string of window index 0.
   */

  var strend = s.strstart + MAX_MATCH;
  var scan_end1  = _win[scan + best_len - 1];
  var scan_end   = _win[scan + best_len];

  /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
   * It is easy to get rid of this optimization if necessary.
   */
  // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

  /* Do not waste too much time if we already have a good match: */
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  /* Do not look for matches beyond the end of the input. This is necessary
   * to make deflate deterministic.
   */
  if (nice_match > s.lookahead) { nice_match = s.lookahead; }

  // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

  do {
    // Assert(cur_match < s->strstart, "no future");
    match = cur_match;

    /* Skip to next match if the match length cannot increase
     * or if the match length is less than 2.  Note that the checks below
     * for insufficient lookahead only occur occasionally for performance
     * reasons.  Therefore uninitialized memory will be accessed, and
     * conditional jumps will be made that depend on those values.
     * However the length of the match is limited to the lookahead, so
     * the output of deflate is not affected by the uninitialized values.
     */

    if (_win[match + best_len]     !== scan_end  ||
        _win[match + best_len - 1] !== scan_end1 ||
        _win[match]                !== _win[scan] ||
        _win[++match]              !== _win[scan + 1]) {
      continue;
    }

    /* The check at best_len-1 can be removed because it will be made
     * again later. (This heuristic is not always a win.)
     * It is not necessary to compare scan[2] and match[2] since they
     * are always equal when the other bytes match, given that
     * the hash keys are equal and that HASH_BITS >= 8.
     */
    scan += 2;
    match++;
    // Assert(*scan == *match, "match[2]?");

    /* We check for insufficient lookahead only every 8th comparison;
     * the 256th check will be made at strstart+258.
     */
    do {
      /*jshint noempty:false*/
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             scan < strend);

    // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;

    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1  = _win[scan + best_len - 1];
      scan_end   = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);

  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
}


/* ===========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead.
 *
 * IN assertion: lookahead < MIN_LOOKAHEAD
 * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
 *    At least one byte has been read, or avail_in == 0; reads are
 *    performed for at least two bytes (required for the zip translate_eol
 *    option -- not supported here).
 */
function fill_window(s) {
  var _w_size = s.w_size;
  var p, n, m, more, str;

  //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

  do {
    more = s.window_size - s.lookahead - s.strstart;

    // JS ints have 32 bit, block below not needed
    /* Deal with !@#$% 64K limit: */
    //if (sizeof(int) <= 2) {
    //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
    //        more = wsize;
    //
    //  } else if (more == (unsigned)(-1)) {
    //        /* Very unlikely, but possible on 16 bit machine if
    //         * strstart == 0 && lookahead == 1 (input done a byte at time)
    //         */
    //        more--;
    //    }
    //}


    /* If the window is almost full and there is insufficient lookahead,
     * move the upper half to the lower one to make room in the upper half.
     */
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {

      utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      /* we now have strstart >= MAX_DIST */
      s.block_start -= _w_size;

      /* Slide the hash table (could be avoided with 32 bit values
       at the expense of memory usage). We slide even when level == 0
       to keep the hash table consistent if we switch back to level > 0
       later. (Using level 0 permanently is not an optimal usage of
       zlib, so we don't care about this pathological case.)
       */

      n = s.hash_size;
      p = n;
      do {
        m = s.head[--p];
        s.head[p] = (m >= _w_size ? m - _w_size : 0);
      } while (--n);

      n = _w_size;
      p = n;
      do {
        m = s.prev[--p];
        s.prev[p] = (m >= _w_size ? m - _w_size : 0);
        /* If n is not on any hash chain, prev[n] is garbage but
         * its value will never be used.
         */
      } while (--n);

      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }

    /* If there was no sliding:
     *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
     *    more == window_size - lookahead - strstart
     * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
     * => more >= window_size - 2*WSIZE + 2
     * In the BIG_MEM or MMAP case (not yet supported),
     *   window_size == input_size + MIN_LOOKAHEAD  &&
     *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
     * Otherwise, window_size == 2*WSIZE so more >= 2.
     * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
     */
    //Assert(more >= 2, "more < 2");
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;

    /* Initialize the hash value now that we have some input: */
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];

      /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + 1]) & s.hash_mask;
//#if MIN_MATCH != 3
//        Call update_hash() MIN_MATCH-3 more times
//#endif
      while (s.insert) {
        /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;

        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
    /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
     * but this is not important since only literal bytes will be emitted.
     */

  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);

  /* If the WIN_INIT bytes after the end of the current data have never been
   * written, then zero those bytes in order to avoid memory check reports of
   * the use of uninitialized (or uninitialised as Julian writes) bytes by
   * the longest match routines.  Update the high water mark for the next
   * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
   * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
   */
//  if (s.high_water < s.window_size) {
//    var curr = s.strstart + s.lookahead;
//    var init = 0;
//
//    if (s.high_water < curr) {
//      /* Previous high water mark below current data -- zero WIN_INIT
//       * bytes or up to end of window, whichever is less.
//       */
//      init = s.window_size - curr;
//      if (init > WIN_INIT)
//        init = WIN_INIT;
//      zmemzero(s->window + curr, (unsigned)init);
//      s->high_water = curr + init;
//    }
//    else if (s->high_water < (ulg)curr + WIN_INIT) {
//      /* High water mark at or above current data, but below current data
//       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
//       * to end of window, whichever is less.
//       */
//      init = (ulg)curr + WIN_INIT - s->high_water;
//      if (init > s->window_size - s->high_water)
//        init = s->window_size - s->high_water;
//      zmemzero(s->window + s->high_water, (unsigned)init);
//      s->high_water += init;
//    }
//  }
//
//  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
//    "not enough room for search");
}

/* ===========================================================================
 * Copy without compression as much as possible from the input stream, return
 * the current block state.
 * This function does not insert new strings in the dictionary since
 * uncompressible data is probably not useful. This function is used
 * only for the level=0 compression option.
 * NOTE: this function should be optimized to avoid extra copying from
 * window to pending_buf.
 */
function deflate_stored(s, flush) {
  /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
   * to pending_buf_size, and each stored block has a 5 byte header:
   */
  var max_block_size = 0xffff;

  if (max_block_size > s.pending_buf_size - 5) {
    max_block_size = s.pending_buf_size - 5;
  }

  /* Copy as much as possible from input to output: */
  for (;;) {
    /* Fill the window as much as possible: */
    if (s.lookahead <= 1) {

      //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
      //  s->block_start >= (long)s->w_size, "slide too late");
//      if (!(s.strstart < s.w_size + (s.w_size - MIN_LOOKAHEAD) ||
//        s.block_start >= s.w_size)) {
//        throw  new Error("slide too late");
//      }

      fill_window(s);
      if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }

      if (s.lookahead === 0) {
        break;
      }
      /* flush the current block */
    }
    //Assert(s->block_start >= 0L, "block gone");
//    if (s.block_start < 0) throw new Error("block gone");

    s.strstart += s.lookahead;
    s.lookahead = 0;

    /* Emit a stored block if pending_buf will be full: */
    var max_start = s.block_start + max_block_size;

    if (s.strstart === 0 || s.strstart >= max_start) {
      /* strstart == 0 is possible when wraparound on 16-bit machine */
      s.lookahead = s.strstart - max_start;
      s.strstart = max_start;
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/


    }
    /* Flush if we may have to slide, otherwise block_start may become
     * negative and the data will be gone:
     */
    if (s.strstart - s.block_start >= (s.w_size - MIN_LOOKAHEAD)) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }

  s.insert = 0;

  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }

  if (s.strstart > s.block_start) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_NEED_MORE;
}

/* ===========================================================================
 * Compress as much as possible from the input stream, return the current
 * block state.
 * This function does not perform lazy evaluation of matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
function deflate_fast(s, flush) {
  var hash_head;        /* head of the hash chain */
  var bflush;           /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break; /* flush the current block */
      }
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     * At this point we have always match_length < MIN_MATCH
     */
    if (hash_head !== 0/*NIL*/ && ((s.strstart - hash_head) <= (s.w_size - MIN_LOOKAHEAD))) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */
    }
    if (s.match_length >= MIN_MATCH) {
      // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

      /*** _tr_tally_dist(s, s.strstart - s.match_start,
                     s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;

      /* Insert new strings in the hash table only if the match length
       * is not too large. This saves time but degrades compression.
       */
      if (s.match_length <= s.max_lazy_match/*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
        s.match_length--; /* string at strstart already in table */
        do {
          s.strstart++;
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
          /* strstart never exceeds WSIZE-MAX_MATCH, so there are
           * always MIN_MATCH bytes ahead.
           */
        } while (--s.match_length !== 0);
        s.strstart++;
      } else
      {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + 1]) & s.hash_mask;

//#if MIN_MATCH != 3
//                Call UPDATE_HASH() MIN_MATCH-3 more times
//#endif
        /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
         * matter since it will be recomputed at next deflate call.
         */
      }
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s.window[s.strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = ((s.strstart < (MIN_MATCH - 1)) ? s.strstart : MIN_MATCH - 1);
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
function deflate_slow(s, flush) {
  var hash_head;          /* head of hash chain */
  var bflush;              /* set if current block must be flushed */

  var max_insert;

  /* Process the input block. */
  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     */
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;

    if (hash_head !== 0/*NIL*/ && s.prev_length < s.max_lazy_match &&
        s.strstart - hash_head <= (s.w_size - MIN_LOOKAHEAD)/*MAX_DIST(s)*/) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */

      if (s.match_length <= 5 &&
         (s.strategy === Z_FILTERED || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096/*TOO_FAR*/))) {

        /* If prev_match is also MIN_MATCH, match_start is garbage
         * but we will ignore the current match anyway.
         */
        s.match_length = MIN_MATCH - 1;
      }
    }
    /* If there was a match at the previous step and the current
     * match is not better, output the previous match:
     */
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      /* Do not insert strings in hash table beyond this. */

      //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

      /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                     s.prev_length - MIN_MATCH, bflush);***/
      bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      /* Insert in hash table all strings up to the end of the match.
       * strstart-1 and strstart are already inserted. If there is not
       * enough lookahead, the last two strings are not inserted in
       * the hash table.
       */
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;

      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }

    } else if (s.match_available) {
      /* If there was no match at the previous position, output a
       * single literal. If there was a match but the current match
       * is longer, truncate the previous match to a single literal.
       */
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);

      if (bflush) {
        /*** FLUSH_BLOCK_ONLY(s, 0) ***/
        flush_block_only(s, false);
        /***/
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      /* There is no previous match to compare with, wait for
       * the next step to decide.
       */
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  //Assert (flush != Z_NO_FLUSH, "no flush?");
  if (s.match_available) {
    //Tracevv((stderr,"%c", s->window[s->strstart-1]));
    /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);

    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_BLOCK_DONE;
}


/* ===========================================================================
 * For Z_RLE, simply look for runs of bytes, generate matches only of distance
 * one.  Do not maintain a hash table.  (It will be regenerated if this run of
 * deflate switches away from Z_RLE.)
 */
function deflate_rle(s, flush) {
  var bflush;            /* set if current block must be flushed */
  var prev;              /* byte at distance one to match */
  var scan, strend;      /* scan goes up to strend for length of run */

  var _win = s.window;

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the longest run, plus one for the unrolled loop.
     */
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* See how many times the previous byte repeats */
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
          /*jshint noempty:false*/
        } while (prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
      //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
    }

    /* Emit match if have run of MIN_MATCH or longer, else emit literal */
    if (s.match_length >= MIN_MATCH) {
      //check_match(s, s.strstart, s.strstart - 1, s.match_length);

      /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
 * (It will be regenerated if this run of deflate switches away from Huffman.)
 */
function deflate_huff(s, flush) {
  var bflush;             /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we have a literal to write. */
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        break;      /* flush the current block */
      }
    }

    /* Output a literal byte */
    s.match_length = 0;
    //Tracevv((stderr,"%c", s->window[s->strstart]));
    /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* Values for max_lazy_match, good_match and max_chain_length, depending on
 * the desired pack level (0..9). The values given below have been tuned to
 * exclude worst case performance for pathological files. Better values may be
 * found for specific files.
 */
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}

var configuration_table;

configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),          /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),            /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),           /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),          /* 3 */

  new Config(4, 4, 16, 16, deflate_slow),          /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),         /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),       /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),       /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),    /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)     /* 9 max compression */
];


/* ===========================================================================
 * Initialize the "longest match" routines for a new zlib stream
 */
function lm_init(s) {
  s.window_size = 2 * s.w_size;

  /*** CLEAR_HASH(s); ***/
  zero(s.head); // Fill with NIL (= 0);

  /* Set the default configuration parameters:
   */
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;

  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
}


function DeflateState() {
  this.strm = null;            /* pointer back to this zlib stream */
  this.status = 0;            /* as the name implies */
  this.pending_buf = null;      /* output still pending */
  this.pending_buf_size = 0;  /* size of pending_buf */
  this.pending_out = 0;       /* next pending byte to output to the stream */
  this.pending = 0;           /* nb of bytes in the pending buffer */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.gzhead = null;         /* gzip header information to write */
  this.gzindex = 0;           /* where in extra, name, or comment */
  this.method = Z_DEFLATED; /* can only be DEFLATED */
  this.last_flush = -1;   /* value of flush param for previous deflate call */

  this.w_size = 0;  /* LZ77 window size (32K by default) */
  this.w_bits = 0;  /* log2(w_size)  (8..16) */
  this.w_mask = 0;  /* w_size - 1 */

  this.window = null;
  /* Sliding window. Input bytes are read into the second half of the window,
   * and move to the first half later to keep a dictionary of at least wSize
   * bytes. With this organization, matches are limited to a distance of
   * wSize-MAX_MATCH bytes, but this ensures that IO is always
   * performed with a length multiple of the block size.
   */

  this.window_size = 0;
  /* Actual size of window: 2*wSize, except when the user input buffer
   * is directly used as sliding window.
   */

  this.prev = null;
  /* Link to older string with same hash index. To limit the size of this
   * array to 64K, this link is maintained only for the last 32K strings.
   * An index in this array is thus a window index modulo 32K.
   */

  this.head = null;   /* Heads of the hash chains or NIL. */

  this.ins_h = 0;       /* hash index of string to be inserted */
  this.hash_size = 0;   /* number of elements in hash table */
  this.hash_bits = 0;   /* log2(hash_size) */
  this.hash_mask = 0;   /* hash_size-1 */

  this.hash_shift = 0;
  /* Number of bits by which ins_h must be shifted at each input
   * step. It must be such that after MIN_MATCH steps, the oldest
   * byte no longer takes part in the hash key, that is:
   *   hash_shift * MIN_MATCH >= hash_bits
   */

  this.block_start = 0;
  /* Window position at the beginning of the current output block. Gets
   * negative when the window is moved backwards.
   */

  this.match_length = 0;      /* length of best match */
  this.prev_match = 0;        /* previous match */
  this.match_available = 0;   /* set if previous match exists */
  this.strstart = 0;          /* start of string to insert */
  this.match_start = 0;       /* start of matching string */
  this.lookahead = 0;         /* number of valid bytes ahead in window */

  this.prev_length = 0;
  /* Length of the best match at previous step. Matches not greater than this
   * are discarded. This is used in the lazy match evaluation.
   */

  this.max_chain_length = 0;
  /* To speed up deflation, hash chains are never searched beyond this
   * length.  A higher limit improves compression ratio but degrades the
   * speed.
   */

  this.max_lazy_match = 0;
  /* Attempt to find a better match only when the current match is strictly
   * smaller than this value. This mechanism is used only for compression
   * levels >= 4.
   */
  // That's alias to max_lazy_match, don't use directly
  //this.max_insert_length = 0;
  /* Insert new strings in the hash table only if the match length is not
   * greater than this length. This saves time but degrades compression.
   * max_insert_length is used only for compression levels <= 3.
   */

  this.level = 0;     /* compression level (1..9) */
  this.strategy = 0;  /* favor or force Huffman coding*/

  this.good_match = 0;
  /* Use a faster search when the previous match is longer than this */

  this.nice_match = 0; /* Stop searching when current match exceeds this */

              /* used by trees.c: */

  /* Didn't use ct_data typedef below to suppress compiler warning */

  // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
  // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
  // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

  // Use flat array of DOUBLE size, with interleaved fata,
  // because JS does not support effective
  this.dyn_ltree  = new utils.Buf16(HEAP_SIZE * 2);
  this.dyn_dtree  = new utils.Buf16((2 * D_CODES + 1) * 2);
  this.bl_tree    = new utils.Buf16((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);

  this.l_desc   = null;         /* desc. for literal tree */
  this.d_desc   = null;         /* desc. for distance tree */
  this.bl_desc  = null;         /* desc. for bit length tree */

  //ush bl_count[MAX_BITS+1];
  this.bl_count = new utils.Buf16(MAX_BITS + 1);
  /* number of codes at each bit length for an optimal tree */

  //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
  this.heap = new utils.Buf16(2 * L_CODES + 1);  /* heap used to build the Huffman trees */
  zero(this.heap);

  this.heap_len = 0;               /* number of elements in the heap */
  this.heap_max = 0;               /* element of largest frequency */
  /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
   * The same heap array is used to build all trees.
   */

  this.depth = new utils.Buf16(2 * L_CODES + 1); //uch depth[2*L_CODES+1];
  zero(this.depth);
  /* Depth of each subtree used as tie breaker for trees of equal frequency
   */

  this.l_buf = 0;          /* buffer index for literals or lengths */

  this.lit_bufsize = 0;
  /* Size of match buffer for literals/lengths.  There are 4 reasons for
   * limiting lit_bufsize to 64K:
   *   - frequencies can be kept in 16 bit counters
   *   - if compression is not successful for the first block, all input
   *     data is still in the window so we can still emit a stored block even
   *     when input comes from standard input.  (This can also be done for
   *     all blocks if lit_bufsize is not greater than 32K.)
   *   - if compression is not successful for a file smaller than 64K, we can
   *     even emit a stored file instead of a stored block (saving 5 bytes).
   *     This is applicable only for zip (not gzip or zlib).
   *   - creating new Huffman trees less frequently may not provide fast
   *     adaptation to changes in the input data statistics. (Take for
   *     example a binary file with poorly compressible code followed by
   *     a highly compressible string table.) Smaller buffer sizes give
   *     fast adaptation but have of course the overhead of transmitting
   *     trees more frequently.
   *   - I can't count above 4
   */

  this.last_lit = 0;      /* running index in l_buf */

  this.d_buf = 0;
  /* Buffer index for distances. To simplify the code, d_buf and l_buf have
   * the same number of elements. To use different lengths, an extra flag
   * array would be necessary.
   */

  this.opt_len = 0;       /* bit length of current block with optimal trees */
  this.static_len = 0;    /* bit length of current block with static trees */
  this.matches = 0;       /* number of string matches in current block */
  this.insert = 0;        /* bytes at end of window left to insert */


  this.bi_buf = 0;
  /* Output buffer. bits are inserted starting at the bottom (least
   * significant bits).
   */
  this.bi_valid = 0;
  /* Number of valid bits in bi_buf.  All bits above the last valid bit
   * are always zero.
   */

  // Used for window memory init. We safely ignore it for JS. That makes
  // sense only for pointers and memory check tools.
  //this.high_water = 0;
  /* High water mark offset in window for initialized bytes -- bytes above
   * this are set to zero in order to avoid memory check warnings when
   * longest match routines access bytes past the input.  This is then
   * updated to the new high water mark.
   */
}


function deflateResetKeep(strm) {
  var s;

  if (!strm || !strm.state) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;

  s = strm.state;
  s.pending = 0;
  s.pending_out = 0;

  if (s.wrap < 0) {
    s.wrap = -s.wrap;
    /* was made negative by deflate(..., Z_FINISH); */
  }
  s.status = (s.wrap ? INIT_STATE : BUSY_STATE);
  strm.adler = (s.wrap === 2) ?
    0  // crc32(0, Z_NULL, 0)
  :
    1; // adler32(0, Z_NULL, 0)
  s.last_flush = Z_NO_FLUSH;
  trees._tr_init(s);
  return Z_OK;
}


function deflateReset(strm) {
  var ret = deflateResetKeep(strm);
  if (ret === Z_OK) {
    lm_init(strm.state);
  }
  return ret;
}


function deflateSetHeader(strm, head) {
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  if (strm.state.wrap !== 2) { return Z_STREAM_ERROR; }
  strm.state.gzhead = head;
  return Z_OK;
}


function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
  if (!strm) { // === Z_NULL
    return Z_STREAM_ERROR;
  }
  var wrap = 1;

  if (level === Z_DEFAULT_COMPRESSION) {
    level = 6;
  }

  if (windowBits < 0) { /* suppress zlib wrapper */
    wrap = 0;
    windowBits = -windowBits;
  }

  else if (windowBits > 15) {
    wrap = 2;           /* write gzip wrapper instead */
    windowBits -= 16;
  }


  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED ||
    windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
    strategy < 0 || strategy > Z_FIXED) {
    return err(strm, Z_STREAM_ERROR);
  }


  if (windowBits === 8) {
    windowBits = 9;
  }
  /* until 256-byte window bug fixed */

  var s = new DeflateState();

  strm.state = s;
  s.strm = strm;

  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;

  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);

  s.window = new utils.Buf8(s.w_size * 2);
  s.head = new utils.Buf16(s.hash_size);
  s.prev = new utils.Buf16(s.w_size);

  // Don't need mem init magic for JS.
  //s.high_water = 0;  /* nothing written to s->window yet */

  s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */

  s.pending_buf_size = s.lit_bufsize * 4;

  //overlay = (ushf *) ZALLOC(strm, s->lit_bufsize, sizeof(ush)+2);
  //s->pending_buf = (uchf *) overlay;
  s.pending_buf = new utils.Buf8(s.pending_buf_size);

  // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
  //s->d_buf = overlay + s->lit_bufsize/sizeof(ush);
  s.d_buf = 1 * s.lit_bufsize;

  //s->l_buf = s->pending_buf + (1+sizeof(ush))*s->lit_bufsize;
  s.l_buf = (1 + 2) * s.lit_bufsize;

  s.level = level;
  s.strategy = strategy;
  s.method = method;

  return deflateReset(strm);
}

function deflateInit(strm, level) {
  return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
}


function deflate(strm, flush) {
  var old_flush, s;
  var beg, val; // for gzip header write only

  if (!strm || !strm.state ||
    flush > Z_BLOCK || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
  }

  s = strm.state;

  if (!strm.output ||
      (!strm.input && strm.avail_in !== 0) ||
      (s.status === FINISH_STATE && flush !== Z_FINISH)) {
    return err(strm, (strm.avail_out === 0) ? Z_BUF_ERROR : Z_STREAM_ERROR);
  }

  s.strm = strm; /* just in case */
  old_flush = s.last_flush;
  s.last_flush = flush;

  /* Write the header */
  if (s.status === INIT_STATE) {

    if (s.wrap === 2) { // GZIP header
      strm.adler = 0;  //crc32(0L, Z_NULL, 0);
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) { // s->gzhead == Z_NULL
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
      }
      else {
        put_byte(s, (s.gzhead.text ? 1 : 0) +
                    (s.gzhead.hcrc ? 2 : 0) +
                    (!s.gzhead.extra ? 0 : 4) +
                    (!s.gzhead.name ? 0 : 8) +
                    (!s.gzhead.comment ? 0 : 16)
        );
        put_byte(s, s.gzhead.time & 0xff);
        put_byte(s, (s.gzhead.time >> 8) & 0xff);
        put_byte(s, (s.gzhead.time >> 16) & 0xff);
        put_byte(s, (s.gzhead.time >> 24) & 0xff);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, s.gzhead.os & 0xff);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 0xff);
          put_byte(s, (s.gzhead.extra.length >> 8) & 0xff);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    }
    else // DEFLATE header
    {
      var header = (Z_DEFLATED + ((s.w_bits - 8) << 4)) << 8;
      var level_flags = -1;

      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0;
      } else if (s.level < 6) {
        level_flags = 1;
      } else if (s.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= (level_flags << 6);
      if (s.strstart !== 0) { header |= PRESET_DICT; }
      header += 31 - (header % 31);

      s.status = BUSY_STATE;
      putShortMSB(s, header);

      /* Save the adler32 of the preset dictionary: */
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 0xffff);
      }
      strm.adler = 1; // adler32(0L, Z_NULL, 0);
    }
  }

//#ifdef GZIP
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */

      while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            break;
          }
        }
        put_byte(s, s.gzhead.extra[s.gzindex] & 0xff);
        s.gzindex++;
      }
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (s.gzindex === s.gzhead.extra.length) {
        s.gzindex = 0;
        s.status = NAME_STATE;
      }
    }
    else {
      s.status = NAME_STATE;
    }
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.gzindex = 0;
        s.status = COMMENT_STATE;
      }
    }
    else {
      s.status = COMMENT_STATE;
    }
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.status = HCRC_STATE;
      }
    }
    else {
      s.status = HCRC_STATE;
    }
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
      }
      if (s.pending + 2 <= s.pending_buf_size) {
        put_byte(s, strm.adler & 0xff);
        put_byte(s, (strm.adler >> 8) & 0xff);
        strm.adler = 0; //crc32(0L, Z_NULL, 0);
        s.status = BUSY_STATE;
      }
    }
    else {
      s.status = BUSY_STATE;
    }
  }
//#endif

  /* Flush as much pending output as possible */
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      /* Since avail_out is 0, deflate will be called again with
       * more output space, but possibly with both pending and
       * avail_in equal to zero. There won't be anything to do,
       * but this is not an error situation so make sure we
       * return OK instead of BUF_ERROR at next call of deflate:
       */
      s.last_flush = -1;
      return Z_OK;
    }

    /* Make sure there is something to do and avoid duplicate consecutive
     * flushes. For repeated and useless calls with Z_FINISH, we keep
     * returning Z_STREAM_END instead of Z_BUF_ERROR.
     */
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) &&
    flush !== Z_FINISH) {
    return err(strm, Z_BUF_ERROR);
  }

  /* User must not provide more input after the first FINISH: */
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR);
  }

  /* Start a new block or continue the current one.
   */
  if (strm.avail_in !== 0 || s.lookahead !== 0 ||
    (flush !== Z_NO_FLUSH && s.status !== FINISH_STATE)) {
    var bstate = (s.strategy === Z_HUFFMAN_ONLY) ? deflate_huff(s, flush) :
      (s.strategy === Z_RLE ? deflate_rle(s, flush) :
        configuration_table[s.level].func(s, flush));

    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        /* avoid BUF_ERROR next call, see above */
      }
      return Z_OK;
      /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
       * of deflate should use the same flush parameter to make sure
       * that the flush is complete. So we don't have to output an
       * empty block here, this will be done at next call. This also
       * ensures that for a very small output buffer, we emit at most
       * one empty block.
       */
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        trees._tr_align(s);
      }
      else if (flush !== Z_BLOCK) { /* FULL_FLUSH or SYNC_FLUSH */

        trees._tr_stored_block(s, 0, 0, false);
        /* For a full flush, this empty block will be recognized
         * as a special marker by inflate_sync().
         */
        if (flush === Z_FULL_FLUSH) {
          /*** CLEAR_HASH(s); ***/             /* forget history */
          zero(s.head); // Fill with NIL (= 0);

          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
        return Z_OK;
      }
    }
  }
  //Assert(strm->avail_out > 0, "bug2");
  //if (strm.avail_out <= 0) { throw new Error("bug2");}

  if (flush !== Z_FINISH) { return Z_OK; }
  if (s.wrap <= 0) { return Z_STREAM_END; }

  /* Write the trailer */
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 0xff);
    put_byte(s, (strm.adler >> 8) & 0xff);
    put_byte(s, (strm.adler >> 16) & 0xff);
    put_byte(s, (strm.adler >> 24) & 0xff);
    put_byte(s, strm.total_in & 0xff);
    put_byte(s, (strm.total_in >> 8) & 0xff);
    put_byte(s, (strm.total_in >> 16) & 0xff);
    put_byte(s, (strm.total_in >> 24) & 0xff);
  }
  else
  {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 0xffff);
  }

  flush_pending(strm);
  /* If avail_out is zero, the application will call deflate again
   * to flush the rest.
   */
  if (s.wrap > 0) { s.wrap = -s.wrap; }
  /* write the trailer only once! */
  return s.pending !== 0 ? Z_OK : Z_STREAM_END;
}

function deflateEnd(strm) {
  var status;

  if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
    return Z_STREAM_ERROR;
  }

  status = strm.state.status;
  if (status !== INIT_STATE &&
    status !== EXTRA_STATE &&
    status !== NAME_STATE &&
    status !== COMMENT_STATE &&
    status !== HCRC_STATE &&
    status !== BUSY_STATE &&
    status !== FINISH_STATE
  ) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.state = null;

  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
}


/* =========================================================================
 * Initializes the compression dictionary from the given byte
 * sequence without producing any compressed output.
 */
function deflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;

  var s;
  var str, n;
  var wrap;
  var avail;
  var next;
  var input;
  var tmpDict;

  if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
    return Z_STREAM_ERROR;
  }

  s = strm.state;
  wrap = s.wrap;

  if (wrap === 2 || (wrap === 1 && s.status !== INIT_STATE) || s.lookahead) {
    return Z_STREAM_ERROR;
  }

  /* when using zlib wrappers, compute Adler-32 for provided dictionary */
  if (wrap === 1) {
    /* adler32(strm->adler, dictionary, dictLength); */
    strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
  }

  s.wrap = 0;   /* avoid computing Adler-32 in read_buf */

  /* if dictionary would fill window, just replace the history */
  if (dictLength >= s.w_size) {
    if (wrap === 0) {            /* already empty otherwise */
      /*** CLEAR_HASH(s); ***/
      zero(s.head); // Fill with NIL (= 0);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    /* use the tail */
    // dictionary = dictionary.slice(dictLength - s.w_size);
    tmpDict = new utils.Buf8(s.w_size);
    utils.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  /* insert dictionary into window and hash */
  avail = strm.avail_in;
  next = strm.next_in;
  input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    str = s.strstart;
    n = s.lookahead - (MIN_MATCH - 1);
    do {
      /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;

      s.prev[str & s.w_mask] = s.head[s.ins_h];

      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK;
}


exports.deflateInit = deflateInit;
exports.deflateInit2 = deflateInit2;
exports.deflateReset = deflateReset;
exports.deflateResetKeep = deflateResetKeep;
exports.deflateSetHeader = deflateSetHeader;
exports.deflate = deflate;
exports.deflateEnd = deflateEnd;
exports.deflateSetDictionary = deflateSetDictionary;
exports.deflateInfo = 'pako deflate (from Nodeca project)';

/* Not implemented
exports.deflateBound = deflateBound;
exports.deflateCopy = deflateCopy;
exports.deflateParams = deflateParams;
exports.deflatePending = deflatePending;
exports.deflatePrime = deflatePrime;
exports.deflateTune = deflateTune;
*/

},{"../utils/common":51,"./adler32":52,"./crc32":54,"./messages":59,"./trees":60}],56:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// See state defs from inflate.js
var BAD = 30;       /* got a data error -- remain here until reset */
var TYPE = 12;      /* i: waiting for type bits, including last-flag bit */

/*
   Decode literal, length, and distance codes and write out the resulting
   literal and match bytes until either not enough input or output is
   available, an end-of-block is encountered, or a data error is encountered.
   When large enough input and output buffers are supplied to inflate(), for
   example, a 16K input buffer and a 64K output buffer, more than 95% of the
   inflate execution time is spent in this routine.

   Entry assumptions:

        state.mode === LEN
        strm.avail_in >= 6
        strm.avail_out >= 258
        start >= strm.avail_out
        state.bits < 8

   On return, state.mode is one of:

        LEN -- ran out of enough output space or enough available input
        TYPE -- reached end of block code, inflate() to interpret next block
        BAD -- error in block data

   Notes:

    - The maximum input bits used by a length/distance pair is 15 bits for the
      length code, 5 bits for the length extra, 15 bits for the distance code,
      and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
      Therefore if strm.avail_in >= 6, then there is enough input to avoid
      checking for available input while decoding.

    - The maximum bytes that a single length/distance pair can output is 258
      bytes, which is the maximum length that can be coded.  inflate_fast()
      requires strm.avail_out >= 258 for each loop to avoid checking for
      output space.
 */
module.exports = function inflate_fast(strm, start) {
  var state;
  var _in;                    /* local strm.input */
  var last;                   /* have enough input while in < last */
  var _out;                   /* local strm.output */
  var beg;                    /* inflate()'s initial strm.output */
  var end;                    /* while out < end, enough space available */
//#ifdef INFLATE_STRICT
  var dmax;                   /* maximum distance from zlib header */
//#endif
  var wsize;                  /* window size or zero if not using window */
  var whave;                  /* valid bytes in the window */
  var wnext;                  /* window write index */
  // Use `s_window` instead `window`, avoid conflict with instrumentation tools
  var s_window;               /* allocated sliding window, if wsize != 0 */
  var hold;                   /* local strm.hold */
  var bits;                   /* local strm.bits */
  var lcode;                  /* local strm.lencode */
  var dcode;                  /* local strm.distcode */
  var lmask;                  /* mask for first level of length codes */
  var dmask;                  /* mask for first level of distance codes */
  var here;                   /* retrieved table entry */
  var op;                     /* code bits, operation, extra bits, or */
                              /*  window position, window bytes to copy */
  var len;                    /* match length, unused bytes */
  var dist;                   /* match distance */
  var from;                   /* where to copy match from */
  var from_source;


  var input, output; // JS specific, because we have no pointers

  /* copy state to local variables */
  state = strm.state;
  //here = state.here;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
//#ifdef INFLATE_STRICT
  dmax = state.dmax;
//#endif
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;


  /* decode literals and length/distances until end-of-block or not enough
     input data or output space */

  top:
  do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }

    here = lcode[hold & lmask];

    dolen:
    for (;;) { // Goto emulation
      op = here >>> 24/*here.bits*/;
      hold >>>= op;
      bits -= op;
      op = (here >>> 16) & 0xff/*here.op*/;
      if (op === 0) {                          /* literal */
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        output[_out++] = here & 0xffff/*here.val*/;
      }
      else if (op & 16) {                     /* length base */
        len = here & 0xffff/*here.val*/;
        op &= 15;                           /* number of extra bits */
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & ((1 << op) - 1);
          hold >>>= op;
          bits -= op;
        }
        //Tracevv((stderr, "inflate:         length %u\n", len));
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];

        dodist:
        for (;;) { // goto emulation
          op = here >>> 24/*here.bits*/;
          hold >>>= op;
          bits -= op;
          op = (here >>> 16) & 0xff/*here.op*/;

          if (op & 16) {                      /* distance base */
            dist = here & 0xffff/*here.val*/;
            op &= 15;                       /* number of extra bits */
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & ((1 << op) - 1);
//#ifdef INFLATE_STRICT
            if (dist > dmax) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break top;
            }
//#endif
            hold >>>= op;
            bits -= op;
            //Tracevv((stderr, "inflate:         distance %u\n", dist));
            op = _out - beg;                /* max distance in output */
            if (dist > op) {                /* see if copy from window */
              op = dist - op;               /* distance back in window */
              if (op > whave) {
                if (state.sane) {
                  strm.msg = 'invalid distance too far back';
                  state.mode = BAD;
                  break top;
                }

// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//                if (len <= op - whave) {
//                  do {
//                    output[_out++] = 0;
//                  } while (--len);
//                  continue top;
//                }
//                len -= op - whave;
//                do {
//                  output[_out++] = 0;
//                } while (--op > whave);
//                if (op === 0) {
//                  from = _out - dist;
//                  do {
//                    output[_out++] = output[from++];
//                  } while (--len);
//                  continue top;
//                }
//#endif
              }
              from = 0; // window index
              from_source = s_window;
              if (wnext === 0) {           /* very common case */
                from += wsize - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              else if (wnext < op) {      /* wrap around window */
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {         /* some from end of window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = 0;
                  if (wnext < len) {  /* some from start of window */
                    op = wnext;
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;      /* rest from output */
                    from_source = output;
                  }
                }
              }
              else {                      /* contiguous in window */
                from += wnext - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) {
                  output[_out++] = from_source[from++];
                }
              }
            }
            else {
              from = _out - dist;          /* copy direct from output */
              do {                        /* minimum length is three */
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) {
                  output[_out++] = output[from++];
                }
              }
            }
          }
          else if ((op & 64) === 0) {          /* 2nd level distance code */
            here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
            continue dodist;
          }
          else {
            strm.msg = 'invalid distance code';
            state.mode = BAD;
            break top;
          }

          break; // need to emulate goto via "continue"
        }
      }
      else if ((op & 64) === 0) {              /* 2nd level length code */
        here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
        continue dolen;
      }
      else if (op & 32) {                     /* end-of-block */
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.mode = TYPE;
        break top;
      }
      else {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD;
        break top;
      }

      break; // need to emulate goto via "continue"
    }
  } while (_in < last && _out < end);

  /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;

  /* update state and return */
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
  strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
  state.hold = hold;
  state.bits = bits;
  return;
};

},{}],57:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils         = require('../utils/common');
var adler32       = require('./adler32');
var crc32         = require('./crc32');
var inflate_fast  = require('./inffast');
var inflate_table = require('./inftrees');

var CODES = 0;
var LENS = 1;
var DISTS = 2;

/* Public constants ==========================================================*/
/* ===========================================================================*/


/* Allowed flush values; see deflate() and inflate() below for details */
//var Z_NO_FLUSH      = 0;
//var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
//var Z_FULL_FLUSH    = 3;
var Z_FINISH        = 4;
var Z_BLOCK         = 5;
var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK            = 0;
var Z_STREAM_END    = 1;
var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR  = -2;
var Z_DATA_ERROR    = -3;
var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR     = -5;
//var Z_VERSION_ERROR = -6;

/* The deflate compression method */
var Z_DEFLATED  = 8;


/* STATES ====================================================================*/
/* ===========================================================================*/


var    HEAD = 1;       /* i: waiting for magic header */
var    FLAGS = 2;      /* i: waiting for method and flags (gzip) */
var    TIME = 3;       /* i: waiting for modification time (gzip) */
var    OS = 4;         /* i: waiting for extra flags and operating system (gzip) */
var    EXLEN = 5;      /* i: waiting for extra length (gzip) */
var    EXTRA = 6;      /* i: waiting for extra bytes (gzip) */
var    NAME = 7;       /* i: waiting for end of file name (gzip) */
var    COMMENT = 8;    /* i: waiting for end of comment (gzip) */
var    HCRC = 9;       /* i: waiting for header crc (gzip) */
var    DICTID = 10;    /* i: waiting for dictionary check value */
var    DICT = 11;      /* waiting for inflateSetDictionary() call */
var        TYPE = 12;      /* i: waiting for type bits, including last-flag bit */
var        TYPEDO = 13;    /* i: same, but skip check to exit inflate on new block */
var        STORED = 14;    /* i: waiting for stored size (length and complement) */
var        COPY_ = 15;     /* i/o: same as COPY below, but only first time in */
var        COPY = 16;      /* i/o: waiting for input or output to copy stored block */
var        TABLE = 17;     /* i: waiting for dynamic block table lengths */
var        LENLENS = 18;   /* i: waiting for code length code lengths */
var        CODELENS = 19;  /* i: waiting for length/lit and distance code lengths */
var            LEN_ = 20;      /* i: same as LEN below, but only first time in */
var            LEN = 21;       /* i: waiting for length/lit/eob code */
var            LENEXT = 22;    /* i: waiting for length extra bits */
var            DIST = 23;      /* i: waiting for distance code */
var            DISTEXT = 24;   /* i: waiting for distance extra bits */
var            MATCH = 25;     /* o: waiting for output space to copy string */
var            LIT = 26;       /* o: waiting for output space to write literal */
var    CHECK = 27;     /* i: waiting for 32-bit check value */
var    LENGTH = 28;    /* i: waiting for 32-bit length (gzip) */
var    DONE = 29;      /* finished check, done -- remain here until reset */
var    BAD = 30;       /* got a data error -- remain here until reset */
var    MEM = 31;       /* got an inflate() memory error -- remain here until reset */
var    SYNC = 32;      /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/



var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_WBITS = MAX_WBITS;


function zswap32(q) {
  return  (((q >>> 24) & 0xff) +
          ((q >>> 8) & 0xff00) +
          ((q & 0xff00) << 8) +
          ((q & 0xff) << 24));
}


function InflateState() {
  this.mode = 0;             /* current inflate mode */
  this.last = false;          /* true if processing last block */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.havedict = false;      /* true if dictionary provided */
  this.flags = 0;             /* gzip header method and flags (0 if zlib) */
  this.dmax = 0;              /* zlib header max distance (INFLATE_STRICT) */
  this.check = 0;             /* protected copy of check value */
  this.total = 0;             /* protected copy of output count */
  // TODO: may be {}
  this.head = null;           /* where to save gzip header information */

  /* sliding window */
  this.wbits = 0;             /* log base 2 of requested window size */
  this.wsize = 0;             /* window size or zero if not using window */
  this.whave = 0;             /* valid bytes in the window */
  this.wnext = 0;             /* window write index */
  this.window = null;         /* allocated sliding window, if needed */

  /* bit accumulator */
  this.hold = 0;              /* input bit accumulator */
  this.bits = 0;              /* number of bits in "in" */

  /* for string and stored block copying */
  this.length = 0;            /* literal or length of data to copy */
  this.offset = 0;            /* distance back to copy string from */

  /* for table and code decoding */
  this.extra = 0;             /* extra bits needed */

  /* fixed and dynamic code tables */
  this.lencode = null;          /* starting table for length/literal codes */
  this.distcode = null;         /* starting table for distance codes */
  this.lenbits = 0;           /* index bits for lencode */
  this.distbits = 0;          /* index bits for distcode */

  /* dynamic table building */
  this.ncode = 0;             /* number of code length code lengths */
  this.nlen = 0;              /* number of length code lengths */
  this.ndist = 0;             /* number of distance code lengths */
  this.have = 0;              /* number of code lengths in lens[] */
  this.next = null;              /* next available space in codes[] */

  this.lens = new utils.Buf16(320); /* temporary storage for code lengths */
  this.work = new utils.Buf16(288); /* work area for code table building */

  /*
   because we don't have pointers in js, we use lencode and distcode directly
   as buffers so we don't need codes
  */
  //this.codes = new utils.Buf32(ENOUGH);       /* space for code tables */
  this.lendyn = null;              /* dynamic table for length/literal codes (JS specific) */
  this.distdyn = null;             /* dynamic table for distance codes (JS specific) */
  this.sane = 0;                   /* if false, allow invalid distance too far */
  this.back = 0;                   /* bits back of last unprocessed length/lit */
  this.was = 0;                    /* initial length of match */
}

function inflateResetKeep(strm) {
  var state;

  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = ''; /*Z_NULL*/
  if (state.wrap) {       /* to support ill-conceived Java test suite */
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.dmax = 32768;
  state.head = null/*Z_NULL*/;
  state.hold = 0;
  state.bits = 0;
  //state.lencode = state.distcode = state.next = state.codes;
  state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
  state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);

  state.sane = 1;
  state.back = -1;
  //Tracev((stderr, "inflate: reset\n"));
  return Z_OK;
}

function inflateReset(strm) {
  var state;

  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);

}

function inflateReset2(strm, windowBits) {
  var wrap;
  var state;

  /* get the state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;

  /* extract wrap request from windowBits parameter */
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  }
  else {
    wrap = (windowBits >> 4) + 1;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }

  /* set number of window bits, free window if different */
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }

  /* update state and reset the rest of it */
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
}

function inflateInit2(strm, windowBits) {
  var ret;
  var state;

  if (!strm) { return Z_STREAM_ERROR; }
  //strm.msg = Z_NULL;                 /* in case we return an error */

  state = new InflateState();

  //if (state === Z_NULL) return Z_MEM_ERROR;
  //Tracev((stderr, "inflate: allocated\n"));
  strm.state = state;
  state.window = null/*Z_NULL*/;
  ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK) {
    strm.state = null/*Z_NULL*/;
  }
  return ret;
}

function inflateInit(strm) {
  return inflateInit2(strm, DEF_WBITS);
}


/*
 Return state with length and distance decoding tables and index sizes set to
 fixed code decoding.  Normally this returns fixed tables from inffixed.h.
 If BUILDFIXED is defined, then instead this routine builds the tables the
 first time it's called, and returns those tables the first time and
 thereafter.  This reduces the size of the code by about 2K bytes, in
 exchange for a little execution time.  However, BUILDFIXED should not be
 used for threaded applications, since the rewriting of the tables and virgin
 may not be thread-safe.
 */
var virgin = true;

var lenfix, distfix; // We have no pointers in JS, so keep tables separate

function fixedtables(state) {
  /* build fixed huffman tables if first call (may not be thread safe) */
  if (virgin) {
    var sym;

    lenfix = new utils.Buf32(512);
    distfix = new utils.Buf32(32);

    /* literal/length table */
    sym = 0;
    while (sym < 144) { state.lens[sym++] = 8; }
    while (sym < 256) { state.lens[sym++] = 9; }
    while (sym < 280) { state.lens[sym++] = 7; }
    while (sym < 288) { state.lens[sym++] = 8; }

    inflate_table(LENS,  state.lens, 0, 288, lenfix,   0, state.work, { bits: 9 });

    /* distance table */
    sym = 0;
    while (sym < 32) { state.lens[sym++] = 5; }

    inflate_table(DISTS, state.lens, 0, 32,   distfix, 0, state.work, { bits: 5 });

    /* do this just once */
    virgin = false;
  }

  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
}


/*
 Update the window with the last wsize (normally 32K) bytes written before
 returning.  If window does not exist yet, create it.  This is only called
 when a window is already in use, or when output has been written during this
 inflate call, but the end of the deflate stream has not been reached yet.
 It is also called to create a window for dictionary data when a dictionary
 is loaded.

 Providing output buffers larger than 32K to inflate() should provide a speed
 advantage, since only the last 32K of output is copied to the sliding window
 upon return from inflate(), and since all distances after the first 32K of
 output will fall in the output data, making match copies simpler and faster.
 The advantage may be dependent on the size of the processor's data caches.
 */
function updatewindow(strm, src, end, copy) {
  var dist;
  var state = strm.state;

  /* if it hasn't been done already, allocate space for the window */
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;

    state.window = new utils.Buf8(state.wsize);
  }

  /* copy state->wsize or less output bytes into the circular window */
  if (copy >= state.wsize) {
    utils.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
    state.wnext = 0;
    state.whave = state.wsize;
  }
  else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    //zmemcpy(state->window + state->wnext, end - copy, dist);
    utils.arraySet(state.window, src, end - copy, dist, state.wnext);
    copy -= dist;
    if (copy) {
      //zmemcpy(state->window, end - copy, copy);
      utils.arraySet(state.window, src, end - copy, copy, 0);
      state.wnext = copy;
      state.whave = state.wsize;
    }
    else {
      state.wnext += dist;
      if (state.wnext === state.wsize) { state.wnext = 0; }
      if (state.whave < state.wsize) { state.whave += dist; }
    }
  }
  return 0;
}

function inflate(strm, flush) {
  var state;
  var input, output;          // input/output buffers
  var next;                   /* next input INDEX */
  var put;                    /* next output INDEX */
  var have, left;             /* available input and output */
  var hold;                   /* bit buffer */
  var bits;                   /* bits in bit buffer */
  var _in, _out;              /* save starting available input and output */
  var copy;                   /* number of stored or match bytes to copy */
  var from;                   /* where to copy match bytes from */
  var from_source;
  var here = 0;               /* current decoding table entry */
  var here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
  //var last;                   /* parent table entry */
  var last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
  var len;                    /* length to copy for repeats, bits to drop */
  var ret;                    /* return code */
  var hbuf = new utils.Buf8(4);    /* buffer for gzip header crc calculation */
  var opts;

  var n; // temporary var for NEED_BITS

  var order = /* permutation of code lengths */
    [ 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ];


  if (!strm || !strm.state || !strm.output ||
      (!strm.input && strm.avail_in !== 0)) {
    return Z_STREAM_ERROR;
  }

  state = strm.state;
  if (state.mode === TYPE) { state.mode = TYPEDO; }    /* skip check */


  //--- LOAD() ---
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  //---

  _in = have;
  _out = left;
  ret = Z_OK;

  inf_leave: // goto emulation
  for (;;) {
    switch (state.mode) {
      case HEAD:
        if (state.wrap === 0) {
          state.mode = TYPEDO;
          break;
        }
        //=== NEEDBITS(16);
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if ((state.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
          state.check = 0/*crc32(0L, Z_NULL, 0)*/;
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//

          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = FLAGS;
          break;
        }
        state.flags = 0;           /* expect zlib header */
        if (state.head) {
          state.head.done = false;
        }
        if (!(state.wrap & 1) ||   /* check if zlib header allowed */
          (((hold & 0xff)/*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
          strm.msg = 'incorrect header check';
          state.mode = BAD;
          break;
        }
        if ((hold & 0x0f)/*BITS(4)*/ !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
        len = (hold & 0x0f)/*BITS(4)*/ + 8;
        if (state.wbits === 0) {
          state.wbits = len;
        }
        else if (len > state.wbits) {
          strm.msg = 'invalid window size';
          state.mode = BAD;
          break;
        }
        state.dmax = 1 << len;
        //Tracev((stderr, "inflate:   zlib header ok\n"));
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = hold & 0x200 ? DICTID : TYPE;
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        break;
      case FLAGS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.flags = hold;
        if ((state.flags & 0xff) !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        if (state.flags & 0xe000) {
          strm.msg = 'unknown header flags set';
          state.mode = BAD;
          break;
        }
        if (state.head) {
          state.head.text = ((hold >> 8) & 1);
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = TIME;
        /* falls through */
      case TIME:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.time = hold;
        }
        if (state.flags & 0x0200) {
          //=== CRC4(state.check, hold)
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          hbuf[2] = (hold >>> 16) & 0xff;
          hbuf[3] = (hold >>> 24) & 0xff;
          state.check = crc32(state.check, hbuf, 4, 0);
          //===
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = OS;
        /* falls through */
      case OS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.xflags = (hold & 0xff);
          state.head.os = (hold >> 8);
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = EXLEN;
        /* falls through */
      case EXLEN:
        if (state.flags & 0x0400) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length = hold;
          if (state.head) {
            state.head.extra_len = hold;
          }
          if (state.flags & 0x0200) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
            //===//
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        }
        else if (state.head) {
          state.head.extra = null/*Z_NULL*/;
        }
        state.mode = EXTRA;
        /* falls through */
      case EXTRA:
        if (state.flags & 0x0400) {
          copy = state.length;
          if (copy > have) { copy = have; }
          if (copy) {
            if (state.head) {
              len = state.head.extra_len - state.length;
              if (!state.head.extra) {
                // Use untyped array for more convenient processing later
                state.head.extra = new Array(state.head.extra_len);
              }
              utils.arraySet(
                state.head.extra,
                input,
                next,
                // extra field is limited to 65536 bytes
                // - no need for additional size check
                copy,
                /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                len
              );
              //zmemcpy(state.head.extra + len, next,
              //        len + copy > state.head.extra_max ?
              //        state.head.extra_max - len : copy);
            }
            if (state.flags & 0x0200) {
              state.check = crc32(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            state.length -= copy;
          }
          if (state.length) { break inf_leave; }
        }
        state.length = 0;
        state.mode = NAME;
        /* falls through */
      case NAME:
        if (state.flags & 0x0800) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            // TODO: 2 or 1 bytes?
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len &&
                (state.length < 65536 /*state.head.name_max*/)) {
              state.head.name += String.fromCharCode(len);
            }
          } while (len && copy < have);

          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.name = null;
        }
        state.length = 0;
        state.mode = COMMENT;
        /* falls through */
      case COMMENT:
        if (state.flags & 0x1000) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len &&
                (state.length < 65536 /*state.head.comm_max*/)) {
              state.head.comment += String.fromCharCode(len);
            }
          } while (len && copy < have);
          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.comment = null;
        }
        state.mode = HCRC;
        /* falls through */
      case HCRC:
        if (state.flags & 0x0200) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (hold !== (state.check & 0xffff)) {
            strm.msg = 'header crc mismatch';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        }
        if (state.head) {
          state.head.hcrc = ((state.flags >> 9) & 1);
          state.head.done = true;
        }
        strm.adler = state.check = 0;
        state.mode = TYPE;
        break;
      case DICTID:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        strm.adler = state.check = zswap32(hold);
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = DICT;
        /* falls through */
      case DICT:
        if (state.havedict === 0) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          return Z_NEED_DICT;
        }
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = TYPE;
        /* falls through */
      case TYPE:
        if (flush === Z_BLOCK || flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case TYPEDO:
        if (state.last) {
          //--- BYTEBITS() ---//
          hold >>>= bits & 7;
          bits -= bits & 7;
          //---//
          state.mode = CHECK;
          break;
        }
        //=== NEEDBITS(3); */
        while (bits < 3) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.last = (hold & 0x01)/*BITS(1)*/;
        //--- DROPBITS(1) ---//
        hold >>>= 1;
        bits -= 1;
        //---//

        switch ((hold & 0x03)/*BITS(2)*/) {
          case 0:                             /* stored block */
            //Tracev((stderr, "inflate:     stored block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = STORED;
            break;
          case 1:                             /* fixed block */
            fixedtables(state);
            //Tracev((stderr, "inflate:     fixed codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = LEN_;             /* decode codes */
            if (flush === Z_TREES) {
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
              break inf_leave;
            }
            break;
          case 2:                             /* dynamic block */
            //Tracev((stderr, "inflate:     dynamic codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = TABLE;
            break;
          case 3:
            strm.msg = 'invalid block type';
            state.mode = BAD;
        }
        //--- DROPBITS(2) ---//
        hold >>>= 2;
        bits -= 2;
        //---//
        break;
      case STORED:
        //--- BYTEBITS() ---// /* go to byte boundary */
        hold >>>= bits & 7;
        bits -= bits & 7;
        //---//
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
          strm.msg = 'invalid stored block lengths';
          state.mode = BAD;
          break;
        }
        state.length = hold & 0xffff;
        //Tracev((stderr, "inflate:       stored length %u\n",
        //        state.length));
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = COPY_;
        if (flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case COPY_:
        state.mode = COPY;
        /* falls through */
      case COPY:
        copy = state.length;
        if (copy) {
          if (copy > have) { copy = have; }
          if (copy > left) { copy = left; }
          if (copy === 0) { break inf_leave; }
          //--- zmemcpy(put, next, copy); ---
          utils.arraySet(output, input, next, copy, put);
          //---//
          have -= copy;
          next += copy;
          left -= copy;
          put += copy;
          state.length -= copy;
          break;
        }
        //Tracev((stderr, "inflate:       stored end\n"));
        state.mode = TYPE;
        break;
      case TABLE:
        //=== NEEDBITS(14); */
        while (bits < 14) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.nlen = (hold & 0x1f)/*BITS(5)*/ + 257;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ndist = (hold & 0x1f)/*BITS(5)*/ + 1;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ncode = (hold & 0x0f)/*BITS(4)*/ + 4;
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
//#ifndef PKZIP_BUG_WORKAROUND
        if (state.nlen > 286 || state.ndist > 30) {
          strm.msg = 'too many length or distance symbols';
          state.mode = BAD;
          break;
        }
//#endif
        //Tracev((stderr, "inflate:       table sizes ok\n"));
        state.have = 0;
        state.mode = LENLENS;
        /* falls through */
      case LENLENS:
        while (state.have < state.ncode) {
          //=== NEEDBITS(3);
          while (bits < 3) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.lens[order[state.have++]] = (hold & 0x07);//BITS(3);
          //--- DROPBITS(3) ---//
          hold >>>= 3;
          bits -= 3;
          //---//
        }
        while (state.have < 19) {
          state.lens[order[state.have++]] = 0;
        }
        // We have separate tables & no pointers. 2 commented lines below not needed.
        //state.next = state.codes;
        //state.lencode = state.next;
        // Switch to use dynamic table
        state.lencode = state.lendyn;
        state.lenbits = 7;

        opts = { bits: state.lenbits };
        ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
        state.lenbits = opts.bits;

        if (ret) {
          strm.msg = 'invalid code lengths set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, "inflate:       code lengths ok\n"));
        state.have = 0;
        state.mode = CODELENS;
        /* falls through */
      case CODELENS:
        while (state.have < state.nlen + state.ndist) {
          for (;;) {
            here = state.lencode[hold & ((1 << state.lenbits) - 1)];/*BITS(state.lenbits)*/
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          if (here_val < 16) {
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            state.lens[state.have++] = here_val;
          }
          else {
            if (here_val === 16) {
              //=== NEEDBITS(here.bits + 2);
              n = here_bits + 2;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              if (state.have === 0) {
                strm.msg = 'invalid bit length repeat';
                state.mode = BAD;
                break;
              }
              len = state.lens[state.have - 1];
              copy = 3 + (hold & 0x03);//BITS(2);
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
            }
            else if (here_val === 17) {
              //=== NEEDBITS(here.bits + 3);
              n = here_bits + 3;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 3 + (hold & 0x07);//BITS(3);
              //--- DROPBITS(3) ---//
              hold >>>= 3;
              bits -= 3;
              //---//
            }
            else {
              //=== NEEDBITS(here.bits + 7);
              n = here_bits + 7;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 11 + (hold & 0x7f);//BITS(7);
              //--- DROPBITS(7) ---//
              hold >>>= 7;
              bits -= 7;
              //---//
            }
            if (state.have + copy > state.nlen + state.ndist) {
              strm.msg = 'invalid bit length repeat';
              state.mode = BAD;
              break;
            }
            while (copy--) {
              state.lens[state.have++] = len;
            }
          }
        }

        /* handle error breaks in while */
        if (state.mode === BAD) { break; }

        /* check for end-of-block code (better have one) */
        if (state.lens[256] === 0) {
          strm.msg = 'invalid code -- missing end-of-block';
          state.mode = BAD;
          break;
        }

        /* build code tables -- note: do not change the lenbits or distbits
           values here (9 and 6) without reading the comments in inftrees.h
           concerning the ENOUGH constants, which depend on those values */
        state.lenbits = 9;

        opts = { bits: state.lenbits };
        ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.lenbits = opts.bits;
        // state.lencode = state.next;

        if (ret) {
          strm.msg = 'invalid literal/lengths set';
          state.mode = BAD;
          break;
        }

        state.distbits = 6;
        //state.distcode.copy(state.codes);
        // Switch to use dynamic table
        state.distcode = state.distdyn;
        opts = { bits: state.distbits };
        ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.distbits = opts.bits;
        // state.distcode = state.next;

        if (ret) {
          strm.msg = 'invalid distances set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, 'inflate:       codes ok\n'));
        state.mode = LEN_;
        if (flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case LEN_:
        state.mode = LEN;
        /* falls through */
      case LEN:
        if (have >= 6 && left >= 258) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          inflate_fast(strm, _out);
          //--- LOAD() ---
          put = strm.next_out;
          output = strm.output;
          left = strm.avail_out;
          next = strm.next_in;
          input = strm.input;
          have = strm.avail_in;
          hold = state.hold;
          bits = state.bits;
          //---

          if (state.mode === TYPE) {
            state.back = -1;
          }
          break;
        }
        state.back = 0;
        for (;;) {
          here = state.lencode[hold & ((1 << state.lenbits) - 1)];  /*BITS(state.lenbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if (here_bits <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if (here_op && (here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.lencode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((last_bits + here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        state.length = here_val;
        if (here_op === 0) {
          //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
          //        "inflate:         literal '%c'\n" :
          //        "inflate:         literal 0x%02x\n", here.val));
          state.mode = LIT;
          break;
        }
        if (here_op & 32) {
          //Tracevv((stderr, "inflate:         end of block\n"));
          state.back = -1;
          state.mode = TYPE;
          break;
        }
        if (here_op & 64) {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD;
          break;
        }
        state.extra = here_op & 15;
        state.mode = LENEXT;
        /* falls through */
      case LENEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
        //Tracevv((stderr, "inflate:         length %u\n", state.length));
        state.was = state.length;
        state.mode = DIST;
        /* falls through */
      case DIST:
        for (;;) {
          here = state.distcode[hold & ((1 << state.distbits) - 1)];/*BITS(state.distbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if ((here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.distcode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((last_bits + here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        if (here_op & 64) {
          strm.msg = 'invalid distance code';
          state.mode = BAD;
          break;
        }
        state.offset = here_val;
        state.extra = (here_op) & 15;
        state.mode = DISTEXT;
        /* falls through */
      case DISTEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.offset += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
//#ifdef INFLATE_STRICT
        if (state.offset > state.dmax) {
          strm.msg = 'invalid distance too far back';
          state.mode = BAD;
          break;
        }
//#endif
        //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
        state.mode = MATCH;
        /* falls through */
      case MATCH:
        if (left === 0) { break inf_leave; }
        copy = _out - left;
        if (state.offset > copy) {         /* copy from window */
          copy = state.offset - copy;
          if (copy > state.whave) {
            if (state.sane) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break;
            }
// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//          Trace((stderr, "inflate.c too far\n"));
//          copy -= state.whave;
//          if (copy > state.length) { copy = state.length; }
//          if (copy > left) { copy = left; }
//          left -= copy;
//          state.length -= copy;
//          do {
//            output[put++] = 0;
//          } while (--copy);
//          if (state.length === 0) { state.mode = LEN; }
//          break;
//#endif
          }
          if (copy > state.wnext) {
            copy -= state.wnext;
            from = state.wsize - copy;
          }
          else {
            from = state.wnext - copy;
          }
          if (copy > state.length) { copy = state.length; }
          from_source = state.window;
        }
        else {                              /* copy from output */
          from_source = output;
          from = put - state.offset;
          copy = state.length;
        }
        if (copy > left) { copy = left; }
        left -= copy;
        state.length -= copy;
        do {
          output[put++] = from_source[from++];
        } while (--copy);
        if (state.length === 0) { state.mode = LEN; }
        break;
      case LIT:
        if (left === 0) { break inf_leave; }
        output[put++] = state.length;
        left--;
        state.mode = LEN;
        break;
      case CHECK:
        if (state.wrap) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            // Use '|' instead of '+' to make sure that result is signed
            hold |= input[next++] << bits;
            bits += 8;
          }
          //===//
          _out -= left;
          strm.total_out += _out;
          state.total += _out;
          if (_out) {
            strm.adler = state.check =
                /*UPDATE(state.check, put - _out, _out);*/
                (state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out));

          }
          _out = left;
          // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
          if ((state.flags ? hold : zswap32(hold)) !== state.check) {
            strm.msg = 'incorrect data check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   check matches trailer\n"));
        }
        state.mode = LENGTH;
        /* falls through */
      case LENGTH:
        if (state.wrap && state.flags) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (hold !== (state.total & 0xffffffff)) {
            strm.msg = 'incorrect length check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   length matches trailer\n"));
        }
        state.mode = DONE;
        /* falls through */
      case DONE:
        ret = Z_STREAM_END;
        break inf_leave;
      case BAD:
        ret = Z_DATA_ERROR;
        break inf_leave;
      case MEM:
        return Z_MEM_ERROR;
      case SYNC:
        /* falls through */
      default:
        return Z_STREAM_ERROR;
    }
  }

  // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

  /*
     Return from inflate(), updating the total counts and the check value.
     If there was no progress during the inflate() call, return a buffer
     error.  Call updatewindow() to create and/or update the window state.
     Note: a memory error from inflate() is non-recoverable.
   */

  //--- RESTORE() ---
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  //---

  if (state.wsize || (_out !== strm.avail_out && state.mode < BAD &&
                      (state.mode < CHECK || flush !== Z_FINISH))) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
      state.mode = MEM;
      return Z_MEM_ERROR;
    }
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap && _out) {
    strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
      (state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out));
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) +
                    (state.mode === TYPE ? 128 : 0) +
                    (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if (((_in === 0 && _out === 0) || flush === Z_FINISH) && ret === Z_OK) {
    ret = Z_BUF_ERROR;
  }
  return ret;
}

function inflateEnd(strm) {

  if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/) {
    return Z_STREAM_ERROR;
  }

  var state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK;
}

function inflateGetHeader(strm, head) {
  var state;

  /* check state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  if ((state.wrap & 2) === 0) { return Z_STREAM_ERROR; }

  /* save header structure */
  state.head = head;
  head.done = false;
  return Z_OK;
}

function inflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;

  var state;
  var dictid;
  var ret;

  /* check state */
  if (!strm /* == Z_NULL */ || !strm.state /* == Z_NULL */) { return Z_STREAM_ERROR; }
  state = strm.state;

  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR;
  }

  /* check for correct dictionary identifier */
  if (state.mode === DICT) {
    dictid = 1; /* adler32(0, null, 0)*/
    /* dictid = adler32(dictid, dictionary, dictLength); */
    dictid = adler32(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR;
    }
  }
  /* copy dictionary to window using updatewindow(), which will amend the
   existing dictionary if appropriate */
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR;
  }
  state.havedict = 1;
  // Tracev((stderr, "inflate:   dictionary set\n"));
  return Z_OK;
}

exports.inflateReset = inflateReset;
exports.inflateReset2 = inflateReset2;
exports.inflateResetKeep = inflateResetKeep;
exports.inflateInit = inflateInit;
exports.inflateInit2 = inflateInit2;
exports.inflate = inflate;
exports.inflateEnd = inflateEnd;
exports.inflateGetHeader = inflateGetHeader;
exports.inflateSetDictionary = inflateSetDictionary;
exports.inflateInfo = 'pako inflate (from Nodeca project)';

/* Not implemented
exports.inflateCopy = inflateCopy;
exports.inflateGetDictionary = inflateGetDictionary;
exports.inflateMark = inflateMark;
exports.inflatePrime = inflatePrime;
exports.inflateSync = inflateSync;
exports.inflateSyncPoint = inflateSyncPoint;
exports.inflateUndermine = inflateUndermine;
*/

},{"../utils/common":51,"./adler32":52,"./crc32":54,"./inffast":56,"./inftrees":58}],58:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils = require('../utils/common');

var MAXBITS = 15;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

var CODES = 0;
var LENS = 1;
var DISTS = 2;

var lbase = [ /* Length codes 257..285 base */
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
];

var lext = [ /* Length codes 257..285 extra */
  16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
  19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
];

var dbase = [ /* Distance codes 0..29 base */
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577, 0, 0
];

var dext = [ /* Distance codes 0..29 extra */
  16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
  23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
  28, 28, 29, 29, 64, 64
];

module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts)
{
  var bits = opts.bits;
      //here = opts.here; /* table entry for duplication */

  var len = 0;               /* a code's length in bits */
  var sym = 0;               /* index of code symbols */
  var min = 0, max = 0;          /* minimum and maximum code lengths */
  var root = 0;              /* number of index bits for root table */
  var curr = 0;              /* number of index bits for current table */
  var drop = 0;              /* code bits to drop for sub-table */
  var left = 0;                   /* number of prefix codes available */
  var used = 0;              /* code entries in table used */
  var huff = 0;              /* Huffman code */
  var incr;              /* for incrementing code, index */
  var fill;              /* index for replicating entries */
  var low;               /* low bits for current root entry */
  var mask;              /* mask for low root bits */
  var next;             /* next available space in table */
  var base = null;     /* base value table to use */
  var base_index = 0;
//  var shoextra;    /* extra bits table to use */
  var end;                    /* use base and extra for symbol > end */
  var count = new utils.Buf16(MAXBITS + 1); //[MAXBITS+1];    /* number of codes of each length */
  var offs = new utils.Buf16(MAXBITS + 1); //[MAXBITS+1];     /* offsets in table for each length */
  var extra = null;
  var extra_index = 0;

  var here_bits, here_op, here_val;

  /*
   Process a set of code lengths to create a canonical Huffman code.  The
   code lengths are lens[0..codes-1].  Each length corresponds to the
   symbols 0..codes-1.  The Huffman code is generated by first sorting the
   symbols by length from short to long, and retaining the symbol order
   for codes with equal lengths.  Then the code starts with all zero bits
   for the first code of the shortest length, and the codes are integer
   increments for the same length, and zeros are appended as the length
   increases.  For the deflate format, these bits are stored backwards
   from their more natural integer increment ordering, and so when the
   decoding tables are built in the large loop below, the integer codes
   are incremented backwards.

   This routine assumes, but does not check, that all of the entries in
   lens[] are in the range 0..MAXBITS.  The caller must assure this.
   1..MAXBITS is interpreted as that code length.  zero means that that
   symbol does not occur in this code.

   The codes are sorted by computing a count of codes for each length,
   creating from that a table of starting indices for each length in the
   sorted table, and then entering the symbols in order in the sorted
   table.  The sorted table is work[], with that space being provided by
   the caller.

   The length counts are used for other purposes as well, i.e. finding
   the minimum and maximum length codes, determining if there are any
   codes at all, checking for a valid set of lengths, and looking ahead
   at length counts to determine sub-table sizes when building the
   decoding tables.
   */

  /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }

  /* bound code lengths, force root to be within code lengths */
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) { break; }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {                     /* no symbols to code at all */
    //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
    //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
    //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;


    //table.op[opts.table_index] = 64;
    //table.bits[opts.table_index] = 1;
    //table.val[opts.table_index++] = 0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;

    opts.bits = 1;
    return 0;     /* no symbols, but wait for decoding to report error */
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) { break; }
  }
  if (root < min) {
    root = min;
  }

  /* check for an over-subscribed or incomplete set of lengths */
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }        /* over-subscribed */
  }
  if (left > 0 && (type === CODES || max !== 1)) {
    return -1;                      /* incomplete set */
  }

  /* generate offsets into symbol table for each length for sorting */
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }

  /* sort symbols by length, by symbol order within each length */
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }

  /*
   Create and fill in decoding tables.  In this loop, the table being
   filled is at next and has curr index bits.  The code being used is huff
   with length len.  That code is converted to an index by dropping drop
   bits off of the bottom.  For codes where len is less than drop + curr,
   those top drop + curr - len bits are incremented through all values to
   fill the table with replicated entries.

   root is the number of index bits for the root table.  When len exceeds
   root, sub-tables are created pointed to by the root entry with an index
   of the low root bits of huff.  This is saved in low to check for when a
   new sub-table should be started.  drop is zero when the root table is
   being filled, and drop is root when sub-tables are being filled.

   When a new sub-table is needed, it is necessary to look ahead in the
   code lengths to determine what size sub-table is needed.  The length
   counts are used for this, and so count[] is decremented as codes are
   entered in the tables.

   used keeps track of how many table entries have been allocated from the
   provided *table space.  It is checked for LENS and DIST tables against
   the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
   the initial root table size constants.  See the comments in inftrees.h
   for more information.

   sym increments through all symbols, and the loop terminates when
   all codes of length max, i.e. all codes, have been processed.  This
   routine permits incomplete codes, so another loop after this one fills
   in the rest of the decoding tables with invalid code markers.
   */

  /* set up for code type */
  // poor man optimization - use if-else instead of switch,
  // to avoid deopts in old v8
  if (type === CODES) {
    base = extra = work;    /* dummy value--not used */
    end = 19;

  } else if (type === LENS) {
    base = lbase;
    base_index -= 257;
    extra = lext;
    extra_index -= 257;
    end = 256;

  } else {                    /* DISTS */
    base = dbase;
    extra = dext;
    end = -1;
  }

  /* initialize opts for loop */
  huff = 0;                   /* starting code */
  sym = 0;                    /* starting code symbol */
  len = min;                  /* starting code length */
  next = table_index;              /* current table to fill in */
  curr = root;                /* current table index bits */
  drop = 0;                   /* current bits to drop from code for index */
  low = -1;                   /* trigger new sub-table when len > root */
  used = 1 << root;          /* use root table entries */
  mask = used - 1;            /* mask for comparing low */

  /* check available table space */
  if ((type === LENS && used > ENOUGH_LENS) ||
    (type === DISTS && used > ENOUGH_DISTS)) {
    return 1;
  }

  /* process all codes and make table entries */
  for (;;) {
    /* create table entry */
    here_bits = len - drop;
    if (work[sym] < end) {
      here_op = 0;
      here_val = work[sym];
    }
    else if (work[sym] > end) {
      here_op = extra[extra_index + work[sym]];
      here_val = base[base_index + work[sym]];
    }
    else {
      here_op = 32 + 64;         /* end of block */
      here_val = 0;
    }

    /* replicate for those indices with low len bits equal to huff */
    incr = 1 << (len - drop);
    fill = 1 << curr;
    min = fill;                 /* save offset to next table */
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val |0;
    } while (fill !== 0);

    /* backwards increment the len-bit code huff */
    incr = 1 << (len - 1);
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }

    /* go to next symbol, update count, len */
    sym++;
    if (--count[len] === 0) {
      if (len === max) { break; }
      len = lens[lens_index + work[sym]];
    }

    /* create new sub-table if needed */
    if (len > root && (huff & mask) !== low) {
      /* if first time, transition to sub-tables */
      if (drop === 0) {
        drop = root;
      }

      /* increment past last table */
      next += min;            /* here min is 1 << curr */

      /* determine length of next table */
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) { break; }
        curr++;
        left <<= 1;
      }

      /* check for enough space */
      used += 1 << curr;
      if ((type === LENS && used > ENOUGH_LENS) ||
        (type === DISTS && used > ENOUGH_DISTS)) {
        return 1;
      }

      /* point entry in root table to sub-table */
      low = huff & mask;
      /*table.op[low] = curr;
      table.bits[low] = root;
      table.val[low] = next - opts.table_index;*/
      table[low] = (root << 24) | (curr << 16) | (next - table_index) |0;
    }
  }

  /* fill in remaining table entry if code is incomplete (guaranteed to have
   at most one remaining entry, since if the code is incomplete, the
   maximum code length that was allowed to get this far is one bit) */
  if (huff !== 0) {
    //table.op[next + huff] = 64;            /* invalid code marker */
    //table.bits[next + huff] = len - drop;
    //table.val[next + huff] = 0;
    table[next + huff] = ((len - drop) << 24) | (64 << 16) |0;
  }

  /* set return parameters */
  //opts.table_index += used;
  opts.bits = root;
  return 0;
};

},{"../utils/common":51}],59:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

module.exports = {
  2:      'need dictionary',     /* Z_NEED_DICT       2  */
  1:      'stream end',          /* Z_STREAM_END      1  */
  0:      '',                    /* Z_OK              0  */
  '-1':   'file error',          /* Z_ERRNO         (-1) */
  '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
  '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
  '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
  '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
  '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
};

},{}],60:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

/* eslint-disable space-unary-ops */

var utils = require('../utils/common');

/* Public constants ==========================================================*/
/* ===========================================================================*/


//var Z_FILTERED          = 1;
//var Z_HUFFMAN_ONLY      = 2;
//var Z_RLE               = 3;
var Z_FIXED               = 4;
//var Z_DEFAULT_STRATEGY  = 0;

/* Possible values of the data_type field (though see inflate()) */
var Z_BINARY              = 0;
var Z_TEXT                = 1;
//var Z_ASCII             = 1; // = Z_TEXT
var Z_UNKNOWN             = 2;

/*============================================================================*/


function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }

// From zutil.h

var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES    = 2;
/* The three kinds of block type */

var MIN_MATCH    = 3;
var MAX_MATCH    = 258;
/* The minimum and maximum match lengths */

// From deflate.h
/* ===========================================================================
 * Internal compression state.
 */

var LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */

var LITERALS      = 256;
/* number of literal bytes 0..255 */

var L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */

var D_CODES       = 30;
/* number of distance codes */

var BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */

var HEAP_SIZE     = 2 * L_CODES + 1;
/* maximum heap size */

var MAX_BITS      = 15;
/* All codes must not exceed MAX_BITS bits */

var Buf_size      = 16;
/* size of bit buffer in bi_buf */


/* ===========================================================================
 * Constants
 */

var MAX_BL_BITS = 7;
/* Bit length codes must not exceed MAX_BL_BITS bits */

var END_BLOCK   = 256;
/* end of block literal code */

var REP_3_6     = 16;
/* repeat previous bit length 3-6 times (2 bits of repeat count) */

var REPZ_3_10   = 17;
/* repeat a zero length 3-10 times  (3 bits of repeat count) */

var REPZ_11_138 = 18;
/* repeat a zero length 11-138 times  (7 bits of repeat count) */

/* eslint-disable comma-spacing,array-bracket-spacing */
var extra_lbits =   /* extra bits for each length code */
  [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];

var extra_dbits =   /* extra bits for each distance code */
  [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

var extra_blbits =  /* extra bits for each bit length code */
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7];

var bl_order =
  [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
/* eslint-enable comma-spacing,array-bracket-spacing */

/* The lengths of the bit length codes are sent in order of decreasing
 * probability, to avoid transmitting the lengths for unused bit length codes.
 */

/* ===========================================================================
 * Local data. These are initialized only once.
 */

// We pre-fill arrays with 0 to avoid uninitialized gaps

var DIST_CODE_LEN = 512; /* see definition of array dist_code below */

// !!!! Use flat array instead of structure, Freq = i*2, Len = i*2+1
var static_ltree  = new Array((L_CODES + 2) * 2);
zero(static_ltree);
/* The static literal tree. Since the bit lengths are imposed, there is no
 * need for the L_CODES extra codes used during heap construction. However
 * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
 * below).
 */

var static_dtree  = new Array(D_CODES * 2);
zero(static_dtree);
/* The static distance tree. (Actually a trivial tree since all codes use
 * 5 bits.)
 */

var _dist_code    = new Array(DIST_CODE_LEN);
zero(_dist_code);
/* Distance codes. The first 256 values correspond to the distances
 * 3 .. 258, the last 256 values correspond to the top 8 bits of
 * the 15 bit distances.
 */

var _length_code  = new Array(MAX_MATCH - MIN_MATCH + 1);
zero(_length_code);
/* length code for each normalized match length (0 == MIN_MATCH) */

var base_length   = new Array(LENGTH_CODES);
zero(base_length);
/* First normalized length for each code (0 = MIN_MATCH) */

var base_dist     = new Array(D_CODES);
zero(base_dist);
/* First normalized distance for each code (0 = distance of 1) */


function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {

  this.static_tree  = static_tree;  /* static tree or NULL */
  this.extra_bits   = extra_bits;   /* extra bits for each code or NULL */
  this.extra_base   = extra_base;   /* base index for extra_bits */
  this.elems        = elems;        /* max number of elements in the tree */
  this.max_length   = max_length;   /* max bit length for the codes */

  // show if `static_tree` has data or dummy - needed for monomorphic objects
  this.has_stree    = static_tree && static_tree.length;
}


var static_l_desc;
var static_d_desc;
var static_bl_desc;


function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;     /* the dynamic tree */
  this.max_code = 0;            /* largest code with non zero frequency */
  this.stat_desc = stat_desc;   /* the corresponding static tree */
}



function d_code(dist) {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
}


/* ===========================================================================
 * Output a short LSB first on the stream.
 * IN assertion: there is enough room in pendingBuf.
 */
function put_short(s, w) {
//    put_byte(s, (uch)((w) & 0xff));
//    put_byte(s, (uch)((ush)(w) >> 8));
  s.pending_buf[s.pending++] = (w) & 0xff;
  s.pending_buf[s.pending++] = (w >>> 8) & 0xff;
}


/* ===========================================================================
 * Send a value on a given number of bits.
 * IN assertion: length <= 16 and value fits in length bits.
 */
function send_bits(s, value, length) {
  if (s.bi_valid > (Buf_size - length)) {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> (Buf_size - s.bi_valid);
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    s.bi_valid += length;
  }
}


function send_code(s, c, tree) {
  send_bits(s, tree[c * 2]/*.Code*/, tree[c * 2 + 1]/*.Len*/);
}


/* ===========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
function bi_reverse(code, len) {
  var res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
}


/* ===========================================================================
 * Flush the bit buffer, keeping at most 7 bits in it.
 */
function bi_flush(s) {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;

  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 0xff;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
}


/* ===========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
function gen_bitlen(s, desc)
//    deflate_state *s;
//    tree_desc *desc;    /* the tree descriptor */
{
  var tree            = desc.dyn_tree;
  var max_code        = desc.max_code;
  var stree           = desc.stat_desc.static_tree;
  var has_stree       = desc.stat_desc.has_stree;
  var extra           = desc.stat_desc.extra_bits;
  var base            = desc.stat_desc.extra_base;
  var max_length      = desc.stat_desc.max_length;
  var h;              /* heap index */
  var n, m;           /* iterate over the tree elements */
  var bits;           /* bit length */
  var xbits;          /* extra bits */
  var f;              /* frequency */
  var overflow = 0;   /* number of elements with bit length too large */

  for (bits = 0; bits <= MAX_BITS; bits++) {
    s.bl_count[bits] = 0;
  }

  /* In a first pass, compute the optimal bit lengths (which may
   * overflow in the case of the bit length tree).
   */
  tree[s.heap[s.heap_max] * 2 + 1]/*.Len*/ = 0; /* root of the heap */

  for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1]/*.Dad*/ * 2 + 1]/*.Len*/ + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1]/*.Len*/ = bits;
    /* We overwrite tree[n].Dad which is no longer needed */

    if (n > max_code) { continue; } /* not a leaf node */

    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2]/*.Freq*/;
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1]/*.Len*/ + xbits);
    }
  }
  if (overflow === 0) { return; }

  // Trace((stderr,"\nbit length overflow\n"));
  /* This happens for example on obj2 and pic of the Calgary corpus */

  /* Find the first bit length which could increase: */
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) { bits--; }
    s.bl_count[bits]--;      /* move one leaf down the tree */
    s.bl_count[bits + 1] += 2; /* move one overflow item as its brother */
    s.bl_count[max_length]--;
    /* The brother of the overflow item also moves one step up,
     * but this does not affect bl_count[max_length]
     */
    overflow -= 2;
  } while (overflow > 0);

  /* Now recompute all bit lengths, scanning in increasing frequency.
   * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
   * lengths instead of fixing only the wrong ones. This idea is taken
   * from 'ar' written by Haruhiko Okumura.)
   */
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) { continue; }
      if (tree[m * 2 + 1]/*.Len*/ !== bits) {
        // Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
        s.opt_len += (bits - tree[m * 2 + 1]/*.Len*/) * tree[m * 2]/*.Freq*/;
        tree[m * 2 + 1]/*.Len*/ = bits;
      }
      n--;
    }
  }
}


/* ===========================================================================
 * Generate the codes for a given tree and bit counts (which need not be
 * optimal).
 * IN assertion: the array bl_count contains the bit length statistics for
 * the given tree and the field len is set for all tree elements.
 * OUT assertion: the field code is set for all tree elements of non
 *     zero code length.
 */
function gen_codes(tree, max_code, bl_count)
//    ct_data *tree;             /* the tree to decorate */
//    int max_code;              /* largest code with non zero frequency */
//    ushf *bl_count;            /* number of codes at each bit length */
{
  var next_code = new Array(MAX_BITS + 1); /* next code value for each bit length */
  var code = 0;              /* running code value */
  var bits;                  /* bit index */
  var n;                     /* code index */

  /* The distribution counts are first used to generate the code values
   * without bit reversal.
   */
  for (bits = 1; bits <= MAX_BITS; bits++) {
    next_code[bits] = code = (code + bl_count[bits - 1]) << 1;
  }
  /* Check that the bit counts in bl_count are consistent. The last code
   * must be all ones.
   */
  //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
  //        "inconsistent bit counts");
  //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

  for (n = 0;  n <= max_code; n++) {
    var len = tree[n * 2 + 1]/*.Len*/;
    if (len === 0) { continue; }
    /* Now reverse the bits */
    tree[n * 2]/*.Code*/ = bi_reverse(next_code[len]++, len);

    //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
    //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
  }
}


/* ===========================================================================
 * Initialize the various 'constant' tables.
 */
function tr_static_init() {
  var n;        /* iterates over tree elements */
  var bits;     /* bit counter */
  var length;   /* length value */
  var code;     /* code value */
  var dist;     /* distance index */
  var bl_count = new Array(MAX_BITS + 1);
  /* number of codes at each bit length for an optimal tree */

  // do check in _tr_init()
  //if (static_init_done) return;

  /* For some embedded targets, global variables are not initialized: */
/*#ifdef NO_INIT_GLOBAL_POINTERS
  static_l_desc.static_tree = static_ltree;
  static_l_desc.extra_bits = extra_lbits;
  static_d_desc.static_tree = static_dtree;
  static_d_desc.extra_bits = extra_dbits;
  static_bl_desc.extra_bits = extra_blbits;
#endif*/

  /* Initialize the mapping length (0..255) -> length code (0..28) */
  length = 0;
  for (code = 0; code < LENGTH_CODES - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < (1 << extra_lbits[code]); n++) {
      _length_code[length++] = code;
    }
  }
  //Assert (length == 256, "tr_static_init: length != 256");
  /* Note that the length 255 (match length 258) can be represented
   * in two different ways: code 284 + 5 bits or code 285, so we
   * overwrite length_code[255] to use the best encoding:
   */
  _length_code[length - 1] = code;

  /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < (1 << extra_dbits[code]); n++) {
      _dist_code[dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: dist != 256");
  dist >>= 7; /* from now on, all distances are divided by 128 */
  for (; code < D_CODES; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < (1 << (extra_dbits[code] - 7)); n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: 256+dist != 512");

  /* Construct the codes of the static literal tree */
  for (bits = 0; bits <= MAX_BITS; bits++) {
    bl_count[bits] = 0;
  }

  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1]/*.Len*/ = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1]/*.Len*/ = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  /* Codes 286 and 287 do not exist, but we must include them in the
   * tree construction to get a canonical Huffman tree (longest code
   * all ones)
   */
  gen_codes(static_ltree, L_CODES + 1, bl_count);

  /* The static distance tree is trivial: */
  for (n = 0; n < D_CODES; n++) {
    static_dtree[n * 2 + 1]/*.Len*/ = 5;
    static_dtree[n * 2]/*.Code*/ = bi_reverse(n, 5);
  }

  // Now data ready and we can init static trees
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0,          D_CODES, MAX_BITS);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0,         BL_CODES, MAX_BL_BITS);

  //static_init_done = true;
}


/* ===========================================================================
 * Initialize a new block.
 */
function init_block(s) {
  var n; /* iterates over tree elements */

  /* Initialize the trees. */
  for (n = 0; n < L_CODES;  n++) { s.dyn_ltree[n * 2]/*.Freq*/ = 0; }
  for (n = 0; n < D_CODES;  n++) { s.dyn_dtree[n * 2]/*.Freq*/ = 0; }
  for (n = 0; n < BL_CODES; n++) { s.bl_tree[n * 2]/*.Freq*/ = 0; }

  s.dyn_ltree[END_BLOCK * 2]/*.Freq*/ = 1;
  s.opt_len = s.static_len = 0;
  s.last_lit = s.matches = 0;
}


/* ===========================================================================
 * Flush the bit buffer and align the output on a byte boundary
 */
function bi_windup(s)
{
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    //put_byte(s, (Byte)s->bi_buf);
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
}

/* ===========================================================================
 * Copy a stored block, storing first the length and its
 * one's complement if requested.
 */
function copy_block(s, buf, len, header)
//DeflateState *s;
//charf    *buf;    /* the input data */
//unsigned len;     /* its length */
//int      header;  /* true if block header must be written */
{
  bi_windup(s);        /* align on byte boundary */

  if (header) {
    put_short(s, len);
    put_short(s, ~len);
  }
//  while (len--) {
//    put_byte(s, *buf++);
//  }
  utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
  s.pending += len;
}

/* ===========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
function smaller(tree, n, m, depth) {
  var _n2 = n * 2;
  var _m2 = m * 2;
  return (tree[_n2]/*.Freq*/ < tree[_m2]/*.Freq*/ ||
         (tree[_n2]/*.Freq*/ === tree[_m2]/*.Freq*/ && depth[n] <= depth[m]));
}

/* ===========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
function pqdownheap(s, tree, k)
//    deflate_state *s;
//    ct_data *tree;  /* the tree to restore */
//    int k;               /* node to move down */
{
  var v = s.heap[k];
  var j = k << 1;  /* left son of k */
  while (j <= s.heap_len) {
    /* Set j to the smallest of the two sons: */
    if (j < s.heap_len &&
      smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    /* Exit if v is smaller than both sons */
    if (smaller(tree, v, s.heap[j], s.depth)) { break; }

    /* Exchange v with the smallest son */
    s.heap[k] = s.heap[j];
    k = j;

    /* And continue down the tree, setting j to the left son of k */
    j <<= 1;
  }
  s.heap[k] = v;
}


// inlined manually
// var SMALLEST = 1;

/* ===========================================================================
 * Send the block data compressed using the given Huffman trees
 */
function compress_block(s, ltree, dtree)
//    deflate_state *s;
//    const ct_data *ltree; /* literal tree */
//    const ct_data *dtree; /* distance tree */
{
  var dist;           /* distance of matched string */
  var lc;             /* match length or unmatched char (if dist == 0) */
  var lx = 0;         /* running index in l_buf */
  var code;           /* the code to send */
  var extra;          /* number of extra bits to send */

  if (s.last_lit !== 0) {
    do {
      dist = (s.pending_buf[s.d_buf + lx * 2] << 8) | (s.pending_buf[s.d_buf + lx * 2 + 1]);
      lc = s.pending_buf[s.l_buf + lx];
      lx++;

      if (dist === 0) {
        send_code(s, lc, ltree); /* send a literal byte */
        //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
      } else {
        /* Here, lc is the match length - MIN_MATCH */
        code = _length_code[lc];
        send_code(s, code + LITERALS + 1, ltree); /* send the length code */
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);       /* send the extra length bits */
        }
        dist--; /* dist is now the match distance - 1 */
        code = d_code(dist);
        //Assert (code < D_CODES, "bad d_code");

        send_code(s, code, dtree);       /* send the distance code */
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);   /* send the extra distance bits */
        }
      } /* literal or match pair ? */

      /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
      //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
      //       "pendingBuf overflow");

    } while (lx < s.last_lit);
  }

  send_code(s, END_BLOCK, ltree);
}


/* ===========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
function build_tree(s, desc)
//    deflate_state *s;
//    tree_desc *desc; /* the tree descriptor */
{
  var tree     = desc.dyn_tree;
  var stree    = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var elems    = desc.stat_desc.elems;
  var n, m;          /* iterate over heap elements */
  var max_code = -1; /* largest code with non zero frequency */
  var node;          /* new node being created */

  /* Construct the initial heap, with least frequent element in
   * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
   * heap[0] is not used.
   */
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE;

  for (n = 0; n < elems; n++) {
    if (tree[n * 2]/*.Freq*/ !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;

    } else {
      tree[n * 2 + 1]/*.Len*/ = 0;
    }
  }

  /* The pkzip format requires that at least one distance code exists,
   * and that at least one bit should be sent even if there is only one
   * possible code. So to avoid special checks later on we force at least
   * two codes of non zero frequency.
   */
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = (max_code < 2 ? ++max_code : 0);
    tree[node * 2]/*.Freq*/ = 1;
    s.depth[node] = 0;
    s.opt_len--;

    if (has_stree) {
      s.static_len -= stree[node * 2 + 1]/*.Len*/;
    }
    /* node is 0 or 1 so it does not have extra bits */
  }
  desc.max_code = max_code;

  /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
   * establish sub-heaps of increasing lengths:
   */
  for (n = (s.heap_len >> 1/*int /2*/); n >= 1; n--) { pqdownheap(s, tree, n); }

  /* Construct the Huffman tree by repeatedly combining the least two
   * frequent nodes.
   */
  node = elems;              /* next internal node of the tree */
  do {
    //pqremove(s, tree, n);  /* n = node of least frequency */
    /*** pqremove ***/
    n = s.heap[1/*SMALLEST*/];
    s.heap[1/*SMALLEST*/] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1/*SMALLEST*/);
    /***/

    m = s.heap[1/*SMALLEST*/]; /* m = node of next least frequency */

    s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
    s.heap[--s.heap_max] = m;

    /* Create a new node father of n and m */
    tree[node * 2]/*.Freq*/ = tree[n * 2]/*.Freq*/ + tree[m * 2]/*.Freq*/;
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1]/*.Dad*/ = tree[m * 2 + 1]/*.Dad*/ = node;

    /* and insert the new node in the heap */
    s.heap[1/*SMALLEST*/] = node++;
    pqdownheap(s, tree, 1/*SMALLEST*/);

  } while (s.heap_len >= 2);

  s.heap[--s.heap_max] = s.heap[1/*SMALLEST*/];

  /* At this point, the fields freq and dad are set. We can now
   * generate the bit lengths.
   */
  gen_bitlen(s, desc);

  /* The field len is now set, we can generate the bit codes */
  gen_codes(tree, max_code, s.bl_count);
}


/* ===========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree.
 */
function scan_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree;   /* the tree to be scanned */
//    int max_code;    /* and its largest code of non zero frequency */
{
  var n;                     /* iterates over all tree elements */
  var prevlen = -1;          /* last emitted length */
  var curlen;                /* length of current code */

  var nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */

  var count = 0;             /* repeat count of the current code */
  var max_count = 7;         /* max repeat count */
  var min_count = 4;         /* min repeat count */

  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1]/*.Len*/ = 0xffff; /* guard */

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      s.bl_tree[curlen * 2]/*.Freq*/ += count;

    } else if (curlen !== 0) {

      if (curlen !== prevlen) { s.bl_tree[curlen * 2]/*.Freq*/++; }
      s.bl_tree[REP_3_6 * 2]/*.Freq*/++;

    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]/*.Freq*/++;

    } else {
      s.bl_tree[REPZ_11_138 * 2]/*.Freq*/++;
    }

    count = 0;
    prevlen = curlen;

    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}


/* ===========================================================================
 * Send a literal or distance tree in compressed form, using the codes in
 * bl_tree.
 */
function send_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree; /* the tree to be scanned */
//    int max_code;       /* and its largest code of non zero frequency */
{
  var n;                     /* iterates over all tree elements */
  var prevlen = -1;          /* last emitted length */
  var curlen;                /* length of current code */

  var nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */

  var count = 0;             /* repeat count of the current code */
  var max_count = 7;         /* max repeat count */
  var min_count = 4;         /* min repeat count */

  /* tree[max_code+1].Len = -1; */  /* guard already set */
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      do { send_code(s, curlen, s.bl_tree); } while (--count !== 0);

    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      //Assert(count >= 3 && count <= 6, " 3_6?");
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);

    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);

    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }

    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}


/* ===========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
function build_bl_tree(s) {
  var max_blindex;  /* index of last bit length code of non zero freq */

  /* Determine the bit length frequencies for literal and distance trees */
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

  /* Build the bit length tree: */
  build_tree(s, s.bl_desc);
  /* opt_len now includes the length of the tree representations, except
   * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
   */

  /* Determine the number of bit length codes to send. The pkzip format
   * requires that at least 4 bit length codes be sent. (appnote.txt says
   * 3 but the actual value used is 4.)
   */
  for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1]/*.Len*/ !== 0) {
      break;
    }
  }
  /* Update opt_len to include the bit length tree and counts */
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
  //        s->opt_len, s->static_len));

  return max_blindex;
}


/* ===========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
function send_all_trees(s, lcodes, dcodes, blcodes)
//    deflate_state *s;
//    int lcodes, dcodes, blcodes; /* number of codes for each tree */
{
  var rank;                    /* index in bl_order */

  //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
  //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
  //        "too many codes");
  //Tracev((stderr, "\nbl counts: "));
  send_bits(s, lcodes - 257, 5); /* not +255 as stated in appnote.txt */
  send_bits(s, dcodes - 1,   5);
  send_bits(s, blcodes - 4,  4); /* not -3 as stated in appnote.txt */
  for (rank = 0; rank < blcodes; rank++) {
    //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
    send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1]/*.Len*/, 3);
  }
  //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_ltree, lcodes - 1); /* literal tree */
  //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_dtree, dcodes - 1); /* distance tree */
  //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
}


/* ===========================================================================
 * Check if the data type is TEXT or BINARY, using the following algorithm:
 * - TEXT if the two conditions below are satisfied:
 *    a) There are no non-portable control characters belonging to the
 *       "black list" (0..6, 14..25, 28..31).
 *    b) There is at least one printable character belonging to the
 *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
 * - BINARY otherwise.
 * - The following partially-portable control characters form a
 *   "gray list" that is ignored in this detection algorithm:
 *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
 * IN assertion: the fields Freq of dyn_ltree are set.
 */
function detect_data_type(s) {
  /* black_mask is the bit mask of black-listed bytes
   * set bits 0..6, 14..25, and 28..31
   * 0xf3ffc07f = binary 11110011111111111100000001111111
   */
  var black_mask = 0xf3ffc07f;
  var n;

  /* Check for non-textual ("black-listed") bytes. */
  for (n = 0; n <= 31; n++, black_mask >>>= 1) {
    if ((black_mask & 1) && (s.dyn_ltree[n * 2]/*.Freq*/ !== 0)) {
      return Z_BINARY;
    }
  }

  /* Check for textual ("white-listed") bytes. */
  if (s.dyn_ltree[9 * 2]/*.Freq*/ !== 0 || s.dyn_ltree[10 * 2]/*.Freq*/ !== 0 ||
      s.dyn_ltree[13 * 2]/*.Freq*/ !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS; n++) {
    if (s.dyn_ltree[n * 2]/*.Freq*/ !== 0) {
      return Z_TEXT;
    }
  }

  /* There are no "black-listed" or "white-listed" bytes:
   * this stream either is empty or has tolerated ("gray-listed") bytes only.
   */
  return Z_BINARY;
}


var static_init_done = false;

/* ===========================================================================
 * Initialize the tree data structures for a new zlib stream.
 */
function _tr_init(s)
{

  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }

  s.l_desc  = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc  = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);

  s.bi_buf = 0;
  s.bi_valid = 0;

  /* Initialize the first block of the first file: */
  init_block(s);
}


/* ===========================================================================
 * Send a stored block
 */
function _tr_stored_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);    /* send block type */
  copy_block(s, buf, stored_len, true); /* with header */
}


/* ===========================================================================
 * Send one empty static block to give enough lookahead for inflate.
 * This takes 10 bits, of which 7 may remain in the bit buffer.
 */
function _tr_align(s) {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
}


/* ===========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and output the encoded block to the zip file.
 */
function _tr_flush_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block, or NULL if too old */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  var opt_lenb, static_lenb;  /* opt_len and static_len in bytes */
  var max_blindex = 0;        /* index of last bit length code of non zero freq */

  /* Build the Huffman trees unless a stored block is forced */
  if (s.level > 0) {

    /* Check if the file is binary or text */
    if (s.strm.data_type === Z_UNKNOWN) {
      s.strm.data_type = detect_data_type(s);
    }

    /* Construct the literal and distance trees */
    build_tree(s, s.l_desc);
    // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));

    build_tree(s, s.d_desc);
    // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));
    /* At this point, opt_len and static_len are the total bit lengths of
     * the compressed block data, excluding the tree representations.
     */

    /* Build the bit length tree for the above two trees, and get the index
     * in bl_order of the last bit length code to send.
     */
    max_blindex = build_bl_tree(s);

    /* Determine the best encoding. Compute the block lengths in bytes. */
    opt_lenb = (s.opt_len + 3 + 7) >>> 3;
    static_lenb = (s.static_len + 3 + 7) >>> 3;

    // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
    //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
    //        s->last_lit));

    if (static_lenb <= opt_lenb) { opt_lenb = static_lenb; }

  } else {
    // Assert(buf != (char*)0, "lost buf");
    opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
  }

  if ((stored_len + 4 <= opt_lenb) && (buf !== -1)) {
    /* 4: two words for the lengths */

    /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
     * Otherwise we can't have processed more than WSIZE input bytes since
     * the last block flush, because compression would have been
     * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
     * transform a block into a stored block.
     */
    _tr_stored_block(s, buf, stored_len, last);

  } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {

    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);

  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
  /* The above check is made mod 2^32, for files larger than 512 MB
   * and uLong implemented on 32 bits.
   */
  init_block(s);

  if (last) {
    bi_windup(s);
  }
  // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
  //       s->compressed_len-7*last));
}

/* ===========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
function _tr_tally(s, dist, lc)
//    deflate_state *s;
//    unsigned dist;  /* distance of matched string */
//    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */
{
  //var out_length, in_length, dcode;

  s.pending_buf[s.d_buf + s.last_lit * 2]     = (dist >>> 8) & 0xff;
  s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff;

  s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff;
  s.last_lit++;

  if (dist === 0) {
    /* lc is the unmatched char */
    s.dyn_ltree[lc * 2]/*.Freq*/++;
  } else {
    s.matches++;
    /* Here, lc is the match length - MIN_MATCH */
    dist--;             /* dist = match distance - 1 */
    //Assert((ush)dist < (ush)MAX_DIST(s) &&
    //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
    //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

    s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]/*.Freq*/++;
    s.dyn_dtree[d_code(dist) * 2]/*.Freq*/++;
  }

// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility

//#ifdef TRUNCATE_BLOCK
//  /* Try to guess if it is profitable to stop the current block here */
//  if ((s.last_lit & 0x1fff) === 0 && s.level > 2) {
//    /* Compute an upper bound for the compressed length */
//    out_length = s.last_lit*8;
//    in_length = s.strstart - s.block_start;
//
//    for (dcode = 0; dcode < D_CODES; dcode++) {
//      out_length += s.dyn_dtree[dcode*2]/*.Freq*/ * (5 + extra_dbits[dcode]);
//    }
//    out_length >>>= 3;
//    //Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
//    //       s->last_lit, in_length, out_length,
//    //       100L - out_length*100L/in_length));
//    if (s.matches < (s.last_lit>>1)/*int /2*/ && out_length < (in_length>>1)/*int /2*/) {
//      return true;
//    }
//  }
//#endif

  return (s.last_lit === s.lit_bufsize - 1);
  /* We avoid equality with lit_bufsize because of wraparound at 64K
   * on 16 bit machines and because stored blocks are restricted to
   * 64K-1 bytes.
   */
}

exports._tr_init  = _tr_init;
exports._tr_stored_block = _tr_stored_block;
exports._tr_flush_block  = _tr_flush_block;
exports._tr_tally = _tr_tally;
exports._tr_align = _tr_align;

},{"../utils/common":51}],61:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function ZStream() {
  /* next input byte */
  this.input = null; // JS specific, because we have no pointers
  this.next_in = 0;
  /* number of bytes available at input */
  this.avail_in = 0;
  /* total number of input bytes read so far */
  this.total_in = 0;
  /* next output byte should be put there */
  this.output = null; // JS specific, because we have no pointers
  this.next_out = 0;
  /* remaining free space at output */
  this.avail_out = 0;
  /* total number of bytes output so far */
  this.total_out = 0;
  /* last error message, NULL if no error */
  this.msg = ''/*Z_NULL*/;
  /* not visible by applications */
  this.state = null;
  /* best guess about the data type: binary or text */
  this.data_type = 2/*Z_UNKNOWN*/;
  /* adler32 value of the uncompressed data */
  this.adler = 0;
}

module.exports = ZStream;

},{}],62:[function(require,module,exports){
(function (process){
'use strict';

if (typeof process === 'undefined' ||
    !process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = { nextTick: nextTick };
} else {
  module.exports = process
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
  case 0:
  case 1:
    return process.nextTick(fn);
  case 2:
    return process.nextTick(function afterTickOne() {
      fn.call(null, arg1);
    });
  case 3:
    return process.nextTick(function afterTickTwo() {
      fn.call(null, arg1, arg2);
    });
  case 4:
    return process.nextTick(function afterTickThree() {
      fn.call(null, arg1, arg2, arg3);
    });
  default:
    args = new Array(len - 1);
    i = 0;
    while (i < args.length) {
      args[i++] = arguments[i];
    }
    return process.nextTick(function afterTick() {
      fn.apply(null, args);
    });
  }
}


}).call(this,require('_process'))
},{"_process":63}],63:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],64:[function(require,module,exports){
module.exports = require('./lib/_stream_duplex.js');

},{"./lib/_stream_duplex.js":65}],65:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

{
  // avoid scope creep, the keys array can then be collected
  var keys = objectKeys(Writable.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  }
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._writableState.highWaterMark;
  }
});

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  pna.nextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

Object.defineProperty(Duplex.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined || this._writableState === undefined) {
      return false;
    }
    return this._readableState.destroyed && this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (this._readableState === undefined || this._writableState === undefined) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
    this._writableState.destroyed = value;
  }
});

Duplex.prototype._destroy = function (err, cb) {
  this.push(null);
  this.end();

  pna.nextTick(cb, err);
};
},{"./_stream_readable":67,"./_stream_writable":69,"core-util-is":38,"inherits":46,"process-nextick-args":62}],66:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":68,"core-util-is":38,"inherits":46}],67:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;

var EElistenerCount = function (emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}

/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var debugUtil = require('util');
var debug = void 0;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var BufferList = require('./internal/streams/BufferList');
var destroyImpl = require('./internal/streams/destroy');
var StringDecoder;

util.inherits(Readable, Stream);

var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];

function prependListener(emitter, event, fn) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn);

  // This is a hack to make sure that our error handler is attached before any
  // userland ones.  NEVER DO THIS. This is here only because this code needs
  // to continue to work with older versions of Node.js that do not include
  // the prependListener() method. The goal is to eventually remove this hack.
  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
}

function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  var isDuplex = stream instanceof Duplex;

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var readableHwm = options.readableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;else this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // has it been destroyed
  this.destroyed = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options) {
    if (typeof options.read === 'function') this._read = options.read;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  }

  Stream.call(this);
}

Object.defineProperty(Readable.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined) {
      return false;
    }
    return this._readableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._readableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
  }
});

Readable.prototype.destroy = destroyImpl.destroy;
Readable.prototype._undestroy = destroyImpl.undestroy;
Readable.prototype._destroy = function (err, cb) {
  this.push(null);
  cb(err);
};

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;
  var skipChunkCheck;

  if (!state.objectMode) {
    if (typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer.from(chunk, encoding);
        encoding = '';
      }
      skipChunkCheck = true;
    }
  } else {
    skipChunkCheck = true;
  }

  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  return readableAddChunk(this, chunk, null, true, false);
};

function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
  var state = stream._readableState;
  if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else {
    var er;
    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
        chunk = _uint8ArrayToBuffer(chunk);
      }

      if (addToFront) {
        if (state.endEmitted) stream.emit('error', new Error('stream.unshift() after end event'));else addChunk(stream, state, chunk, true);
      } else if (state.ended) {
        stream.emit('error', new Error('stream.push() after EOF'));
      } else {
        state.reading = false;
        if (state.decoder && !encoding) {
          chunk = state.decoder.write(chunk);
          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
        } else {
          addChunk(stream, state, chunk, false);
        }
      }
    } else if (!addToFront) {
      state.reading = false;
    }
  }

  return needMoreData(state);
}

function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync) {
    stream.emit('data', chunk);
    stream.read(0);
  } else {
    // update the buffer info.
    state.length += state.objectMode ? 1 : chunk.length;
    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

    if (state.needReadable) emitReadable(stream);
  }
  maybeReadMore(stream, state);
}

function chunkInvalid(state, chunk) {
  var er;
  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  // If we're asking for more than the current hwm, then raise the hwm.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  // Don't have enough
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;

  if (n !== 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended) endReadable(this);
  }

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) pna.nextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    pna.nextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('_read() is not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : unpipe;
  if (state.endEmitted) pna.nextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable, unpipeInfo) {
    debug('onunpipe');
    if (readable === src) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
        unpipeInfo.hasUnpiped = true;
        cleanup();
      }
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', unpipe);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  // If the user pushes more data while we're writing to dest then we'll end up
  // in ondata again. However, we only want to increase awaitDrain once because
  // dest will only emit one 'drain' event for the multiple writes.
  // => Introduce a guard on increasing awaitDrain.
  var increasedAwaitDrain = false;
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    increasedAwaitDrain = false;
    var ret = dest.write(chunk);
    if (false === ret && !increasedAwaitDrain) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        increasedAwaitDrain = true;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;
  var unpipeInfo = { hasUnpiped: false };

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this, unpipeInfo);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++) {
      dests[i].emit('unpipe', this, unpipeInfo);
    }return this;
  }

  // try to find the right one.
  var index = indexOf(state.pipes, dest);
  if (index === -1) return this;

  state.pipes.splice(index, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this, unpipeInfo);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data') {
    // Start flowing on next tick if stream isn't explicitly paused
    if (this._readableState.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    var state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        pna.nextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    pna.nextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {}
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var _this = this;

  var state = this._readableState;
  var paused = false;

  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) _this.push(chunk);
    }

    _this.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = _this.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  for (var n = 0; n < kProxyEvents.length; n++) {
    stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
  }

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  this._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return this;
};

Object.defineProperty(Readable.prototype, 'readableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._readableState.highWaterMark;
  }
});

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;

  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = fromListPartial(n, state.buffer, state.decoder);
  }

  return ret;
}

// Extracts only enough buffered data to satisfy the amount requested.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromListPartial(n, list, hasStrings) {
  var ret;
  if (n < list.head.data.length) {
    // slice is the same for buffers and strings
    ret = list.head.data.slice(0, n);
    list.head.data = list.head.data.slice(n);
  } else if (n === list.head.data.length) {
    // first chunk is a perfect match
    ret = list.shift();
  } else {
    // result spans more than one buffer
    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
  }
  return ret;
}

// Copies a specified amount of characters from the list of buffered data
// chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBufferString(n, list) {
  var p = list.head;
  var c = 1;
  var ret = p.data;
  n -= ret.length;
  while (p = p.next) {
    var str = p.data;
    var nb = n > str.length ? str.length : n;
    if (nb === str.length) ret += str;else ret += str.slice(0, n);
    n -= nb;
    if (n === 0) {
      if (nb === str.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = str.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

// Copies a specified amount of bytes from the list of buffered data chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBuffer(n, list) {
  var ret = Buffer.allocUnsafe(n);
  var p = list.head;
  var c = 1;
  p.data.copy(ret);
  n -= p.data.length;
  while (p = p.next) {
    var buf = p.data;
    var nb = n > buf.length ? buf.length : n;
    buf.copy(ret, ret.length - n, 0, nb);
    n -= nb;
    if (n === 0) {
      if (nb === buf.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = buf.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    pna.nextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./_stream_duplex":65,"./internal/streams/BufferList":70,"./internal/streams/destroy":71,"./internal/streams/stream":72,"_process":63,"core-util-is":38,"events":40,"inherits":46,"isarray":48,"process-nextick-args":62,"safe-buffer":77,"string_decoder/":79,"util":34}],68:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);

function afterTransform(er, data) {
  var ts = this._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) {
    return this.emit('error', new Error('write callback called multiple times'));
  }

  ts.writechunk = null;
  ts.writecb = null;

  if (data != null) // single equals check for both `null` and `undefined`
    this.push(data);

  cb(er);

  var rs = this._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    this._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = {
    afterTransform: afterTransform.bind(this),
    needTransform: false,
    transforming: false,
    writecb: null,
    writechunk: null,
    writeencoding: null
  };

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  // When the writable side finishes, then flush out anything remaining.
  this.on('prefinish', prefinish);
}

function prefinish() {
  var _this = this;

  if (typeof this._flush === 'function') {
    this._flush(function (er, data) {
      done(_this, er, data);
    });
  } else {
    done(this, null, null);
  }
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('_transform() is not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

Transform.prototype._destroy = function (err, cb) {
  var _this2 = this;

  Duplex.prototype._destroy.call(this, err, function (err2) {
    cb(err2);
    _this2.emit('close');
  });
};

function done(stream, er, data) {
  if (er) return stream.emit('error', er);

  if (data != null) // single equals check for both `null` and `undefined`
    stream.push(data);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  if (stream._writableState.length) throw new Error('Calling transform done when ws.length != 0');

  if (stream._transformState.transforming) throw new Error('Calling transform done when still transforming');

  return stream.push(null);
}
},{"./_stream_duplex":65,"core-util-is":38,"inherits":46}],69:[function(require,module,exports){
(function (process,global,setImmediate){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

module.exports = Writable;

/* <replacement> */
function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;
  this.finish = function () {
    onCorkedFinish(_this, state);
  };
}
/* </replacement> */

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}

/*</replacement>*/

var destroyImpl = require('./internal/streams/destroy');

util.inherits(Writable, Stream);

function nop() {}

function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  var isDuplex = stream instanceof Duplex;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var writableHwm = options.writableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;else this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // if _final has been called
  this.finalCalled = false;

  // drain event flag.
  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // has it been destroyed
  this.destroyed = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function getBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
    });
  } catch (_) {}
})();

// Test _writableState for inheritance to account for Duplex streams,
// whose prototype chain only points to Readable.
var realHasInstance;
if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  realHasInstance = Function.prototype[Symbol.hasInstance];
  Object.defineProperty(Writable, Symbol.hasInstance, {
    value: function (object) {
      if (realHasInstance.call(this, object)) return true;
      if (this !== Writable) return false;

      return object && object._writableState instanceof WritableState;
    }
  });
} else {
  realHasInstance = function (object) {
    return object instanceof this;
  };
}

function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.

  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.
  if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
    return new Writable(options);
  }

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;

    if (typeof options.final === 'function') this._final = options.final;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  pna.nextTick(cb, er);
}

// Checks that a user-supplied chunk is valid, especially for the particular
// mode the stream is in. Currently this means that `null` is never accepted
// and undefined/non-string values are only allowed in object mode.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;

  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    pna.nextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;
  var isBuf = !state.objectMode && _isUint8Array(chunk);

  if (isBuf && !Buffer.isBuffer(chunk)) {
    chunk = _uint8ArrayToBuffer(chunk);
  }

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = Buffer.from(chunk, encoding);
  }
  return chunk;
}

Object.defineProperty(Writable.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._writableState.highWaterMark;
  }
});

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
  if (!isBuf) {
    var newChunk = decodeChunk(state, chunk, encoding);
    if (chunk !== newChunk) {
      isBuf = true;
      encoding = 'buffer';
      chunk = newChunk;
    }
  }
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = {
      chunk: chunk,
      encoding: encoding,
      isBuf: isBuf,
      callback: cb,
      next: null
    };
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;

  if (sync) {
    // defer the callback if we are being called synchronously
    // to avoid piling up things on the stack
    pna.nextTick(cb, er);
    // this can emit finish, and it will always happen
    // after error
    pna.nextTick(finishMaybe, stream, state);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  } else {
    // the caller expect this to happen before if
    // it is async
    cb(er);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
    // this can emit finish, but finish must
    // always follow error
    finishMaybe(stream, state);
  }
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    var allBuffers = true;
    while (entry) {
      buffer[count] = entry;
      if (!entry.isBuf) allBuffers = false;
      entry = entry.next;
      count += 1;
    }
    buffer.allBuffers = allBuffers;

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
    state.bufferedRequestCount = 0;
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      state.bufferedRequestCount--;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('_write() is not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}
function callFinal(stream, state) {
  stream._final(function (err) {
    state.pendingcb--;
    if (err) {
      stream.emit('error', err);
    }
    state.prefinished = true;
    stream.emit('prefinish');
    finishMaybe(stream, state);
  });
}
function prefinish(stream, state) {
  if (!state.prefinished && !state.finalCalled) {
    if (typeof stream._final === 'function') {
      state.pendingcb++;
      state.finalCalled = true;
      pna.nextTick(callFinal, stream, state);
    } else {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    prefinish(stream, state);
    if (state.pendingcb === 0) {
      state.finished = true;
      stream.emit('finish');
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) pna.nextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

function onCorkedFinish(corkReq, state, err) {
  var entry = corkReq.entry;
  corkReq.entry = null;
  while (entry) {
    var cb = entry.callback;
    state.pendingcb--;
    cb(err);
    entry = entry.next;
  }
  if (state.corkedRequestsFree) {
    state.corkedRequestsFree.next = corkReq;
  } else {
    state.corkedRequestsFree = corkReq;
  }
}

Object.defineProperty(Writable.prototype, 'destroyed', {
  get: function () {
    if (this._writableState === undefined) {
      return false;
    }
    return this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._writableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._writableState.destroyed = value;
  }
});

Writable.prototype.destroy = destroyImpl.destroy;
Writable.prototype._undestroy = destroyImpl.undestroy;
Writable.prototype._destroy = function (err, cb) {
  this.end();
  cb(err);
};
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("timers").setImmediate)
},{"./_stream_duplex":65,"./internal/streams/destroy":71,"./internal/streams/stream":72,"_process":63,"core-util-is":38,"inherits":46,"process-nextick-args":62,"safe-buffer":77,"timers":80,"util-deprecate":81}],70:[function(require,module,exports){
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Buffer = require('safe-buffer').Buffer;
var util = require('util');

function copyBuffer(src, target, offset) {
  src.copy(target, offset);
}

module.exports = function () {
  function BufferList() {
    _classCallCheck(this, BufferList);

    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  BufferList.prototype.push = function push(v) {
    var entry = { data: v, next: null };
    if (this.length > 0) this.tail.next = entry;else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function unshift(v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function shift() {
    if (this.length === 0) return;
    var ret = this.head.data;
    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function clear() {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function join(s) {
    if (this.length === 0) return '';
    var p = this.head;
    var ret = '' + p.data;
    while (p = p.next) {
      ret += s + p.data;
    }return ret;
  };

  BufferList.prototype.concat = function concat(n) {
    if (this.length === 0) return Buffer.alloc(0);
    if (this.length === 1) return this.head.data;
    var ret = Buffer.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      copyBuffer(p.data, ret, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  };

  return BufferList;
}();

if (util && util.inspect && util.inspect.custom) {
  module.exports.prototype[util.inspect.custom] = function () {
    var obj = util.inspect({ length: this.length });
    return this.constructor.name + ' ' + obj;
  };
}
},{"safe-buffer":77,"util":34}],71:[function(require,module,exports){
'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

// undocumented cb() API, needed for core, not for public API
function destroy(err, cb) {
  var _this = this;

  var readableDestroyed = this._readableState && this._readableState.destroyed;
  var writableDestroyed = this._writableState && this._writableState.destroyed;

  if (readableDestroyed || writableDestroyed) {
    if (cb) {
      cb(err);
    } else if (err && (!this._writableState || !this._writableState.errorEmitted)) {
      pna.nextTick(emitErrorNT, this, err);
    }
    return this;
  }

  // we set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  if (this._readableState) {
    this._readableState.destroyed = true;
  }

  // if this is a duplex stream mark the writable part as destroyed as well
  if (this._writableState) {
    this._writableState.destroyed = true;
  }

  this._destroy(err || null, function (err) {
    if (!cb && err) {
      pna.nextTick(emitErrorNT, _this, err);
      if (_this._writableState) {
        _this._writableState.errorEmitted = true;
      }
    } else if (cb) {
      cb(err);
    }
  });

  return this;
}

function undestroy() {
  if (this._readableState) {
    this._readableState.destroyed = false;
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
  }

  if (this._writableState) {
    this._writableState.destroyed = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finished = false;
    this._writableState.errorEmitted = false;
  }
}

function emitErrorNT(self, err) {
  self.emit('error', err);
}

module.exports = {
  destroy: destroy,
  undestroy: undestroy
};
},{"process-nextick-args":62}],72:[function(require,module,exports){
module.exports = require('events').EventEmitter;

},{"events":40}],73:[function(require,module,exports){
module.exports = require('./readable').PassThrough

},{"./readable":74}],74:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":65,"./lib/_stream_passthrough.js":66,"./lib/_stream_readable.js":67,"./lib/_stream_transform.js":68,"./lib/_stream_writable.js":69}],75:[function(require,module,exports){
module.exports = require('./readable').Transform

},{"./readable":74}],76:[function(require,module,exports){
module.exports = require('./lib/_stream_writable.js');

},{"./lib/_stream_writable.js":69}],77:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */
var buffer = require('buffer')
var Buffer = buffer.Buffer

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports)
  exports.Buffer = SafeBuffer
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
}

},{"buffer":37}],78:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":40,"inherits":46,"readable-stream/duplex.js":64,"readable-stream/passthrough.js":73,"readable-stream/readable.js":74,"readable-stream/transform.js":75,"readable-stream/writable.js":76}],79:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
/*</replacement>*/

var isEncoding = Buffer.isEncoding || function (encoding) {
  encoding = '' + encoding;
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};

function _normalizeEncoding(enc) {
  if (!enc) return 'utf8';
  var retried;
  while (true) {
    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return 'utf8';
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return 'utf16le';
      case 'latin1':
      case 'binary':
        return 'latin1';
      case 'base64':
      case 'ascii':
      case 'hex':
        return enc;
      default:
        if (retried) return; // undefined
        enc = ('' + enc).toLowerCase();
        retried = true;
    }
  }
};

// Do not cache `Buffer.isEncoding` when checking encoding names as some
// modules monkey-patch it to support additional encodings
function normalizeEncoding(enc) {
  var nenc = _normalizeEncoding(enc);
  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
  return nenc || enc;
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters.
exports.StringDecoder = StringDecoder;
function StringDecoder(encoding) {
  this.encoding = normalizeEncoding(encoding);
  var nb;
  switch (this.encoding) {
    case 'utf16le':
      this.text = utf16Text;
      this.end = utf16End;
      nb = 4;
      break;
    case 'utf8':
      this.fillLast = utf8FillLast;
      nb = 4;
      break;
    case 'base64':
      this.text = base64Text;
      this.end = base64End;
      nb = 3;
      break;
    default:
      this.write = simpleWrite;
      this.end = simpleEnd;
      return;
  }
  this.lastNeed = 0;
  this.lastTotal = 0;
  this.lastChar = Buffer.allocUnsafe(nb);
}

StringDecoder.prototype.write = function (buf) {
  if (buf.length === 0) return '';
  var r;
  var i;
  if (this.lastNeed) {
    r = this.fillLast(buf);
    if (r === undefined) return '';
    i = this.lastNeed;
    this.lastNeed = 0;
  } else {
    i = 0;
  }
  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
  return r || '';
};

StringDecoder.prototype.end = utf8End;

// Returns only complete characters in a Buffer
StringDecoder.prototype.text = utf8Text;

// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
StringDecoder.prototype.fillLast = function (buf) {
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
  this.lastNeed -= buf.length;
};

// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
// continuation byte. If an invalid byte is detected, -2 is returned.
function utf8CheckByte(byte) {
  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
  return byte >> 6 === 0x02 ? -1 : -2;
}

// Checks at most 3 bytes at the end of a Buffer in order to detect an
// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
// needed to complete the UTF-8 character (if applicable) are returned.
function utf8CheckIncomplete(self, buf, i) {
  var j = buf.length - 1;
  if (j < i) return 0;
  var nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 1;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 2;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) {
      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
    }
    return nb;
  }
  return 0;
}

// Validates as many continuation bytes for a multi-byte UTF-8 character as
// needed or are available. If we see a non-continuation byte where we expect
// one, we "replace" the validated continuation bytes we've seen so far with
// a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
// behavior. The continuation byte check is included three times in the case
// where all of the continuation bytes for a character exist in the same buffer.
// It is also done this way as a slight performance increase instead of using a
// loop.
function utf8CheckExtraBytes(self, buf, p) {
  if ((buf[0] & 0xC0) !== 0x80) {
    self.lastNeed = 0;
    return '\ufffd';
  }
  if (self.lastNeed > 1 && buf.length > 1) {
    if ((buf[1] & 0xC0) !== 0x80) {
      self.lastNeed = 1;
      return '\ufffd';
    }
    if (self.lastNeed > 2 && buf.length > 2) {
      if ((buf[2] & 0xC0) !== 0x80) {
        self.lastNeed = 2;
        return '\ufffd';
      }
    }
  }
}

// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
function utf8FillLast(buf) {
  var p = this.lastTotal - this.lastNeed;
  var r = utf8CheckExtraBytes(this, buf, p);
  if (r !== undefined) return r;
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, p, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, p, 0, buf.length);
  this.lastNeed -= buf.length;
}

// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
// partial character, the character's bytes are buffered until the required
// number of bytes are available.
function utf8Text(buf, i) {
  var total = utf8CheckIncomplete(this, buf, i);
  if (!this.lastNeed) return buf.toString('utf8', i);
  this.lastTotal = total;
  var end = buf.length - (total - this.lastNeed);
  buf.copy(this.lastChar, 0, end);
  return buf.toString('utf8', i, end);
}

// For UTF-8, a replacement character is added when ending on a partial
// character.
function utf8End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + '\ufffd';
  return r;
}

// UTF-16LE typically needs two bytes per character, but even if we have an even
// number of bytes available, we need to check if we end on a leading/high
// surrogate. In that case, we need to wait for the next two bytes in order to
// decode the last character properly.
function utf16Text(buf, i) {
  if ((buf.length - i) % 2 === 0) {
    var r = buf.toString('utf16le', i);
    if (r) {
      var c = r.charCodeAt(r.length - 1);
      if (c >= 0xD800 && c <= 0xDBFF) {
        this.lastNeed = 2;
        this.lastTotal = 4;
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
        return r.slice(0, -1);
      }
    }
    return r;
  }
  this.lastNeed = 1;
  this.lastTotal = 2;
  this.lastChar[0] = buf[buf.length - 1];
  return buf.toString('utf16le', i, buf.length - 1);
}

// For UTF-16LE we do not explicitly append special replacement characters if we
// end on a partial character, we simply let v8 handle that.
function utf16End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) {
    var end = this.lastTotal - this.lastNeed;
    return r + this.lastChar.toString('utf16le', 0, end);
  }
  return r;
}

function base64Text(buf, i) {
  var n = (buf.length - i) % 3;
  if (n === 0) return buf.toString('base64', i);
  this.lastNeed = 3 - n;
  this.lastTotal = 3;
  if (n === 1) {
    this.lastChar[0] = buf[buf.length - 1];
  } else {
    this.lastChar[0] = buf[buf.length - 2];
    this.lastChar[1] = buf[buf.length - 1];
  }
  return buf.toString('base64', i, buf.length - n);
}

function base64End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
  return r;
}

// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
function simpleWrite(buf) {
  return buf.toString(this.encoding);
}

function simpleEnd(buf) {
  return buf && buf.length ? this.write(buf) : '';
}
},{"safe-buffer":77}],80:[function(require,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,require("timers").setImmediate,require("timers").clearImmediate)
},{"process/browser.js":63,"timers":80}],81:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],82:[function(require,module,exports){
arguments[4][28][0].apply(exports,arguments)
},{"dup":28}],83:[function(require,module,exports){
arguments[4][29][0].apply(exports,arguments)
},{"dup":29}],84:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"./support/isBuffer":83,"_process":63,"dup":30,"inherits":82}],85:[function(require,module,exports){
// Simple OOP Tools for Node.JS
// Copyright (c) 2014 Joseph Huckaby
// Released under the MIT License

var util = require("util");
var events = require("events");

exports.create = function create(members) {
	// create new class using php-style syntax (sort of)
	if (!members) members = {};
	
	// setup constructor
	var constructor = null;
	
	// inherit from parent class
	if (members.__parent) {
		if (members.__construct) {
			// explicit constructor passed in
			constructor = members.__construct;
		}
		else {
			// inherit parent's constructor
			var parent = members.__parent;
			constructor = function() {
				var args = Array.prototype.slice.call(arguments);
				parent.apply( this, args );
			};
		}
		
		// inherit rest of parent members
		util.inherits(constructor, members.__parent);
		delete members.__parent;
	}
	else {
		// create new base class
		constructor = members.__construct || function() {};
	}
	delete members.__construct;
	
	// handle static variables
	if (members.__static) {
		for (var key in members.__static) {
			constructor[key] = members.__static[key];
		}
		delete members.__static;
	}
	
	// all classes are event emitters unless explicitly disabled
	if (members.__events !== false) {
		if (!members.__mixins) members.__mixins = [];
		if (members.__mixins.indexOf(events.EventEmitter) == -1) {
			members.__mixins.push( events.EventEmitter );
		}
	}
	delete members.__events;
	
	// handle mixins
	if (members.__mixins) {
		for (var idx = 0, len = members.__mixins.length; idx < len; idx++) {
			var class_obj = members.__mixins[idx];
			
			for (var key in class_obj.prototype) {
				if (!key.match(/^__/) && (typeof(constructor.prototype[key]) == 'undefined')) {
					constructor.prototype[key] = class_obj.prototype[key];
				}
			}
			var static_members = class_obj.__static;
			if (static_members) {
				for (var key in static_members) {
					if (typeof(constructor[key]) == 'undefined') constructor[key] = static_members[key];
				}
			}
		} // foreach mixin
		delete members.__mixins;
	} // mixins
	
	// handle promisify (node 8+)
	if (members.__promisify && util.promisify) {
		if (Array.isArray(members.__promisify)) {
			// promisify some
			members.__promisify.forEach( function(key) {
				if (typeof(members[key]) == 'function') {
					members[key] = util.promisify( members[key] );
				}
			} );
		}
		else {
			// promisify all
			for (var key in members) {
				if (!key.match(/^__/) && (typeof(members[key]) == 'function')) {
					members[key] = util.promisify( members[key] );
				}
			}
		}
		delete members.__promisify;
	}
	
	// fill prototype members
	for (var key in members) {
		constructor.prototype[key] = members[key];
	}
	
	// return completed class definition
	return constructor;
};

},{"events":40,"util":84}],86:[function(require,module,exports){
(function (process){
// High Resolution Performance Tracker for Node.JS
// Copyright (c) 2014 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	perf: null,
	counters: null,
	scale: 1000, // milliseconds
	precision: 1000, // 3 digits
	totalKey: 'total', // where to store the total
	minMax: false, // track min/avg/max per metric
	
	__events: false,
	
	__construct: function() {
		// class constructor
		this.reset();
	},
	
	reset: function() {
		// reset everything
		this.perf = {};
		this.counters = {};
	},
	
	setScale: function(scale) { 
		// set scale for time measurements
		// 1000000000 == nanoseconds
		// 1000000 == microseconds
		// 1000 == milliseconds
		// 1 == seconds
		this.scale = scale; 
	},
	
	setPrecision: function(precision) {
		// set precision for measurements
		// 1 == integers only
		// 10 == 1 digit after the decimal
		// 100 == 2 digits after the decimal
		// 1000 == 3 digits after the decimal
		this.precision = precision; 
	},
	
	calcElapsed: function(start) {
		// calculate elapsed time using process.hrtime() (nanoseconds)
		// then convert to our scale and precision
		var diff = process.hrtime( start );
		var nano = diff[0] * 1e9 + diff[1];
		
		// apply scale transform
		var value = nano / (1000000000 / this.scale);
		
		return value;
	},
	
	begin: function(id) {
		// begin tracking metric
		// ID defaults to 't' for total
		if (!id) id = this.totalKey;
		var now = process.hrtime();
		
		// only allow 't' begin to be called once per object (unless it is reset)
		if ((id == this.totalKey) && this.perf[id]) return;
		
		// set start time
		if (!this.perf[id]) this.perf[id] = { elapsed: 0 };
		this.perf[id].start = now;
		if (this.perf[id].end) delete this.perf[id].end;
		
		return new PerfMetric(this, id, now);
	},
	
	end: function(id, start) {
		// mark end of metric
		// ID defaults to 't' for total
		if (!id) id = this.totalKey;
		var now = process.hrtime();
		
		if (!this.perf[id] && !start) return;
		if (!this.perf[id]) this.perf[id] = { elapsed: 0 };
		var obj = this.perf[id];
		
		if (start) obj.start = start;
		obj.end = now;
		if (!obj.start) obj.start = obj.end;
		
		var elapsed = Array.isArray(obj.start) ? 
			this.calcElapsed( obj.start ) : 0;
		
		if (id == this.totalKey) {
			// end of all tracking
			// set elapsed instead of incrementing, to prevent bugs with calling end() twice.
			obj.elapsed = elapsed;
		}
		else {
			// stopped tracking single metric
			// increment elapsed to allow for multiple trackings on same metric
			obj.elapsed += elapsed;
		}
		
		if (this.minMax) {
			if (!obj.count || (elapsed < obj.min)) obj.min = elapsed;
			if (!obj.count || (elapsed > obj.max)) obj.max = elapsed;
			if (!obj.count) obj.count = 0;
			obj.count++;
		}
		
		return this.formatValue(elapsed);
	},
	
	count: function(id, amount) {
		// increment (or decrement) simple counter, unrelated to time measurement
		if (typeof(amount) == 'undefined') amount = 1;
		if (!(id in this.counters)) this.counters[id] = amount;
		else this.counters[id] += amount;
	},
	
	metrics: function() {
		// get all perf metrics and counters in simple object format
		var out = {};
		
		// make sure total metric is ended
		this.end();
		
		// generate object containing only elapsed times of each
		for (var id in this.perf) {
			if (this.perf[id].end) {
				out[id] = this.elapsed(id, true);
			}
		}
		
		return {
			scale: this.scale,
			perf: out,
			counters: this.counters
		};
	},
	
	json: function() {
		// return a JSON string with perf metrics and counters separated out
		return JSON.stringify( this.metrics() );
	},
	
	summarize: function(prefix) {
		// Summarize performance metrics in query string format
		var pairs = [];
		var metrics = this.metrics();
		if (!prefix) prefix = '';
		
		// start with scale
		pairs.push( 'scale=' + this.scale );
		
		// make sure total is always right after scale
		pairs.push( 'total=' + metrics.perf.total );
		delete metrics.perf.total;
		
		// build summary string of other metrics
		for (var id in metrics.perf) {
			pairs.push( prefix + id + '=' + metrics.perf[id] );
		}
		
		// add counters if applicable, prefix each with c_
		for (var id in metrics.counters) {
			var disp_id = id.match(/^c_/) ? id : ('c_'+id);
			pairs.push( disp_id + '=' + metrics.counters[id] );
		}
		
		return pairs.join('&');
	},
	
	elapsed: function(id, display_format) {
		// get elapsed seconds from given metric
		if (!this.perf[id]) return 0;
		if (!this.perf[id].elapsed) return 0;
		
		if (display_format) {
			return this.formatValue( this.perf[id].elapsed );
		}
		else return this.perf[id].elapsed;
	},
	
	get: function() {
		// Get raw perf object
		return this.perf;
	},
	
	getCounters: function() {
		// Get raw counters object
		return this.counters;
	},
	
	formatValue: function(value) {
		// format value according to our precision
		return Math.floor(value * this.precision) / this.precision;
	},
	
	getMinMaxMetrics: function() {
		// get min/max/avg/count/total for each named metric (omits total)
		// special 'minMax' mode must be enabled
		if (!this.minMax) return {};
		var metrics = {};
		
		for (var id in this.perf) {
			var obj = this.perf[id];
			if (obj.end && (id != this.totalKey)) {
				if (!obj.elapsed) obj.elapsed = 0;
				metrics[id] = {
					min: this.formatValue( obj.min || 0 ),
					max: this.formatValue( obj.max || 0 ),
					total: this.formatValue( obj.elapsed ),
					count: obj.count || 0,
					avg: this.formatValue( obj.elapsed / (obj.count || 1) )
				};
			}
		}
		
		return metrics;
	},
	
	import: function(perf, prefix) {
		// import perf metrics from another object (and adjust scale to match)
		// can be a pixl-perf instance, or an object from calling metrics()
		if (!prefix) prefix = '';
		
		if (perf.perf) {
			for (var key in perf.perf) {
				if (key != this.totalKey) {
					var pkey = prefix + key;
					if (!this.perf[pkey]) this.perf[pkey] = {};
					if (!this.perf[pkey].end) this.perf[pkey].end = 1;
					if (!this.perf[pkey].elapsed) this.perf[pkey].elapsed = 0;
					var elapsed = (typeof(perf.perf[key]) == 'number') ? perf.perf[key] : perf.perf[key].elapsed;
					this.perf[pkey].elapsed += (elapsed / (perf.scale / this.scale)) || 0;
					
					if (this.minMax && perf.minMax) {
						// both source and dest have minMax, so import entire min/max/count
						var adj_min = perf.perf[key].min / (perf.scale / this.scale);
						if (!this.perf[pkey].count || (adj_min < this.perf[pkey].min)) this.perf[pkey].min = adj_min;
						
						var adj_max = perf.perf[key].max / (perf.scale / this.scale);
						if (!this.perf[pkey].count || (adj_max > this.perf[pkey].max)) this.perf[pkey].max = adj_max;
						
						if (!this.perf[pkey].count) this.perf[pkey].count = 0;
						this.perf[pkey].count += perf.perf[key].count || 0;
					} // minMax
					else if (this.minMax) {
						// source has no minMax, but dest does, so just import their elapsed as one measurement
						var adj_elapsed = (elapsed / (perf.scale / this.scale)) || 0;
						if (!this.perf[pkey].count || (adj_elapsed < this.perf[pkey].min)) this.perf[pkey].min = adj_elapsed;
						if (!this.perf[pkey].count || (adj_elapsed > this.perf[pkey].max)) this.perf[pkey].max = adj_elapsed;
						if (!this.perf[pkey].count) this.perf[pkey].count = 0;
						this.perf[pkey].count++;
					}
				} // not totalKey
			} // foreach perf
		} // perf.perf
		
		if (perf.counters) {
			for (var key in perf.counters) {
				var pkey = prefix + key;
				this.count( pkey, perf.counters[key] );
			}
		}
	}
	
});

// A PerfMetric promise is returned from each call to begin(),
// so the user can track multiple simultaneous metrics with the same key.

var PerfMetric = Class.create({
	
	__events: false,
	
	perf: null,
	id: '',
	start: 0,
	
	__construct: function(perf, id, start) {
		// class constructor
		this.perf = perf;
		this.id = id;
		this.start = start;
	},
	
	end: function() {
		// end tracking
		return this.perf.end(this.id, this.start);
	}
	
});

}).call(this,require('_process'))
},{"_process":63,"pixl-class":85}]},{},[1]);
