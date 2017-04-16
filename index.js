'use strict'

require("babel-core").transform("code");

const {ipcRenderer} = require('electron');
const {requireTaskPool} = require('electron-remote');
const {app} = require('electron').remote;

const remote = require('electron').remote,
	  fs = require('fs'),
	  path = require('path'),
	  pImg = requireTaskPool(require.resolve('./imgProcess'));

let docFrag = document.createDocumentFragment(),
	pFiles = [],
	uArray = {};


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
		fs.writeFile(path.join(app.getPath('userData'), 'unprocessed.json'), JSON.stringify(uArray, null, '\t'), (err) => {
			if (err) console.log(err);
		});
		
		fs.writeFile(path.join(app.getPath('userData'), 'files.json'), JSON.stringify(pFiles, null, '\t'), (err) => {
			if (err) console.log(err);
			remote.getCurrentWindow().close();
		});
	}, false);
	
	
	fs.stat(path.join(app.getPath('userData'), 'files.json'), (err, stat) => {
		if (err == null) {
			jsonDisplay();
		} else if(err.code == 'ENOENT') {
			document.getElementById('browse').style.display = 'block';
		} else {
			console.log('Some other error:', err.code);
		}
	});
	
	document.getElementById('browse-files').addEventListener('click', () => {
		ipcRenderer.send('loadAssets');
	});
})();

// Displays assets once browse btn is clicked
ipcRenderer.on('getAssets', (event, filtered) => {	
	document.getElementById('browse').style.display = 'none';
	initAssets(filtered, 0);
});

// Process and append each asset
function initAssets(array, start, cb) {
	uArray = array.slice();
	
	for (let i = array.length; i >= 0; i--) {
		(async function process() {
			let src = array[i].path.replace(/\\/g,"/");
			let image = await pImg.processImages(src, i);
			let formattedPath = image.replace(/\\/g,"/");

			pFiles.push({file: formattedPath});

			let divImg = document.createElement('div');
			divImg.className = 'asset-img';
			divImg.style.backgroundImage = 'url("' + formattedPath + '")';

			docFrag.appendChild(divImg);
			document.getElementById('asset-feed').appendChild(docFrag);
			
			delete uArray[i];
			
			console.log(uArray);
			
			// If at end of array, save json
			if (i === 0) {
				fs.writeFile(path.join(app.getPath('userData'), 'files.json'), JSON.stringify(pFiles), (err) => {
					if (err) console.log(err);
				});
			}
		})();
	}
}

function jsonDisplay() {
	let jsonFiles = {};
	
	fs.readFile(path.join(app.getPath('userData'), 'files.json'), (err, data) => {
		if (err) throw err;
		
		jsonFiles = JSON.parse(data);
		
		for (let i = 0; i < jsonFiles.length; i++) {
			let src = jsonFiles[i].file;
			let divImg = document.createElement('div');
			divImg.className = 'asset-img';
			divImg.style.backgroundImage = 'url("' + src + '")';

			docFrag.appendChild(divImg);
			document.getElementById('asset-feed').appendChild(docFrag);
		}
	});
}