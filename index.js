const remote = require('electron').remote;
const fs = require('fs');

// Create window controls
(function() {
	document.getElementById('min-btn').addEventListener('click', function(e) {
		const window = remote.getCurrentWindow();
		window.minimize();
	});

	document.getElementById('max-btn').addEventListener('click', function(e) {
		const window = remote.getCurrentWindow();
		if (!window.isMaximized()) {
			window.maximize();
		} else {
			window.unmaximize();
		}
	});

	document.getElementById('close-btn').addEventListener('click', function(e) {
		const window = remote.getCurrentWindow();
		window.close();
	});
})();

// Create directory browse
const browseDir = function() {
	document.getElementById('browse-files').addEventListener('click', function(e) {
		const window = remote.getCurrentWindow();
		dialog.showOpenDialog({
			properties: ['openDirectory']
			/*
			filters: [
				{name: 'Images', extensions: ['jpg', 'png']}
			]*/
		});
	});
}

browseDir();





// Has the user chosen a asset directory?
//if () {
	// Display feed
//} else {
	// User browses for directory
//}