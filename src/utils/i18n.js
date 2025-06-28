// src/utils/i18n.js
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix the path - go up to project root, then into locales
const localesPath = path.join(__dirname, '../../locales');

console.log('🌍 i18n: Locales path:', localesPath);

// Initialize i18next synchronously
i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
        // Keep debug off for now to reduce noise
        debug: false,

        // Default language
        fallbackLng: 'en',

        // Available languages
        supportedLngs: ['en', 'ar'],

        // Namespace configuration
        defaultNS: 'translation',
        ns: ['translation'],

        // Backend configuration
        backend: {
            // Path to translation files
            loadPath: path.join(localesPath, '{{lng}}/{{ns}}.json'),
        },

        // Language detection options
        detection: {
            // Order of language detection methods
            order: ['header', 'querystring', 'cookie'],

            // Keys for detection
            lookupQuerystring: 'lng',
            lookupCookie: 'i18next',
            lookupHeader: 'accept-language',

            // Cache language
            caches: ['cookie'],

            // Cookie options
            cookieOptions: {
                maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
                httpOnly: false,
                sameSite: 'lax'
            }
        },

        // Interpolation options
        interpolation: {
            escapeValue: false, // Not needed for server-side
        },

        // Don't load missing translations in production
        saveMissing: false,

        // Return key if translation missing
        returnEmptyString: false,
        returnNull: false,

        // Preload languages
        preload: ['en', 'ar']
    });

// Simple check if i18next is ready
console.log('🌍 i18next initialized, current language:', i18next.language || 'not set');

// Helper function to get translated message with fallback
export const getMessage = (key, options = {}, lng = 'en') => {
    try {
        // Check if i18next is properly initialized
        if (!i18next.t) {
            console.warn('🌍 i18next not properly initialized, using fallback');
            return key;
        }

        const translation = i18next.t(key, { ...options, lng });

        // If translation is the same as key, it means translation was not found
        if (translation === key) {
            console.warn(`🌍 Translation missing for key: ${key} (${lng})`);
            return getFallbackMessage(key);
        }

        return translation;
    } catch (error) {
        console.error(`🌍 Translation error for key "${key}":`, error);
        return getFallbackMessage(key) || key;
    }
};

// Fallback messages in case translation files are missing
const getFallbackMessage = (key) => {
    const fallbacks = {
        'auth.email_required': 'Email and roleName are required.',
        'auth.email_exists': 'Email already exists. Please log in.',
        'auth.user_registered': 'User registered successfully!',
        'auth.login_successful': 'Login successful!',
        'auth.invalid_credentials': 'Invalid email or password.',
        'auth.account_not_active': 'Account is not active. Contact admin.',
        'auth.email_password_required': 'Email and password are required.',
        'errors.internal_server_error': 'Internal server error',
        'errors.bad_request': 'Bad request',
        'errors.not_found': 'Resource not found',
        'errors.unauthorized': 'Unauthorized access',
        'errors.forbidden': 'Access forbidden',
        'common.success': 'Success',
        'common.failed': 'Failed',
        'common.welcome': 'Welcome to Warehouse Management System',
        'common.server_running': 'Server is running properly',
        'common.page_not_found': 'Page not found'
    };

    return fallbacks[key];
};

// Helper function to format response with translated message
export const formatResponse = (req, messageKey, data = null, variables = {}) => {
    const language = req.language || req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    const response = {
        message: getMessage(messageKey, variables, language),
        language: language
    };

    if (data !== null) {
        response.data = data;
    }

    return response;
};

// Helper function to format error response
export const formatErrorResponse = (req, messageKey, statusCode = 500, variables = {}) => {
    const language = req.language || req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    return {
        error: true,
        message: getMessage(messageKey, variables, language),
        statusCode,
        language: language
    };
};

// Middleware to attach language to request
export const languageMiddleware = (req, res, next) => {
    // Detect language from various sources
    let language = req.query.lng ||
        req.cookies?.i18next ||
        req.headers['accept-language']?.split(',')[0]?.split('-')[0] ||
        'en';

    // Validate language is supported
    if (!['en', 'ar'].includes(language)) {
        language = 'en';
    }

    // Attach to request object
    req.language = language;

    // Set response header for client
    res.setHeader('Content-Language', language);

    next();
};

export default i18next;