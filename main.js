const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const path = require('path'),
	  url = require('url'),
	  fs = require('fs');

let win;
let allFiles = [];


function createWindow () {
	win = new BrowserWindow({width: 1124, height: 768, frame: false});
	
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}))
	
	win.webContents.openDevTools()
	
	win.on('closed', () => {
		win = null;
	})
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

	walkSync(filePath, (curPath, stat, fileType) => {
		allFiles.push({
			file: curPath,
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