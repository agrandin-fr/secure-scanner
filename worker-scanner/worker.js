require('dotenv').config();
const { Worker } = require('bullmq');
const { exec } = require('child_process');
const util = require('util');
const IORedis = require('ioredis');
const axios = require('axios'); // ✅ NOUVEAU : Pour parler à l'API Sonar

// --- IMPORTS BASE DE DONNÉES ---
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const execPromise = util.promisify(exec);

// 1. Connexion PostgreSQL (Neon - Cloud)
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 2. Connexion Redis (Upstash - Cloud)
const redisConnection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  family: 4,
  tls: { rejectUnauthorized: false },
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// 3. Config SonarQube
// Attention : 'host.docker.internal' est pour le conteneur Docker.
// Pour le script Node (qui tourne sur ton Mac), on utilise localhost.
const SONAR_HOST_DOCKER = process.env.SONAR_HOST || 'http://host.docker.internal:9000';
const SONAR_API_URL = 'http://localhost:9000'; // URL pour que le worker interroge l'API
const SONAR_TOKEN = process.env.SONAR_TOKEN;

/**
 * Fonction pour attendre que SonarQube finisse le traitement (Background Task)
 */
async function waitForProcessing(projectKey) {
    console.log(`⏳ [DB: ${projectKey}] Attente du traitement SonarQube...`);
    for (let i = 0; i < 10; i++) { // Essaye pendant 20 secondes max
        try {
            const res = await axios.get(`${SONAR_API_URL}/api/ce/component`, {
                params: { component: projectKey },
                auth: { username: SONAR_TOKEN, password: '' }
            });
            // Si la queue est vide ou la tâche est SUCCESS, on continue
            if (res.data.queue.length === 0 || res.data.current?.status === 'SUCCESS') {
                return true;
            }
        } catch (e) {
            // Ignorer les erreurs temporaires
        }
        await new Promise(r => setTimeout(r, 2000)); // Pause de 2s
    }
    return false;
}

/**
 * Récupère les résultats depuis l'API SonarQube
 */
async function getScanResults(projectKey) {
    // 1. Récupérer les métriques (Note de sécurité, nombre de failles)
    const measuresRes = await axios.get(`${SONAR_API_URL}/api/measures/component`, {
        params: {
            component: projectKey,
            metricKeys: 'security_rating,vulnerabilities,bugs,code_smells'
        },
        auth: { username: SONAR_TOKEN, password: '' }
    });

    // 2. Récupérer la liste détaillée des problèmes (Issues) pour le rapport JSON
    const issuesRes = await axios.get(`${SONAR_API_URL}/api/issues/search`, {
        params: {
            componentKeys: projectKey,
            types: 'VULNERABILITY,BUG,CODE_SMELL',
            ps: 100 // On récupère les 100 premiers
        },
        auth: { username: SONAR_TOKEN, password: '' }
    });

    const measures = {};
    measuresRes.data.component.measures.forEach(m => {
        measures[m.metric] = m.value;
    });

    // Mapping pour le frontend
    const issues = issuesRes.data.issues.map(issue => ({
        key: issue.key,
        title: issue.message,
        description: `Severité: ${issue.severity} - Fichier: ${issue.component}`,
        severity: issue.severity,
        type: issue.type
    }));

    return { measures, issues };
}

/**
 * Calcule un score sur 100 basé sur la note de sécurité Sonar
 * 1.0 = A (100%), 2.0 = B (80%), etc.
 */
function calculateScore(securityRating) {
    const rating = parseFloat(securityRating || '5.0'); 
    // Formule : 1.0 -> 100, 2.0 -> 80, 3.0 -> 60, 4.0 -> 40, 5.0 -> 20
    let score = 100 - ((rating - 1) * 20);
    return Math.max(0, Math.floor(score));
}

async function runSecureScan(gitUrl, dbId) {
    const projectKey = `scan_${dbId}`;

    await prisma.scan.update({
        where: { id: dbId },
        data: { status: 'PROCESSING' }
    });
    
    // On lance le scanner
    const dockerCommand = `
        docker run --rm \
        --platform linux/amd64 \
        --name scanner_${dbId} \
        --cpus="1.0" \
        --memory="1g" \
        --add-host=host.docker.internal:host-gateway \
        -e SONAR_HOST_URL="${SONAR_HOST_DOCKER}" \
        -e SONAR_TOKEN="${SONAR_TOKEN}" \
        my-secure-scanner \
        /bin/sh -c "git clone --depth 1 ${gitUrl} code_source && cd code_source && sonar-scanner -Dsonar.projectKey=${projectKey} -Dsonar.sources=."
    `;

    try {
        console.log(`🚀 [DB: ${dbId}] Lancement Docker...`);
        await execPromise(dockerCommand, { timeout: 900000 });
        
        // --- ÉTAPE CRUCIALE : Attendre et Récupérer les données ---
        
        // 1. Attendre que SonarQube digère le rapport envoyé par Docker
        await waitForProcessing(projectKey);

        // 2. Aller chercher les infos via l'API
        console.log(`📊 [DB: ${dbId}] Récupération des métriques...`);
        const { measures, issues } = await getScanResults(projectKey);

        // 3. Calcul du score
        const finalScore = calculateScore(measures.security_rating);

        // 4. Construction du rapport JSON complet
        const fullReport = {
            summary: measures,
            issues: issues, // C'est ce tableau que ton composant "ScanPage" va lire
            scannedAt: new Date().toISOString()
        };

        const dashboardUrl = `http://localhost:9000/dashboard?id=${projectKey}`;
        
        // 5. Update FINAL en base avec le SCORE et le RAPPORT JSON
        await prisma.scan.update({
            where: { id: dbId },
            data: { 
                status: 'COMPLETED',
                resultUrl: dashboardUrl,
                score: finalScore,        // ✅ On sauvegarde le score
                owaspReport: fullReport,  // ✅ On sauvegarde le JSON complet
                finishedAt: new Date()
            }
        });

        console.log(`✅ [DB: ${dbId}] Scan terminé. Score: ${finalScore}/100`);
        return { success: true, dashboardUrl, score: finalScore };

    } catch (error) {
        console.error(`❌ [DB: ${dbId}] Erreur : ${error.message}`);
        
        await prisma.scan.update({
            where: { id: dbId },
            data: { 
                status: 'FAILED',
                finishedAt: new Date()
            }
        });
        
        throw error;
    }
}

console.log("🎧 Worker connecté à Neon (DB) et Upstash (Redis)... En attente de jobs.");

const worker = new Worker('scan-queue', async job => {
    const { url, dbId } = job.data;
    console.log(`📥 Job reçu pour DB ID: ${dbId}`);
    return await runSecureScan(url, dbId);
}, { 
    connection: redisConnection 
});