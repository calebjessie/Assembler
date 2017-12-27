const {app} = require('electron').remote,
	  {ipcRenderer} = require('electron'),
		isAsar = __dirname.indexOf('asar') >= 0;
const fs = require('fs'),
	  path = require('path');

// if (isAsar) {
// 	const sharp = require('../../../app.asar.unpacked/node_modules/sharp');
// } else {
// 	const sharp = require('sharp');
// }

const sharp = require('sharp');

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
