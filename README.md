# ⛳ YKTS (You Know The Score)
### Real-Time Tour-Grade Golf Scoring App

**YKTS** is a high-performance, mobile-first web application designed to bring a professional tournament atmosphere to casual golf rounds. Built with **React**, **Tailwind CSS**, and **Firebase**, it features real-time synchronization, multi-mode scoring logic, and a live "Announcer" feed.

---

## 🚀 Key Features

* **Multi-Mode Engine:** Supports Stroke Play, Stableford, Scramble, Best Ball, Alternate Shot, Match Play, and the high-stakes "Snake" mode.
* **Live Commentary Feed:** An automated "Announcer" logic that calls out Birdies, Eagles, Holes-in-One, and Lead Changes in real-time.
* **Real-Time Sync:** Powered by Firebase Firestore `onSnapshot` for instant score updates across all devices in the group.
* **Professional Analytics:** Smart logic that calculates "To Par" scores and Stableford points dynamically based on holes actually played.
* **Camera Roll Export:** One-tap scorecard generation using `html-to-image` with a native mobile share-sheet fallback.
* **PWA Ready:** Manifest and metadata configured for a "standalone" home-screen experience, hiding browser bars for full immersion.
* **Custom Branding:** Integrated splash screen and branded UI with custom logo support.

---

## 🛠️ Tech Stack

* **Frontend:** React (Vite)
* **Styling:** Tailwind CSS (for a modern, "App-Store" aesthetic)
* **Backend:** Firebase Firestore (Real-time NoSQL Database)
* **Icons:** Lucide React
* **Image Processing:** html-to-image
* **Animation:** Framer Motion / Tailwind Animate

---

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yourusername/ykts-golf.git](https://github.com/yourusername/ykts-golf.git)