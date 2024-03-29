// canvas-plus - Image Transformation Engine
// Canvas Font Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var Tools = require("pixl-tools");
const { registerFont } = require('canvas');

module.exports = Class.create({
	
	getFontID: function(file) {
		// use MD5 of file path for canvas font ID
		// unless it doesn't appear to be a file, then just return as is (e.g. "Arial")
		if (!file.match(/\.\w+$/)) return file;
		else return 'pixl' + Tools.digestHex( file, 'md5' );
	},
	
	loadFont: function(file) {
		// load font from disk, cache in ram
		var font_id = this.getFontID(file);
		
		if (font_id in this.fontCache) return;
		this.fontCache[font_id] = 1;
		
		this.perf.begin('font');
		registerFont(file, { family: font_id });
		this.perf.end('font');
	}
	
});
