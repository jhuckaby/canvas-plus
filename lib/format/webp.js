// canvas-plus - Image Transformation Engine
// WebP Output Format Mixin
// Copyright (c) 2023 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var toBuffer = require('blob-to-buffer');

module.exports = Class.create({
	
	output_webp: function(callback) {
		// output image in WebP format to buffer
		var self = this;
		if (this.requireRGBA().isError) return callback( this.getLastError() );
		
		// look for standard API first
		if (this.get('useDataURLs')) {
			this.logDebug(6, "Compressing into WebP format (using browser)", { quality: this.get('quality') } );
			
			var buf = Buffer.from( this.canvas.toDataURL('image/webp', this.get('quality') / 100).split(',')[1], 'base64' );
			this.logDebug(6, "WebP compression complete");
			return callback(false, buf);
		}
		else if (this.canvas.toBlob) {
			this.logDebug(6, "Compressing into WebP format (using browser)", { quality: this.get('quality') } );
			
			this.canvas.toBlob( 
				function(blob) {
					// got Blob, now convert to Buffer
					toBuffer(blob, function (err, buf) {
						if (err) return self.doError('webp', "WebP Encode Error: " + err, callback);
						self.logDebug(6, "WebP compression complete");
						callback(null, buf);
					});
				},
				'image/webp',
				this.get('quality') / 100
			);
		}
		else if (this.webp) {
			// use node WASM API
			var imgData = this.context.getImageData(0, 0, this.get('width'), this.get('height'));
			var opts = Object.assign( {}, this.get('webp') || {}, { quality: this.get('quality') } );
			
			this.logDebug(6, "Compressing into WebP format", opts );
			
			this.webp.encode( imgData, opts, function(err, data) {
				if (err) return self.doError('webp', "WebP Encode Error: " + err, callback);
				self.logDebug(6, "WebP compression complete");
				callback(null, data);
			} );
		} // node
	}
	
});
