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
	let allFiles = [];
	
	var filePaths = dialog.showOpenDialog({
		properties: ['openDirectory']
	});
	
	for (var filePath of filePaths) {
		console.log(filePath);
	}

	walkSync(filePath, (curPath, stat, fileType) => {
		allFiles.push({ 
			path: curPath,
			type: fileType
		});
	});

	//saveJSON(allFiles);
	
	event.sender.send('getAssets', allFiles);
})


// Walk through all directories to find paths
function walkSync(currentDirPath, callback) {
	fs.readdirSync(currentDirPath).forEach(file => {
		let curPath = path.join(currentDirPath, file);
		let stat = fs.statSync(curPath);
		let fileType = path.extname(curPath);
		if (stat.isFile()) {
			if (fileType == '.jpg') {
				callback(curPath, stat, fileType);
			}
			//callback(curPath, stat, fileType);
		} else if (stat.isDirectory()) {
			walkSync(curPath, callback);
		}
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