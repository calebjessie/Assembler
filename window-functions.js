// Create window controls
const remote = require('electron').remote;
	
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