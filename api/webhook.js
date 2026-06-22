const axios = require('axios');

const TOKEN = process.env.TELEGRAM_TOKEN;
const SPREADSHEET_ID = '19vGtLjCW9l-yGVur-TuQimkDyQaEqno_SMMixi9WoaI';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send('Bot sedang berjalan...');
    }

    try {
        const { message, callback_query } = req.body;

        // Menangani perintah teks /start
        if (message) {
            const chatId = message.chat.id;
            const text = message.text;

            if (text === '/start') {
                await sendMenu(chatId);
            }
        }

        // Menangani klik pada Inline Button
        if (callback_query) {
            const callbackId = callback_query.id;
            const chatId = callback_query.message.chat.id;
            const data = callback_query.data;

            // Jawab callback query segera agar indikator loading di Telegram hilang
            await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: callbackId });

            if (data === 'report_progress') {
                await handleReportProgress(chatId);
            } else if (data === 'report_dapros') {
                await handleReportDapros(chatId);
            }
        }

        return res.status(200).send('OK');
    } catch (error) {
        console.error('Error Webhook:', error.response ? error.response.data : error.message);
        return res.status(200).send('OK'); // Tetap kirim 200 ke Telegram untuk mencegah redelivery loop
    }
};

// Fungsi untuk mengirimkan 2 tombol menu utama
async function sendMenu(chatId) {
    const url = `${TELEGRAM_API}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: '<b>Pilih menu laporan di bawah ini:</b>',
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 REPORT PROGRESS', callback_data: 'report_progress' }],
                [{ text: '📋 REPORT DAPROS', callback_data: 'report_dapros' }]
            ]
        }
    };
    await axios.post(url, payload);
}

// Handler untuk REPORT PROGRESS (T1:Z15) -> 7 Kolom
async function handleReportProgress(chatId) {
    try {
        const range = 'data!T1:Z15';
        const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
        const response = await axios.get(sheetUrl);
        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            await sendMessage(chatId, 'Data REPORT PROGRESS tidak ditemukan atau kosong.');
            return;
        }

        let messageText = '<b>📊 REPORT PROGRESS (T1:Z15)</b>\n\n<pre>';
        
        rows.forEach((row) => {
            const formattedRow = [];
            // T sampai Z totalnya ada 7 kolom
            for (let i = 0; i < 7; i++) {
                let cell = row[i] || '-';
                // Potong maksimal 10 huruf dan tambahkan spasi (padding) agar presisi rata kolom
                let truncated = cell.toString().substring(0, 10).padEnd(10, ' ');
                formattedRow.push(truncated);
            }
            messageText += formattedRow.join(' | ') + '\n';
        });

        messageText += '</pre>';

        await sendMessage(chatId, messageText, 'HTML');
    } catch (error) {
        console.error(error);
        await sendMessage(chatId, '❌ Gagal mengambil data REPORT PROGRESS. Periksa setelan share spreadsheet atau API Key.');
    }
}

// Handler untuk REPORT DAPROS (AC1:AG14) -> 5 Kolom
async function handleReportDapros(chatId) {
    try {
        const range = 'data!AC1:AG14';
        const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
        const response = await axios.get(sheetUrl);
        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            await sendMessage(chatId, 'Data REPORT DAPROS tidak ditemukan atau kosong.');
            return;
        }

        let messageText = '<b>📋 REPORT DAPROS (AC1:AG14)</b>\n\n<pre>';
        
        rows.forEach((row) => {
            const formattedRow = [];
            // AC sampai AG totalnya ada 5 kolom
            for (let i = 0; i < 5; i++) {
                let cell = row[i] || '-';
                let truncated = cell.toString().substring(0, 10).padEnd(10, ' ');
                formattedRow.push(truncated);
            }
            messageText += formattedRow.join(' | ') + '\n';
        });

        messageText += '</pre>';

        await sendMessage(chatId, messageText, 'HTML');
    } catch (error) {
        console.error(error);
        await sendMessage(chatId, '❌ Gagal mengambil data REPORT DAPROS. Periksa setelan share spreadsheet atau API Key.');
    }
}

// Helper fungsi kirim pesan
async function sendMessage(chatId, text, parseMode = '') {
    const url = `${TELEGRAM_API}/sendMessage`;
    const payload = { chat_id: chatId, text: text };
    if (parseMode) payload.parse_mode = parseMode;
    await axios.post(url, payload);
}
