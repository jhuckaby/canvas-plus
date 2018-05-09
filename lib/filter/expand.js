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
