'use strict'
const {ipcRenderer} = require('electron');
const remote = require('electron').remote;


// Create window controls
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
})();


// Create directory browse
const browseDir = function() {
	
	document.getElementById('asset-feed').innerHTML = '<div id="browse">Start by browsing for your assets folder. <button id="browse-files">Browse</button></div>';
	
	document.getElementById('browse-files').addEventListener('click', () => {
		// ipc message
		ipcRenderer.send('loadAssets');
	});
	
	ipcRenderer.on('getAssets', (event, arg) => {
		for (let i = 0; i < 20; i++) {
			displayAssets(arg[i].file);
		}
		console.log(document.getElementById('asset-feed').clientHeight);
		
		document.getElementById('browse').style.display = 'none';
		document.getElementById('container').addEventListener('scroll', () => {
			let container = document.getElementById('container');
			
			if ((container.clientHeight + container.scrollTop) >= container.scrollHeight) {
				renderFileImages(20, 20, arg);
				console.log('Works');
			}
		});
	});
}


// Create html for each asset
function displayAssets(path) {
	let divImg = document.createElement('div');
	let bgImg = 'url("' + path.replace(/\\/g,"/") + '")';
	
	divImg.className = 'asset-img';
	divImg.style.backgroundImage = bgImg;
	
	document.getElementById('asset-feed').appendChild(divImg);
}


// Display more assets on scroll
function renderFileImages(startPosition, length, array) {
	for(let i = startPosition; i < startPosition + length; i++) {
		displayAssets(array[i].file);
	}
}


// Save array to JSON
/*function saveJSON(array) {
	let addFiles = JSON.stringify(array, null, "\t");
	
	fs.writeFile('files.json', addFiles, (err) => {
		if (err) throw err;
		console.log("Saved file.");
	});
}*/


// Check if user has selected a directory
/*if (allFiles.length != 0) {
	console.log("Files have been loaded");
} else {
	browseDir();
}*/


browseDir();