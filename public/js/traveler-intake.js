/**
 * Traveler Intake Modal Controller
 * Handles form display, validation, and submission for quote requests
 */

/**
 * Show traveler intake modal and wire up form submission
 * @param {string} tripId - Trip ID to associate with quote request
 */
export function showTravelerIntake(tripId) {
  const modal = document.getElementById('travelerIntakeModal');
  if (!modal) {
    console.error('[Traveler Intake] Modal element not found');
    return;
  }

  modal.classList.remove('hidden');

  const form = document.getElementById('travelerIntakeForm');
  if (!form) {
    console.error('[Traveler Intake] Form element not found');
    return;
  }

  // Remove any existing submit handlers
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  // Add submit handler
  newForm.onsubmit = async (e) => {
    e.preventDefault();

    if (!validateForm(newForm)) {
      return;
    }

    const formData = new FormData(newForm);
    const data = Object.fromEntries(formData.entries());

    // Get agency_id from localStorage (white-label)
    const agencyId = localStorage.getItem('agency_id');
    if (agencyId) {
      data.agency_id = agencyId;
    }

    try {
      const response = await fetch(`/api/trips/${tripId}/request-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to submit quote request');
      }

      // Show confirmation
      newForm.classList.add('hidden');
      const confirmation = document.getElementById('submissionConfirmation');
      if (confirmation) {
        confirmation.classList.remove('hidden');
      }
    } catch (error) {
      alert('Error: ' + error.message);
      console.error('[Traveler Intake] Submission error:', error);
    }
  };
}

/**
 * Close traveler intake modal and reset form
 */
export function closeTravelerIntake() {
  const modal = document.getElementById('travelerIntakeModal');
  if (modal) {
    modal.classList.add('hidden');
  }

  const form = document.getElementById('travelerIntakeForm');
  if (form) {
    form.classList.remove('hidden');
    form.reset();
  }

  const confirmation = document.getElementById('submissionConfirmation');
  if (confirmation) {
    confirmation.classList.add('hidden');
  }
}

/**
 * Validate form fields
 * @param {HTMLFormElement} form - Form to validate
 * @returns {boolean} - True if valid
 */
function validateForm(form) {
  const name = form.elements.primary_name?.value?.trim();
  const email = form.elements.email?.value?.trim();

  if (!name || !email) {
    alert('Please fill in all required fields (Name and Email)');
    return false;
  }

  // Basic email validation
  if (!email.includes('@') || !email.includes('.')) {
    alert('Please enter a valid email address');
    return false;
  }

  return true;
}

// Make closeTravelerIntake available globally for onclick handlers
if (typeof window !== 'undefined') {
  window.closeTravelerIntake = closeTravelerIntake;
}
