<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = $_POST['name'];
    $dob = $_POST['dob'];
    $contactMethod = $_POST['contactMethod'];
    $contactDetail = $_POST['contactDetail'];
    $oathType = $_POST['oathType'];
    $oathText = $_POST['oathText'];

    $to = 'government.of.niabar+oath@gmail.com';
    $subject = 'New Citizenship Oath Submission';
    $message = "Name: $name\nDOB: $dob\nContact Method: $contactMethod\nContact Detail: $contactDetail\nOath Type: $oathType\n\nOath Text:\n$oathText";
    $headers = "From: noreply@niabar.org";

    $smtpHost = 'email-smtp.us-east-1.amazonaws.com';
    $smtpPort = 25;
    $smtpUsername = 'AKIAW3MD62ZCCO4UMMZT';
    $smtpPassword = 'BA4GMVzn1ve8MwQL/TGw6lieihgXkX6v70v7EwEuOs/i';

    $transport = (new Swift_SmtpTransport($smtpHost, $smtpPort))
        ->setUsername($smtpUsername)
        ->setPassword($smtpPassword);

    $mailer = new Swift_Mailer($transport);

    $emailMessage = (new Swift_Message($subject))
        ->setFrom(['noreply@niabar.org' => 'Republic of Niabar'])
        ->setTo([$to])
        ->setBody($message);

    try {
        $result = $mailer->send($emailMessage);
        echo 'Email sent successfully';
    } catch (Exception $e) {
        echo 'Failed to send email: ' . $e->getMessage();
    }
}
?>
