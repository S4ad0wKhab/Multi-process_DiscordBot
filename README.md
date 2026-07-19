# Multi-process_DiscordBot
นี่คือระบบจัดการ Discord Bot แบบ Multi-Process ด้วย Node.js ที่ออกแบบมาเพื่อทำงานบน Termux ได้อย่างเสถียร ไม่กินทรัพยากรเครื่อง และจัดการแยก Process ของบอทแต่ละตัวอย่างเด็ดขาดด้วยระบบ IPC (Inter-Process Communication)
# ​📁 โครงสร้างโปรเจกต์ (Project Structure)
```
project/
├── main.js
├── error/                  # โฟลเดอร์เก็บ Log (ระบบจะสร้างให้อัตโนมัติ)
├── bot1/
│   └── bot.js              # โค้ดบอทตัวที่ 1
├── bot2/
│   └── bot.js              # โค้ดบอทตัวที่ 2
└── bot3/
    └── bot.js              # โค้ดบอทตัวที่ 3
```
# 💻 โค้ดระบบจัดการบอท
## main.js (Process หลักสำหรับควบคุมและสแกนบอท)
```
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

```
### bot.js (ไฟล์ตัวอย่างสำหรับนำไปใส่ในโฟลเดอร์บอทต่างๆ เช่น bot1/bot.js)
```
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

```
# ⚙️ หลักการทำงานของระบบ
1​.)Auto-Scanning (สแกนอัตโนมัติ): เมื่อเราสั่งรัน node main.js ตัวระบบหลักจะใช้คำสั่งจากโมดูล fs เพื่อเช็กโฟลเดอร์ทั้งหมดรอบๆ ตัวมัน หากเจอโฟลเดอร์ใดก็ตามที่มีไฟล์ชื่อ bot.js มันจะถือว่าโฟลเดอร์นั้นเป็นบอท 1 ตัวทันที

2.)​Multi-Processing (child_process.fork()): ระบบทำการคัดลอก Node.js Runtime ออกไปเป็น Process ใหม่ของไคลเอนต์นั้นๆ โดยเฉพาะ ทำให้บอทแต่ละตัวทำงานแยกจากกันบน CPU Core และ Memory คนละส่วนกันอย่างสิ้นเชิง

3.)​Inter-Process Communication (IPC): ตัว main.js (Master) และ bot.js (Child) จะเปิดท่อส่งข้อมูลหากันผ่านแชนเนลพิเศษ เมื่อบอทเกิด Error ระดับระบบ พลวัตโครงสร้างของโค้ดในบอทจะส่ง Object ข้อผิดพลาดนั้นผ่านคำสั่ง process.send() กลับมาที่ศูนย์กลางทันที

​4.)Crash Isolation (แยกความเสียหาย): หลังจากบอทส่งข้อความเสร็จ มันจะสั่ง process.exit(1) เพื่อดับตัวเองทันที ทำให้ Error ไม่ไหลลามขึ้นไปกระทบระบบจัดการหลัก บอทตัวอื่นๆ จึงคงสถานะออนไลน์และทำงานต่อไปได้อย่างปกติ
# ​➕ วิธีการเพิ่มบอทใหม่ในอนาคต
คุณสามารถเพิ่มบอทตัวที่ 4, 5, 6 ได้ง่ายๆ โดยไม่ต้องหยุดการทำงานของตัวจัดการหลัก (หากไม่ต้องการ) และไม่ต้องแก้ไขโค้ด main.js เลยแม้แต่บรรทัดเดียว:

1.)​สร้างโฟลเดอร์ใหม่ในโปรเจกต์ เช่นตั้งชื่อว่า my-new-bot

2.)​คัดลอกไฟล์ bot.js ตัวอย่างด้านบนไปวางไว้ในโฟลเดอร์ใหม่นั้น

3.)​เปิดไฟล์แก้ไขส่วน const TOKEN = '...' ให้เป็นโทเคนของบอทตัวใหม่

4.)​หาก main.js ทำงานอยู่ก่อนแล้ว ให้กดปิดแล้วเปิดใหม่ด้วยคำสั่ง node main.js ตัวระบบจัดการจะตรวจเจอโฟลเดอร์ my-new-bot และดึงขึ้นมาทำงานให้โดยอัตโนมัติทันทีครับ
