require('dotenv').config();
const { Queue } = require('bullmq');

// --- LA PARTIE CONNEXION (IDENTIQUE AU WORKER) ---
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connection = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});
const adapter = new PrismaPg(connection);
const prisma = new PrismaClient({ adapter });
// -------------------------------------------------

const redisConnection = { host: '127.0.0.1', port: 6379 };
const myQueue = new Queue('scan-queue', { connection: redisConnection });

async function createScanRequest(url) {
    console.log("📝 1. Création de l'entrée en base de données (PENDING)...");
    
    try {
        const newScan = await prisma.scan.create({
            data: {
                repoUrl: url,
                status: 'PENDING'
            }
        });

        console.log(`🆔 ID généré : ${newScan.id}`);
        console.log("📨 2. Envoi à la queue Redis...");

        await myQueue.add('scan-job', { 
            url: url,
            dbId: newScan.id 
        });
        
        console.log("👋 Terminé. Regarde ton terminal 'Worker' !");
    } catch (e) {
        console.error("Erreur:", e);
    } finally {
        // Important : fermer la connexion pour que le script s'arrête proprement
        await prisma.$disconnect();
        process.exit(0);
    }
}

// Lancement
createScanRequest('https://github.com/agrandin-fr/juice-shop.git');
createScanRequest('https://github.com/tg-bomze/Face-Depixelizer');
createScanRequest('https://github.com/notwaldorf/emoji-translate');
