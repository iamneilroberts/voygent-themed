/**
 * VoyGent V3 - Intake Form Handler
 * Dynamic form generation based on template fields
 */

const IntakeForm = {
  modal: null,
  form: null,
  currentTemplate: null,

  /**
   * Field definitions with labels, types, and options
   */
  fieldDefinitions: {
    // Common fields
    duration: {
      label: 'Trip Duration',
      type: 'select',
      options: [
        { value: '3-5', label: '3-5 days' },
        { value: '5-7', label: '5-7 days' },
        { value: '7-10', label: '7-10 days' },
        { value: '10-14', label: '10-14 days' },
        { value: '14+', label: '14+ days' },
      ],
      default: '7-10',
    },
    departure_airport: {
      label: 'Departure Airport',
      type: 'text',
      placeholder: 'e.g., JFK, LAX, ORD',
    },
    travelers_adults: {
      label: 'Adults',
      type: 'number',
      min: 1,
      max: 10,
      default: 2,
    },
    travelers_children: {
      label: 'Children',
      type: 'number',
      min: 0,
      max: 10,
      default: 0,
    },
    luxury_level: {
      label: 'Budget Level',
      type: 'select',
      options: [
        { value: 'Budget', label: 'Budget-Friendly' },
        { value: 'Comfort', label: 'Comfort' },
        { value: 'Luxury', label: 'Luxury' },
      ],
      default: 'Comfort',
    },
    activity_level: {
      label: 'Activity Level',
      type: 'select',
      options: [
        { value: 'Relaxed', label: 'Relaxed' },
        { value: 'Moderate', label: 'Moderate' },
        { value: 'Active', label: 'Active' },
      ],
      default: 'Moderate',
    },
    departure_date: {
      label: 'Preferred Travel Date',
      type: 'date',
    },
    // Theme-specific fields
    dietary_restrictions: {
      label: 'Dietary Restrictions',
      type: 'text',
      placeholder: 'e.g., vegetarian, gluten-free, none',
    },
    occasion: {
      label: 'Occasion',
      type: 'select',
      options: [
        { value: 'honeymoon', label: 'Honeymoon' },
        { value: 'anniversary', label: 'Anniversary' },
        { value: 'romantic_getaway', label: 'Romantic Getaway' },
        { value: 'proposal', label: 'Proposal Trip' },
        { value: 'other', label: 'Other' },
      ],
    },
    interests: {
      label: 'Interests',
      type: 'text',
      placeholder: 'e.g., beach, adventure, spa, culture',
    },
    fitness_level: {
      label: 'Fitness Level',
      type: 'select',
      options: [
        { value: 'beginner', label: 'Beginner' },
        { value: 'intermediate', label: 'Intermediate' },
        { value: 'advanced', label: 'Advanced' },
        { value: 'expert', label: 'Expert' },
      ],
      default: 'intermediate',
    },
    experience_level: {
      label: 'Experience Level',
      type: 'select',
      options: [
        { value: 'first_time', label: 'First Time' },
        { value: 'some_experience', label: 'Some Experience' },
        { value: 'experienced', label: 'Experienced' },
        { value: 'expert', label: 'Expert' },
      ],
      default: 'some_experience',
    },
    // Transportation preferences
    transportation_preference: {
      label: 'Transportation Preference',
      type: 'select',
      options: [
        { value: 'flexible', label: 'Flexible / No Preference' },
        { value: 'rental_car', label: 'Rental Car (Self-Drive)' },
        { value: 'public_transit', label: 'Public Transit (Trains, Buses)' },
        { value: 'driver_hire', label: 'Private Driver / Tour Services' },
      ],
      default: 'flexible',
    },
    driving_comfort: {
      label: 'Driving Abroad Comfort',
      type: 'select',
      options: [
        { value: 'comfortable_abroad', label: 'Comfortable driving anywhere' },
        { value: 'prefer_familiar', label: 'Prefer familiar (same driving side)' },
        { value: 'no_driving', label: 'Prefer not to drive' },
      ],
      default: 'prefer_familiar',
    },
    home_country: {
      label: 'Home Country',
      type: 'text',
      placeholder: 'e.g., US, UK, Australia',
    },
    traveler_ages: {
      label: 'Traveler Ages',
      type: 'text',
      placeholder: 'e.g., 55, 53, 25, 8',
    },
  },

  /**
   * Initialize the intake form
   */
  init() {
    this.modal = document.getElementById('intakeModal');
    this.form = document.getElementById('intakeForm');

    if (!this.modal || !this.form) return;

    // Close button
    const closeBtn = this.modal.querySelector('.modal-close');
    closeBtn?.addEventListener('click', () => this.close());

    // Cancel button
    const cancelBtn = document.getElementById('cancelBtn');
    cancelBtn?.addEventListener('click', () => this.close());

    // Overlay click to close
    const overlay = this.modal.querySelector('.modal-overlay');
    overlay?.addEventListener('click', () => this.close());

    // Form submission
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
        this.close();
      }
    });
  },

  /**
   * Open modal with template data
   */
  open(template) {
    this.currentTemplate = template;

    // Set header
    document.getElementById('modalIcon').textContent = template.icon;
    document.getElementById('modalTitle').textContent = template.name;

    // Set main query section
    document.getElementById('mainQueryLabel').textContent =
      `What would you like to explore?`;
    document.getElementById('mainQueryHelp').textContent =
      template.search_help_text || '';
    document.getElementById('mainQuery').placeholder =
      template.search_placeholder || 'Describe your ideal trip...';
    document.getElementById('mainQuery').value = '';

    // Build required fields
    const requiredFields = this.parseFields(template.required_fields);
    this.buildFieldsGrid('requiredFieldsGrid', requiredFields, true);

    // Show/hide required section based on fields
    const requiredSection = document.getElementById('requiredFields');
    if (requiredFields.length === 0) {
      requiredSection.classList.add('hidden');
    } else {
      requiredSection.classList.remove('hidden');
    }

    // Build optional fields
    const optionalFields = this.parseFields(template.optional_fields);
    this.buildFieldsGrid('optionalFieldsGrid', optionalFields, false);

    // Show/hide optional section based on fields
    const optionalSection = document.getElementById('optionalFields');
    if (optionalFields.length === 0) {
      optionalSection.classList.add('hidden');
    } else {
      optionalSection.classList.remove('hidden');
    }

    // Show modal
    this.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Focus main query
    setTimeout(() => {
      document.getElementById('mainQuery').focus();
    }, 100);
  },

  /**
   * Close modal
   */
  close() {
    this.modal.classList.add('hidden');
    document.body.style.overflow = '';
    this.currentTemplate = null;
    this.form.reset();
  },

  /**
   * Parse fields array (handles both JSON string and already-parsed array)
   */
  parseFields(fields) {
    if (!fields) return [];
    // If already an array, return it
    if (Array.isArray(fields)) return fields;
    // If string, try to parse as JSON
    try {
      return JSON.parse(fields);
    } catch {
      return [];
    }
  },

  /**
   * Build form fields grid
   */
  buildFieldsGrid(gridId, fields, required) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';

    fields.forEach((fieldName) => {
      const def = this.fieldDefinitions[fieldName];
      if (!def) {
        console.warn(`Unknown field: ${fieldName}`);
        return;
      }

      const fieldEl = this.createField(fieldName, def, required);
      grid.appendChild(fieldEl);
    });
  },

  /**
   * Create a form field element
   */
  createField(name, def, required) {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-field';

    const label = document.createElement('label');
    label.setAttribute('for', name);
    label.textContent = def.label;
    if (required) {
      label.innerHTML += ' <span class="required">*</span>';
    }
    wrapper.appendChild(label);

    let input;

    switch (def.type) {
      case 'select':
        input = document.createElement('select');
        input.id = name;
        input.name = name;
        if (required) input.required = true;

        // Add empty option
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = `Select ${def.label.toLowerCase()}...`;
        input.appendChild(emptyOpt);

        def.options.forEach((opt) => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          if (def.default === opt.value) {
            option.selected = true;
          }
          input.appendChild(option);
        });
        break;

      case 'number':
        input = document.createElement('input');
        input.type = 'number';
        input.id = name;
        input.name = name;
        if (def.min !== undefined) input.min = def.min;
        if (def.max !== undefined) input.max = def.max;
        if (def.default !== undefined) input.value = def.default;
        if (required) input.required = true;
        break;

      case 'date':
        input = document.createElement('input');
        input.type = 'date';
        input.id = name;
        input.name = name;
        // Set min date to today
        input.min = new Date().toISOString().split('T')[0];
        if (required) input.required = true;
        break;

      default: // text
        input = document.createElement('input');
        input.type = 'text';
        input.id = name;
        input.name = name;
        if (def.placeholder) input.placeholder = def.placeholder;
        if (required) input.required = true;
    }

    wrapper.appendChild(input);
    return wrapper;
  },

  /**
   * Handle form submission
   */
  async handleSubmit(e) {
    e.preventDefault();

    if (!this.currentTemplate) return;

    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    // Show loading state
    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');

    try {
      // Collect form data
      const formData = new FormData(this.form);
      const mainQuery = formData.get('mainQuery');

      // Build preferences object
      const preferences = {};
      for (const [key, value] of formData.entries()) {
        if (key !== 'mainQuery' && value) {
          preferences[key] = value;
        }
      }

      // Create trip with structured data
      const result = await apiClient.createTrip(
        this.currentTemplate.id,
        mainQuery,
        Object.keys(preferences).length > 0 ? preferences : null
      );

      // Redirect to chat page
      window.location.href = `/chat?trip_id=${result.trip_id}`;
    } catch (error) {
      console.error('Failed to create trip:', error);
      alert('Failed to start trip planning. Please try again.');

      // Reset button state
      submitBtn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
    }
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  IntakeForm.init();
});
