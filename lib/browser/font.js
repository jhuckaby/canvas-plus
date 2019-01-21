// canvas-plus - Image Transformation Engine
// Canvas Font Mixin - Browser Version
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var fonts_loaded = {};

module.exports = Class.create({
	
	getFontID: function(family) {
		// family is font ID for browser
		return family;
	},
	
	loadFont: function(family, url, callback) {
		// load CSS font family in browser, callback is optional
		var self = this;
		
		if (family in fonts_loaded) {
			if (callback) callback();
			return;
		}
		fonts_loaded[family] = 1;
		
		// sniff format from URL
		if (url.match(/\.(\w+)(\?|$)/)) {
			var fmt = RegExp.$1;
			if (fmt.match(/ttf/i)) fmt = 'truetype';
			else if (fmt.match(/otf/i)) fmt = 'opentype';
			
			var pf = this.perf.begin('font');
			
			var sty = document.createElement('style');
			sty.type = 'text/css';
			sty.innerHTML = "@font-face { font-family:'" + family + "'; src:url('" + url + "') format('" + fmt + "'); }\n";
			(document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(sty);
			
			onFontReady(family, function() {
				pf.end();
				self.logDebug(5, "Font loaded successfully: " + family + ": " + url);
				if (callback) callback();
			}, 
			{
				timeoutAfter: 5000,
				onTimeout: function() {
					pf.end();
					return self.doError( 'font', "Failed to load font after 5 seconds: " + family, callback );
				}
			});
		}
		else {
			self.doError( 'font', "Cannot determine font format from URL: " + url, callback );
		}
	}
	
});

// onFontReady (MIT License)
// https://github.com/dwighthouse/onfontready/blob/master/LICENSE
function onFontReady(e,t,i,n,o){i=i||0,i.timeoutAfter&&setTimeout(function(){n&&(document.body.removeChild(n),n=0,i.onTimeout&&i.onTimeout())},i.timeoutAfter),o=function(){n&&n.firstChild.clientWidth==n.lastChild.clientWidth&&(document.body.removeChild(n),n=0,t())},o(document.body.appendChild(n=document.createElement("div")).innerHTML='<div style="position:fixed;white-space:pre;bottom:999%;right:999%;font:999px '+(i.generic?"":"'")+e+(i.generic?"":"'")+',serif">'+(i.sampleText||" ")+'</div><div style="position:fixed;white-space:pre;bottom:999%;right:999%;font:999px '+(i.generic?"":"'")+e+(i.generic?"":"'")+',monospace">'+(i.sampleText||" ")+"</div>"),n&&(n.firstChild.appendChild(e=document.createElement("iframe")).style.width="999%",e.contentWindow.onresize=o,n.lastChild.appendChild(e=document.createElement("iframe")).style.width="999%",e.contentWindow.onresize=o,e=setTimeout(o))};
