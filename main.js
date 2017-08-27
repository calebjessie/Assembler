'use strict'
const {app, BrowserWindow, ipcMain, dialog, session, Menu, Tray} = require('electron');

const path = require('path'),
	  url = require('url'),
	  fs = require('fs'),
	  states = require('states'),
		chokidar = require('chokidar');

let win, ses, watcher;

function createWindow () {
	let lastWindowState = states.get("lastWindowState");

	if (lastWindowState === null) {
		lastWindowState = {
			width: 1366,
			height: 768,
			minWidth: 910,
			minHeight: 110,
			maximized: false,
			frame: false
		}
	}

	win = new BrowserWindow({
		x: lastWindowState.x,
		y: lastWindowState.y,
		width: lastWindowState.width,
		height: lastWindowState.height,
		minWidth: 910,
		minHeight: 110,
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

	win.webContents.openDevTools();

	win.webContents.on('new-window', (e, url) => {
		e.preventDefault();
		require('electron').shell.openExternal(url);
	});

	ses = win.webContents.session;

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

app.on('ready', createWindow);

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (win === null) {
		createWindow();
	}
});

// Load Assets
ipcMain.on('loadAssets', (event, args) => {

	dialog.showOpenDialog({
		properties: ['openDirectory']
	}, (file) => {
		if (file === undefined) return;

		let jFiles = path.join(app.getPath('userData'), 'files.json'),
				thumbs = path.join(app.getPath('userData'), '.thumbnails');

		// Clean up app data if any
		// 1. Remove image files
		if (fs.existsSync(thumbs)) {
			fs.readdir(thumbs, (err, files) => {
				if (err) console.log(err);

				for (let i = 0; i < files.length; i++) {
					fs.unlink(path.join(thumbs, files[i]), (err) => {
						if (err) console.log(err);
					});
				}
			});
		}

		// 2. Send message to clear DOM
		win.webContents.send('clearDOM');

		for (var filePath of file) {;}

		walk(filePath, (err, allFiles) => {
			if (err) console.log(err);

			let filtered = allFiles.filter((files) => {
				function testPath(s) {
					let test = new RegExp('\\b__').test(s);
					return !test;
				}

				return (files.fileType === '.jpg' && testPath(files.path));
			});

			if (!fs.existsSync(thumbs)) {
				fs.mkdir(thumbs, (err, callback) => {
					if (err) console.log(err);
				});
			}

			event.sender.send('getAssets', filtered, filePath);
		});
	});
});

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
						allFiles = null;
					} else {
						pendingFiles -= 1;
					}
				}
			});
		});
	});
}


// File watcher
//
// IPC message
ipcMain.on('startWatching', (event, args) => {
	watcher = chokidar.watch('', {
		ignored: [
			(file, fsFile) => fsFile !== undefined && !fsFile.isDirectory() && !/\.jpg$/.test(file),
			'**\\__MACOSX\\**'
		],
		persistent: true
	});

	watcher.on('add', (path) => {
		event.sender.send('addWatchFile', (path));
	})
	.on('unlink', (path) => {
		event.sender.send('removeWatchFile', (path));
	})
});

ipcMain.on('addWatch', (event, path) => {
	watcher.add(path);
});
