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
