# Factom Proof of Support



A NodeJS app server that  provide a way for support teams to prove publicly that they are/were actively present to support a service. 



Team members submit signed "checkin" messages to the POS server at regular intervals, which are then entered into the Factom blockchain to persist forever.



This project can be paired with the [Android Proof Of Support App](https://github.com/DBGrow/proof-of-support-android) so users can submit and view checkins from their mobile devices.



## Structure

The application is composed of two chains:

- The **Contact Chain** which keeps track of the organization's support members and their respective public keys
-  The **Checkin Chain** which keeps track of signed checkins/messages from the organization's support team members

The first entry in each chain is a `meta` entry that contains authentication information relating to the chain/organization. Each `meta` entry contains the public key of the organization's administrator, a nonce, and the nonce signed by the organization's administrator.

Entries made on the **Contacts Chain** to add contacts must each be signed by the organization administrator's private key to be deemed authentic.





## Prerequisites

- Access to a Factom API node (Mainnet or Testnet)
- Entry Credit address loaded with EC's
- NodeJS v8.11





## Installation

```bash
git clone https://github.com/DBGrow/factom-proof-of-support.git
cd factom-proof-of-support
npm install
```





## First Time Setup

Limited manual setup is required to operate the app:





### Edit `config.json` & Populate `contacts`

Set your app's unique ID, name, and other configuration options in in `./config.json`:

```json
{
  "support_app_id": "unique_app_id",
  "support_app_name": "Test App",
  "salt": "A1TANPcd4J",
  "factom_ec":"EC1tE4afVGPrBUStDhZPx1aHf4yHqsJuaDpM7WDbXCcYxruUxj2D",
  "factom_es":"Es3k4L7La1g7CY5zVLer21H3JFkXgCBCBx8eSM2q9hLbevbuoL6a",
  "factomd_api_host": "localhost",
  "factomd_api_port": 8088,
  "walletd_api_host": "localhost",
  "walletd_api_port": 8089,

  "contacts": [
    {
      "id": "353516811779",
      "name": "Example",
      "emails": [
        "example@example.com"
      ],
      "public_key": "-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwKhkZ3PqBn1YzW/y8LMS8kkQ1s25zkn4emYomGSZhe1JL65id07zjbV/Pe+v6HXthxZbNf7zabvTFjl53H96Z4IQEwyvEU6na0UcUF+MfuJrC1P+jTu4RjaSV/OubRydFmpQjWj6Oz378WTySDjGVuEo9ABw0fSGlRNsbzrLaYdcG2dwdzNpg8kCUy5pkdMC7DDC6IOjetkC+l76T/gWbAIoZX0t/HKEb66/n4qtPCPCNisXYgFld9Hz45YZRUtHBKI0o2zX3Km07MbHl3M5s+Wmt79KMbqopdjTtqB8XLdEBC5XG1RTX7oCxAvt0/Fs4v7GLoA0nHrtUE210HMB7wIDAQAB-----END PUBLIC KEY-----"
    }
  ]
}
```



**`support_app_id`** is the unique ID of your proof of support application. Change this to a custom value people will recognize.



**`support_app_name`** is the name of your proof of support application the end users will see



**`salt` **is a random arbitrary value that lets you create different 'versions' of your support app for testing. Change to `` to use the release version of your app. Change to a random value to create a new version.





**`factom_ec`** the public Entry Credit address for the POS server to use to publish chains and authorized entries.



**`factom_es`** the optional private Entry Credit address for the POS server to use. If supplied the application will not rely upon walletd.





**`factomd_api_host`** The IP/DNS address of the Factom API endpoint. Defaults to localhost if not supplied



**`factomd_api_port`** The integer port address of the Factom API endpoint. Defaults to 8088 if not supplied



**`walletd_api_host`** The IP/DNS address of the wallet API endpoint. Defaults to localhost if not supplied



**`walletd_api_port`** The integer port address of the walletd API endpoint. Defaults to 8089 if not supplied





**`contacts`** is the array of contacts authorized to use your proof of support application. It's necessary to have at least one contact before publishing a checkin. If a new contact or a change in a contact is detected between runs the new contact will be published to the checkin chain.

- **`contacts[n].id`** The unique ID of the contact
- **`contacts[n].name`** The screen name of the contact. This should be generated by the contact on the client side.
- **`contacts[n].emails`** Email points of contact of the contact. This should be generated by the contact on the client side.
- **`contacts[n].public key`** The 2048B RSA PEM encoded public key of the contact. This should be generated by the contact on the client side.





## Start The App Server

To start the app server:

```bash
node index.js
```

The proof of support service is exposed as an HTTP server on **port 3000**.



When the server is run for the first time it will generate new RSA keys for your organization in `./keys/` if they do not already exist.  Make sure to back these up! You can also replace these with your own keys if you wish.



The app will then initiate the Contacts and Checkin chains if they do not exist. After the block ends (<10 min) the library will commit the contacts you specify in `config.json` and you may begin sending checkins.





## Sending A Checkin

Heres an example of sending a signed support checkin over HTTP in node using unirest and node-rsa:

```javascript
var unirest = require('unirest');
var NodeRSA = require('node-rsa');
var fs = require('fs');

//load the private key for the support team contact
//Devon will be signin this checkin
var private_support_key_string = fs.readFileSync('./key.pem').toString();

var private_support_key = new NodeRSA();
private_support_key.importKey(private_support_key_string, 'private');

//get a nonce from the POS server
unirest.get('http://localhost:3000/nonce').end(function (response) {
    var nonce = response.body;

    console.log('CLIENT: got nonce: ' + nonce);

    //sign the nonce with the team member's private key
    var signed_nonce = private_support_key.sign(nonce, 'hex', 'utf8').toString();

    var message = "I'm a teapot...";
	//compose the checkin URL params and send the checkin POST request
    unirest.post('http://localhost:3000/checkin?nonce=' + encodeURIComponent(nonce) + '&signed_nonce=' + encodeURIComponent(signed_nonce) + '&message=' + encodeURIComponent(message))
        .end(function (response) {

            if (response.code != 200) console.error('HTTPERROR: ' + response.code + ' : ' + response.body);
            else console.log('SUCCESS COMMITTING CHECKIN!!!')
        });
});
```

This will trigger a new entry in the applications **Checkin Chain** with the following content:

```json
{"type":"checkin","signer":"Devon","message":"I'm a teapot...","nonce":"a1b87948cfe6b11a5742e75ca5b34368","signed_nonce":"8acac7dc3f63b1ee446482ebed4026d898461ced2261e6e9099eead0761b5da69b65dcf1574a3d1a27b64e04a14c0ddc2cbc46759be83584760f0f773646fe2a8be7b457a4ddf02effee0c1bca6bc55f77ebf09bddc255137bdb9107b19d56a503390765d15185463510acb2282794ea37d0a59e8aceea4443fdd952f314978cf523bcae9dd7f583aab5c2305b48ab5a59b32ab70d51bf818226c895d9e64a04d69a31a3872d29ccfbf2398e22726dbe494be16f100582c56341246b5ac2f90e81996d75afee1a8c4713483dbfedc512f01f49c22fe1647b2238cebce528bdf16c91a4962dc4a3031825cea93ad1d3d428117b65faa0ff3e8c9a3d5c69e85849"}
```

