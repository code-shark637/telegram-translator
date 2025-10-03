import express from 'express';
import { translationService } from '../services/translationService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Translate text
router.post('/translate', async (req: AuthenticatedRequest, res) => {
  const { text, targetLanguage, sourceLanguage, engine } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({ 
      error: 'Text and target language are required' 
    });
  }

  try {
    const result = await translationService.translateText(
      text,
      targetLanguage,
      sourceLanguage,
      engine
    );

    logger.info(`Translation request from user ${req.userId}`, {
      textLength: text.length,
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage,
      engine: engine || 'default',
      detectedLanguage: result.detectedLanguage
    });

    res.json(result);
  } catch (error) {
    logger.error('Translation error:', error);
    res.status(500).json({ 
      error: 'Translation failed',
      details: (error as Error).message
    });
  }
});

// Get available translation engines
router.get('/engines', (req: AuthenticatedRequest, res) => {
  const engines = translationService.getAvailableEngines();
  res.json({ engines });
});

// Get supported languages (mock data for now)
router.get('/languages', (req: AuthenticatedRequest, res) => {
  const languages = [
    { code: 'auto', name: 'Auto-detect', isSource: true, isTarget: false },
    { code: 'en', name: 'English', isSource: true, isTarget: true },
    { code: 'es', name: 'Spanish', isSource: true, isTarget: true },
    { code: 'fr', name: 'French', isSource: true, isTarget: true },
    { code: 'de', name: 'German', isSource: true, isTarget: true },
    { code: 'it', name: 'Italian', isSource: true, isTarget: true },
    { code: 'pt', name: 'Portuguese', isSource: true, isTarget: true },
    { code: 'ru', name: 'Russian', isSource: true, isTarget: true },
    { code: 'ja', name: 'Japanese', isSource: true, isTarget: true },
    { code: 'ko', name: 'Korean', isSource: true, isTarget: true },
    { code: 'zh', name: 'Chinese (Simplified)', isSource: true, isTarget: true },
    { code: 'ar', name: 'Arabic', isSource: true, isTarget: true },
    { code: 'hi', name: 'Hindi', isSource: true, isTarget: true },
    { code: 'tr', name: 'Turkish', isSource: true, isTarget: true },
    { code: 'pl', name: 'Polish', isSource: true, isTarget: true },
    { code: 'nl', name: 'Dutch', isSource: true, isTarget: true },
    { code: 'sv', name: 'Swedish', isSource: true, isTarget: true },
    { code: 'da', name: 'Danish', isSource: true, isTarget: true },
    { code: 'no', name: 'Norwegian', isSource: true, isTarget: true },
    { code: 'fi', name: 'Finnish', isSource: true, isTarget: true }
  ];

  res.json({ languages });
});

export default router;