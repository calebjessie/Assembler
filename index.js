'use strict'

require("babel-core").transform("code");

const {ipcRenderer} = require('electron');
const {shell} = require('electron');
const {requireTaskPool} = require('electron-remote');
const {app} = require('electron').remote;

const remote = require('electron').remote,
	  fs = require('fs'),
	  path = require('path'),
	  chokidar = require('chokidar'),
	  low = require('lowdb'),
	  pImg = requireTaskPool(require.resolve('./scripts/imgProcess')),
	  jFiles = path.join(app.getPath('userData'), 'files.json'),
	  unFiles = path.join(app.getPath('userData'), 'unprocessed.json'),
	  dirFile = path.join(app.getPath('userData'), 'dir.json'),
	  watcherFile = path.join(app.getPath('userData'), 'watched.json');

let docFrag = document.createDocumentFragment(),
	pFiles = [],
	uArray = [],
	jsonFiles = [],
	watched = [],
	progTotal = 0,
	progAmt = 0,
	dir,
	watcher;

const db = low('db.json'); // Create database in memory
db.defaults({ assets: [] }) // Write defaults if empty
	.write();

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
		
		// Save json of all files being watched at app quit
/*		if (watcher !== null) {
			let w = JSON.stringify(watched, null, '\t');
				
			fs.writeFile(path.join(app.getPath('userData'), 'watched.json'), w, (err) => {
				if (err) console.log(err);
			});
		}*/

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
		
	// Fetch dir chosen by user and watch it
	if (fs.existsSync(dirFile)) {
		fs.readFile(dirFile, (err, data) => {
			if (err) throw err;

			dir = JSON.parse(data);
			
			/*if (fs.existsSync(watcherFile)) {
				fs.readFile(watcherFile, (err, data) => {
					if (err) console.log(err);
					
					let wFiles = JSON.parse(data);
					watchFiles();
					watcher.add(wFiles);
				});
			} else {
				watchFiles();
				watcher.add(dir[0] + "\**\\*.jpg");
			}*/
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
	
	// Initially hide progress bar
	document.getElementById('progCont').style.display = 'none';
	
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
		assetTags = tagPath.toLowerCase().replace(/\W|_/g," ").split(" "); // Create array of tags
	
	// Process image
	pImg.processImage(src, count).then((path) => {
		let formattedPath = path.replace(/\\/g,"/"),
			assetID = count.toString();
		
		// Add asset to db
		db.get('assets')
			.push({ id: assetID, file: formattedPath, name: fileName, og: src, tags: assetTags })
			.write();
		
		// Push file info to array
		pFiles.push({id: assetID, file: formattedPath, name: fileName, og: src, tags: assetTags});
		
		jsonFiles.push({id: assetID, file: formattedPath, name: fileName, og: src, tags: assetTags});
		
		// Filter out processed image from array
		uArray = uArray.filter(item => item.path != image[count].path);
		
		// Create html for images
		genHtml(fileName, formattedPath, src, assetID, assetTags[0]);
		
		progressBar();
		
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
			genHtml(jsonFiles[i].name, jsonFiles[i].file, jsonFiles[i].og, jsonFiles[i].id, jsonFiles[i].tags[0]);
		}
	});
}

// Create HTML elements and display images
function genHtml(fName, fPath, ogPath, id, aTag) {
	// Create html elements
	let divImg = document.createElement('div'),
		imageNode = document.createElement('div'),
		imgName = document.createElement('p'),
		assetTag = document.createElement('p'),
		img = document.createElement('img'),
		text = document.createTextNode(fName),
		openBtn = document.createElement('div'),
		openTxt = document.createElement('p'),
		openTxtValue = document.createTextNode('open file location'),
		openIcon = document.createElement('img'),
		type = document.createTextNode('#' + aTag);

	// Create styles and add file path to div
	divImg.className = 'asset-img';
	divImg.id = id;
	imgName.className = 'asset-title';
	assetTag.className = 'asset-tag';
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
	imageNode.addEventListener('click', () => {
		shell.showItemInFolder(ogPath);
	}, false);

	// Append elements to containers
	docFrag.appendChild(divImg);
	divImg.appendChild(imageNode);
	divImg.appendChild(imgName);
	divImg.appendChild(assetTag);
	imageNode.appendChild(openBtn);
	imageNode.appendChild(img);
	imageNode.appendChild(openTxt);
	openTxt.appendChild(openTxtValue);
	imgName.appendChild(text);
	assetTag.appendChild(type);
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
		let searchVal = document.getElementById('searchBar').value;

		if (searchVal !== '') {
			for (let i = 0; i < elements.length; i++) {
				elements[i].style.display = 'none';
			}
		} else {
			for (let i = 0; i < elements.length; i++) {
				elements[i].style.display = 'flex';
			}
		}
		
		pFilterSearch(jsonFiles, searchVal.toLowerCase()).then((results) => {
			for (let i = 0; i < results.length; i++) {
				console.log(results[i]);
				document.getElementById(results[i].id).style.display = "flex";
			}
		});
	});
}

function pFilterSearch(arr, searchString) {
	return new Promise((resolve) => {
		resolve(arr.filter(obj => obj.tags.some(tag => tag.includes(searchString))));
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

// Show and update progress bar
function progressBar() {
	let progUp = (progAmt / progTotal) * 100;
		
	if (progUp.toFixed() != 100) {
		document.getElementById('progCont').style.display = 'block';
		document.getElementById('container').style.top = '160px';
	} else {
		setTimeout(() => {
			document.getElementById('progCont').style.display = 'none';
			document.getElementById('container').style.top = '110px';
		}, 1000);
	}
	
	document.getElementById('progBar').MaterialProgress.setProgress(progUp.toFixed());
}

// File Watcher
function watchFiles() {
	// Matcher function to ignore files - Will impliment later.
/*	let match = [
		/(^|[\/\\])\../,
		(string) => {
			let ext = string.split('.').pop();
			return ext !== '.jpg'
		}
	];*/
	
	// Initialize file watcher
	watcher = chokidar.watch('', {
		ignored: /(^|[\/\\])\../,
		persistent: true
	});

	// Watch event listeners
	watcher
		.on('add', path => {
			console.log('Added new: ' + path);
			watched.push(path);
		})
		.on('error', error => {
			console.log(error);
		})
		.on('unlink', path => {
			console.log(path + " has been removed");
		});
}