'use strict'

require("babel-core").transform("code");

const {ipcRenderer} = require('electron');
const {requireTaskPool} = require('electron-remote');

const remote = require('electron').remote,
	  fs = require('fs'),
	  pImg = requireTaskPool(require.resolve('./imgProcess'));

let docFrag = document.createDocumentFragment();


// Create window controls and browse functionality
(function() {
	document.getElementById('min-btn').addEventListener('click', () => {
		remote.getCurrentWindow().minimize();
	}, false);

	document.getElementById('max-btn').addEventListener('click', () => {
		if (!remote.getCurrentWindow().isMaximized()) {
			remote.getCurrentWindow().maximize();
		} else {
			remote.getCurrentWindow().unmaximize();
		}
	}, false);

	document.getElementById('close-btn').addEventListener('click', () => {
		remote.getCurrentWindow().close();
	}, false);
	
	document.getElementById('browse-files').addEventListener('click', () => {
		ipcRenderer.send('loadAssets');
	});
})();

// Displays assets once browse btn is clicked
ipcRenderer.on('getAssets', (event, filtered) => {	
	let loopStart = 0;
	
	document.getElementById('browse').style.display = 'none';
	if (loopStart == 0) initAssets(filtered, loopStart, 20);
	loopStart += 20;
	
	/*document.getElementById('container').addEventListener('scroll', () => {
		let container = document.getElementById('container');

		if ((container.clientHeight + container.scrollTop) >= container.scrollHeight) {
			// PROBLEM
			// Need to figure out a way to load in the last odd number of files
			// 920 + 20 = 940, but files end at 923.
			initAssets(filtered, loopStart, 20);
			loopStart += 20;
		}
	});*/
});

// Process and append each asset
function initAssets(array, start, length) {
	array.forEach((item, count) => {
		(async function process() {
			let src = item.path.replace(/\\/g,"/");
			let image = await pImg.processImages(src, count);
			
			console.log(src, image);
			
			let divImg = document.createElement('div');
			divImg.className = 'asset-img';
			divImg.style.backgroundImage = 'url("' + image.replace(/\\/g,"/") + '")';

			docFrag.appendChild(divImg);
			document.getElementById('asset-feed').appendChild(docFrag);
		})();
	});
}