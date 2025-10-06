// Trip generation and display functions

import { getSelectedTheme } from './theme.js';
import { resetProgressSteps, addProgressLog } from './ui.js';

export let currentTripId = null;
export let selectedOptionKey = null;
export let selectedVariant = null;

export function resetPreviousResults() {
  // Clear trip state
  currentTripId = null;
  selectedOptionKey = null;
  selectedVariant = null;

  // Hide all result sections
  document.getElementById('researchSummary')?.classList.add('hidden');
  document.getElementById('optionsSection')?.classList.add('hidden');
  document.getElementById('variantsSection')?.classList.add('hidden');
  document.getElementById('itinerarySection')?.classList.add('hidden');
  document.getElementById('chatSection')?.classList.add('hidden');

  // Clear content
  document.getElementById('optionsGrid').innerHTML = '';
  document.getElementById('variantsContainer').innerHTML = '';
  document.getElementById('itineraryContent')?.innerHTML = '';
  document.getElementById('researchContent').innerHTML = '';
  document.getElementById('researchSources').innerHTML = '';

  // Reset progress UI
  resetProgressSteps();

  console.log('[RESET] Cleared all previous trip results');
}

// Expose to window for theme change callback
window.resetPreviousResults = resetPreviousResults;

export function buildTextInput() {
  const selectedTheme = getSelectedTheme();
  const quickStartInput = document.getElementById('quickStartInput')?.value.trim() || '';
  const surnames = document.getElementById('surnames').value.trim();
  const origins = document.getElementById('origins').value.trim();
  const adults = parseInt(document.getElementById('adults').value) || 2;
  const children = document.getElementById('children').value.trim();
  const duration = document.getElementById('duration').value.trim();
  const month = document.getElementById('month').value;
  const luxury = document.getElementById('luxury').value;
  const activity = document.getElementById('activity').value;
  const travelPace = document.getElementById('travel_pace').value;
  const airport = document.getElementById('airport').value.trim();
  const transportPref = document.getElementById('transport_pref').value;
  const hotelType = document.getElementById('hotel_type').value;
  const notes = document.getElementById('notes').value.trim();

  let text = '';

  // Start with quick start input if provided
  if (quickStartInput) {
    text += `${quickStartInput}\n\n`;
  }

  // Add theme-specific fields if surnames field is filled (it's reused for all themes)
  if (surnames) {
    text += `Family surnames: ${surnames}\n`;
  }
  if (origins) text += `Suspected origins: ${origins}\n`;

  // Party information
  text += `Party: ${adults} adult(s)`;
  if (children) text += `, children ages: ${children}`;
  text += `\n`;

  // Trip details
  if (duration) text += `Duration: ${duration} days\n`;
  if (month) text += `Target month: ${month}\n`;
  if (airport) text += `Departure airport: ${airport}\n`;
  text += `Transport preference: ${transportPref}\n`;
  text += `Travel pace: ${travelPace}\n`;
  text += `Hotel type: ${hotelType}\n`;
  text += `Luxury level: ${luxury}\n`;
  text += `Activity level: ${activity}\n`;
  if (notes) text += `\nAdditional notes:\n${notes}\n`;

  return text;
}

export function displayResearchSummary(researchSteps) {
  if (!researchSteps || researchSteps.length === 0) {
    console.log('[Research Display] No research steps to display');
    return;
  }

  const summaryDiv = document.getElementById('researchSummary');
  const contentDiv = document.getElementById('researchContent');
  const sourcesDiv = document.getElementById('researchSources');

  console.log('[Research Display] Processing research steps:', researchSteps);

  // Find different types of research steps
  const aiReasoning = researchSteps.find(step => step.step === 'ai_reasoning');
  const webSearch = researchSteps.find(step =>
    step.step === 'surname_research' ||
    step.step === 'filming_location_research' ||
    step.step === 'historical_research' ||
    step.step === 'culinary_research' ||
    step.step === 'adventure_research'
  );

  console.log('[Research Display] AI Reasoning:', aiReasoning ? 'Found' : 'Not found');
  console.log('[Research Display] Web Search:', webSearch ? 'Found' : 'Not found');

  // Display web search summary (available for all themes)
  if (webSearch && webSearch.summary) {
    let formattedHTML = `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #667eea; margin-bottom: 10px;">🔍 Research Summary</h3>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea;">
          ${webSearch.summary.split('\n\n').map(para => `<p style="margin-bottom: 10px;">${para}</p>`).join('')}
        </div>
      </div>
    `;

    // Add AI reasoning if available (currently only for heritage)
    if (aiReasoning && aiReasoning.analysis) {
      const analysis = aiReasoning.analysis;
      const sections = analysis.split(/\d+\.\s+/).filter(s => s.trim());

      if (sections.length > 1) {
        formattedHTML += `
          <div style="margin-top: 20px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">💡 AI Analysis</h3>
            ${sections.map((section, idx) => {
              if (idx === 0 && section.length < 100) {
                return `<p style="margin-bottom: 15px;"><strong>${section.trim()}</strong></p>`;
              }
              return `
                <div style="margin-bottom: 15px; padding-left: 20px; border-left: 3px solid #667eea;">
                  <strong style="color: #667eea;">${idx === 0 ? 'Key Finding' : `Point ${idx}`}:</strong>
                  <span style="margin-left: 10px;">${section.trim()}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        formattedHTML += `
          <div style="margin-top: 20px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">💡 AI Analysis</h3>
            <p>${analysis}</p>
          </div>
        `;
      }
    }

    contentDiv.innerHTML = formattedHTML;

    // Add web search sources if available
    if (webSearch.sources && webSearch.sources.length > 0) {
      sourcesDiv.innerHTML = `
        <p style="margin-bottom: 10px; font-weight: 600;">Sources:</p>
        <ul style="list-style: none; padding: 0;">
          ${webSearch.sources.map(url => `
            <li style="margin: 8px 0;">
              <a href="${url}" target="_blank" style="color: #667eea; text-decoration: none; display: flex; align-items: center; gap: 8px;">
                🔗 ${new URL(url).hostname}
              </a>
            </li>
          `).join('')}
        </ul>
      `;
    } else {
      sourcesDiv.innerHTML = '';
    }

    // Show the summary and scroll to it
    summaryDiv.classList.remove('hidden');
    addProgressLog('Research summary displayed', 'success');
    setTimeout(() => {
      summaryDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  } else {
    console.log('[Research Display] No summary content found');
  }
}
