const axios = require('axios');

const TOKEN = process.env.TELEGRAM_TOKEN;
const GAS_URL = process.env.GAS_URL;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

// Helper: Fungsi untuk rata tengah (center alignment)
function centerText(text, width) {
    let str = text.toString().substring(0, width);
    let padLeft = Math.floor((width - str.length) / 2);
    let padRight = width - str.length - padLeft;
    return ' '.repeat(padLeft) + str + ' '.repeat(padRight);
}

// Helper: Fungsi memformat tabel (rata tengah & kolom pertama rata kiri)
function formatTable(rows) {
    let text = '';
    const colWidth = 11;

    rows.forEach((row, rowIndex) => {
        if (row.join('').trim() === '') return; // Skip baris kosong

        let formattedRow = row.map((cell, colIndex) => {
            let cellStr = (cell !== "" && cell !== undefined ? cell : '-').toString();

            // Aturan khusus kolom terakhir (Persentase), abaikan baris pertama (header)
            if (rowIndex > 0 && colIndex === row.length - 1 && cellStr !== '-') {
                let num = parseFloat(cellStr);
                if (!isNaN(num) && cellStr.includes('.')) {
                    cellStr = (num * 100).toFixed(2) + '%';
                }
            }

            // ATURAN BARU: Kolom pertama (index 0) di bawah header (rowIndex > 0) -> Rata Kiri
            if (rowIndex > 0 && colIndex === 0) {
                return cellStr.substring(0, colWidth).padEnd(colWidth, ' ');
            }

            // Sisanya tetap rata tengah
            return centerText(cellStr, colWidth);
        });
        
        text += formattedRow.join(' | ') + '\n';

        if (rowIndex === 0) {
            let separatorRow = row.map(() => '-'.repeat(colWidth));
            text += separatorRow.join('-|-') + '\n';
        }
    });
    return text;
}

module.exports = async (req, res) => {
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
                        [{ text: '📋 REPORT DAPROS', callback_data: 'report_dapros' }],
                        [{ text: '📑 REKAP CLOSING BY', callback_data: 'rekap_closing' }],
                        [{ text: '🔧 REPORT TEKNISI', callback_data: 'report_teknisi' }]
                    ]
                }
            });
        }

        // --- HANDLER KLIK TOMBOL ---
        if (callback_query) {
            const chatId = callback_query.message.chat.id;
            const data = callback_query.data;

            await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: callback_query.id });

            let action = '';
            let title = '';

            if (data === 'report_progress') {
                action = 'progress';
                title = '📊 REPORT PROGRESS';
            } else if (data === 'report_dapros') {
                action = 'dapros';
                title = '📋 REPORT DAPROS';
            } else if (data === 'rekap_closing') {
                action = 'closing';
                title = '📑 REKAP CLOSING BY';
            } else if (data === 'report_teknisi') {
                action = 'teknisi'; 
            }

            if (action !== '') {
                const response = await axios.get(`${GAS_URL}?action=${action}`);
                
                if (action === 'teknisi') {
                    const { header, best, middle, worst } = response.data;
                    
                    let text = '<b>🔧 REPORT TEKNISI</b>\n\n';
                    
                    text += '<b>1. BEST 5 TEKNISI</b>\n<pre>';
                    text += formatTable([header, ...best]);
                    text += '</pre>\n';
                    
                    text += '<b>2. MIDDLE 5 TEKNISI</b>\n<pre>';
                    text += formatTable([header, ...middle]);
                    text += '</pre>\n';
                    
                    text += '<b>3. WORST 5 TEKNISI</b>\n<pre>';
                    text += formatTable([header, ...worst]);
                    text += '</pre>';
                    
                    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text, parse_mode: 'HTML' });
                } else {
                    const rows = response.data.data;
                    let text = `<b>${title}</b>\n\n<pre>`;
                    text += formatTable(rows);
                    text += '</pre>';
                    
                    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text, parse_mode: 'HTML' });
                }
            }
        }
        
        return res.status(200).send('OK');
    } catch (error) {
        console.error(error);
        return res.status(200).send('OK'); 
    }
};
