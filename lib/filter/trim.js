// canvas-plus - Image Transformation Engine
// Trim Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	trim: function(opts) {
		// auto-crop edge pixels, uses color or top-left corner pixel as reference
		var self = this;
		this.clearLastError();
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		opts = this.copyHash( opts || {} );
		
		this.perf.begin('trim');
		this.logDebug(6, "Trimming image (auto-crop edges)", opts);
		
		var width = this.get('width');
		var height = this.get('height');
		var imgData = this.context.getImageData(0, 0, width, height);
		var data = imgData.data;
		var tolerance = opts.tolerance || 0;
		var ref = null;
		
		if (opts.color) {
			// use custom user-supplied color
			var color = this.parseColor( opts.color );
			if (!color) return this.doError('trim', "Failed to parse trim color");
			ref = color;
			this.logDebug(6, "Using custom color for trim: " + opts.color, color);
		}
		else {
			// default to top-left corner pixel
			ref = {
				r: data[0],
				g: data[1],
				b: data[2],
				a: data[3]
			};
			this.logDebug(6, "Using top-left corner pixel for trim", ref);
		}
		
		var offset = 0;
		var left = width - 1;
		var top = height - 1;
		var right = 0;
		var bottom = 0;
		
		for (var y = 0; y < height; y++) {
			// foreach row
			for (var x = 0; x < width; x++) {
				// for each pixel
				dist = Math.max(
					Math.abs( ref.r - data[offset + 0] ),
					Math.abs( ref.g - data[offset + 1] ),
					Math.abs( ref.b - data[offset + 2] ),
					Math.abs( ref.a - data[offset + 3] )
				);
				if (dist > tolerance) {
					if (x < left) left = x;
					if (x > right) right = x;
					if (y < top) top = y;
					if (y > bottom) bottom = y;
				}
				offset += 4;
			} // x
		} // y
		
		var cx = left;
		var cy = top;
		var cwidth = (right - left) + 1;
		var cheight = (bottom - top) + 1;
		
		if ((cwidth > 0) && (cheight > 0)) {
			if ((cwidth < width) || (cheight < height)) {
				this.crop({
					width: cwidth,
					height: cheight,
					x: cx,
					y: cy
				});
				this.logDebug(6, "Image trim complete");
			}
			else {
				this.logDebug(3, "No trim was necessary");
			}
		}
		else {
			this.logDebug(3, "Entire image was trimmed, canceling");
		}
		
		this.perf.end('trim');
		return this;
	}
	
});
