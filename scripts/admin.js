const rfpTableBody = document.querySelector('#rfpTable tbody');
const creditForm = document.getElementById('creditForm');

const sampleRFPs = [
  { id: 'RFP001', title: 'Housing Study', type: 'RFI', issued: '2025-11-01', close: '2025-11-25', company: 'Hampton Roads Planning District' },
  { id: 'RFP002', title: 'Infrastructure Assessment', type: 'RFP', issued: '2025-11-02', close: '2025-11-26', company: 'City of Norfolk' }
];

function renderRFPTable() {
  rfpTableBody.innerHTML = sampleRFPs.map(r => `<tr>
    <td>${r.id}</td><td>${r.title}</td><td>${r.type}</td>
    <td>${r.issued}</td><td>${r.close}</td><td>${r.company}</td>
  </tr>`).join('');
}
renderRFPTable();

creditForm.addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const credits = document.getElementById('userCredits').value;
  console.log(`Updated credits for ${id}: ${credits}`);
  alert(`Credits for user ${id} updated to ${credits}.`);
  creditForm.reset();
});