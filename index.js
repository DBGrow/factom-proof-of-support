//config
var config = require('./config.json');
require('./routes/util').setSalt(config.salt);
require('./routes/util').setAppID(config.support_app_id);

console.log('config:');
console.log(config);

//setup contacts
require('./contacts/contacts').init();

const express = require('express');
const app = express();

//distribute express app down to routes/endpoints
require('./routes/router')(app);

//and start listening for connections
app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
});

//default setup


// var unirest = require('unirest');

/*

unirest.get('http://localhost:3000/nonce').end(function (response) {
    console.log(response.body);

    var nonce = response.body;

    console.log('CLIENT: got nonce: ' + nonce);

    //sign the nonce
    var signed_nonce = private_key.sign(nonce, 'hex', 'utf8').toString();

    var message = "I'm a teapot...";

    unirest.post('http://localhost:3000/checkin?nonce=' + encodeURIComponent(nonce) + '&signed_nonce=' + encodeURIComponent(signed_nonce) + '&message=' + encodeURIComponent(message))
        .end(function (response) {

            if (response.code != 200) console.error('HTTPERROR: ' + response.code + ' : ' + response.body);
            else console.log('SUCCESS!!!')
        });
});
*/


//generate support chain owner's keys if they do not exist
/*
if (!fs.existsSync('./keys/support/key.pem') && !fs.existsSync('./keys/support/public.pem')) {
    console.log('PK didnt exist');
    var private_key = new NodeRSA({b: 2048});

    //write the file
    fs.writeFileSync('./keys/support/key.pem', private_key.exportKey('private'));
    fs.writeFileSync('./keys/support/public.pem', private_key.exportKey('public'))
} else {
    console.log('PK exists');
}*/
