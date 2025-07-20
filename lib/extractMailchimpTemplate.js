// lib/extractMailchimpTemplate.js

/**
 * Extracts the HTML template from a Mailchimp campaign and replaces the content
 * @param {string} htmlTemplate - The HTML template from a previous campaign
 * @param {string} newContent - The new content to insert
 * @returns {string} - The new HTML with the template styling and new content
 */
export function extractMailchimpTemplate(htmlTemplate, newContent) {
  if (!htmlTemplate || !newContent) {
    return newContent;
  }

  // Convert new content to HTML if it's plain text
  const htmlContent = newContent.includes('<') ? newContent : `<p>${newContent}</p>`;
  
  try {
    // Find and replace content between common Mailchimp content markers
    let modifiedHtml = htmlTemplate;
    
    // Replace content in common Mailchimp content areas
    const contentPatterns = [
      /<div[^>]*class="[^"]*mcnTextContent[^"]*"[^>]*>.*?<\/div>/gs,
      /<td[^>]*class="[^"]*text[^"]*"[^>]*>.*?<\/td>/gs,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>.*?<\/div>/gs,
      /<p[^>]*>.*?<\/p>/gs
    ];

    let replaced = false;
    for (const pattern of contentPatterns) {
      const matches = modifiedHtml.match(pattern);
      if (matches && matches.length > 0) {
        // Replace the first match with new content
        modifiedHtml = modifiedHtml.replace(pattern, (match, index) => {
          if (!replaced) {
            replaced = true;
            // Extract the opening tag and attributes
            const tagMatch = match.match(/^<([a-z]+)([^>]*)>/i);
            if (tagMatch) {
              const tagName = tagMatch[1];
              const attributes = tagMatch[2];
              return `<${tagName}${attributes}>${htmlContent}</${tagName}>`;
            }
          }
          return match;
        });
        break;
      }
    }

    // If no patterns matched, append content to the body
    if (!replaced) {
      const bodyEndIndex = modifiedHtml.lastIndexOf('</body>');
      if (bodyEndIndex !== -1) {
        modifiedHtml = modifiedHtml.slice(0, bodyEndIndex) + 
                      htmlContent + 
                      modifiedHtml.slice(bodyEndIndex);
      } else {
        // If no body tag, append to the end
        modifiedHtml += htmlContent;
      }
    }

    return modifiedHtml;
  } catch (error) {
    console.error('Error in template extraction:', error);
    // Fallback to basic HTML structure
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Campaign</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;
  }
}

/**
 * Improved HTML content extraction that preserves styling but replaces text content
 * This version is more robust and handles various Mailchimp HTML structures
 */
export function extractMailchimpTemplateSimple(htmlTemplate, newContent) {
  if (!htmlTemplate || !newContent) {
    return newContent;
  }

  try {
    // Convert new content to HTML if it's plain text
    const htmlContent = newContent.includes('<') ? newContent : `<p>${newContent}</p>`;
    
    let modifiedHtml = htmlTemplate;
    let replaced = false;
    
    // More comprehensive patterns for Mailchimp content areas
    const contentPatterns = [
      // Mailchimp specific content areas
      /<div[^>]*class="[^"]*mcnTextContent[^"]*"[^>]*>.*?<\/div>/gs,
      /<div[^>]*class="[^"]*mcnTextBlockInner[^"]*"[^>]*>.*?<\/div>/gs,
      /<div[^>]*class="[^"]*mcnTextBlock[^"]*"[^>]*>.*?<\/div>/gs,
      /<td[^>]*class="[^"]*text[^"]*"[^>]*>.*?<\/td>/gs,
      /<td[^>]*class="[^"]*content[^"]*"[^>]*>.*?<\/td>/gs,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>.*?<\/div>/gs,
      // Generic content areas
      /<div[^>]*class="[^"]*body[^"]*"[^>]*>.*?<\/div>/gs,
      /<div[^>]*class="[^"]*main[^"]*"[^>]*>.*?<\/div>/gs,
      // Paragraph content
      /<p[^>]*>.*?<\/p>/gs,
      // Any div with text-like content
      /<div[^>]*>.*?<\/div>/gs
    ];

    // Try each pattern until we find a match
    for (let i = 0; i < contentPatterns.length; i++) {
      const pattern = contentPatterns[i];
      const matches = modifiedHtml.match(pattern);
      
      if (matches && matches.length > 0) {
        // Find the best match - prefer content that looks like main text
        let bestMatch = null;
        let bestScore = 0;
        
        for (const match of matches) {
          let score = 0;
          // Score based on content characteristics
          if (match.includes('mcnTextContent')) score += 10;
          if (match.includes('mcnTextBlock')) score += 8;
          if (match.includes('text')) score += 6;
          if (match.includes('content')) score += 4;
          if (match.includes('<p>')) score += 2;
          if (match.length > 50) score += 1; // Prefer longer content areas
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = match;
          }
        }
        
        if (bestMatch) {
          // Replace the best match with new content
          modifiedHtml = modifiedHtml.replace(bestMatch, (match) => {
            // Extract the opening tag and attributes
            const tagMatch = match.match(/^<([a-z]+)([^>]*)>/i);
            if (tagMatch) {
              const tagName = tagMatch[1];
              const attributes = tagMatch[2];
              return `<${tagName}${attributes}>${htmlContent}</${tagName}>`;
            }
            return match;
          });
          replaced = true;
          break;
        }
      }
    }

    // If no patterns matched, try to insert content in a logical place
    if (!replaced) {
      // Look for common insertion points
      const insertionPoints = [
        { pattern: /<body[^>]*>/i, position: 'after' },
        { pattern: /<div[^>]*class="[^"]*container[^"]*"[^>]*>/i, position: 'after' },
        { pattern: /<div[^>]*class="[^"]*wrapper[^"]*"[^>]*>/i, position: 'after' },
        { pattern: /<\/head>/i, position: 'after' }
      ];
      
      for (const point of insertionPoints) {
        const match = modifiedHtml.match(point.pattern);
        if (match) {
          if (point.position === 'after') {
            const insertIndex = match.index + match[0].length;
            modifiedHtml = modifiedHtml.slice(0, insertIndex) + 
                          htmlContent + 
                          modifiedHtml.slice(insertIndex);
            replaced = true;
            break;
          }
        }
      }
      
      // Last resort: append to body end
      if (!replaced) {
        const bodyEndIndex = modifiedHtml.lastIndexOf('</body>');
        if (bodyEndIndex !== -1) {
          modifiedHtml = modifiedHtml.slice(0, bodyEndIndex) + 
                        htmlContent + 
                        modifiedHtml.slice(bodyEndIndex);
        } else {
          // If no body tag, append to the end
          modifiedHtml += htmlContent;
        }
      }
    }

    return modifiedHtml;
  } catch (error) {
    console.error('Error in simple template extraction:', error);
    // Fallback to basic HTML structure
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Campaign</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;
  }
}

/**
 * Applies a template to HTML content for preview purposes
 * This is a client-side version that can be used in the UI
 */
export function applyTemplateToPreview(templateHtml, contentHtml) {
  if (!templateHtml || !contentHtml) {
    return contentHtml;
  }

  try {
    // Convert content to HTML if it's plain text
    const htmlContent = contentHtml.includes('<') ? contentHtml : `<p>${contentHtml}</p>`;
    
    let modifiedHtml = templateHtml;
    let replaced = false;
    
    // Simplified patterns for preview (focus on common content areas)
    const contentPatterns = [
      /<div[^>]*class="[^"]*mcnTextContent[^"]*"[^>]*>.*?<\/div>/gs,
      /<div[^>]*class="[^"]*mcnTextBlock[^"]*"[^>]*>.*?<\/div>/gs,
      /<td[^>]*class="[^"]*text[^"]*"[^>]*>.*?<\/td>/gs,
      /<p[^>]*>.*?<\/p>/gs
    ];

    // Try each pattern until we find a match
    for (const pattern of contentPatterns) {
      const matches = modifiedHtml.match(pattern);
      if (matches && matches.length > 0) {
        // Find the best match
        let bestMatch = null;
        let bestScore = 0;
        
        for (const match of matches) {
          let score = 0;
          if (match.includes('mcnTextContent')) score += 10;
          if (match.includes('mcnTextBlock')) score += 8;
          if (match.includes('text')) score += 6;
          if (match.includes('<p>')) score += 2;
          if (match.length > 50) score += 1;
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = match;
          }
        }
        
        if (bestMatch) {
          // Replace the best match with new content
          modifiedHtml = modifiedHtml.replace(bestMatch, (match) => {
            const tagMatch = match.match(/^<([a-z]+)([^>]*)>/i);
            if (tagMatch) {
              const tagName = tagMatch[1];
              const attributes = tagMatch[2];
              return `<${tagName}${attributes}>${htmlContent}</${tagName}>`;
            }
            return match;
          });
          replaced = true;
          break;
        }
      }
    }

    // If no patterns matched, try to insert content in a logical place
    if (!replaced) {
      const bodyEndIndex = modifiedHtml.lastIndexOf('</body>');
      if (bodyEndIndex !== -1) {
        modifiedHtml = modifiedHtml.slice(0, bodyEndIndex) + 
                      htmlContent + 
                      modifiedHtml.slice(bodyEndIndex);
      } else {
        modifiedHtml += htmlContent;
      }
    }

    return modifiedHtml;
  } catch (error) {
    console.error('Error applying template to preview:', error);
    return contentHtml;
  }
} 