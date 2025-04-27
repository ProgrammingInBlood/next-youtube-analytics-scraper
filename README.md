# 📺 YouTube Live Chat Aggregator

A production-grade web application that lets you enter up to **3 YouTube Live Video URLs** and view:

- 🧵 Combined **live chat** from all videos in one unified comment box.
- 💬 Each message includes **username**, **channel name**, and **chat message**.
- 📊 Real-time **likes** and **live viewer count** for each video.

---

## ⚙️ Tech Stack

| Layer        | Tech              |
|--------------|-------------------|
| Frontend     | Next.js (App Router + TypeScript) |
| Backend      | Bun + ElysiaJS    |
| Scraping     | Puppeteer         |
| Communication| REST API (future: WebSockets) |
| Deployment   | Vercel (Frontend), Railway/Bun (Backend) |

---

## 🧩 Features

- ✅ Input up to 3 YouTube Live URLs.
- ✅ Real-time scraping of:
  - 🔴 Live chat (via YouTube internal API)
  - 👍 Likes
  - 👁️ Viewer count
- ✅ Uses Puppeteer to mimic real browser behavior and extract required tokens.
- ✅ ElysiaJS backend with Bun for speed and modern API structure.
- ✅ Minimal, modern UI with React/Next.js.

---

## 📁 Folder Structure

```
project-root/
├── backend/           # Bun + ElysiaJS backend
│   ├── scraping/      # Puppeteer scraping logic
│   ├── api/           # Route handlers
│   └── utils/         # Helpers and response formatters
├── app/               # Next.js frontend (App Router)
│   ├── components/    # UI components
│   └── lib/           # Frontend API utils
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/youtube-live-aggregator
cd youtube-live-aggregator
```

### 2. Install dependencies

```bash
# Option 1: Use the setup script (recommended)
chmod +x setup.sh
./setup.sh

# Option 2: Manual installation
# Frontend
npm install

# Backend
cd backend
bun install
cd ..
```

### 3. Run in development

```bash
# Option 1: Run both frontend and backend with one command
npm run dev:all

# Option 2: Run separately
# Start backend (in one terminal)
cd backend
bun run dev

# Start frontend (in another terminal)
npm run dev
```

### 4. Open the application

Visit `http://192.168.0.191:3000` in your browser.

---

## 🧠 How It Works

1. User enters up to 3 YouTube Live video links.
2. Frontend sends request to the backend.
3. Backend uses Puppeteer to open each video URL.
4. Puppeteer:
   - Extracts apiKey, clientVersion, and continuation token.
   - Hits YouTube internal APIs to fetch live chat and metadata.
5. All chat messages are combined and sent back to the frontend.
6. Frontend displays messages in a live comment box with real-time updates.

---

## 🔐 Security

- ✅ URL validation to prevent invalid input or XSS.
- ✅ Puppeteer sandboxing.
- ✅ Rate limiting and error fallback.
- ✅ Graceful recovery for unavailable streams or expired tokens.

---

## 📈 Enhancements

- 💡 **Performance**
  - Cache continuation tokens in memory.
  - Use async streaming APIs.
  - Reduce Puppeteer launch overhead with a shared browser pool.
- 💡 **Features**
  - WebSocket support for real-time updates.
  - User authentication to save favorite streams.
  - Chat filtering and search.
  - Custom themes and appearance options.

---

## 📝 License

MIT License.
