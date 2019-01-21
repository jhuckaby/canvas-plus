// canvas-plus - Image Transformation Engine
// Border Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	border: function(opts) {
		// render border around canvas
		// special opts: size, color, mode (inside, center, outside)
		var self = this;
		var result;
		this.clearLastError();
		
		result = this.requireRGBA();
		if (result.isError) return result;
		
		if (!opts) {
			return this.doError('border', "Must specify options object");
		}
		
		opts = this.copyHash( opts || {} );
		
		if (!opts.mode) opts.mode = 'center';
		if (!opts.size || !opts.color) {
			return this.doError('border', "Must specify size and color");
		}
		
		this.perf.begin('border');
		this.logDebug(5, "Rendering border around canvas", opts);
		
		// see if we need to expand the canvas
		if (opts.mode.match(/(center|outside)/i)) {
			var expand_by = opts.size * 2;
			if (opts.mode.match(/(center)/i)) expand_by = Math.floor( expand_by / 2 );
			
			if (expand_by) {
				// yes expand
				result = this.expand({
					width: expand_by,
					height: expand_by,
					gravity: 'center'
				});
				if (result.isError) return result;
			}
		}
		
		// draw border
		var ctx = this.context;
		var width = this.get('width');
		var height = this.get('height');
		var size = opts.size;
		
		ctx.save();
		// ctx.globalCompositeOperation = 'copy';
		ctx.fillStyle = opts.color;
		ctx.fillRect( 0, 0, width, size );
		ctx.fillRect( width - size, 0, width, height );
		ctx.fillRect( 0, height - size, width, height );
		ctx.fillRect( 0, 0, size, height );
		ctx.restore();
		
		this.perf.end('border');
		this.logDebug(6, "Border complete");
		return this;
	}
	
});
