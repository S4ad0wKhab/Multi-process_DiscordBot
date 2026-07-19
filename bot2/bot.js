// ดึงไลบรารี discord.js (ตัวอย่างนี้อ้างอิงตามมาตรฐาน discord.js v14)
// ในการใช้งานจริง ให้พิมพ์ npm i discord.js ใน Termux ก่อนรัน
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');

// ดึงชื่อโฟลเดอร์ปัจจุบันมาใช้เป็นชื่อบอท เพื่อความง่ายในการระบุตัวตน
const botName = path.basename(__dirname);

/**
 * ฟังก์ชันส่ง Error กลับไปยัง main.js (IPC) แล้วจบ Process
 */
function handleCriticalError(error) {
    console.error(`[${botName}] Internal Error triggered. Sending to Master Process...`);

    // ตรวจสอบว่ามีช่องทาง IPC เชื่อมต่อกับ main.js หรือไม่
    if (process.send) {
        process.send({
            type: 'BOT_ERROR',
            data: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }

    // สั่งปิด Process ตัวเองทันที (Exit Code 1 เพื่อบอกว่าจบการทำงานแบบมี Error)
    // การปิดตรงนี้จะไม่ส่งผลกระทบต่อ main.js และบอทตัวอื่นๆ
    process.exit(1);
}

// 🛑 ลงทะเบียนระบบดักจับ Error ระดับ Global ของ Node.js
process.on('uncaughtException', (err) => {
    handleCriticalError(err);
});

process.on('unhandledRejection', (reason, promise) => {
    // แปลง Reason ให้เป็น Object Error หากมันส่งมาเป็นข้อความธรรมดา
    const err = reason instanceof Error ? reason : new Error(String(reason));
    handleCriticalError(err);
});

// ====================================================================
//  [ ส่วนเริ่มต้นโค้ดดิสคอร์ดบอทของคุณ ]
// ====================================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`[${botName}] Logged in as ${client.user.tag}`);
});

// ตัวอย่างคำสั่งทดสอบระบบ Error (พิมพ์ !crash ในดิสคอร์ดเพื่อทดสอบระบบดักจับ)
client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content === '!crash') {
        message.reply('💥 กำลังจำลอง Error แบบ uncaughtException...');
        // จงใจเรียกฟังก์ชันที่ไม่มีอยู่จริงเพื่อให้เกิดข้อผิดพลาด
        nonExistentFunction(); 
    }
});

// วาง Token ของบอทตัวนั้นๆ ที่นี่
// แนะนำให้บอทแต่ละโฟลเดอร์ใช้ Token แยกกัน
const TOKEN = 'ใส่_TOKEN_ของบอทตัวนี้ที่นี่'; 

if (TOKEN === 'ใส่_TOKEN_ของบอทตัวนี้ที่นี่') {
    console.log(`[${botName}] ⚠️  โปรดระบุ Discord Bot Token ในไฟล์ bot.js ของคุณ`);
} else {
    client.login(TOKEN).catch(err => {
        // ดักจับกรณี Token ไม่ถูกต้องหรือเชื่อมต่อไม่ได้
        handleCriticalError(err);
    });
}
