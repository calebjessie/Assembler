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
	  unFiles = path.join(app.getPath('userData'), 'unprocessed.json'),
	  dirFile = path.join(app.getPath('userData'), 'dir.json');

let docFrag = document.createDocumentFragment(),
	pFiles = [],
	uArray = [],
	jsonFiles = [],
	progTotal = 0,
	progAmt = 0,
	dir;

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
		
	// Fetch dir chosen by user
	if (fs.existsSync(dirFile)) {
		fs.readFile(dirFile, (err, data) => {
			if (err) throw err;

			dir = JSON.parse(data);
		});
	}
	
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
			initAssets(unprocessedJson, dir[0]);
		});
	}
	
	// Send message to main process to load files
	document.getElementById('browse-files').addEventListener('click', () => {
		ipcRenderer.send('loadAssets');
	});
	
	// Add event listener for filter options
	document.getElementById('ftr-clear').addEventListener('click', () => {
		showEl();
	});
	document.getElementById('ftr-stock-photos').addEventListener('click', () => {
		filters("stock");
	});
	document.getElementById('ftr-icons').addEventListener('click', () => {
		filters("icons");
	});
	document.getElementById('ftr-fonts').addEventListener('click', () => {
		filters("fonts");
	});
	document.getElementById('ftr-mockups').addEventListener('click', () => {
		filters("mockups");
	});
	document.getElementById('ftr-ui-elements').addEventListener('click', () => {
		filters("kits");
	});
	
	search();
})();

// Displays assets once browse btn is clicked
ipcRenderer.on('getAssets', (event, filtered, filePath) => {	
	document.getElementById('browse').style.display = 'none';
	let jsonFilePath = [filePath.replace(/\\/g,"\\") + "\\"];
	
	fs.writeFile(path.join(app.getPath('userData'), 'dir.json'), JSON.stringify(jsonFilePath, null, '\t'), (err) => {
		if (err) console.log(err);
	});
	
	let aPath = filePath + "\\";
	uArray = filtered;
	initAssets(filtered, aPath);
});

// Process and append each asset
function initAssets(array, aPath) {
	progTotal = array.length;
	
	for (let i = array.length; i-- > 0;) {
		process(array, i, aPath);

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
function process(image, count, aPath) {
	// Format path strings
	let src = image[count].path.replace(/\\/g,"/"),
		fileName = path.basename(image[count].path).replace(/\.[^.]+$/g,""),
		tagPath = image[count].path.replace(aPath, ""), // Remove dir from path
		assetTags = tagPath.toLowerCase().replace(/\\/g," ").split(" "); // Create array of tags
	
	// Process image
	pImg.processImage(src, count).then((path) => {
		let formattedPath = path.replace(/\\/g,"/"),
			assetID = count.toString();
		
		// Push file info to array
		pFiles.push({id: assetID, file: formattedPath, name: fileName, og: src, tags: assetTags});
		
		jsonFiles.push({id: assetID, file: formattedPath, name: fileName, og: src, tags: assetTags});
		
		// Filter out processed image from array
		uArray = uArray.filter(item => item.path != image[count].path);
		
		// Create html for images
		genHtml(fileName, formattedPath, src, assetID);
		
		// Update progress bar
		let progUp = (progAmt / progTotal) * 100;
		
		console.log(progUp.toFixed());
		document.getElementById('progBar').MaterialProgress.setProgress(progUp.toFixed());
		
		// Iterate progress
		progAmt++;
	});
};

// Displays processed files
function jsonDisplay() {
	fs.readFile(jFiles, (err, data) => {
		if (err) throw err;
		
		jsonFiles = JSON.parse(data);
		
		for (let i = 0; i < jsonFiles.length; i++) {
			genHtml(jsonFiles[i].name, jsonFiles[i].file, jsonFiles[i].og, jsonFiles[i].id);
		}
	});
}

// Create HTML elements and display images
function genHtml(fName, fPath, ogPath, id) {
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
	divImg.id = id;
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

			const j = JSON.parse(data),
				  newFiles = j.concat(array);

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

// Search assets
function search() {
	let elements = document.getElementsByClassName('asset-img');
	
	document.getElementById('searchBar').addEventListener('keyup', () => {
		let searchVal = document.getElementById('searchBar').value,
			results = filterSearch(jsonFiles, searchVal);

		if (searchVal !== '') {
			for (let i = 0; i < elements.length; i++) {
				elements[i].style.display = 'none';
			}
		} else {
			for (let i = 0; i < elements.length; i++) {
				elements[i].style.display = 'flex';
			}
		}
		
		for (let i = 0; i < results.length; i++) {
			console.log(results[i]);
			document.getElementById(results[i].id).style.display = "flex";
		}
	});
}

function filterSearch(arr, searchString) {
	return arr.filter(obj => Object.keys(obj).some(key => obj[key].includes(searchString)));
}

// Promise version -- ATTEMPT
function pFilterSearch(arr, searchString) {
	return new Promise((resolve) => {
		resolve(arr.filter(obj => Object.keys(obj).some(key => obj[key].includes(searchString))));
	});
}

function filters(option) {
	let elements = document.getElementsByClassName('asset-img');
	
	for (let i = 0; i < elements.length; i++) {
		elements[i].style.display = 'none';
	}
	
	pFilterSearch(jsonFiles, option).then((results) => {
		for (let i = 0; i < results.length; i++) {
			document.getElementById(results[i].id).style.display = "flex";
		}
	});
}

function showEl() {
	let elements = document.getElementsByClassName('asset-img');
	
	for (let i = 0; i < elements.length; i++) {
		elements[i].style.display = 'flex';
	}
}