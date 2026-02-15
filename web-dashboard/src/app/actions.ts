'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis'; // Ton client Upstash HTTP
import { Ratelimit } from '@upstash/ratelimit';
import { Queue } from 'bullmq'; // ✅ IMPORT CRUCIAL
import { z } from 'zod';
import IORedis from 'ioredis'; // ⚠️ Assure-toi d'avoir fait: npm install ioredis
import { revalidatePath } from 'next/cache';

// Regex pour valider l'URL GitHub
const GITHUB_URL_REGEX = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+)(?:\.git)?$/;

// Rate limiter: 1 scan toutes les 30 minutes
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(1, '30 m'),
  analytics: true,
  prefix: "@upstash/ratelimit",
});

// ✅ CORRECTION REDIS : Configuration identique au Worker
// On crée une connexion dédiée pour BullMQ avec les options SSL/IPv4
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null, // Obligatoire pour BullMQ
  family: 4, // Force IPv4 (fixe souvent les erreurs Upstash)
  tls: {
    rejectUnauthorized: false // Accepte le certificat Upstash
  }
});

// On passe cette connexion robuste à la Queue
const scanQueue = new Queue('scan-queue', { connection });

export async function submitScan(formData: FormData) {
  const { userId } = await auth(); // ✅ await est recommandé maintenant
  
  if (!userId) {
    throw new Error('You must be logged in to submit a scan.');
  }

  const repoUrl = formData.get('repoUrl') as string;

  const urlSchema = z.string().url().regex(GITHUB_URL_REGEX, {
    message: "Invalid GitHub repository URL",
  });

  const validation = urlSchema.safeParse(repoUrl);

  if (!validation.success) {
    // On renvoie un objet simple pour que le front puisse l'afficher sans crasher
    return { success: false, error: validation.error.errors[0].message };
  }

  // Rate Limiting (Actif uniquement en PRODUCTION)
  if (process.env.NODE_ENV !== 'development') {
    const { success: allowed } = await ratelimit.limit(userId);
    
    if (!allowed) {
      throw new Error('Rate limit exceeded. Please wait 30 minutes before your next scan.');
    }
  } else {
    console.log("⚡️ DEV MODE: Rate Limit ignoré pour faciliter les tests.");
  }

  try {
    // 1. Upsert user (au cas où il n'existe pas encore en DB)
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { 
        id: userId,
        email: "unknown@temp.com" // Placeholder car auth() ne donne pas l'email directement
      },
    });

    // 2. Création du Scan en base
    const scan = await prisma.scan.create({
      data: {
        userId,
        repoUrl: validation.data,
        status: 'PENDING',
      },
    });

    // 3. ✅ ENVOI CORRECT AU WORKER
    // Le nom 'scan-job' et les données doivent correspondre exactement à ce que le worker attend
    await scanQueue.add('scan-job', { 
      url: validation.data, 
      dbId: scan.id 
    });

    revalidatePath('/'); // Rafraîchit la page pour afficher le nouveau scan immédiatement

    return { success: true, scanId: scan.id };

  } catch (error: any) {
    console.error("Error submitting scan:", error);
    throw new Error(error.message || "Internal Server Error");
  }
}

export async function getUserScans() {
  const { userId } = await auth();
  if (!userId) return [];

  return await prisma.scan.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getScanDetails(scanId: string) {
  const { userId } = await auth();
  if (!userId) return null;

  return await prisma.scan.findFirst({
    where: { 
      id: scanId,
      userId // Sécurité : on s'assure que le scan appartient bien au user
    }
  });
}