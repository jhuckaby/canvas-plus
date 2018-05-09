// canvas-plus - Image Transformation Engine
// Canvas Font Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var Tools = require("pixl-tools");
var Canvas = require('canvas');
var Font = Canvas.Font;

var font_cache = {};

module.exports = Class.create({
	
	loadFont: function(file) {
		// load font from disk, cache in ram
		// use MD5 of file path for canvas font ID
		var font_id = 'pixl' + Tools.digestHex( file, 'md5' );
		var font = font_cache[font_id];
		if (!font) {
			font = font_cache[font_id] = new Font(font_id, file);
			font._pixl_id = font_id;
		}
		return font;
	}
	
});
