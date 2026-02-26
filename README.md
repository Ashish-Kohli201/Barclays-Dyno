# Barclays Nexus

<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Barclays_logo.svg/1200px-Barclays_logo.svg.png" alt="Barclays Logo" width="200" />
</div>

<br />

**Barclays Nexus** is a next-generation multidimensional collateral and data visualization platform. It provides an infinite, interactive canvas for financial structuring, diagramming, and data analysis powered by React Flow and Llama 3 AI intelligence.

## 🌟 Key Features

*   **Infinite Interactive Canvas**: Built on `React Flow`, enabling a seamless drag-and-drop node interface for complex financial structures.
*   **AI-Powered Insights**: Integrates with Cloud Llama 3 to instantly analyze datasets, generate node suggestions, and map out collateral strategies.
*   **Multi-format Node Types**: Support for Text, Diagrams, Datasets, and Presentation nodes directly on the canvas.
*   **Desktop App Ready**: Packaged securely as a standalone Windows `.exe` application using Electron Forge.
*   **Web Deployment Ready**: Capable of being hosted as a standard static React web application on GitHub Pages.

---

## 🛠️ Technology Stack

*   **Frontend**: React 18, Zustand (State Management), Framer Motion (Animations), Tailwind CSS / Vanilla CSS, Lucide React (Icons).
*   **Canvas Engine**: React Flow
*   **Desktop Wrapper**: Electron, Electron Forge
*   **AI Integration**: Groq Cloud API (Llama 3.1 8B Instant)

---

## 🚀 Getting Started

### 1. Web Version (GitHub Pages)
The application is hosted and accessible directly via the web without any installation required.

🔗 **[Launch Barclays Nexus Web](https://ashish-kohli201.github.io/Barclays-Dyno/)**

### 2. Desktop Application (Windows .exe)
For an offline, native desktop experience:

1. Download the latest `Barclays Nexus Setup.exe` from the [Releases](https://github.com/Ashish-Kohli201/Barclays-Dyno/releases) tab (or compile it locally using the steps below).
2. Run the installer.
3. Launch **Barclays Nexus** from your Start Menu.

---

## 💻 Local Development

To run the application locally on your machine for development or debugging:

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   Git

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Ashish-Kohli201/Barclays-Dyno.git
   cd Barclays-Dyno
   ```
2. Install all dependencies:
   ```bash
   npm install
   ```

### Running the App
Start the Babel compiler and launch the Electron desktop window:
```bash
npm start
```

### Packaging a New `.exe` Release
To compile the source code into a redistributable Windows installer:
```bash
npm run make
```
*The compiled `.exe` installer will be located in the `out/make/squirrel.windows/x64/` directory.*

---

## 🔐 Environment Variables
To enable the AI capabilities locally, you must provide a Groq API Key. 

Create a `.env` file or export the key in your terminal before running:
```bash
export GROQ_API_KEY="your_api_key_here"
```

---

<div align="center">
  <i>Developed for the Barclays Innovation Initiative.</i>
</div>
