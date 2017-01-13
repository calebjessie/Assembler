// Create window controls
const remote = require('electron').remote;
	
function init() {
	document.getElementById("min-btn").addEventListener("click", function(e) {
		/*const window = remote.getCurrentWindow();
		window.minimize();*/
		console.log('Min');
	});

	document.getElementById("max-btn").addEventListener("click", function(e) {
		/*const window = remote.getCurrentWindow();
		if (!window.isMaximized()) {
			window.maximize();
		} else {
			window.unmaximize();
		}*/
		console.log('Max');
	});

	document.getElementById("close-btn").addEventListener("click", function(e) {
		/*const window = remote.getCurrentWindow();
		window.close();*/
		console.log('Close');
	});

	document.onreadystatechange = function() {
		if (document.readyState == "complete") {
			init();
		}
	};
};