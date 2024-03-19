// canvas-plus - Image Transformation Engine
// Canvas Load Mixin
// Copyright (c) 2017 - 2023 Joseph Huckaby
// Released under the MIT License

const fs = require('fs');
const Class = require('pixl-class');
const PixlRequest = require('pixl-request');
const ImageSize = require('image-size');
const ExifReader = require('exifreader');
const { Image, createImageData } = require('canvas');
const webp = require('webp-wasm');

module.exports = Class.create({
	
	__promisify: true,
	
	webp: webp,
	
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
				
				var request = new PixlRequest("CanvasPlus/2.0");
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
			try { this.exif = ExifReader.load( buf ); }
			catch (err) {
				this.logDebug(3, "Warning: Failed to read EXIF metadata: " + err);
			}
			if (this.exif) {
				// delete some huge exif objects to reduce memory overhead
				delete this.exif.MakerNote;
				delete this.exif.Images;
				
				// flatten orientation to single integer value
				if (this.exif.Orientation && this.exif.Orientation.value) {
					this.exif.Orientation = this.exif.Orientation.value;
				}
				
				this.logDebug(9, "EXIF Image Data", this.exif);
			}
		}
		
		// handle webp separately
		if (info.type == 'webp') {
			this.logDebug(6, "Loading image using WebP");
			
			this.webp.decode( buf, function(err, image) {
				if (err) {
					return self.doError('load', "Image load failed: " + err, callback);
				}
				if (!image || !image.width || !image.height || !image.data) {
					return self.doError('load', "Image load failed: Unknown WebP decode error", callback);
				}
				
				// create RGBA canvas to hold our WebP pixels
				self.create({ width: image.width, height: image.height });
				
				// convert to native canvas ImageData object
				var imgData = createImageData(image.data, image.width, image.height);
				
				// render pixels onto canvas
				self.context.putImageData( imgData, 0, 0 );
				
				self.perf.end('read');
				self.perf.count('bytes_read', buf.length);
				
				self.set('origWidth', self.get('width'));
				self.set('origHeight', self.get('height'));
				self.set('origFormat', self.get('format'));
				
				self.logDebug(6, "Image load complete (WebP)");
				if (callback) callback(false);
			}); // webp.decode
			return;
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
			
			// special handling needed for GIF89a images
			if (self.get('format') == 'gif') {
				self.logDebug(6, "Premultiplying alpha for GIF");
				self.render();
				
				// bug in node-canvas: GIF89a with transparency needs alpha premultiplied
				var ctx = self.getContext();
				var imgData = ctx.getImageData( 0, 0, self.width(), self.height() );
				for (var idx = 0, len = imgData.data.length; idx < len; idx += 4) {
					if (imgData.data[idx + 3] == 0) { imgData.data[idx] = imgData.data[idx + 1] = imgData.data[idx + 2] = 0; }
				}
				ctx.putImageData( imgData, 0, 0 );
			} // gif
			
			self.logDebug(6, "Image load complete");
			if (callback) callback(false);
		};
		
		// trigger load
		this.logDebug(6, "Loading image using canvas");
		this.image.src = buf;
	}
	
});
