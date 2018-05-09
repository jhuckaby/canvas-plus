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
