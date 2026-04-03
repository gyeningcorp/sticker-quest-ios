require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const appleSignin = require('apple-signin-auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

app.use(cors());
app.use(express.json());

// Auth middleware
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Apple Sign In
app.post('/api/auth/apple', async (req, res) => {
  try {
    const { identityToken, appleId, name, email } = req.body;

    if (!identityToken || !appleId) {
      return res.status(400).json({ error: 'identityToken and appleId are required' });
    }

    // Verify Apple identity token
    const claims = await appleSignin.verifyIdToken(identityToken, {
      audience: 'com.gyeningcorp.stickerquest',
      ignoreExpiration: false,
    });

    // Create or find user
    const user = await prisma.user.upsert({
      where: { appleId },
      update: {
        ...(name && { name }),
        ...(email && { email }),
      },
      create: {
        appleId,
        name: name || null,
        email: email || null,
      },
    });

    const token = jwt.sign({ userId: user.id, appleId: user.appleId }, JWT_SECRET, {
      expiresIn: '90d',
    });

    res.json({ token, userId: user.id });
  } catch (error) {
    console.error('Apple auth error:', error.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Get progress
app.get('/api/progress/:userId', authenticate, async (req, res) => {
  try {
    const progress = await prisma.progress.findUnique({
      where: { userId: req.params.userId },
    });
    if (!progress) {
      return res.json({ points: 0, level: 1, completedTasks: [], unlockedStickers: [], streak: 0 });
    }
    res.json(progress);
  } catch (error) {
    console.error('Get progress error:', error.message);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Upsert progress
app.post('/api/progress/:userId', authenticate, async (req, res) => {
  try {
    const { points, level, completedTasks, unlockedStickers, streak } = req.body;
    const progress = await prisma.progress.upsert({
      where: { userId: req.params.userId },
      update: {
        ...(points !== undefined && { points }),
        ...(level !== undefined && { level }),
        ...(completedTasks !== undefined && { completedTasks }),
        ...(unlockedStickers !== undefined && { unlockedStickers }),
        ...(streak !== undefined && { streak }),
        lastActiveAt: new Date(),
      },
      create: {
        userId: req.params.userId,
        points: points || 0,
        level: level || 1,
        completedTasks: completedTasks || [],
        unlockedStickers: unlockedStickers || [],
        streak: streak || 0,
        lastActiveAt: new Date(),
      },
    });
    res.json(progress);
  } catch (error) {
    console.error('Upsert progress error:', error.message);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

app.listen(PORT, () => {
  console.log(`Sticker Quest API running on port ${PORT}`);
});
