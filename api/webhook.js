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

// Helper: Fungsi memformat tabel (tambah parameter isPercentage)
function formatTable(rows, isPercentage = true) {
    let text = '';
    const colWidth = 10;

    rows.forEach((row, rowIndex) => {
        if (row.join('').trim() === '') return; // Skip baris kosong

        let formattedRow = row.map((cell, colIndex) => {
            let cellStr = (cell !== "" && cell !== undefined ? cell : '-').toString();

            // Aturan khusus kolom terakhir
            if (rowIndex > 0 && colIndex === row.length - 1 && cellStr !== '-') {
                let normalizedStr = cellStr.replace(',', '.'); 
                let num = parseFloat(normalizedStr);
                
                if (!isNaN(num) && (normalizedStr.includes('.') || typeof cell === 'number')) {
                    if (isPercentage) {
                        // Jika persen aktif, kali 100 dan tambah %
                        cellStr = (num * 100).toFixed(2) + '%';
                    } else {
                        // Jika persen mati, tampilkan angka murni (batasi 2 koma jika desimal)
                        // Tapi jika angka bulat (seperti di Closing), biarkan bulat
                        cellStr = Number.isInteger(num) ? num.toString() : num.toFixed(2);
                    }
                }
            }

            // Kolom pertama (index 0) di bawah header (rowIndex > 0) -> Rata Kiri
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
    if (req.method !== 'POST') return res.status(200).send('Bot Hack Aktif');

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
                        [{ text: '📑 REKAP CLOSED BY', callback_data: 'rekap_closing' }],
                        [{ text: '🔧 PROD TEKNISI', callback_data: 'prod_teknisi' }] 
                    ]
                }
            });
        }

        // --- HANDLER KLIK TOMBOL ---
        if (callback_query) {
            const chatId = callback_query.message.chat.id;
            const data = callback_query.data;

            await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: callback_query.id });

            // 1. Logika ketika tombol utama PROD TEKNISI diklik -> Munculkan 2 Sub-Button
            if (data === 'prod_teknisi') {
                await axios.post(`${TELEGRAM_API}/sendMessage`, {
                    chat_id: chatId,
                    text: '<b>Pilih kategori PROD TEKNISI:</b>',
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '👤 TEKNISI', callback_data: 'sub_teknisi' },
                                { text: '🏢 BRANCH', callback_data: 'sub_branch' }
                            ]
                        ]
                    }
                });
                return res.status(200).send('OK');
            }

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
                title = '📑 REKAP CLOSED BY';
            } else if (data === 'sub_teknisi') {
                action = 'teknisi';
            } else if (data === 'sub_branch') {
                action = 'branch';
            }

            if (action !== '') {
                const response = await axios.get(`${GAS_URL}?action=${action}`);
                
                // Handler Sub-Button TEKNISI
                if (action === 'teknisi') {
                    const { header, best, middle, worst } = response.data;
                    let text = '<b>🔧 PROD TEKNISI</b>\n\n';
                    
                    text += '<b>1. 🎖 BEST 5 TEKNISI</b>\n<pre>';
                    text += formatTable([header, ...best]);
                    text += '</pre>\n';
                    
                    text += '<b>2. 🥈 MIDDLE 5 TEKNISI</b>\n<pre>';
                    text += formatTable([header, ...middle]);
                    text += '</pre>\n';
                    
                    text += '<b>3. 🚨 WORST 5 TEKNISI</b>\n<pre>';
                    text += formatTable([header, ...worst]);
                    text += '</pre>';
                    
                    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text, parse_mode: 'HTML' });
                
                // Handler Sub-Button BRANCH 
                } else if (action === 'branch') {
                    const { freelance, multiskill, dedicated } = response.data;
                    let text = '<b>🏢 PROD TEKNISI - BRANCH</b>\n\n';
                    
                    text += '<b>1. FREELANCE</b>\n<pre>';
                    text += formatTable(freelance, false); 
                    text += '</pre>\n';
                    
                    text += '<b>2. Multiskill</b>\n<pre>';
                    text += formatTable(multiskill, false);
                    text += '</pre>\n';
                    
                    text += '<b>3. Dedicated</b>\n<pre>';
                    text += formatTable(dedicated, false);
                    text += '</pre>';
                    
                    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text, parse_mode: 'HTML' });
                
                } else {
                    // Handler Tombol Lainnya (Progress, Dapros, Closing)
                    const rows = response.data.data;
                    let text = `<b>${title}</b>\n\n<pre>`;
                    
                    // PERBAIKAN: Jika yang diklik adalah rekap_closing, matikan fitur persen
                    if (action === 'closing') {
                        text += formatTable(rows, false);
                    } else {
                        text += formatTable(rows, true); // Progress & Dapros tetap pakai persen
                    }
                    
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
