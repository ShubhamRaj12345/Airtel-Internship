require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const csv = require('csv-parser');
const geolib = require('geolib');
const archiver = require('archiver');
const path = require('path');
const generateHTML = require('./htmlGenerator');
const generateKMZ = require('./kmzGenerator');
const KMZ_FOLDER = path.join(__dirname, 'kmz_files');

if (!fs.existsSync(KMZ_FOLDER)) {
  fs.mkdirSync(KMZ_FOLDER);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    autoStart: true,
    interval: 3000,
    params: { timeout: 10 }
  }
});

bot.on('polling_error', (error) => {
  console.log("Polling error:", error.code);
});

process.on('unhandledRejection', (err) => {
  console.log("Unhandled Error:", err);
});

let locations = [];
let usersData = [];
let userState = [];
let verifiedUsers = [];

if (fs.existsSync('verifiedUsers.json')) {
  verifiedUsers = JSON.parse(fs.readFileSync('verifiedUsers.json'));
}


const logFile = 'login_log.csv';

if (!fs.existsSync(logFile)) {
  fs.writeFileSync(
    logFile,
    "ChatId,EmployeeId,Mobile,Site,LoginDate,LoginTime\n",
    "utf8"
  );
}

function writeLog(arr) {
  fs.appendFileSync(logFile, arr.join(",") + "\n", "utf8");
}


function getISTDateTime() {
  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata'
  });

  const [date, time] = now.split(',');
  return { date: date.trim(), time: time.trim() };
}

fs.createReadStream(process.env.CSV_PATH)
  .pipe(csv())
  .on('data', (row) => {

    const lat = parseFloat(row.LATITUDE_1);
    const lng = parseFloat(row.LONGITUDE_1);

    const wifi = parseInt((row.WIFI || "0").trim()) || 0;
    const gross = parseInt((row.Gross || "0").trim()) || 0;
    const caf_count = parseInt((row.caf_count || "0").trim()) || 0;
    const sso = parseInt((row.SSO || "0").trim()) || 0;
    const mnp_fresh = parseInt((row["MNP+Fresh"] || "0").trim()) || 0;

    locations.push({
      sno: row.Sno,
      name: row.NAME,
      latitude: lat,
      longitude: lng,
      site: row.SITE,
      longitude_main: row.LONGITUDE,
      latitude_main: row.LATITUDE,
      wifi: wifi,
      gross: gross,
      caf_count: caf_count,
      sso: sso,
      mnp_fresh: mnp_fresh
    });
  })
  .on('end', () => {
    console.log('Location CSV Loaded');
  });

fs.createReadStream(process.env.NEWLIST_PATH)
  .pipe(csv())
  .on('data', (row) => {
    usersData.push({
      employeeId: String(row.EmployeeId).trim(),
      mobile: String(row.Mobile).trim()
    });
  })
  .on('end', () => {
    console.log('User CSV Loaded');
  });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const existingUser = verifiedUsers.find(u => String(u.chatId) === String(chatId));

  if (existingUser) {
    userState[chatId] = {
      step: "ask_site",
      employeeId: existingUser.employeeId,
      mobile: existingUser.mobile
    };

    return bot.sendMessage(chatId, " Welcome back!\n  Enter SITE:");
  }

  userState[chatId] = { step: "ask_employeeId" };

  bot.sendMessage(
    chatId,
    "Welcome\n You are not registered in the system.\nPlease enter your Employee ID to begin registration."
  );
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  if (text === "/start") return;
  if (!userState[chatId]) return;

  const step = userState[chatId].step;

  if (step === "ask_employeeId") {

    const user = usersData.find(u => u.employeeId === text.trim());

    if (user) {
      userState[chatId] = {
        step: "ask_contact",
        employeeId: user.employeeId,
        mobile: user.mobile
      };

      bot.sendMessage(chatId, "Share your mobile number", {
        reply_markup: {
          keyboard: [[{ text: "Share Contact ", request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });

    } else {
      bot.sendMessage(chatId, "Invalid Employee ID. Try again:");
    }
  }

  else if (step === "ask_site") {

    const enteredSite = text.trim();

    const state = userState[chatId];

    if (!state || !state.employeeId || !state.mobile) {
      return bot.sendMessage(chatId, "⚠ Session expired. Please send /start again.");
    }

    const siteLocations = locations.filter(loc => loc.site === enteredSite);

    if (siteLocations.length === 0) {
      return bot.sendMessage(chatId, "Invalid SITE. Try again:");
    }

    userState[chatId].site = enteredSite;

    const ref = siteLocations[0];

    const results = locations.map(loc => {
      const distance = geolib.getDistance(
        { latitude: ref.latitude, longitude: ref.longitude },
        { latitude: loc.latitude, longitude: loc.longitude }
      );

      return { ...loc, distance };
    });

    results.sort((a, b) => a.distance - b.distance);

    let message = `Site: ${enteredSite}\n`;
    message += `Location: ${ref.latitude}, ${ref.longitude}\n\n`;

    const nearby = results.filter(loc => loc.distance <= 1500);

    if (nearby.length === 0) {
      return bot.sendMessage(chatId, "No locations found within 1.5 KM");
    }

   nearby.forEach((loc, index) => {
   const label = String.fromCharCode(97 + index);

    message += `${label}. ${loc.name} | WIFI:${loc.wifi} | Gross:${loc.gross || "Nil"}\n`;
    message += `CAF Count:${loc.caf_count} | MNP+Fresh:${loc.mnp_fresh} | SSO:${loc.sso} | Distance ${(loc.distance / 1000).toFixed(2)} KM\n\n`;
    });

    const { date, time } = getISTDateTime();
    writeLog([
      chatId,
      state.employeeId,
      state.mobile,
      enteredSite,
      date,
      time
    ]);

bot.sendMessage(chatId, "Site Name Receive Preparing files...");

Promise.all([
  generateKMZ(nearby, {
    latitude: ref.latitude,
    longitude: ref.longitude
  }, `site_${enteredSite}.kmz`),

  generateHTML(nearby, {
    latitude: ref.latitude,
    longitude: ref.longitude
  }, `site_${enteredSite}.html`)
])
.then(([kmzFile, htmlFile]) => {
  return bot.sendDocument(chatId, kmzFile, {
    caption: ` Site: ${enteredSite}\n  KMZ File Ready`
  })
  .then(() => {
    return bot.sendDocument(chatId, htmlFile,{
      caption: `HTML Report for Site: ${enteredSite}`
    });
  });

})
.then(() => {
  return bot.sendMessage(chatId, message);
})
.catch(err => {
  console.log("Error:", err);
  bot.sendMessage(chatId, "Error generating files");
});
 }
});

bot.on('contact', (msg) => {
  const chatId = msg.chat.id;

  if (!userState[chatId] || userState[chatId].step !== "ask_contact") return;

  let phone = msg.contact.phone_number.replace(/^\+91/, "").replace(/^91/, "");
  let expected = userState[chatId].mobile.replace(/^\+91/, "").replace(/^91/, "");

  if (phone === expected) {

    const exists = verifiedUsers.find(u => String(u.chatId) === String(chatId));

    if (!exists) {
      verifiedUsers.push({
        chatId: chatId,
        employeeId: userState[chatId].employeeId,
        mobile: expected
      });

      fs.writeFileSync('verifiedUsers.json', JSON.stringify(verifiedUsers, null, 2));
    }

    userState[chatId].step = "ask_site";

    bot.sendMessage(chatId, "Verified!\n  Now enter SITE (example: MRKH01)", {
      reply_markup: { remove_keyboard: true }
    });

  } else {
    bot.sendMessage(chatId, "Mobile number does not match.");
  }
});