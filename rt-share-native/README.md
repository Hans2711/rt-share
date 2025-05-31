# RT Share Native

This directory contains a React Native implementation of the RT Share client.
The app mirrors the functionality of the web version using `react-native-webrtc`
and connects to the same Go WebSocket signalling server.

## Development

Install dependencies and start the Expo development server:

```bash
npm install
npm start
```

Use `npm run android`, `npm run ios` or `npm run web` to run the app on the
corresponding platform.

The default signalling server URL is `wss://rt-share.diesing.pro:3000/`. If you
host your own server, adjust the URL in `App.tsx`.
