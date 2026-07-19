const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

// เส้นทางไปยังโฟลเดอร์เก็บ Error Log
const ERROR_DIR = path.join(__dirname, 'error');

/**
 * ฟังก์ชันสำหรับสร้างโฟลเดอร์ error หากยังไม่มี
 */
function ensureErrorDirectory() {
    if (!fs.existsSync(ERROR_DIR)) {
        fs.mkdirSync(ERROR_DIR, { recursive: true });
        console.log(`[System] Created error directory at: ${ERROR_DIR}`);
    }
}

/**
 * ฟังก์ชันจัดฟอร์แมตวันที่และเวลาสำหรับชื่อไฟล์
 * รูปแบบ: วัน+เดือน+ปี-ชั่วโมง+นาที (เช่น 19+07+2026-11+50)
 */
function getFormattedTimestamp() {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    
    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1); // เดือนใน JS เริ่มจาก 0
    const year = now.getFullYear();
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());

    return `${day}+${month}+${year}-${hours}+${minutes}`;
}

/**
 * ฟังก์ชันบันทึก Error ลงไฟล์ .txt เมื่อได้รับแจ้งจากบอท
 */
function saveErrorLog(botName, botPid, errorData) {
    ensureErrorDirectory();

    const timestamp = getFormattedTimestamp();
    const fileName = `${botName}_${timestamp}.txt`;
    const filePath = path.join(ERROR_DIR, fileName);

    const logContent = [
        `===========================================`,
        ` Discord Bot Error Report`,
        `===========================================`,
        `Bot Name    : ${botName}`,
        `Date/Time   : ${new Date().toLocaleString('th-TH')}`,
        `PID         : ${botPid}`,
        `Error Name  : ${errorData.name || 'UnknownError'}`,
        `Message     : ${errorData.message || 'No message provided'}`,
        `-------------------------------------------`,
        `Stack Trace :`,
        `${errorData.stack || 'No stack trace available'}`,
        `===========================================`
    ].join('\n');

    try {
        fs.writeFileSync(filePath, logContent, 'utf8');
        console.log(`[System] [🔴 Error Saved] Log written to error/${fileName}`);
    } catch (fsErr) {
        console.error(`[System] [❌ FS Error] Failed to write log file:`, fsErr.message);
    }
}

/**
 * ฟังก์ชันสแกนโฟลเดอร์เพื่อค้นหาและรัน bot.js
 */
function bootstrapBots() {
    ensureErrorDirectory();
    console.log(`[System] Scanning for Discord Bots...`);

    // อ่านรายการไฟล์/โฟลเดอร์ทั้งหมดใน root directory
    const items = fs.readdirSync(__dirname);

    items.forEach(item => {
        const itemPath = path.join(__dirname, item);
        
        // ตรวจสอบว่าเป็นโฟลเดอร์ และไม่ใช่โฟลเดอร์ระบบ 'error' หรือโฟลเดอร์ซ่อน
        if (fs.statSync(itemPath).isDirectory() && item !== 'error' && !item.startsWith('.')) {
            const botFilePath = path.join(itemPath, 'bot.js');

            // ตรวจสอบว่าในโฟลเดอร์นั้นมีไฟล์ bot.js อยู่จริงหรือไม่
            if (fs.existsSync(botFilePath)) {
                console.log(`[System] Found bot in folder: [${item}]. Forking process...`);

                // ทำการ Fork แยก Process ของบอทตัวนั้นๆ ออกไป
                const child = fork(botFilePath);

                console.log(`[${item}] 🟢 Started successfully | PID: ${child.pid}`);

                // รอรับส่งข้อมูล (IPC) จาก Child Process (บอท)
                child.on('message', (message) => {
                    if (message && message.type === 'BOT_ERROR') {
                        console.error(`[System] [💥 Crash Alert] Bot [${item}] reported a critical error!`);
                        // ทำการบันทึก Log ลงไฟล์
                        saveErrorLog(item, child.pid, message.data);
                    }
                });

                // ตรวจจับเมื่อ Child Process จบการทำงาน
                child.on('exit', (code, signal) => {
                    if (code === 0) {
                        console.log(`[${item}] ⚪ Process exited cleanly (Code: ${code})`);
                    } else {
                        console.error(`[${item}] 🛑 Process terminated abnormally (Code: ${code} | Signal: ${signal || 'NONE'})`);
                    }
                });
            }
        }
    });
}

// เริ่มต้นทำงานระบบ
bootstrapBots();
