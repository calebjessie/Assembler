'use strict'

require("babel-core").transform("code");

const {ipcRenderer} = require('electron');
const {shell} = require('electron');
const {requireTaskPool} = require('electron-remote');
const {app} = require('electron').remote;

const remote = require('electron').remote,
	  fs = require('fs'),
	  path = require('path'),
	  pImg = requireTaskPool(require.resolve('./scripts/imgProcess')),
	  jFiles = path.join(app.getPath('userData'), 'files.json'),
	  unFiles = path.join(app.getPath('userData'), 'unprocessed.json');

let docFrag = document.createDocumentFragment(),
	pFiles = [],
	uArray = [];

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

		// Add processed images to files.json if app quit before finishing
		// Figure out a way to run an app.quit() after adding files. PROMISES!
		if (pFiles.length > 0) {
			addFiles(pFiles);
		} else {
			app.quit();
		}
		
		// All images processed? Remove file. If not, save list.
		if (uArray.length === 0) {
			fs.unlink(unFiles, (err) => {
				if (err) throw err;
			});
		} else {
			fs.writeFile(unFiles, JSON.stringify(uArray, null, '\t'), (err) => {
				if (err) console.log(err);
			});
		}
		
	}, false);
	
	// If files have been processed, display them
	if (fs.existsSync(jFiles)) {
		jsonDisplay();
	} else {
		document.getElementById('browse').style.display = 'block';
	}
	
	// If unprocessed images, continue processing them
	if (fs.existsSync(unFiles)) {
		fs.readFile(unFiles, (err, data) => {
			if (err) throw err;
			
			const unprocessedJson = JSON.parse(data);
			uArray = unprocessedJson;
			initAssets(unprocessedJson);
		});
	}
	
	// Send message to main process to load files
	document.getElementById('browse-files').addEventListener('click', () => {
		ipcRenderer.send('loadAssets');
	});
})();

// Displays assets once browse btn is clicked
ipcRenderer.on('getAssets', (event, filtered) => {	
	document.getElementById('browse').style.display = 'none';
	
	uArray = filtered;
	initAssets(filtered);
});

// Process and append each asset
function initAssets(array) {
	for (let i = array.length; i-- > 0;) {
		process(array, i);
		
		// If at end of array, save json. Prevent overwritting. Use addFiles()
		if (i === 0) {
			if (fs.existsSync(jFiles)) {
				fs.readFile(jFiles, (err, data) => {
					if (err) throw err;

					const jsonFiles = JSON.parse(data),
						  newFiles = jsonFiles.concat(pFiles);

					fs.writeFile(jFiles, JSON.stringify(newFiles, null, '\t'), (err) => {
						if (err) throw err;
					});
				});
			} else {
				fs.writeFile(jFiles, JSON.stringify(pFiles), (err) => {
					if (err) console.log(err);
				});
			}
		}
	}
}

// Process Images
function process(image, count) {
	// Format path strings
	let src = image[count].path.replace(/\\/g,"/"),
		fileName = path.basename(image[count].path).replace(/\.[^.]+$/g,"");
	
	// Process image
	pImg.processImage(src, count).then((path) => {
		let formattedPath = path.replace(/\\/g,"/");
		
		// Push file info to array
		pFiles.push({file: formattedPath, name: fileName, og: src});
		
		// Filter out processed image from array
		uArray = uArray.filter(item => item.path != image[count].path);
		
		// Create html for images
		genHtml(fileName, formattedPath, src);
	});
};

// Displays processed files
function jsonDisplay() {
	let jsonFiles = [];
	
	fs.readFile(jFiles, (err, data) => {
		if (err) throw err;
		
		jsonFiles = JSON.parse(data);
		
		for (let i = 0; i < jsonFiles.length; i++) {
			genHtml(jsonFiles[i].name, jsonFiles[i].file, jsonFiles[i].og);
		}
	});
}

// Create HTML elements and display images
function genHtml(fName, fPath, ogPath) {
	// Create html elements
	let divImg = document.createElement('div'),
		imageNode = document.createElement('div'),
		imgName = document.createElement('p'),
		img = document.createElement('img'),
		text = document.createTextNode(fName),
		openBtn = document.createElement('div'),
		openTxt = document.createElement('p'),
		openTxtValue = document.createTextNode('open file location'),
		openIcon = document.createElement('img');

	// Create styles and add file path to div
	divImg.className = 'asset-img';
	imgName.className = 'asset-title';
	imageNode.className = 'image-node';
	openBtn.className = 'open-btn';
	openTxt.className = 'open-txt';
	openIcon.classList = 'open-icon';
	openIcon.src = './assets/open-icon.png';
	img.src = fPath;
	
	// Add hover events
	imageNode.addEventListener('mouseover', () => {
		openBtn.style.display = 'block';
		openTxt.style.display = 'block';
	}, false);
	imageNode.addEventListener('mouseout', () => {
		openBtn.style.display = 'none';
		openTxt.style.display = 'none';
	}, false);
	
	// Add click events
	openBtn.addEventListener('click', () => {
		shell.showItemInFolder(ogPath);
	}, false);

	// Append elements to containers
	docFrag.appendChild(divImg);
	divImg.appendChild(imageNode);
	divImg.appendChild(imgName);
	imageNode.appendChild(openBtn);
	imageNode.appendChild(img);
	imageNode.appendChild(openTxt);
	openTxt.appendChild(openTxtValue);
	imgName.appendChild(text);
	openBtn.appendChild(openIcon);
	document.getElementById('asset-feed').appendChild(docFrag);
}

// Adds newly processed files to json file - Can use in initAssets()
function addFiles(array) {
	if (fs.existsSync(jFiles)) {
		fs.readFile(jFiles, (err, data) => {
			if (err) throw err;

			const jsonFiles = JSON.parse(data),
				  newFiles = jsonFiles.concat(array);

			fs.writeFile(jFiles, JSON.stringify(newFiles, null, '\t'), (err) => {
				if (err) throw err;
				
				app.quit();
			});
		});
	} else {
		fs.writeFile(jFiles, JSON.stringify(array, null, '\t'), (err) => {
			if (err) throw err;
			
			app.quit();
		});
	}
}