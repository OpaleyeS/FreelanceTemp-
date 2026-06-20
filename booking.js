const bookingForm = document.getElementById('booking-form');
const optionInputs = bookingForm.querySelectorAll('.option input');
const dateInput = document.getElementById('appt-date');
const timeInput = document.getElementById('appt-time');
const summaryText = document.getElementById('summary-text');
const totalText = document.getElementById('total-text');
const hiddenSummary = document.getElementById('hidden-summary');
const hiddenTotal = document.getElementById('hidden-total');
const confirmation = document.getElementById('booking-confirmation');
const submitBtn = document.getElementById('submit-booking');

const todayStr = new Date().toISOString().split('T')[0];
dateInput.min = todayStr;

function updateSummary(){
    let total = 0;
    let names = [];

    optionInputs.forEach(input => {
        if(input.checked){
            total += Number(input.value);
            names.push(input.dataset.name);
        }
    });

    if(dateInput.value && timeInput.value){
        const appointment = new Date(dateInput.value + "T" + timeInput.value);
        const dateLabel = appointment.toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'});
        const timeLabel = appointment.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
        names.push(dateLabel + ' at ' + timeLabel);
    }

    summaryText.textContent = names.length ? names.join(', ') : 'None';
    totalText.textContent = '$' + total;
    hiddenSummary.value = names.join(', ');
    hiddenTotal.value = total;
}

optionInputs.forEach(input => input.addEventListener('change', updateSummary));
dateInput.addEventListener('change', updateSummary);
timeInput.addEventListener('change', updateSummary);

bookingForm.addEventListener('submit', (event) => {
    event.preventDefault();

    let serviceSelected = false;
    optionInputs.forEach(input => {
        if(input.checked && input.name === 'service'){
            serviceSelected = true;
        }
    });
    if(!serviceSelected){
        summaryText.textContent = 'Please select a service';
        return;
    }

    updateSummary();
    confirmation.style.display = 'block';
    submitBtn.disabled = true;
});