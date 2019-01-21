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
		// opts: { crushRGB, crushAlpha, dither, fallback }
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
		var crush_alpha = opts.crushAlpha || 0;
		var crush_rgb = opts.crushRGB || 0;
		var dither = opts.dither || false;
		
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
		var index_ok = true;
		var source_data = imgData.data;
		var unique_colors = {};
		var palette_offset = 0;
		var palette = [];
		var pixel_offset = 0;
		var pixel_data = new Uint8Array( width * height );
		var pixel = 0;
		var red, green, blue, alpha;
		var dmod, doffset;
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
						if (red < 255) red = red - (red % crush_rgb);
						if (green < 255) green = green - (green % crush_rgb);
						if (blue < 255) blue = blue - (blue % crush_rgb);
					}
				}
				if (crush_alpha && (alpha < 255)) {
					alpha = alpha - (alpha % crush_alpha);
				}
				
				pixel = ((red << 8 | green) << 8 | blue) << 8 | alpha;
				
				if (!(pixel in unique_colors)) {
					if (palette_offset < 256) {
						unique_colors[pixel] = palette_offset;
						palette[palette_offset++] = {
							r: red, g: green, b: blue, a: alpha, uint32: pixel
						};
					}
					else {
						x = xmax;
						y = ymax;
						index_ok = false;
						continue;
					}
				}
				pixel_data[idx] = unique_colors[pixel];
				pixel_offset += 4;
				idx++;
			} // x loop
		} // y loop
		
		if (!index_ok) {
			this.perf.end('quantizeFast');
			if (opts.fallback) {
				this.logDebug(3, "Too many unique colors for fast quantize, switching to slow mode");
				return this.quantize(opts);
			}
			else {
				return this.doError('quantize', "Too many unique colors for fast quantize, please crush further.");
			}
		}
		
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
