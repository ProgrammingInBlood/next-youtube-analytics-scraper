#!/bin/bash

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
bun install
cd ..

echo ""
echo "⚠️  IMPORTANT: This application uses Puppeteer which will open Chrome browser"
echo "   windows as part of normal operation. A single Chrome window will be opened"
echo "   to handle all video scraping tasks."
echo ""
echo "   If you notice stray Chrome processes after stopping the server, you can"
echo "   clean them up by running: cd backend && npm run cleanup"
echo ""
echo "Setup complete! You can now run both frontend and backend with:"
echo "npm run dev:all" 