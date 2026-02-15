const { Queue } = require('bullmq');

const connection = { host: '127.0.0.1', port: 6379 };
const myQueue = new Queue('scan-queue', { connection });

async function addJob() {
    console.log("✉️ Envoi d'une demande de scan...");
    
    await myQueue.add('scan-job', { 
        url: 'https://github.com/agrandin-fr/juice-shop.git' 
        // https://github.com/tg-bomze/Face-Depixelizer
        // https://github.com/notwaldorf/emoji-translate
    });
    
    console.log("👋 Demande envoyée ! Tu peux fermer ce script.");
    process.exit(0);
}

addJob();