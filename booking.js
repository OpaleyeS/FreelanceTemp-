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

// Paste the Access Key you got from https://web3forms.com here.
const WEB3FORMS_ACCESS_KEY = '315c7ca1-36a8-438e-b4fc-eb5922f1499a';

bookingForm.addEventListener('submit', async (event) => {
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

    const emailInput = document.getElementById('appt-email');
    const customerEmail = emailInput.value.trim();

    const payload = {
        access_key: '315c7ca1-36a8-438e-b4fc-eb5922f1499a' ,
        subject: 'Booking Request: ' + (hiddenSummary.value || 'New booking'),
        from_name: customerEmail || 'Website booking form',
        selected_services: hiddenSummary.value || 'None',
        total: '$' + hiddenTotal.value,
        customer_email: customerEmail,
        appointment_date: dateInput.value,
        appointment_time: timeInput.value
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if(result.success){
            confirmation.textContent = 'Booking request sent. We will be in touch to confirm.';
            confirmation.style.display = 'block';
        } else {
            // Web3Forms reached the server fine, but rejected the request
            // (e.g. bad access key) — re-enable so the visitor can retry.
            confirmation.textContent = 'Something went wrong sending your request. Please try again or call us directly.';
            confirmation.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Request booking';
        }
    } catch (error) {
        // Network failure — visitor is offline or Web3Forms is unreachable.
        confirmation.textContent = 'Could not connect. Please check your internet connection and try again.';
        confirmation.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Request booking';
    }
});