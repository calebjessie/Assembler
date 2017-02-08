const remote = require('electron').remote;
const fs = require('fs');

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
	document.getElementById('browse-files').addEventListener('click', () => {
		let filePaths = remote.dialog.showOpenDialog({
			properties: ['openDirectory']
		});
		for (let filePath of filePaths) {
			console.log(filePath);
		}
	});
}

browseDir();







// Has the user chosen a asset directory?
//if () {
	// Display feed
//} else {
	// User browses for directory
//}