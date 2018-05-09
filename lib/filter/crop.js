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
