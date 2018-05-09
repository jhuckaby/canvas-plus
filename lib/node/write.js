// canvas-plus - Image Transformation Engine
// Canvas Write Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var fs = require('fs');

module.exports = Class.create({
	
	__promisify: true,
	
	write: function(opts, callback) {
		// output and/or compress image using helper mixin
		// Note: This function is ASYNC ONLY -- no return value, no chaining
		var self = this;
		this.clearLastError();
		
		if (!opts) opts = {};
		if (typeof(opts) == 'string') {
			opts = { file: opts };
		}
		
		// import opts into settings
		this.set( opts );
		
		// glean format from file if needed
		if (this.get('file') && this.get('file').match(/\.(\w+)$/)) {
			this.set('format', RegExp.$1);
		}
		if (!this.get('format')) {
			this.doError('write', "No image format was specified", callback);
			return;
		}
		
		this.perf.begin('write');
		this.logDebug(5, "Compressing image to format: " + this.get('format'));
		
		// locate helper
		var nfmt = this.get('format').toString().toLowerCase().replace(/\W+/g, '').replace(/jpg/, 'jpeg');
		var func = 'output_' + nfmt;
		if (!this[func]) {
			this.doError('write', "Unsupported output format: " + this.get('format'), callback);
			return;
		}
		
		// call helper
		this[func]( function(err, buf) {
			if (err) {
				// assume doError has already been called at this point, so just bubble up
				if (callback) callback(err);
				return;
			}
			
			self.logDebug(5, "Image compression complete", { size: buf.length });
			
			if (self.get('file')) {
				// optionally save to file
				self.logDebug(5, "Saving to file: " + self.get('file'));
				try {
					fs.writeFileSync( self.get('file'), buf );
				}
				catch (err) {
					self.doError('write', "Failed to write file: " + self.get('file') + ": " + err, callback);
					return;
				}
				
				self.perf.end('write');
				self.perf.count('bytes_written', buf.length);
				self.logDebug(5, "Image write complete");
				if (callback) callback(false, buf);
			}
			else {
				// buffer only
				self.perf.end('write');
				self.perf.count('bytes_written', buf.length);
				if (callback) callback(false, buf);
			}
		});
	}
		
});
