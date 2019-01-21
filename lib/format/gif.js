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
