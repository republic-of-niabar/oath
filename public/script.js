$(document).ready(function() {
  // 1) Show/hide contact fields
  $('input[name="contactMethod"]').on('change', function() {
    if ($('#contactDiscord').is(':checked')) {
      $('#discordUsernameGroup').removeClass('d-none');
      $('#emailAddressGroup').addClass('d-none');
      $('#discordUsername').prop('required', true);
      $('#emailAddress').prop('required', false);
    } else {
      $('#emailAddressGroup').removeClass('d-none');
      $('#discordUsernameGroup').addClass('d-none');
      $('#emailAddress').prop('required', true);
      $('#discordUsername').prop('required', false);
    }
  });

  // 2) Build and show the oath text + checkbox label
  function updateOathText() {
    const name = $('#name').val() || '[your name]';
    let oath;
    if ($('#oathWithGod').is(':checked')) {
      oath = `By clicking this checkmark, I, ${name}, do solemnly swear that I will support and defend the Constitution of the Republic of Niabar and obey laws and legal orders that are ordered upon me and/or other citizens by the authorities of the Republic, and I hereby declare that I recognize and accept the supreme authority of Niabar and will maintain true faith and allegiance thereto; that I will be loyal to the Republic of Niabar, promote all that will advance it and oppose all that may harm it, and that I will uphold and respect the Constitution and laws of the Republic, so help me God. My clicking this checkmark is equally as powerful as a signature on paper.`;
    } else if ($('#oathWithoutGod').is(':checked')) {
      oath = `By clicking this checkmark, I, ${name}, do solemnly declare and affirm that I will support and defend the Constitution of the Republic of Niabar and obey laws and legal orders that are ordered upon me and/or other citizens by the authorities of the Republic, and will maintain true faith and allegiance thereto; that I will be loyal to the Republic of Niabar, promote all that will advance it and oppose all that may harm it, and that I will uphold and respect the Constitution and laws of the Republic. My clicking this checkmark is equally as powerful as a signature on paper.`;
    } else {
      // no radio selected → nothing to show
      return;
    }

    // set the paragraph
    $('#oathText').text(oath);
    // set the checkbox label
    $('#oathCheckboxLabel').text('I agree to the above oath.');
    // show the group
    $('#oathTextGroup').removeClass('d-none');
  }

  // 3) Whenever the user types their name or flips the oathType, recalc
  $('#name').on('input', updateOathText);
  $('input[name="oathType"]').on('change', updateOathText);

  // 4) Submission stays the same
  $('#oathForm').on('submit', async function(event) {
    event.preventDefault();
    const name              = $('#name').val();
    const dob               = $('#dob').val();
    const contactPreference = $('input[name="contactMethod"]:checked').val();
    const contactAddress    = contactPreference === 'Discord'
                             ? $('#discordUsername').val()
                             : $('#emailAddress').val();
    const oathType          = $('input[name="oathType"]:checked').val();
    const oathText          = $('#oathText').text();

    const payload = { name, dob, contactPreference, contactAddress, oathType, oathText };

    try {
      const res = await fetch('https://oath.pages.dev/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Oath submitted successfully.');
      } else {
        const err = await res.json();
        alert('Submission error: ' + (err.message || res.statusText));
      }
    } catch (e) {
      console.error(e);
      alert('Network error sending oath.');
    }
  });
});
