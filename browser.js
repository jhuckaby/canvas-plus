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
