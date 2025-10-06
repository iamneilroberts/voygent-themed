// UI helpers for error/success messages

export function showError(msg) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = msg;
  errorDiv.classList.remove('hidden');
}

export function hideError() {
  document.getElementById('error').classList.add('hidden');
}

export function showSuccess(msg) {
  const successDiv = document.getElementById('success');
  successDiv.textContent = msg;
  successDiv.classList.remove('hidden');
}

export function hideSuccess() {
  document.getElementById('success').classList.add('hidden');
}
