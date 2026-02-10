# Self-Hosted Windows Backend + Expo Mobile System

This guide explains how to set up a private Cloud server on your own Windows machine and connect a mobile app to it using Expo and Cloudflare Tunnel.

## 🚀 Project Structure
- `/backend`: Node.js Express API.
- `/mobile`: React Native Expo app.

---

## 1. Backend Setup (Windows)

1.  **Install Node.js**: Ensure you have Node.js installed on your Windows machine.
2.  **Install Dependencies**:
    ```bash
    cd backend
    npm install
    ```
3.  **Run the Server**:
    ```bash
    node index.js
    ```
    - The server will run on `http://localhost:4000`.

---

## 2. Expose to Internet (Cloudflare Tunnel)

Since this is a self-hosted server, we use **Cloudflare Tunnel** to make it accessible over HTTPS without port forwarding.

1.  **Download Cloudflared**: 
    - Download the Windows `.exe` from [Cloudflare's website](https://github.com/cloudflare/cloudflared/releases).
2.  **Authenticate**:
    ```powershell
    cloudflared.exe tunnel login
    ```
3.  **Create a Tunnel**:
    ```powershell
    cloudflared.exe tunnel create my-server
    ```
4.  **Expose the Port**:
    ```powershell
    cloudflared.exe tunnel --url http://localhost:4000
    ```
    - Cloudflare will provide a random URL (e.g., `https://random-words.trycloudflare.com`).
    - **Copy this URL**.

---

## 3. Mobile App Setup (Expo)

1.  **Install Expo CLI**:
    ```bash
    npm install -g expo-cli
    ```
2.  **Configure API URL**:
    - Open `mobile/App.js`.
    - Replace `API_BASE_URL` with your Cloudflare Tunnel URL.
    - Example: `const API_BASE_URL = "https://your-tunnel-domain.trycloudflare.com";`
3.  **Install Dependencies**:
    ```bash
    cd mobile
    npm install
    ```
4.  **Start Expo**:
    ```bash
    npx expo start
    ```
5.  **Run on Mobile**:
    - Build/Start common QR code: A QR code will appear in your terminal.
    - **Install Expo Go** (from Play Store or App Store) on your phone.
    - Scan the QR code using the Expo Go app (Android) or Camera app (iOS).
    - The app will open and connect to your **Windows Self-Hosted Server**.

---

## 🛠 Features
- **Self-Hosted**: No AWS/Azure/GCP required.
- **Secure**: HTTPS provided by Cloudflare.
- **Zero Port Forwarding**: Safer than traditional hosting.
- **Fast Iteration**: Use Expo Go to test on physical devices instantly.
