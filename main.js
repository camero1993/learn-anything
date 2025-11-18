const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  desktopCapturer,
  screen,
  protocol,
} = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let mainWindow = null; // Track the main window
let overlayWindow = null; // Track the overlay window

// Serve static files from build directory
function setupStaticFileServing() {
  const frontendBuildPath = path.join(__dirname, "frontend/build");
  const overlayBuildPath = path.join(__dirname, "overlay-screen/build");
  
  protocol.interceptFileProtocol("file", (request, callback) => {
    let url = request.url.substr(7); // Remove 'file://'
    
    // Handle Windows file paths (file:///C:/path)
    if (process.platform === "win32" && url.match(/^\/[A-Z]:/)) {
      url = url.substr(1);
    }
    
    // Log all file requests for debugging
    if (url.includes("static") || url.includes(".js") || url.includes(".css")) {
      console.log(`[Protocol] Request: ${request.url} -> ${url}`);
    }
    
    // Check if this is a request for a static asset with absolute path (starts with /static/)
    // When HTML references /static/css/file.css, browser requests file:///static/css/file.css
    if (url.startsWith("/static/")) {
      // Remove leading slash and build the path
      const relativePath = url.replace(/^\/+/, "");
      
      // Try frontend build first, then overlay build
      let filePath = path.join(frontendBuildPath, relativePath);
      let normalizedPath = path.normalize(filePath);
      if (fs.existsSync(normalizedPath)) {
        callback({ path: normalizedPath });
        return;
      }
      
      // Try overlay build
      filePath = path.join(overlayBuildPath, relativePath);
      normalizedPath = path.normalize(filePath);
      if (fs.existsSync(normalizedPath)) {
        console.log(`[Protocol] Serving overlay static: ${relativePath}`);
        callback({ path: normalizedPath });
        return;
      }
      
      // Log for debugging
      console.error(`[Protocol] Static file not found: ${relativePath}`);
      console.error(`[Protocol] Tried: ${path.join(frontendBuildPath, relativePath)}`);
      console.error(`[Protocol] Tried: ${path.join(overlayBuildPath, relativePath)}`);
    }
    
    // Check for other absolute paths that might be in the build directory
    // (like /manifest.json, /favicon.ico, etc.)
    if (url.startsWith("/") && !url.includes(":") && !path.isAbsolute(url)) {
      const relativePath = url.replace(/^\/+/, "");
      
      // Try frontend build first, then overlay build
      let filePath = path.join(frontendBuildPath, relativePath);
      let normalizedPath = path.normalize(filePath);
      if (fs.existsSync(normalizedPath)) {
        callback({ path: normalizedPath });
        return;
      }
      
      // Try overlay build
      filePath = path.join(overlayBuildPath, relativePath);
      normalizedPath = path.normalize(filePath);
      if (fs.existsSync(normalizedPath)) {
        callback({ path: normalizedPath });
        return;
      }
    }
    
    // Default: pass through to original handler (for the actual index.html file)
    callback({ path: url });
  });
}

// Create main window function
function createMainWindow() {
  // Check if main window already exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  console.log("Creating main window");

  // Create the main window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
    },
    title: "CalHacks 2025",
    show: false, // Don't show until ready
  });

  // Load content for the main window
  const isDev = !app.isPackaged;

  if (isDev) {
    // In development, try dev server first; fallback to built files if it fails
    mainWindow.loadURL("http://localhost:3000").catch(() => {
      console.log(
        "Frontend dev server not available; falling back to built files"
      );
      mainWindow.loadFile(
        path.join(__dirname, "frontend/build/index.html")
      );
    });

    // Also handle async load failures
    mainWindow.webContents.on(
      "did-fail-load",
      (_event, _errorCode, _errorDescription, validatedURL) => {
        if (validatedURL && validatedURL.startsWith("http://localhost:3000")) {
          console.log(
            "Frontend failed to load dev server; loading built files instead"
          );
          mainWindow.loadFile(
            path.join(__dirname, "frontend/build/index.html")
          );
        }
      }
    );
  } else {
    // In production, load the built React app
    mainWindow.loadFile(
      path.join(__dirname, "frontend/build/index.html")
    );
  }

  // Show window when ready
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.show();
    console.log("Main window opened");
    // Open DevTools in development to debug
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Log any failed resource loads
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load: ${validatedURL}`);
    console.error(`Error: ${errorCode} - ${errorDescription}`);
  });

  // Handle main window closed
  mainWindow.on("closed", () => {
    console.log("Main window closed");
    mainWindow = null;
  });

  return mainWindow;
}

// Overlay screen function triggered by '/' key - creates a new Electron window
function triggerOverlayScreen() {
  // Check if overlay window already exists
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    console.log("Overlay window already exists - closing it");
    overlayWindow.close();
    overlayWindow = null;
    return null;
  }

  console.log(
    'Overlay screen triggered by "/" key press - creating new window'
  );

  // Create a new overlay window - independent from main window
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 175,
    minWidth: 200,
    minHeight: 150,
    // backgroundColor: "#00000000", // Fully transparent if needed
    // modal: false, // Not needed for independent window
    alwaysOnTop: true, // Keep it above other windows
    frame: false, // Frameless window required for transparency on macOS
    transparent: true, // Enable window transparency
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
    },
    title: "Overlay Screen",
    show: false, // Don't show until ready
    x: 100, // Position on desktop
    y: 100,
  });

  // Load content for the overlay window
  const isDev = !app.isPackaged;

  if (isDev) {
    // In development, try dev server first; fallback to built files if it fails
    overlayWindow.loadURL("http://localhost:3001").catch(() => {
      // Silently fallback to built files - this is expected behavior
      overlayWindow.loadFile(
        path.join(__dirname, "overlay-screen/build/index.html")
      );
    });

    // Also handle async load failures
    overlayWindow.webContents.on(
      "did-fail-load",
      (_event, _errorCode, _errorDescription, validatedURL) => {
        if (validatedURL && validatedURL.startsWith("http://localhost:3001")) {
          // Silently fallback to built files - this is expected behavior
          overlayWindow.loadFile(
            path.join(__dirname, "overlay-screen/build/index.html")
          );
        }
      }
    );
  } else {
    // In production, load the built React app
    overlayWindow.loadFile(
      path.join(__dirname, "overlay-screen/build/index.html")
    );
  }

  // Show and initialize after content is fully loaded
  overlayWindow.webContents.once("did-finish-load", () => {
    overlayWindow.show();
    console.log("Overlay window opened");
    
    // Open DevTools for overlay in development to debug
    if (!app.isPackaged) {
      overlayWindow.webContents.openDevTools();
    }

    // Send initial content to overlay renderer
    overlayWindow.webContents.send("overlay-set-content", {
      header: "Step 1",
      body: "Using prototyping features to connect frames, add interactions, and create clickable mockups that simulate user flows.",
    });
  });
  
  // Log console messages from overlay window
  overlayWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    console.log(`[Overlay ${level}] ${message}`);
  });

  // Log any failed resource loads for overlay
  overlayWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Overlay failed to load: ${validatedURL}`);
    console.error(`Error: ${errorCode} - ${errorDescription}`);
    // Still try to show the window even if load failed
    if (!overlayWindow.isDestroyed()) {
      overlayWindow.show();
    }
  });

  // Handle overlay window closed
  overlayWindow.on("closed", () => {
    console.log("Overlay window closed");
    overlayWindow = null; // Reset the reference when closed
  });

  return overlayWindow;
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set up static file serving - must be called after app is ready
  setupStaticFileServing();
  
  // Small delay to ensure protocol is registered before creating window
  setTimeout(() => {
    // Create the main window on startup
    createMainWindow();
  }, 100);

  // // Register global shortcut for '/' key
  // // Toggle behavior: creates overlay if none exists, closes it if it exists
  // const ret = globalShortcut.register("/", () => {
  //   console.log('Global shortcut "/" pressed');
  //   triggerOverlayScreen();
  // });

  // if (!ret) {
  //   console.log('Registration of global shortcut "/" failed');
  // }

  // On macOS, recreate window when dock icon is clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  // Close overlay window if it exists
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }

  // Close main window if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow = null;
  }

  // Unregister all global shortcuts
  globalShortcut.unregisterAll();

  // On macOS, keep app running even when all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle app before quit to ensure proper cleanup
app.on("before-quit", () => {
  // Close overlay window if it exists
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
  // Close main window if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    mainWindow = null;
  }
});

// Security: Prevent new window creation
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault();
    require("electron").shell.openExternal(navigationUrl);
  });
});

// IPC handler to trigger overlay screen from renderer
ipcMain.handle("trigger-child-process", () => {
  try {
    const process = triggerOverlayScreen();
    return {
      success: true,
      pid: process ? process.pid : null,
      action: overlayWindow ? "opened" : "closed",
    };
  } catch (error) {
    console.error("Error triggering overlay screen:", error);
    return { success: false, error: error.message };
  }
});

// IPC handler for taking screenshots
ipcMain.handle("take-screenshot", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (sources.length === 0) {
      throw new Error("No screen sources available");
    }

    // Get the primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const source =
      sources.find(
        (source) =>
          source.name === "Entire Screen" || source.name === "Screen 1"
      ) || sources[0];

    // Convert to base64
    const screenshot = source.thumbnail.toPNG();
    const base64Image = screenshot.toString("base64");

    return {
      success: true,
      data: base64Image,
      size: screenshot.length,
      display: {
        width: primaryDisplay.bounds.width,
        height: primaryDisplay.bounds.height,
      },
    };
  } catch (error) {
    console.error("Error taking screenshot:", error);
    return { success: false, error: error.message };
  }
});

