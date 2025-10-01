import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  confidence?: number;
}

export interface TranslationEngine {
  name: string;
  translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult>;
}

class GoogleTranslateEngine implements TranslationEngine {
  name = 'google';
  
  async translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    try {
      const apiKey = config.translation.google.apiKey;
      if (!apiKey) {
        throw new Error('Google Translate API key not configured');
      }

      const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
      
      const payload = {
        q: text,
        target: targetLang,
        ...(sourceLang && sourceLang !== 'auto' && { source: sourceLang }),
        format: 'text'
      };

      const response = await axios.post(url, payload);
      
      if (response.data.error) {
        throw new Error(`Google Translate API error: ${response.data.error.message}`);
      }

      const translation = response.data.data.translations[0];
      
      return {
        translatedText: translation.translatedText,
        detectedLanguage: translation.detectedSourceLanguage,
        confidence: 0.9 // Google doesn't provide confidence scores
      };
    } catch (error) {
      logger.error('Google Translate error:', error);
      throw error;
    }
  }
}

class DeepLEngine implements TranslationEngine {
  name = 'deepl';
  
  async translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    // DeepL implementation would go here
    // For now, return a placeholder
    throw new Error('DeepL integration not implemented yet');
  }
}

class LibreTranslateEngine implements TranslationEngine {
  name = 'libre';
  
  async translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    try {
      // Using a public LibreTranslate instance
      const url = 'https://libretranslate.de/translate';
      
      const payload = {
        q: text,
        source: sourceLang === 'auto' ? 'auto' : sourceLang || 'auto',
        target: targetLang,
        format: 'text'
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        translatedText: response.data.translatedText,
        detectedLanguage: response.data.detectedLanguage?.language,
        confidence: response.data.detectedLanguage?.confidence || 0.8
      };
    } catch (error) {
      logger.error('LibreTranslate error:', error);
      throw error;
    }
  }
}

// Translation service class
export class TranslationService {
  private engines: Map<string, TranslationEngine> = new Map();
  private defaultEngine: string;

  constructor() {
    // Register available translation engines
    this.engines.set('google', new GoogleTranslateEngine());
    this.engines.set('deepl', new DeepLEngine());
    this.engines.set('libre', new LibreTranslateEngine());
    
    this.defaultEngine = config.translation.defaultEngine;
  }

  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    engineName?: string
  ): Promise<TranslationResult> {
    const engine = this.engines.get(engineName || this.defaultEngine);
    
    if (!engine) {
      throw new Error(`Translation engine '${engineName || this.defaultEngine}' not found`);
    }

    // Skip translation if source and target are the same
    if (sourceLanguage && sourceLanguage === targetLanguage) {
      return {
        translatedText: text,
        detectedLanguage: sourceLanguage,
        confidence: 1.0
      };
    }

    try {
      const result = await engine.translate(text, targetLanguage, sourceLanguage);
      
      logger.info(`Translation completed using ${engine.name}`, {
        textLength: text.length,
        targetLanguage,
        sourceLanguage: sourceLanguage || 'auto',
        detectedLanguage: result.detectedLanguage,
        confidence: result.confidence
      });
      
      return result;
    } catch (error) {
      logger.error(`Translation failed using ${engine.name}:`, error);
      
      // Fallback to another engine if available
      if (engineName !== 'libre' && this.engines.has('libre')) {
        logger.info('Falling back to LibreTranslate');
        return this.translateText(text, targetLanguage, sourceLanguage, 'libre');
      }
      
      throw error;
    }
  }

  getAvailableEngines(): string[] {
    return Array.from(this.engines.keys());
  }
}

// Export singleton instance
export const translationService = new TranslationService();