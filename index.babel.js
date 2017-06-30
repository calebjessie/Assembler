'use strict';

require('babel-core').transform('code');
require('babel-polyfill');

// Electron requires

var _require = require('electron'),
    ipcRenderer = _require.ipcRenderer,
    _require2 = require('electron'),
    shell = _require2.shell,
    _require3 = require('electron-remote'),
    requireTaskPool = _require3.requireTaskPool,
    app = require('electron').remote.app;

// Module requires


var remote = require('electron').remote,
    fs = require('fs'),
    path = require('path'),
    chokidar = require('chokidar'),
    pImg = requireTaskPool(require.resolve('./public/js/imgProcess'));

// Path variables
var jFiles = path.join(app.getPath('userData'), 'files.json'),
    unFiles = path.join(app.getPath('userData'), 'unprocessed.json'),
    dirFile = path.join(app.getPath('userData'), 'dir.json'),
    watcherFile = path.join(app.getPath('userData'), 'watched.json');

// Global variables
var docFrag = document.createDocumentFragment(),
    pFiles = [],
    rFiles = [],
    uArray = [],
    jsonFiles = [],
    watched = [],
    reusableIndex = [],
    filesIndex = 0,
    progTotal = 0,
    progAmt = 0,
    dir = void 0,
    watcher = void 0;

// Window controls and browse functionality
(function () {
	document.getElementById('min-btn').addEventListener('click', function () {
		remote.getCurrentWindow().minimize();
	}, false);

	document.getElementById('max-btn').addEventListener('click', function () {
		if (!remote.getCurrentWindow().isMaximized()) {
			remote.getCurrentWindow().maximize();
		} else {
			remote.getCurrentWindow().unmaximize();
		}
	}, false);

	document.getElementById('close-btn').addEventListener('click', function () {
		// Add processed images to files.json if app quit before finishing
		if (pFiles.length > 0) {
			addFiles(pFiles);
		} else {
			app.quit();
		}

		// All images processed? Remove file. If not, save list.
		if (uArray.length === 0) {
			fs.unlink(unFiles, function (err) {
				if (err) throw err;
			});
		} else {
			fs.writeFile(unFiles, JSON.stringify(uArray, null, '\t'), function (err) {
				if (err) console.log(err);
			});
		}
	}, false);

	// Fetch dir chosen by user and watch it
	if (fs.existsSync(dirFile)) {
		fs.readFile(dirFile, function (err, data) {
			if (err) throw err;

			dir = JSON.parse(data);
			watchDir(dir);
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
		fs.readFile(unFiles, function (err, data) {
			if (err) throw err;

			var unprocessedJson = JSON.parse(data);
			uArray = unprocessedJson;
			initAssets(unprocessedJson, dir[0]);
		});
	}

	// Send message to main process to load files
	document.getElementById('browse-files').addEventListener('click', function () {
		ipcRenderer.send('loadAssets');
	});

	// Initially hide progress bar
	document.getElementById('progCont').style.display = 'none';

	search();
	fL();
})();

// Displays assets once browse btn is clicked
ipcRenderer.on('getAssets', function (event, filtered, filePath) {
	document.getElementById('browse').style.display = 'none';
	var jsonFilePath = [filePath.replace(/\\/g, "\\") + "\\"];

	fs.writeFile(path.join(app.getPath('userData'), 'dir.json'), JSON.stringify(jsonFilePath, null, '\t'), function (err) {
		if (err) console.log(err);
	});

	var aPath = filePath + "\\";
	uArray = filtered;
	initAssets(filtered, aPath);
});

// Process and append each asset
function initAssets(array, aPath) {
	progTotal = array.length;

	for (var i = array.length; i-- > 0;) {
		process(array[i].path, filesIndex, aPath);
		filesIndex++;
		// If at end of array, save json. Prevent overwritting. Use addFiles()
		if (i === 0) {

			if (fs.existsSync(jFiles)) {
				fs.readFile(jFiles, function (err, data) {
					if (err) throw err;

					var jsonFiles = JSON.parse(data),
					    newFiles = jsonFiles.concat(pFiles);

					fs.writeFile(jFiles, JSON.stringify(newFiles, null, '\t'), function (err) {
						if (err) throw err;
					});
				});
			} else {
				fs.writeFile(jFiles, JSON.stringify(pFiles), function (err) {
					if (err) console.log(err);
				});
			}
		}
	}
}

// Process Images
function process(image, id, aPath) {
	// Format path strings
	var src = image.replace(/\\/g, "/"),
	    fileName = path.basename(image).replace(/\.[^.]+$/g, ""),
	    tagPath = image.replace(aPath, ""),
	    // Remove dir from path
	assetTags = tagPath.toLowerCase().replace(/\W|_/g, " ").split(" "); // Create array of tags

	// Process image
	pImg.processImage(src, id).then(function (path) {
		var formattedPath = path.replace(/\\/g, "/");

		// Push file info to array
		pFiles.push({ id: id, file: formattedPath, name: fileName, og: src, tags: assetTags });
		jsonFiles.push({ id: id, file: formattedPath, name: fileName, og: src, tags: assetTags });

		// Filter out processed image from array
		uArray = uArray.filter(function (item) {
			return item.path != image;
		});
		// Create html for images
		genHtml(fileName, formattedPath, src, id, assetTags[0]);

		if (progTotal != 0) {
			progressBar();
			progAmt++;
		}
	});
};

// Displays processed files
function jsonDisplay() {
	fs.readFile(jFiles, function (err, data) {
		if (err) throw err;

		jsonFiles = JSON.parse(data);
		console.log(jsonFiles);

		for (var i = 0; i < jsonFiles.length; i++) {
			genHtml(jsonFiles[i].name, jsonFiles[i].file, jsonFiles[i].og, jsonFiles[i].id, jsonFiles[i].tags[0]);
			filesIndex++;
		}
	});
}

// Create HTML elements and display images
function genHtml(fName, fPath, ogPath, id, aTag) {
	// Create html elements
	var divImg = document.createElement('div'),
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
	openIcon.src = './public/img/open-icon.png';
	img.src = fPath;

	// Add hover events
	imageNode.addEventListener('mouseover', function () {
		openBtn.style.display = 'block';
		openTxt.style.display = 'block';
	}, false);
	imageNode.addEventListener('mouseout', function () {
		openBtn.style.display = 'none';
		openTxt.style.display = 'none';
	}, false);

	// Add click events
	imageNode.addEventListener('click', function () {
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
		fs.readFile(jFiles, function (err, data) {
			if (err) throw err;

			var j = JSON.parse(data),
			    newFiles = j.concat(array);

			fs.writeFile(jFiles, JSON.stringify(newFiles, null, '\t'), function (err) {
				if (err) throw err;

				app.quit();
			});
		});
	} else {
		fs.writeFile(jFiles, JSON.stringify(array, null, '\t'), function (err) {
			if (err) throw err;

			app.quit();
		});
	}
}

// Search assets
function search() {
	var elements = document.getElementsByClassName('asset-img');

	document.getElementById('searchBar').addEventListener('keyup', function () {
		var searchVal = document.getElementById('searchBar').value;

		if (searchVal !== '') {
			for (var i = 0; i < elements.length; i++) {
				elements[i].style.display = 'none';
			}
		} else {
			for (var _i = 0; _i < elements.length; _i++) {
				elements[_i].style.display = 'flex';
			}
		}

		pFilterSearch(jsonFiles, searchVal.toLowerCase()).then(function (results) {
			for (var _i2 = 0; _i2 < results.length; _i2++) {
				console.log(results[_i2]);
				document.getElementById(results[_i2].id).style.display = "flex";
			}
		});
	});
}

function pFilterSearch(arr, searchString) {
	return new Promise(function (resolve) {
		resolve(arr.filter(function (obj) {
			return obj.tags.some(function (tag) {
				return tag.includes(searchString);
			});
		}));
	});
}

function filters(option) {
	var elements = document.getElementsByClassName('asset-img');

	for (var i = 0; i < elements.length; i++) {
		elements[i].style.display = 'none';
	}

	pFilterSearch(jsonFiles, option).then(function (results) {
		for (var _i3 = 0; _i3 < results.length; _i3++) {
			document.getElementById(results[_i3].id).style.display = "flex";
		}
	});
}

function showEl() {
	var elements = document.getElementsByClassName('asset-img');

	for (var i = 0; i < elements.length; i++) {
		elements[i].style.display = 'flex';
	}
}

// Filter event listeners
function fL() {
	document.getElementById('ftr-clear').addEventListener('click', function () {
		showEl();
	});
	document.getElementById('ftr-stock-photos').addEventListener('click', function () {
		filters("stock");
	});
	document.getElementById('ftr-icons').addEventListener('click', function () {
		filters("icons");
	});
	document.getElementById('ftr-fonts').addEventListener('click', function () {
		filters("fonts");
	});
	document.getElementById('ftr-mockups').addEventListener('click', function () {
		filters("mockups");
	});
	document.getElementById('ftr-ui-elements').addEventListener('click', function () {
		filters("kits");
	});
}

// Show and update progress bar
function progressBar() {
	var progUp = progAmt / progTotal * 100;

	if (progUp.toFixed() != 100) {
		document.getElementById('progCont').style.display = 'block';
		document.getElementById('container').style.top = '160px';
	} else {
		setTimeout(function () {
			document.getElementById('progCont').style.display = 'none';
			document.getElementById('container').style.top = '110px';
		}, 1000);
	}

	document.getElementById('progBar').MaterialProgress.setProgress(progUp.toFixed());
}

// Create watcher for dir changes
function watchDir(dir) {
	watcher = chokidar.watch(dir, {
		ignored: /(^|[\/\\])\../,
		ignoreInitial: true,
		persistent: true
	});

	// For now, only when it's a jpg
	watcher.on('add', function (path) {
		if (path.split('.').pop() === 'jpg') {
			uArray.push({ path: path });
			if (reusableIndex.length > 0) {
				var index = reusableIndex.shift();
				process(path, index, dir);
			} else {
				process(path, filesIndex, dir);
				filesIndex++;
				console.log(jsonFiles);
			}
		}
	}).on('unlink', function (path) {
		if (path.split('.').pop() === 'jpg') {
			var fPath = path.replace(/\\/g, "/");

			// Find and delete assets from DOM and JSON
			findAsset(jsonFiles, "og", fPath).then(function (results) {
				reusableIndex.push(results);
				document.getElementById(jsonFiles[results].id).remove();
				rFiles.push(jsonFiles[results]);
				delete jsonFiles[results];
				console.log(rFiles);
			});
		}
	});
}

// Find asset in array
function findAsset(arr, prop, value) {
	return new Promise(function (resolve) {
		resolve(arr.findIndex(function (obj) {
			return obj[prop] === value;
		}));
	});
}
