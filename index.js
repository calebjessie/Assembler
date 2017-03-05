'use strict'
const {ipcRenderer} = require('electron');
const remote = require('electron').remote,
	  jimp = require('jimp');


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
		let loopStart = 20;
		
		for (let i = 0; i < 20; i++) {
			displayAssets(arg[i].path);
		}
		
		document.getElementById('browse').style.display = 'none';
		document.getElementById('container').addEventListener('scroll', () => {
			let container = document.getElementById('container');
			
			if ((container.clientHeight + container.scrollTop) >= container.scrollHeight) {
				renderFileImages(loopStart, 20, arg);
				
				loopStart += 20;
			}
		});
	});
}


// Create html for each asset
function displayAssets(path) {
/*	let divImg = document.createElement('div');
	let bgImg = 'url("' + path.replace(/\\/g,"/") + '")';
	
	divImg.className = 'asset-img';
	divImg.style.backgroundImage = bgImg;
	
	divImg.addEventListener("mouseover", () => {
		divImg.classList.add('img-hover');
	}, false);
	divImg.addEventListener("mouseout", () => {
		divImg.classList.remove('img-hover');
	}, false);*/
	
	
	// Jimp to resize and minify images
	jimp.read(path.replace(/\\/g,"/")).then((image) => {
		image.resize(300, jimp.AUTO)
			.quality(80)
			.getBase64(jimp.MIME_JPEG, (err, src) => {
				let divImg = document.createElement('div');
				divImg.className = 'asset-img';
				divImg.style.backgroundImage = 'url(' + src + ')';
				document.getElementById('asset-feed').appendChild(divImg);
			});
	}).catch(function(err) {
		//console.error(err);	
	});
	
	
	//document.getElementById('asset-feed').appendChild(divImg);
}


// Display more assets on scroll
function renderFileImages(startPosition, length, array) {
	for(let i = startPosition; i < startPosition + length; i++) {
		displayAssets(array[i].path);
	}
}

browseDir();