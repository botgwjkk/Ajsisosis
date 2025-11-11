const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const { TOKEN, OWNER_ID, BANNER_FILE_ID, OWNER_CONTACT_URL } = require('./setting');
const { MIN_GROUP_FOR_PREMIUM, PREMIUM_DAYS_ON_JOIN } = require('./setting');
const lastBroadcast = {};
const moment = require('moment');
moment.locale('id');
const bot = new TelegramBot(TOKEN, { polling: true });

let forwardChatId = null;
let forwardMessageId = null;
let autoForwardInterval = null;
let autoForwardDelay = 5 * 60 * 1000;

// ====== CONFIG CHANNEL WAJIB JOIN ======
const CHANNEL_USERNAME = 'infobotjasherfree'; // ganti dengan channel kamu tanpa @

// ====== CEK KEANGGOTAAN CHANNEL ======
async function isUserJoinedChannel(userId) {
  try {
    const member = await bot.getChatMember(`@${CHANNEL_USERNAME}`, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (e) {
    return false;
  }
}

// ====== ANIMASI LOADING (simulate typing) ======
async function sendLoading(bot, chatId, duration = 3000, text = "⏳ Sedang memproses...") {
  const message = await bot.sendMessage(chatId, text);
  const dots = ['.', '..', '...', '....', '.....'];
  for (let i = 0; i < dots.length; i++) {
    await new Promise(r => setTimeout(r, duration / dots.length));
    try {
      await bot.editMessageText(`${text}${dots[i]}`, {
        chat_id: chatId,
        message_id: message.message_id
      });
    } catch {}
  }
  await bot.deleteMessage(chatId, message.message_id);
}

// Helper JSON
function readJSON(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// File Data
const groupsFile = 'groups.json';
const premiumFile = 'premium.json';
const pendingFile = 'pending.json';

function getPending() {
  return readJSON(pendingFile, {});
}
function savePending(data) {
  writeJSON(pendingFile, data);
}
function getGroups() {
  return readJSON(groupsFile, []);
}
function saveGroup(id) {
  const groups = getGroups();
  if (!groups.includes(id)) {
    groups.push(id);
    writeJSON(groupsFile, groups);
    return true;
  }
  return false;
}
function removeGroup(id) {
  const groups = getGroups().filter(g => g !== id);
  writeJSON(groupsFile, groups);
}
function getPremium() {
  return readJSON(premiumFile, {});
}
function savePremium(data) {
  writeJSON(premiumFile, data);
}
function addPremium(userId, days, via = 'manual') {
  const db = getPremium();
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;
  db[userId] = { until: now + ms, via };
  savePremium(db);
}
function removePremium(userId) {
  const db = getPremium();
  delete db[userId];
  savePremium(db);
}
function isPremium(userId) {
  const db = getPremium();
  return db[userId] && db[userId].until > Date.now();
}

// ========== /start ==========
bot.onText(/\/start(?:\s+(\w+))?/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // 🔒 Cek wajib join channel dulu
  const joined = await isUserJoinedChannel(userId);
  if (!joined) {
    return bot.sendMessage(chatId, `❌ Kamu harus join channel terlebih dahulu untuk bisa menggunakan bot ini.\n\n📢 Silakan join channel kami:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📢 Join Channel", url: `https://t.me/${CHANNEL_USERNAME}` }],
          [{ text: "✅ Verifikasi", callback_data: "verify_join" }]
        ]
      }
    });
  }

  // 🎬 Animasi loading sebelum tampil menu
  await sendLoading(bot, chatId, 3000, "🤖 Memuat data kamu");

  const isOwner = chatId == OWNER_ID;
  const groupCount = getGroups().length;
  const status = isPremium(chatId) ? "𝗬𝗲𝘀 ✅" : "𝗡𝗼 ❌";
  const pending = getPending();
  pending[chatId] = { via: 'manual' };
  savePending(pending);
  const botInfo = await bot.getMe();
  const botUsername = botInfo.username;

  const textUser = `
\`\`\`

( 👋🏻 ) - Olaa Omm!\nI Am Nailong Bot Version 2.0

╭────────────────────────────>
├── 𝗕𝗢𝗧 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 🤖
├── 👤 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿 : @Jeckk88
├── 🐣 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 𝗕𝗼𝘁 : 2.0 
├── 📢 𝗧𝗼𝘁𝗮𝗹 𝗚𝗿𝘂𝗽 : ${groupCount}
├── 🍌 𝗬𝗼𝘂𝗿 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 : ${status}
╰────────────────────────────>
╭────────────────────────────>
├── 𝗠𝗘𝗡𝗨 𝗨𝗦𝗘𝗥 🤖
├── /share
├── /set
├── /aturjeda
├── /auto
╰────────────────────────────>\`\`\``;

  const textOwner = `
\`\`\`

( 👋🏻 ) - Olaa Omm!\nI Am Jasher Bot Version 2.0

╭────────────────────────────>
├── 𝗕𝗢𝗧 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 🤖
├── 👤 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿 : @Jeckk88
├── 🐣 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 𝗕𝗼𝘁 : 2.0 
├── 📢 𝗧𝗼𝘁𝗮𝗹 𝗚𝗿𝘂𝗽 : ${groupCount}
├── 🍌 𝗬𝗼𝘂𝗿 𝗦𝘁𝗮𝘁𝘂𝘀 : 𝗢𝘄𝗻𝗲𝗿 𝗕𝗢𝗧 🌟
╰────────────────────────────>

╭────────────────────────────>
├── 𝗠𝗘𝗡𝗨 𝗢𝗪𝗡𝗘𝗥 🤖
├── /idgrup
├── /hapusgrup
├── /resetgrup
├── /broadcast
├── /share
├── /set
├── /setjedaauto
├── /auto
├── /addprem
├── /delprem
├── /listprem
╰────────────────────────────>

╭──── ⧼ 𝗖𝗔𝗥𝗔 𝗗𝗔𝗣𝗔𝗧𝗜𝗡 𝗣𝗥𝗘𝗠 ⧽ ────╮
├ ᴍᴀsᴜᴋɪɴ ʙᴏᴛ ᴋᴇ 2 ʀᴏᴏᴍ ᴘᴜʙʟɪᴄ
├ ᴋʟᴏ ᴜᴅʜ, sᴇɴᴅ ᴛᴇᴋs ʟᴜ ᴋᴇ ʙᴏᴛ 1× 
├ ʙᴏᴛ ᴀᴋᴀɴ sʜᴀʀᴇ ᴛᴇᴋs ʟᴜ ᴏᴛᴏᴍᴀᴛɪs
├ ɢᴏsᴀʜ sᴘᴀᴍ ʙᴏᴛ ᴀsᴜ ᴡᴀʟᴀᴜᴘᴜɴ ғʀᴇᴇ
╰─────────────────────────────╯\`\`\`
`;

  const replyMarkup = !isOwner
    ? {
        inline_keyboard: [
          [
            { text: '➕ Tambahkan ke Grup', url: `https://t.me/${botUsername}?startgroup=true` }
          ],
          [
            { text: '💬 Kontak Owner', url: OWNER_CONTACT_URL },
            { text: '📢 Informasi bot', url: 'https://t.me/Jeckk88' } // <-- Jangan di hapus hargai Developer
          ]
        ]
      }
    : undefined;

  try {
    await bot.sendPhoto(chatId, BANNER_FILE_ID, {
      caption: isOwner ? textOwner : textUser,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    });
  } catch (err) {
    await bot.sendMessage(chatId, isOwner ? textOwner : textUser, {
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    });
  }
});

// ===== HANDLER VERIFIKASI CHANNEL =====
bot.on('callback_query', async (query) => {
  const { data, message, from } = query;
  const chatId = message.chat.id;

  if (data === 'verify_join') {
    const joined = await isUserJoinedChannel(from.id);
    if (joined) {
      bot.answerCallbackQuery(query.id, { text: '✅ Kamu sudah join channel!', show_alert: true });
      await bot.sendMessage(chatId, '🎉 Terima kasih sudah join channel!\nSekarang kamu bisa pakai semua fitur bot.');
      await sendLoading(bot, chatId, 2500, "🚀 Menyiapkan sistem");
      bot.sendMessage(chatId, 'Ketik /start lagi untuk mulai 😄');
    } else {
      bot.answerCallbackQuery(query.id, { text: '❌ Kamu belum join channel!', show_alert: true });
    }
  }
});

// ========== /share ==========
bot.onText(/\/share/, async (msg) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  // cek akses
  if (fromId !== OWNER_ID && !isPremium(fromId))
    return bot.sendMessage(chatId, '❌ Fitur ini hanya untuk user premium atau owner.');
  if (!msg.reply_to_message)
    return bot.sendMessage(chatId, '❌ Balas pesan yang ingin dibagikan dengan perintah /share.');

  // --- ANIMASI JASHER ---
  const jasherSteps = [
    "🔧 Sedang memproses JASHER anda\nProses dalam 1%",
    "🔎 Proses dalam 15%",
    "⚙️ Proses dalam 30%",
    "⚡ Proses dalam 50%",
    "🚀 Proses dalam 70%",
    "🏁 Proses dalam 100%",
    "✅ Successfull"
  ];

  // Kirim pesan awal
  let progressMsg;
  try {
    progressMsg = await bot.sendMessage(chatId, jasherSteps[0]);
  } catch (e) {
    progressMsg = await bot.sendMessage(chatId, "⏳ Memulai proses JASHER...");
  }

  // putar animasi: edit message per langkah + chat action
  for (let i = 1; i < jasherSteps.length; i++) {
    try { await bot.sendChatAction(chatId, 'typing'); } catch (e) {}
    await new Promise(r => setTimeout(r, 700));
    try {
      await bot.editMessageText(jasherSteps[i], {
        chat_id: chatId,
        message_id: progressMsg.message_id
      });
    } catch (err) {
      // lanjut jika edit gagal
    }
  }

  // jeda sebelum mulai kirim dan bersihkan pesan progress agar chat rapi
  await new Promise(r => setTimeout(r, 600));
  try { await bot.deleteMessage(chatId, progressMsg.message_id); } catch (e) {}

  // --- DITAHAP INI KITA TAHU JUMLAH GRUP ---
  const reply = msg.reply_to_message;
  const groups = getGroups();
  const totalGroups = groups.length || 0;

  // Notifikasi yang diperbarui: tampilkan jumlah grup yang akan dikirimi
  await bot.sendMessage(chatId, `🚀 JASHER siap. Memulai mengirim pesan ke ${totalGroups} grup...`);

  // --- PROSES KIRIM KE GRUP ---
  let success = 0, failed = 0;
  const perGroupDelay = 400; // ms, atur sesuai kebutuhan

  for (const groupId of groups) {
    try {
      if (reply.text) {
        await bot.sendMessage(groupId, reply.text);
      } else if (reply.photo) {
        const fileId = reply.photo[reply.photo.length - 1].file_id;
        await bot.sendPhoto(groupId, fileId, { caption: reply.caption || '' });
      } else if (reply.video) {
        await bot.sendVideo(groupId, reply.video.file_id, { caption: reply.caption || '' });
      }
      success++;
    } catch (err) {
      failed++;
    }
    // jeda supaya tidak kena rate limit
    await new Promise(r => setTimeout(r, perGroupDelay));
  }

  // --- LAPORAN AKHIR ---
  const report = `╭─❰ 𝗣𝗘𝗡𝗚𝗜𝗥𝗜𝗠𝗔𝗡 𝗦𝗘𝗟𝗘𝗦𝗔𝗜 ❱─╮
✅ 𝗕𝗲𝗿𝗵𝗮𝘀𝗶𝗹: ${success} Grup 👾
❌ 𝗚𝗮𝗴𝗮𝗹: ${failed} Grup 🐣
⏳ Tunggu 5-10 Menit Sebelum Kirim Lagi ⏱️
╰────────────────────╯`;
  await bot.sendMessage(chatId, report);
});
// Handle Message dan Kirim ke Grup
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const from = msg.from;
  if (!from) return;

  const userId = from.id;
  const isOwner = userId == OWNER_ID;
  const isPremiumUser = isPremium(userId);

  // ✅ Deteksi jika bot ditambahkan ke grup
  if ((msg.chat.type === 'group' || msg.chat.type === 'supergroup') && msg.new_chat_members) {
    const botUsername = (await bot.getMe()).username;

    for (const newMember of msg.new_chat_members) {
      if (newMember.username === botUsername) {
        const added = saveGroup(chatId);
        if (added) {
          const groupList = getGroups();
          bot.sendMessage(OWNER_ID, `🤖 Bot ditambahkan ke grup!\n🆔 *ID:* \`${chatId}\`\n📦 Total: ${groupList.length}`, { parse_mode: 'Markdown' });

          const inviter = msg.from?.id;
          const pending = getPending();

          if (inviter && pending[inviter]) {
  const pending = getPending();
  if (!pending[inviter].groups) pending[inviter].groups = [];

  // Tambahkan grup baru ke daftar milik user
  if (!pending[inviter].groups.includes(chatId)) {
    pending[inviter].groups.push(chatId);
    savePending(pending);
  }

  // Cek grup valid (punya ≥15 member)
  let validCount = 0;
  for (const gid of pending[inviter].groups) {
    try {
      const count = await bot.getChatMemberCount(gid);
      if (count >= 15) validCount++;
    } catch (err) {
      console.log(`Gagal cek member grup ${gid}:`, err.message);
    }
  }

  // Jika sudah 2 grup valid
  if (validCount >= MIN_GROUP_FOR_PREMIUM) {
    addPremium(inviter, PREMIUM_DAYS_ON_JOIN, 'grup');
    delete pending[inviter];
    savePending(pending);

    bot.sendMessage(inviter, `🎉 Terima kasih telah menambahkan bot ke ${validCount} grup valid!\n💎 Premium kamu aktif selama ${PREMIUM_DAYS_ON_JOIN} hari.`);
  } else {
    bot.sendMessage(inviter, `📌 Kamu baru menambahkan ${validCount} grup valid.\nTambahkan ke minimal ${MIN_GROUP_FOR_PREMIUM} grup dengan 15+ member agar premium aktif.`);
  }
}
        }
      }
    }
    return;
  }

  // 🔐 Hanya premium dan owner yang bisa kirim pesan manual (misal /share)
  if (!isPremiumUser && !isOwner) {
    bot.sendMessage(chatId, `❌ Kamu belum menambahkan bot ini ke dalam grup.\n\nUntuk mendapatkan akses premium GRATIS:\n➕ Tambahkan bot ke minimal ${MIN_GROUP_FOR_PREMIUM} grup\n✅ Maka kamu otomatis jadi user premium.\n\nJika sudah, kirim pesan ulang.`);
    return;
  }
});

// Perintah Owner
bot.onText(/\/idgrub/, (msg) => {
  if (msg.chat.id !== OWNER_ID) return;
  const text = getGroups().join('\n') || 'Belum ada grup.';
  bot.sendMessage(OWNER_ID, `📋 *Daftar ID Grup:*\n\n${text}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/hapusgrub (.+)/, (msg, match) => {
  if (msg.chat.id !== OWNER_ID) return;
  const id = parseInt(match[1]);
  removeGroup(id);
  bot.sendMessage(OWNER_ID, `✅ Grup ${id} berhasil dihapus.`);
});

bot.onText(/\/resetgrub/, (msg) => {
  if (msg.chat.id !== OWNER_ID) return;
  writeJSON(groupsFile, []);
  bot.sendMessage(OWNER_ID, '🔄 Semua grup direset.');
});

// Handler untuk kirim hanya teks
bot.onText(/\/broadcast(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const teks = match[1]?.trim();
  const db = getPremium(); // Ambil database user premium
  const tanggal = moment().locale('id').format('dddd, D MMMM YYYY');

  if (userId !== OWNER_ID) return;

  const userIds = Object.keys(db).filter(id => db[id].until > Date.now());

  if (!teks) {
    return bot.sendMessage(chatId, '❗ Format salah. Gunakan: `/broadcast isi_pesan`', {
      parse_mode: 'Markdown'
    });
  }

  const isiPesan = `👑 *DARI DEVELOPER*\n\n📢 *Info:*\n${teks}\n\n📆 *Tanggal:* ${tanggal}`;

  let sukses = 0;
  let gagal = 0;

  for (const id of userIds) {
    try {
      await bot.sendMessage(id, isiPesan, { parse_mode: 'Markdown' });
      sukses++;
    } catch (e) {
      gagal++;
    }
  }

  bot.sendMessage(chatId, `📢 Broadcast selesai!\n✅ Sukses: ${sukses}\n❌ Gagal: ${gagal}`);
});

// Kode Broadcast Baru
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const db = getPremium();
  const tanggal = moment().locale('id').format('dddd, D MMMM YYYY');
  const userIds = Object.keys(db).filter(id => db[id].until > Date.now());

  if (userId !== OWNER_ID) return;

  if ((msg.photo || msg.video) && msg.caption?.toLowerCase().startsWith('/broadcast')) {
    const caption = msg.caption.replace('/broadcast', '').trim();
    const captionFinal = `👑 *DARI DEVELOPER*\n\n📢 *Info:*\n${caption}\n\n📆 *Tanggal:* ${tanggal}`;
    const mediaFileId = msg.photo
      ? msg.photo[msg.photo.length - 1].file_id
      : msg.video.file_id;

    let sukses = 0;
    let gagal = 0;

    for (const id of userIds) {
      try {
        if (msg.photo) {
          await bot.sendPhoto(id, mediaFileId, { caption: captionFinal, parse_mode: 'Markdown' });
        } else {
          await bot.sendVideo(id, mediaFileId, { caption: captionFinal, parse_mode: 'Markdown' });
        }
        sukses++;
      } catch (e) {
        gagal++;
      }
    }

    bot.sendMessage(userId, `📢 Broadcast media selesai!\n✅ Sukses: ${sukses}\n❌ Gagal: ${gagal}`);
  }
});

// Bot Dikeluarkan
bot.on('left_chat_member', (msg) => {
  if (!bot.botInfo) return;
  if (msg.left_chat_member.id === bot.botInfo.id) {
    const groupId = msg.chat.id;
    removeGroup(groupId);

    const userId = msg.from?.id;
    if (userId) {
      removePremium(userId);
      bot.sendMessage(userId, `⚠️ Kamu telah mengeluarkan bot dari grup.\n💎 Premium kamu dicabut.`);
    }

    const list = getGroups();
    bot.sendMessage(OWNER_ID, `🚫 Bot dikeluarkan dari grup!\n🆔 *ID:* \`${groupId}\`\n📦 Tersisa: ${list.length}`, { parse_mode: 'Markdown' });
  }
});

// Cek Premium Setiap Jam
setInterval(() => {
  const db = getPremium();
  const now = Date.now();

  for (const id in db) {
    if (db[id].until < now) {
      removePremium(id);
      bot.sendMessage(id, `⚠️ Masa premium kamu sudah habis.\n\nHubungi owner:\n👉 [KLIK DI SINI](https://t.me/${bot.botInfo?.username})`, {
        parse_mode: 'Markdown'
      });
    }
  }
}, 1000 * 60 * 60); // setiap 1 jam

bot.onText(/\/set/, (msg) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  if (fromId !== OWNER_ID && !isPremium(fromId)) {
    return bot.sendMessage(chatId, '❌ Fitur ini hanya bisa digunakan oleh user premium atau owner.');
  }

  if (msg.reply_to_message) {
    forwardChatId = msg.reply_to_message.chat.id;
    forwardMessageId = msg.reply_to_message.message_id;

    bot.sendMessage(chatId, '✅ Pesan berhasil disimpan untuk auto forward.');
  } else {
    bot.sendMessage(chatId, '❌ Balas pesan dengan perintah /set.');
  }
});

bot.onText(/\/auto (on|off)/, (msg, match) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  if (fromId !== OWNER_ID && !isPremium(fromId)) {
    return bot.sendMessage(chatId, '❌ Fitur ini hanya bisa digunakan oleh user premium atau owner.');
  }

  const status = match[1];

  if (status === 'off') {
    if (autoForwardInterval) {
      clearInterval(autoForwardInterval);
      autoForwardInterval = null;
      return bot.sendMessage(chatId, '🔕 Auto forward dimatikan.');
    } else {
      return bot.sendMessage(chatId, '⚠️ Auto forward belum aktif.');
    }
  }

  if (!forwardChatId || !forwardMessageId) {
    return bot.sendMessage(chatId, '❌ Belum ada pesan yang diset. Gunakan perintah /set dengan membalas pesan.');
  }

  if (autoForwardInterval) {
    return bot.sendMessage(chatId, '⚠️ Auto forward sudah aktif.');
  }

  const targetGroups = getGroups();

  autoForwardInterval = setInterval(() => {
    const targetGroups = getGroups();
    targetGroups.forEach(groupId => {
      bot.forwardMessage(groupId, forwardChatId, forwardMessageId)
        .then(() => console.log(`Forwarded to ${groupId}`))
        .catch(err => console.error(`Gagal forward ke ${groupId}:`, err.message));
    });
  }, autoForwardDelay);

  bot.sendMessage(chatId, `✅ Auto forward aktif setiap ${autoForwardDelay / 60000} menit ke ${targetGroups.length} grup.`);
});

bot.onText(/\/setjedaauto (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  if (fromId !== OWNER_ID && !isPremium(fromId)) {
    return bot.sendMessage(chatId, '❌ Fitur ini hanya bisa digunakan oleh user premium atau owner.');
  }

  const menit = parseInt(match[1]);

  if (isNaN(menit) || menit <= 0) {
    return bot.sendMessage(chatId, '❌ Masukkan angka menit yang valid. Contoh: /setjedaauto 5');
  }

  autoForwardDelay = menit * 60 * 1000;

  if (autoForwardInterval) {
    clearInterval(autoForwardInterval);
    autoForwardInterval = setInterval(() => {
      const targetGroups = getGroups();
      targetGroups.forEach(groupId => {
        bot.forwardMessage(groupId, forwardChatId, forwardMessageId).catch(() => {});
      });
    }, autoForwardDelay);
  }

  bot.sendMessage(chatId, `✅ Jeda auto forward diatur menjadi setiap ${menit} menit.`);
});



bot.onText(/\/addprem (\d+) (\d+)/, (msg, match) => {
  const fromId = msg.from.id;
  if (fromId !== OWNER_ID) return;

  const userId = parseInt(match[1]);
  const days = parseInt(match[2]);

  if (isNaN(userId) || isNaN(days) || days <= 0) {
    return bot.sendMessage(fromId, '❌ Format salah. Contoh: /addprem 123456789 30');
  }

  addPremium(userId, days, 'manual');
  bot.sendMessage(fromId, `✅ User ${userId} telah diberi premium selama ${days} hari.`);
});

bot.onText(/\/delprem (\d+)/, (msg, match) => {
  const fromId = msg.from.id;
  if (fromId !== OWNER_ID) return;

  const userId = parseInt(match[1]);
  removePremium(userId);

  bot.sendMessage(fromId, `🗑️ Premium user ${userId} telah dihapus.`);
});

bot.onText(/\/listprem/, (msg) => {
  const fromId = msg.from.id;
  if (fromId !== OWNER_ID) return;

  const db = getPremium();
  const now = Date.now();

  if (!Object.keys(db).length) {
    return bot.sendMessage(fromId, '📭 Belum ada user premium.');
  }

  const list = Object.entries(db)
    .filter(([_, val]) => val.until > now)
    .map(([id, val]) => {
      const sisa = Math.ceil((val.until - now) / (1000 * 60 * 60 * 24));
      const asal = val.via === 'grup' ? '📌 via grup' : '✍️ manual';
      return `🆔 ${id} - ⏳ ${sisa} hari - ${asal}`;
    })
    .join('\n');

  bot.sendMessage(fromId, `📋 *List User Premium:*\n\n${list}`, { parse_mode: 'Markdown' });
});

// Inisialisasi Bot
bot.getMe().then(botInfo => {
  bot.botInfo = botInfo;
  console.log(`🤖 Bot aktif sebagai @${botInfo.username}`);
});
