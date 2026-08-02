/**
 * Enhanced Helpdesk API Endpoint
 * Provides AI-powered technical support with full system context
 * Supports multi-lingual input/output with language detection
 */

import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

/**
 * System context builder
 * Gathers comprehensive information about the platform state
 */
function buildSystemContext(req: any, body: any) {
  return {
    // Platform information
    platform: {
      name: "Cinemax Streaming Platform",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    },
    
    // User context
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      preferences: req.user.preferences || {},
    } : {
      role: "guest",
      authenticated: false,
    },
    
    // Request context
    request: {
      url: body.currentUrl || req.headers.referer || "unknown",
      userAgent: body.userAgent || req.headers['user-agent'] || "unknown",
      detectedLanguage: body.detectedLanguage || "en",
      supportedLanguages: ['Kinyarwanda', 'English', 'French'],
    },
    
    // Platform capabilities
    capabilities: {
      features: [
        "Movie/TV show browsing and search",
        "User account management and authentication",
        "Settings configuration (autoplay, quality, subtitles)",
        "Playback troubleshooting and server switching",
        "Content recommendations and personalization",
        "Downloads management",
        "Watchlist and favorites",
        "Admin panel operations (content management, user management)",
      ],
      supportedActions: [
        "Search movies and TV shows",
        "Update user settings",
        "Troubleshoot playback issues",
        "Navigate to different sections",
        "Manage watchlist and favorites",
        "Provide content recommendations",
      ],
    },
    
    // Common issues and solutions
    knowledgeBase: {
      playback: {
        commonIssues: [
          "Video not loading",
          "Server connection timeout",
          "Audio out of sync",
          "Subtitle problems",
          "Quality switching issues",
        ],
        solutions: [
          "Try switching to a different server using the server toggle",
          "Check your internet connection",
          "Clear browser cache and cookies",
          "Disable ad blockers for this site",
          "Update your browser to the latest version",
        ],
      },
      account: {
        commonIssues: [
          "Login problems",
          "Password reset",
          "Profile update issues",
          "Settings not saving",
        ],
        solutions: [
          "Use the 'Forgot Password' link on login page",
          "Clear browser cookies and try again",
          "Check your email for verification links",
          "Contact support if issues persist",
        ],
      },
      technical: {
        commonIssues: [
          "Page not loading",
          "JavaScript errors",
          "API connection failures",
          "Mobile app issues",
        ],
        solutions: [
          "Refresh the page",
          "Check browser console for errors",
          "Verify internet connection",
          "Try a different browser",
          "Clear browser data",
        ],
      },
    },
    
    // Current page context (if provided)
    currentPage: body.currentPage ? {
      name: body.currentPage.name,
      component: body.currentPage.component,
      state: body.currentPage.state || {},
    } : null,
    
    // Error context (if provided)
    errorContext: body.error ? {
      message: body.error.message,
      stack: body.error.stack,
      type: body.error.type,
      timestamp: body.error.timestamp,
    } : null,
  };
}

/**
 * POST /api/helpdesk-voice
 * Main endpoint for voice helpdesk assistant
 * 
 * Request body:
 * {
 *   message: string (required)
 *   history: Array<{role: string, text: string}> (optional)
 *   context: object (optional - system context)
 *   language: string (optional - detected language)
 * }
 */
router.post('/helpdesk-voice', async (req, res) => {
  try {
    const { message, history = [], context: clientContext, language = 'en' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build comprehensive system context
    const systemContext = buildSystemContext(req, clientContext);

    // Build system prompt with context
    const systemPrompt = `You are a technical support assistant for the Cinemax Streaming Platform. Your role is to help users solve problems, debug errors, and navigate the platform.

PLATFORM CONTEXT:
${JSON.stringify(systemContext.platform, null, 2)}

USER CONTEXT:
${JSON.stringify(systemContext.user, null, 2)}

CAPABILITIES:
${systemContext.capabilities.features.map(f => `- ${f}`).join('\n')}

COMMON ISSUES AND SOLUTIONS:
Playback Issues:
${systemContext.knowledgeBase.playback.solutions.map(s => `- ${s}`).join('\n')}

Account Issues:
${systemContext.knowledgeBase.account.solutions.map(s => `- ${s}`).join('\n')}

Technical Issues:
${systemContext.knowledgeBase.technical.solutions.map(s => `- ${s}`).join('\n')}

INSTRUCTIONS:
1. Analyze the user's problem carefully
2. Provide step-by-step solutions when applicable
3. If the issue is technical, suggest debugging steps
4. If you need more information, ask specific questions
5. Always prioritize user experience and safety
6. For account-related actions, remind users to confirm changes
7. If the problem requires admin intervention, guide them to contact support
8. Respond in the same language as the user (Kinyarwanda, English, or French)
9. Keep responses concise but thorough
10. If you cannot solve the problem, escalate to human support

CURRENT LANGUAGE: ${language === 'rw' ? 'Kinyarwanda' : language === 'fr' ? 'French' : 'English'}`;

    // Import the routed assistant chat function
    const { routedAssistantChat } = require('../server');
    
    // Build messages array with system prompt
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg: any) => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.text
      })),
      { role: 'user', content: message }
    ];

    // Get AI response using existing routing system
    const { text, engine } = await routedAssistantChat(messages);

    // Return response with metadata
    res.json({
      text,
      engine,
      language,
      context: {
        detectedLanguage: language,
        platform: systemContext.platform.name,
        userRole: systemContext.user.role,
      },
    });

  } catch (error: any) {
    console.error('Helpdesk voice error:', error);
    
    // Check for specific error types
    if (error.message?.includes('API key')) {
      return res.status(503).json({ 
        error: 'AI service temporarily unavailable. Please try again later.' 
      });
    }
    
    if (error.message?.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Request timed out. Please try again.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to process your request. Please try again.' 
    });
  }
});

/**
 * POST /api/helpdesk/context
 * Endpoint to update system context dynamically
 * Useful for providing real-time page state or error information
 */
router.post('/helpdesk/context', async (req, res) => {
  try {
    const { currentPage, error, additionalContext } = req.body;
    
    // This could be stored in a session or database for context persistence
    // For now, we'll just acknowledge receipt
    
    res.json({
      success: true,
      message: 'Context updated successfully',
      received: {
        currentPage: currentPage ? 'provided' : 'not provided',
        error: error ? 'provided' : 'not provided',
        additionalContext: additionalContext ? 'provided' : 'not provided',
      },
    });

  } catch (error: any) {
    console.error('Context update error:', error);
    res.status(500).json({ error: 'Failed to update context' });
  }
});

export default router;
