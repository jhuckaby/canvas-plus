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
