const {app} = require('electron').remote;
const sharp = require('sharp'),
	  fs = require('fs'),
	  path = require('path');

// Resize images on child process
exports.processImages = (imgPath) => {
	let sharpImg = sharp(imgPath),
		thumb = path.join(app.getPath('userData'), '.thumbnails'),
		fileName = imgPath.split(/(\\|\/)/g).pop().replace(/\.[^/.]+$/, "") + '.webp',
		fullPath = path.join(thumb, fileName);
	
	sharpImg
		.resize(200, null)
		.webp()
		.toFile(path.join(thumb, fileName));
	
	return fullPath;
}