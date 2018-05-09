// canvas-plus - Image Transformation Engine
// Canvas Font Mixin - Browser Version
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	loadFont: function(family) {
		// no-op for browser, just return object with family name
		var font = {
			_pixl_id: family
		};
		return font;
	}
	
});
