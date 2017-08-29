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
    watcherFile = path.join(app.getPath('userData'), 'watched.json'),
    thumbnails = path.join(app.getPath('userData'), '.thumbnails');

// Global variables
var docFrag = document.createDocumentFragment(),
    pFiles = [],
    uArray = [],
    jsonFiles = [],
    watched = [],
    reusableIndex = [],
    filesIndex = 0,
    progTotal = 0,
    progAmt = 1,
    dir = void 0;

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
		// Save json if there have been changes
		saveJson();

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

		app.quit();
	}, false);

	ipcRenderer.send('startWatching');

	// Fetch dir chosen by user
	if (fs.existsSync(dirFile)) {
		fs.readFile(dirFile, function (err, data) {
			if (err) throw err;

			dir = JSON.parse(data);

			var dirText = document.createTextNode(dir);
			document.getElementById('cur-user-dir').appendChild(dirText);
		});
	}

	// If files have been processed, display them
	if (fs.existsSync(jFiles)) {
		jsonDisplay(function (done) {
			// If unprocessed images, continue processing them
			if (fs.existsSync(unFiles)) {
				fs.readFile(unFiles, function (err, data) {
					if (err) throw err;

					var unJson = JSON.parse(data);
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
	document.getElementById('browse-files').addEventListener('click', function () {
		ipcRenderer.send('loadAssets');
	});

	// Send message when changing directories
	document.getElementById('change-dir').addEventListener('click', function () {
		ipcRenderer.send('loadAssets');
	});

	// Initially hide progress bar
	document.getElementById('progCont').style.display = 'none';

	search();
	fL();
})();

// Displays assets when directory is chosen
ipcRenderer.on('getAssets', function (event, filtered, filePath) {
	var curDir = document.getElementById('cur-user-dir'),
	    browse = document.getElementById('browse');
	if (browse != null) {
		browse.style.display = 'none';
	}
	dir = [filePath.replace(/\\/g, "/") + "/"];

	// Change current directory chosen in settings
	var dirText = document.createTextNode(dir);
	if (curDir.innerHTML == "") {
		curDir.appendChild(dirText);
	} else {
		curDir.innerHTML = "";
		curDir.appendChild(dirText);
	}

	fs.writeFile(dirFile, JSON.stringify(dir, null, '\t'), function (err) {
		if (err) console.log(err);
	});

	uArray = filtered;
	initAssets(filtered, dir);
});

// Process and append each asset
function initAssets(array, aPath) {
	progTotal = array.length;

	if (jsonFiles.length != 0) {
		for (var i = 0; i < jsonFiles.length; i++) {
			reusableIndex.push(i);
			delete jsonFiles[i];
		}
	}

	for (var _i = array.length; _i-- > 0;) {
		if (reusableIndex.length > 0) {
			var index = reusableIndex.shift();
			process(array[_i].path, index, aPath);
		} else {
			process(array[_i].path, filesIndex, aPath);
			filesIndex++;
		}
	}
}

// Process Images
function process(image, id, aPath) {

	// Format path strings
	var src = image.replace(/\\/g, "/"),
	    fileName = path.basename(image).replace(/\.[^.]+$/g, ""),
	    tagPath = src.replace(aPath, ""),
	    // Remove dir from path
	assetTags = tagPath.toLowerCase().replace(/\W|_/g, " ").split(" "); // Create array of tags

	//console.log(src, aPath, tagPath);

	// Process image
	pImg.processImage(src, id).then(function (path) {
		var formattedPath = path.replace(/\\/g, "/");

		// Push file info to array
		pFiles.push({ id: id, file: formattedPath, name: fileName, og: src, tags: assetTags });
		jsonFiles[id] = { id: id, file: formattedPath, name: fileName, og: src, tags: assetTags };

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
function jsonDisplay(done) {
	fs.readFile(jFiles, function (err, data) {
		if (err) throw err;

		jsonFiles = JSON.parse(data);

		for (var i = 0; i < jsonFiles.length; i++) {
			// Add undefined to reusableIndex, remove missing assets, or gen html
			if (jsonFiles[i] === null) {
				reusableIndex.push(i);
			} else if (!fs.existsSync(jsonFiles[i].og)) {
				reusableIndex.push(jsonFiles[i].id);
				fs.unlink(jsonFiles[i].file, function (err) {
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
			for (var _i2 = 0; _i2 < elements.length; _i2++) {
				elements[_i2].style.display = 'flex';
			}
		}

		pFilterSearch(jsonFiles, searchVal.toLowerCase()).then(function (results) {
			for (var _i3 = 0; _i3 < results.length; _i3++) {
				//console.log(results[i]);
				document.getElementById(results[_i3].id).style.display = "flex";
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
		for (var _i4 = 0; _i4 < results.length; _i4++) {
			document.getElementById(results[_i4].id).style.display = "flex";
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

	// Settings overlay - window drag fix
	document.getElementById('settings').addEventListener('click', function () {
		document.getElementById('ovr').style.display = 'inline-block';
		document.getElementById('inr-ovr').style.display = 'inline-block';
		document.getElementById('header').style.webkitAppRegion = 'no-drag';
	});
	document.getElementById('ovr').addEventListener('click', function () {
		document.getElementById('ovr').style.display = 'none';
		document.getElementById('inr-ovr').style.display = 'none';
		document.getElementById('header').style.webkitAppRegion = 'drag';
	});
	document.getElementById('ovr-close').addEventListener('click', function () {
		document.getElementById('ovr').style.display = 'none';
		document.getElementById('inr-ovr').style.display = 'none';
		document.getElementById('header').style.webkitAppRegion = 'drag';
	});
}

// Show and update progress bar
function progressBar() {
	var progUp = progAmt / progTotal * 100;

	if (progUp.toFixed() != 100) {
		document.getElementById('progCont').style.display = 'block';
		document.getElementById('container').style.top = '160px';
	} else {
		// Currently sending message here to make sure it's watched after assets are finished processing
		ipcRenderer.send('addWatch', dir);
		setTimeout(function () {
			progAmt = 1; // Reset progress bar for future
			document.getElementById('progCont').style.display = 'none';
			document.getElementById('container').style.top = '110px';
		}, 1000);
	}

	document.getElementById('progAmt').innerHTML = "(" + progAmt + "/" + progTotal + ")";
	document.getElementById('progBar').MaterialProgress.setProgress(progUp.toFixed());
}

// Added file to watcher
ipcRenderer.on('addWatchFile', function (event, path) {
	if (path.split('.').pop() === 'jpg') {
		var fPath = path.replace(/\\/g, "/");

		// Check for file path in jsonFiles
		// If it doesn't exist, process and add it
		findAsset(jsonFiles, "og", fPath).then(function (results) {
			if (results === -1) {
				uArray.push({ path: path });

				if (reusableIndex.length > 0) {
					var index = reusableIndex.shift();
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
ipcRenderer.on('removeWatchFile', function (event, path) {
	if (path.split('.').pop() === 'jpg') {
		var fPath = path.replace(/\\/g, "/");

		// Find and delete assets from DOM, JSON, and thumbnails
		findAsset(jsonFiles, "og", fPath).then(function (results) {
			var thumbPath = thumbnails + '\\' + results + '.webp';
			reusableIndex.push(results);
			document.getElementById(results).remove();
			fs.unlink(thumbPath, function (err) {
				if (err) console.log(err);
			});
			delete jsonFiles[results];
		});
	}
});

// Clear DOM
ipcRenderer.on('clearDOM', function (event) {
	var domEl = document.getElementById('asset-feed');
	while (domEl.lastChild) {
		domEl.removeChild(domEl.lastChild);
	}
});

// Find asset in array
function findAsset(arr, prop, value) {
	return new Promise(function (resolve) {
		resolve(arr.findIndex(function (obj) {
			if (obj != null) {
				return obj[prop] === value;
			}
		}));
	});
}

// Save JSON file at close
function saveJson() {
	if (pFiles.length > 0 || reusableIndex.length > 0) {
		fs.writeFile(jFiles, JSON.stringify(jsonFiles, null, '\t'), function (err) {
			if (err) console.log(err);
		});
	}
}
