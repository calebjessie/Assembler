const {app} = require('electron').remote;
const sharp = require('sharp'),
	  fs = require('fs'),
	  path = require('path');

// Resize images on child process
exports.processImages = async (imgPath, count) => {
	let sharpImg = sharp(imgPath),
		thumb = path.join(app.getPath('userData'), '.thumbnails'),
		fileName = count + '.webp',
		fullPath = path.join(thumb, fileName);
	
	await sharpImg
		.resize(400, null)
		.webp()
		.toFile(fullPath);
	
	return fullPath;
}