// canvas-plus - Image Transformation Engine
// JPEG Output Format Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var toBuffer = require('blob-to-buffer');

module.exports = Class.create({
	
	output_jpeg: function(callback) {
		// output image in JPEG format to buffer
		var self = this;
		if (this.requireRGBA().isError) return callback( this.getLastError() );
		
		// look for standard API first
		if (this.canvas.toBlob) {
			this.logDebug(6, "Compressing into JPEG format (using browser)", { quality: this.get('quality') } );
			
			this.canvas.toBlob( 
				function(blob) {
					// got Blob, now convert to Buffer
					toBuffer(blob, function (err, buf) {
						if (err) return self.doError('jpeg', "JPEG Encode Error: " + err, callback);
						self.logDebug(6, "JPEG compression complete");
						callback(null, buf);
					});
				},
				'image/jpeg',
				this.get('quality') / 100
			);
		}
		else {
			// use node-canvas proprietary API
			this.logDebug(6, "Compressing into JPEG format", { quality: this.get('quality'), progressive: this.get('progressive') } );
			
			var stream = this.canvas.createJPEGStream({
				bufsize: this.get('bufsize') || 4096,
				quality: this.get('quality'),
				progressive: this.get('progressive')
			});
			var buffers = [];
			
			stream.on('data', function (chunk) {
				buffers.push(chunk);
			});
			stream.on('error', function (err) {
				self.doError('jpeg', "JPEG Encode Error: " + err, callback);
			});
			stream.on('end', function() {
				var buf = Buffer.concat(buffers);
				self.logDebug(6, "JPEG compression complete");
				callback(null, buf);
			});
		} // node-canvas
	}
	
});
