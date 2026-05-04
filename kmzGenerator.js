const fs = require('fs');
const archiver = require('archiver');
const path = require('path');
const KMZ_FOLDER = path.join(__dirname, 'kmz_files');

if (!fs.existsSync(KMZ_FOLDER)) {
  fs.mkdirSync(KMZ_FOLDER);
}

function generateKMZ(nearby, center, fileName = "locations.kmz") {
  return new Promise((resolve, reject) => {

const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>

<LookAt>
  <longitude>${center.longitude}</longitude>
  <latitude>${center.latitude}</latitude>
  <altitude>0</altitude>
  <range>2000</range>  
  <tilt>0</tilt>
  <heading>0</heading>
</LookAt>

<Style id="customStyle">
  <BalloonStyle>
    <bgColor>00ffffff</bgColor> <!-- transparent -->
    <textColor>ff000000</textColor>

    <text>
      <![CDATA[
      <div style="
        font-family: Arial;
        font-size: 10px;
        line-height: 1.5;

        background: #ffffff;
        border: 2px solid #0077ff; 
        border-radius: 16px;
        padding: 14px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        max-width: 260px;
      ">

      
        <h2 style="
          margin:0;
          color:black;
          font-size:15px;
        ">
          $[name]
        </h2>
      
        <hr style="margin:8px 0; border:0; border-top:1px solid #ddd;">

    
        <div>
          $[description]
        </div>

      </div>
      ]]>
    </text>
  </BalloonStyle>
</Style>

`;
  const kmlFooter = `</Document></kml>`;
  let placemarks = "";
  nearby.forEach(loc => {
  const lat = loc.latitude;
  const lng = loc.longitude;
  const directionLink = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  placemarks += `
  <Placemark>
   <styleUrl>#customStyle</styleUrl>
   <name>${loc.name} (Wifi:${loc.wifi} | Gross:${loc.gross})</name>

    <Style>
      <IconStyle>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <description>
<![CDATA[
<div style="
  font-family: Arial;
  font-size: 13px;
  line-height: 1.5;
  background: #ffffff;
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  max-width: 250px;
">

  <b>Site:</b> ${loc.site}<br>
  <b>SNo:</b> ${loc.sno}<br>
  <b>WIFI:</b> ${loc.wifi}<br>
  <b>Gross:</b> ${loc.gross}<br>
  <b>CAF:</b> ${loc.caf_count}<br>
  <b>MNP+Fresh:</b> ${loc.mnp_fresh}<br>
  <b>SSO:</b> ${loc.sso}<br>
  <b>Distance:</b> ${(loc.distance / 1000).toFixed(2)} KM<br><br>

  <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}"
     target="_blank"
     style="
      display:block;
      text-align:center;
      padding:8px;
      background:#0077ff;
      color:white;
      text-decoration:none;
      border-radius:10px;
      font-weight:bold;
     ">
      Get Direction
  </a>
</div>
]]>
</description>
    <Point>
      <coordinates>${lng},${lat}</coordinates>
    </Point>
  </Placemark>`;
});
   const radius = 1500;
    const points = 36;
    let circleCoords = "";
    for (let i = 0; i <= points; i++) {
      const angle = (i * 360) / points;
      const dx = radius * Math.cos(angle * Math.PI / 180);
      const dy = radius * Math.sin(angle * Math.PI / 180);
      const lat = center.latitude + (dy / 111320);
      const lng = center.longitude + (dx / (111320 * Math.cos(center.latitude * Math.PI / 180)));

      circleCoords += `${lng},${lat} `;
    }

    const circle = `
    <Placemark>
      <name>1.5 KM Radius</name>
      <Style>
        <LineStyle><color>ff0000ff</color><width>2</width></LineStyle>
        <PolyStyle><color>330000ff</color></PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${circleCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;

    const centerPopup = `
<Placemark>
  <name> ${fileName}</name>

  <description>
    <![CDATA[
    <b>Site:</b> ${fileName}<br>
    <b>Total Locations:</b> ${nearby.length}
    ]]>
  </description>

  <Point>
    <coordinates>${center.longitude},${center.latitude}</coordinates>
  </Point>
</Placemark>`;
    const kmlContent = kmlHeader + placemarks + circle + centerPopup + kmlFooter;

    fs.writeFileSync("temp.kml", kmlContent);

    const fullPath = path.join(KMZ_FOLDER, fileName);
    const output = fs.createWriteStream(fullPath);
    const archive = archiver('zip');

    output.on('close', () => {
      console.log("KMZ Ready");
      fs.unlinkSync("temp.kml"); 
      resolve(fullPath);
    });

    archive.on('error', err => reject(err));

    archive.pipe(output);
    archive.file("temp.kml", { name: "doc.kml" });

    archive.finalize();
  });
}

module.exports = generateKMZ;