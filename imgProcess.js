const {app} = require('electron').remote,
	  {ipcRenderer} = require('electron');
const sharp = require('sharp'),
	  fs = require('fs'),
	  path = require('path');

// Resize images on child process
exports.processImage = (imgPath, count) => {
	return new Promise((resolve, reject) => {
		let sharpImg = sharp(imgPath),
			thumb = path.join(app.getPath('userData'), '.thumbnails'),
			fileName = count + '.webp',
			fullPath = path.join(thumb, fileName);
		
		sharpImg
			.resize(400, null)
			.webp()
			.toFile(fullPath)
			.then( data => resolve(fullPath))
			.catch( err => reject(err));
	});
}