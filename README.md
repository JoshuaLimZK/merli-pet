# Merli Pet

![Merli Pet Banner](.github/app_banner.png)

A Hack&Roll 2026 Project

## Description

Merli Pet is a desktop pet application built with Electron that brings a familiar Singaporean companion to your screen. Features include interactive quotes, pomodoro timer, and various engaging activities.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. Clone the repository
```bash
git clone [repository-url]
cd merli-pet
```

2. Install dependencies
```bash
npm install
```

3. Run the application
```bash
npm start
```

## Features

- 🐱 Interactive desktop pet
- 💬 Random quote display with dynamic speech bubbles
- 🍅 Pomodoro timer
- 🎤 Voice interaction
- 🚌 Bus tracking
- 🎯 Random events

## Technologies

- Electron
- JavaScript (ESM)
- OpenAI Agents
- TypeScript

## Project Structure

```
merli-pet/
├── src/
│   ├── main/          # Main process code
│   │   ├── windows/   # Window management
│   │   └── main.js    # Entry point
│   └── renderer/      # Renderer process code
│       ├── pet/       # Pet window UI
│       ├── quote/     # Quote display
│       ├── pomodoro/  # Timer UI
│       └── ...        # Other features
```

## License

ISC
