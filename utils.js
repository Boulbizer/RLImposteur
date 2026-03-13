// Utility functions for validation, sanitization, and random generation

/**
 * Validates if the input is a non-empty string.
 * @param {string} input - The input to validate.
 * @returns {boolean} - Returns true if valid, false otherwise.
 */
function validateNonEmptyString(input) {
    return typeof input === 'string' && input.trim() !== '';
}

/**
 * Sanitizes a string by removing potentially harmful characters.
 * @param {string} input - The input to sanitize.
 * @returns {string} - Returns the sanitized string.
 */
function sanitizeString(input) {
    return input.replace(/[<>]/g, ''); // Example: remove angle brackets.
}

/**
 * Generates a random integer between min and max, inclusive.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} - Returns a random integer.
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { validateNonEmptyString, sanitizeString, getRandomInt };