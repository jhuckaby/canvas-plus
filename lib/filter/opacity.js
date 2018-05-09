// canvas-plus - Image Transformation Engine
// Opacity Filter Mixin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	opacity: function(opts) {
		// fade canvas out to transparent or background color
		// specify opacity from 0 to 1, and optional background color
		// { opacity, background }
		var self = this;
		this.clearLastError();
		
		if (typeof(opts) == 'number') {
			opts = { opacity: opts };
		}
		if (!opts || !("opacity" in opts)) {
			return this.doError('opacity', "Opacity was not specified");
		}
		
		opts = this.copyHash( opts || {} );
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.logDebug(5, "Fading canvas (via FitPad/Shrink resize)", opts);
		
		// use shrink fitpad resize
		opts.resizeMode = 'FitPad';
		opts.resizeDirection = 'Shrink';
		opts.width = this.width();
		opts.height = this.height();
		
		return this.resize(opts);
	}
	
});
