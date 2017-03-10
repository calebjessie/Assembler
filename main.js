const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const path = require('path'),
	  url = require('url'),
	  fs = require('fs'),
	  states = require('states');

let win;

function createWindow () {
	let lastWindowState = states.get("lastWindowState");
	
	if (lastWindowState === null) {
		lastWindowState = {
			width: 1124,
			height: 768,
			maximized: false,
			frame: false
		}
	}
	
	win = new BrowserWindow({
		x: lastWindowState.x,
		y: lastWindowState.y,
		width: lastWindowState.width,
		height: lastWindowState.height,
		frame: false
	});
	
	if (lastWindowState.maximized) {
		win.maximize();
	}
	
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}));
	
	win.webContents.openDevTools()
	
	win.on('close', () => {
		let bounds = win.getBounds();
		
		states.set("lastWindowState", {
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			maximized: win.isMaximized()
		});
	});
	
	win.on('closed', () => {
		win = null;
	});
}

// Send window information
ipcMain.on('window', (event, args) => {
	event.sender.send('getWin', win);
})

app.on('ready', createWindow);

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
})

app.on('activate', () => {
	if (win === null) {
		createWindow();
	}
})


// Load Assets
ipcMain.on('loadAssets', (event, args) => {
	
	var filePaths = dialog.showOpenDialog({
		properties: ['openDirectory']
	});
	
	for (var filePath of filePaths) {
		console.log(filePath);
	}
	
	walk(filePath, (err, allFiles) => {
		if (err) throw err;
		//console.log(allFiles);
		let filtered = allFiles.filter(filterFiles)
		function filterFiles(files) {
			return files.fileType === '.jpg';
		}
		event.sender.send('getAssets', filtered);
	});

	//saveJSON(allFiles);
})

// Async walk version
function walk(dir, done) {
	let allFiles = [];
	
	fs.readdir(dir, (err, files) => {
		if (err) return done(err);
		let pendingFiles = files.length;
		if (!pendingFiles) return done(null, results);

		files.forEach(filePath => {
			filePath = path.resolve(dir, filePath);
			
			fs.stat(filePath, (err, stats) => {
				if (stats && stats.isDirectory()) {
					walk(filePath, (err, res) => {
						allFiles = allFiles.concat(res);

						if (pendingFiles === 1) {
							return done(err, allFiles);
						} else {
							pendingFiles -= 1;
						}
					});
				} else {
					allFiles.push({
						path: filePath,
						fileType: path.extname(filePath)
					});

					if (pendingFiles === 1) {
						return done(err, allFiles);
					} else {
						pendingFiles -= 1;
					}
				}
			});
		});
	});
}


// Save array to JSON
function saveJSON(array) {
	let addFiles = JSON.stringify(array, null, "\t");
	
	fs.writeFile('files.json', addFiles, (err) => {
		if (err) throw err;
		console.log("Saved file.");
	});
}