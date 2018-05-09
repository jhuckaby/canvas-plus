// canvas-plus - Image Transformation Engine
// Histogram Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	histogram: function() {
		// generate histogram data
		var self = this;
		this.clearLastError();
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		this.perf.begin('histogram');
		this.logDebug(6, "Generating histogram");
		
		var width = this.get('width');
		var height = this.get('height');
		var imgData = this.context.getImageData(0, 0, width, height);
		var data = imgData.data;
		var offset = 0;
		var histo = { red: [], green: [], blue: [], alpha: [] };
		
		for (var idx = 0; idx < 256; idx++) {
			histo.red.push(0);
			histo.green.push(0);
			histo.blue.push(0);
			histo.alpha.push(0);
		}
		
		for (var y = 0; y < height; y++) {
			// foreach row
			for (var x = 0; x < width; x++) {
				// for each pixel
				if (data[ offset + 3 ]) {
					histo.red[ data[ offset + 0 ] ]++;
					histo.green[ data[ offset + 1 ] ]++;
					histo.blue[ data[ offset + 2 ] ]++;
					histo.alpha[ data[ offset + 3 ] ]++;
				}
				offset += 4;
			} // x loop
		} // y loop
		
		// calc maximums
		histo.redMax = Math.max.apply(null, histo.red);
		histo.greenMax = Math.max.apply(null, histo.green);
		histo.blueMax = Math.max.apply(null, histo.blue);
		histo.alphaMax = Math.max.apply(null, histo.alpha);
		
		this.perf.end('histogram');
		this.logDebug(6, "Histogram complete");
		return histo;
	}
	
});
