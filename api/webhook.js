const axios = require('axios');

const TOKEN = process.env.TELEGRAM_TOKEN;
const GAS_URL = process.env.GAS_URL; // Diambil dari environment Vercel
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

// Fungsi bantuan untuk memformat tabel (rata tengah header & konversi persen)
function formatTable(rows) {
    let text = '';
    rows.forEach((row, rowIndex) => {
        let formattedRow = row.map((cell, colIndex) => {
            let cellStr = (cell !== "" && cell !== undefined ? cell : '-').toString();

            // Aturan khusus kolom terakhir (Persentase), abaikan baris pertama (header)
            if (rowIndex > 0 && colIndex === row.length - 1) {
                let num = parseFloat(cellStr);
                if (!isNaN(num)) {
                    // Jadikan persen dengan 2 angka di belakang koma
                    cellStr = (num * 100).toFixed(2) + '%';
                }
            }

            // Pastikan tidak lebih dari 10 karakter agar tabel tidak hancur
            cellStr = cellStr.substring(0, 10);

            // Jika ini baris pertama (Header), buat rata tengah
            if (rowIndex === 0) {
                let padLeft = Math.floor((10 - cellStr.length) / 2);
                return cellStr.padStart(cellStr.length + padLeft, ' ').padEnd(10, ' ');
            }

            // Jika baris biasa, buat rata kiri
            return cellStr.padEnd(10, ' ');
        });
        
        text += formattedRow.join(' | ') + '\n';
    });
    return text;
}

module.exports = async (req, res) => {
    // Hanya proses method POST dari Telegram
    if (req.method !== 'POST') return res.status(200).send('Bot Aktif');

    try {
        const { message, callback_query } = req.body;

        // --- HANDLER COMMAND /start ---
        if (message && message.text === '/start') {
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: message.chat.id,
                text: '<b>Pilih menu laporan di bawah ini:</b>',
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📊 REPORT PROGRESS', callback_data: 'report_progress' }],
                        [{ text: '📋 REPORT DAPROS', callback_data: 'report_dapros' }]
                    ]
                }
            });
        }

        // --- HANDLER KLIK TOMBOL ---
        if (callback_query) {
            const chatId = callback_query.message.chat.id;
            const data = callback_query.data;

            // Hilangkan loading di tombol Telegram
            await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: callback_query.id });

            if (data === 'report_progress') {
                const response = await axios.get(`${GAS_URL}?action=progress`);
                const rows = response.data.data;
                
                let text = '<b>📊 REPORT PROGRESS</b>\n\n<pre>';
                text += formatTable(rows);
                text += '</pre>';
                
                await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text, parse_mode: 'HTML' });
            
            } else if (data === 'report_dapros') {
                const response = await axios.get(`${GAS_URL}?action=dapros`);
                const rows = response.data.data;
                
                let text = '<b>📋 REPORT DAPROS</b>\n\n<pre>';
                text += formatTable(rows);
                text += '</pre>';
                
                await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text, parse_mode: 'HTML' });
            }
        }
        
        return res.status(200).send('OK');
    } catch (error) {
        console.error(error);
        return res.status(200).send('OK'); 
    }
};
