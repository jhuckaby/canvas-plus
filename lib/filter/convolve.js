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
