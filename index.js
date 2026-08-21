const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const moment = require('moment')

const app = express();
const PORT = 3000;

app.use(cors())
// Middleware to parse incoming JSON request bodies
app.use(express.json());

const { MongoClient,ObjectId } = require("mongodb");       // mongoDB!
// const urlMongo = "mongodb://production:production@localhost:27017";
const urlMongo = "mongodb+srv://patoobentech_db_user:2CDeCAMSCwwAoQC3@cluster0.gmy33hk.mongodb.net"
// const urlMongo = "mongodb+srv://patoobentech_db_user:2CDeCAMSCwwAoQC3@cluster0.gmy33hk.mongodb.net/dbname?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true"

app.get('/api/coustomer/:euiKey', async (req, res) => {
    // const userId = parseInt(req.params.id);
    const euiKey = req.params.euiKey
    // const userKey = req.params.key
    console.log(`GET coustomer, euiKey:${euiKey}`)
    let result = null
    const client = new MongoClient(urlMongo);

    try {
        // await client.connect();
        const query = {  CUSTOMER_KEY: euiKey , "CURRENTY_FLAG": true }
        result = await client.db('OMRON_SERVER_REGISTER').collection('CUSTOMER').findOne(query)
        // await client.close();      // mongoDB!  
        // console.log(result)
    } 
    catch (error) {
        console.log(error)
        return res.status(404).json({ message: "Can't connect database..." })
    }
    finally {
        await client.close()
    } 

    if (result == null) {
        return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(result);
})

// --- 4. UPDATE (PUT) ---
// Purpose: Modify an existing user completely
app.put('/api/coustomer/:euiKey', async (req, res) => {
    const euiKey = req.params.euiKey
    console.log(`PUT coustomer, euiKey:${euiKey}`)

    const client = new MongoClient(urlMongo)
    await client.connect();
    const query = {  CUSTOMER_KEY: euiKey , "CURRENTY_FLAG": true }
    const result01 = await client.db('OMRON_SERVER_REGISTER').collection('CUSTOMER').findOne(query)
    await client.close();      // mongoDB!  
    console.log(result01)

    if (result01 == null) {
        return res.status(404).json({ message: "User not found" });
    }

    const { keyMachine, numMachine } = req.body
    const numMachineInt = parseInt(numMachine);
    console.log(`keyMachine:${keyMachine}, numMachine:${numMachineInt}`)

    if (!keyMachine || !numMachine) {
        return res.status(400).json({ message: "Data are required" });
    }
    if(result01.USED_MACHINE >= result01.TOTAL_MACHINE) {
        return res.status(404).json({ message: "This license is full register." });
    }
    else if((result01.USED_MACHINE + numMachineInt) > result01.TOTAL_MACHINE) {
        return res.status(404).json({ message: "Number machine is to much." });
    }


    const jsonString = Buffer.from(keyMachine, 'base64').toString('utf8'); 
    console.log(jsonString)
    const obj = JSON.parse(jsonString)
    // console.log(obj) // ผลลัพธ์: Node.js

    let macAddress = ''
    for (const [key, value] of Object.entries(obj)) { 
        console.log(`${key}: ${value}`);
        macAddress = value
    }
    console.log(`macAddress: ${macAddress}`)
    console.log(`numMachine: ${numMachine}`)

    const message = `${macAddress}||${numMachine}`

    // หมายเหตุ: key ต้องยาว 32 bytes สำหรับ aes-256
    const MY_SECRET_KEY = crypto.randomBytes(32); 

    // 1. เข้ารหัสเป็น String เดียว
    const secureString = encrypt(message, MY_SECRET_KEY);
    // console.log("Encrypted String:", secureString); 
    // console.log("MY_SECRET_KEY:", MY_SECRET_KEY)

    const MY_SECRET_KEY_base64  = MY_SECRET_KEY.toString('base64'); 

    console.log("KEY1:", secureString); 
    console.log("KEY2:", MY_SECRET_KEY_base64)

    try {
        await client.connect()

        const filter = { _id: result01._id }
        const newUSED_MACHINE = result01.USED_MACHINE + numMachineInt
        const updateDoc = {
            $push: {  HISTORY: { 
                NUM_MACHINE: numMachineInt,
                KEY_MACHINE: keyMachine,
                KEY1: secureString, 
                KEY2: MY_SECRET_KEY_base64,
                TIMESTAMP: moment().format('YYYY-MM-DDTHH:mm:ss.SSS') } 
            },
            $set: {   USED_MACHINE: newUSED_MACHINE }
        };

        // The new object you want to add to the array
        const newSkill = { name: "Node.js", level: "Expert" }

        // Update the document
        const result02 = await client.db('OMRON_SERVER_REGISTER').collection('CUSTOMER').updateOne(filter, updateDoc)

        console.log(`${result02.modifiedCount} document(s) updated.`)
    } finally {
        await client.close()
    }

    res.status(200).json({ message: 'SUCCESS'});
})

app.get('/', (req, res) => {
    res.send('This is API running...')
})

// Start the server
app.listen(PORT, () => {
    console.log(`Server running smoothly on http://localhost:${PORT}`);
})

function encrypt(text, secretKey) {
    const iv = crypto.randomBytes(16); // สร้าง IV แบบสุ่มทุกครั้ง
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secretKey), iv);

    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // ดึง authTag (สำคัญมากสำหรับโหมด GCM เพื่อตรวจสอบความถูกต้องของข้อมูล)
    const authTag = cipher.getAuthTag().toString('base64');

    // รวม IV, AuthTag และ Encrypted Data เข้าด้วยกันเป็น Base64
    return `${iv.toString('base64')}:${authTag}:${encrypted.toString('base64')}`;
}


