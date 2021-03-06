'use strict'

require('babel-core').transform('code');
require('babel-polyfill');

// Electron requires
const {ipcRenderer} = require('electron'),
	  {shell} = require('electron'),
	  {app} = require('electron').remote,
		{requireTaskPool} = require('electron-remote');

// Module requires
const remote = require('electron').remote,
	  fs = require('fs'),
	  path = require('path'),
	  chokidar = require('chokidar'),
	  pImg = requireTaskPool(require.resolve('./public/js/imgProcess'));

// Path variables
const jFiles = path.join(app.getPath('userData'), 'files.json'),
		unFiles = path.join(app.getPath('userData'), 'unprocessed.json'),
	  dirFile = path.join(app.getPath('userData'), 'dir.json'),
	  watcherFile = path.join(app.getPath('userData'), 'watched.json'),
		thumbnails = path.join(app.getPath('userData'), '.thumbnails');

// Global variables
let docFrag = document.createDocumentFragment(),
	pFiles = [],
	uArray = [],
	jsonFiles = [],
	watched = [],
	reusableIndex = [],
	filesIndex = 0,
	progTotal = 0,
	progAmt = 1,
	dir;

// Window controls and browse functionality
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
		// Save json if there have been changes
		saveJson();

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

		app.quit();
	}, false);

	ipcRenderer.send('startWatching');

	// Fetch dir chosen by user
	if (fs.existsSync(dirFile)) {
		fs.readFile(dirFile, (err, data) => {
			if (err) throw err;

			dir = JSON.parse(data);

			let dirText = document.createTextNode(dir)
			document.getElementById('cur-user-dir').appendChild(dirText);
		});
	}

	// If files have been processed, display them
	if (fs.existsSync(jFiles)) {
		jsonDisplay((done) => {
			// If unprocessed images, continue processing them
			if (fs.existsSync(unFiles)) {
				fs.readFile(unFiles, (err, data) => {
					if (err) throw err;

					const unJson = JSON.parse(data);
					uArray = unJson;
					initAssets(unJson, dir[0]);
				});
			}
			ipcRenderer.send('addWatch', dir);
		});
	} else {
		document.getElementById('browse').style.display = 'block';
	}

	// Send message to main process to load files
	document.getElementById('browse-files').addEventListener('click', () => {
		ipcRenderer.send('loadAssets');
	});

	// Send message when changing directories
	document.getElementById('change-dir').addEventListener('click', () => {
		ipcRenderer.send('loadAssets');
	});

	// Initially hide progress bar
	document.getElementById('progCont').style.display = 'none';

	search();
	fL();
})();

// Displays assets when directory is chosen
ipcRenderer.on('getAssets', (event, filtered, filePath) => {
	let curDir = document.getElementById('cur-user-dir'),
			browse = document.getElementById('browse');
	if (browse != null) {
		browse.style.display = 'none';
	}
	dir = [filePath.replace(/\\/g,"/") + "/"];

	// Change current directory chosen in settings
	let dirText = document.createTextNode(dir);
	if (curDir.innerHTML == "") {
		curDir.appendChild(dirText);
	} else {
		curDir.innerHTML = "";
		curDir.appendChild(dirText);
	}


	fs.writeFile(dirFile, JSON.stringify(dir, null, '\t'), (err) => {
		if (err) console.log(err);
	});

	uArray = filtered;
	initAssets(filtered, dir);
});

// Process and append each asset
function initAssets(array, aPath) {
	progTotal = array.length;

	if (jsonFiles.length != 0) {
		for (let i = 0; i < jsonFiles.length; i++) {
			reusableIndex.push(i);
			delete jsonFiles[i];
		}
	}

	for (let i = array.length; i-- > 0;) {
		if (reusableIndex.length > 0) {
			let index = reusableIndex.shift();
			process(array[i].path, index, aPath);
		} else {
			process(array[i].path, filesIndex, aPath);
			filesIndex++;
		}
	}
}

// Process Images
function process(image, id, aPath) {

	// Format path strings
	let src = image.replace(/\\/g,"/"),
		fileName = path.basename(image).replace(/\.[^.]+$/g,""),
		tagPath = src.replace(aPath, ""), // Remove dir from path
		assetTags = tagPath.toLowerCase().replace(/\W|_/g," ").split(" "); // Create array of tags

		//console.log(src, aPath, tagPath);

	// Process image
	pImg.processImage(src, id).then((path) => {
		let formattedPath = path.replace(/\\/g,"/");

		// Push file info to array
		pFiles.push({id: id, file: formattedPath, name: fileName, og: src, tags: assetTags});
		jsonFiles[id] = {id: id, file: formattedPath, name: fileName, og: src, tags: assetTags};

		// Filter out processed image from array
		uArray = uArray.filter(item => item.path != image);

		// Create html for images
		genHtml(fileName, formattedPath, src, id, assetTags[0]);

		if (progTotal != 0 ) {
			progressBar();
			progAmt++;
		}
	});
};

// Displays processed files
function jsonDisplay(done) {
	fs.readFile(jFiles, (err, data) => {
		if (err) throw err;

		jsonFiles = JSON.parse(data);

		for (let i = 0; i < jsonFiles.length; i++) {
			// Add undefined to reusableIndex, remove missing assets, or gen html
			if (jsonFiles[i] === null) {
				reusableIndex.push(i);
			} else if (!fs.existsSync(jsonFiles[i].og)) {
				reusableIndex.push(jsonFiles[i].id);
				fs.unlink(jsonFiles[i].file, (err) => {
					if (err) console.log(err);
				});
				delete jsonFiles[i];
			} else {
				genHtml(jsonFiles[i].name, jsonFiles[i].file, jsonFiles[i].og, jsonFiles[i].id, jsonFiles[i].tags[0]);
			}

			filesIndex++;
			if (i === jsonFiles.length - 1) {
				return done();
			}
		}
	});
}

// Create HTML elements and display images
function genHtml(fName, fPath, ogPath, id, aTag) {
	// HTML gen test
	const assetCard = document.createElement('div'),
				imgId = 'image-' + id,
				openBtn = 'open-btn-' + id,
				openTxt = 'open-txt-' + id;

	assetCard.className = 'asset-img';
	assetCard.id = id;
	assetCard.innerHTML = `
		<div class="image-node" id="` + imgId + `">
			<div class="open-btn" id="` + openBtn + `">
				<img class="open-icon" src="./public/img/open-icon.png">
			</div>
			<img src="` + fPath + `">
			<p class="open-txt" id="` + openTxt + `">open file location</p>
		</div>
		<p class="asset-title">` + fName + `</p>
		<p class="asset-tag">#` + aTag + `</p>
	`;

	// Append elements to containers
	docFrag.appendChild(assetCard);
	document.getElementById('asset-feed').appendChild(docFrag);

	// Add hover events
	const openBtnNode = document.getElementById(openBtn),
				openTxtNode = document.getElementById(openTxt);

	document.getElementById(imgId).addEventListener('mouseover', () => {
		openBtnNode.style.display = 'block';
		openTxtNode.style.display = 'block';
	}, false);
	document.getElementById(imgId).addEventListener('mouseout', () => {
		openBtnNode.style.display = 'none';
		openTxtNode.style.display = 'none';
	}, false);

	// Add click events
	document.getElementById(imgId).addEventListener('click', () => {
		shell.showItemInFolder(ogPath);
	}, false);
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
				//console.log(results[i]);
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

// Filter event listeners
function fL() {
	document.getElementById('ftr-clear').addEventListener('click', () => {
		showEl();
		let activeFilter = document.getElementsByClassName('filter-active'),
				activeFilterBtn = document.getElementsByClassName('filter-btn-active');
		for (let i = 0; i < activeFilter.length; i++) {
			activeFilter[i].classList.remove('filter-active');
		}
		activeFilterBtn[0].classList.remove('filter-btn-active');
	});
	document.getElementById('ftr-stock-photos').addEventListener('click', () => {
		filters("stock");
		document.getElementById('ftr-stock-photos').classList.add('filter-active');
		document.getElementById('filter-btn').classList.add('filter-btn-active');
	});
	document.getElementById('ftr-icons').addEventListener('click', () => {
		filters("icons");
		document.getElementById('ftr-icons').classList.add('filter-active');
		document.getElementById('filter-btn').classList.add('filter-btn-active');
	});
	document.getElementById('ftr-fonts').addEventListener('click', () => {
		filters("fonts");
		document.getElementById('ftr-fonts').classList.add('filter-active');
		document.getElementById('filter-btn').classList.add('filter-btn-active');
	});
	document.getElementById('ftr-mockups').addEventListener('click', () => {
		filters("mockups");
		document.getElementById('ftr-mockups').classList.add('filter-active');
		document.getElementById('filter-btn').classList.add('filter-btn-active');
	});
	document.getElementById('ftr-ui-elements').addEventListener('click', () => {
		filters("kits");
		document.getElementById('ftr-ui-elements').classList.add('filter-active');
		document.getElementById('filter-btn').classList.add('filter-btn-active');
	});

	// Settings overlay - window drag fix
	document.getElementById('settings').addEventListener('click', () => {
		document.getElementById('ovr').style.display = 'inline-block';
		document.getElementById('inr-ovr').style.display = 'inline-block';
		document.getElementById('header').style.webkitAppRegion = 'no-drag';
	});
	document.getElementById('ovr').addEventListener('click', () => {
		document.getElementById('ovr').style.display = 'none';
		document.getElementById('inr-ovr').style.display = 'none';
		document.getElementById('header').style.webkitAppRegion = 'drag';
	});
	document.getElementById('ovr-close').addEventListener('click', () => {
		document.getElementById('ovr').style.display = 'none';
		document.getElementById('inr-ovr').style.display = 'none';
		document.getElementById('header').style.webkitAppRegion = 'drag';
	});
}

// Show and update progress bar
function progressBar() {
	let progUp = (progAmt / progTotal) * 100;

	if (progUp.toFixed() != 100) {
		document.getElementById('progCont').style.display = 'block';
		document.getElementById('container').style.top = '160px';
	} else {
		// Currently sending message here to make sure it's watched after assets are finished processing
		ipcRenderer.send('addWatch', dir);
		setTimeout(() => {
			progAmt = 1; // Reset progress bar for future
			document.getElementById('progCont').style.display = 'none';
			document.getElementById('container').style.top = '110px';
		}, 1000);
	}

	document.getElementById('progAmt').innerHTML = "(" + progAmt + "/" + progTotal + ")";
	document.getElementById('progBar').MaterialProgress.setProgress(progUp.toFixed());
}


// Added file to watcher
ipcRenderer.on('addWatchFile', (event, path) => {
	if (path.split('.').pop() === 'jpg') {
		let fPath = path.replace(/\\/g,"/");

		// Check for file path in jsonFiles
		// If it doesn't exist, process and add it
		findAsset(jsonFiles, "og", fPath).then((results) => {
			if (results === -1) {
				uArray.push({path: path});

				if (reusableIndex.length > 0) {
					let index = reusableIndex.shift();
					process(path, index, dir[0]);
				} else {
					process(path, filesIndex, dir[0]);
					filesIndex++;
				}
			}
		});
	}
});

// Removed file from watcher
ipcRenderer.on('removeWatchFile', (event, path) => {
	if (path.split('.').pop() === 'jpg') {
		let fPath = path.replace(/\\/g,"/");

		// Find and delete assets from DOM, JSON, and thumbnails
		findAsset(jsonFiles, "og", fPath).then((results) => {
			let thumbPath = thumbnails + '\\' + results + '.webp';
			reusableIndex.push(results);
			document.getElementById(results).remove();
			fs.unlink(thumbPath, (err) => {
				if (err) console.log(err);
			});
			delete jsonFiles[results];
		});
	}
});

// Clear DOM
ipcRenderer.on('clearDOM', (event) => {
	let domEl = document.getElementById('asset-feed');
	while (domEl.lastChild) {
		domEl.removeChild(domEl.lastChild);
	}
});

// Find asset in array
function findAsset(arr, prop, value) {
	return new Promise((resolve) => {
		resolve(arr.findIndex((obj) => {
			if (obj != null) {
				return obj[prop] === value;
			}
		}));
	});
}

// Save JSON file at close
function saveJson() {
	if (pFiles.length > 0 || reusableIndex.length > 0) {
		fs.writeFile(jFiles, JSON.stringify(jsonFiles, null, '\t'), (err) => {
			if (err) console.log(err);
		});
	}
}
