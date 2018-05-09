// canvas-plus - Image Transformation Engine
// Canvas Load Mixin - Browser Version
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var EXIF = require('exif-js');

module.exports = Class.create({
	
	load: function(thingy, callback) {
		// load image from ArrayBuffer, Blob, File or URL (local domain or CORS required)
		// Note: This function is ASYNC ONLY -- no return value, no chaining
		var self = this;
		this.clearLastError();
		
		if (typeof(thingy) == 'string') {
			// load from URL
			var url = thingy;
			var fmt = 'jpeg';
			if (url.match(/\.(\w+)(\?|$)/)) fmt = RegExp.$1.toLowerCase();
			
			this.set('format', fmt);
			this.logDebug(4, "Loading image from URL", { url: url, format: fmt } );
			this.perf.begin('download');
			
			var http = new XMLHttpRequest();
			http.onload = function() {
				if (this.status == 200 || this.status === 0) {
					self.perf.end('download');
					self.load( http.response, callback );
				} 
				else {
					self.doError('load', "URL Fetch Failure: " + url + ": HTTP " + this.status + " " + this.statusText, callback);
				}
				http = null;
			};
			http.open("GET", url, true);
			http.responseType = "arraybuffer";
			http.send(null);
			return;
		}
		else if (thingy instanceof Blob || thingy instanceof File) {
			// load from blob or file
			if (!this.get('format')) this.set('format', 'jpeg');
			
			var fileReader = new FileReader();
			fileReader.onload = function(e) {
				self.load( e.target.result, callback );
			};
			fileReader.readAsArrayBuffer(thingy);
			return;
		}
		
		// we should have an ArrayBuffer at this point
		if (!(thingy instanceof ArrayBuffer)) {
			return this.doError('load', "Failed to load image: Unknown image resource type"); 
		}
		var arr_buf = thingy;
		
		// convert ArrayBuffer to Node-like Buffer
		var buf = Buffer.from(arr_buf);
		
		this.perf.begin('read');
		this.logDebug(4, "Loading image from buffer", { size: buf.length } );
		
		// detect EXIF data if present in image
		this.exif = EXIF.readFromBinaryFile( arr_buf );
		if (this.exif) this.logDebug(9, "EXIF Image Data", this.exif);
		
		// load image (actually happens in sync, but uses callbacks, sigh)
		this.image = new Image();
		
		// load image from buffer
		var mime_type = "image/" + this.get('format').replace(/jpg/, 'jpeg');
		var buf_view = new Uint8Array( arr_buf );
		var blob = new Blob( [ buf_view ], { type: mime_type } );
		var url_creator = window.URL || window.webkitURL || window.mozURL || window.msURL;
		var object_url = url_creator.createObjectURL( blob );
		
		this.image.onerror = function() {
			// load failed
			self.doError('load', "Image load failed", callback);
		};
		
		this.image.onload = function() {
			// load complete (should be same thread)
			self.perf.end('read');
			self.perf.count('bytes_read', buf.length);
			self.set('mode', 'image');
			
			// sanity checks
			if ((this.width < 1) || (this.height < 1)) {
				return self.doError('load', "Image dimensions are invalid: " + this.width + 'x' + this.height, callback);
			}
			
			// check pixel area vs. max
			if (self.get('maxArea')) {
				var area = this.width * this.height;
				if (area > self.get('maxArea')) {
					self.doError('load', "Image dimensions are too large: " + this.width + 'x' + this.height, callback);
				}
			}
			
			// set some props based on image
			self.set('width', this.width);
			self.set('height', this.height);
			
			self.set('origWidth', self.get('width'));
			self.set('origHeight', self.get('height'));
			self.set('origFormat', self.get('format'));
			
			self.canvas = null;
			self.context = null;
			self.pixels = null;
			self.palette = null;
			
			self.logDebug(5, "Image load complete");
			if (callback) callback(false);
			
			// free memory
			url_creator.revokeObjectURL(object_url);
		};
		
		// trigger load
		this.image.src = object_url;
	},
	
	loadRemote: function(url, callback) {
		// load image from remote url (browser only, no EXIF)
		// this is for URLs on 3rd party domains with no CORS headers
		var self = this;
		this.clearLastError();
		this.perf.begin('download');
		
		var fmt = '';
		if (url.match(/\.(\w+)(\?|$)/)) fmt = RegExp.$1.toLowerCase();
		
		this.logDebug(4, "Loading image from URL", { url: url, format: fmt } );
		
		// load image
		this.image = new Image();
		
		this.image.onerror = function() {
			// load failed
			self.doError('load', "Image load failed: " + url, callback);
		};
		
		this.image.onload = function() {
			// load complete (should be same thread)
			self.perf.end('download');
			
			// sanity checks
			if ((this.width < 1) || (this.height < 1)) {
				return self.doError('load', "Image dimensions are invalid: " + this.width + 'x' + this.height, callback);
			}
			
			// check pixel area vs. max
			if (self.get('maxArea')) {
				var area = this.width * this.height;
				if (area > self.get('maxArea')) {
					self.doError('load', "Image dimensions are too large: " + this.width + 'x' + this.height, callback);
				}
			}
			
			// set some props based on image
			self.set('width', this.width);
			self.set('height', this.height);
			self.set('format', fmt);
			
			self.canvas = null;
			self.context = null;
			self.pixels = null;
			self.palette = null;
			self.exif = null; // not supported with loadRemote
			
			self.set('mode', 'image');
			self.logDebug(5, "Image load complete");
			if (callback) callback(false);
		};
		
		// trigger load
		this.image.src = url;
	}
	
});
