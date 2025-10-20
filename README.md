# Portfolio Website 🚀

<p align='center'>
  <b>🎨 Follow me here 🎨</b><br>  
  <a href="https://twitter.com/im_saurabhs">Twitter</a> |
  <a href="https://github.com/Saur-Hub">Github</a><br><br>
</p>

## About

Personal portfolio website showcasing my work as an Automotive Embedded Developer. The site features a modern, responsive design with interactive elements and smooth animations.

## ✨ Features

- 🎨 Responsive design that works on all devices
- 🎵 Interactive audio elements
- 💼 Experience showcase
- 🔗 Social media integration
- 📊 Visitor counter
- ✨ Modern animations and transitions

## 🛠️ Technologies Used

- HTML5
- CSS3 (with CSS Variables and Flexbox)
- JavaScript (ES6+)
- Font Awesome Icons

## 📁 Project Structure

```
├── index.html          # Main portfolio page
├── experience.html     # Experience showcase
├── watchlist.html      # Movie/TV Show watchlist
├── assets/
│   ├── css/           # Stylesheet files
│   ├── js/            # JavaScript files
│   ├── imgs/          # Image assets
│   ├── audio/         # Audio files
│   └── data/          # JSON data files
├── netlify/
│   └── functions/     # Serverless functions
├── robots.txt         # Search engine instructions
└── sitemap.xml        # Site structure for search engines
```

## 🚀 Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Saur-Hub/Saur-Hub.github.io.git
   cd Saur-Hub.github.io
   ```

2. Install dependencies:
   ```bash
   npm install netlify-cli -g
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your API keys and secrets in `.env`
   - Required variables:
     - `OMDB_API_KEY`: Get from [OMDB API](https://www.omdbapi.com/apikey.aspx)
     - `GITHUB_CLIENT_ID`: From your GitHub OAuth App
     - `GITHUB_CLIENT_SECRET`: From your GitHub OAuth App

4. Start the development server:
   ```bash
   netlify dev
   ```

5. Open [http://localhost:8888](http://localhost:8888) in your browser

Note: For the GitHub authentication to work locally, make sure your GitHub OAuth App's callback URL includes `http://localhost:8888/watchlist.html`

## � TODO
- [x] Remove the embed Spotify player and replace it with an internal audio playlist (auto-plays after user gesture)
- [ ] Optimize images for better performance
- [ ] Add dark/light theme toggle

## 📜 License

This project is licensed under the terms of the MIT license. See the [LICENSE](LICENSE) file for details.
