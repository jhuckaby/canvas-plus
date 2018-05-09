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
