# ClipChat - Llama 4 Multi-Modal Chrome Extension

**Chrome extension with Llama 4 multi-modal AI via Groq's fast inference. Chat with AI and analyze webpages directly in your browser.**

## Overview
This Chrome extension demonstrates multi-modal AI chat capabilities using Groq API for ultra-fast inference with Llama 4 models, built as a complete template that you can fork, customize, and deploy as your own Chrome extension.

The extension opens as a chat interface in Chrome's side panel, but its true power lies in its **vision capabilities** - users can select any region of a webpage or capture full-page screenshots, then ask Llama 4 questions about the visual content, from analyzing UI designs to extracting data from charts and diagrams.

**Key Features:**
- Multi-Modal AI powered by Llama 4 Maverick and Scout models for text and image understanding
- **Visual Analysis**: Select regions or capture full-page screenshots for AI-powered image analysis
- **Contextual Chat**: Ask questions about visual content with full context awareness
- Sub-second response times with Groq Fast AI Inference acceleration

## Try It Now

**Want to test the extension immediately without setting up a development environment?**

1. **Download the Latest Release**
   - Go to the [Releases section](https://github.com/benank/groq-clipchat-template/releases) of this repository
   - Download the latest `clipchat-extension.zip` file
   - Extract the ZIP file to a folder on your computer

2. **Load the Unpacked Extension**
   - Open `chrome://extensions` in your Chrome browser
   - Enable **Developer Mode** (toggle in the top-right corner)
   - Click **Load unpacked** and select the extracted folder

3. **Start Using ClipChat**
   - Click the ClipChat extension icon in your Chrome toolbar
   - Enter your [Groq API key](https://console.groq.com/keys) in the settings
   - Begin chatting with Llama 4 and analyzing webpage content!

**No coding required** - just download, load, and start exploring the power of multi-modal AI in your browser.

## Architecture

**Tech Stack:**
- **Frontend:** Svelte 5, TypeScript, TailwindCSS, DaisyUI
- **Build System:** Vite with Chrome Extension optimization
- **Extension Framework:** Chrome Manifest V3 with service workers
- **AI Infrastructure:** Groq API with Llama 4 Maverick and Scout models

**Extension Components:**
- **Side Panel:** Main chat interface accessible from Chrome toolbar
- **Content Scripts:** Web page interaction capabilities
- **Background Service Worker:** Extension lifecycle and API management
- **Popup/Action:** Quick access and settings

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/) (v7 or higher)
- [Google Chrome](https://www.google.com/chrome/)
- Groq API key ([Create a free GroqCloud account and generate an API key here](https://console.groq.com/keys))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/benank/groq-clipchat-template
   cd groq-clipchat-template
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Run Development Server**
   ```bash
   pnpm run dev
   ```
   This starts the Vite dev server with live reloading and hot module replacement (HMR).

4. **Build for Production**
   ```bash
   pnpm run build
   ```
   The production-ready extension will be output to the `dist/` directory.

5. **Load Extension in Chrome**
   - Open `chrome://extensions` in your browser
   - Enable **Developer Mode** (toggle in the top-right corner)
   - Click **Load unpacked** and select the `dist/` folder

6. **Configure API Key**
   - Click the ClipChat extension icon in Chrome toolbar
   - Enter your [Groq API key](https://console.groq.com/keys) in the settings
   - Start chatting with Llama 4 models!

## Project Structure

```
.
├── public/                 # Static assets (manifest.json, icons)
├── src/
│   ├── background/         # Background scripts for Chrome extension functionality
│   ├── content-script/     # Content scripts for injecting into web pages
│   ├── lib/                # Reusable components, services, stores and types
│   │   ├── components/     # UI components (ThemeToggle, MainContent, Settings)
│   │   ├── services/       # Service implementations (Groq API)
│   │   ├── stores/         # State management (theme, settings)
│   │   └── types/          # TypeScript interfaces and type definitions
│   ├── App.svelte          # Main application component
│   ├── app.css             # Global styles
│   └── main.ts             # Application entry point
├── tailwind.config.js      # TailwindCSS configuration
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration
├── postcss.config.js       # PostCSS plugins (for TailwindCSS)
└── package.json            # Project dependencies and scripts
```

## Manifest Configuration

The **manifest.json** file is located in the `public/` directory and defines the Chrome extension's permissions and entry points.

**Key Settings:**

- **Permissions**: Add only the permissions you need to maintain user privacy
- **Background Service Worker**: Configured using Vite for background tasks
- **Content Scripts**: Enable interaction with web pages

```json
{
  "manifest_version": 3,
  "name": "ClipChat - Llama4 + Groq",
  "version": "1.0.0",
  "description": "A side panel Chrome extension for chatting with Llama4 multi-modal, accelerated by Groq | Fast AI Inference",
  "permissions": [
    "sidePanel",
    "storage",
    "activeTab",
    "scripting",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_title": "Open ClipChat",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "64": "icons/icon64.png",
      "128": "icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "index.html"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

## Styling with TailwindCSS and DaisyUI

- **TailwindCSS**: Highly customizable utility classes for rapid UI design
- **DaisyUI**: Prebuilt Tailwind components for a polished design

**Customizing Tailwind:**
Edit the `tailwind.config.js` file to add your themes, colors, or plugins.

```javascript
module.exports = {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
};
```

## Development Scripts

- **`pnpm run dev`**: Start the development server with HMR
- **`pnpm run build`**: Build the extension for production

## Customization

This template is designed to be a foundation for you to get started with. Key areas for customization:

### **Core Functionality**
- **Model Selection:** Update Groq model configuration in `src/lib/services/` directory to use different Llama 4 variants or other Groq-supported models
- **UI/Styling:** Customize themes and components in `src/lib/components/` and `tailwind.config.js`
- **Extension Permissions:** Modify `public/manifest.json` to add or remove Chrome extension permissions
- **Chat Features:** Extend chat functionality in `src/lib/` components and services
- **Content Script Integration:** Customize web page interactions in `src/content-script/`

### **Use Cases & Extensions**

#### **🎨 Design & UX Analysis**
- **UI/UX Review & Competitor Analysis:** Analyze mockups, competitor sites, accessibility issues, A/B test variations with Figma API integration, color palette extraction, brand guideline checks

#### **📊 Business Intelligence**
- **Data Analysis & Reporting:** Extract insights from charts, dashboards, financial graphs, competitor research with automated report generation, analytics platform integration, price monitoring alerts

#### **🎓 Education & Research**
- **Academic Support & Learning:** Analyze research papers, diagrams, educational materials, language learning content with subject-specific prompts, plagiarism detection, multi-language support

#### **💼 E-commerce & Enterprise**
- **Business Operations & Process Optimization:** Product analysis, inventory dashboards, documentation generation with CRM/analytics platform integration, automated workflow triggers, compliance checking

#### **🔧 Development & Technical**
- **Code Analysis & Documentation:** Analyze code screenshots, API visualizations, system monitoring, technical writing with GitHub/GitLab integration, automated documentation, code quality analysis

### **Advanced Extensions**
- **OCR Integration:** Text extraction from images before AI analysis
- **Batch Processing:** Multiple screenshot analysis, automated workflows
- **Export Features:** PDF reports, integration APIs (Slack, Notion, Jira)
- **Custom Templates:** Industry-specific prompts, analytics dashboard
- **Collaboration:** Share results, team management, usage tracking

## Next Steps

### For Developers
- **Create your free GroqCloud account:** Access official API docs, the playground for experimentation, and more resources via [Groq Console](https://console.groq.com)
- **Build and customize:** Fork this repo and start customizing to build out your own Chrome extension with AI capabilities
- **Explore Chrome Extension APIs:** Learn more about [Chrome Extension development](https://developer.chrome.com/docs/extensions/) to add advanced features
- **Get support:** Connect with other developers building on Groq, chat with our team, and submit feature requests on our [Groq Developer Forum](https://community.groq.com)

### For Founders and Business Leaders
- **See enterprise capabilities:** This template showcases production-ready AI that can handle realtime business workloads in browser extensions. See other applications and use cases for AI-powered browser tools
- **Discuss your needs:** [Contact our team](https://groq.com/enterprise-access/) to explore how Groq can accelerate your AI initiatives and browser-based applications

## Security Notes

- **Minimal Permissions**: Only request permissions that are absolutely necessary
- **Static Asset Validation**: Ensure all static assets (icons, scripts) are valid and trusted
- **Content Script Isolation**: Use content scripts judiciously to avoid conflicts with the web page
- **Dynamic API Key**: By inputting the API key in the front-end, you do not have to deploy the app with a stored secret key

## Resources

- [Llama 4 Documentation](https://ai.meta.com/llama/)
- [Groq Documentation](https://console.groq.com/docs/overview)
- [Svelte Documentation](https://svelte.dev/docs)
- [Vite Documentation](https://vitejs.dev/guide/)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [DaisyUI Documentation](https://daisyui.com/)

## Acknowledgments

This project was built upon and inspired by [trentbrew/svelte5-chrome-extension](https://github.com/trentbrew/svelte5-chrome-extension). We're grateful for the open source community and their contributions that make projects like this possible.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

Created by Julian Francisco.