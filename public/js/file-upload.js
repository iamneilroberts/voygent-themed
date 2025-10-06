// File upload module
export let selectedFiles = [];

export function initFileUpload() {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
}

function handleFiles(files) {
  selectedFiles = [...selectedFiles, ...Array.from(files)];
  updateFileList();
}

function updateFileList() {
  const fileList = document.getElementById('fileList');
  fileList.innerHTML = selectedFiles
    .map((f, i) => `
      <div style="padding: 8px; background: #f0f0f0; margin: 5px 0; border-radius: 4px; display: flex; justify-content: space-between;">
        <span>📄 ${f.name} (${(f.size / 1024).toFixed(1)} KB)</span>
        <button onclick="removeFile(${i})" style="background: #dc3545; padding: 4px 12px; font-size: 0.8rem;">Remove</button>
      </div>
    `)
    .join('');
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateFileList();
}

// Make removeFile available globally for onclick
window.removeFile = removeFile;
