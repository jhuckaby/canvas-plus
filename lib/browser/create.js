// canvas-plus - Image Transformation Engine
// Canvas Create Mixin - Browser Version
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	create: function(opts, callback) {
		// create new canvas, with optional background color
		// opts: { width, height, background }
		this.clearLastError();
		if (!this.get('origWidth')) this.perf.begin('create');
		
		opts = this.copyHash( opts || {} );
		opts = this.applySettings(opts);
		
		var width = opts.width;
		var height = opts.height;
		var background = opts.background;
		
		this.set('width', width);
		this.set('height', height);
		
		this.logDebug(5, "Creating new canvas: " + width + 'x' + height, { background: background || '(transparent)' });
		
		// sanity check
		if (!width || isNaN(parseInt(width)) || !height || isNaN(parseInt(height))) {
			return this.doError('create', "Invalid image dimensions: " + width + 'x' + height, callback);
		}
		
		// check max area
		if (this.get('maxArea')) {
			var area = width * height;
			if (area > this.get('maxArea')) {
				return this.doError('create', "Image dimensions are too large: " + width + 'x' + height, callback);
			}
		}
		
		// create canvas
		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		this.context = this.canvas.getContext('2d');
		
		// remove 'filter' from canvasSettingsKeys (it means something different in the browser)
		delete this.canvasSettingsKeys.filter;
		
		// apply settings
		for (var key in this.canvasSettingsKeys) {
			this.context[key] = this.settings[key];
		}
		
		// fill background if desired
		if (background) {
			this.context.save();
			this.context.globalCompositeOperation = 'copy';
			this.context.fillStyle = background;
			this.context.fillRect( 0, 0, width, height );
			this.context.restore();
		}
		
		this.set('mode', 'rgba');
		
		if (!this.get('origWidth')) {
			this.perf.end('create');
			this.set('origWidth', this.get('width'));
			this.set('origHeight', this.get('height'));
		}
		
		this.logDebug(5, "Canvas created successfully");
		if (callback) callback();
		
		// for chaining
		return this;
	}
		
});
