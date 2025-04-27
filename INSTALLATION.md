# Installation Prerequisites

Before running this project, you need to have the following tools installed:

## Requirements

1. **Node.js** (v18 or newer)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Bun** (for running the backend)
   - Install with: `curl -fsSL https://bun.sh/install | bash`
   - Or on macOS with Homebrew: `brew install bun`
   - Verify installation: `bun --version`

## Setting Up

After installing the prerequisites:

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/youtube-live-aggregator
   cd youtube-live-aggregator
   ```

2. Run the setup script:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. Start the application:
   ```bash
   npm run dev:all
   ```

4. Open your browser and go to:
   - Frontend: http://192.168.0.191:3000
   - Backend API: http://192.168.0.191:3001

## Troubleshooting

- **Backend fails to start**: Make sure Bun is properly installed and in your PATH.
- **Puppeteer issues**: You might need additional dependencies for Puppeteer to run properly. 
  - On Ubuntu/Debian: `sudo apt-get install chromium-browser`
  - On macOS: Should work out of the box
  - On Windows: Might need to install a compatible version of Chrome 