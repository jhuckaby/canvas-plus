// canvas-plus - Image Transformation Engine
// Canvas Load Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var Class = require('pixl-class');
var PixlRequest = require('pixl-request');
var ImageSize = require('image-size');
var EXIF = require('exif-js');
const { Image } = require('canvas');

// monkey-patch global Blob with polyfill for EXIF to be happy (sigh)
var BlobPolyfill = require('blob-polyfill');
if (!global.Blob) global.Blob = BlobPolyfill.Blob;

module.exports = Class.create({
	
	__promisify: true,
	
	load: function(buf, callback) {
		// load image from disk or buffer
		// Note: This function is ASYNC ONLY -- no return value, no chaining
		// Warning re: corrupted JPEGs: https://github.com/Automattic/node-canvas/issues/938
		var self = this;
		this.clearLastError();
		this.perf.begin('read');
		
		// convert file/url to buffer
		if (typeof(buf) == 'string') {
			if (buf.match(/^\w+\:\/\/\S+$/)) {
				// load from url
				var url = buf;
				this.logDebug(4, "Loading image data from URL: " + url);
				
				var request = new PixlRequest("CanvasPlus/1.0");
				request.setFollow( 5 ); // follow up to 5 redirects
				request.setTimeout( 30 * 1000 ); // 30 seconds
				
				request.get(url, function(err, resp, data, perf) {
					// check for http error
					if (!err && ((resp.statusCode > 299) || (resp.statusCode < 200))) {
						err = new Error("HTTP " + resp.statusCode + " " + resp.statusMessage);
					}
					if (err) {
						self.doError('load', "Failed to fetch URL: " + url + ": " + err, callback);
						return;
					}
					
					self.logDebug(9, "Successfully fetched image data", resp.headers);
					
					// recurse into load() with buffer
					self.load(data, callback);
				}); // request.get
				
				return;
			}
			else {
				// load from file
				var file = buf;
				this.logDebug(4, "Loading image data from file: " + file);
				try {
					buf = fs.readFileSync( buf );
				}
				catch (err) {
					this.doError('load', "Failed to load file: " + file + ": " + err, callback);
				}
			}
		} // string
		
		// should have a buffer at this point
		if (!(buf instanceof Buffer)) {
			this.doError('load', "Must provide a Buffer or file path.", callback);
			return;
		}
		
		this.logDebug(4, "Loading image from buffer", { size: buf.length } );
		
		// ping image size before trying to load
		var info = null;
		try {
			info = ImageSize( buf );
		}
		catch (err) {
			this.doError('load', "Image ping error: " + err, callback);
			return;
		}
		
		this.logDebug(4, "Image ping:", info);
		
		// sanity checks
		if ((info.width < 1) || (info.height < 1)) {
			this.doError('load', "Image dimensions are invalid: " + info.width + 'x' + info.height, callback);
			return;
		}
		
		// check pixel area vs. max
		if (this.get('maxArea')) {
			var area = info.width * info.height;
			if (area > this.get('maxArea')) {
				this.doError('load', "Image dimensions are too large: " + info.width + 'x' + info.height, callback);
				return;
			}
		}
		
		// set some props based on image ping
		this.set('width', info.width);
		this.set('height', info.height);
		this.set('format', info.type);
		
		// detect EXIF data if present in image
		if (this.get('readEXIF')) {
			try { this.exif = EXIF.readFromBinaryFile( buf.buffer ); }
			catch (err) {
				this.logDebug(3, "Warning: Failed to read EXIF metadata: " + err);
			}
			if (this.exif) this.logDebug(9, "EXIF Image Data", this.exif);
		}
		
		// load image (actually happens in sync, but uses callbacks, sigh)
		this.image = new Image();
		
		this.image.onerror = function(err) {
			// load failed
			self.doError('load', "Image load failed: " + err, callback);
		};
		
		this.image.onload = function() {
			// load complete (should be same thread)
			self.perf.end('read');
			self.perf.count('bytes_read', buf.length);
			self.set('mode', 'image');
			
			self.set('origWidth', self.get('width'));
			self.set('origHeight', self.get('height'));
			self.set('origFormat', self.get('format'));
			
			self.canvas = null;
			self.context = null;
			self.pixels = null;
			self.palette = null;
			
			self.logDebug(5, "Image load complete");
			if (callback) callback(false);
		};
		
		// trigger load
		this.image.src = buf;
	}
	
});
