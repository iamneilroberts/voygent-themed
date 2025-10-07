/**
 * PII Sanitizer Module
 * Feature: 006-add-full-logging
 *
 * Provides utilities to sanitize Personally Identifiable Information (PII)
 * before logging, including email masking, surname masking, and genealogy
 * data redaction.
 */

export class PIISanitizer {
  private static emailRegex = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;

  /**
   * Sanitize a string (mask emails, etc)
   */
  static sanitize(text: string): string {
    if (!text) return text;

    // Mask emails: john.doe@example.com → j***@***.com
    text = text.replace(this.emailRegex, (match, local, domain) => {
      const tld = domain.split('.').pop();
      return `${local[0]}***@***.${tld}`;
    });

    return text;
  }

  /**
   * Sanitize an object (recursively sanitize all string fields)
   */
  static sanitizeObject(obj: any): any {
    if (!obj) return obj;
    if (typeof obj === 'string') return this.sanitize(obj);
    if (Array.isArray(obj)) return obj.map(item => this.sanitizeObject(item));
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = this.sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  }

  /**
   * Mask an email address
   */
  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    const tld = domain.split('.').pop();
    return `${local[0]}***@***.${tld}`;
  }

  /**
   * Mask a surname (keep first and last character)
   */
  static maskSurname(surname: string): string {
    if (!surname || surname.length < 2) return surname;
    if (surname.length === 2) return `${surname[0]}*`;
    return `${surname[0]}${'*'.repeat(surname.length - 2)}${surname[surname.length - 1]}`;
  }

  /**
   * Redact genealogy data (remove sensitive source information)
   */
  static redactGenealogy(data: any): any {
    if (!data) return data;

    // Clone the data to avoid mutating the original
    const redacted = JSON.parse(JSON.stringify(data));

    // Redact sensitive genealogy fields
    if (redacted.sources && Array.isArray(redacted.sources)) {
      redacted.sources = redacted.sources.map((source: any) => ({
        ...source,
        title: 'REDACTED',
        description: 'REDACTED',
        url: source.url // Keep URLs for debugging
      }));
    }

    return redacted;
  }
}

// Test cases for development
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.assert(
    PIISanitizer.maskEmail('john.doe@example.com') === 'j***@***.com',
    'Email masking failed'
  );
  console.assert(
    PIISanitizer.maskSurname('Smith') === 'S***h',
    'Surname masking failed'
  );
  console.assert(
    PIISanitizer.maskSurname('Lee') === 'L*e',
    'Short surname masking failed'
  );
}
