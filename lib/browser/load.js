// canvas-plus - Image Transformation Engine
// Canvas Load Mixin - Browser Version
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var EXIF = require('exif-js');
var fileType = require('file-type');

module.exports = Class.create({
	
	load: function(thingy, callback) {
		// load image from ArrayBuffer, Blob, File or URL (local domain or CORS required)
		// Note: This function is ASYNC ONLY -- no return value, no chaining
		var self = this;
		this.clearLastError();
		
		if (typeof(thingy) == 'string') {
			// load from URL
			var url = thingy;
			this.logDebug(4, "Loading image from URL", { url: url } );
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
			var fileReader = new FileReader();
			fileReader.onload = function(e) {
				self.load( e.target.result, callback );
			};
			fileReader.readAsArrayBuffer(thingy);
			return;
		}
		
		// support Uint8Array or Buffer (which is a Uint8Array in disguise)
		if (thingy instanceof Uint8Array) {
			if ((thingy.byteOffset === 0) && (thingy.byteLength === thingy.buffer.byteLength)) {
				thingy = thingy.buffer;
			}
			else if (typeof thingy.buffer.slice === 'function') {
				thingy = thingy.buffer.slice(thingy.byteOffset, thingy.byteOffset + thingy.byteLength);
			}
		}
		
		// we should have an ArrayBuffer at this point
		if (!(thingy instanceof ArrayBuffer)) {
			return this.doError('load', "Failed to load image: Unknown image resource type: " + typeof(thingy), callback); 
		}
		var arr_buf = thingy;
		
		// detect file format
		this.perf.begin('detect');
		var info = fileType(arr_buf);
		this.perf.end('detect');
		
		if (!info || !info.mime) {
			return this.doError('load', "Failed to load image: Unsupported or unknown file type", callback);
		}
		this.set('format', info.mime.replace(/^image\//, ''));
		
		this.logDebug(4, "Loading image from buffer", { size: arr_buf.byteLength, format: this.get('format') } );
		
		// detect EXIF data if present in image
		if (this.get('readEXIF')) {
			this.perf.begin('exif');
			try { this.exif = EXIF.readFromBinaryFile( arr_buf ); }
			catch (err) {
				this.logDebug(3, "Warning: Failed to read EXIF metadata: " + err);
			}
			this.perf.end('exif');
			if (this.exif) this.logDebug(9, "EXIF Image Data", this.exif);
		}
		
		// load image (actually happens in sync, but uses callbacks, sigh)
		this.perf.begin('read');
		this.image = new Image();
		
		// load image from buffer
		var mime_type = info.mime;
		var url_creator = window.URL || window.webkitURL || window.mozURL || window.msURL;
		var object_url = null;
		
		this.image.onerror = function() {
			// load failed
			self.perf.end('read');
			self.doError('load', "Image load failed", callback);
			
			// free memory
			if (object_url) url_creator.revokeObjectURL(object_url);
		};
		
		this.image.onload = function() {
			// load complete (should be same thread)
			self.perf.end('read');
			self.perf.count('bytes_read', arr_buf.byteLength);
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
			if (object_url) url_creator.revokeObjectURL(object_url);
		};
		
		// trigger load
		if (this.get('useDataURLs')) {
			// load using data url
			var buf = Buffer.from(arr_buf);
			this.image.src = "data:" + mime_type + ";base64," + buf.toString('base64');
		}
		else {
			// load using blob
			var buf_view = new Uint8Array( arr_buf );
			var blob = new Blob( [ buf_view ], { type: mime_type } );
			object_url = url_creator.createObjectURL( blob );
			this.image.src = object_url;
		}
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
		this.image.crossOrigin = 'anonymous';
		this.image.setAttribute('crossorigin', 'anonymous');
		
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
			
			self.set('origWidth', self.get('width'));
			self.set('origHeight', self.get('height'));
			self.set('origFormat', self.get('format'));
			
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
