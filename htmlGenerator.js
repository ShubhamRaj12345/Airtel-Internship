const fs = require('fs');
const path = require('path');

const HTML_FOLDER = path.join(__dirname, 'html_files');

if (!fs.existsSync(HTML_FOLDER)) {
  fs.mkdirSync(HTML_FOLDER);
}

function generateHTML(nearby, center, fileName = "map.html") {
  return new Promise((resolve, reject) => {

    const fullPath = path.join(HTML_FOLDER, fileName);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Style Map</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>

  <style>
    body { margin: 0; }

    #map {
      height: 100vh;
      width: 100%;
      touch-action: pan-x pan-y; /* ✅ smooth mobile drag */
    }

    /* 🏷️ TOOLTIP (WHITE TEXT FIX) */
    .leaflet-tooltip {
      background: rgba(0,0,0,0.75);
      border: none;
      box-shadow: none;
      color: white;
      font-weight: bold;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
    }

    /* 💬 POPUP FIX (RESPONSIVE + WHITE TEXT) */
    .leaflet-popup-content-wrapper {
      background: #1e1e1e;
      color: white;
      border-radius: 10px;
      max-width: 85vw;   /* ✅ mobile fit */
    }

    .leaflet-popup-content {
      color: white;
      word-wrap: break-word;
      white-space: normal;
      max-width: 80vw;
    }

    .leaflet-popup-tip {
      background: #1e1e1e;
    }

  </style>
</head>

<body>

<div id="map"></div>

<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<script>

  // 🧭 SMOOTH MAP (drag fix)
  var map = L.map('map', {
    inertia: true,
    zoomAnimation: true,
    fadeAnimation: true,
    preferCanvas: true
  }).setView([${center.latitude}, ${center.longitude}], 14);

  // 🗺 GOOGLE MAP STYLE TILE
  L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
  }).addTo(map);

  // 🔴 RED CIRCLE (unchanged)
  L.circle([${center.latitude}, ${center.longitude}], {
    color: 'red',
    fillColor: '#ff0000',
    fillOpacity: 0.3,
    radius: 1500
  }).addTo(map);

  // 📍 MARKERS
  ${nearby.map(loc => `
    var marker = L.marker([${loc.latitude}, ${loc.longitude}]).addTo(map);

    marker.bindPopup(\`
      <b>${loc.name}</b><br><br>
      SNo: ${loc.sno}<br>
      Site: ${loc.site}<br>
      WIFI: ${loc.wifi}<br>
      Gross: ${loc.gross}<br>
      CAF: ${loc.caf_count}<br>
      SSO: ${loc.sso}<br>
      MNP+Fresh: ${loc.mnp_fresh}<br>
      Distance: ${(loc.distance / 1000).toFixed(2)} KM
    \`);

    marker.bindTooltip("${loc.name} (Wifi:${loc.wifi} | Gross:${loc.gross})", {
      permanent: true,
      direction: "top",
      offset: [0, -10]
    });
  `).join("")}

</script>

</body>
</html>
`;

    fs.writeFileSync(fullPath, htmlContent);
    resolve(fullPath);
  });
}

module.exports = generateHTML;