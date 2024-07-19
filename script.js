$(document).ready(function() {
    function updateOathText() {
        const name = $('#name').val();
        if ($('#oathWithGod').is(':checked')) {
            $('#oathText').text(`By clicking this checkmark, I, ${name}, do solemnly swear that I will support and defend the Constitution of the Republic of Niabar and obey laws and legal orders that are ordered upon me and/or other citizens by the authorities of the Republic, and I hereby declare that I recognize and accept the supreme authority of Niabar and will maintain true faith and allegiance thereto; that I will be loyal to the Republic of Niabar, promote all that will advance it and oppose all that may harm it, and that I will uphold and respect the Constitution and laws of the Republic, so help me God. My clicking this checkmark is equally as powerful as a signature on paper.`);
        } else if ($('#oathWithoutGod').is(':checked')) {
            $('#oathText').text(`By clicking this checkmark, I, ${name}, do solemnly declare and affirm that I will support and defend the Constitution of the Republic of Niabar and obey laws and legal orders that are ordered upon me and/or other citizens by the authorities of the Republic, and will maintain true faith and allegiance thereto; that I will be loyal to the Republic of Niabar, promote all that will advance it and oppose all that may harm it, and that I will uphold and respect the Constitution and laws of the Republic. My clicking this checkmark is equally as powerful as a signature on paper.`);
        }
        $('#oathTextGroup').removeClass('d-none');
    }

    $('input[name="contactMethod"]').on('change', function() {
        if ($('#contactDiscord').is(':checked')) {
            $('#discordUsernameGroup').removeClass('d-none');
            $('#emailAddressGroup').addClass('d-none');
            $('#emailAddress').prop('required', false);
            $('#discordUsername').prop('required', true);
        } else if ($('#contactEmail').is(':checked')) {
            $('#emailAddressGroup').removeClass('d-none');
            $('#discordUsernameGroup').addClass('d-none');
            $('#discordUsername').prop('required', false);
            $('#emailAddress').prop('required', true);
        }
    });

    $('input[name="oathType"]').on('change', updateOathText);

    $('#name').on('input', updateOathText);

    $('#oathForm').on('submit', function(event) {
        event.preventDefault();
        const name = $('#name').val();
        const dob = $('#dob').val();
        const contactMethod = $('input[name="contactMethod"]:checked').val();
        const contactDetail = contactMethod === 'Discord' ? $('#discordUsername').val() : $('#emailAddress').val();
        const oathType = $('input[name="oathType"]:checked').val();
        const oathText = $('#oathText').text();

        $.ajax({
            url: 'https://jyzdngl2lni7wnqggc4i65soa40upxck.lambda-url.us-east-1.on.aws/',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                name: name,
                dob: dob,
                contactMethod: contactMethod,
                contactDetail: contactDetail,
                oathType: oathType,
                oathText: oathText
            }),
            success: function(response) {
                alert('Oath submitted successfully.');
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error details:', {
                    jqXHR: jqXHR,
                    textStatus: textStatus,
                    errorThrown: errorThrown
                });
                let errorMessage = 'There was an error submitting the oath.';
                if (jqXHR.status === 0) {
                    errorMessage += ' Not connected. Verify Network.';
                } else if (jqXHR.status == 404) {
                    errorMessage += ' Requested page not found [404].';
                } else if (jqXHR.status == 500) {
                    errorMessage += ' Internal Server Error [500].';
                } else if (textStatus === 'parsererror') {
                    errorMessage += ' Requested JSON parse failed.';
                } else if (textStatus === 'timeout') {
                    errorMessage += ' Time out error.';
                } else if (textStatus === 'abort') {
                    errorMessage += ' Ajax request aborted.';
                } else {
                    errorMessage += ' Uncaught Error: ' + jqXHR.responseText;
                }
                alert(errorMessage);
            }
        });
    });
});
