import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const title = "Spritesheet Helper";
const description = "A tool to help you create spritesheets from 3D models";
const url = window.location.href;
const imgUrl = new URL("/preview.png", import.meta.url).href;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <meta name="description" content={description} />
    <meta property="og:type" content="website" />
    <meta name="og:title" property="og:title" content={title} />
    <meta
      name="og:description"
      property="og:description"
      content={description}
    />
    <meta property="og:site_name" content="Spritesheet Helper" />
    <meta property="og:url" content={`${url}`} />
    <meta name="og:image" property="og:image" content={imgUrl} />
    <App />
  </StrictMode>
);
