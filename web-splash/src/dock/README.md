# ReactBits Dock

Dock.tsx is the upstream TypeScript/Tailwind source, retrieved unchanged from:
https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Components/Dock/Dock.tsx

The upstream component remains unchanged. main.tsx configures a mobile variant:
56px stable targets (magnification=baseItemSize), an 80px panel, 14px gap,
persistent labels inside each icon, and the original click bounce.
The host reserves 120dp for the panel and bounce, without hidden hover labels.
The HTML, CSS and JavaScript are bundled offline by scripts/sync-web-dock.mjs.
Backdrop blur is limited to web content, not the native screen behind the WebView.
