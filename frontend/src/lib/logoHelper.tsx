"use client";

import React, { useState } from "react";

export interface BrandMetadata {
  name: string;
  logo: string;
  fallbackLogo?: string;
  color: string;
  domain: string;
  tierDefault?: string;
  category?: string;
}

// Comprehensive catalog of popular apps & subscription services
export const BRAND_CATALOG: Record<string, BrandMetadata> = {
  duolingo: {
    name: "Duolingo",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/15/Duolingo_logo_%282019%29.svg",
    fallbackLogo: "https://cdn.simpleicons.org/duolingo/58CC02",
    color: "#58CC02",
    domain: "duolingo.com",
    tierDefault: "Super · Monthly",
    category: "Education",
  },
  netflix: {
    name: "Netflix",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/netflix/E50914",
    color: "#E50914",
    domain: "netflix.com",
    tierDefault: "Standard · Monthly",
    category: "Streaming",
  },
  spotify: {
    name: "Spotify",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg",
    fallbackLogo: "https://cdn.simpleicons.org/spotify/1DB954",
    color: "#1DB954",
    domain: "spotify.com",
    tierDefault: "Family · Monthly",
    category: "Music",
  },
  "prime video": {
    name: "Prime Video",
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png",
    fallbackLogo: "https://cdn.simpleicons.org/amazonprime/00A8E1",
    color: "#00A8E1",
    domain: "amazon.com",
    tierDefault: "Prime · Annual",
    category: "Streaming",
  },
  amazon: {
    name: "Amazon Prime",
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png",
    fallbackLogo: "https://cdn.simpleicons.org/amazonprime/00A8E1",
    color: "#00A8E1",
    domain: "amazon.com",
    tierDefault: "Prime · Annual",
    category: "Shopping",
  },
  youtube: {
    name: "YouTube Premium",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg",
    fallbackLogo: "https://cdn.simpleicons.org/youtube/FF0000",
    color: "#FF0000",
    domain: "youtube.com",
    tierDefault: "Family · Monthly",
    category: "Video",
  },
  hotstar: {
    name: "Disney+ Hotstar",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/disneyplus/113CCF",
    color: "#113CCF",
    domain: "hotstar.com",
    tierDefault: "Super · Annual",
    category: "Streaming",
  },
  disney: {
    name: "Disney+",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/disneyplus/113CCF",
    color: "#113CCF",
    domain: "disneyplus.com",
    tierDefault: "Standard · Annual",
    category: "Streaming",
  },
  apple: {
    name: "Apple iCloud+",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/1c/ICloud_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/apple/5E5CE6",
    color: "#5E5CE6",
    domain: "apple.com",
    tierDefault: "200 GB · Monthly",
    category: "Cloud",
  },
  icloud: {
    name: "iCloud+",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/1c/ICloud_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/apple/5E5CE6",
    color: "#5E5CE6",
    domain: "apple.com",
    tierDefault: "200 GB · Monthly",
    category: "Cloud",
  },
  canva: {
    name: "Canva Pro",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/08/Canva_icon_2021.svg",
    fallbackLogo: "https://cdn.simpleicons.org/canva/00C4CC",
    color: "#00C4CC",
    domain: "canva.com",
    tierDefault: "Pro · Monthly",
    category: "Design",
  },
  chatgpt: {
    name: "ChatGPT Plus",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/openai/10A37F",
    color: "#10A37F",
    domain: "openai.com",
    tierDefault: "Plus · Monthly",
    category: "AI",
  },
  openai: {
    name: "OpenAI",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/openai/10A37F",
    color: "#10A37F",
    domain: "openai.com",
    tierDefault: "API / Plus",
    category: "AI",
  },
  github: {
    name: "GitHub Copilot",
    logo: "https://cdn.simpleicons.org/github/181717",
    fallbackLogo: "https://github.githubassets.com/favicons/favicon.png",
    color: "#181717",
    domain: "github.com",
    tierDefault: "Copilot Pro · Monthly",
    category: "Developer",
  },
  figma: {
    name: "Figma",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/figma/F24E1E",
    color: "#F24E1E",
    domain: "figma.com",
    tierDefault: "Professional · Monthly",
    category: "Design",
  },
  notion: {
    name: "Notion",
    logo: "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo%2C_2020.png",
    fallbackLogo: "https://cdn.simpleicons.org/notion/000000",
    color: "#000000",
    domain: "notion.so",
    tierDefault: "Plus · Monthly",
    category: "Productivity",
  },
  slack: {
    name: "Slack",
    logo: "https://cdn.simpleicons.org/slack/4A154B",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg",
    color: "#4A154B",
    domain: "slack.com",
    tierDefault: "Pro · Monthly",
    category: "Productivity",
  },
  discord: {
    name: "Discord Nitro",
    logo: "https://cdn.simpleicons.org/discord/5865F2",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/0/08/Discord_Logo_%282021%29.svg",
    color: "#5865F2",
    domain: "discord.com",
    tierDefault: "Nitro · Monthly",
    category: "Communication",
  },
  adobe: {
    name: "Adobe Creative Cloud",
    logo: "https://cdn.simpleicons.org/adobe/FF0000",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Adobe_Creative_Cloud_rainbow_icon.svg",
    color: "#FF0000",
    domain: "adobe.com",
    tierDefault: "All Apps · Monthly",
    category: "Design",
  },
  claude: {
    name: "Claude Pro",
    logo: "https://cdn.simpleicons.org/anthropic/D97706",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Claude_AI_logo.svg",
    color: "#D97706",
    domain: "anthropic.com",
    tierDefault: "Pro · Monthly",
    category: "AI",
  },
  coursera: {
    name: "Coursera Plus",
    logo: "https://cdn.simpleicons.org/coursera/0056D2",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/9/97/Coursera-Logo_600x600.svg",
    color: "#0056D2",
    domain: "coursera.org",
    tierDefault: "Plus · Annual",
    category: "Education",
  },
  udemy: {
    name: "Udemy Personal Plan",
    logo: "https://cdn.simpleicons.org/udemy/A435F0",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/e/e3/Udemy_logo.svg",
    color: "#A435F0",
    domain: "udemy.com",
    tierDefault: "Personal Plan · Monthly",
    category: "Education",
  },
  linkedin: {
    name: "LinkedIn Premium",
    logo: "https://cdn.simpleicons.org/linkedin/0A66C2",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png",
    color: "#0A66C2",
    domain: "linkedin.com",
    tierDefault: "Career · Monthly",
    category: "Career",
  },
  microsoft: {
    name: "Microsoft 365",
    logo: "https://cdn.simpleicons.org/microsoft/00A4EF",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg",
    color: "#00A4EF",
    domain: "microsoft.com",
    tierDefault: "Family · Annual",
    category: "Productivity",
  },
  dropbox: {
    name: "Dropbox Plus",
    logo: "https://cdn.simpleicons.org/dropbox/0061FF",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg",
    color: "#0061FF",
    domain: "dropbox.com",
    tierDefault: "Plus · Monthly",
    category: "Cloud",
  },
  nordvpn: {
    name: "NordVPN",
    logo: "https://cdn.simpleicons.org/nordvpn/4687FF",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/4/4c/NordVPN_Logo.svg",
    color: "#4687FF",
    domain: "nordvpn.com",
    tierDefault: "Plus · 2-Year",
    category: "Security",
  },
  zoom: {
    name: "Zoom Pro",
    logo: "https://cdn.simpleicons.org/zoom/2D8CFF",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Zoom_Communications_Logo.svg",
    color: "#2D8CFF",
    domain: "zoom.us",
    tierDefault: "Pro · Monthly",
    category: "Productivity",
  },
  google: {
    name: "Google One",
    logo: "https://cdn.simpleicons.org/google/4285F4",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
    color: "#4285F4",
    domain: "google.com",
    tierDefault: "100 GB · Annual",
    category: "Cloud",
  },
  hulu: {
    name: "Hulu",
    logo: "https://cdn.simpleicons.org/hulu/1CE783",
    color: "#1CE783",
    domain: "hulu.com",
    tierDefault: "No Ads · Monthly",
    category: "Streaming",
  },
  crunchyroll: {
    name: "Crunchyroll",
    logo: "https://cdn.simpleicons.org/crunchyroll/F47521",
    color: "#F47521",
    domain: "crunchyroll.com",
    tierDefault: "Mega Fan · Monthly",
    category: "Anime",
  },
  zee5: {
    name: "ZEE5 Premium",
    logo: "/logos/zee5.png",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=zee5.com&sz=128",
    color: "#7A2672",
    domain: "zee5.com",
    tierDefault: "Premium 4K · Annual",
    category: "Streaming",
  },
  "zee 5": {
    name: "ZEE5 Premium",
    logo: "/logos/zee5.png",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=zee5.com&sz=128",
    color: "#7A2672",
    domain: "zee5.com",
    tierDefault: "Premium 4K · Annual",
    category: "Streaming",
  },
  hbo: {
    name: "HBO",
    logo: "/logos/hbo.svg",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=hbo.com&sz=128",
    color: "#000000",
    domain: "hbo.com",
    tierDefault: "Max · Monthly",
    category: "Streaming",
  },
  "hbo max": {
    name: "HBO Max",
    logo: "/logos/max.svg",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=max.com&sz=128",
    color: "#002BE7",
    domain: "max.com",
    tierDefault: "Ad-Free · Monthly",
    category: "Streaming",
  },
  max: {
    name: "Max",
    logo: "/logos/max.svg",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=max.com&sz=128",
    color: "#002BE7",
    domain: "max.com",
    tierDefault: "Standard · Monthly",
    category: "Streaming",
  },
  sunnxt: {
    name: "Sun NXT",
    logo: "https://upload.wikimedia.org/wikipedia/en/e/e0/Sun_NXT.png",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=sunnxt.com&sz=128",
    color: "#FF6600",
    domain: "sunnxt.com",
    tierDefault: "Premium · 56 Days",
    category: "Streaming",
  },
  "sun nxt": {
    name: "Sun NXT",
    logo: "https://upload.wikimedia.org/wikipedia/en/e/e0/Sun_NXT.png",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=sunnxt.com&sz=128",
    color: "#FF6600",
    domain: "sunnxt.com",
    tierDefault: "Premium · 56 Days",
    category: "Streaming",
  },
  "jio sunnxt": {
    name: "Jio + Sun NXT",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/50/Reliance_Jio_Logo_%28October_2015%29.svg",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/en/e/e0/Sun_NXT.png",
    color: "#FF6600",
    domain: "sunnxt.com",
    tierDefault: "Prepaid 1.5GB/Day · 56 Days",
    category: "Telecom / Entertainment",
  },
  "jio + sun nxt": {
    name: "Jio + Sun NXT",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/50/Reliance_Jio_Logo_%28October_2015%29.svg",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/en/e/e0/Sun_NXT.png",
    color: "#FF6600",
    domain: "sunnxt.com",
    tierDefault: "Prepaid 1.5GB/Day · 56 Days",
    category: "Telecom / Entertainment",
  },
  "jio hotstar": {
    name: "Jio + Disney+ Hotstar",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/50/Reliance_Jio_Logo_%28October_2015%29.svg",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
    color: "#005AA9",
    domain: "jio.com",
    tierDefault: "Mobile 1.5GB/Day · 56 Days",
    category: "Telecom / Entertainment",
  },
  "jio + hotstar": {
    name: "Jio + Disney+ Hotstar",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/50/Reliance_Jio_Logo_%28October_2015%29.svg",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
    color: "#005AA9",
    domain: "jio.com",
    tierDefault: "Mobile 1.5GB/Day · 56 Days",
    category: "Telecom / Entertainment",
  },
  jio: {
    name: "MyJio",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/50/Reliance_Jio_Logo_%28October_2015%29.svg",
    fallbackLogo: "https://cdn.simpleicons.org/jio/005AA9",
    color: "#005AA9",
    domain: "jio.com",
    tierDefault: "Prepaid 2GB/Day · 28 Days",
    category: "Telecom",
  },
  myjio: {
    name: "MyJio",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/50/Reliance_Jio_Logo_%28October_2015%29.svg",
    fallbackLogo: "https://cdn.simpleicons.org/jio/005AA9",
    color: "#005AA9",
    domain: "jio.com",
    tierDefault: "Prepaid 2GB/Day · 28 Days",
    category: "Telecom",
  },
  gemini: {
    name: "Google Gemini",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/google/4285F4",
    color: "#1A73E8",
    domain: "gemini.google.com",
    tierDefault: "Advanced · Monthly",
    category: "AI",
  },
  "google gemini": {
    name: "Google Gemini Advanced",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/google/4285F4",
    color: "#1A73E8",
    domain: "gemini.google.com",
    tierDefault: "Advanced · Monthly",
    category: "AI",
  },
  airtel: {
    name: "Airtel Thanks",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b2/Bharti_Airtel_logo.svg",
    fallbackLogo: "https://cdn.simpleicons.org/airtel/E40000",
    color: "#E40000",
    domain: "airtel.in",
    tierDefault: "Unlimited 5G · 28 Days",
    category: "Telecom",
  },
  swiggy: {
    name: "Swiggy One",
    logo: "https://cdn.simpleicons.org/swiggy/FC8019",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/en/1/12/Swiggy_logo.svg",
    color: "#FC8019",
    domain: "swiggy.com",
    tierDefault: "One Membership · 3 Months",
    category: "Food",
  },
  zomato: {
    name: "Zomato Gold",
    logo: "https://cdn.simpleicons.org/zomato/CB202D",
    fallbackLogo: "https://upload.wikimedia.org/wikipedia/commons/7/75/Zomato_logo.png",
    color: "#CB202D",
    domain: "zomato.com",
    tierDefault: "Gold Membership · 3 Months",
    category: "Food",
  },
  jiocinema: {
    name: "JioCinema Premium",
    logo: "https://cdn.simpleicons.org/jio/005AA9",
    color: "#005AA9",
    domain: "jiocinema.com",
    tierDefault: "Family · Monthly",
    category: "Streaming",
  },
  medium: {
    name: "Medium Member",
    logo: "https://cdn.simpleicons.org/medium/000000",
    color: "#000000",
    domain: "medium.com",
    tierDefault: "Member · Monthly",
    category: "Reading",
  },
  strava: {
    name: "Strava Subscription",
    logo: "https://cdn.simpleicons.org/strava/FC6100",
    color: "#FC6100",
    domain: "strava.com",
    tierDefault: "Summit · Annual",
    category: "Fitness",
  },
  grammarly: {
    name: "Grammarly Premium",
    logo: "https://cdn.simpleicons.org/grammarly/15C39A",
    color: "#15C39A",
    domain: "grammarly.com",
    tierDefault: "Premium · Annual",
    category: "Productivity",
  },
  sonyliv: {
    name: "Sony LIV",
    logo: "https://cdn.simpleicons.org/sony/000000",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=sonyliv.com&sz=128",
    color: "#000000",
    domain: "sonyliv.com",
    tierDefault: "Premium · Annual",
    category: "Streaming",
  },
  "sony liv": {
    name: "Sony LIV",
    logo: "https://cdn.simpleicons.org/sony/000000",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=sonyliv.com&sz=128",
    color: "#000000",
    domain: "sonyliv.com",
    tierDefault: "Premium · Annual",
    category: "Streaming",
  },
  "apple tv": {
    name: "Apple TV+",
    logo: "https://cdn.simpleicons.org/appletv/000000",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=tv.apple.com&sz=128",
    color: "#000000",
    domain: "tv.apple.com",
    tierDefault: "Monthly Plan",
    category: "Streaming",
  },
  paramount: {
    name: "Paramount+",
    logo: "https://cdn.simpleicons.org/paramountplus/0064FF",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=paramountplus.com&sz=128",
    color: "#0064FF",
    domain: "paramountplus.com",
    tierDefault: "Essential · Monthly",
    category: "Streaming",
  },
  peacock: {
    name: "Peacock",
    logo: "https://www.google.com/s2/favicons?domain=peacocktv.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/peacocktv.com",
    color: "#000000",
    domain: "peacocktv.com",
    tierDefault: "Premium · Monthly",
    category: "Streaming",
  },
  jiosaavn: {
    name: "JioSaavn Pro",
    logo: "https://www.google.com/s2/favicons?domain=jiosaavn.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/jiosaavn.com",
    color: "#2BC5B4",
    domain: "jiosaavn.com",
    tierDefault: "Pro · Annual",
    category: "Music",
  },
  saavn: {
    name: "JioSaavn Pro",
    logo: "https://www.google.com/s2/favicons?domain=jiosaavn.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/jiosaavn.com",
    color: "#2BC5B4",
    domain: "jiosaavn.com",
    tierDefault: "Pro · Annual",
    category: "Music",
  },
  gaana: {
    name: "Gaana Plus",
    logo: "https://www.google.com/s2/favicons?domain=gaana.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/gaana.com",
    color: "#E72C30",
    domain: "gaana.com",
    tierDefault: "Plus · Annual",
    category: "Music",
  },
  wynk: {
    name: "Wynk Music",
    logo: "https://www.google.com/s2/favicons?domain=wynk.in&sz=128",
    fallbackLogo: "https://icon.horse/icon/wynk.in",
    color: "#E40000",
    domain: "wynk.in",
    tierDefault: "Premium · Monthly",
    category: "Music",
  },
  "apple music": {
    name: "Apple Music",
    logo: "https://cdn.simpleicons.org/applemusic/FA243C",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=music.apple.com&sz=128",
    color: "#FA243C",
    domain: "music.apple.com",
    tierDefault: "Individual · Monthly",
    category: "Music",
  },
  audible: {
    name: "Audible",
    logo: "https://cdn.simpleicons.org/audible/F8991C",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=audible.in&sz=128",
    color: "#F8991C",
    domain: "audible.in",
    tierDefault: "Membership · Monthly",
    category: "Audiobooks",
  },
  "kuku fm": {
    name: "Kuku FM",
    logo: "https://www.google.com/s2/favicons?domain=kukufm.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/kukufm.com",
    color: "#FF3366",
    domain: "kukufm.com",
    tierDefault: "Annual VIP",
    category: "Audiobooks",
  },
  kukufm: {
    name: "Kuku FM",
    logo: "https://www.google.com/s2/favicons?domain=kukufm.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/kukufm.com",
    color: "#FF3366",
    domain: "kukufm.com",
    tierDefault: "Annual VIP",
    category: "Audiobooks",
  },
  "pocket fm": {
    name: "Pocket FM",
    logo: "https://www.google.com/s2/favicons?domain=pocketfm.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/pocketfm.com",
    color: "#E50914",
    domain: "pocketfm.com",
    tierDefault: "VIP · Monthly",
    category: "Audiobooks",
  },
  pocketfm: {
    name: "Pocket FM",
    logo: "https://www.google.com/s2/favicons?domain=pocketfm.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/pocketfm.com",
    color: "#E50914",
    domain: "pocketfm.com",
    tierDefault: "VIP · Monthly",
    category: "Audiobooks",
  },
  tataplay: {
    name: "Tata Play",
    logo: "https://www.google.com/s2/favicons?domain=tataplay.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/tataplay.com",
    color: "#D8232A",
    domain: "tataplay.com",
    tierDefault: "Binge Plus · Monthly",
    category: "DTH / Streaming",
  },
  "tata play": {
    name: "Tata Play",
    logo: "https://www.google.com/s2/favicons?domain=tataplay.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/tataplay.com",
    color: "#D8232A",
    domain: "tataplay.com",
    tierDefault: "Binge Plus · Monthly",
    category: "DTH / Streaming",
  },
  vi: {
    name: "Vodafone Idea (Vi)",
    logo: "https://www.google.com/s2/favicons?domain=myvi.in&sz=128",
    fallbackLogo: "https://icon.horse/icon/myvi.in",
    color: "#ED1B24",
    domain: "myvi.in",
    tierDefault: "Unlimited Hero · 28 Days",
    category: "Telecom",
  },
  timesprime: {
    name: "Times Prime",
    logo: "https://www.google.com/s2/favicons?domain=timesprime.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/timesprime.com",
    color: "#9A12B3",
    domain: "timesprime.com",
    tierDefault: "Annual Membership",
    category: "Lifestyle",
  },
  "times prime": {
    name: "Times Prime",
    logo: "https://www.google.com/s2/favicons?domain=timesprime.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/timesprime.com",
    color: "#9A12B3",
    domain: "timesprime.com",
    tierDefault: "Annual Membership",
    category: "Lifestyle",
  },
  playstation: {
    name: "PlayStation Plus",
    logo: "https://cdn.simpleicons.org/playstation/003791",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=playstation.com&sz=128",
    color: "#003791",
    domain: "playstation.com",
    tierDefault: "Extra · Annual",
    category: "Gaming",
  },
  "ps plus": {
    name: "PlayStation Plus",
    logo: "https://cdn.simpleicons.org/playstation/003791",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=playstation.com&sz=128",
    color: "#003791",
    domain: "playstation.com",
    tierDefault: "Extra · Annual",
    category: "Gaming",
  },
  xbox: {
    name: "Xbox Game Pass",
    logo: "https://www.google.com/s2/favicons?domain=xbox.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/xbox.com",
    color: "#107C10",
    domain: "xbox.com",
    tierDefault: "Ultimate · Monthly",
    category: "Gaming",
  },
  "game pass": {
    name: "Xbox Game Pass",
    logo: "https://www.google.com/s2/favicons?domain=xbox.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/xbox.com",
    color: "#107C10",
    domain: "xbox.com",
    tierDefault: "Ultimate · Monthly",
    category: "Gaming",
  },
  nintendo: {
    name: "Nintendo Switch Online",
    logo: "https://www.google.com/s2/favicons?domain=nintendo.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/nintendo.com",
    color: "#E60012",
    domain: "nintendo.com",
    tierDefault: "Individual · Annual",
    category: "Gaming",
  },
  steam: {
    name: "Steam",
    logo: "https://cdn.simpleicons.org/steam/000000",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=128",
    color: "#171A21",
    domain: "steampowered.com",
    tierDefault: "Subscription",
    category: "Gaming",
  },
  cultfit: {
    name: "Cult.fit Pass",
    logo: "https://www.google.com/s2/favicons?domain=cult.fit&sz=128",
    fallbackLogo: "https://icon.horse/icon/cult.fit",
    color: "#FF3278",
    domain: "cult.fit",
    tierDefault: "Elite · 12 Months",
    category: "Fitness",
  },
  "cult.fit": {
    name: "Cult.fit Pass",
    logo: "https://www.google.com/s2/favicons?domain=cult.fit&sz=128",
    fallbackLogo: "https://icon.horse/icon/cult.fit",
    color: "#FF3278",
    domain: "cult.fit",
    tierDefault: "Elite · 12 Months",
    category: "Fitness",
  },
  blinkit: {
    name: "Blinkit",
    logo: "https://www.google.com/s2/favicons?domain=blinkit.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/blinkit.com",
    color: "#F8CB46",
    domain: "blinkit.com",
    tierDefault: "Blinkit Club",
    category: "Groceries",
  },
  zepto: {
    name: "Zepto Pass",
    logo: "https://www.google.com/s2/favicons?domain=zeptonow.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/zeptonow.com",
    color: "#8B5CF6",
    domain: "zeptonow.com",
    tierDefault: "Zepto Pass · Monthly",
    category: "Groceries",
  },
  discovery: {
    name: "Discovery+",
    logo: "https://www.google.com/s2/favicons?domain=discoveryplus.in&sz=128",
    fallbackLogo: "https://icon.horse/icon/discoveryplus.in",
    color: "#003C71",
    domain: "discoveryplus.in",
    tierDefault: "Premium · Annual",
    category: "Streaming",
  },
  "discovery+": {
    name: "Discovery+",
    logo: "https://www.google.com/s2/favicons?domain=discoveryplus.in&sz=128",
    fallbackLogo: "https://icon.horse/icon/discoveryplus.in",
    color: "#003C71",
    domain: "discoveryplus.in",
    tierDefault: "Premium · Annual",
    category: "Streaming",
  },
  aha: {
    name: "aha Video",
    logo: "https://www.google.com/s2/favicons?domain=aha.video&sz=128",
    fallbackLogo: "https://icon.horse/icon/aha.video",
    color: "#FF5722",
    domain: "aha.video",
    tierDefault: "Gold · Annual",
    category: "Streaming",
  },
  copilot: {
    name: "Microsoft Copilot Pro",
    logo: "https://cdn.simpleicons.org/microsoftcopilot/0078D4",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=copilot.microsoft.com&sz=128",
    color: "#0078D4",
    domain: "copilot.microsoft.com",
    tierDefault: "Pro · Monthly",
    category: "AI",
  },
  perplexity: {
    name: "Perplexity Pro",
    logo: "https://cdn.simpleicons.org/perplexity/20B2AA",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=perplexity.ai&sz=128",
    color: "#20B2AA",
    domain: "perplexity.ai",
    tierDefault: "Pro · Monthly",
    category: "AI",
  },
  midjourney: {
    name: "Midjourney",
    logo: "https://cdn.simpleicons.org/midjourney/000000",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=midjourney.com&sz=128",
    color: "#000000",
    domain: "midjourney.com",
    tierDefault: "Standard · Monthly",
    category: "AI",
  },
  truecaller: {
    name: "Truecaller Premium",
    logo: "https://www.google.com/s2/favicons?domain=truecaller.com&sz=128",
    fallbackLogo: "https://icon.horse/icon/truecaller.com",
    color: "#0087FF",
    domain: "truecaller.com",
    tierDefault: "Premium · Annual",
    category: "Utility",
  },
  expressvpn: {
    name: "ExpressVPN",
    logo: "https://cdn.simpleicons.org/expressvpn/DA3940",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=expressvpn.com&sz=128",
    color: "#DA3940",
    domain: "expressvpn.com",
    tierDefault: "12 Months Plan",
    category: "Security",
  },
  surfshark: {
    name: "Surfshark VPN",
    logo: "https://cdn.simpleicons.org/surfshark/00D18F",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=surfshark.com&sz=128",
    color: "#00D18F",
    domain: "surfshark.com",
    tierDefault: "2-Year Plan",
    category: "Security",
  },
  "1password": {
    name: "1Password",
    logo: "https://cdn.simpleicons.org/1password/0A85EA",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=1password.com&sz=128",
    color: "#0A85EA",
    domain: "1password.com",
    tierDefault: "Family · Annual",
    category: "Security",
  },
  bitwarden: {
    name: "Bitwarden",
    logo: "https://cdn.simpleicons.org/bitwarden/175DDC",
    fallbackLogo: "https://www.google.com/s2/favicons?domain=bitwarden.com&sz=128",
    color: "#175DDC",
    domain: "bitwarden.com",
    tierDefault: "Premium · Annual",
    category: "Security",
  },
};

/**
 * Clean and normalize a service name to match brand catalog or extract domain
 */
export function normalizeServiceName(rawName: string): string {
  if (!rawName) return "";
  return rawName
    .toLowerCase()
    .replace(/\b(super|pro|plus|premium|family|annual|monthly|subscription|plan|hd|4k|ultra|standard|basic)\b/gi, "")
    .replace(/[+·\-_]/g, " ")
    .trim();
}

/**
 * Resolves full brand metadata from any service name or URL
 */
// Extended domain mapping for popular global and regional services (Favicons & Logos)
export const KNOWN_DOMAINS: Record<string, string> = {
  canva: "canva.com",
  adobe: "adobe.com",
  photoshop: "adobe.com",
  illustrator: "adobe.com",
  chatgpt: "openai.com",
  openai: "openai.com",
  gpt: "openai.com",
  claude: "anthropic.com",
  anthropic: "anthropic.com",
  gemini: "google.com",
  google: "google.com",
  swiggy: "swiggy.com",
  zomato: "zomato.com",
  blinkit: "blinkit.com",
  zepto: "zeptonow.com",
  jio: "jio.com",
  myjio: "jio.com",
  airtel: "airtel.in",
  hbo: "hbo.com",
  "hbo max": "max.com",
  max: "max.com",
  peacock: "peacocktv.com",
  paramount: "paramountplus.com",
  jiosaavn: "jiosaavn.com",
  saavn: "jiosaavn.com",
  gaana: "gaana.com",
  wynk: "wynk.in",
  kukufm: "kukufm.com",
  "kuku fm": "kukufm.com",
  pocketfm: "pocketfm.com",
  "pocket fm": "pocketfm.com",
  vi: "myvi.in",
  vodafone: "myvi.in",
  "sun nxt": "sunnxt.net",
  sunnxt: "sunnxt.net",
  zee5: "zee5.com",
  hotstar: "hotstar.com",
  disney: "disneyplus.com",
  "prime video": "primevideo.com",
  prime: "amazon.in",
  amazon: "amazon.in",
  tataplay: "tataplay.com",
  "tata play": "tataplay.com",
  cultfit: "cult.fit",
  "cult.fit": "cult.fit",
  cult: "cult.fit",
  "gold gym": "goldsgym.com",
  "golds gym": "goldsgym.com",
  "anytime fitness": "anytimefitness.com",
  gym: "cult.fit",
  fitness: "cult.fit",
  coursera: "coursera.org",
  udemy: "udemy.com",
  duolingo: "duolingo.com",
  notion: "notion.so",
  figma: "figma.com",
  slack: "slack.com",
  discord: "discord.com",
  telegram: "telegram.org",
  zoom: "zoom.us",
  github: "github.com",
  gitlab: "gitlab.com",
  linkedin: "linkedin.com",
  netflix: "netflix.com",
  spotify: "spotify.com",
  youtube: "youtube.com",
  uber: "uber.com",
  ola: "olacabs.com",
  playstation: "playstation.com",
  xbox: "xbox.com",
  apple: "apple.com",
  icloud: "apple.com",
  audible: "audible.in",
  kindle: "amazon.in",
  medium: "medium.com",
  strava: "strava.com",
  grammarly: "grammarly.com",
  chess: "chess.com",
  truecaller: "truecaller.com",
  sonyliv: "sonyliv.com",
  "sony liv": "sonyliv.com",
  aha: "aha.video",
  timesprime: "timesprime.com",
  "times prime": "timesprime.com"
};

export function getBrandInfo(serviceName: string, serviceUrl?: string | null): BrandMetadata {
  const clean = normalizeServiceName(serviceName);
  const rawLower = (serviceName || "").toLowerCase().trim();

  // 1. Direct key match in catalog
  for (const [key, meta] of Object.entries(BRAND_CATALOG)) {
    if (rawLower.includes(key) || clean.includes(key) || key.includes(clean)) {
      return meta;
    }
  }

  // 2. Domain matching if URL provided or embedded in name
  let domain = "";
  if (serviceUrl) {
    try {
      const url = new URL(serviceUrl.startsWith("http") ? serviceUrl : `https://${serviceUrl}`);
      domain = url.hostname.replace(/^www\./, "");
      for (const meta of Object.values(BRAND_CATALOG)) {
        if (domain.includes(meta.domain)) {
          return meta;
        }
      }
    } catch {
      // ignore
    }
  }

  // If serviceName has a domain structure (e.g. "cult.fit", "canva.com", "openai.com")
  const domainRegex = /([a-z0-9-]+\.[a-z]{2,})/i;
  const domainMatch = (serviceUrl || serviceName || "").match(domainRegex);
  if (domainMatch && domainMatch[1]) {
    domain = domainMatch[1].toLowerCase();
  }

  // Check known domain dictionary
  if (!domain) {
    for (const [key, d] of Object.entries(KNOWN_DOMAINS)) {
      if (rawLower.includes(key) || clean.includes(key)) {
        domain = d;
        break;
      }
    }
  }

  // 3. Fallback: synthesize domain and use Google's high-res favicon service (sz=128 for crisp retina rendering)
  const fallbackDomain = domain || `${clean.replace(/[^a-z0-9]/g, "") || "service"}.com`;
  const fallbackLogo = `https://www.google.com/s2/favicons?domain=${fallbackDomain}&sz=128`;

  // Deterministic color generation based on name
  const colors = [
    "#6366F1", "#EC4899", "#8B5CF6", "#10B981", "#3B82F6",
    "#F59E0B", "#14B8A6", "#06B6D4", "#F43F5E", "#84CC16"
  ];
  let hash = 0;
  for (let i = 0; i < serviceName.length; i++) {
    hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];

  return {
    name: serviceName,
    logo: fallbackLogo,
    fallbackLogo: `https://icons.duckduckgo.com/ip3/${fallbackDomain}.ico`,
    color,
    domain: fallbackDomain,
  };
}

/**
 * Gets the best logo URL for any service name
 */
export function getBrandLogo(serviceName: string, customLogoUrl?: string | null): string {
  if (customLogoUrl && customLogoUrl.trim().length > 0) {
    return customLogoUrl.trim();
  }
  const info = getBrandInfo(serviceName);
  return info.logo;
}

/**
 * Gets the brand color
 */
export function getBrandColor(serviceName: string): string {
  return getBrandInfo(serviceName).color;
}

interface BrandLogoProps {
  name: string;
  iconUrl?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  rounded?: string;
  alt?: string;
}

const SIZE_MAP = {
  xs: "w-6 h-6 p-1 text-[10px]",
  sm: "w-8 h-8 p-1.5 text-xs",
  md: "w-12 h-12 p-2 text-sm",
  lg: "w-16 h-16 p-2.5 text-lg",
  xl: "w-20 h-20 p-3 text-2xl",
};

/**
 * Universal BrandLogo component:
 * - Detects official logos automatically
 * - Tries primary logo -> fallback logo -> monogram pill
 * - Ensures 100% zero broken images and zero layout shift
 */
export function BrandLogo({
  name,
  iconUrl,
  className = "",
  size = "md",
  rounded = "rounded-2xl",
  alt,
}: BrandLogoProps) {
  const brandInfo = getBrandInfo(name);

  // Generate candidate URL cascade in order of reliability and crisp resolution:
  const candidateUrls = React.useMemo(() => {
    const list: string[] = [];
    if (iconUrl && iconUrl.trim().length > 0) list.push(iconUrl.trim());
    if (brandInfo.logo && !list.includes(brandInfo.logo)) list.push(brandInfo.logo);
    if (brandInfo.fallbackLogo && !list.includes(brandInfo.fallbackLogo)) list.push(brandInfo.fallbackLogo);

    // Google S2 Favicon (Crisp 128px retina favicon directly from official website domain)
    if (brandInfo.domain) {
      const googleFavicon = `https://www.google.com/s2/favicons?domain=${brandInfo.domain}&sz=128`;
      if (!list.includes(googleFavicon)) list.push(googleFavicon);

      // Icon Horse (High-res Apple Touch Icon / Touch Favicon)
      const iconHorse = `https://icon.horse/icon/${brandInfo.domain}`;
      if (!list.includes(iconHorse)) list.push(iconHorse);
    }

    return list;
  }, [name, iconUrl, brandInfo.logo, brandInfo.fallbackLogo, brandInfo.domain]);

  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const [hasAllFailed, setHasAllFailed] = useState<boolean>(false);

  // Reset cascade when name or iconUrl changes
  React.useEffect(() => {
    setCandidateIndex(0);
    setHasAllFailed(false);
  }, [name, iconUrl]);

  const handleImageError = () => {
    if (candidateIndex + 1 < candidateUrls.length) {
      setCandidateIndex((prev) => prev + 1);
    } else {
      setHasAllFailed(true);
    }
  };

  const currentSrc = candidateUrls[candidateIndex];
  const initial = (name || "S").trim().charAt(0).toUpperCase();
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      className={`${sizeClasses} ${rounded} bg-white shrink-0 border border-slate-200/90 shadow-2xs flex items-center justify-center overflow-hidden transition-transform ${className}`}
    >
      {!hasAllFailed && currentSrc ? (
        <img
          src={currentSrc}
          alt={alt || `${name} logo`}
          onError={handleImageError}
          loading="lazy"
          className="w-full h-full object-contain"
        />
      ) : (
        <div
          className={`w-full h-full ${rounded} flex items-center justify-center font-black text-white shadow-inner`}
          style={{ backgroundColor: brandInfo.color }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

