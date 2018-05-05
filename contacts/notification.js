var qencode = require('q-encoding');
var utf8 = require('utf8');
var MIME = function (string) {
    return '=?UTF-8?Q?' + qencode.encode(utf8.encode(string)) + '?=';
}

var AWS = require('aws-sdk');
var accessKeyID = process.env.AWS_KEY_ID;
var secretAccessKey = process.env.AWS_SECRET_KEY;
var ses = new AWS.SES({
    apiVersion: '2010-12-01',
    accessKeyId: accessKeyID,
    secretAccessKey: secretAccessKey,
    sslEnabled: true,
    region: 'us-west-2'
});

//set up twilio
var accountSid = process.env.TWILIO_SID; // Your Account SID from www.twilio.com/console
var authToken = process.env.TWILIO_TOKEN;   // Your Auth Token from www.twilio.com/console

var twilio = require('twilio');
var client = new twilio(accountSid, authToken);

function sendCall(to, message) {
    client.calls.create({
        url: 'http://127.0.0.1:3000/voice?text=hello',
        to: to,
        from: '+14158401171',
    }).then(function (call) {
        console.log('called contact successfully!');
    }).catch(function (err) {
        console.error(err);
    });
}

function sendText(to, text) {
    client.messages.create({
        body: text,
        to: to,  // Text this number
        from: '+14158401171 ' // From a valid Twilio number
    }).then(function (message) {
        console.log('Successfully sent message!')
    }).catch(function (err) {
        console.error(err);
    });
}

function sendEmail(to, subject, body) {
    ses.sendEmail({
        Destination: {
            ToAddresses: [
                to
            ]
        },

        Message: {
            Body: {
                Html: {
                    Charset: 'UTF-8',
                    Data: body
                }
            },
            Subject: {
                Charset: 'UTF-8',
                Data: subject
            }
        },
        Source: MIME('DBGrow Alerts') + ' <' + 'support@dbgrow.com' + '>',
    }, function (err) {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Sent email successfully!!!');
    });
}

module.exports = {
    sendEmail: sendEmail,
    sendText: sendText,
    sendCall: sendCall
};