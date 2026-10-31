/**
 * Cryptographic Zero-Width Watermarking Engine
 * 
 * Embeds invisible cryptographic entropy into outbound message text to ensure
 * each message transmission produces a 100% unique byte hash (SHA-256 signature)
 * across carrier and WhatsApp E2EE delivery channels, completely preventing
 * template content fingerprinting while remaining 100% invisible to human recipients.
 */

const crypto = require('crypto');

// Zero-width Unicode code points
const ZW_CHARS = [
  '\u200B', // Zero-Width Space
  '\u200C', // Zero-Width Non-Joiner
  '\u200D', // Zero-Width Joiner
  '\uFEFF'  // Zero-Width No-Break Space
];

/**
 * Generates an invisible cryptographic signature string from recipient entropy
 * @param {string} recipientId Phone number or WhatsApp JID
 * @param {string} salt Optional additional salt
 * @returns {string} String composed purely of zero-width characters
 */
function generateZeroWidthSignature(recipientId = '', salt = '') {
  const entropy = `${recipientId}:${Date.now()}:${Math.random()}:${process.pid}:${salt}`;
  const hash = crypto.createHash('sha256').update(entropy).digest('hex').slice(0, 16);

  let zwSequence = '';
  for (let i = 0; i < hash.length; i++) {
    const nibble = parseInt(hash[i], 16) % 4;
    zwSequence += ZW_CHARS[nibble];
  }
  return zwSequence;
}

/**
 * Embeds invisible cryptographic watermark into message text.
 * Intersperses the signature seamlessly into natural punctuation or sentence breaks,
 * guaranteeing a 100% unique cryptographic hash for every outreach transmission.
 * 
 * @param {string} text Message text
 * @param {string} recipientId Recipient phone or JID
 * @returns {string} Watermarked message text
 */
function applyInvisibleWatermark(text, recipientId = '') {
  if (!text || typeof text !== 'string') return text;

  const signature = generateZeroWidthSignature(recipientId);
  const midMarker = signature.slice(0, 8);
  const endMarker = signature.slice(8);

  // Attempt natural placement at paragraph boundary or sentence boundary
  const newlinePos = text.indexOf('\n');
  if (newlinePos !== -1 && newlinePos < text.length - 1) {
    // Check if CRLF (\r\n) to avoid splitting \r and \n apart
    const insertPos = (newlinePos > 0 && text[newlinePos - 1] === '\r') ? newlinePos - 1 : newlinePos;
    return text.slice(0, insertPos) + midMarker + text.slice(insertPos) + endMarker;
  }

  // Check sentence boundaries: . , ! , ? , or Hindi purna viram (।)
  const sentenceBoundaryMatch = text.match(/([.!?\u0964])\s+/);
  if (sentenceBoundaryMatch && sentenceBoundaryMatch.index !== undefined) {
    const punctPos = sentenceBoundaryMatch.index + 1; // right after punctuation, before whitespace
    return text.slice(0, punctPos) + midMarker + text.slice(punctPos) + endMarker;
  }

  const spacePos = text.indexOf(' ', 15);
  if (spacePos !== -1) {
    return text.slice(0, spacePos) + midMarker + text.slice(spacePos) + endMarker;
  }

  return text + signature;
}

/**
 * Strips all zero-width characters for equality checks, logging, or diffing
 * @param {string} text 
 * @returns {string} Clean text
 */
function stripZeroWidth(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
}

/**
 * Computes SHA-256 byte hash of text for verification
 * @param {string} text 
 * @returns {string} Hex SHA-256 digest
 */
function getMessageHash(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

module.exports = {
  applyInvisibleWatermark,
  generateZeroWidthSignature,
  stripZeroWidth,
  getMessageHash,
  ZW_CHARS
};
